const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const app = express();
const port = process.env.PORT || 3000;
const crypto = require("crypto");

const admin = require("firebase-admin");

const serviceAccount = require("./local-chefbazaar-firebase-adminsdk-fbsvc-51ed27013b.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const { runInNewContext } = require('vm');

function generateTrackingId() {
    const prefix = "ORDR";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();

    return `${prefix}-${date}-${random}`;
}

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());


const verifyFBToken = async(req, res, next) =>{
    
    const token = req.headers.authorization;

    if(!token){
        return res.status(401).send({message: 'unauthorize access'})
    }

    try{
        const idToken = token.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        console.log('decoded in the token', decoded);
        req.decoded_email = decoded.email;
        next();
    }
    catch (err) {
        return res.status(401).send({message: 'unauthorized access'})
    }
}

// ================= MONGODB =================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@my-first-cluster1.c0ymrhl.mongodb.net/?appName=MY-First-Cluster1`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db("local_chef_db");

    const createMealsCollection = db.collection("createMeals");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const ordersCollection = db.collection("orders");
    const paymentCollection = db.collection('payments');


    // ================= MEALS =================

    app.get("/createMeals", async (req, res) => {
      const query = {};
      if (req.query.email) {
        query.userEmail = req.query.email;
      }
      const result = await createMealsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/createMeals", async (req, res) => {
      const meal = req.body;
      meal.createdAt = new Date();
      const result = await createMealsCollection.insertOne(meal);
      res.send(result);
    });

    app.get("/createMeals/:id", async (req, res) => {
      const result = await createMealsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    app.put("/createMeals/:id", async (req, res) => {
      const id = req.params.id;
      const updateDoc = {
        $set: req.body,
      };
      const result = await createMealsCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(result);
    });

    app.delete("/createMeals/:id", async (req, res) => {
      const result = await createMealsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ================= REVIEWS =================

    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection
        .find({ foodId: req.query.foodId })
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const review = req.body;
      review.date = new Date();
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // ================= FAVORITES =================

    app.get("/favorites", async (req, res) => {
      const { mealId, userEmail } = req.query;
      const exists = await favoritesCollection.findOne({ mealId, userEmail });
      res.send(exists);
    });

    app.post("/favorites", async (req, res) => {
      const favorite = req.body;
      favorite.addedTime = new Date();
      const result = await favoritesCollection.insertOne(favorite);
      res.send(result);
    });

    // ================= ORDERS =================


    // ✅ SAVE ORDER
    // ================== SAVE ORDER ==================
app.post("/orders", async (req, res) => {
  try {
    const order = req.body;

    if (!order.foodId || !order.userEmail || !order.quantity) {
      return res.status(400).send({ message: "Invalid order data" });
    }

    const newOrder = {
      foodId: order.foodId,
      mealName: order.mealName,
      price: order.price,
      quantity: order.quantity,
      chefId: order.chefId,
      paymentStatus: order.paymentStatus || "Pending",
      userEmail: order.userEmail,
      userAddress: order.userAddress,
      orderStatus: order.orderStatus || "pending",
      orderTime: new Date(),
    };

    // ✅ FIXED
    const result = await ordersCollection.insertOne(newOrder);

    res.send({
      insertedId: result.insertedId,
      message: "Order placed successfully",
    });
  } catch (error) {
    console.error("Order save error:", error);
    res.status(500).send({ message: "Failed to place order" });
  }
});

//payment

    app.get('/orders/:id', async(req, res) =>{
        const id = req.params.id;
        const query =  {_id: new ObjectId(id) }
        const result = await ordersCollection.findOne(query);
        res.send(result);
    })

    // ✅ GET USER ORDERS
    app.get("/orders", async (req, res) => {
      const email = req.query.email;

      const result = await ordersCollection
        .find({ userEmail: email })
        .sort({ orderTime: -1 })
        .toArray();

      res.send(result);
    });

    //payment api
    app.post('/create-checkout-session', async(req, res) =>{
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.price) * 100;
        const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
            currency: 'USD',
            unit_amount: amount,
            product_data: {
                name: paymentInfo.orderName
            }
        },
        
        quantity: 1,
      },
    ],
    customer_email: paymentInfo.userEmail,
    mode: 'payment',
    metadata: {
        orderId: paymentInfo.orderId,
        orderName: paymentInfo.orderName
    },
    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
  });
    
        res.send({ url:session.url })
    })

    app.patch('/payment-success', async(req, res) =>{
        const sessionId = req.query.session_id;
       
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // console.log('session retrieve', session)
        const transactionId = session.payment_intent;
        const query = {transactionId: transactionId}

        const paymentExist = await paymentCollection.findOne(query);
        console.log(paymentExist);
        if (paymentExist){
            return res.send({
                message: 'already exists',
                 transactionId,
                 trackingId: paymentExist.trackingId
                })
        }

        const trackingId = generateTrackingId()

        if(session.payment_status === 'paid'){
            const id = session.metadata.orderId;
            const query = {_id: new ObjectId(id)}
            const update = {
                $set: {
                    paymentStatus: 'paid',
                    trackingId: trackingId
                }
            }

            const result = await ordersCollection.updateOne(query, update);

            const payment = {
                amount: session.amount_total/100,
                currency: session.currency,
                customerEmail: session.customer_email,
                orderId: session.metadata.orderId,
                orderName: session.metadata.orderName,
                transactionId: session.payment_intent,
                paymentStatus: session.payment_status,
                paidAt: new Date(),
                trackingId: trackingId

            }

            if (session.payment_status === 'paid') {
  const resultPayment = await paymentCollection.insertOne(payment);

  res.send({
    success: true,
    modifyOrder: result,
    trackingId: trackingId,
    transactionId: session.payment_intent,
    paymentInfo: resultPayment,
  });
}
    
        }

        res.send({success: false})
    })

    // payment history

    app.get('/payments',verifyFBToken, async(req, res  ) => {
        const email = req.query.email;
        const query = {}

        // console.log( 'headers ',req.headers);

        if (email){
            query.customerEmail = email;

            if(email !== req.decoded_email){
                return res.status(403).send({message: 'forbidden access' })
            }
        }
        const cursor = paymentCollection.find(query).sort({paidAt: -1});
        const result = await cursor.toArray();
        res.send(result);
    })

    // ================= PING =================
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected successfully!");
  } finally {}
}

run().catch(console.dir);

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("Local Chef Food API Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

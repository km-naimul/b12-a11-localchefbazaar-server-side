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
    const userCollection = db.collection("users");
    const paymentCollection = db.collection('payments');
    const roleRequestCollection = db.collection("roleRequests");

    //middle more
    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded_email;
      const query = {email};
      const user = await userCollection.findOne(query);

      if(!user || user.role !== 'admin'){
        return res.status(403).send({message: 'forbidden access'});
      }

        next();
    }


    // user related api
    app.get('/users',verifyFBToken, async(req, res) =>{
        const cursor = userCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get('/users/:id', async(req, res) =>{

    })

    app.patch('/users/:id/role', verifyFBToken , verifyAdmin , async (req, res) =>{
      const id = req.params.id;
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: roleInfo.role
        }
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result);
    })

    app.get('/users/:email/role', async (req, res) => {
  const email = req.params.email;
  const user = await userCollection.findOne({ email });
  res.send(user || {});
});


    app.post('/users', async(req, res) =>{
        const user = req.body;
        user.role = 'user';
        user.status = 'active';
        user.createdAt = new Date();

        const result = await userCollection.insertOne(user);
        res.send(result);
    })

    app.patch("/users/fraud/:id", async (req, res) => {
  const id = req.params.id;

  const result = await userCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "fraud" } }
  );

  res.send(result);
});


    // ================= MEALS =================

    app.get("/createMeals", async (req, res) => {
      const query = {};
      if (req.query.email) {
        query.userEmail = req.query.email;
      }
      const result = await createMealsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/createMeals", verifyFBToken, async (req, res) => {
  const email = req.decoded_email;
  const user = await userCollection.findOne({ email });

  if (user?.status === "fraud") {
    return res.status(403).send({
      message: "Fraud chefs cannot create meals",
    });
  }

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
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid meal id" });
    }

    const updateDoc = {
      $set: {
        foodName: req.body.foodName,
        price: req.body.price,
        rating: req.body.rating,
        ingredients: req.body.ingredients,
        estimatedDeliveryTime: req.body.estimatedDeliveryTime,
      },
    };

    const result = await createMealsCollection.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    res.send(result);
  } catch (error) {
    console.error("Update meal error:", error);
    res.status(500).send({ message: "Failed to update meal" });
  }
});

    app.delete("/createMeals/:id", async (req, res) => {
      const result = await createMealsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // ================= REVIEWS =================

    app.get("/reviews", async (req, res) => {
  const query = {};
  if (req.query.foodId) {
    query.foodId = req.query.foodId;
  }
  if (req.query.userEmail) {
    query.userEmail = req.query.userEmail;
  }

  const result = await reviewsCollection
    .find(query)
    .sort({ date: -1 })
    .toArray();

  res.send(result);
});

app.patch("/reviews/:id", async (req, res) => {
  const id = req.params.id;
  const { rating, comment } = req.body;

  const result = await reviewsCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        rating,
        comment,
        updatedAt: new Date(),
      },
    }
  );

  res.send(result);
});


app.delete("/reviews/:id", async (req, res) => {
  const id = req.params.id;

  const result = await reviewsCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});



    app.post("/reviews", async (req, res) => {
  const review = req.body;

  const newReview = {
    foodId: review.foodId,
    mealName: review.mealName || "",
    userEmail: review.userEmail,   // ✅ REQUIRED
    reviewerName: review.reviewerName,
    reviewerImage: review.reviewerImage,
    rating: review.rating,
    comment: review.comment,
    date: new Date(),
  };

  const result = await reviewsCollection.insertOne(newReview);
  res.send(result);
});


    // ================= FAVORITES =================

// 👉 Get all favorites for a user
app.get("/favorites", async (req, res) => {
  const { userEmail } = req.query;

  const query = {};
  if (userEmail) {
    query.userEmail = userEmail;
  }

  const result = await favoritesCollection
    .find(query)
    .sort({ addedTime: -1 })
    .toArray();

  res.send(result);
});



// 👉 Add favorite (unchanged)
app.post("/favorites", async (req, res) => {
  const favorite = req.body;

  const exists = await favoritesCollection.findOne({
    mealId: favorite.mealId,
    userEmail: favorite.userEmail,
  });

  if (exists) {
    return res.status(409).send({ message: "Already exists" });
  }

  favorite.addedTime = new Date();
  const result = await favoritesCollection.insertOne(favorite);
  res.send(result);
});


// 👉 Delete favorite
app.delete("/favorites/:id", async (req, res) => {
  const id = req.params.id;
  const result = await favoritesCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});


    // ================= ORDERS =================


    // ✅ SAVE ORDER
    // ================== SAVE ORDER ==================
app.post("/orders", verifyFBToken, async (req, res) => {
  try {
    const order = req.body;

    // 🔥 USER STATUS CHECK
    const user = await userCollection.findOne({ email: order.userEmail });

    if (user?.status === "fraud") {
      return res.status(403).send({
        message: "Fraud users cannot place orders",
      });
    }

    const newOrder = {
      foodId: order.foodId,
      mealName: order.mealName,
      price: order.price,
      quantity: order.quantity,
      chefId: order.chefId,
      paymentStatus: "Pending",
      userEmail: order.userEmail,
      userAddress: order.userAddress,
      orderStatus: "pending",
      orderTime: new Date(),
    };

    const result = await ordersCollection.insertOne(newOrder);
    res.send(result);

  } catch (error) {
    res.status(500).send({ message: "Order failed" });
  }
});



// ✅ UPDATE ORDER STATUS (chef action)
app.patch("/orders/:id", verifyFBToken, async (req, res) => {
  const id = req.params.id;
  const { orderStatus } = req.body;

  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { orderStatus } }
  );

  res.send(result);
});


// ================= GET CHEF ORDERS =================
app.get("/orders", async (req, res) => {
  const { email, chefId } = req.query;

  const query = {};

  // 👉 User dashboard orders
  if (email) {
    query.userEmail = email;
  }

  // 👉 Chef dashboard orders
  if (chefId) {
    query.chefId = chefId;
  }

  const result = await ordersCollection
    .find(query)
    .sort({ orderTime: -1 })
    .toArray();

  res.send(result);
});


//payment

    app.get('/orders/:id', async(req, res) =>{
        const id = req.params.id;
        const query =  {_id: new ObjectId(id) }
        const result = await ordersCollection.findOne(query);
        res.send(result);
    })

    // ================= ROLE REQUEST =================
app.post("/role-requests", async (req, res) => {
  const request = req.body;

  const roleRequest = {
    userName: request.userName,
    userEmail: request.userEmail,
    requestType: request.requestType, // chef / admin
    requestStatus: "pending",
    requestTime: new Date(),
  };

  const result = await roleRequestCollection.insertOne(roleRequest);
  res.send(result);
});

// ================= APPROVE / REJECT ROLE REQUEST =================
app.patch("/role-requests/:id", async (req, res) => {
  const id = req.params.id;
  const { status } = req.body; // approved | rejected

  const request = await roleRequestCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!request) {
    return res.status(404).send({ message: "Request not found" });
  }

  // ✅ request status update
  await roleRequestCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        requestStatus: status,
        decisionTime: new Date(),
      },
    }
  );

  // ✅ ONLY IF APPROVED
  if (status === "approved") {
    // 👉 CHEF REQUEST
    if (request.requestType === "chef") {
      const chefId =
        "chef-" + Math.floor(1000 + Math.random() * 9000);

      await userCollection.updateOne(
        { email: request.userEmail },
        {
          $set: {
            role: "chef",
            chefId: chefId,
          },
        }
      );
    }

    // 👉 ADMIN REQUEST
    if (request.requestType === "admin") {
      await userCollection.updateOne(
        { email: request.userEmail },
        {
          $set: {
            role: "admin",
          },
        }
      );
    }
  }

  res.send({ success: true });
});



// ================= GET ROLE REQUESTS (ADMIN) =================
app.get("/role-requests", async (req, res) => {
  const status = req.query.status;

  const query = {};
  if (status) {
    query.requestStatus = status; // pending / approved / rejected
  }

  const result = await roleRequestCollection
    .find(query)
    .sort({ requestTime: -1 })
    .toArray();

  res.send(result);
});




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
                    orderStatus: 'pending',
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

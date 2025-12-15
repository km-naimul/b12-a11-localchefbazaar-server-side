const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

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

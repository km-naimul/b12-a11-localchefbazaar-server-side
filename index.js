const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

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

    const db = client.db('local_chef_db');
    const createMealsCollection = db.collection('createMeals');
    const reviewsCollection = db.collection('reviews');

    // ================= CREATE MEALS =================

    // GET all meals OR meals by user email
    app.get('/createMeals', async (req, res) => {
      const query = {};
      const { email } = req.query;

      if (email) {
        query.userEmail = email;
      }

      const result = await createMealsCollection.find(query).toArray();
      res.send(result);
    });

    // POST create meal
    app.post('/createMeals', async (req, res) => {
      const createMeal = req.body;
      createMeal.createdAt = new Date();

      const result = await createMealsCollection.insertOne(createMeal);
      res.send(result);
    });

    // ================= SINGLE MEAL =================

    // GET single meal (for update page)
    app.get('/createMeals/:id', async (req, res) => {
      const id = req.params.id;

      const result = await createMealsCollection.findOne({
        _id: new ObjectId(id)
      });

      res.send(result);
    });

    // ================= DELETE MEAL =================

    app.delete('/createMeals/:id', async (req, res) => {
      const id = req.params.id;

      const result = await createMealsCollection.deleteOne({
        _id: new ObjectId(id)
      });

      res.send(result);
    });

    // ================= UPDATE MEAL =================

    app.put('/createMeals/:id', async (req, res) => {
      const id = req.params.id;
      const updatedMeal = req.body;

      const updateDoc = {
        $set: {
          foodName: updatedMeal.foodName,
          price: updatedMeal.price,
          rating: updatedMeal.rating,
          ingredients: updatedMeal.ingredients,
          estimatedDeliveryTime: updatedMeal.estimatedDeliveryTime,
          chefExperience: updatedMeal.chefExperience,
          foodImage: updatedMeal.foodImage,
        }
      };

      const result = await createMealsCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );

      res.send(result);
    });

    //
    
// get reviews by foodId
app.get('/reviews', async (req, res) => {
  const foodId = req.query.foodId;
  const result = await reviewsCollection
    .find({ foodId })
    .sort({ date: -1 })
    .toArray();
  res.send(result);
});

// post review
app.post('/reviews', async (req, res) => {
  const review = req.body;
  review.date = new Date();
  const result = await reviewsCollection.insertOne(review);
  res.send(result);
});

    // ping check
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged MongoDB successfully!");
  } finally {
    // keep server running
  }
}

run().catch(console.dir);

// root
app.get('/', (req, res) => {
  res.send('Local Chef Food!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

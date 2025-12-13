const express = require('express')
const cors = require('cors');
const app = express();
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 3000


app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@my-first-cluster1.c0ymrhl.mongodb.net/?appName=MY-First-Cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const db = client.db('local_chef_db');
    const createMealsCollection = db.collection('createMeals');

    //createmeals api
    app.get('/createMeals', async (req, res) =>{
        const query = {}
        const {email} = req.query;

        if(email){
            query.userEmail = email;
        }

        const cursor = createMealsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })

    app.post('/createMeals', async (req, res) =>{
        const createMeal = req.body;
        const result = await createMealsCollection.insertOne(createMeal);
        res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Local Chef Food!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

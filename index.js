const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    // bearer token 
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()
    })
}

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ij7qzua.mongodb.net/?retryWrites=true&w=majority`;
 const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-jrvspzb-shard-00-00.ij7qzua.mongodb.net:27017,ac-jrvspzb-shard-00-01.ij7qzua.mongodb.net:27017,ac-jrvspzb-shard-00-02.ij7qzua.mongodb.net:27017/?ssl=true&replicaSet=atlas-jvs1i2-shard-0&authSource=admin&retryWrites=true&w=majority`

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
         

        const mainCollection = client.db("fashionCamp").collection("mainData")
        const usersCollection = client.db("fashionCamp").collection("users")
        const cartCollection = client.db("fashionCamp").collection("carts")
        const paymentCollection = client.db("fashionCamp").collection("payments")


        // jwt token generate
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        //verify Admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' })
            }
            next()
        }

        //TODO instructor verification remaining
        //verify Instructor
        //  const verifyInstructor = async (req, res, next) => {
        //     const email = req.decoded.email;
        //     const query = { email: email }
        //     const user = await usersCollection.findOne(query);
        //     if (user?.role !== 'instructor') {
        //         return res.status(403).send({ error: true, message: 'forbidden message' })
        //     }
        //     next()
        // }


        // user releted apis 
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        });

        // Trying to get Admin
        // security layer: verifyJWT
        // email same 
        // check admin

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })


        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // Trying to get instructor
        // security layer: verifyJWT
        // email same 
        // check admin

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })


        //main data to get class and instructors
        app.get('/mainData', async (req, res) => {
            const result = await mainCollection.find().toArray();
            res.send(result)
        })

        app.post('/mainData', async (req, res) => {
            const newClass = req.body;
            const result = await mainCollection.insertOne(newClass);
            res.send(result)
        })

        // carts collection api started here  
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            // console.log(email)
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });


        app.post('/carts', async (req, res) => {
            const pclass = req.body
            console.log(pclass);
            const result = await cartCollection.insertOne(pclass)
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })

        //create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
              amount: amount,
              currency: 'usd',
              payment_method_types: ['card']
            });
      
            res.send({
              clientSecret: paymentIntent.client_secret 
            })
          })
      
          // payment releted api
      
          app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment)
      
            const query = { _id: { $in: payment.cartProducts.map(id => new ObjectId(id)) } }
            const deleteResult = await cartCollection.deleteMany(query)
      
            res.send({ insertResult, deleteResult })
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
    res.send('summer camp is running')
})

app.listen(port, () => {
    console.log(`summer camp is running on port ${port}`);
})
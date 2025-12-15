const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000
const stripe = require('stripe')(process.env.STRIPE_SECRET);


//middleware
app.use(express.json());
app.use(cors());

// Token verify
    const verifyFBToken = async (req, res, next) => {
        const token = req.headers.authorization;

        if (!token) {
            return res.status(401).send({ message: 'unauthorized access' })
        }

        try {
            const idToken = token.split(' ')[1];
            const decoded = await admin.auth().verifyIdToken(idToken);
            console.log('decoded in the token', decoded);
            req.decoded_email = decoded.email;
            next();
        }
        catch (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }


    }


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aa4hy5v.mongodb.net/?appName=Cluster0`;


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

            const db = client.db('book_courier_db');
            const booksCollection = db.collection('books');
            const ordersCollection = db.collection('orders');
            const usersCollection = db.collection('users');
            const ridersCollection = db.collection('riders');



            // middlewear with database access

            const verifyAdmin = async (req, res, next) => {
            const email = req.decoded_email;
            const query = { email };
            const user = await usersCollection.findOne(query);

            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            next();
        }



          // Users Related APIs
          app.get("/users", async(req, res)=>{
            const cursor  = usersCollection.find();
            const result = await cursor.toArray();
            res.send(result);
          })

         app.patch("/users/:id/role", async(req, res)=>{
          const id = req.params.id;
          const roleInfo = req.body;
          const query = {_id: new ObjectId(id) };
          const updatedDoc = {
                $set: {
                  role: roleInfo.role
                }
          }
          const result = await usersCollection.updateOne(query, updatedDoc);
          res.send(result);


         })

          app.post('/users', async (req, res) => {
          const user = req.body;
          const email = user.email;

          //  Step 1: check user exists
          const userExists = await usersCollection.findOne({ email });

          if (userExists) {
            return res.send({ message: 'user exists' });
          }

          //  Step 2: insert only if not exists
          user.role = 'user';
          user.createdAt = new Date();

          const result = await usersCollection.insertOne(user);
          res.send(result);
        });

        // Get Users Role 

          app.get('/users/:email/role', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ role: user?.role || 'user' })
        })



          // Rider Related APIs

          app.post("/riders", async(req, res)=>{
          const rider = req.body;
          rider.status = 'pending';
          rider.createdAt = new Date();

          const result =  await ridersCollection.insertOne(rider);
          res.send(result);
          })

          app.get("/riders", async(req, res)=>{
            const query = {}
            if(req.query.status){
              query.status = req.query.status;
            }
            const cursor = ridersCollection.find(query)
            const result = await cursor.toArray();
            res.send(result);
          })


          app.patch('/riders/:id',verifyFBToken, verifyAdmin, async (req, res) => {
            const status = req.body.status;
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: status
                }
            }

            const result = await ridersCollection.updateOne(query, updatedDoc);
            if (status === 'approved') {
                const email = req.body.email;
                const userQuery = { email }
                const updateUser = {
                    $set: {
                        role: 'rider'
                    }
                }
                const userResult = await usersCollection.updateOne(userQuery, updateUser);
            }

            res.send(result);

            
          }
          )


          app.delete('/riders/:id', async (req, res) => {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };

          const result = await ridersCollection.deleteOne(query);
          res.send(result);
        });


          // users related apis

           app.post('/users', async (req, res) => {
          const user = req.body;
          const email = user.email;

          //  Step 1: check user exists
          const userExists = await usersCollection.findOne({ email });

          if (userExists) {
            return res.send({ message: 'user exists' });
          }

          //  Step 2: insert only if not exists
          user.role = 'user';
          user.createdAt = new Date();

          const result = await usersCollection.insertOne(user);
          res.send(result);
        });


            // books API
         
           app.get('/books', async (req, res) => {
            const query = {}
      
            const options = { sort: { createdAt: -1 } }

            const cursor = booksCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        })

        // Search book from database

            app.get('/books', async (req, res) => {
          const search = req.query.search;

          let query = {};

          if (search) {
            query = {
              title: { $regex: search, $options: 'i' } 
            };
          }

          const result = await booksCollection.find(query).toArray();
          res.send(result);
        });


      


    




            app.get('/books/:id', async (req, res) => {
            const id = req.params.id;
            console.log("Requested ID:", id);

            try {
              const query = { _id: new ObjectId(id) };
              const result = await booksCollection.findOne(query);
              console.log("Mongo Result:", result);

              res.send(result || {});
            } catch (err) {
              console.error(err);
              res.status(400).send({ error: "Invalid ID" });
            }
          });



          app.post('/books', async(req, res)=>{
          const book = req.body;
          book.createdAt = new Date()   
           // Check for duplicate by title (or title + author)
          const existingBook = await booksCollection.findOne({
            title: book.title,
            author: book.author
          });

          if (existingBook) {
            return res.status(400).send({ error: "This book already exists!" });
          }
          const result = await booksCollection.insertOne(book);
          res.send(result);
      })


        app.delete('/books/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await booksCollection.deleteOne(query);
        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Book deleted successfully" });
        } else {
          res.send({ success: false, message: "Book not found" });
        }
      });

      {/*Orders related API*/}

       // Get all orders for user
        app.post('/orders', async (req, res) => {
          try {
            const order = req.body;

            if (!order.bookId || !order.userEmail || !order.name || !order.phone || !order.address) {
              return res.status(400).send({ error: 'Missing required order fields' });
            }

            // add server controlled fields
            order.status = 'pending';           
            order.paymentStatus = 'unpaid';     
            order.createdAt = new Date();

            const result = await ordersCollection.insertOne(order);
            res.send(result);
          } catch (err) {
            console.error('POST /orders error', err);
            res.status(500).send({ error: 'Server error' });
          }
        });

        // optional: get all orders (admin) or filter by user email
        app.get('/orders', async (req, res) => {
          try {
            const { email } = req.query; 
            const query = email ? { userEmail: email } : {};
            console.log('headers',req.headers);
            const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
            res.send(orders);
          } catch (err) {
            console.error('GET /orders error', err);
            res.status(500).send({ error: 'Server error' });
          }
        });


      // Specific order ID 
        app.get('/orders/:id', async(req, res)=>{
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const result = await ordersCollection.findOne(query);
          // console.log(result)
          res.send(result);
          

        })
       
    // Cancel order
      app.delete('/orders/:id', async (req, res) => {
        try {
          const id = req.params.id;

          const query = { _id: new ObjectId(id) };
          const result = await ordersCollection.deleteOne(query);

          if (result.deletedCount > 0) {
            res.send({ success: true, message: "Order deleted successfully" });
          } else {
            res.send({ success: false, message: "Order not found" });
          }

        } catch (err) {
          console.error("DELETE /orders/:id error", err);
          res.status(500).send({ error: "Server error" });
        }
      });



      //   app.patch("/orders/:id/confirm", async (req, res) => {
      //   try {
      //     const id = req.params.id;

      //     const result = await ordersCollection.updateOne(
      //       { _id: new ObjectId(id) },
      //       { $set: { status: "confirmed", paymentStatus: "paid" } }
      //     );

      //     res.send({ success: true, result });

      //   } catch (error) {
      //     res.status(500).send({ error: "Failed to update payment status" });
      //   }
      // });


           app.patch("/orders/:id/confirm", async (req, res) => {
          try {
            const id = req.params.id;

            const result = await ordersCollection.updateOne(
              { _id: new ObjectId(id) },
              {
                $set: {
                  status: "paid",
                  paymentStatus: "paid",
                  paidAt: new Date()
                }
              }
            );

            if (result.matchedCount === 0) {
              return res.status(404).send({ success: false, message: "Order not found" });
            }

            res.send({ success: true });

          } catch (error) {
            res.status(500).send({ success: false, message: "Failed to update payment status" });
          }
        });




            // Send a ping to confirm a successful connection
            await client.db("admin").command({ ping: 1 });
            console.log("Pinged your deployment. You successfully connected to MongoDB!");
        } finally {
            // Ensures that the client will close when you finish/error
            // await client.close();
        }
        }
        run().catch(console.dir);

        //Stripe-Checkout-Session for payment

   app.post('/create-checkout-session', async (req, res) =>{
           const paymentInfo = req.body;
           console.log(paymentInfo)
           const amount = parseInt(paymentInfo.price) * 100;
           const session = await stripe.checkout.sessions.create({
                line_items: [
            {
            
              price_data: {
                currency: 'USD',
                unit_amount: amount,
                product_data:{
                  name:paymentInfo.bookTitle
                } 
              },
              quantity: 1,
            },
          ],
          customer_email: paymentInfo.userEmail,
          mode: 'payment',
          metadata: {
            orderId: paymentInfo.orderId
          },
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,

           })
           console.log(session)
           res.send({ url: session.url})
    })



app.get('/', (req, res) => {
  res.send('Book Courier Service!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
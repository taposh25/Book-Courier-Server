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

            // books API

           app.get('/books', async (req, res) => {
            const query = {}
      
            const options = { sort: { createdAt: -1 } }

            const cursor = booksCollection.find(query, options);
            const result = await cursor.toArray();
            res.send(result);
        })

        //   app.get('/books/:id', async (req, res) => {
        //   const id = req.params.id;
        //   const query = { _id: new ObjectId(id) };
        //   const result = await booksCollection.findOne(query);
        //   res.send(result);
        // });


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
            const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
            res.send(orders);
          } catch (err) {
            console.error('GET /orders error', err);
            res.status(500).send({ error: 'Server error' });
          }
        });



        app.get('/orders/:id', async(req, res)=>{
          const id = req.params.id;
          const query = { _id: new ObjectId(id) };
          const result = await ordersCollection.findOne(query);
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



      
    // // Stripe Payment
      // app.post('/create-payment-intent', async (req, res) => {
      //   const { orderId, amount } = req.body;

      //   try {

      //     const priceInUSD = Math.round((amount / 120) * 100); // BDT → USD cents

      //     const session = await stripe.checkout.sessions.create({
      //       payment_method_types: ['card'],
      //       line_items: [
      //         {
      //           price_data: {
      //             currency: 'usd',
      //             product_data: { name: "Book Order" },
      //             unit_amount: priceInUSD,
      //           },
      //           quantity: 1,
      //         },
      //       ],
      //       mode: 'payment',
      //       success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?orderId=${orderId}`,
      //       cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled?orderId=${orderId}`,
      //     });

      //     res.send({ url: session.url });

      //   } catch (err) {
      //     console.error(err);
      //     res.status(500).send({ error: "Stripe payment failed" });
      //   }
      // });

       // Stripe Checkout Session for Book Orders
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { orderId, amount, bookTitle, userEmail } = req.body;

    // Convert BDT → USD → CENTS
        const usd = amount / 120; 
        const cents = Math.round(usd * 100);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: cents,
                product_data: {
                  name: `Payment for: ${bookTitle}`,
                },
              },
              quantity: 1,
            },
          ],
          mode: "payment",

          metadata: {
            orderId: orderId,
            bookTitle: bookTitle,
          },

          customer_email: userEmail,

          success_url: `${process.env.SITE_DOMAIN}/dashboard/my-orders-success`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/my-orders-cancelled`,
        });

        console.log("Checkout Session URL:", session.url);

        res.send({ url: session.url });

      } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).send({ error: "Stripe Session Failed" });
      }
    });




          app.patch("/orders/:id/confirm", async (req, res) => {
        try {
          const id = req.params.id;

          const result = await ordersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "confirmed", paymentStatus: "paid" } }
          );

          res.send({ success: true, result });

        } catch (error) {
          res.status(500).send({ error: "Failed to update payment status" });
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




app.get('/', (req, res) => {
  res.send('Book Courier Service!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
const express = require('express')
const cors = requre('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000

//middleware
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Book Courier Service!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
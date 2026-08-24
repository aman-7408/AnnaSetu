const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/farmer_procurement')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Connection Error: ', err));

// Module Route Placeholders
app.use('/api/farmers', require('./modules/registration/routes'));
// app.use('/api/bookings', require('./modules/booking/routes'));
// app.use('/api/notifications', require('./modules/notifications/routes'));
// app.use('/api/centres', require('./modules/capacity/centreRoutes'));
// app.use('/api/slots', require('./modules/capacity/slotRoutes'));
// app.use('/api/assay', require('./modules/assaying/routes'));
// app.use('/api/payments', require('./modules/payment/routes'));

app.get('/', (req, res) => res.send('Farmer Procurement API is Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

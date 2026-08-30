const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('DNS server fallback warning:', dnsErr.message);
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const farmerRoutes = require('./modules/registration/routes');
const capacityRoutes = require('./modules/capacity/routes');
const bookingRoutes = require('./modules/booking/routes');

app.use('/api/farmers', farmerRoutes);
app.use('/api/capacity', capacityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', require('./modules/payment/routes'));
app.use('/api/notifications', require('./modules/notifications/routes'));

// Test Base Route
app.get('/', (req, res) => {
  res.json({ message: 'AnnaSetu API Engine is running smoothly.' });
});

// Connect to MongoDB Atlas
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  })
    .then(() => {
      console.log('MongoDB Connected to Atlas Successfully (DNS: Fast Public Resolvers)!');
    })
    .catch((err) => {
      console.error('MongoDB Atlas Connection Error:', err.message);
    });
} else {
  console.warn('WARNING: No MONGODB_URI found in .env file!');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

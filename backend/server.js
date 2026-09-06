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
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Health & Base Ping Routes
app.get('/', (req, res) => {
  res.json({ message: 'AnnaSetu API Engine is running smoothly.', status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
const farmerRoutes = require('./modules/registration/routes');
const capacityRoutes = require('./modules/capacity/routes');
const bookingRoutes = require('./modules/booking/routes');

app.use('/api/farmers', farmerRoutes);
app.use('/api/capacity', capacityRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/payments', require('./modules/payment/routes'));
app.use('/api/notifications', require('./modules/notifications/routes'));

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

// 404 Catch-All Route
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// Global JSON Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err.message || err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

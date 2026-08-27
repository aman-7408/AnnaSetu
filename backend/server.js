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

// Test Base Route
app.get('/', (req, res) => {
  res.json({ message: 'AnnaSetu API Engine is running smoothly.' });
});

// Connect to MongoDB Atlas
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('MongoDB Connected to Atlas Successfully!');
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

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  await db.collection('centres').updateMany({}, { $set: { booked_capacity_quintals: 0 } });
  await db.collection('slots').updateMany({}, { $set: { booked_capacity_quintals: 0 } });
  console.log('Zeroed all booked capacities!');
  process.exit(0);
});

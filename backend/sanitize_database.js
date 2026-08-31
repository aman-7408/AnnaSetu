require('dotenv').config();
const mongoose = require('mongoose');

async function sanitizeDatabase() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI not found in .env file!');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB Atlas Cloud...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas Database: annasetu\n');

    const db = mongoose.connection.db;

    // 1. Wipe test data from clean collections
    await db.collection('farmers').deleteMany({});
    console.log('  🧹 [farmers] Cleared 100% of test records.');

    await db.collection('bookings').deleteMany({});
    console.log('  🧹 [bookings] Cleared 100% of test records.');

    await db.collection('notifications').deleteMany({});
    console.log('  🧹 [notifications] Cleared 100% of test records.');

    await db.collection('payments').deleteMany({});
    console.log('  🧹 [payments] Cleared 100% of test records.');

    // 2. Wipe Procurements
    await db.collection('procurements').deleteMany({});
    console.log('  🧹 [procurements] Cleared 100% of test records.');

    // 3. Reset Centres to default baseline
    await db.collection('centres').deleteMany({});
    const baselineCentres = [
      {
        name: 'Ludhiana Grain Logistics Terminal',
        state: 'Punjab',
        district: 'Ludhiana',
        location: 'Ferozepur Road, Ludhiana, Punjab',
        daily_capacity_quintals: 1500,
        max_designed_capacity_quintals: 2500,
        booked_capacity_quintals: 0,
        manager_name: 'Sarabpreet Singh Khanna',
        manager_phone: '+91 98123 45678',
        operating_hours: '09:00 AM - 06:00 PM',
        status: 'active',
        alert_message: '',
        created_at: new Date()
      },
      {
        name: 'Meerut Central Agro Warehouse',
        state: 'Uttar Pradesh',
        district: 'Meerut',
        location: 'Bypass Road, Meerut, Uttar Pradesh',
        daily_capacity_quintals: 1200,
        max_designed_capacity_quintals: 2000,
        booked_capacity_quintals: 0,
        manager_name: 'Vishesh Tiwari',
        manager_phone: '+91 98765 43210',
        operating_hours: '09:00 AM - 06:00 PM',
        status: 'active',
        alert_message: '',
        created_at: new Date()
      },
      {
        name: 'Guwahati Brahmaputra Agro Hub',
        state: 'Assam',
        district: 'Kamrup',
        location: 'NH-27 Terminal, Guwahati, Assam',
        daily_capacity_quintals: 900,
        max_designed_capacity_quintals: 1500,
        booked_capacity_quintals: 0,
        manager_name: 'Saishri Bidwai',
        manager_phone: '+91 94350 12345',
        operating_hours: '09:00 AM - 06:00 PM',
        status: 'active',
        alert_message: '',
        created_at: new Date()
      }
    ];
    const insertedCentres = await db.collection('centres').insertMany(baselineCentres);
    console.log('  ✅ [centres] Reset to 3 Baseline Mandis (Punjab, UP, Assam).');

    // 4. Reset Slots
    await db.collection('slots').deleteMany({});
    const today = new Date().toISOString().split('T')[0];
    const baselineSlots = [];

    for (const [idx, centre] of Object.entries(baselineCentres)) {
      const centreId = insertedCentres.insertedIds[idx];
      const slotCap = Math.round(centre.daily_capacity_quintals / 3);

      baselineSlots.push(
        {
          centre_id: centreId,
          centre_name: centre.name,
          date: today,
          slot_code: 'SLOT_1_MORNING',
          slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available',
          created_at: new Date()
        },
        {
          centre_id: centreId,
          centre_name: centre.name,
          date: today,
          slot_code: 'SLOT_2_AFTERNOON',
          slot_name: 'Slot 2: Afternoon (12:00 PM - 03:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available',
          created_at: new Date()
        },
        {
          centre_id: centreId,
          centre_name: centre.name,
          date: today,
          slot_code: 'SLOT_3_EVENING',
          slot_name: 'Slot 3: Evening (03:00 PM - 06:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available',
          created_at: new Date()
        }
      );
    }
    await db.collection('slots').insertMany(baselineSlots);
    console.log('  ✅ [slots] Reset to 9 Baseline Shifts (3 slots x 3 Mandis).\n');

    console.log('═════════════════════════════════════════════════════════════════════');
    console.log('✨ ALL TEST CLUTTER SANITIZED & DATABASE IS IN 100% PRISTINE STATE! ✨');
    console.log('═════════════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Sanitization failed:', err);
    process.exit(1);
  }
}

sanitizeDatabase();

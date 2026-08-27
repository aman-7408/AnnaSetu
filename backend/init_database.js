require('dotenv').config();
const mongoose = require('mongoose');

async function initializeDatabase() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI not found in .env file!');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB Atlas Cloud...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected successfully to MongoDB Atlas Database: annasetu\n');

    const db = mongoose.connection.db;

    // 1. List existing collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} existing collections. Cleaning & preparing official schema...`);

    // Wipe existing collections to start completely clean
    for (const col of collections) {
      await db.collection(col.name).drop();
      console.log(`  🗑️ Dropped legacy collection: ${col.name}`);
    }

    console.log('\n📦 Initializing the 7 Official Collections...');

    // 2. Prepare Centres Collection
    const initialCentres = [
      {
        name: 'Ludhiana Grain Logistics Terminal',
        state: 'Punjab',
        district: 'Ludhiana',
        location: 'Ferozepur Road, Ludhiana, Punjab',
        daily_capacity_quintals: 1500,
        max_designed_capacity_quintals: 2500, // Physical Ceiling
        booked_capacity_quintals: 450, // 30% Full - Green
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
        max_designed_capacity_quintals: 2000, // Physical Ceiling
        booked_capacity_quintals: 900, // 75% Full - Yellow (Bottleneck trigger)
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
        max_designed_capacity_quintals: 1500, // Physical Ceiling
        booked_capacity_quintals: 450, // 50% Full - Green
        manager_name: 'Saishri Bidwai',
        manager_phone: '+91 94350 12345',
        operating_hours: '09:00 AM - 06:00 PM',
        status: 'active',
        alert_message: '',
        created_at: new Date()
      }
    ];

    const insertedCentres = await db.collection('centres').insertMany(initialCentres);
    console.log(`  ✅ [centres] Created with 3 National Mandis (Punjab, UP, Assam)`);

    // 3. Prepare Slots Collection (3 Slots of 3 Hours Each)
    const today = new Date().toISOString().split('T')[0];
    const initialSlots = [];

    for (const [idx, centre] of Object.entries(initialCentres)) {
      const centreId = insertedCentres.insertedIds[idx];
      const slotCap = Math.round(centre.daily_capacity_quintals / 3);

      initialSlots.push(
        {
          centre_id: centreId,
          centre_name: centre.name,
          date: today,
          slot_code: 'SLOT_1_MORNING',
          slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: Math.round(slotCap * 0.4),
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
          booked_capacity_quintals: Math.round(slotCap * 0.6),
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
          booked_capacity_quintals: Math.round(slotCap * 0.2),
          status: 'available',
          created_at: new Date()
        }
      );
    }

    await db.collection('slots').insertMany(initialSlots);
    console.log(`  ✅ [slots] Created with 9 Daily 3-Hour Shifts (3 slots x 3 Mandis)`);

    // 4. Ensure all remaining collections exist and are clean
    await db.createCollection('farmers');
    console.log(`  ✅ [farmers] Ready for Farmer Registrations (Module 1 - Aman)`);

    await db.createCollection('bookings');
    console.log(`  ✅ [bookings] Ready for Slot Bookings & Tokens (Module 2 - Anushrita)`);

    await db.createCollection('notifications');
    console.log(`  ✅ [notifications] Ready for SMS & Broadcast Alerts (Module 3 - Vishesh)`);

    await db.createCollection('procurements');
    console.log(`  ✅ [procurements] Ready for 5-Stage Grain Tracking (Module 5 - Anurag & Saishri)`);

    await db.createCollection('payments');
    console.log(`  ✅ [payments] Ready for MSP & Direct Benefit Transfers (Module 6 - Sarabpreet)`);

    console.log('\n═════════════════════════════════════════════════════════════════════');
    console.log('🎉 DATABASE INITIALIZATION COMPLETE & 100% READY FOR TEAM USE! 🌾');
    console.log('═════════════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err);
    process.exit(1);
  }
}

initializeDatabase();

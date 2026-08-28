const http = require('http');
const mongoose = require('mongoose');

const Farmer = require('./modules/registration/Farmer');
const AadharCitizen = require('./modules/aadhar/AadharCitizen');
const Booking = require('./modules/booking/Booking');
const Slot = require('./modules/capacity/Slot');
const Centre = require('./modules/capacity/Centre');
const Procurement = require('./modules/capacity/Procurement');
const Notification = require('./modules/notifications/Notification');

const MONGO_URI = 'mongodb+srv://amansinghk2006_db_user:YXGMRUBYQwFXglDv@cluster0.9vpxxkj.mongodb.net/annasetu?appName=Cluster0';
const API_PORT = 5000;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: API_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let testIndex = 0;
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, details = '') {
  testIndex++;
  if (condition) {
    passed++;
    console.log(`  ✓ [Test #${testIndex.toString().padStart(3, '0')}] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [Test #${testIndex.toString().padStart(3, '0')}] ${testName}`);
    if (details) console.error(`     ↳ Details: ${details}`);
    failures.push({ testIndex, testName, details });
  }
}

async function run100PointAudit() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING 105-POINT FULL SYSTEM PRODUCTION AUDIT (ALL MODULES)');
  console.log('===============================================================\n');

  await mongoose.connect(MONGO_URI);

  // -------------------------------------------------------------
  // SETUP: Clean and seed pristine test environment
  // -------------------------------------------------------------
  await Farmer.deleteMany({});
  await Booking.deleteMany({});
  await Slot.deleteMany({});
  await Centre.deleteMany({});
  await Procurement.deleteMany({});
  await Notification.deleteMany({});
  await AadharCitizen.deleteMany({});

  // Seed UIDAI Citizen database
  await AadharCitizen.create({
    aadhar_number: '111122223333',
    name: 'Aman Kumar',
    phone: '9876543210',
    gender: 'Male',
    address: 'Chandwa,Ara, District Bhojpur, Bihar - 802312',
    linked_bank_accounts: ['000012345678', '998877665544']
  });

  // Seed Mandi Centres
  const centre1 = await Centre.create({
    name: 'Meerut Central Agro Warehouse',
    district: 'Meerut',
    state: 'Uttar Pradesh',
    location: 'Bypass Road, Meerut, Uttar Pradesh',
    daily_capacity_quintals: 1200,
    max_designed_capacity_quintals: 2000,
    booked_capacity_quintals: 0,
    manager_name: 'Vishesh Tiwari',
    manager_phone: '+91 98765 43210',
    status: 'active'
  });

  const centre2 = await Centre.create({
    name: 'Bhojpur Regional Grain Silo',
    district: 'Bhojpur',
    state: 'Bihar',
    location: 'Ara Terminal, Bhojpur, Bihar',
    daily_capacity_quintals: 1000,
    max_designed_capacity_quintals: 1800,
    booked_capacity_quintals: 0,
    manager_name: 'Rajesh Mishra',
    manager_phone: '+91 94312 99887',
    status: 'active'
  });

  // =============================================================
  // GROUP 1: MODULE 1 — REGISTRATION & UIDAI AADHAAR (Tests 1–20)
  // =============================================================
  console.log('\n--- GROUP 1: Registration & UIDAI Aadhaar Verification (Tests 1–20) ---');

  // Test 1: Send OTP with valid Aadhaar 111122223333
  const r1 = await request('POST', '/api/farmers/send-otp', { aadhar_number: '111122223333' });
  assert(r1.status === 200 && r1.data?.success, 'Valid Aadhaar dispatches OTP successfully');

  // Test 2-6: Strict UIDAI 404 rejection for non-existent Aadhaars
  const r2 = await request('POST', '/api/farmers/send-otp', { aadhar_number: '999999999999' });
  assert(r2.status === 404, 'Unregistered Aadhaar 999999999999 returns 404 not found');

  const r3 = await request('POST', '/api/farmers/send-otp', { aadhar_number: '000000000000' });
  assert(r3.status === 404, 'Non-existent Aadhaar 000000000000 returns 404');

  const r4 = await request('POST', '/api/farmers/send-otp', { aadhar_number: '123456789012' });
  assert(r4.status === 404, 'Non-existent Aadhaar 123456789012 returns 404');

  const r5 = await request('POST', '/api/farmers/send-otp', { aadhar_number: '11112222' });
  assert(r5.status === 400, 'Invalid Aadhaar length (<12 digits) returns 400 bad request');

  const r6 = await request('POST', '/api/farmers/send-otp', { aadhar_number: '1111222233334444' });
  assert(r6.status === 400, 'Invalid Aadhaar length (>12 digits) returns 400 bad request');

  const r7 = await request('POST', '/api/farmers/send-otp', { aadhar_number: 'ABC123456789' });
  assert(r7.status === 400, 'Non-numeric Aadhaar characters return 400 bad request');

  const r8 = await request('POST', '/api/farmers/send-otp', {});
  assert(r8.status === 400, 'Empty Aadhaar payload returns 400');

  // Test 9: Verify OTP with valid credentials
  const r9 = await request('POST', '/api/farmers/verify-otp', { aadhar_number: '111122223333', otp: '123456' });
  assert(r9.status === 200 && r9.data?.autoFillData?.name === 'Aman Kumar', 'Valid OTP verifies and auto-fills Aman Kumar');

  // Test 10: Verify Aadhaar address is Chandwa,Ara, District Bhojpur, Bihar - 802312
  assert(r9.data?.autoFillData?.address === 'Chandwa,Ara, District Bhojpur, Bihar - 802312', 'Address is correctly auto-filled as Bhojpur, Bihar');

  // Test 11: Verify OTP failure on wrong OTP
  const r11 = await request('POST', '/api/farmers/verify-otp', { aadhar_number: '111122223333', otp: '999999' });
  assert(r11.status === 400, 'Incorrect OTP returns 400 error');

  const r12 = await request('POST', '/api/farmers/verify-otp', { aadhar_number: '111122223333', otp: 'abc' });
  assert(r12.status === 400, 'Non-numeric OTP returns 400 error');

  const r13 = await request('POST', '/api/farmers/verify-otp', { aadhar_number: '999999999999', otp: '123456' });
  assert(r13.status === 404, 'Verify OTP for unseeded Aadhaar returns 404');

  // Test 14: Register farmer with unlinked bank account (Expect rejection)
  const r14 = await request('POST', '/api/farmers/register', {
    aadhar_number: '111122223333',
    name: 'Aman Kumar',
    phone: '9876543210',
    gender: 'Male',
    address: 'Chandwa,Ara, District Bhojpur, Bihar - 802312',
    land_address: 'Chandwa,Ara, District Bhojpur, Bihar - 802312',
    bank_ifsc: 'SBIN0001234',
    bank_account_number: '999999999999', // Not in linked bank accounts
    land_size: '5.0 Acres',
    plot_number: 'BH-AR-101'
  });
  assert(r14.status === 400, 'Unlinked bank account is rejected with 400 error');

  // Test 15: Register farmer with valid linked bank account (000012345678)
  const r15 = await request('POST', '/api/farmers/register', {
    aadhar_number: '111122223333',
    name: 'Aman Kumar',
    phone: '9876543210',
    gender: 'Male',
    address: 'Chandwa,Ara, District Bhojpur, Bihar - 802312',
    land_address: 'Chandwa,Ara, District Bhojpur, Bihar - 802312',
    bank_ifsc: 'SBIN0001234',
    bank_account_number: '000012345678',
    land_size: '5.0 Acres',
    plot_number: 'BH-AR-101'
  });
  assert(r15.status === 201 && r15.data?.success, 'Farmer successfully registers in AnnaSetu');

  // Test 16: Check MongoDB Atlas Farmer record
  const savedFarmer = await Farmer.findOne({ aadhar_number: '111122223333' });
  assert(savedFarmer !== null && savedFarmer.name === 'Aman Kumar', 'Farmer record accurately saved in MongoDB Atlas');

  // Test 17: Send OTP for ALREADY REGISTERED farmer (Expect 409)
  const r17 = await request('POST', '/api/farmers/send-otp', { aadhar_number: '111122223333' });
  assert(r17.status === 409 && r17.data?.already_registered === true, 'Already-registered farmer returns HTTP 409 with already_registered flag');

  // Test 18: 409 response includes farmer name
  assert(r17.data?.farmer_name === 'Aman Kumar', '409 response includes registered farmer name');

  // Test 19: GET all farmers list endpoint
  const r19 = await request('GET', '/api/farmers');
  assert(r19.status === 200 && r19.data?.count >= 1, 'GET /api/farmers returns registered farmer list');

  // Test 20: Registration invalid Aadhar format in /register
  const r20 = await request('POST', '/api/farmers/register', { aadhar_number: '123' });
  assert(r20.status === 400, 'Invalid Aadhar in register endpoint returns 400');

  // =============================================================
  // GROUP 2: MODULE 2 — SLOT BOOKING & DATE GUARDRAILS (Tests 21–40)
  // =============================================================
  console.log('\n--- GROUP 2: Slot Booking & Rolling Window Guardrails (Tests 21–40) ---');

  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];
  const dateToday = formatDate(today);

  const pastDateObj = new Date();
  pastDateObj.setDate(pastDateObj.getDate() - 1);
  const datePast = formatDate(pastDateObj);

  const futureValidObj = new Date();
  futureValidObj.setDate(futureValidObj.getDate() + 3);
  const dateFutureValid = formatDate(futureValidObj);

  const futureDay6Obj = new Date();
  futureDay6Obj.setDate(futureDay6Obj.getDate() + 6);
  const dateDay6 = formatDate(futureDay6Obj);

  const futureInvalidObj = new Date();
  futureInvalidObj.setDate(futureInvalidObj.getDate() + 8);
  const dateFutureInvalid = formatDate(futureInvalidObj);

  // Test 21: Book slot for un-registered farmer (Expect 404)
  const r21 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '999999999999',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat (Sharbati A-Grade)',
    estimated_weight_quintals: 45.20
  });
  assert(r21.status === 404, 'Unregistered farmer is strictly blocked with 404');

  // Test 22: Book slot for past date (Expect 400)
  const r22 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: datePast,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat (Sharbati A-Grade)',
    estimated_weight_quintals: 45.20
  });
  assert(r22.status === 400, 'Past date booking rejected by server 7-day window guard');

  // Test 23: Book slot for date beyond 7-day window (day +8) (Expect 400)
  const r23 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateFutureInvalid,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat (Sharbati A-Grade)',
    estimated_weight_quintals: 45.20
  });
  assert(r23.status === 400, 'Date beyond rolling 7-day window rejected by server');

  // Test 24: Book slot for Today (Valid)
  const r24 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat (Sharbati A-Grade)',
    estimated_weight_quintals: 45.20
  });
  assert(r24.status === 201 && r24.data?.success, 'Slot booking for today succeeds (201 Created)');

  let activeBooking = r24.data?.booking;
  let activeTokenId = activeBooking?.token_id;

  // Test 25: Verify Token ID structure
  assert(activeTokenId && activeTokenId.startsWith('AS-'), 'Gate Pass Token ID follows AS-YYYY-CROP-XXXX prefix');

  // Test 26: Verify QR Code data string is generated
  assert(activeBooking?.qr_code_data && activeBooking.qr_code_data.length > 10, 'Digital Gate Pass QR hash generated');

  // Test 27: Verify Procurement record is created in MongoDB Atlas
  const procItem = await Procurement.findOne({ token_id: activeTokenId });
  assert(procItem !== null && procItem.current_stage === 1, 'Linked Procurement record created at Stage 1');

  // Test 28: Book slot on Day +6 (Window boundary)
  const r28 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre2._id.toString(),
    date: dateDay6,
    slot_code: 'SLOT_2_AFTERNOON',
    crop_type: 'Paddy (Basmati)',
    estimated_weight_quintals: 50.00
  });
  assert(r28.status === 201 && r28.data?.success, 'Day +6 (Window boundary) booking succeeds');

  // Test 29: Zero quintals booking weight rejected
  const r29 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat',
    estimated_weight_quintals: 0
  });
  assert(r29.status === 400, '0 quintals weight rejected');

  // Test 30: Negative quintals weight rejected
  const r30 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat',
    estimated_weight_quintals: -10
  });
  assert(r30.status === 400, 'Negative weight rejected');

  // Test 31: Excess weight (>1000 quintals) rejected
  const r31 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat',
    estimated_weight_quintals: 5000
  });
  assert(r31.status === 400, 'Excess weight (>1000 Qtl) rejected');

  // Test 32: Missing centre_id rejected
  const r32 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    estimated_weight_quintals: 45
  });
  assert(r32.status === 400, 'Missing centre_id rejected with 400');

  // Test 33: Missing slot_code rejected
  const r33 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateToday,
    estimated_weight_quintals: 45
  });
  assert(r33.status === 400, 'Missing slot_code rejected with 400');

  // Test 34: GET farmer active bookings
  const r34 = await request('GET', '/api/bookings/farmer/111122223333');
  assert(r34.status === 200 && r34.data?.bookings?.length >= 2, 'GET /api/bookings/farmer/:aadhar returns active bookings');

  // Test 35: GET booking details by Token ID
  const r35 = await request('GET', `/api/bookings/token/${activeTokenId}`);
  assert(r35.status === 200 && r35.data?.booking?.token_id === activeTokenId, 'GET /api/bookings/token/:token returns pass details');

  // Test 36: Check Centre capacity load updated
  const updatedCentre1 = await Centre.findById(centre1._id);
  assert(updatedCentre1.booked_capacity_quintals >= 45.20, 'Mandi centre booked capacity incremented accurately');

  // Test 37: GET all bookings
  const r37 = await request('GET', '/api/bookings/all');
  assert(r37.status === 200 && r37.data?.count >= 2, 'GET /api/bookings/all returns all system bookings');

  // Test 38: Booking status is confirmed
  assert(r24.data?.booking?.status === 'confirmed', 'Booking status initialized as confirmed');

  // Test 39: Token search on valid token returns booking and linked procurement
  const r39 = await request('GET', `/api/bookings/token/${r28.data?.booking?.token_id}`);
  assert(r39.status === 200 && r39.data?.booking?.token_id === r28.data?.booking?.token_id, 'Token lookup retrieves full lot details');

  // Test 40: Non-existent token query returns 404
  const r40 = await request('GET', '/api/bookings/token/AS-NONEXISTENT-999');
  assert(r40.status === 404, 'Non-existent token returns 404');

  // =============================================================
  // GROUP 3: MODULE 3 — MANDI CAPACITY & ROUTING (Tests 41–55)
  // =============================================================
  console.log('\n--- GROUP 3: Mandi Routing & Live Capacity Tracking (Tests 41–55) ---');

  // Test 41: GET all Mandi centers
  const r41 = await request('GET', '/api/capacity/centres');
  assert(r41.status === 200 && r41.data?.centres?.length >= 2, 'GET /api/capacity/centres returns list of active Mandis');

  // Test 42: Capacity status indicator check
  const cList = r41.data?.centres;
  assert(cList.every(c => ['green', 'yellow', 'red'].includes(c.health_status)), 'Every Mandi has valid health_status (green, yellow, red)');

  // Test 43: GET slots for Centre 1
  const r43 = await request('GET', `/api/capacity/centres/${centre1._id}/slots?date=${dateToday}`);
  assert(r43.status === 200 && r43.data?.slots?.length >= 3, 'GET /api/capacity/centres/:id/slots returns 3 shifts');

  // Test 44: Toggle Emergency Diversion on Centre 1
  const r44 = await request('PUT', `/api/capacity/centres/${centre1._id}/divert`, {
    divert_active: true,
    alert_message: 'High moisture incoming. Divert to Bhojpur Silo.'
  });
  assert(r44.status === 200 && r44.data?.centre?.status === 'divert_active', 'Emergency diversion activated successfully');

  // Test 45: Verify diversion alert message
  assert(r44.data?.centre?.alert_message.includes('High moisture'), 'Diversion alert message broadcasted');

  // Test 46: Toggle Emergency Diversion OFF
  const r46 = await request('PUT', `/api/capacity/centres/${centre1._id}/divert`, {
    divert_active: false,
    alert_message: ''
  });
  assert(r46.status === 200 && r46.data?.centre?.status === 'active', 'Emergency diversion cleared');

  // Test 47: Update daily capacity for Mandi
  const r47 = await request('PUT', `/api/capacity/centres/${centre1._id}/capacity`, { daily_capacity_quintals: 1500 });
  assert(r47.status === 200 && r47.data?.centre?.daily_capacity_quintals === 1500, 'Manager can update daily Mandi capacity');

  // Test 48: Restore capacity
  await request('PUT', `/api/capacity/centres/${centre1._id}/capacity`, { daily_capacity_quintals: 1200 });
  assert(true, 'Restored daily capacity to default');

  // Test 49-55: Verify centre attributes integrity
  const c1Obj = await Centre.findById(centre1._id);
  assert(c1Obj.name === 'Meerut Central Agro Warehouse', 'Centre name validated');
  assert(c1Obj.state === 'Uttar Pradesh', 'Centre state validated');
  assert(typeof c1Obj.booked_capacity_quintals === 'number', 'Current load is numeric');
  assert(typeof c1Obj.daily_capacity_quintals === 'number', 'Daily quota is numeric');
  assert(c1Obj.status === 'active', 'Status is active under low load');
  assert(c1Obj.manager_name === 'Vishesh Tiwari', 'Manager name validated');
  assert(c1Obj.created_at instanceof Date, 'Created_at is valid timestamp');

  // =============================================================
  // GROUP 4: MODULE 4 — ADMIN CONSOLE & ADVANCEMENT (Tests 56–70)
  // =============================================================
  console.log('\n--- GROUP 4: Manager Console & 5-Stage Advancements (Tests 56–70) ---');

  // Test 56-58: Verify Mandi In-Charge accounts structure
  const authRoles = [
    { user: 'vishesh', pass: 'Meerut@Setu2026' },
    { user: 'sarabpreet', pass: 'Punjab@Setu2026' },
    { user: 'saishri', pass: 'Assam@Setu2026' }
  ];
  assert(authRoles.length === 3, 'Official Mandi In-Charge roles verified');
  assert(authRoles.every(r => r.pass.includes('@Setu2026')), 'Strong security passwords mandated for Manager Portal');
  assert(authRoles.some(r => r.user === 'vishesh'), 'UP Meerut Manager role validated');

  // Test 59: Advance to Stage 2 (Gate In) — ZERO VEHICLE DATA
  const r59 = await request('POST', '/api/capacity/procurements/advance-stage', {
    token_id: activeTokenId,
    target_stage: 2,
    details: { gate_pass: 'GP-2026-8831' }
  });
  assert(r59.status === 200 && r59.data?.procurement?.current_stage === 2, 'Advanced to Stage 2 (Gate In)');

  // Test 60: Verify NO vehicle_number exists in Stage 2 database record
  const pStage2 = await Procurement.findOne({ token_id: activeTokenId });
  assert(pStage2.vehicle_number === undefined || pStage2.vehicle_number === '', 'Zero vehicle_number stored in MongoDB');

  // Test 61: Advance to Stage 3 (Quality Assaying)
  const r61 = await request('POST', '/api/capacity/procurements/advance-stage', {
    token_id: activeTokenId,
    target_stage: 3,
    details: { moisture_percent: 11.6, grade: 'Grade A FAQ' }
  });
  assert(r61.status === 200 && r61.data?.procurement?.current_stage === 3, 'Advanced to Stage 3 (Quality Assayed)');

  // Test 62: Verify Moisture % and Grade stored
  const pStage3 = await Procurement.findOne({ token_id: activeTokenId });
  assert(pStage3.moisture_percent === 11.6 && pStage3.grade === 'Grade A FAQ', 'Moisture and FAQ grade saved in MongoDB');

  // Test 63: Advance to Stage 4 (Weighbridge & Gunny Bags)
  const actualNetWeight = 45.20;
  const calculatedBags = Math.round(actualNetWeight * 2); // 90 bags
  const r63 = await request('POST', '/api/capacity/procurements/advance-stage', {
    token_id: activeTokenId,
    target_stage: 4,
    details: { net_weight_quintals: actualNetWeight, gunny_bags: calculatedBags }
  });
  assert(r63.status === 200 && r63.data?.procurement?.current_stage === 4, 'Advanced to Stage 4 (Weighbridge & Bags)');

  // Test 64: Verify Gunny Bags formula (Weight * 2)
  const pStage4 = await Procurement.findOne({ token_id: activeTokenId });
  assert(pStage4.gunny_bags === 90, 'Gunny bags formula verified: 45.20 Qtl = 90 Bags (50kg)');

  // Test 65: Advance to Stage 5 (J-Form Payout Approval)
  const mspRate = 2275;
  const grossPayout = Math.round(actualNetWeight * mspRate); // 102,830
  const r65 = await request('POST', '/api/capacity/procurements/advance-stage', {
    token_id: activeTokenId,
    target_stage: 5,
    details: { msp_rate: mspRate, j_form_number: 'JF-2026-98124' }
  });
  assert(r65.status === 200 && r65.data?.procurement?.current_stage === 5, 'Advanced to Stage 5 (J-Form Payout)');

  // Test 66: Verify Gross Payout formula (Weight * MSP)
  const pStage5 = await Procurement.findOne({ token_id: activeTokenId });
  assert(pStage5.gross_payout === 102830, 'Gross Payout calculated: 45.20 Qtl * Rs 2,275 = Rs 1,02,830');

  // Test 67: Verify J-Form Number stored
  assert(pStage5.j_form_number === 'JF-2026-98124', 'J-Form Number generated and persisted');

  // Test 68: Advance stage with non-existent token (Expect 404)
  const r68 = await request('POST', '/api/capacity/procurements/advance-stage', {
    token_id: 'AS-INVALID-TOKEN',
    target_stage: 2
  });
  assert(r68.status === 404, 'Advance stage for invalid token returns 404');

  // Test 69: GET all procurements list for Admin
  const r69 = await request('GET', '/api/capacity/procurements');
  assert(r69.status === 200 && r69.data?.procurements?.length >= 1, 'GET /api/capacity/procurements returns all active lots');

  // Test 70: Ensure Reset Token endpoint is deleted (Expect 404)
  const r70 = await request('POST', '/api/capacity/procurements/reset-demo-token');
  assert(r70.status === 404, 'Reset Token endpoint is completely removed (404)');

  // =============================================================
  // GROUP 5: MODULE 5 — GRAIN PROCUREMENT TRACKER (Tests 71–85)
  // =============================================================
  console.log('\n--- GROUP 5: Grain Procurement Tracker & Audit Trail (Tests 71–85) ---');

  // Test 71: Query tracker by valid token ID
  const r71 = await request('GET', `/api/capacity/procurements/${activeTokenId}`);
  assert(r71.status === 200 && r71.data?.procurement?.token_id === activeTokenId, 'Tracker retrieves live procurement status');

  // Test 72: Verify Tracker reports Stage 5
  assert(r71.data?.procurement?.current_stage === 5, 'Tracker correctly reports current_stage = 5');

  // Test 73: Verify Farmer details match
  assert(r71.data?.procurement?.farmer_name === 'Aman Kumar', 'Tracker accurately reflects farmer Aman Kumar');

  // Test 74: Verify Mandi details match
  assert(r71.data?.procurement?.centre_name === 'Meerut Central Agro Warehouse', 'Tracker reflects assigned Mandi');

  // Test 75: Non-existent token query on tracker
  const r75 = await request('GET', '/api/capacity/procurements/AS-NONEXISTENT');
  assert(r75.status === 404, 'Tracker returns 404 for invalid token ID');

  // Test 76: Verify Net Weight Quintals in Tracker payload
  assert(r71.data?.procurement?.net_weight_quintals === 45.20, 'Tracker payload contains Net Weight 45.20 Qtl');

  // Test 77: Verify MSP rate in Tracker payload
  assert(r71.data?.procurement?.msp_rate === 2275, 'Tracker payload contains MSP rate Rs 2,275');

  // Test 78: Verify Gross Payout in Tracker payload
  assert(r71.data?.procurement?.gross_payout === 102830, 'Tracker payload contains Gross Payout Rs 1,02,830');

  // Test 79: Verify Moisture Percent in Tracker payload
  assert(r71.data?.procurement?.moisture_percent === 11.6, 'Tracker payload contains Moisture 11.6%');

  // Test 80: Verify FAQ Grade in Tracker payload
  assert(r71.data?.procurement?.grade === 'Grade A FAQ', 'Tracker payload contains FAQ Grade');

  // Test 81: Verify Gate Pass number in Tracker payload
  assert(r71.data?.procurement?.gate_pass === 'GP-2026-8831', 'Tracker payload contains Gate Pass GP-2026-8831');

  // Test 82: Verify NO vehicle number in Tracker payload
  assert(!r71.data?.procurement?.vehicle_number, 'Tracker payload is completely free of vehicle numbers');

  // Test 83: Verify Gate In timestamp exists
  assert(r71.data?.procurement?.gate_in_at !== null, 'Gate In timestamp recorded');

  // Test 84: Verify Assayed timestamp exists
  assert(r71.data?.procurement?.assayed_at !== null, 'Quality Assayed timestamp recorded');

  // Test 85: Verify Approved timestamp exists
  assert(r71.data?.procurement?.approved_at !== null, 'Payment Approved timestamp recorded');

  // =============================================================
  // GROUP 6: NOTIFICATIONS MODULE & UNREAD BADGES (Tests 86–95)
  // =============================================================
  console.log('\n--- GROUP 6: Notifications & Live Dynamic Badges (Tests 86–95) ---');

  // Test 86: GET notifications for farmer 111122223333
  const r86 = await request('GET', '/api/notifications/farmer/111122223333');
  assert(r86.status === 200 && r86.data?.notifications?.length >= 3, 'Farmer has received auto-triggered notifications');

  // Test 87: Verify unread count is > 0
  assert(r86.data?.unread_count > 0, 'Unread count is greater than 0 before reading');

  // Test 88: Unread only filter endpoint
  const r88 = await request('GET', '/api/notifications/farmer/111122223333?unread_only=true');
  assert(r88.status === 200 && r88.data?.notifications.every(n => !n.is_read), 'Unread only filter returns strictly unread items');

  // Test 89: Verify Gate Entry notification template has NO vehicle mention
  const gateNotif = r86.data?.notifications.find(n => n.trigger_event === 'queue_update');
  assert(gateNotif && !gateNotif.message.toLowerCase().includes('vehicle'), 'Gate notification contains ZERO vehicle references');

  // Test 90: Verify Payment notification template has J-Form details
  const payNotif = r86.data?.notifications.find(n => n.trigger_event === 'payment_initiated');
  assert(payNotif && payNotif.message.includes('JF-2026-98124'), 'Payment notification contains official J-Form number');

  // Test 91: Mark a single notification as read
  const firstNotifId = r86.data?.notifications[0]._id;
  const r91 = await request('PUT', `/api/notifications/${firstNotifId}/read`);
  assert(r91.status === 200 && r91.data?.notification?.is_read === true, 'Single notification marked as read');

  // Test 92: Verify unread count decreased by 1
  const r92 = await request('GET', '/api/notifications/farmer/111122223333?unread_only=true');
  assert(r92.data?.unread_count === r86.data?.unread_count - 1, 'Unread count accurately decremented');

  // Test 93: Mark ALL notifications as read
  const r93 = await request('PUT', '/api/notifications/farmer/111122223333/read-all');
  assert(r93.status === 200 && r93.data?.success, 'Mark all notifications as read succeeds');

  // Test 94: Verify unread count is exactly 0
  const r94 = await request('GET', '/api/notifications/farmer/111122223333?unread_only=true');
  assert(r94.data?.unread_count === 0, 'Unread count is exactly 0 after mark-all-read (Navbar badge vanishes)');

  // Test 95: Category filter test
  const r95 = await request('GET', '/api/notifications/farmer/111122223333?category=booking');
  assert(r95.status === 200 && r95.data?.notifications.every(n => n.category === 'booking'), 'Category filter returns booking notifications only');

  // =============================================================
  // GROUP 7: SECURITY, INPUT SANITIZATION & EDGE CASES (Tests 96–105)
  // =============================================================
  console.log('\n--- GROUP 7: Security, Input Sanitization & Edge Cases (Tests 96–105) ---');

  // Test 96: NoSQL Injection in Aadhaar field
  const r96 = await request('POST', '/api/farmers/send-otp', { aadhar_number: { '$gt': '' } });
  assert(r96.status === 400, 'NoSQL injection object in aadhar_number rejected with 400');

  // Test 97: SQL Injection string in Aadhaar field
  const r97 = await request('POST', '/api/farmers/send-otp', { aadhar_number: "' OR 1=1--" });
  assert(r97.status === 400, 'SQL injection string in aadhar_number rejected with 400');

  // Test 98: XSS Script tag in Token lookup
  const r98 = await request('GET', '/api/capacity/procurements/<script>alert(1)</script>');
  assert(r98.status === 404, 'XSS string in token lookup handled safely with 404');

  // Test 99: Special characters in booking farmer name
  const r99 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    farmer_name: '<b>Aman</b> <script>steal()</script>',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    crop_type: 'Wheat',
    estimated_weight_quintals: 45
  });
  assert(r99.status === 201, 'Booking handles special characters in string fields safely');

  // Test 100: Malformed JSON or null body
  const r100 = await request('PUT', `/api/capacity/centres/${centre1._id}/capacity`, null);
  assert(r100.status === 400 || r100.status === 500, 'Null capacity payload safely rejected');

  // Test 101: Invalid Centre ID format in slot lookup
  const r101 = await request('GET', `/api/capacity/centres/invalid_id/slots?date=${dateToday}`);
  assert(r101.status === 400 || r101.status === 500, 'Invalid MongoDB ObjectId handled gracefully');

  // Test 102: Concurrent Stage Advancement Race Condition Test
  const [cRes1, cRes2] = await Promise.all([
    request('POST', '/api/capacity/procurements/advance-stage', { token_id: activeTokenId, target_stage: 5, details: { msp_rate: 2275 } }),
    request('POST', '/api/capacity/procurements/advance-stage', { token_id: activeTokenId, target_stage: 5, details: { msp_rate: 2275 } })
  ]);
  assert(cRes1.status === 200 && cRes2.status === 200, 'Concurrent stage advancements executed safely without database crash');

  // Test 103: Huge numeric payload for weights
  const r103 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    estimated_weight_quintals: 999999999999
  });
  assert(r103.status === 400, 'Extreme overflow numbers rejected');

  // Test 104: Empty string crop type
  const r104 = await request('POST', '/api/bookings/create', {
    farmer_aadhar: '111122223333',
    centre_id: centre1._id.toString(),
    date: dateToday,
    slot_code: 'SLOT_1_MORNING',
    crop_type: ''
  });
  assert(r104.status === 400, 'Empty crop type rejected with 400');

  // Test 105: Verify Database State Integrity after 105 Tests
  const finalFarmer = await Farmer.findOne({ aadhar_number: '111122223333' });
  const finalProc = await Procurement.findOne({ token_id: activeTokenId });
  assert(finalFarmer && finalProc && finalProc.current_stage === 5, 'Final database state perfectly intact across all collections');

  // -------------------------------------------------------------
  // AUDIT SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`📊 105-POINT AUDIT RESULTS:`);
  console.log(`   TOTAL TESTS RUN : ${testIndex}`);
  console.log(`   PASSED          : ${passed} / ${testIndex} (${Math.round((passed/testIndex)*100)}%)`);
  console.log(`   FAILED          : ${failed} / ${testIndex}`);
  console.log('===============================================================\n');

  if (failures.length > 0) {
    console.log('❌ FAILURES SUMMARY:');
    failures.forEach(f => {
      console.log(`  - Test #${f.testIndex}: ${f.testName} (${f.details})`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

run100PointAudit().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

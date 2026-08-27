const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Booking = require('./Booking');
const Farmer = require('../registration/Farmer');
const Centre = require('../capacity/Centre');
const Slot = require('../capacity/Slot');
const Procurement = require('../capacity/Procurement');

// Helper to generate official Token ID (e.g. AS-2026-WHT-7821)
function generateTokenId(cropType, year = 2026) {
  let cropCode = 'GRN';
  const cropLower = (cropType || '').toLowerCase();
  if (cropLower.includes('wheat')) cropCode = 'WHT';
  else if (cropLower.includes('paddy') || cropLower.includes('rice')) cropCode = 'PAD';
  else if (cropLower.includes('mustard')) cropCode = 'MUS';
  else if (cropLower.includes('maize')) cropCode = 'MAZ';
  else if (cropLower.includes('barley')) cropCode = 'BAR';
  else if (cropLower.includes('gram') || cropLower.includes('chana')) cropCode = 'CHN';
  else if (cropLower.includes('cotton')) cropCode = 'COT';

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `AS-${year}-${cropCode}-${randomNum}`;
}

// 1. CREATE BOOKING & GENERATE GATE PASS TOKEN
router.post('/create', async (req, res) => {
  try {
    const {
      farmer_aadhar,
      farmer_name,
      farmer_phone,
      centre_id,
      date,
      slot_code,
      crop_type,
      estimated_weight_quintals
    } = req.body;

    // Basic Input Validations
    if (!farmer_aadhar) {
      return res.status(400).json({ error: 'Farmer Aadhaar number is required.' });
    }
    if (!centre_id) {
      return res.status(400).json({ error: 'Procurement Centre selection is required.' });
    }
    if (!slot_code) {
      return res.status(400).json({ error: 'Shift selection (Morning/Afternoon/Evening) is required.' });
    }
    const weight = Number(estimated_weight_quintals);
    if (!weight || weight <= 0) {
      return res.status(400).json({ error: 'Please enter a valid grain weight in Quintals (greater than 0).' });
    }

    const bookingDate = date || new Date().toISOString().split('T')[0];

    // 1. Verify Farmer in Module 1 Registry
    let farmer = await Farmer.findOne({ aadhar_number: farmer_aadhar.trim() });
    let resolvedFarmerName = farmer ? farmer.name : (farmer_name || 'Registered Farmer');
    let resolvedFarmerPhone = farmer ? farmer.phone : (farmer_phone || '+91 98765 43210');

    // 2. Verify Centre in Module 4 Mandi Registry
    const centre = await Centre.findById(centre_id);
    if (!centre) {
      return res.status(404).json({ error: 'Selected procurement centre not found.' });
    }
    if (centre.status === 'maintenance') {
      return res.status(400).json({ error: `${centre.name} is currently closed for maintenance. Please select an alternate Mandi.` });
    }

    // 3. Find or Auto-Initialize Shift Slots for the given date
    let slot = await Slot.findOne({ centre_id: centre._id, date: bookingDate, slot_code });
    if (!slot) {
      const slotCap = Math.round(centre.daily_capacity_quintals / 3);
      const defaultSlots = [
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date: bookingDate,
          slot_code: 'SLOT_1_MORNING',
          slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date: bookingDate,
          slot_code: 'SLOT_2_AFTERNOON',
          slot_name: 'Slot 2: Afternoon (12:00 PM - 03:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date: bookingDate,
          slot_code: 'SLOT_3_EVENING',
          slot_name: 'Slot 3: Evening (03:00 PM - 06:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        }
      ];

      await Slot.insertMany(defaultSlots);
      slot = await Slot.findOne({ centre_id: centre._id, date: bookingDate, slot_code });
    }

    // 4. Capacity & Quota Guard Checks
    const remainingSlotCapacity = Math.max(0, slot.max_capacity_quintals - (slot.booked_capacity_quintals || 0));
    if (weight > remainingSlotCapacity) {
      return res.status(400).json({
        error: `Capacity Exceeded: Requested ${weight} Q exceeds the remaining capacity of ${remainingSlotCapacity} Q for ${slot.slot_name}.`
      });
    }

    const remainingCentreCapacity = Math.max(0, centre.daily_capacity_quintals - (centre.booked_capacity_quintals || 0));
    if (weight > remainingCentreCapacity) {
      return res.status(400).json({
        error: `Daily Mandi Limit Reached: ${centre.name} has only ${remainingCentreCapacity} Q available today.`
      });
    }

    // 5. Atomic Capacity Increment (Race Condition Protection)
    const updatedSlot = await Slot.findOneAndUpdate(
      {
        _id: slot._id,
        booked_capacity_quintals: { $lte: slot.max_capacity_quintals - weight }
      },
      {
        $inc: { booked_capacity_quintals: weight }
      },
      { new: true }
    );

    if (!updatedSlot) {
      return res.status(409).json({
        error: 'Slot capacity was just filled by another concurrent booking. Please try another shift or date.'
      });
    }

    // Update status in slot if nearing capacity
    const newUtilization = (updatedSlot.booked_capacity_quintals / updatedSlot.max_capacity_quintals) * 100;
    let slotStatus = 'available';
    if (newUtilization >= 100) slotStatus = 'full';
    else if (newUtilization >= 75) slotStatus = 'filling_fast';
    await Slot.findByIdAndUpdate(updatedSlot._id, { status: slotStatus });

    // Atomically increment Mandi overall capacity
    await Centre.findByIdAndUpdate(centre._id, {
      $inc: { booked_capacity_quintals: weight }
    });

    // 6. Generate Unique Token ID
    let tokenId = generateTokenId(crop_type);
    let existingToken = await Booking.findOne({ token_id: tokenId });
    while (existingToken) {
      tokenId = generateTokenId(crop_type);
      existingToken = await Booking.findOne({ token_id: tokenId });
    }

    // 7. Generate Security QR Code Data
    const qrPayload = {
      app: 'AnnaSetu National Grain Procurement',
      token_id: tokenId,
      farmer_aadhar: farmer_aadhar.trim(),
      farmer_name: resolvedFarmerName,
      farmer_phone: resolvedFarmerPhone,
      centre: centre.name,
      shift: slot.slot_name,
      date: bookingDate,
      crop: crop_type || 'Wheat (Sharbati A-Grade)',
      weight_quintals: weight,
      verified_at: new Date().toISOString()
    };

    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#064e3b',
        light: '#ffffff'
      }
    });

    // 8. Save Booking Document
    const booking = new Booking({
      token_id: tokenId,
      farmer_aadhar: farmer_aadhar.trim(),
      farmer_name: resolvedFarmerName,
      farmer_phone: resolvedFarmerPhone,
      centre_id: centre._id,
      centre_name: centre.name,
      slot_code: slot.slot_code,
      slot_name: slot.slot_name,
      booking_date: bookingDate,
      crop_type: crop_type || 'Wheat (Sharbati A-Grade)',
      estimated_weight_quintals: weight,
      status: 'confirmed',
      qr_code_data: qrDataUrl,
      created_at: new Date()
    });

    await booking.save();

    // 9. Downstream Integration: Initialize Stage 1 in Module 4/5 Procurement Tracker
    await Procurement.findOneAndUpdate(
      { token_id: tokenId },
      {
        token_id: tokenId,
        farmer_name: resolvedFarmerName,
        farmer_phone: resolvedFarmerPhone,
        crop_type: crop_type || 'Wheat (Sharbati A-Grade)',
        centre_name: centre.name,
        current_stage: 1,
        slot_name: slot.slot_name,
        slot_date: bookingDate,
        updated_at: new Date()
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'Gate Pass and Token generated successfully!',
      booking,
      slot: updatedSlot
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: err.message || 'Failed to complete slot booking.' });
  }
});

// 2. GET BOOKINGS FOR A SPECIFIC FARMER (BY AADHAAR)
router.get('/farmer/:aadhar', async (req, res) => {
  try {
    const { aadhar } = req.params;
    if (!aadhar) {
      return res.status(400).json({ error: 'Farmer Aadhaar is required.' });
    }

    const bookings = await Booking.find({ farmer_aadhar: aadhar.trim() }).sort({ created_at: -1 });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error('Error fetching farmer bookings:', err);
    res.status(500).json({ error: 'Failed to fetch farmer bookings.' });
  }
});

// 3. GET SINGLE GATE PASS BY TOKEN ID
router.get('/token/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const booking = await Booking.findOne({ token_id: tokenId });

    if (!booking) {
      return res.status(404).json({ error: `Gate pass for Token ID ${tokenId} not found.` });
    }

    // Also fetch procurement progress if available
    const procurement = await Procurement.findOne({ token_id: tokenId });

    res.json({ success: true, booking, procurement });
  } catch (err) {
    console.error('Error fetching gate pass:', err);
    res.status(500).json({ error: 'Failed to fetch gate pass details.' });
  }
});

// 4. GET ALL BOOKINGS (FOR LOGISTICS AUDIT / OVERVIEW)
router.get('/all', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ created_at: -1 }).limit(100);
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error('Error fetching all bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

module.exports = router;

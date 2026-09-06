const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Booking = require('./Booking');
const Farmer = require('../registration/Farmer');
const Centre = require('../capacity/Centre');
const Slot = require('../capacity/Slot');
const Procurement = require('../capacity/Procurement');
const { sendNotification } = require('../notifications/notificationService');

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

    const bookingDate = date || req.body.booking_date || new Date().toISOString().split('T')[0];

    // Server-side Rolling 7-day Booking Window Enforcement
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(todayDate);
    maxDate.setDate(maxDate.getDate() + 7);
    const requestedDate = new Date(bookingDate);
    requestedDate.setHours(0, 0, 0, 0);

    if (requestedDate < todayDate || requestedDate > maxDate) {
      return res.status(400).json({
        error: 'Safety Guard: Bookings are restricted to a rolling 7-day window from today.'
      });
    }

    // 1. Verify Farmer in Module 1 Registry (Strict Mode)
    let farmer = await Farmer.findOne({ aadhar_number: farmer_aadhar.trim() });
    if (!farmer) {
      return res.status(404).json({
        error: 'Farmer Aadhaar is not registered in AnnaSetu database. Please complete registration first.'
      });
    }
    let resolvedFarmerName = farmer.name;
    let resolvedFarmerPhone = farmer.phone;

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
      { returnDocument: 'after' }
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
        farmer_aadhar: farmer_aadhar.trim(),
        farmer_name: resolvedFarmerName,
        farmer_phone: resolvedFarmerPhone,
        crop_type: crop_type || 'Wheat (Sharbati A-Grade)',
        centre_name: centre.name,
        current_stage: 1,
        slot_name: slot.slot_name,
        slot_date: bookingDate,
        estimated_weight_quintals: weight,
        updated_at: new Date()
      },
      { upsert: true, new: true }
    );

    // 10. Trigger Real-time In-App Notification
    try {
      await sendNotification({
        farmer_id: farmer_aadhar.trim(),
        recipient_name: resolvedFarmerName,
        recipient_phone: resolvedFarmerPhone,
        trigger_event: 'booking_confirmed',
        metadata: {
          date: bookingDate,
          centre_name: centre.name,
          token_no: tokenId
        }
      });
    } catch (notifErr) {
      console.warn('Silent notification trigger error:', notifErr.message);
    }

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

    const bookings = await Booking.find({ farmer_aadhar: aadhar.trim() }).sort({ created_at: -1 }).lean();
    const tokenIds = bookings.map(b => b.token_id);
    const procurements = await Procurement.find({ token_id: { $in: tokenIds } }).lean();
    const procMap = new Map(procurements.map(p => [p.token_id, p]));

    const enrichedBookings = bookings.map(b => {
      const proc = procMap.get(b.token_id);
      const current_stage = proc ? proc.current_stage : (b.status === 'completed' ? 5 : (b.status === 'cancelled' ? 0 : 1));
      return {
        ...b,
        current_stage,
        procurement_status: proc?.status || b.status,
        gate_pass: proc?.gate_pass || '',
        gate_in_at: proc?.gate_in_at || null,
        moisture_percent: proc?.moisture_percent || null,
        purity_percent: proc?.purity_percent || null,
        net_weight_quintals: proc?.net_weight_quintals || b.estimated_weight_quintals,
        gross_payout: proc?.gross_payout || 0,
        j_form_number: proc?.j_form_number || '',
        rejection_stage: proc?.rejection_stage || null,
        rejection_reason: proc?.rejection_reason || null
      };
    });

    res.json({ success: true, count: enrichedBookings.length, bookings: enrichedBookings });
  } catch (err) {
    console.error('Error fetching farmer bookings:', err);
    res.status(500).json({ error: 'Failed to fetch farmer bookings.' });
  }
});

// 3. GET SINGLE GATE PASS BY TOKEN ID
router.get('/token/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const booking = await Booking.findOne({ token_id: tokenId }).lean();

    if (!booking) {
      return res.status(404).json({ error: `Gate pass for Token ID ${tokenId} not found.` });
    }

    // Also fetch procurement progress if available
    const procurement = await Procurement.findOne({ token_id: tokenId }).lean();

    const current_stage = procurement ? procurement.current_stage : (booking.status === 'completed' ? 5 : (booking.status === 'cancelled' ? 0 : 1));
    const enrichedBooking = {
      ...booking,
      current_stage,
      procurement_status: procurement?.status || booking.status,
      gate_pass: procurement?.gate_pass || '',
      gate_in_at: procurement?.gate_in_at || null,
      moisture_percent: procurement?.moisture_percent || null,
      purity_percent: procurement?.purity_percent || null,
      net_weight_quintals: procurement?.net_weight_quintals || booking.estimated_weight_quintals,
      gross_payout: procurement?.gross_payout || 0,
      j_form_number: procurement?.j_form_number || '',
      rejection_stage: procurement?.rejection_stage || null,
      rejection_reason: procurement?.rejection_reason || null
    };

    res.json({ success: true, booking: enrichedBooking, procurement });
  } catch (err) {
    console.error('Error fetching gate pass:', err);
    res.status(500).json({ error: 'Failed to fetch gate pass details.' });
  }
});

// 5. CANCEL TOKEN / GATE PASS (ONLY BEFORE GATE ARRIVAL - STAGE 1)
router.post('/cancel', async (req, res) => {
  try {
    const token_id = req.body.token_id || req.body.tokenId;
    const farmer_aadhar = req.body.farmer_aadhar || req.body.farmerAadhar;
    const reason = req.body.reason || req.body.customRemark;

    if (!token_id) {
      return res.status(400).json({ error: 'Token ID is required.' });
    }

    const booking = await Booking.findOne({ token_id });
    if (!booking) {
      return res.status(404).json({ error: `Gate pass token ${token_id} not found.` });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'This token has already been cancelled.' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ error: 'Completed consignments cannot be cancelled.' });
    }

    // Safety Guard: Check Procurement Stage
    const procurement = await Procurement.findOne({ token_id });
    if (procurement && procurement.current_stage > 1) {
      return res.status(400).json({
        error: `Cannot cancel token: Consignment is already at Stage ${procurement.current_stage} (Gate-In / Processing). Cancellation is only permitted prior to gate arrival.`
      });
    }

    const weight = Number(booking.estimated_weight_quintals) || Number(procurement?.estimated_weight_quintals) || 0;

    // 1. Release Slot Capacity
    const slot = await Slot.findOne({
      centre_id: booking.centre_id,
      date: booking.booking_date,
      slot_code: booking.slot_code
    });
    if (slot) {
      const newBooked = Math.max(0, (slot.booked_capacity_quintals || 0) - weight);
      const newUtil = (newBooked / slot.max_capacity_quintals) * 100;
      let slotStatus = 'available';
      if (newUtil >= 100) slotStatus = 'full';
      else if (newUtil >= 75) slotStatus = 'filling_fast';

      await Slot.findByIdAndUpdate(slot._id, {
        booked_capacity_quintals: newBooked,
        status: slotStatus
      });
    }

    // 2. Release Centre Capacity
    if (booking.centre_id) {
      const centre = await Centre.findById(booking.centre_id);
      if (centre) {
        const newCentreBooked = Math.max(0, (centre.booked_capacity_quintals || 0) - weight);
        await Centre.findByIdAndUpdate(centre._id, {
          booked_capacity_quintals: newCentreBooked
        });
      }
    }

    // 3. Update Booking Record
    const cancellationReason = reason || 'Cancelled by farmer before gate arrival';
    booking.status = 'cancelled';
    booking.cancelled_at = new Date();
    booking.cancellation_reason = cancellationReason;
    await booking.save();

    // 4. Update Procurement Record
    if (procurement) {
      procurement.status = 'cancelled';
      procurement.cancelled_at = new Date();
      procurement.cancellation_reason = cancellationReason;
      procurement.updated_at = new Date();
      await procurement.save();
    }

    // 5. Send Real-Time Notification
    try {
      await sendNotification({
        farmer_id: booking.farmer_aadhar,
        recipient_name: booking.farmer_name,
        recipient_phone: booking.farmer_phone,
        trigger_event: 'booking_cancelled',
        metadata: {
          token_id: booking.token_id,
          token_no: booking.token_id,
          date: booking.booking_date,
          centre_name: booking.centre_name,
          reason: cancellationReason
        }
      });
    } catch (notifErr) {
      console.warn('Silent cancellation notification error:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Token #${token_id} has been cancelled and ${weight} Q capacity has been restored.`,
      booking,
      procurement
    });
  } catch (err) {
    console.error('Error cancelling token:', err);
    res.status(500).json({ error: err.message || 'Failed to cancel token.' });
  }
});

// 6. RESCHEDULE TOKEN / GATE PASS (ONLY BEFORE GATE ARRIVAL - STAGE 1)
router.post('/reschedule', async (req, res) => {
  try {
    const token_id = req.body.token_id || req.body.tokenId;
    const farmer_aadhar = req.body.farmer_aadhar || req.body.farmerAadhar;
    const new_date = req.body.new_date || req.body.newDate;
    const new_slot_code = req.body.new_slot_code || req.body.newSlotCode;
    const new_slot_name = req.body.new_slot_name || req.body.newSlotName;

    if (!token_id) {
      return res.status(400).json({ error: 'Token ID is required.' });
    }
    if (!new_date || !new_slot_code) {
      return res.status(400).json({ error: 'New date and shift selection are required.' });
    }

    const booking = await Booking.findOne({ token_id });
    if (!booking) {
      return res.status(404).json({ error: `Gate pass token ${token_id} not found.` });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled tokens cannot be rescheduled. Please book a new slot.' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ error: 'Completed consignments cannot be rescheduled.' });
    }

    // Safety Guard: Check Procurement Stage
    const procurement = await Procurement.findOne({ token_id });
    if (procurement && procurement.current_stage > 1) {
      return res.status(400).json({
        error: `Cannot reschedule token: Consignment is already at Stage ${procurement.current_stage} (Gate-In / Processing). Rescheduling is only permitted prior to gate arrival.`
      });
    }

    // Check Rolling 7-day booking window
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(todayDate);
    maxDate.setDate(maxDate.getDate() + 7);
    const reqDate = new Date(new_date);
    reqDate.setHours(0, 0, 0, 0);

    if (reqDate < todayDate || reqDate > maxDate) {
      return res.status(400).json({
        error: 'Safety Guard: Rescheduling is restricted to a rolling 7-day window from today.'
      });
    }

    // Prevent identical reschedule
    if (booking.booking_date === new_date && booking.slot_code === new_slot_code) {
      return res.status(400).json({ error: 'Please choose a different date or shift to reschedule.' });
    }

    const weight = Number(booking.estimated_weight_quintals) || 0;

    // 1. Find or Auto-Initialize Target Slot
    let targetSlot = await Slot.findOne({
      centre_id: booking.centre_id,
      date: new_date,
      slot_code: new_slot_code
    });

    if (!targetSlot) {
      const centre = await Centre.findById(booking.centre_id);
      const slotCap = Math.round((centre?.daily_capacity_quintals || 1200) / 3);
      const defaultSlots = [
        {
          centre_id: booking.centre_id,
          centre_name: booking.centre_name,
          date: new_date,
          slot_code: 'SLOT_1_MORNING',
          slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: booking.centre_id,
          centre_name: booking.centre_name,
          date: new_date,
          slot_code: 'SLOT_2_AFTERNOON',
          slot_name: 'Slot 2: Afternoon (12:00 PM - 03:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: booking.centre_id,
          centre_name: booking.centre_name,
          date: new_date,
          slot_code: 'SLOT_3_EVENING',
          slot_name: 'Slot 3: Evening (03:00 PM - 06:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        }
      ];

      await Slot.insertMany(defaultSlots);
      targetSlot = await Slot.findOne({
        centre_id: booking.centre_id,
        date: new_date,
        slot_code: new_slot_code
      });
    }

    // 2. Capacity Guard Check on Target Slot
    const remainingTargetCap = Math.max(0, targetSlot.max_capacity_quintals - (targetSlot.booked_capacity_quintals || 0));
    if (weight > remainingTargetCap) {
      return res.status(400).json({
        error: `Insufficient Capacity: Target shift has only ${remainingTargetCap} Q available, but your booking requires ${weight} Q.`
      });
    }

    // 3. Release Capacity from Old Slot
    const oldSlot = await Slot.findOne({
      centre_id: booking.centre_id,
      date: booking.booking_date,
      slot_code: booking.slot_code
    });
    if (oldSlot) {
      const newOldBooked = Math.max(0, (oldSlot.booked_capacity_quintals || 0) - weight);
      const oldUtil = (newOldBooked / oldSlot.max_capacity_quintals) * 100;
      let oldStatus = 'available';
      if (oldUtil >= 100) oldStatus = 'full';
      else if (oldUtil >= 75) oldStatus = 'filling_fast';

      await Slot.findByIdAndUpdate(oldSlot._id, {
        booked_capacity_quintals: newOldBooked,
        status: oldStatus
      });
    }

    // 4. Atomically Allocate Capacity into Target Slot (Race Condition Protection)
    const updatedTargetSlot = await Slot.findOneAndUpdate(
      {
        _id: targetSlot._id,
        booked_capacity_quintals: { $lte: targetSlot.max_capacity_quintals - weight }
      },
      {
        $inc: { booked_capacity_quintals: weight }
      },
      { returnDocument: 'after' }
    );

    if (!updatedTargetSlot) {
      // Rollback: Re-credit old slot if target was filled concurrently
      if (oldSlot) {
        await Slot.findByIdAndUpdate(oldSlot._id, { $inc: { booked_capacity_quintals: weight } });
      }
      return res.status(409).json({
        error: 'Target shift capacity was just filled by another concurrent booking. Please select another shift or date.'
      });
    }

    const newTargetUtil = (updatedTargetSlot.booked_capacity_quintals / updatedTargetSlot.max_capacity_quintals) * 100;
    let targetStatus = 'available';
    if (newTargetUtil >= 100) targetStatus = 'full';
    else if (newTargetUtil >= 75) targetStatus = 'filling_fast';

    await Slot.findByIdAndUpdate(updatedTargetSlot._id, {
      status: targetStatus
    });

    const resolvedSlotName = new_slot_name || targetSlot.slot_name;

    // 5. Generate Updated Security QR Code
    const qrPayload = {
      app: 'AnnaSetu National Grain Procurement',
      token_id: booking.token_id,
      farmer_aadhar: booking.farmer_aadhar,
      farmer_name: booking.farmer_name,
      farmer_phone: booking.farmer_phone,
      centre: booking.centre_name,
      shift: resolvedSlotName,
      date: new_date,
      crop: booking.crop_type,
      weight_quintals: weight,
      rescheduled_at: new Date().toISOString()
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

    // 6. Update Booking Record
    booking.booking_date = new_date;
    booking.slot_code = new_slot_code;
    booking.slot_name = resolvedSlotName;
    booking.qr_code_data = qrDataUrl;
    booking.rescheduled_at = new Date();
    booking.reschedule_count = (booking.reschedule_count || 0) + 1;
    await booking.save();

    // 7. Update Procurement Record
    if (procurement) {
      procurement.slot_date = new_date;
      procurement.slot_name = resolvedSlotName;
      procurement.rescheduled_at = new Date();
      procurement.reschedule_count = (procurement.reschedule_count || 0) + 1;
      procurement.updated_at = new Date();
      await procurement.save();
    }

    // 8. Send Real-Time Notification
    try {
      await sendNotification({
        farmer_id: booking.farmer_aadhar,
        recipient_name: booking.farmer_name,
        recipient_phone: booking.farmer_phone,
        trigger_event: 'booking_rescheduled',
        metadata: {
          token_id: booking.token_id,
          token_no: booking.token_id,
          new_date: new_date,
          date: new_date,
          new_shift: resolvedSlotName,
          shift: resolvedSlotName,
          centre_name: booking.centre_name
        }
      });
    } catch (notifErr) {
      console.warn('Silent reschedule notification error:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Token #${token_id} rescheduled to ${new_date} (${resolvedSlotName}) successfully!`,
      booking,
      procurement
    });
  } catch (err) {
    console.error('Error rescheduling token:', err);
    res.status(500).json({ error: err.message || 'Failed to reschedule token.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Centre = require('./Centre');
const Slot = require('./Slot');
const Procurement = require('./Procurement');
const { sendNotification } = require('../notifications/notificationService');

// 1. GET ALL CENTRES
router.get('/centres', async (req, res) => {
  try {
    const centres = await Centre.find().sort({ state: 1 });
    
    const enrichedCentres = centres.map(centre => {
      const max = centre.daily_capacity_quintals || 1000;
      const booked = centre.booked_capacity_quintals || 0;
      const available = Math.max(0, max - booked);
      const utilization = Math.min(100, Math.round((booked / max) * 100));

      let health = 'green';
      if (utilization >= 85) {
        health = 'red';
      } else if (utilization >= 60) {
        health = 'yellow';
      }

      return {
        ...centre.toObject(),
        available_capacity_quintals: available,
        utilization_percentage: utilization,
        health_status: health
      };
    });

    res.json({ success: true, centres: enrichedCentres });
  } catch (err) {
    console.error('Error fetching centres:', err);
    res.status(500).json({ error: 'Failed to fetch procurement centres' });
  }
});

// 2. GET SLOTS FOR A CENTRE
router.get('/centres/:id/slots', async (req, res) => {
  try {
    const { id } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    let slots = await Slot.find({ centre_id: id, date }).sort({ slot_code: 1 });
    if (!slots || slots.length === 0) {
      const centre = await Centre.findById(id);
      if (!centre) return res.status(404).json({ error: 'Centre not found' });

      const slotCap = Math.round(centre.daily_capacity_quintals / 3);
      const defaultSlots = [
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date,
          slot_code: 'SLOT_1_MORNING',
          slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date,
          slot_code: 'SLOT_2_AFTERNOON',
          slot_name: 'Slot 2: Afternoon (12:00 PM - 03:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date,
          slot_code: 'SLOT_3_EVENING',
          slot_name: 'Slot 3: Evening (03:00 PM - 06:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        }
      ];

      slots = await Slot.insertMany(defaultSlots);
    }

    res.json({ success: true, date, slots });
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// 3. UPDATE SHIFT SLOTS QUOTAS (WITH EXACT SUM & FLOOR VALIDATION)
router.put('/centres/:id/slots', async (req, res) => {
  try {
    const { id } = req.params;
    const { slots, date } = req.body;
    const slotDate = date || new Date().toISOString().split('T')[0];

    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'Invalid slots data provided.' });
    }

    const centre = await Centre.findById(id);
    if (!centre) return res.status(404).json({ error: 'Centre not found' });

    // Validate that sum of shift capacities equals centre's daily capacity
    const totalAssigned = slots.reduce((acc, s) => acc + Number(s.max_capacity_quintals || 0), 0);
    const requiredDaily = centre.daily_capacity_quintals;

    if (totalAssigned !== requiredDaily) {
      return res.status(400).json({
        error: `Mathematical Mismatch: Total shift quotas (${totalAssigned} Q) must exactly equal Mandi daily capacity (${requiredDaily} Q).`
      });
    }

    // Existing slots in DB to check floor
    const existingSlots = await Slot.find({ centre_id: id, date: slotDate });

    // Update each slot
    for (const slotUpdate of slots) {
      const existing = existingSlots.find(s => s.slot_code === slotUpdate.slot_code);
      const bookedFloor = existing ? existing.booked_capacity_quintals : 0;
      const newCap = Number(slotUpdate.max_capacity_quintals);

      if (newCap < bookedFloor) {
        return res.status(400).json({
          error: `Safety Block: Cannot set ${slotUpdate.slot_name || slotUpdate.slot_code} lower than currently booked grain (${bookedFloor} Q).`
        });
      }

      await Slot.findOneAndUpdate(
        { centre_id: id, date: slotDate, slot_code: slotUpdate.slot_code },
        { 
          max_capacity_quintals: newCap,
          centre_name: centre.name,
          slot_name: slotUpdate.slot_name || (existing ? existing.slot_name : slotUpdate.slot_code)
        },
        { upsert: true, new: true }
      );
    }

    const updatedSlots = await Slot.find({ centre_id: id, date: slotDate }).sort({ slot_code: 1 });
    res.json({ success: true, message: 'Shift quotas updated successfully!', slots: updatedSlots });
  } catch (err) {
    console.error('Error updating shift slots:', err);
    res.status(500).json({ error: 'Failed to update shift slots.' });
  }
});

// 4. ADMIN: MANUAL CAPACITY MODIFIER WITH SAFETY SHIELD
router.put('/centres/:id/capacity', async (req, res) => {
  try {
    const { id } = req.params;
    const { daily_capacity_quintals } = req.body;
    const newCapacity = Number(daily_capacity_quintals);

    if (!newCapacity || newCapacity <= 0) {
      return res.status(400).json({ error: 'Please provide a valid positive capacity limit.' });
    }

    const centre = await Centre.findById(id);
    if (!centre) return res.status(404).json({ error: 'Centre not found' });

    const ceiling = centre.max_designed_capacity_quintals || 2500;
    const floor = centre.booked_capacity_quintals || 0;

    if (newCapacity > ceiling) {
      return res.status(400).json({ error: `Exceeds physical silo ceiling (${ceiling} Q) for ${centre.name}.` });
    }
    if (newCapacity < floor) {
      return res.status(400).json({ error: `Cannot set limit lower than currently booked grain (${floor} Q).` });
    }

    centre.daily_capacity_quintals = newCapacity;
    await centre.save();

    // Auto-adjust default slots proportionally
    const slotCap = Math.round(newCapacity / 3);
    const today = new Date().toISOString().split('T')[0];
    await Slot.updateMany(
      { centre_id: id, date: today },
      { max_capacity_quintals: slotCap }
    );

    res.json({ success: true, message: `Capacity set to ${newCapacity} Q`, centre });
  } catch (err) {
    console.error('Error updating capacity:', err);
    res.status(500).json({ error: 'Failed to update capacity' });
  }
});

// 5. ADMIN: TOGGLE TRAFFIC DIVERSION ALERT
router.put('/centres/:id/divert', async (req, res) => {
  try {
    const { id } = req.params;
    const { divert_active, alert_message } = req.body;

    const centre = await Centre.findByIdAndUpdate(
      id,
      { 
        status: divert_active ? 'divert_active' : 'active',
        alert_message: divert_active ? (alert_message || 'Heavy intake. Recommended to reroute to alternate Mandis.') : ''
      },
      { new: true }
    );

    if (!centre) return res.status(404).json({ error: 'Centre not found' });

    res.json({ success: true, message: 'Diversion status updated', centre });
  } catch (err) {
    console.error('Error toggling diversion:', err);
    res.status(500).json({ error: 'Failed to update diversion status' });
  }
});

// 6. PROCUREMENT STAGE TRACKING ENDPOINTS
router.get('/procurements', async (req, res) => {
  try {
    let procurements = await Procurement.find().sort({ updated_at: -1 });

    if (!procurements || procurements.length === 0) {
      const demoItem = await Procurement.create({
        token_id: 'AS-2026-WHT-7821',
        farmer_name: 'Aman Kumar',
        farmer_phone: '+91 98765 43210',
        crop_type: 'Wheat (Sharbati A-Grade)',
        centre_name: 'Meerut Central Agro Warehouse',
        current_stage: 1,
        slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)'
      });
      procurements = [demoItem];
    }

    res.json({ success: true, procurements });
  } catch (err) {
    console.error('Error fetching procurements:', err);
    res.status(500).json({ error: 'Failed to fetch procurement stages' });
  }
});

// Fetch single procurement by token
router.get('/procurements/:tokenId', async (req, res) => {
  try {
    const proc = await Procurement.findOne({ token_id: req.params.tokenId });
    if (!proc) return res.status(404).json({ error: 'Token not found' });
    res.json({ success: true, procurement: proc });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/procurements/advance-stage', async (req, res) => {
  try {
    const { token_id, target_stage, details } = req.body;
    let proc = await Procurement.findOne({ token_id });

    if (!proc) {
      proc = new Procurement({ token_id, centre_name: 'Meerut Central Agro Warehouse', ...details });
    }

    proc.current_stage = target_stage;
    proc.updated_at = new Date();

    if (target_stage === 2) {
      proc.vehicle_number = details?.vehicle_number || 'HR-05-AB-4412';
      proc.gate_pass = details?.gate_pass || 'GP-2026-8831';
      proc.gate_in_at = new Date();
    } else if (target_stage === 3) {
      proc.moisture_percent = details?.moisture_percent || 11.6;
      proc.grade = details?.grade || 'Grade A FAQ';
      proc.assayed_at = new Date();
    } else if (target_stage === 4) {
      proc.net_weight_quintals = details?.net_weight_quintals || 45.20;
      proc.gunny_bags = details?.gunny_bags || 90;
      proc.weighed_at = new Date();
    } else if (target_stage === 5) {
      proc.msp_rate = details?.msp_rate || 2275;
      const weight = proc.net_weight_quintals || 45.20;
      proc.gross_payout = Math.round(weight * proc.msp_rate);
      proc.j_form_number = details?.j_form_number || 'JF-2026-98124';
      proc.approved_at = new Date();
    }

    await proc.save();

    // Trigger in-app notification based on advanced stage
    try {
      if (target_stage === 2) {
        await sendNotification({
          farmer_id: '111122223333',
          recipient_name: proc.farmer_name || 'Farmer',
          recipient_phone: proc.farmer_phone || '',
          trigger_event: 'queue_update',
          metadata: {
            vehicle_no: proc.vehicle_number || 'HR-05-AB-4412',
            gate_pass: proc.gate_pass || 'GP-2026-8831'
          }
        });
      } else if (target_stage === 5) {
        await sendNotification({
          farmer_id: '111122223333',
          recipient_name: proc.farmer_name || 'Farmer',
          recipient_phone: proc.farmer_phone || '',
          trigger_event: 'payment_initiated',
          metadata: {
            amount: (proc.gross_payout || 102830).toLocaleString('en-IN'),
            quantity: `${proc.net_weight_quintals || 45.2} Quintals`,
            j_form_no: proc.j_form_number || 'JF-2026-98124'
          }
        });
      }
    } catch (notifErr) {
      console.warn('Stage advancement notification error:', notifErr.message);
    }

    res.json({ success: true, message: `Advanced to Stage ${target_stage} successfully!`, procurement: proc });
  } catch (err) {
    console.error('Error advancing procurement stage:', err);
    res.status(500).json({ error: 'Failed to advance stage' });
  }
});

router.post('/procurements/reset-demo-token', async (req, res) => {
  try {
    await Procurement.deleteMany({});
    const demoItem = await Procurement.create({
      token_id: 'AS-2026-WHT-7821',
      farmer_name: 'Aman Kumar',
      farmer_phone: '+91 98765 43210',
      crop_type: 'Wheat (Sharbati A-Grade)',
      centre_name: 'Meerut Central Agro Warehouse',
      current_stage: 1,
      slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)'
    });
    res.json({ success: true, message: 'Demo token reset to Stage 1!', procurement: demoItem });
  } catch (err) {
    console.error('Error resetting token:', err);
    res.status(500).json({ error: 'Failed to reset demo token' });
  }
});

// 7. SEED ENDPOINT
router.post('/seed', async (req, res) => {
  try {
    await Centre.deleteMany({});
    await Slot.deleteMany({});

    const initialCentres = [
      {
        name: 'Ludhiana Grain Logistics Terminal',
        state: 'Punjab',
        district: 'Ludhiana',
        location: 'Ferozepur Road, Ludhiana, Punjab',
        daily_capacity_quintals: 1500,
        max_designed_capacity_quintals: 2500,
        booked_capacity_quintals: 450,
        manager_name: 'Sarabpreet Singh Khanna',
        manager_phone: '+91 98123 45678',
        status: 'active'
      },
      {
        name: 'Meerut Central Agro Warehouse',
        state: 'Uttar Pradesh',
        district: 'Meerut',
        location: 'Bypass Road, Meerut, Uttar Pradesh',
        daily_capacity_quintals: 1200,
        max_designed_capacity_quintals: 2000,
        booked_capacity_quintals: 900,
        manager_name: 'Vishesh Tiwari',
        manager_phone: '+91 98765 43210',
        status: 'active'
      },
      {
        name: 'Guwahati Brahmaputra Agro Hub',
        state: 'Assam',
        district: 'Kamrup',
        location: 'NH-27 Terminal, Guwahati, Assam',
        daily_capacity_quintals: 900,
        max_designed_capacity_quintals: 1500,
        booked_capacity_quintals: 450,
        manager_name: 'Saishri Bidwai',
        manager_phone: '+91 94350 12345',
        status: 'active'
      }
    ];

    const createdCentres = await Centre.insertMany(initialCentres);
    const today = new Date().toISOString().split('T')[0];
    const allSlots = [];

    for (const centre of createdCentres) {
      const slotCap = Math.round(centre.daily_capacity_quintals / 3);
      allSlots.push(
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date: today,
          slot_code: 'SLOT_1_MORNING',
          slot_name: 'Slot 1: Morning (09:00 AM - 12:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date: today,
          slot_code: 'SLOT_2_AFTERNOON',
          slot_name: 'Slot 2: Afternoon (12:00 PM - 03:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        },
        {
          centre_id: centre._id,
          centre_name: centre.name,
          date: today,
          slot_code: 'SLOT_3_EVENING',
          slot_name: 'Slot 3: Evening (03:00 PM - 06:00 PM)',
          max_capacity_quintals: slotCap,
          booked_capacity_quintals: 0,
          status: 'available'
        }
      );
    }

    await Slot.insertMany(allSlots);

    res.json({
      success: true,
      message: 'Successfully seeded 3 National Mandis with safety ceilings!',
      centres: createdCentres
    });
  } catch (err) {
    console.error('Error seeding data:', err);
    res.status(500).json({ error: 'Failed to seed centres and slots' });
  }
});

module.exports = router;

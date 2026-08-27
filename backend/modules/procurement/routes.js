const express = require('express');
const router = express.Router();
const Procurement = require('./Procurement');

// Seed realistic demo procurement records
router.get('/seed', async (req, res) => {
  try {
    await Procurement.deleteMany({ 
      token_number: { $in: ['AS-2026-LOT-7821', 'AS-2026-PDY-7821', 'AS-2026-MST-4092', 'AS-2026-MAZ-1045', 'AS-2026-WHT-7821'] } 
    });

    const demoLots = [
      {
        token_number: 'AS-2026-LOT-7821',
        farmer_id: 'FARMER_AMAN_01',
        farmer_name: 'Aman Kumar',
        farmer_phone: '9876543210',
        crop_type: 'Produce',
        crop_variety: 'Grade A FAQ',
        centre_name: 'Karnal Main Mandi, Centre #3',
        centre_code: 'KRN-03',
        scheduled_date: new Date().toISOString().split('T')[0],
        time_slot: '10:00 AM - 01:00 PM',
        current_stage: 'QUALITY_CHECKED',
        stage_logs: [
          {
            stage: 'SLOT_BOOKED',
            title: 'Slot Booked & Token Active',
            timestamp: new Date(Date.now() - 4 * 3600 * 1000),
            status: 'completed',
            updated_by: 'AnnaSetu Portal',
            notes: 'Token AS-2026-LOT-7821 issued for 10:00 AM slot'
          },
          {
            stage: 'GATE_IN',
            title: 'Mandi Gate Entry Verified',
            timestamp: new Date(Date.now() - 2 * 3600 * 1000),
            status: 'completed',
            updated_by: 'Security Officer R. Sharma',
            notes: 'Tractor Trolley HR-05-AB-4412 verified and admitted'
          },
          {
            stage: 'QUALITY_CHECKED',
            title: 'Quality Assayed & Graded',
            timestamp: new Date(Date.now() - 30 * 60 * 1000),
            status: 'completed',
            updated_by: 'Lab Assayer Dr. V. Patel',
            notes: 'Moisture 11.6%, Grade A FAQ Quality. Approved for procurement.'
          }
        ],
        gate_details: {
          vehicle_number: 'HR-05-AB-4412',
          driver_name: 'Aman Kumar',
          entry_time: new Date(Date.now() - 2 * 3600 * 1000),
          gate_pass_no: 'GP-2026-8831'
        },
        quality_details: {
          moisture_percent: 11.6,
          foreign_matter_percent: 0.4,
          quality_grade: 'Grade A (FAQ)',
          assaying_officer: 'Dr. V. Patel (Quality Inspector)',
          assayed_at: new Date(Date.now() - 30 * 60 * 1000),
          is_passed: true,
          remarks: 'Moisture content meets FAQ procurement norms (<= 14%). Approved.'
        },
        weighment_details: {
          gross_weight_kg: 0,
          tare_weight_kg: 0,
          net_weight_kg: 0,
          net_weight_quintals: 0,
          gunny_bags_count: 0,
          weighbridge_slip_no: '',
          weighed_at: null
        },
        receipt_details: {
          j_form_no: '',
          msp_rate_per_quintal: 2275,
          gross_payable_inr: 0,
          deductions_inr: 0,
          net_payable_inr: 0,
          payment_status: 'READY_FOR_PAYMENT',
          approved_by: '',
          approved_at: null
        }
      }
    ];

    const inserted = await Procurement.insertMany(demoLots);
    res.json({ message: 'Demo procurement records seeded successfully!', count: inserted.length, records: inserted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active lots for a logged-in farmer
router.get('/farmer/:farmer_id/all', async (req, res) => {
  try {
    const { farmer_id } = req.params;
    const lots = await Procurement.find({
      $or: [
        { farmer_id: farmer_id },
        { farmer_phone: farmer_id }
      ]
    }).sort({ created_at: -1 });

    res.json(lots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active procurement lot for a logged-in farmer
router.get('/active/:farmer_id', async (req, res) => {
  try {
    const { farmer_id } = req.params;
    
    let lot = await Procurement.findOne({
      $or: [
        { farmer_id: farmer_id },
        { farmer_phone: farmer_id }
      ]
    }).sort({ created_at: -1 });

    if (!lot) {
      lot = await Procurement.findOne().sort({ created_at: -1 });
    }

    if (!lot) {
      return res.status(404).json({ error: 'No active procurement consignment found.' });
    }

    res.json(lot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single procurement lot by ID or Token Number
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let lot;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      lot = await Procurement.findById(id);
    } else {
      lot = await Procurement.findOne({ token_number: id });
    }

    if (!lot) {
      return res.status(404).json({ error: 'Procurement lot not found.' });
    }

    res.json(lot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all procurement lots (Admin Overview)
router.get('/list/all', async (req, res) => {
  try {
    const lots = await Procurement.find().sort({ updated_at: -1 });
    res.json(lots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new procurement lot
router.post('/create', async (req, res) => {
  try {
    const token_number = req.body.token_number || `AS-2026-LOT-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newLot = new Procurement({
      ...req.body,
      crop_type: 'Produce',
      token_number,
      current_stage: 'SLOT_BOOKED',
      stage_logs: [
        {
          stage: 'SLOT_BOOKED',
          title: 'Slot Booked & Token Active',
          timestamp: new Date(),
          status: 'completed',
          updated_by: 'AnnaSetu Booking Engine',
          notes: `Token ${token_number} generated for procurement.`
        }
      ]
    });

    await newLot.save();
    res.status(201).json({ message: 'Procurement lot initiated successfully', lot: newLot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin updates stage (Gate In, Quality Assaying, Weighbridge, Ready for Payment)
router.put('/:id/update-stage', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      stage, 
      notes, 
      updated_by = 'Admin / Mandi Officer',
      gate_details,
      quality_details,
      weighment_details,
      receipt_details
    } = req.body;

    let lot;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      lot = await Procurement.findById(id);
    } else {
      lot = await Procurement.findOne({ token_number: id });
    }

    if (!lot) {
      return res.status(404).json({ error: 'Procurement record not found.' });
    }

    // Update Stage
    if (stage) {
      lot.current_stage = stage;
    }

    // Stage specific sub-object updates
    if (gate_details) {
      lot.gate_details = { ...lot.gate_details, ...gate_details, entry_time: gate_details.entry_time || new Date() };
    }

    if (quality_details) {
      lot.quality_details = { ...lot.quality_details, ...quality_details, assayed_at: quality_details.assayed_at || new Date() };
    }

    if (weighment_details) {
      const net_kg = (weighment_details.gross_weight_kg || lot.weighment_details.gross_weight_kg || 0) - 
                     (weighment_details.tare_weight_kg || lot.weighment_details.tare_weight_kg || 0);
      const net_qtl = Number((net_kg / 100).toFixed(2));

      lot.weighment_details = {
        ...lot.weighment_details,
        ...weighment_details,
        net_weight_kg: net_kg,
        net_weight_quintals: net_qtl,
        weighed_at: weighment_details.weighed_at || new Date()
      };
    }

    if (receipt_details || stage === 'READY_FOR_PAYMENT') {
      const msp = receipt_details?.msp_rate_per_quintal || lot.receipt_details.msp_rate_per_quintal || 2275;
      const net_qtl = lot.weighment_details.net_weight_quintals || 45.20;
      const gross_pay = Math.round(msp * net_qtl);
      const deductions = receipt_details?.deductions_inr || 0;
      const net_pay = gross_pay - deductions;
      const j_form = receipt_details?.j_form_no || lot.receipt_details.j_form_no || `JF-2026-${Math.floor(10000 + Math.random() * 90000)}`;

      lot.receipt_details = {
        ...lot.receipt_details,
        ...receipt_details,
        j_form_no: j_form,
        msp_rate_per_quintal: msp,
        gross_payable_inr: gross_pay,
        deductions_inr: deductions,
        net_payable_inr: net_pay,
        payment_status: 'READY_FOR_PAYMENT',
        approved_by: updated_by,
        approved_at: new Date()
      };
    }

    // Title map for log
    const stageTitles = {
      'SLOT_BOOKED': 'Slot Booked & Token Active',
      'GATE_IN': 'Mandi Gate Entry Verified',
      'QUALITY_CHECKED': 'Quality Assayed & Graded',
      'WEIGHED_UNLOADED': 'Weighbridge & Unloading Completed',
      'READY_FOR_PAYMENT': 'Procurement Approved (Ready for Payment)'
    };

    // Append to audit stage_logs
    lot.stage_logs.push({
      stage: stage || lot.current_stage,
      title: stageTitles[stage] || 'Stage Updated',
      timestamp: new Date(),
      status: 'completed',
      updated_by,
      notes: notes || `Marked as ${stageTitles[stage] || stage}`
    });

    await lot.save();
    res.json({ message: 'Procurement status updated successfully in database.', lot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset stage for demonstration / quick testing
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    let lot = id.match(/^[0-9a-fA-F]{24}$/) ? await Procurement.findById(id) : await Procurement.findOne({ token_number: id });
    if (!lot) return res.status(404).json({ error: 'Lot not found.' });

    lot.current_stage = 'SLOT_BOOKED';
    lot.stage_logs = [
      {
        stage: 'SLOT_BOOKED',
        title: 'Slot Booked & Token Active',
        timestamp: new Date(),
        status: 'completed',
        updated_by: 'AnnaSetu System',
        notes: 'Reset to initial stage for demo.'
      }
    ];
    lot.gate_details = { vehicle_number: '', driver_name: '', entry_time: null, gate_pass_no: '' };
    lot.quality_details = { moisture_percent: 0, foreign_matter_percent: 0, quality_grade: '', assaying_officer: '', assayed_at: null, is_passed: false, remarks: '' };
    lot.weighment_details = { gross_weight_kg: 0, tare_weight_kg: 0, net_weight_kg: 0, net_weight_quintals: 0, gunny_bags_count: 0, weighbridge_slip_no: '', weighed_at: null };
    lot.receipt_details = { j_form_no: '', msp_rate_per_quintal: 2275, gross_payable_inr: 0, deductions_inr: 0, net_payable_inr: 0, payment_status: 'READY_FOR_PAYMENT', approved_by: '', approved_at: null };

    await lot.save();
    res.json({ message: 'Reset successful', lot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

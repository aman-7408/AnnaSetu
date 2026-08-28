const mongoose = require('mongoose');

const procurementSchema = new mongoose.Schema({
  token_id: { type: String, required: true, unique: true },
  farmer_name: { type: String, required: true, default: 'Aman Kumar' },
  farmer_phone: { type: String, default: '+91 98765 43210' },
  crop_type: { type: String, default: 'Wheat (Sharbati A-Grade)' },
  centre_name: { type: String, required: true },
  current_stage: { type: Number, default: 1, min: 1, max: 5 }, // 1 to 5
  
  // Stage 1: Slot Active
  slot_name: { type: String, default: 'Slot 1: Morning (09:00 AM - 12:00 PM)' },
  slot_date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  estimated_weight_quintals: { type: Number, default: 0 },

  
  // Stage 2: Gate Check-in
  vehicle_number: { type: String, default: '' },
  gate_pass: { type: String, default: '' },
  gate_in_at: { type: Date },

  // Stage 3: Quality Check
  moisture_percent: { type: Number, default: 0 },
  grade: { type: String, default: '' },
  assayed_at: { type: Date },

  // Stage 4: Weighbridge
  net_weight_quintals: { type: Number, default: 0 },
  gunny_bags: { type: Number, default: 0 },
  weighed_at: { type: Date },

  // Stage 5: Payment Approval & J-Form
  msp_rate: { type: Number, default: 2275 },
  gross_payout: { type: Number, default: 0 },
  j_form_number: { type: String, default: '' },
  approved_at: { type: Date },

  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Procurement || mongoose.model('Procurement', procurementSchema);

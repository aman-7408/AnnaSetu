const mongoose = require('mongoose');

const procurementSchema = new mongoose.Schema({
  token_id: { type: String, required: true, unique: true },
  farmer_aadhar: { type: String, required: true },
  farmer_name: { type: String, required: true },
  farmer_phone: { type: String, required: true },
  crop_type: { type: String, required: true },
  centre_name: { type: String, required: true },
  current_stage: { type: Number, default: 1, min: 1, max: 5 }, // 1 to 5
  
  // Stage 1: Slot Active
  slot_name: { type: String, default: 'Slot 1: Morning (09:00 AM - 12:00 PM)' },
  slot_date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  estimated_weight_quintals: { type: Number, default: 0 },

  
  // Stage 2: Gate Check-in
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
  msp_rate: { type: Number },
  gross_payout: { type: Number, default: 0 },
  j_form_number: { type: String, default: '' },
  approved_at: { type: Date },

  // Status & Rejection Tracking
  status: { type: String, default: 'in_progress', enum: ['in_progress', 'completed', 'rejected'] },
  rejection_stage: { type: Number },
  rejection_reason: { type: String, default: '' },
  rejected_at: { type: Date },
  rejected_by: { type: String, default: 'Mandi Quality Officer' },

  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Procurement || mongoose.model('Procurement', procurementSchema);

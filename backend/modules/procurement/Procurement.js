const mongoose = require('mongoose');

const procurementSchema = new mongoose.Schema({
  token_number: { type: String, required: true, unique: true },
  farmer_id: { type: String, required: true },
  farmer_name: { type: String, required: true },
  farmer_phone: { type: String, required: true },
  crop_type: { type: String, required: true },
  crop_variety: { type: String, default: 'Standard' },
  centre_name: { type: String, required: true },
  centre_code: { type: String, default: 'MND-01' },
  scheduled_date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  time_slot: { type: String, default: '09:00 AM - 12:00 PM' },
  
  // 5 stages up to Ready for Payment
  current_stage: {
    type: String,
    enum: [
      'SLOT_BOOKED',
      'GATE_IN',
      'QUALITY_CHECKED',
      'WEIGHED_UNLOADED',
      'READY_FOR_PAYMENT'
    ],
    default: 'SLOT_BOOKED'
  },

  stage_logs: [
    {
      stage: { type: String, required: true },
      title: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      status: { type: String, enum: ['completed', 'in_progress', 'pending'], default: 'completed' },
      updated_by: { type: String, default: 'Mandi System' },
      notes: { type: String, default: '' }
    }
  ],

  gate_details: {
    vehicle_number: { type: String, default: '' },
    driver_name: { type: String, default: '' },
    entry_time: { type: Date },
    gate_pass_no: { type: String, default: '' }
  },

  quality_details: {
    moisture_percent: { type: Number, default: 0 },
    foreign_matter_percent: { type: Number, default: 0 },
    quality_grade: { type: String, default: '' },
    assaying_officer: { type: String, default: '' },
    assayed_at: { type: Date },
    is_passed: { type: Boolean, default: false },
    remarks: { type: String, default: '' }
  },

  weighment_details: {
    gross_weight_kg: { type: Number, default: 0 },
    tare_weight_kg: { type: Number, default: 0 },
    net_weight_kg: { type: Number, default: 0 },
    net_weight_quintals: { type: Number, default: 0 },
    gunny_bags_count: { type: Number, default: 0 },
    weighbridge_slip_no: { type: String, default: '' },
    weighed_at: { type: Date }
  },

  receipt_details: {
    j_form_no: { type: String, default: '' },
    msp_rate_per_quintal: { type: Number, default: 2275 },
    gross_payable_inr: { type: Number, default: 0 },
    deductions_inr: { type: Number, default: 0 },
    net_payable_inr: { type: Number, default: 0 },
    payment_status: { type: String, default: 'READY_FOR_PAYMENT' },
    approved_by: { type: String, default: '' },
    approved_at: { type: Date }
  },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ProcurementLot || mongoose.model('ProcurementLot', procurementSchema);

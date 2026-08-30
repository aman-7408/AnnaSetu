const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  token_id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  farmer_aadhar: { 
    type: String, 
    required: true,
    index: true 
  },
  farmer_name: { 
    type: String, 
    required: true 
  },
  farmer_phone: { 
    type: String, 
    required: true 
  },
  centre_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Centre', 
    required: true 
  },
  centre_name: { 
    type: String, 
    required: true 
  },
  slot_code: { 
    type: String, 
    enum: ['SLOT_1_MORNING', 'SLOT_2_AFTERNOON', 'SLOT_3_EVENING'], 
    required: true 
  },
  slot_name: { 
    type: String, 
    required: true 
  },
  booking_date: { 
    type: String, 
    required: true 
  }, // YYYY-MM-DD
  crop_type: { 
    type: String, 
    required: true 
  },
  crops: [
    {
      crop_name: { type: String },
      crop_code: { type: String },
      msp_rate: { type: Number },
      quantity: { type: Number },
      unit: { type: String, default: 'Quintals' },
      weight_quintals: { type: Number },
      estimated_payout: { type: Number }
    }
  ],
  estimated_weight_quintals: { 
    type: Number, 
    required: true,
    min: [0.1, 'Estimated weight must be at least 0.1 Quintal']
  },
  total_estimated_payout: {
    type: Number,
    default: 0
  },
  status: { 
    type: String, 
    enum: ['confirmed', 'cancelled', 'completed'], 
    default: 'confirmed' 
  },
  qr_code_data: { 
    type: String, 
    required: true 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});
// High-performance composite indexes for Mandi Manager Dashboards
bookingSchema.index({ centre_id: 1, booking_date: 1, slot_code: 1 });
bookingSchema.index({ farmer_aadhar: 1, booking_date: -1 });

module.exports = mongoose.model('Booking', bookingSchema);

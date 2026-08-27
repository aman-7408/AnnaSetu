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
  estimated_weight_quintals: { 
    type: Number, 
    required: true,
    min: [1, 'Estimated weight must be at least 1 Quintal']
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

module.exports = mongoose.model('Booking', bookingSchema);

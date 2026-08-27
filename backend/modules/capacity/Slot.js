const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  centre_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
  centre_name: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  slot_code: { 
    type: String, 
    enum: ['SLOT_1_MORNING', 'SLOT_2_AFTERNOON', 'SLOT_3_EVENING'], 
    required: true 
  },
  slot_name: { type: String, required: true },
  max_capacity_quintals: { type: Number, required: true },
  booked_capacity_quintals: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['available', 'filling_fast', 'full', 'closed'], 
    default: 'available' 
  },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Slot', slotSchema);

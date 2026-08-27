const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  state: { type: String, required: true },
  district: { type: String, required: true },
  location: { type: String, required: true },
  daily_capacity_quintals: { type: Number, required: true, default: 1000 },
  max_designed_capacity_quintals: { type: Number, required: true, default: 2000 }, // Physical Silo Ceiling
  booked_capacity_quintals: { type: Number, default: 0 },
  manager_name: { type: String, required: true },
  manager_phone: { type: String, required: true },
  operating_hours: { type: String, default: '09:00 AM - 06:00 PM' },
  status: { 
    type: String, 
    enum: ['active', 'bottleneck_alert', 'divert_active', 'maintenance'], 
    default: 'active' 
  },
  alert_message: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Centre', centreSchema);

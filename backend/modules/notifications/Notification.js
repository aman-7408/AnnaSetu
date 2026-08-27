const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  farmer_id: { type: String, required: true },
  recipient_name: { type: String, default: 'Farmer' },
  recipient_phone: { type: String, default: '9876543210' },
  
  // Channels: 'in_app', 'sms'
  channel: { 
    type: String, 
    enum: ['in_app', 'sms'], 
    default: 'in_app' 
  },
  
  // Specific procurement trigger event
  trigger_event: {
    type: String,
    enum: [
      'registration_welcome',
      'land_review_notice',
      'booking_confirmed',
      'slot_reminder',
      'slot_missed',
      'slot_rescheduled',
      'queue_update',
      'assay_completed',
      'payment_initiated',
      'payment_credited',
      'payment_hold',
      'weather_alert',
      'manual_alert'
    ],
    default: 'manual_alert'
  },

  // Category for easy tab filtering
  category: {
    type: String,
    enum: ['registration', 'booking', 'queue', 'quality', 'payment', 'advisory'],
    default: 'booking'
  },

  // Big, clear title (e.g. "Money in Bank: ₹1,09,500")
  title: { type: String, required: true },

  // Ultra-simple message in plain English
  message: { type: String, required: true },

  // Clear 1-line action for low-literacy clarity (e.g. "Carry 50 bags & Aadhaar card")
  action_hint: { type: String, default: '' },

  // Delivery status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'failed'],
    default: 'delivered'
  },

  // Read status in the App
  is_read: { type: Boolean, default: false },

  // Offline / low network fallback details
  fallback_applied: { type: Boolean, default: false },
  fallback_reason: { type: String, default: '' },

  // Optional contextual data
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  sent_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);

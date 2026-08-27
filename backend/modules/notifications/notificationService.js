const Notification = require('./Notification');

/**
 * Simple, farmer-friendly in-app notification templates
 * Plain English — clear and short for low-literacy users
 */
const TEMPLATES = {
  registration_welcome: (data) => ({
    title: 'Welcome to AnnaSetu!',
    message: `Hello ${data.name || 'Farmer'}! Your sign-up is complete. Your Farmer ID is ${data.farmer_id || 'AS-2026-4821'}.`,
    action_hint: 'You can now book a day to sell your grain.',
    category: 'registration'
  }),

  land_review_notice: (data) => ({
    title: 'Land Details in Review',
    message: `Your land record for Plot #${data.plot_number || '42/A'} is being checked.`,
    action_hint: 'Message will be sent once it is approved.',
    category: 'registration'
  }),

  booking_confirmed: (data) => ({
    title: 'Mandi Slot Confirmed!',
    message: `Your slot to sell grain is booked for ${data.date || 'Wednesday, 27 Aug 2026'} (09:00 AM – 12:00 PM) at ${data.centre_name || 'Meerut Central Agro Warehouse'}.`,
    action_hint: `Token #${data.token_no || 'AS-2026-WHT-7821'}. Please carry your Aadhaar card and tractor pass.`,
    category: 'booking'
  }),

  slot_reminder: (data) => ({
    title: 'Reminder: Mandi Shift Tomorrow',
    message: `Your grain selling shift (09:00 AM – 12:00 PM) is scheduled at ${data.centre_name || 'Meerut Central Agro Warehouse'}.`,
    action_hint: 'Please arrive at Gate #1 with your Token AS-2026-WHT-7821.',
    category: 'booking'
  }),

  slot_missed: (data) => ({
    title: 'Missed Your Slot',
    message: 'You missed your scheduled shift today.',
    action_hint: 'Tap "Book Slot" to choose a new 3-hour shift.',
    category: 'booking'
  }),

  queue_update: (data) => ({
    title: 'Tractor Line & Gate Check-in',
    message: `Vehicle #${data.vehicle_no || 'HR-05-AB-4412'} is cleared at Gate Pass #${data.gate_pass || 'GP-2026-8831'}.`,
    action_hint: 'Proceed to Quality Assaying station for moisture check.',
    category: 'queue'
  }),

  payment_initiated: (data) => ({
    title: 'J-Form Approved — DBT Processing',
    message: `J-Form #${data.j_form_no || 'JF-2026-98124'} generated for Rs. ${data.amount || '1,02,830'} (${data.quantity || '45.20 Quintals'} Grade A Wheat @ Rs. 2,275 MSP).`,
    action_hint: 'Govt PFMS Direct Benefit Transfer is in progress.',
    category: 'payment'
  }),

  payment_credited: (data) => ({
    title: 'Money Sent to Your Bank via DBT!',
    message: `Rs. ${data.amount || '1,02,830'} has arrived in your ${data.bank_name || 'State Bank of India'} Account (ending in ${data.account_last4 || '4412'}).`,
    action_hint: 'Official J-Form receipt available for download.',
    category: 'payment'
  }),

  payment_hold: (data) => ({
    title: 'Issue faced in transaction.',
    message: 'Error in bank details found.',
    action_hint: 'Fix the error with the bank.',
    category: 'payment'
  }),

  weather_alert: (data) => ({
    title: 'Rain Advisory at Mandi',
    message: `Heavy moisture expected near ${data.centre_name || 'Meerut Central Agro Warehouse'}. Covered grain silo sheds are fully active.`,
    action_hint: 'Cover tractor-trolley with waterproof tarpaulin before departure.',
    category: 'advisory'
  }),

  manual_alert: (data) => ({
    title: data.title || 'Mandi Update',
    message: data.message || 'You have a new update from AnnaSetu.',
    action_hint: data.action_hint || 'Check your account for details.',
    category: data.category || 'advisory'
  })
};

/**
 * Create and save an in-app notification to MongoDB
 */
async function sendNotification({
  farmer_id,
  recipient_name = 'Farmer',
  recipient_phone = '',
  trigger_event = 'manual_alert',
  custom_title,
  custom_message,
  custom_action_hint,
  metadata = {}
}) {
  const templateFn = TEMPLATES[trigger_event] || TEMPLATES.manual_alert;
  const templateData = templateFn({
    farmer_id,
    name: recipient_name,
    ...metadata
  });

  const finalTitle = custom_title || templateData.title;
  const finalMessage = custom_message || templateData.message;
  const finalActionHint = custom_action_hint || templateData.action_hint;
  const finalCategory = templateData.category;

  const notification = new Notification({
    farmer_id,
    recipient_name,
    recipient_phone,
    channel: 'in_app',
    trigger_event,
    category: finalCategory,
    title: finalTitle,
    message: finalMessage,
    action_hint: finalActionHint,
    status: 'delivered',
    is_read: false,
    fallback_applied: false,
    metadata,
    sent_at: new Date()
  });

  await notification.save();
  return notification;
}

/**
 * Seed realistic demo notifications for evaluation
 */
async function seedDemoNotifications(farmer_id = '111122223333', name = 'Aman Kumar', phone = '9876543210') {
  await Notification.deleteMany({ farmer_id });

  const seedEvents = [
    {
      trigger_event: 'registration_welcome',
      metadata: { farmer_id: 'AS-2026-WHT-7821', name }
    },
    {
      trigger_event: 'booking_confirmed',
      metadata: { date: 'Wednesday, 27 Aug 2026', time: '09:00 AM – 12:00 PM', centre_name: 'Meerut Central Agro Warehouse (Gate #1)', token_no: 'AS-2026-WHT-7821' }
    },
    {
      trigger_event: 'queue_update',
      metadata: { vehicle_no: 'HR-05-AB-4412', gate_pass: 'GP-2026-8831' }
    },
    {
      trigger_event: 'payment_initiated',
      metadata: { amount: '1,02,830', quantity: '45.20 Quintals', j_form_no: 'JF-2026-98124' }
    },
    {
      trigger_event: 'payment_credited',
      metadata: { amount: '1,02,830', bank_name: 'State Bank of India', account_last4: '4412', utr: 'JF-2026-98124' }
    },
    {
      trigger_event: 'weather_alert',
      metadata: { centre_name: 'Meerut Central Agro Warehouse' }
    }
  ];

  const created = [];
  for (const ev of seedEvents) {
    const notif = await sendNotification({
      farmer_id,
      recipient_name: name,
      recipient_phone: phone,
      trigger_event: ev.trigger_event,
      metadata: ev.metadata
    });
    created.push(notif);
  }

  return created;
}

module.exports = {
  TEMPLATES,
  sendNotification,
  seedDemoNotifications
};

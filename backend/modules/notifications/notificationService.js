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
    title: 'Mandi Date Confirmed!',
    message: `Your time to bring grain is booked for ${data.date || 'Tuesday, 28 Aug'} at ${data.time || '10:00 AM'} at ${data.centre_name || 'Kharar Mandi'}.`,
    action_hint: `Token #${data.token_no || 'TK-108'}. Please carry your Aadhaar card and grain bags.`,
    category: 'booking'
  }),

  slot_reminder: (data) => ({
    title: 'Reminder: Mandi Tomorrow',
    message: `Your grain selling slot is tomorrow at ${data.time || '10:00 AM'} at ${data.centre_name || 'Kharar Mandi'}.`,
    action_hint: 'Please pack your bags and check your tractor.',
    category: 'booking'
  }),

  slot_missed: (data) => ({
    title: 'Missed Your Slot',
    message: 'You missed your slot today.',
    action_hint: 'Tap "Book Slot" to choose your new time.',
    category: 'booking'
  }),

  queue_update: (data) => ({
    title: 'Tractor Line Update',
    message: `Only ${data.tractors_ahead || '2'} tractors ahead of you at Weighbridge #${data.gate_no || '1'}.`,
    action_hint: 'Get ready to move towards the gate.',
    category: 'queue'
  }),

  payment_initiated: (data) => ({
    title: 'Bill Prepared — Money Processing',
    message: `Bill of Rs. ${data.amount || '1,09,500'} prepared for ${data.quantity || '50 Quintals'} Wheat at Govt MSP price.`,
    action_hint: 'Govt bank transfer is in progress. No action needed.',
    category: 'payment'
  }),

  payment_credited: (data) => ({
    title: 'Money Sent to Your Bank!',
    message: `Rs. ${data.amount || '1,09,500'} has arrived in your ${data.bank_name || 'SBI'} Bank Account (ending in ${data.account_last4 || '5678'}).`,
    action_hint: 'You can check your bank account.',
    category: 'payment'
  }),

  payment_hold: (data) => ({
    title: 'Issue faced in transaction.',
    message: 'Error in bank details found.',
    action_hint: 'Fix the error with the bank.',
    category: 'payment'
  }),

  weather_alert: (data) => ({
    title: 'Rain Alert at Mandi',
    message: `Rain is expected near ${data.centre_name || 'Kharar Mandi'} tomorrow. We have kept your grain in a covered shed.`,
    action_hint: 'Cover your tractor with plastic sheet before leaving.',
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
  console.log(`[AnnaSetu] ✅ In-App Notification saved for ${recipient_name}: "${finalTitle}"`);
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
      metadata: { farmer_id: 'AS-2026-4821', name }
    },
    {
      trigger_event: 'booking_confirmed',
      metadata: { date: 'Tuesday, 28 Aug', time: '10:00 AM', centre_name: 'Kharar Mandi (Gate #2)', token_no: 'TK-108' }
    },
    {
      trigger_event: 'queue_update',
      metadata: { tractors_ahead: '2', gate_no: '1' }
    },
    {
      trigger_event: 'payment_initiated',
      metadata: { amount: '1,09,500', quantity: '50 Quintals' }
    },
    {
      trigger_event: 'payment_credited',
      metadata: { amount: '1,09,500', bank_name: 'SBI', account_last4: '5678', utr: 'DBT2026-98124' }
    },
    {
      trigger_event: 'weather_alert',
      metadata: { centre_name: 'Kharar Mandi' }
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

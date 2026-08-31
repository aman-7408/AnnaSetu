const express = require('express');
const router = express.Router();
const Notification = require('./Notification');
const { sendNotification, seedDemoNotifications } = require('./notificationService');

/**
 * POST /api/notifications/trigger
 * Called by other modules (Booking, Registration, Payment) to send an in-app notification
 */
router.post('/trigger', async (req, res) => {
  try {
    const {
      farmer_id,
      recipient_name,
      recipient_phone,
      trigger_event,
      custom_title,
      custom_message,
      custom_action_hint,
      metadata
    } = req.body;

    if (!farmer_id) {
      return res.status(400).json({ error: 'farmer_id is required.' });
    }

    const result = await sendNotification({
      farmer_id,
      recipient_name,
      recipient_phone,
      trigger_event,
      custom_title,
      custom_message,
      custom_action_hint,
      metadata: metadata || {}
    });

    res.status(201).json({
      message: 'Notification sent successfully.',
      notification: result
    });
  } catch (error) {
    console.error('Notification trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/farmer/:farmer_id
 * Returns a farmer's notifications (newest first) + unread count
 */
router.get('/farmer/:farmer_id', async (req, res) => {
  try {
    const { farmer_id } = req.params;
    const { category, unread_only } = req.query;

    const query = { farmer_id };

    if (category && category !== 'all') {
      query.category = category;
    }
    if (unread_only === 'true') {
      query.is_read = false;
    }

    const notifications = await Notification.find(query).sort({ sent_at: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ farmer_id, is_read: false });
    const totalCount = await Notification.countDocuments({ farmer_id });

    res.json({
      success: true,
      count: notifications.length,
      unread_count: unreadCount,
      total_count: totalCount,
      notifications
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const mongoose = require('mongoose');

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
router.put('/:id/read', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid Notification ID format.' });
    }

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { is_read: true },
      { returnDocument: 'after' }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json({ message: 'Marked as read.', notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/notifications/farmer/:farmer_id/read-all
 * Mark all notifications for a farmer as read
 */
router.put('/farmer/:farmer_id/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { farmer_id: req.params.farmer_id, is_read: false },
      { is_read: true }
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/notifications/seed-demo
 * Seeds initial realistic notifications for quick evaluation
 */
router.post('/seed-demo', async (req, res) => {
  try {
    const { farmer_id, name, phone } = req.body;
    if (!farmer_id || !name || !phone) return res.status(400).json({ error: 'farmer_id, name, and phone are required' });
    const seeded = await seedDemoNotifications(farmer_id, name, phone);
    res.status(201).json({
      message: `Seeded ${seeded.length} sample notifications.`,
      notifications: seeded
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/notifications/clear-all
 * Clear notifications for a farmer (for demo reset)
 */
router.delete('/clear-all', async (req, res) => {
  try {
    const { farmer_id } = req.query;
    if (farmer_id) {
      await Notification.deleteMany({ farmer_id });
    } else {
      await Notification.deleteMany({});
    }
    res.json({ message: 'Notifications cleared.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

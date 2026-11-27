const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Helper to build notification query based on user role
function buildNotificationQuery(user) {
  const isSuperAdmin = user?.role === 'superadmin';
  if (isSuperAdmin) {
    return {
      $or: [
        { recipient: user.id },
        { recipientRole: { $in: ['superadmin', 'admin'] } },
        { forRole: { $in: ['superadmin', 'admin'] } },
        { isGlobal: true },
        { isSystem: true },
        { recipient: null }
      ]
    };
  }
  return { recipient: user.id };
}

// Get all notifications for authenticated user (supports user, admin, and superadmin)
router.get('/', auth, async (req, res) => {
  try {
    const query = buildNotificationQuery(req.user);
    const notifications = await Notification.find(query)
      .populate('sender', 'name email phone')
      .populate('property', 'title location price images transactionType')
      .populate('request')
      .sort({ createdAt: -1 })
      .limit(50);

    // Clean up any orphaned notifications whose property was deleted
    const orphanedNotificationIds = notifications
      .filter(n => n && n._doc && n._doc.property && !n.property)
      .map(n => n._id);
    if (orphanedNotificationIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: orphanedNotificationIds } });
    }

    const validNotifications = notifications.filter(
      n => !(n && n._doc && n._doc.property && !n.property)
    );

    const unreadCount = validNotifications.filter(n => !n.read && !n.isRead).length;

    res.json({ notifications: validNotifications, unreadCount, success: true });
  } catch (err) {
    console.error('Error fetching notifications:', err.message || err);
    res.status(200).json({ notifications: [], unreadCount: 0, error: err.message });
  }
});

// Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const baseQuery = buildNotificationQuery(req.user);
    const query = {
      ...baseQuery,
      read: { $ne: true },
      isRead: { $ne: true }
    };

    const count = await Notification.countDocuments(query);
    res.json({ unreadCount: count, count, success: true });
  } catch (err) {
    console.error('Error getting unread count:', err.message || err);
    res.status(200).json({ unreadCount: 0, count: 0, error: err.message });
  }
});

// Mark single notification as read (supports superadmin authorization)
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    const isSuperAdmin = req.user?.role === 'superadmin';
    if (!isSuperAdmin && notification.recipient && notification.recipient.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    notification.read = true;
    notification.isRead = true;
    await notification.save();

    res.json({ notification, success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err.message || err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Mark all notifications for user as read (supports superadmin)
router.put('/read-all', auth, async (req, res) => {
  try {
    const query = buildNotificationQuery(req.user);
    await Notification.updateMany(
      query,
      { $set: { read: true, isRead: true } }
    );

    res.json({ msg: 'All notifications marked as read', success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err.message || err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;

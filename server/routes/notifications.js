const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Get all notifications for authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
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

    res.json({ notifications: validNotifications, unreadCount });
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).send('Server Error');
  }
});

// Mark single notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    if (notification.recipient.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (err) {
    console.error('Error marking notification as read:', err.message);
    res.status(500).send('Server Error');
  }
});

// Mark all notifications for user as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true } }
    );

    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications as read:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

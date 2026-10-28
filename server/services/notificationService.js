const Notification = require('../models/Notification');

/**
 * Creates an in-app notification safely after an action succeeds.
 * Prevents rapid accidental duplicates.
 */
async function sendNotification({
  recipient,
  sender,
  type,
  title,
  message,
  property = null,
  request = null,
  transactionType = 'rent',
  actionUrl = ''
}) {
  try {
    if (!recipient || !sender || !type || !title) {
      console.warn('[Notification] Missing required fields for notification');
      return null;
    }

    // Don't notify oneself
    if (recipient.toString() === sender.toString()) {
      return null;
    }

    // Check for recent duplicate (within last 15 seconds)
    const recentDuplicate = await Notification.findOne({
      recipient,
      type,
      request,
      createdAt: { $gte: new Date(Date.now() - 15000) }
    });

    if (recentDuplicate) {
      return recentDuplicate;
    }

    const notification = new Notification({
      recipient,
      sender,
      type,
      title,
      message,
      property,
      request,
      transactionType,
      actionUrl,
      read: false
    });

    return await notification.save();
  } catch (err) {
    console.error('[Notification] Error creating notification:', err.message || err);
    return null;
  }
}

module.exports = {
  sendNotification
};

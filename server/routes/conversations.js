const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Property = require('../models/Property');

// Create or get a conversation for a property (tenant-initiated)
router.post('/', auth, async (req, res) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) return res.status(400).json({ msg: 'propertyId is required' });

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ msg: 'Property not found' });

    const ownerId = property.owner.toString();
    const userId = req.user.id;

    if (ownerId === userId) {
      return res.status(400).json({ msg: 'Owner cannot initiate chat with self for this property' });
    }

    let convo = await Conversation.findOne({ property: propertyId, tenant: userId });
    if (!convo) {
      convo = await Conversation.create({
        property: propertyId,
        owner: ownerId,
        tenant: userId,
        lastMessageAt: new Date()
      });
    }

    res.json(convo);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// List my conversations
router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const convos = await Conversation.find({
      $or: [{ owner: userId }, { tenant: userId }]
    })
      .sort({ lastMessageAt: -1 })
      .populate('property', 'title location images')
      .lean();
    res.json(convos);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Get messages
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ msg: 'Conversation not found' });
    const userId = req.user.id;
    if (convo.owner.toString() !== userId && convo.tenant.toString() !== userId) {
      return res.status(401).json({ msg: 'Not authorized' });
    }
    const messages = await Message.find({ conversation: convo._id }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Send message
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ msg: 'content is required' });

    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ msg: 'Conversation not found' });
    const userId = req.user.id;
    if (convo.owner.toString() !== userId && convo.tenant.toString() !== userId) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    const msg = await Message.create({
      conversation: convo._id,
      sender: userId,
      content: content.trim()
    });
    convo.lastMessageAt = new Date();
    await convo.save();
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;

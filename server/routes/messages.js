const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');
const Property = require('../models/Property');
const Agreement = require('../models/Agreement');
const Request = require('../models/Request');
const SelfManagedRental = require('../models/SelfManagedRental');
const Notification = require('../models/Notification');

// All messages routes require authentication
router.use(auth);

// Enforce valid authenticated user ID
router.use((req, res, next) => {
  const currentUserId = String(req.user?._id || req.user?.id || req.user?.userId || '');
  if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId)) {
    return res.status(401).json({ success: false, msg: 'Unauthorized' });
  }
  req.currentUserId = currentUserId;
  next();
});

/**
 * Helper to safely extract string ObjectIds whether a field is populated or raw
 */
function extractId(val) {
  if (!val) return '';
  if (typeof val === 'object') {
    if (val._id) return String(val._id);
    if (val.id) return String(val.id);
  }
  return String(val);
}

/**
 * Normalize display name
 */
function normalizeName(u) {
  if (!u) return 'User';
  return (
    u.name ||
    u.fullName ||
    u.username ||
    (u.email ? u.email.split('@')[0] : 'User')
  );
}

/**
 * Helper to determine if two users have an active connection:
 * 1. Owner & Tenant across Property collection
 * 2. Owner & Tenant across Agreement collection
 * 3. Owner & Tenant across Request collection (accepted / active transactions)
 * 4. Tenant & Landlord in SelfManagedRental collection
 * 5. Accepted FriendRequest between them
 */
async function areUsersConnected(userId1, userId2) {
  if (!userId1 || !userId2) return { connected: false };
  const u1Str = String(userId1);
  const u2Str = String(userId2);

  if (!mongoose.Types.ObjectId.isValid(u1Str) || !mongoose.Types.ObjectId.isValid(u2Str)) {
    return { connected: false };
  }

  const u1 = new mongoose.Types.ObjectId(u1Str);
  const u2 = new mongoose.Types.ObjectId(u2Str);

  // 1. Check Property collection
  const sharedProperty = await Property.findOne({
    $or: [
      { owner: u1, tenant: u2 },
      { owner: u2, tenant: u1 },
      { ownerId: u1, tenant: u2 },
      { ownerId: u2, tenant: u1 },
      { owner: u1, tenantId: u2 },
      { owner: u2, tenantId: u1 },
      { ownerId: u1, tenantId: u2 },
      { ownerId: u2, tenantId: u1 },
      { userId: u1, tenant: u2 },
      { userId: u2, tenant: u1 },
      { landlordId: u1, tenant: u2 },
      { landlordId: u2, tenant: u1 },
      { createdBy: u1, tenant: u2 },
      { createdBy: u2, tenant: u1 }
    ]
  }).select('_id title name location');

  if (sharedProperty) {
    return { connected: true, reason: 'property', property: sharedProperty };
  }

  // 2. Check Agreement collection
  try {
    const sharedAgreement = await Agreement.findOne({
      $or: [
        { owner: u1, tenant: u2 },
        { owner: u2, tenant: u1 },
        { ownerId: u1, tenant: u2 },
        { ownerId: u2, tenant: u1 },
        { owner: u1, tenantId: u2 },
        { owner: u2, tenantId: u1 },
        { ownerId: u1, tenantId: u2 },
        { ownerId: u2, tenantId: u1 }
      ]
    }).select('_id propertyTitle');

    if (sharedAgreement) {
      return { connected: true, reason: 'agreement', agreement: sharedAgreement };
    }
  } catch {}

  // 3. Check active Request collection
  try {
    const sharedRequest = await Request.findOne({
      $or: [
        { owner: u1, tenant: u2 },
        { owner: u2, tenant: u1 }
      ],
      status: {
        $in: [
          'accepted',
          'approved',
          'terms_confirmed',
          'completed',
          'payment_pending',
          'Pending_Payment',
          'Payment_Submitted'
        ]
      }
    }).select('_id');

    if (sharedRequest) {
      return { connected: true, reason: 'request', request: sharedRequest };
    }
  } catch {}

  // 4. Check SelfManagedRental collection
  try {
    const sharedSelfManaged = await SelfManagedRental.findOne({
      $or: [
        { tenantId: u1, 'landlord.connectedUser': u2 },
        { tenantId: u2, 'landlord.connectedUser': u1 }
      ]
    }).select('_id propertyTitle');

    if (sharedSelfManaged) {
      return { connected: true, reason: 'self_managed', rental: sharedSelfManaged };
    }
  } catch {}

  // 5. Check accepted FriendRequest
  const acceptedFriend = await FriendRequest.findOne({
    $or: [
      { senderId: u1, receiverId: u2 },
      { senderId: u2, receiverId: u1 }
    ],
    status: 'accepted'
  });

  if (acceptedFriend) {
    return { connected: true, reason: 'friend', friendRequest: acceptedFriend };
  }

  return { connected: false };
}

/**
 * Collect all connected counterparts for currentUserId.
 * Returns Map of otherUserId -> { badge: 'Tenant' | 'Property Owner' | 'Friend' | null, propertyTitle: string }
 */
async function getConnectedContactsMap(currentUserIdStr) {
  const contactMap = new Map();

  // 1. Property collection (Owner <-> Tenant)
  try {
    const properties = await Property.find({
      $or: [
        { ownerId: currentUserIdStr },
        { owner: currentUserIdStr },
        { userId: currentUserIdStr },
        { landlordId: currentUserIdStr },
        { createdBy: currentUserIdStr },
        { tenantId: currentUserIdStr },
        { tenant: currentUserIdStr },
        { renterId: currentUserIdStr },
        { occupiedBy: currentUserIdStr }
      ]
    }).lean();

    properties.forEach((p) => {
      const pOwnerId = extractId(p.ownerId || p.owner || p.userId || p.landlordId || p.createdBy);
      const pTenantId = extractId(p.tenantId || p.tenant || p.renterId || p.occupiedBy);
      const pTitle = p.title || p.name || 'Property';

      if (pOwnerId === currentUserIdStr && pTenantId && pTenantId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(pTenantId)) {
        if (!contactMap.has(pTenantId)) {
          contactMap.set(pTenantId, { badge: 'Tenant', propertyTitle: pTitle });
        }
      }
      if (pTenantId === currentUserIdStr && pOwnerId && pOwnerId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(pOwnerId)) {
        if (!contactMap.has(pOwnerId)) {
          contactMap.set(pOwnerId, { badge: 'Property Owner', propertyTitle: pTitle });
        }
      }
    });
  } catch (err) {
    console.error('Error reading properties for contacts:', err);
  }

  // 2. Agreement collection (Owner <-> Tenant)
  try {
    const agreements = await Agreement.find({
      $or: [
        { owner: currentUserIdStr },
        { ownerId: currentUserIdStr },
        { tenant: currentUserIdStr },
        { tenantId: currentUserIdStr }
      ]
    }).lean();

    agreements.forEach((ag) => {
      const agOwnerId = extractId(ag.owner || ag.ownerId);
      const agTenantId = extractId(ag.tenant || ag.tenantId);
      const agTitle = ag.propertyTitle || 'Rental Agreement';

      if (agOwnerId === currentUserIdStr && agTenantId && agTenantId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(agTenantId)) {
        if (!contactMap.has(agTenantId)) {
          contactMap.set(agTenantId, { badge: 'Tenant', propertyTitle: agTitle });
        }
      }
      if (agTenantId === currentUserIdStr && agOwnerId && agOwnerId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(agOwnerId)) {
        if (!contactMap.has(agOwnerId)) {
          contactMap.set(agOwnerId, { badge: 'Property Owner', propertyTitle: agTitle });
        }
      }
    });
  } catch (agErr) {
    console.error('Error fetching agreements for contacts:', agErr);
  }

  // 3. Request collection (Active / Approved Requests)
  try {
    const requests = await Request.find({
      $or: [
        { owner: currentUserIdStr },
        { tenant: currentUserIdStr }
      ],
      status: {
        $in: [
          'accepted',
          'approved',
          'terms_confirmed',
          'completed',
          'payment_pending',
          'Pending_Payment',
          'Payment_Submitted'
        ]
      }
    })
      .populate('property', 'title name')
      .lean();

    requests.forEach((rq) => {
      const rqOwnerId = extractId(rq.owner);
      const rqTenantId = extractId(rq.tenant);
      const rqTitle = (rq.property && (rq.property.title || rq.property.name)) || 'Rental Property';

      if (rqOwnerId === currentUserIdStr && rqTenantId && rqTenantId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(rqTenantId)) {
        if (!contactMap.has(rqTenantId)) {
          contactMap.set(rqTenantId, { badge: 'Tenant', propertyTitle: rqTitle });
        }
      }
      if (rqTenantId === currentUserIdStr && rqOwnerId && rqOwnerId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(rqOwnerId)) {
        if (!contactMap.has(rqOwnerId)) {
          contactMap.set(rqOwnerId, { badge: 'Property Owner', propertyTitle: rqTitle });
        }
      }
    });
  } catch (rqErr) {
    console.error('Error fetching requests for contacts:', rqErr);
  }

  // 4. SelfManagedRental collection
  try {
    const selfManagedRentals = await SelfManagedRental.find({
      $or: [
        { tenantId: currentUserIdStr },
        { 'landlord.connectedUser': currentUserIdStr }
      ]
    }).lean();

    selfManagedRentals.forEach((sm) => {
      const tenantId = extractId(sm.tenantId);
      const landlordId = extractId(sm.landlord?.connectedUser);
      const smTitle = sm.propertyTitle || 'Self Managed Rental';

      if (tenantId === currentUserIdStr && landlordId && landlordId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(landlordId)) {
        if (!contactMap.has(landlordId)) {
          contactMap.set(landlordId, { badge: 'Property Owner', propertyTitle: smTitle });
        }
      }
      if (landlordId === currentUserIdStr && tenantId && tenantId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(tenantId)) {
        if (!contactMap.has(tenantId)) {
          contactMap.set(tenantId, { badge: 'Tenant', propertyTitle: smTitle });
        }
      }
    });
  } catch {}

  // 5. Accepted Friend Requests
  try {
    const acceptedFriends = await FriendRequest.find({
      $or: [{ senderId: currentUserIdStr }, { receiverId: currentUserIdStr }],
      status: 'accepted'
    }).lean();

    acceptedFriends.forEach((fr) => {
      const sId = extractId(fr.senderId);
      const rId = extractId(fr.receiverId);
      const otherId = sId === currentUserIdStr ? rId : sId;
      if (otherId && otherId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(otherId)) {
        if (!contactMap.has(otherId)) {
          contactMap.set(otherId, { badge: 'Friend', propertyTitle: fr.propertyTitle || '' });
        }
      }
    });
  } catch (frErr) {
    console.error('Error fetching friend requests for contacts:', frErr);
  }

  // 6. Users with prior Message history
  try {
    const priorMessages = await Message.find({
      $or: [
        { senderId: currentUserIdStr },
        { receiverId: currentUserIdStr }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    priorMessages.forEach((m) => {
      const sId = extractId(m.senderId);
      const rId = extractId(m.receiverId);
      const otherId = sId === currentUserIdStr ? rId : sId;
      if (otherId && otherId !== currentUserIdStr && mongoose.Types.ObjectId.isValid(otherId)) {
        if (!contactMap.has(otherId)) {
          contactMap.set(otherId, { badge: null, propertyTitle: '' });
        }
      }
    });
  } catch {}

  return contactMap;
}

/**
 * GET /api/messages/contacts
 * Returns { success: true, contacts, users: contacts }
 */
router.get('/contacts', async (req, res) => {
  try {
    const currentUserId = req.currentUserId;
    const onlineUsers = req.app.get('onlineUsers') || new Map();

    const connectedContactsMap = await getConnectedContactsMap(currentUserId);
    const connectedUserIds = Array.from(connectedContactsMap.keys());

    if (connectedUserIds.length === 0) {
      return res.json({ success: true, contacts: [], users: [] });
    }

    const candidateUsers = await User.find({
      _id: { $in: connectedUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
      blocked: { $ne: true }
    })
      .select('_id name fullName username email role tamilRole registrationPurpose phone avatar')
      .lean();

    const contactList = await Promise.all(
      candidateUsers.map(async (u) => {
        const uId = u._id;
        const uIdStr = String(uId);

        const meta = connectedContactsMap.get(uIdStr);
        const badge = meta?.badge || null;
        const propertyTitle = meta?.propertyTitle || '';

        // Most recent message exchanged
        const lastMsg = await Message.findOne({
          $or: [
            { senderId: currentUserId, receiverId: uId },
            { senderId: uId, receiverId: currentUserId }
          ]
        })
          .sort({ createdAt: -1 })
          .lean();

        // Count unread messages sent by this user to current user
        const unreadCount = await Message.countDocuments({
          senderId: uId,
          receiverId: currentUserId,
          read: false
        });

        const isOnline = onlineUsers.has(uIdStr);
        const displayName = normalizeName(u);
        const displayRole = badge || u.registrationPurpose || u.tamilRole || u.role || 'Customer';

        return {
          _id: u._id,
          name: displayName,
          fullName: u.fullName || displayName,
          username: u.username || displayName,
          email: u.email,
          role: displayRole,
          badge,
          propertyTitle,
          avatar: u.avatar || null,
          phone: u.phone || null,
          relationshipStatus: 'connected',
          relation: 'connected',
          friendRequestId: null,
          lastMessage: lastMsg
            ? {
                text: lastMsg.text,
                createdAt: lastMsg.createdAt,
                senderId: lastMsg.senderId,
                read: lastMsg.read
              }
            : null,
          lastMessageAt: lastMsg?.createdAt || null,
          unreadCount,
          isOnline
        };
      })
    );

    // Sort:
    // 1. Users with active conversation history (lastMessageAt desc)
    // 2. Online users
    // 3. Alphabetical by name
    contactList.sort((a, b) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;

      if (timeA && timeB) return timeB - timeA;
      if (timeA) return -1;
      if (timeB) return 1;

      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;

      return (a.name || '').localeCompare(b.name || '');
    });

    return res.json({
      success: true,
      contacts: contactList,
      users: contactList
    });
  } catch (err) {
    console.error('Error fetching contacts:', err);
    return res.status(500).json({ success: false, msg: 'Server error fetching contacts' });
  }
});

/**
 * GET /api/messages/discover?search=
 * Search all registered users and return each user with relation: 'connected' | 'pending_sent' | 'pending_received' | 'none'
 */
router.get('/discover', async (req, res) => {
  try {
    const currentUserId = req.currentUserId;
    const search = (req.query.search || '').trim();
    const onlineUsers = req.app.get('onlineUsers') || new Map();

    const connectedContactsMap = await getConnectedContactsMap(currentUserId);

    const filter = {
      _id: { $ne: currentUserId },
      blocked: { $ne: true }
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const matchedUsers = await User.find(filter)
      .select('_id name fullName username email role tamilRole registrationPurpose phone avatar')
      .limit(40)
      .lean();

    const discoverList = await Promise.all(
      matchedUsers.map(async (u) => {
        const uId = u._id;
        const uIdStr = String(uId);

        let relation = 'none';
        let friendRequestId = null;
        let badge = null;
        let propertyTitle = '';

        if (connectedContactsMap.has(uIdStr)) {
          relation = 'connected';
          const meta = connectedContactsMap.get(uIdStr);
          badge = meta?.badge || null;
          propertyTitle = meta?.propertyTitle || '';
        } else {
          // Check for pending requests
          const pendingReq = await FriendRequest.findOne({
            $or: [
              { senderId: currentUserId, receiverId: uId, status: 'pending' },
              { senderId: uId, receiverId: currentUserId, status: 'pending' }
            ]
          }).lean();

          if (pendingReq) {
            friendRequestId = pendingReq._id;
            propertyTitle = pendingReq.propertyTitle || '';
            relation =
              String(pendingReq.senderId) === currentUserId
                ? 'pending_sent'
                : 'pending_received';
          }
        }

        const isOnline = onlineUsers.has(uIdStr);
        const displayName = normalizeName(u);
        const displayRole = badge || u.registrationPurpose || u.tamilRole || u.role || 'Customer';

        return {
          _id: u._id,
          name: displayName,
          fullName: u.fullName || displayName,
          username: u.username || displayName,
          email: u.email,
          role: displayRole,
          badge,
          propertyTitle,
          avatar: u.avatar || null,
          phone: u.phone || null,
          relation,
          relationshipStatus: relation,
          friendRequestId,
          isOnline
        };
      })
    );

    // Sort: pending_received first, online first, alphabetical
    discoverList.sort((a, b) => {
      if (a.relation === 'pending_received' && b.relation !== 'pending_received') return -1;
      if (a.relation !== 'pending_received' && b.relation === 'pending_received') return 1;

      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;

      return (a.name || '').localeCompare(b.name || '');
    });

    return res.json({
      success: true,
      users: discoverList,
      contacts: discoverList
    });
  } catch (err) {
    console.error('Error in discover users:', err);
    return res.status(500).json({ success: false, msg: 'Server error searching users' });
  }
});

/**
 * Backward compatibility alias: GET /api/messages/users
 */
router.get('/users', async (req, res) => {
  if (req.query.search) {
    req.url = `/discover?search=${encodeURIComponent(req.query.search)}`;
    return router.handle(req, res);
  }
  req.url = '/contacts';
  return router.handle(req, res);
});

/**
 * GET /api/messages/unread-count
 * Get total unread message count for current user badge
 */
router.get('/unread-count', async (req, res) => {
  try {
    const currentUserId = req.currentUserId;
    const count = await Message.countDocuments({
      receiverId: currentUserId,
      read: false
    });
    return res.json({ unreadCount: count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    return res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * GET /api/messages/friend-requests
 * Fetch all incoming pending friend requests for current user
 */
router.get(['/friend-requests', '/friend-request'], async (req, res) => {
  try {
    const currentUserId = req.currentUserId;

    const requests = await FriendRequest.find({
      receiverId: currentUserId,
      status: 'pending'
    })
      .populate('senderId', '_id name fullName username email role tamilRole registrationPurpose avatar phone')
      .populate('propertyId', '_id title name location price images')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(requests);
  } catch (err) {
    console.error('Error fetching friend requests:', err);
    return res.status(500).json({ msg: 'Server error fetching friend requests' });
  }
});

/**
 * POST /api/messages/friend-request
 * Send a new friend / chat request (or auto-accept if reverse pending request exists).
 * Accepts receiverId || recipientId || targetUserId || ownerId AND propertyId.
 */
router.post(['/friend-request', '/friend-requests', '/request'], async (req, res) => {
  try {
    const currentUserId = String(
      req.user?._id ||
      req.user?.id ||
      req.user?.userId ||
      req.user?.user?._id ||
      req.user?.user?.id ||
      req.userId ||
      req.currentUserId ||
      ''
    );

    if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId)) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: missing or invalid user session',
        msg: 'Unauthorized: missing or invalid user session'
      });
    }

    const rawReceiver =
      req.body.receiverId ||
      req.body.recipientId ||
      req.body.targetUserId ||
      req.body.ownerId;

    let targetReceiverId = extractId(rawReceiver).trim();
    const propertyId = req.body.propertyId ? String(req.body.propertyId).trim() : null;
    let propertyTitle = req.body.propertyTitle || req.body.property_title || '';

    // If receiver was passed as an email address
    if (rawReceiver && typeof rawReceiver === 'string' && rawReceiver.includes('@') && !mongoose.Types.ObjectId.isValid(targetReceiverId)) {
      try {
        const userByEmail = await User.findOne({ email: rawReceiver.trim().toLowerCase() }).select('_id');
        if (userByEmail) {
          targetReceiverId = String(userByEmail._id);
        }
      } catch {}
    }

    // If receiverId is missing or invalid ObjectId, look up Property and resolve owner
    if ((!targetReceiverId || !mongoose.Types.ObjectId.isValid(targetReceiverId)) && propertyId) {
      if (mongoose.Types.ObjectId.isValid(propertyId)) {
        try {
          const propertyDoc = await Property.findById(propertyId).lean();
          if (propertyDoc) {
            const candidateOwner =
              propertyDoc.ownerId ||
              propertyDoc.owner ||
              propertyDoc.userId ||
              propertyDoc.landlordId ||
              propertyDoc.createdBy ||
              propertyDoc.postedBy;

            targetReceiverId = extractId(candidateOwner);

            if ((!targetReceiverId || !mongoose.Types.ObjectId.isValid(targetReceiverId)) && (propertyDoc.ownerEmail || (typeof candidateOwner === 'string' && candidateOwner.includes('@')))) {
              const ownerEmail = (propertyDoc.ownerEmail || candidateOwner).trim().toLowerCase();
              const userByEmail = await User.findOne({ email: ownerEmail }).select('_id');
              if (userByEmail) {
                targetReceiverId = String(userByEmail._id);
              }
            }

            if (!propertyTitle) {
              propertyTitle = propertyDoc.title || propertyDoc.name || '';
            }
          }
        } catch (propErr) {
          console.error('Error finding property in friend-request:', propErr);
        }
      }
    }

    if (!targetReceiverId || !mongoose.Types.ObjectId.isValid(targetReceiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Could not determine a valid property owner or receiver ID.',
        msg: 'Could not determine a valid property owner or receiver ID.'
      });
    }

    if (String(currentUserId) === String(targetReceiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend or chat request to yourself.',
        msg: 'Cannot send friend or chat request to yourself.'
      });
    }

    const receiver = await User.findById(targetReceiverId).select('_id name fullName username email');
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found on the platform.',
        msg: 'Target user not found on the platform.'
      });
    }

    // 1. Check if already connected
    const connCheck = await areUsersConnected(currentUserId, targetReceiverId);
    if (connCheck.connected) {
      return res.json({
        success: true,
        status: 'already_connected',
        connected: true,
        message: 'Already connected! Opening chat...',
        msg: 'Already connected! Opening chat...'
      });
    }

    // 2. Check if receiver already sent a pending request to current user -> auto-accept
    const reverseReq = await FriendRequest.findOne({
      senderId: targetReceiverId,
      receiverId: currentUserId,
      status: 'pending'
    });

    const io = req.app.get('io');

    if (reverseReq) {
      reverseReq.status = 'accepted';
      await reverseReq.save();

      const currentUserDoc = await User.findById(currentUserId).select('name fullName username email');
      try {
        await Notification.create({
          recipient: targetReceiverId,
          sender: currentUserId,
          type: 'friend_request_accepted',
          title: 'Friend Request Accepted',
          message: `${normalizeName(currentUserDoc)} accepted your chat request.`,
          property: propertyId && mongoose.Types.ObjectId.isValid(propertyId) ? propertyId : null,
          propertyTitle: propertyTitle || ''
        });
      } catch (notifErr) {
        console.error('Failed to create notification on auto-accept:', notifErr);
      }

      if (io) {
        io.to(`user_${targetReceiverId}`).emit('friend_request_updated', {
          requestId: reverseReq._id,
          status: 'accepted',
          partner: currentUserDoc
        });
        io.to(`user_${currentUserId}`).emit('friend_request_updated', {
          requestId: reverseReq._id,
          status: 'accepted',
          partner: receiver
        });
      }

      return res.json({
        success: true,
        status: 'already_connected',
        connected: true,
        message: 'Friend request accepted! Starting chat...',
        msg: 'Friend request accepted! Starting chat...',
        request: reverseReq
      });
    }

    // 3. Check if current user already has a pending request to this user
    let existingReq = await FriendRequest.findOne({
      senderId: currentUserId,
      receiverId: targetReceiverId
    });

    if (existingReq) {
      if (existingReq.status === 'pending') {
        return res.json({
          success: true,
          status: 'pending',
          message: 'Friend & chat request already sent!',
          msg: 'Friend & chat request already sent!',
          request: existingReq
        });
      }
      existingReq.status = 'pending';
      if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) existingReq.propertyId = propertyId;
      if (propertyTitle) existingReq.propertyTitle = propertyTitle;
      await existingReq.save();
    } else {
      existingReq = new FriendRequest({
        senderId: currentUserId,
        receiverId: targetReceiverId,
        propertyId: propertyId && mongoose.Types.ObjectId.isValid(propertyId) ? propertyId : null,
        propertyTitle: propertyTitle || '',
        status: 'pending'
      });
      await existingReq.save();
    }

    await existingReq.populate(
      'senderId',
      '_id name fullName username email role tamilRole registrationPurpose avatar phone'
    );
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      await existingReq.populate('propertyId', '_id title name location price images');
    }

    const senderUser = await User.findById(currentUserId).select('name fullName username email');
    const propSuffix = propertyTitle ? ` regarding "${propertyTitle}"` : '';
    try {
      await Notification.create({
        recipient: targetReceiverId,
        sender: currentUserId,
        type: 'friend_request_received',
        title: 'New Friend & Chat Request',
        message: `${normalizeName(senderUser)} sent you a friend request to chat${propSuffix}.`,
        property: propertyId && mongoose.Types.ObjectId.isValid(propertyId) ? propertyId : null,
        propertyTitle: propertyTitle || ''
      });
    } catch (notifErr) {
      console.error('Failed to create notification on request send:', notifErr);
    }

    if (io) {
      io.to(`user_${targetReceiverId}`).emit('friend_request_received', existingReq);
    }

    return res.status(201).json({
      success: true,
      status: 'pending',
      message: 'Friend & chat request sent!',
      msg: 'Friend & chat request sent!',
      request: existingReq
    });
  } catch (err) {
    console.error('Error sending friend request:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Server error sending friend request',
      msg: err?.message || 'Server error sending friend request'
    });
  }
});

/**
 * Handle responding to a friend request (supports both /:id/respond and /:requestId/respond)
 */
const handleRespond = async (req, res) => {
  try {
    const currentUserId = req.currentUserId;
    const reqId = req.params.id || req.params.requestId;
    const { action } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ msg: 'Action must be accept or reject' });
    }

    const request = await FriendRequest.findOne({
      _id: reqId,
      receiverId: currentUserId,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({ msg: 'Pending request not found' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    request.status = newStatus;
    await request.save();

    const io = req.app.get('io');
    const currentUserDoc = await User.findById(currentUserId).select('name fullName username email');

    if (action === 'accept') {
      try {
        await Notification.create({
          recipient: request.senderId,
          sender: currentUserId,
          type: 'friend_request_accepted',
          title: 'Friend Request Accepted',
          message: `${normalizeName(currentUserDoc)} accepted your friend request. You can now chat!`,
          property: request.propertyId || null,
          propertyTitle: request.propertyTitle || ''
        });
      } catch (notifErr) {
        console.error('Failed to create notification on accept:', notifErr);
      }
    }

    if (io) {
      io.to(`user_${request.senderId}`).emit('friend_request_updated', {
        requestId: request._id,
        status: newStatus,
        partner: currentUserDoc
      });
      io.to(`user_${currentUserId}`).emit('friend_request_updated', {
        requestId: request._id,
        status: newStatus
      });
    }

    return res.json({
      success: true,
      msg: `Friend request ${newStatus}`,
      status: newStatus,
      request
    });
  } catch (err) {
    console.error('Error responding to friend request:', err);
    return res.status(500).json({ msg: 'Server error responding to friend request' });
  }
};

router.post(['/friend-request/:id/respond', '/friend-requests/:id/respond', '/friend-request/:requestId/respond', '/friend-requests/:requestId/respond'], handleRespond);

/**
 * GET /api/messages/thread/:otherUserId
 * Fetch full chronological chat thread with otherUserId.
 */
router.get('/thread/:otherUserId', async (req, res) => {
  try {
    const currentUserId = req.currentUserId;
    const { otherUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ msg: 'Invalid user ID' });
    }

    // Mark all unread messages from otherUserId to currentUserId as read
    const updateResult = await Message.updateMany(
      { senderId: otherUserId, receiverId: currentUserId, read: false },
      { $set: { read: true } }
    );

    // If messages were marked as read, inform other user in real-time
    if (updateResult.modifiedCount > 0) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${otherUserId}`).emit('messages_read', {
          readerId: currentUserId,
          threadWith: currentUserId
        });
      }
    }

    // Fetch chronological messages
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ]
    })
      .populate('senderId', 'name fullName username email role registrationPurpose tamilRole avatar')
      .populate('receiverId', 'name fullName username email role registrationPurpose tamilRole avatar')
      .populate('propertyId', 'title name location price rent images')
      .sort({ createdAt: 1 })
      .lean();

    return res.json(messages);
  } catch (err) {
    console.error('Error fetching message thread:', err);
    return res.status(500).json({ msg: 'Server error fetching thread' });
  }
});

/**
 * POST /api/messages/send
 * Send a new real-time message to receiverId.
 */
router.post('/send', async (req, res) => {
  try {
    const currentUserId = req.currentUserId;
    const { receiverId, text, propertyId } = req.body;

    if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ msg: 'Valid receiverId is required' });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ msg: 'Message text cannot be empty' });
    }

    const receiver = await User.findById(receiverId).select('_id name fullName username email');
    if (!receiver) {
      return res.status(404).json({ msg: 'Receiver not found' });
    }

    let validPropertyId = null;
    if (propertyId && mongoose.Types.ObjectId.isValid(propertyId)) {
      validPropertyId = propertyId;
    }

    const newMessage = new Message({
      senderId: currentUserId,
      receiverId,
      propertyId: validPropertyId,
      text: text.trim(),
      read: false
    });

    await newMessage.save();

    await newMessage.populate('senderId', 'name fullName username email role registrationPurpose tamilRole avatar');
    await newMessage.populate('receiverId', 'name fullName username email role registrationPurpose tamilRole avatar');
    if (validPropertyId) {
      await newMessage.populate('propertyId', 'title name location price rent images');
    }

    // Emit real-time message to receiver and sender socket rooms
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('receive_message', newMessage);
      io.to(`user_${currentUserId}`).emit('receive_message', newMessage);
    }

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error('Error sending message:', err);
    return res.status(500).json({ msg: 'Server error sending message' });
  }
});

module.exports = router;

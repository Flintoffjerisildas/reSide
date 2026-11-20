const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Agreement = require('../models/Agreement');
const Property = require('../models/Property');
const Request = require('../models/Request');
const Notification = require('../models/Notification');
const User = require('../models/User');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (e) {}

/**
 * Upsert agreement document in MongoDB on upload.
 * Accepts both multipart/form-data and JSON payloads.
 * Automatically resolves property, rental/request, owner, and tenant relations.
 * Stores BOTH propertyId and rentalId on the Agreement and updates the Rental document.
 */
async function upsertAgreementDocument(params) {
  const {
    targetId: rawTargetId,
    file,
    body = {},
    user,
    io,
  } = params;

  // Resolve targetId from multiple possible places
  const targetId = String(
    rawTargetId ||
    body.canonicalPropertyId ||
    body.propertyId ||
    body.rentalId ||
    body.id ||
    body._id ||
    ''
  ).trim();

  // Resolve file details from body or multipart file
  let fileName = body.fileName || body.name || (file && (file.originalname || file.filename)) || 'agreement.pdf';
  let fileType = body.fileType || body.type || (file && file.mimetype) || 'application/pdf';
  let fileSizeLabel = body.fileSizeLabel || (file && file.size ? `${Math.round(file.size / 1024)} KB` : '340 KB');
  let fileUrl = body.fileUrl || (file && file.filename ? `/uploads/${file.filename}` : '');
  let fileDataUrl = body.fileDataUrl || body.data || '';

  // If a physical file was uploaded via multer and no base64 was provided, build data URL or read file
  if (!fileDataUrl && file && file.path && fs.existsSync(file.path)) {
    try {
      const buffer = fs.readFileSync(file.path);
      fileDataUrl = `data:${fileType};base64,${buffer.toString('base64')}`;
    } catch (err) {
      console.warn('Could not read uploaded file to base64:', err?.message);
    }
  } else if (!fileDataUrl && file && file.buffer) {
    fileDataUrl = `data:${fileType};base64,${file.buffer.toString('base64')}`;
  }

  // Look up property and rental/request
  let propertyDoc = null;
  let rentalDoc = null;

  const candidateIds = [
    targetId,
    body.rentalId,
    body.propertyId,
    body.canonicalPropertyId,
    body.id,
    body._id
  ].filter(id => id && mongoose.Types.ObjectId.isValid(String(id)));

  // Check if candidate matches a Property directly
  for (const cid of candidateIds) {
    propertyDoc = await Property.findById(cid).populate('owner').populate('tenant');
    if (propertyDoc) break;
  }

  // Check if candidate matches a Rental / Request document
  for (const cid of candidateIds) {
    rentalDoc = await Request.findById(cid).populate('property').populate('owner').populate('tenant');
    if (rentalDoc) {
      if (!propertyDoc && rentalDoc.property) {
        propertyDoc = rentalDoc.property;
      }
      break;
    }
  }

  // If propertyDoc was found but rentalDoc was not, look up the rental request for this property
  if (propertyDoc && !rentalDoc) {
    rentalDoc = await Request.findOne({
      property: propertyDoc._id,
      type: 'rent'
    }).populate('owner').populate('tenant').sort({ updatedAt: -1 });
  }

  const truePropertyId = propertyDoc?._id || rentalDoc?.property?._id || rentalDoc?.property || body.propertyId || targetId;
  const rentalId = rentalDoc?._id || body.rentalId || (String(targetId) !== String(truePropertyId) ? targetId : '');

  // Determine Owner and Tenant
  let ownerId = propertyDoc?.owner?._id || propertyDoc?.owner || rentalDoc?.owner?._id || rentalDoc?.owner || body.ownerId;
  let tenantId = user?.id || body.tenantId || propertyDoc?.tenant?._id || propertyDoc?.tenant || rentalDoc?.tenant?._id || rentalDoc?.tenant;
  let ownerName = body.ownerName || propertyDoc?.owner?.name || rentalDoc?.owner?.name || '';
  let tenantName = body.tenantName || (user ? user.name : '') || propertyDoc?.tenant?.name || rentalDoc?.tenant?.name || '';
  let propertyTitle = body.propertyTitle || propertyDoc?.title || '';
  let propertyLocation = body.propertyLocation || propertyDoc?.location || '';
  let rentAmount = Number(body.rentAmount || propertyDoc?.price || rentalDoc?.agreedAmount || rentalDoc?.offerAmount || 0);

  // If ownerId is missing and user is not owner, look up property's owner
  if (!ownerName && ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
    const ownerUser = await User.findById(ownerId).select('name email');
    if (ownerUser) ownerName = ownerUser.name;
  }
  if (!tenantName && tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
    const tenantUser = await User.findById(tenantId).select('name email');
    if (tenantUser) tenantName = tenantUser.name;
  }

  // Build query to find existing agreement
  const orConditions = [
    { propertyId: String(truePropertyId) },
    { canonicalPropertyId: String(truePropertyId) }
  ];
  if (rentalId) {
    orConditions.push({ rentalId: String(rentalId) });
    orConditions.push({ canonicalPropertyId: String(rentalId) });
  }
  if (targetId) {
    orConditions.push({ canonicalPropertyId: String(targetId) });
    orConditions.push({ rentalId: String(targetId) });
  }
  if (mongoose.Types.ObjectId.isValid(truePropertyId)) {
    orConditions.push({ property: truePropertyId });
  }
  if (mongoose.Types.ObjectId.isValid(targetId)) {
    orConditions.push({ _id: targetId });
    orConditions.push({ property: targetId });
  }
  if (rentalDoc?.agreement) {
    orConditions.push({ _id: rentalDoc.agreement });
  }

  const query = { $or: orConditions };

  const setFields = {
    canonicalPropertyId: String(truePropertyId || targetId),
    propertyId: String(truePropertyId || targetId),
    rentalId: String(rentalId || targetId || ''),
    fileName,
    fileType,
    fileSizeLabel,
    fileDataUrl,
    fileUrl,
    status: 'PENDING',
    verificationStatus: 'PENDING',
    ownerMessage: '',
    ownerNote: '',
    uploadedAt: new Date().toLocaleString(),
    updatedAt: new Date(),
  };

  if (mongoose.Types.ObjectId.isValid(truePropertyId)) setFields.property = truePropertyId;
  if (ownerId) setFields.owner = ownerId;
  if (tenantId) setFields.tenant = tenantId;
  if (tenantName) setFields.tenantName = tenantName;
  if (ownerName) setFields.ownerName = ownerName;
  if (propertyTitle) setFields.propertyTitle = propertyTitle;
  if (propertyLocation) setFields.propertyLocation = propertyLocation;
  if (rentAmount) setFields.rentAmount = rentAmount;

  const updateOp = {
    $set: setFields,
  };

  if (fileName && (fileDataUrl || fileUrl)) {
    updateOp.$push = {
      documents: {
        name: fileName,
        data: fileDataUrl || fileUrl || fileName,
        uploadedAt: new Date(),
      }
    };
  }

  let savedAgreement = await Agreement.findOneAndUpdate(
    query,
    updateOp,
    { new: true, upsert: true }
  );

  // Also update Rental/Request document with agreement file details
  if (rentalDoc) {
    rentalDoc.agreementDocument = fileDataUrl || fileUrl || fileName;
    rentalDoc.signedAgreementUrl = fileDataUrl || fileUrl || fileName;
    rentalDoc.agreementFile = fileDataUrl || fileUrl || fileName;
    rentalDoc.agreement = savedAgreement._id;
    await rentalDoc.save().catch(e => console.warn('Could not update rentalDoc:', e.message));
  }

  // Also update Property document with agreement file details
  if (propertyDoc) {
    propertyDoc.agreementDocument = fileDataUrl || fileUrl || fileName;
    propertyDoc.signedAgreementUrl = fileDataUrl || fileUrl || fileName;
    propertyDoc.agreementFile = fileDataUrl || fileUrl || fileName;
    propertyDoc.currentAgreementId = savedAgreement._id;
    await propertyDoc.save().catch(e => console.warn('Could not update propertyDoc:', e.message));
  }

  if (savedAgreement && typeof savedAgreement.populate === 'function') {
    try {
      savedAgreement = await savedAgreement.populate([
        { path: 'property' },
        { path: 'owner', select: 'name email phone' },
        { path: 'tenant', select: 'name email phone' },
      ]);
    } catch (e) {}
  }

  // Create notification for owner with propertyId and propertyTitle
  let notification = null;
  const targetRecipient = savedAgreement.owner?._id || savedAgreement.owner || propertyDoc?.owner?._id || propertyDoc?.owner || rentalDoc?.owner?._id || rentalDoc?.owner || ownerId;
  if (targetRecipient) {
    try {
      const propTitle = propertyTitle || propertyDoc?.title || 'your rental property';
      notification = await Notification.create({
        recipient: targetRecipient,
        sender: savedAgreement.tenant?._id || savedAgreement.tenant || user?.id || targetRecipient,
        type: 'AGREEMENT_UPLOADED',
        title: 'Agreement Document Uploaded',
        message: `A new agreement document (${fileName}) was uploaded for ${propTitle}.`,
        property: mongoose.Types.ObjectId.isValid(truePropertyId) ? truePropertyId : undefined,
        propertyId: String(truePropertyId),
        propertyTitle: propTitle,
        request: rentalDoc?._id || undefined,
        actionUrl: `/dashboard?tab=properties&section=owned&propId=${truePropertyId}&subSection=agreements`,
      });
    } catch (err) {
      console.warn('Failed to create notification on agreement upload:', err?.message);
    }
  }

  // Socket.IO real-time broadcast
  const broadcastPayload = savedAgreement.toObject ? savedAgreement.toObject() : { ...savedAgreement };
  broadcastPayload.propertyId = String(truePropertyId || savedAgreement.propertyId || savedAgreement.property?._id || '');

  if (io) {
    try {
      io.emit('agreement:synced', broadcastPayload);
      io.emit('agreement:upload', broadcastPayload);
      if (notification) {
        io.emit('notification:new', notification);
      }
    } catch (err) {
      console.warn('Socket emit error on agreement upload:', err?.message);
    }
  }

  return broadcastPayload;
}

/**
 * Verify / Accept / Reject an agreement in MongoDB.
 */
async function verifyAgreementDocument(params) {
  const {
    targetId: rawTargetId,
    propertyId: rawPropertyId,
    status = 'APPROVED',
    ownerNote = '',
    ownerMessage = '',
    reviewedAt,
    user,
    io,
  } = params;

  const targetId = String(rawTargetId || '').trim();
  const propertyId = String(rawPropertyId || params.body?.propertyId || '').trim();
  const normalizedStatus = String(status || 'APPROVED').toUpperCase();
  const finalNote = ownerNote || ownerMessage || '';
  const finalReviewedAt = reviewedAt || new Date().toLocaleString();

  if (!targetId && !propertyId) {
    throw new Error('Agreement ID or Property ID is required for verification');
  }

  // Look up agreement strictly
  let savedAgreement = null;
  if (mongoose.Types.ObjectId.isValid(targetId)) {
    savedAgreement = await Agreement.findById(targetId);
  }
  if (!savedAgreement && propertyId) {
    const pConditions = [
      { propertyId },
      { canonicalPropertyId: propertyId }
    ];
    if (mongoose.Types.ObjectId.isValid(propertyId)) {
      pConditions.push({ property: new mongoose.Types.ObjectId(propertyId) });
    }
    savedAgreement = await Agreement.findOne({ $or: pConditions });
  }

  if (!savedAgreement) {
    throw new Error('No agreement found for the specified property');
  }

  // Strict property isolation: ensure agreement belongs to the requested property
  const existingPropId = String(
    savedAgreement.propertyId ||
    savedAgreement.canonicalPropertyId ||
    savedAgreement.property?._id ||
    savedAgreement.property ||
    ''
  );
  if (propertyId && existingPropId && existingPropId !== propertyId) {
    throw new Error('Agreement does not belong to the specified property');
  }

  savedAgreement.status = normalizedStatus;
  savedAgreement.verificationStatus = normalizedStatus;
  savedAgreement.ownerNote = finalNote;
  savedAgreement.ownerMessage = finalNote;
  savedAgreement.reviewedAt = finalReviewedAt;
  savedAgreement.updatedAt = new Date();
  if (propertyId && !savedAgreement.propertyId) {
    savedAgreement.propertyId = propertyId;
  }

  await savedAgreement.save();

  if (savedAgreement && typeof savedAgreement.populate === 'function') {
    try {
      savedAgreement = await savedAgreement.populate([
        { path: 'property' },
        { path: 'owner', select: 'name email phone' },
        { path: 'tenant', select: 'name email phone' },
      ]);
    } catch (e) {}
  }

  const effectivePropId = String(
    savedAgreement.propertyId ||
    savedAgreement.canonicalPropertyId ||
    savedAgreement.property?._id ||
    savedAgreement.property ||
    propertyId
  );

  // Update associated Request / Rental if linked
  if (effectivePropId) {
    await Request.updateMany(
      { property: effectivePropId, type: 'rent' },
      { $set: { updatedAt: new Date() } }
    ).catch(() => {});
  }

  // Create notification for tenant
  let notification = null;
  const targetRecipient = savedAgreement.tenant?._id || savedAgreement.tenant;
  if (targetRecipient) {
    try {
      const propTitle = savedAgreement.propertyTitle || savedAgreement.property?.title || 'the property';
      notification = await Notification.create({
        recipient: targetRecipient,
        sender: savedAgreement.owner?._id || savedAgreement.owner || targetRecipient,
        type: normalizedStatus === 'APPROVED' ? 'AGREEMENT_VERIFIED' : 'request_rejected',
        title: `Agreement ${normalizedStatus === 'APPROVED' ? 'Verified & Approved' : 'Rejected'}`,
        message: normalizedStatus === 'APPROVED'
          ? `Your agreement document for ${propTitle} has been verified and approved.`
          : `Your agreement document for ${propTitle} was rejected. Note: ${finalNote || 'Please contact owner.'}`,
        property: mongoose.Types.ObjectId.isValid(effectivePropId) ? effectivePropId : undefined,
        propertyId: effectivePropId,
        propertyTitle: propTitle,
        actionUrl: '/dashboard?tab=properties&section=rents',
      });
    } catch (err) {
      console.warn('Failed to create notification on agreement verify:', err?.message);
    }
  }

  const emitPayload = savedAgreement.toObject ? savedAgreement.toObject() : { ...savedAgreement };
  emitPayload.propertyId = effectivePropId;

  if (io) {
    try {
      io.emit('agreement:synced', emitPayload);
      io.emit('agreement:verify', emitPayload);
      if (notification) {
        io.emit('notification:new', notification);
      }
    } catch (err) {
      console.warn('Socket emit error on agreement verify:', err?.message);
    }
  }

  return emitPayload;
}

module.exports = {
  upsertAgreementDocument,
  verifyAgreementDocument,
};

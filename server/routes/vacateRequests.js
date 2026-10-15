const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const {
  createVacateRequest,
  getMyVacateRequests,
  cancelVacateRequest,
  getVacateRequestsForProperty,
  approveVacateRequest,
  rejectVacateRequest,
  completeVacateRequest
} = require('../controllers/vacateRequestController');

// Tenant endpoints
router.post('/', auth, createVacateRequest);
router.get('/my', auth, getMyVacateRequests);
router.delete('/:id', auth, cancelVacateRequest);

// Owner endpoints
router.get('/property/:propertyId', auth, getVacateRequestsForProperty);
router.put('/:id/approve', auth, approveVacateRequest);
router.put('/:id/reject', auth, rejectVacateRequest);
router.put('/:id/complete', auth, completeVacateRequest);

module.exports = router;


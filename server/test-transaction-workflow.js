const axios = require('axios');

const API = 'http://127.0.0.1:5000/api';

async function registerAndVerify(name, email, purpose = 'User') {
  const regRes = await axios.post(`${API}/auth/register`, {
    name,
    email,
    password: 'Password123!',
    registrationPurpose: purpose
  });
  const otp = regRes.data.devOtp;
  const verifyRes = await axios.post(`${API}/auth/verify-register-otp`, {
    email,
    otp
  });
  return {
    token: verifyRes.data.token,
    user: verifyRes.data.user
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('   RESIDE: COMPREHENSIVE BUY & RENT WORKFLOW VERIFICATION TEST   ');
  console.log('================================================================\n');

  const ts = Date.now();
  console.log('1. Setting up test users (Owner, Buyer/Tenant, Unrelated User)...');
  const owner = await registerAndVerify('Owner Alice', `owner_${ts}@example.com`, 'Owner');
  const buyer = await registerAndVerify('Buyer Bob', `buyer_${ts}@example.com`, 'Customer');
  const stranger = await registerAndVerify('Stranger Charlie', `stranger_${ts}@example.com`, 'Customer');
  console.log('   ✓ Test users registered and verified via OTP.');

  // Create Properties
  console.log('\n2. Listing properties for Sale and for Rent...');
  const salePropRes = await axios.post(
    `${API}/properties`,
    {
      title: 'Luxury Beach Villa (For Sale)',
      propertyType: 'Residential',
      location: 'Chennai, ECR',
      price: 7500000,
      transactionType: 'buy',
      description: 'Exclusive beachfront villa for purchase',
      bedrooms: 4
    },
    { headers: { 'x-auth-token': owner.token } }
  );
  const saleProperty = salePropRes.data.property || salePropRes.data;
  const salePropertyId = saleProperty._id;
  console.log(`   ✓ Sale Property created: ${salePropertyId} (Price: ₹75,00,000, type: ${saleProperty.transactionType})`);

  const rentPropRes = await axios.post(
    `${API}/properties`,
    {
      title: 'City Center Apartment (For Rent)',
      propertyType: 'Residential',
      location: 'Chennai, T Nagar',
      price: 35000,
      transactionType: 'rent',
      description: 'Spacious 2BHK for rent',
      bedrooms: 2
    },
    { headers: { 'x-auth-token': owner.token } }
  );
  const rentProperty = rentPropRes.data.property || rentPropRes.data;
  const rentPropertyId = rentProperty._id;
  console.log(`   ✓ Rent Property created: ${rentPropertyId} (Rent: ₹35,000/mo, type: ${rentProperty.transactionType})`);

  // Section 3: Validation & Authorization Checks
  console.log('\n3. Validating business rules & authorization constraints...');
  
  // Rule 3.1: Cannot request own property
  try {
    await axios.post(
      `${API}/requests`,
      { propertyId: salePropertyId, type: 'buy', offerAmount: 7000000 },
      { headers: { 'x-auth-token': owner.token } }
    );
    throw new Error('FAILED: Owner was allowed to submit request for own property!');
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data.msg.includes('own property')) {
      console.log('   ✓ Blocked owner from requesting own property (400 Bad Request)');
    } else {
      throw err;
    }
  }

  // Rule 3.2: Cannot submit Buy request on Rental property
  try {
    await axios.post(
      `${API}/requests`,
      { propertyId: rentPropertyId, type: 'buy', offerAmount: 5000000 },
      { headers: { 'x-auth-token': buyer.token } }
    );
    throw new Error('FAILED: Buy request was accepted for a rental-only property!');
  } catch (err) {
    if (err.response && err.response.status === 400 && (err.response.data.msg.includes('rent only') || err.response.data.msg.includes('only available for rent'))) {
      console.log('   ✓ Blocked Buy request on Rental property (400 Bad Request)');
    } else {
      throw err;
    }
  }

  // Rule 3.3: Cannot submit Rent request on Sale property
  try {
    await axios.post(
      `${API}/requests`,
      { propertyId: salePropertyId, type: 'rent' },
      { headers: { 'x-auth-token': buyer.token } }
    );
    throw new Error('FAILED: Rent request was accepted for a sale-only property!');
  } catch (err) {
    if (err.response && err.response.status === 400 && (err.response.data.msg.includes('sale only') || err.response.data.msg.includes('only available for purchase'))) {
      console.log('   ✓ Blocked Rent request on Sale property (400 Bad Request)');
    } else {
      throw err;
    }
  }

  // Section 4: Full Purchase Transaction Lifecycle
  console.log('\n4. Executing Complete Purchase Transaction Workflow...');

  // Step 4.1: Buyer submits valid Purchase Inquiry & Offer
  console.log('   Submitting purchase inquiry with initial offer ₹72,00,000...');
  const buyReqRes = await axios.post(
    `${API}/requests`,
    {
      propertyId: salePropertyId,
      type: 'buy',
      offerAmount: 7200000,
      message: 'Very interested in purchasing this villa, offering ₹72 Lakhs.'
    },
    { headers: { 'x-auth-token': buyer.token } }
  );
  const purchaseRequest = buyReqRes.data?.request || buyReqRes.data;
  const purchaseRequestId = purchaseRequest._id;
  console.log(`   ✓ Purchase request created: ${purchaseRequestId}, Status: ${purchaseRequest.status}, Offer: ₹${purchaseRequest.offerAmount}`);

  // Step 4.2: Duplicate submission prevention
  try {
    await axios.post(
      `${API}/requests`,
      { propertyId: salePropertyId, type: 'buy', offerAmount: 7100000 },
      { headers: { 'x-auth-token': buyer.token } }
    );
    throw new Error('FAILED: Duplicate active request was permitted!');
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data.msg.includes('already have an active request')) {
      console.log('   ✓ Duplicate active request prevented (400 Bad Request)');
    } else {
      throw err;
    }
  }

  // Step 4.3: Owner receives actionable notification
  console.log('   Checking owner notifications...');
  const ownerNotifRes = await axios.get(`${API}/notifications`, {
    headers: { 'x-auth-token': owner.token }
  });
  const ownerNotifs = ownerNotifRes.data.notifications;
  const newReqNotif = ownerNotifs.find(n => n.type === 'new_request' && n.transactionType === 'buy');
  if (!newReqNotif) {
    throw new Error('FAILED: Owner did not receive new_request notification for purchase inquiry!');
  }
  console.log(`   ✓ Owner received notification: "${newReqNotif.title}" (Unread count: ${ownerNotifRes.data.unreadCount})`);

  // Step 4.4: Unauthorized stranger attempts to manage request
  try {
    await axios.put(
      `${API}/requests/${purchaseRequestId}/counteroffer`,
      { counterOfferAmount: 7400000 },
      { headers: { 'x-auth-token': stranger.token } }
    );
    throw new Error('FAILED: Stranger was allowed to counteroffer on another users property!');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 404)) {
      console.log('   ✓ Blocked unauthorized user from managing request (403 Forbidden)');
    } else {
      throw err;
    }
  }

  // Step 4.5: Owner submits counteroffer
  console.log('   Owner sends counteroffer of ₹73,50,000 with note...');
  const counterRes = await axios.put(
    `${API}/requests/${purchaseRequestId}/counteroffer`,
    {
      counterOfferAmount: 7350000,
      note: 'Lowest acceptable price considering recent renovations.'
    },
    { headers: { 'x-auth-token': owner.token } }
  );
  const counterReq = counterRes.data?.request || counterRes.data;
  console.log(`   ✓ Counteroffer submitted. Status: ${counterReq.status}, Amount: ₹${counterReq.counterOfferAmount}`);

  // Step 4.6: Buyer receives counteroffer notification
  const buyerNotifRes = await axios.get(`${API}/notifications`, {
    headers: { 'x-auth-token': buyer.token }
  });
  const counterNotif = buyerNotifRes.data.notifications.find(n => n.type === 'counteroffer_received');
  if (!counterNotif) {
    throw new Error('FAILED: Buyer did not receive counteroffer_received notification!');
  }
  console.log(`   ✓ Buyer received notification: "${counterNotif.title}"`);

  // Step 4.7: Buyer accepts counteroffer
  console.log('   Buyer accepts counteroffer...');
  const acceptCounterRes = await axios.put(
    `${API}/requests/${purchaseRequestId}/accept-counter`,
    {},
    { headers: { 'x-auth-token': buyer.token } }
  );
  const acceptCounterReq = acceptCounterRes.data?.request || acceptCounterRes.data;
  console.log(`   ✓ Counteroffer accepted. Status: ${acceptCounterReq.status}, Agreed Amount: ₹${acceptCounterReq.agreedAmount}`);
  if (acceptCounterReq.status !== 'accepted') {
    throw new Error(`Expected status 'accepted', got '${acceptCounterReq.status}'`);
  }

  // Verify property is under contract but NOT sold and NOT fully paid yet
  const propCheck1 = await axios.get(`${API}/properties/${salePropertyId}`);
  const prop1 = propCheck1.data.property || propCheck1.data;
  if (prop1.saleStatus !== 'under_contract') {
    throw new Error(`Expected saleStatus 'under_contract', got '${prop1.saleStatus}'`);
  }
  console.log(`   ✓ Verified property status: saleStatus is 'under_contract' (NOT prematurely sold)`);

  // Step 4.8: Terms Confirmation by both parties
  console.log('   Buyer confirms terms...');
  const buyerTermsRes = await axios.put(
    `${API}/requests/${purchaseRequestId}/confirm-terms`,
    { terms: '10% token advance via RTGS, balance 90% at registration within 45 days.' },
    { headers: { 'x-auth-token': buyer.token } }
  );
  const buyerTermsReq = buyerTermsRes.data?.request || buyerTermsRes.data;
  console.log(`   ✓ Buyer confirmed terms. Status: ${buyerTermsReq.status}, Buyer Confirmed: ${buyerTermsReq.termsConfirmedByBuyer}, Owner Confirmed: ${buyerTermsReq.termsConfirmedByOwner}`);

  console.log('   Owner confirms terms...');
  const ownerTermsRes = await axios.put(
    `${API}/requests/${purchaseRequestId}/confirm-terms`,
    {},
    { headers: { 'x-auth-token': owner.token } }
  );
  const ownerTermsReq = ownerTermsRes.data?.request || ownerTermsRes.data;
  console.log(`   ✓ Both parties confirmed terms! Status advanced to: ${ownerTermsReq.status}`);
  if (ownerTermsReq.status !== 'terms_confirmed') {
    throw new Error(`Expected status 'terms_confirmed', got '${ownerTermsReq.status}'`);
  }

  // Step 4.9: Buyer submits payment proof
  console.log('   Buyer submits advance token payment of ₹7,35,000 (10%)...');
  const paymentRes = await axios.put(
    `${API}/requests/${purchaseRequestId}/payment`,
    {
      amount: 735000,
      mode: 'bank_transfer',
      transactionId: `TXN-HDFC-${ts}`,
      screenshot: 'https://example.com/payment_proof.jpg'
    },
    { headers: { 'x-auth-token': buyer.token } }
  );
  const paymentReq = paymentRes.data?.request || paymentRes.data;
  console.log(`   ✓ Payment proof submitted. Request status: ${paymentReq.status}`);
  if (paymentReq.status !== 'payment_pending') {
    throw new Error(`Expected status 'payment_pending', got '${paymentReq.status}'`);
  }

  // Step 4.10: Owner verifies payment on backend
  console.log('   Owner verifies and approves payment...');
  const verifyPayRes = await axios.put(
    `${API}/requests/${purchaseRequestId}/verify-payment`,
    { notes: 'Advance received and verified in HDFC account.' },
    { headers: { 'x-auth-token': owner.token } }
  );
  const completedReq = verifyPayRes.data?.request || verifyPayRes.data;
  console.log(`   ✓ Payment verified! Status: ${completedReq.status}, Receipt: ${completedReq.paymentDetails?.receiptNumber}`);
  if (completedReq.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${completedReq.status}'`);
  }
  if (!completedReq.paymentDetails?.receiptNumber) {
    throw new Error('FAILED: Receipt number was not generated!');
  }

  // Step 4.11: Verify property is now officially sold and OWNERSHIP TRANSFERRED to Buyer
  const propCheck2 = await axios.get(`${API}/properties/${salePropertyId}`);
  const prop2 = propCheck2.data.property || propCheck2.data;
  const buyerIdStr = String(buyer.user.id || buyer.user._id);
  const ownerIdStr = String(owner.user.id || owner.user._id);
  const propOwnerIdStr = String(prop2.owner?._id || prop2.owner);
  const propPrevOwnerIdStr = String(prop2.previousOwner?._id || prop2.previousOwner);

  console.log(`   ✓ Property final status: saleStatus=${prop2.saleStatus}, buyer=${prop2.buyer?.name || prop2.buyer}, finalPrice=₹${prop2.finalPrice}`);
  console.log(`   ✓ Transferred Owner: ${propOwnerIdStr} (Buyer: ${buyerIdStr})`);
  console.log(`   ✓ Previous Owner Recorded: ${propPrevOwnerIdStr} (Seller: ${ownerIdStr})`);

  if (prop2.saleStatus !== 'sold') {
    throw new Error(`Expected saleStatus 'sold', got '${prop2.saleStatus}'`);
  }
  if (propOwnerIdStr !== buyerIdStr) {
    throw new Error(`FAILED: Property owner was NOT transferred to buyer! Expected ${buyerIdStr}, got ${propOwnerIdStr}`);
  }
  if (propPrevOwnerIdStr !== ownerIdStr) {
    throw new Error(`FAILED: Previous owner was NOT properly recorded! Expected ${ownerIdStr}, got ${propPrevOwnerIdStr}`);
  }

  // Step 4.12: Verify GET /api/properties/my for both buyer and previous owner
  const buyerMyPropsRes = await axios.get(`${API}/properties/my`, { headers: { 'x-auth-token': buyer.token } });
  const buyerHasProp = buyerMyPropsRes.data.some((p) => String(p._id || p.id) === String(salePropertyId));
  if (!buyerHasProp) {
    throw new Error('FAILED: Purchased property does NOT appear in Buyer’s My Properties list!');
  }
  console.log(`   ✓ Verified: Property appears in Buyer’s My Properties list (${buyerMyPropsRes.data.length} total)`);

  const ownerMyPropsRes = await axios.get(`${API}/properties/my`, { headers: { 'x-auth-token': owner.token } });
  const ownerStillHasProp = ownerMyPropsRes.data.some((p) => String(p._id || p.id) === String(salePropertyId));
  if (ownerStillHasProp) {
    throw new Error('FAILED: Sold property STILL appears in Seller’s active My Properties list!');
  }
  console.log(`   ✓ Verified: Property NO LONGER appears in Seller’s My Properties list (${ownerMyPropsRes.data.length} total)`);

  const ownerSoldHistoryRes = await axios.get(`${API}/properties/sold-history`, { headers: { 'x-auth-token': owner.token } });
  const inSoldHistory = ownerSoldHistoryRes.data.some((p) => String(p._id || p.id) === String(salePropertyId));
  if (!inSoldHistory) {
    throw new Error('FAILED: Sold property missing from Seller’s sold history!');
  }
  console.log(`   ✓ Verified: Property appears in Seller’s Sold History list (${ownerSoldHistoryRes.data.length} total)`);

  // Section 5: Rental Workflow (Preservation & Non-Regression)
  console.log('\n5. Executing Rental Workflow (Regression & Compatibility Test)...');
  console.log('   Buyer/Tenant submits rental application for City Center Apartment...');
  const rentReqRes = await axios.post(
    `${API}/requests`,
    {
      propertyId: rentPropertyId,
      type: 'rent',
      message: 'Looking for 11 months lease starting next month.'
    },
    { headers: { 'x-auth-token': buyer.token } }
  );
  const rentReq = rentReqRes.data?.request || rentReqRes.data;
  const rentRequestId = rentReq._id;
  console.log(`   ✓ Rental request created: ${rentRequestId}, Status: ${rentReq.status}`);

  console.log('   Owner accepts rental application...');
  const rentApproveRes = await axios.put(
    `${API}/requests/${rentRequestId}/approve`,
    {},
    { headers: { 'x-auth-token': owner.token } }
  );
  const rentApproveReq = rentApproveRes.data?.request || rentApproveRes.data;
  console.log(`   ✓ Rental request approved! Status: ${rentApproveReq.status}`);

  const rentPropCheck = await axios.get(`${API}/properties/${rentPropertyId}`);
  const rentProp = rentPropCheck.data.property || rentPropCheck.data;
  console.log(`   ✓ Rental property occupancyStatus: ${rentProp.occupancyStatus}`);
  if (rentProp.occupancyStatus !== 'occupied') {
    throw new Error(`Expected rental property occupancyStatus 'occupied', got '${rentProp.occupancyStatus}'`);
  }

  // Section 6: Notification Read State Management
  console.log('\n6. Testing Notification read/unread management...');
  const notifsBefore = await axios.get(`${API}/notifications`, {
    headers: { 'x-auth-token': buyer.token }
  });
  console.log(`   Buyer has ${notifsBefore.data.unreadCount} unread notifications.`);
  if (notifsBefore.data.notifications.length > 0) {
    const firstNotifId = notifsBefore.data.notifications[0]._id;
    await axios.put(`${API}/notifications/${firstNotifId}/read`, {}, {
      headers: { 'x-auth-token': buyer.token }
    });
    console.log(`   ✓ Marked single notification read.`);

    await axios.put(`${API}/notifications/read-all`, {}, {
      headers: { 'x-auth-token': buyer.token }
    });
    const notifsAfter = await axios.get(`${API}/notifications`, {
      headers: { 'x-auth-token': buyer.token }
    });
    console.log(`   ✓ Marked all read. Unread count is now: ${notifsAfter.data.unreadCount}`);
    if (notifsAfter.data.unreadCount !== 0) {
      throw new Error(`Expected unreadCount 0, got ${notifsAfter.data.unreadCount}`);
    }
  }

  console.log('\n================================================================');
  console.log('   ✓ ALL TESTS PASSED SUCCESSFULLY! BUY & RENT FULLY VERIFIED   ');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err?.response?.data || err.message);
  process.exit(1);
});

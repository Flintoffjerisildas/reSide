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
  console.log('   RESIDE: SIMPLIFIED BUY & RENT TRANSACTION WORKFLOW TEST      ');
  console.log('   Customer Request -> Owner Accept -> Payment -> Verify        ');
  console.log('================================================================\n');

  const ts = Date.now();
  console.log('1. Setting up test users...');
  const owner = await registerAndVerify('Owner Alice', `owner_${ts}@example.com`, 'Owner');
  const buyer1 = await registerAndVerify('Buyer Bob', `buyer1_${ts}@example.com`, 'Customer');
  const buyer2 = await registerAndVerify('Buyer Charlie', `buyer2_${ts}@example.com`, 'Customer');
  const tenant1 = await registerAndVerify('Tenant David', `tenant1_${ts}@example.com`, 'Customer');
  const tenant2 = await registerAndVerify('Tenant Eve', `tenant2_${ts}@example.com`, 'Customer');
  console.log('   ✓ 5 test users registered and verified via OTP.');

  // Create Properties
  console.log('\n2. Listing properties for Sale and Rent...');
  const salePropRes = await axios.post(
    `${API}/properties`,
    {
      title: 'Palm Beach Villa',
      propertyType: 'Residential',
      location: 'Chennai, ECR',
      price: 8000000,
      transactionType: 'buy',
      description: 'Luxury villa for sale',
      bedrooms: 4
    },
    { headers: { 'x-auth-token': owner.token } }
  );
  const saleProperty = salePropRes.data.property || salePropRes.data;
  const salePropertyId = saleProperty._id;
  console.log(`   ✓ Sale Property: ${salePropertyId} (Price: ₹80,00,000)`);

  const rentPropRes = await axios.post(
    `${API}/properties`,
    {
      title: 'Lakeview Heights 2BHK',
      propertyType: 'Residential',
      location: 'Chennai, Velachery',
      price: 30000,
      transactionType: 'rent',
      description: 'Modern 2BHK flat for rent',
      bedrooms: 2
    },
    { headers: { 'x-auth-token': owner.token } }
  );
  const rentProperty = rentPropRes.data.property || rentPropRes.data;
  const rentPropertyId = rentProperty._id;
  console.log(`   ✓ Rent Property: ${rentPropertyId} (Rent: ₹30,000/mo)`);

  // SECTION 3: Business rules & Duplicate Prevention
  console.log('\n3. Validating duplicate request prevention & business constraints...');

  // 3.1 Cannot request own property
  try {
    await axios.post(
      `${API}/requests`,
      { propertyId: salePropertyId, type: 'buy', offerAmount: 7500000 },
      { headers: { 'x-auth-token': owner.token } }
    );
    throw new Error('FAILED: Owner requested own property!');
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data.msg.includes('own property')) {
      console.log('   ✓ Blocked owner from requesting own property (400)');
    } else {
      throw err;
    }
  }

  // 3.2 Buyer 1 submits buy request
  const buyReq1Res = await axios.post(
    `${API}/requests`,
    {
      propertyId: salePropertyId,
      type: 'buy',
      offerAmount: 7800000,
      message: 'Initial purchase offer from Buyer 1.'
    },
    { headers: { 'x-auth-token': buyer1.token } }
  );
  const buyReq1 = buyReq1Res.data.request || buyReq1Res.data;
  const buyReq1Id = buyReq1._id;
  console.log(`   ✓ Buyer 1 submitted purchase request: ${buyReq1Id}, Status: ${buyReq1.status}`);

  // 3.3 Duplicate request by same buyer blocked
  try {
    await axios.post(
      `${API}/requests`,
      { propertyId: salePropertyId, type: 'buy', offerAmount: 7700000 },
      { headers: { 'x-auth-token': buyer1.token } }
    );
    throw new Error('FAILED: Duplicate request by same user was allowed!');
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data.msg.includes('already have an active request')) {
      console.log('   ✓ Prevented duplicate request from same buyer (400)');
    } else {
      throw err;
    }
  }

  // 3.4 Buyer 2 submits competing request on same sale property
  const buyReq2Res = await axios.post(
    `${API}/requests`,
    {
      propertyId: salePropertyId,
      type: 'buy',
      offerAmount: 7900000,
      message: 'Competing purchase offer from Buyer 2.'
    },
    { headers: { 'x-auth-token': buyer2.token } }
  );
  const buyReq2 = buyReq2Res.data.request || buyReq2Res.data;
  const buyReq2Id = buyReq2._id;
  console.log(`   ✓ Buyer 2 submitted competing purchase request: ${buyReq2Id}`);

  // SECTION 4: Concurrency Prevention on Acceptance
  console.log('\n4. Testing Owner Accept and Concurrent Request Prevention...');
  
  // Owner accepts Buyer 1's request
  const acceptReq1Res = await axios.put(
    `${API}/requests/${buyReq1Id}/accept`,
    {},
    { headers: { 'x-auth-token': owner.token } }
  );
  const acceptedBuyReq1 = acceptReq1Res.data.request || acceptReq1Res.data;
  console.log(`   ✓ Owner accepted Buyer 1 request. Status: ${acceptedBuyReq1.status}`);
  if (acceptedBuyReq1.status !== 'accepted') {
    throw new Error(`Expected status 'accepted', got '${acceptedBuyReq1.status}'`);
  }

  // Owner attempts to accept competing Buyer 2 request -> MUST FAIL with 400
  try {
    await axios.put(
      `${API}/requests/${buyReq2Id}/accept`,
      {},
      { headers: { 'x-auth-token': owner.token } }
    );
    throw new Error('FAILED: Concurrent acceptance was permitted! Overselling property!');
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data.msg.toLowerCase().includes('already') && err.response.data.msg.toLowerCase().includes('accepted')) {
      console.log('   ✓ Prevented concurrent acceptance of competing request (400)');
    } else {
      throw err;
    }
  }

  // Check Buyer 1 received notification
  const buyer1Notifs = await axios.get(`${API}/notifications`, { headers: { 'x-auth-token': buyer1.token } });
  const acceptNotif = buyer1Notifs.data.notifications.find(n => n.type === 'request_accepted');
  if (!acceptNotif) {
    throw new Error('FAILED: Buyer 1 did not receive request_accepted notification!');
  }
  console.log(`   ✓ Buyer 1 received notification: "${acceptNotif.title}" (Link: ${acceptNotif.actionUrl})`);

  // SECTION 5: Direct Payment & Verification (Simplified Purchase Flow)
  console.log('\n5. Executing Simplified Direct Payment & Verification Flow (No redundant terms step)...');

  // Buyer 1 proceeds DIRECTLY to payment from 'accepted' status
  console.log('   Buyer 1 submits advance token payment of ₹7,80,000 (10%)...');
  const payReq1Res = await axios.put(
    `${API}/requests/${buyReq1Id}/payment`,
    {
      amount: 780000,
      mode: 'bank_transfer',
      transactionId: `HDFC-UTR-${ts}`,
      screenshot: 'https://example.com/buyer1_receipt.png'
    },
    { headers: { 'x-auth-token': buyer1.token } }
  );
  const paidBuyReq1 = payReq1Res.data.request || payReq1Res.data;
  console.log(`   ✓ Payment proof submitted. Status: ${paidBuyReq1.status}`);
  if (paidBuyReq1.status !== 'payment_pending') {
    throw new Error(`Expected status 'payment_pending', got '${paidBuyReq1.status}'`);
  }

  // Duplicate payment submission prevention
  try {
    await axios.put(
      `${API}/requests/${buyReq1Id}/payment`,
      { amount: 780000, mode: 'upi', transactionId: 'DUP-123' },
      { headers: { 'x-auth-token': buyer1.token } }
    );
    throw new Error('FAILED: Duplicate payment submission was allowed while verification pending!');
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data.msg.includes('already submitted')) {
      console.log('   ✓ Duplicate payment submission prevented (400)');
    } else {
      throw err;
    }
  }

  // Owner verifies payment
  console.log('   Owner verifies and approves payment...');
  const verifyRes = await axios.put(
    `${API}/requests/${buyReq1Id}/verify-payment`,
    { notes: 'Advance token payment received and verified.' },
    { headers: { 'x-auth-token': owner.token } }
  );
  const completedBuyReq = verifyRes.data.request || verifyRes.data;
  console.log(`   ✓ Payment verified! Status: ${completedBuyReq.status}, Receipt Number: ${completedBuyReq.paymentDetails?.receiptNumber}`);
  if (completedBuyReq.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${completedBuyReq.status}'`);
  }

  // Verify ownership transferred to Buyer 1
  const soldPropRes = await axios.get(`${API}/properties/${salePropertyId}`);
  const soldProp = soldPropRes.data.property || soldPropRes.data;
  const buyer1IdStr = String(buyer1.user.id || buyer1.user._id);
  const ownerIdStr = String(owner.user.id || owner.user._id);
  const newOwnerIdStr = String(soldProp.owner?._id || soldProp.owner);

  if (soldProp.saleStatus !== 'sold') {
    throw new Error(`Expected saleStatus 'sold', got '${soldProp.saleStatus}'`);
  }
  if (newOwnerIdStr !== buyer1IdStr) {
    throw new Error(`FAILED: Ownership not transferred! Expected ${buyer1IdStr}, got ${newOwnerIdStr}`);
  }
  console.log(`   ✓ Verified: Property officially marked 'sold' and ownership transferred to Buyer 1`);

  // Verify competing request (Buyer 2) was automatically closed/rejected
  const buyReq2Check = await axios.get(`${API}/requests/${buyReq2Id}`, { headers: { 'x-auth-token': buyer2.token } });
  const buyReq2Updated = buyReq2Check.data.request || buyReq2Check.data;
  console.log(`   ✓ Competing request (Buyer 2) status automatically resolved to: ${buyReq2Updated.status}`);
  if (buyReq2Updated.status !== 'rejected') {
    throw new Error(`Expected competing request to be 'rejected', got '${buyReq2Updated.status}'`);
  }

  // SECTION 6: Rental Workflow (Accept -> Pay -> Verify -> Lease Active)
  console.log('\n6. Executing Simplified Rental Transaction Workflow...');

  // Tenant 1 submits rental application
  const rentReq1Res = await axios.post(
    `${API}/requests`,
    {
      propertyId: rentPropertyId,
      type: 'rent',
      message: '12-month lease application.'
    },
    { headers: { 'x-auth-token': tenant1.token } }
  );
  const rentReq1 = rentReq1Res.data.request || rentReq1Res.data;
  const rentReq1Id = rentReq1._id;
  console.log(`   ✓ Tenant 1 submitted rental request: ${rentReq1Id}`);

  // Owner accepts rental request
  const acceptRentRes = await axios.put(
    `${API}/requests/${rentReq1Id}/accept`,
    {},
    { headers: { 'x-auth-token': owner.token } }
  );
  const acceptedRentReq = acceptRentRes.data.request || acceptRentRes.data;
  console.log(`   ✓ Owner accepted rental request. Status: ${acceptedRentReq.status}`);
  if (acceptedRentReq.status !== 'accepted') {
    throw new Error(`Expected status 'accepted', got '${acceptedRentReq.status}'`);
  }

  // Tenant 1 submits security deposit / first month advance
  console.log('   Tenant 1 submits advance rent payment ₹30,000...');
  const payRentRes = await axios.put(
    `${API}/requests/${rentReq1Id}/payment`,
    {
      amount: 30000,
      mode: 'upi',
      transactionId: `UPI-RENT-${ts}`,
      screenshot: 'https://example.com/rent_upi.jpg'
    },
    { headers: { 'x-auth-token': tenant1.token } }
  );
  const paidRentReq = payRentRes.data.request || payRentRes.data;
  console.log(`   ✓ Rental payment submitted. Status: ${paidRentReq.status}`);
  if (paidRentReq.status !== 'payment_pending') {
    throw new Error(`Expected status 'payment_pending', got '${paidRentReq.status}'`);
  }

  // Owner verifies rental payment
  console.log('   Owner verifies rental payment...');
  const verifyRentRes = await axios.put(
    `${API}/requests/${rentReq1Id}/verify-payment`,
    { notes: 'Security deposit & first month rent verified.' },
    { headers: { 'x-auth-token': owner.token } }
  );
  const completedRentReq = verifyRentRes.data.request || verifyRentRes.data;
  console.log(`   ✓ Rental payment verified! Status: ${completedRentReq.status}, Receipt: ${completedRentReq.paymentDetails?.receiptNumber}`);
  if (completedRentReq.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${completedRentReq.status}'`);
  }

  // Verify rental property occupancy & tenancy
  const rentPropAfter = await axios.get(`${API}/properties/${rentPropertyId}`);
  const updatedRentProp = rentPropAfter.data.property || rentPropAfter.data;
  const tenant1IdStr = String(tenant1.user.id || tenant1.user._id);
  const currTenantIdStr = String(updatedRentProp.tenant?._id || updatedRentProp.tenant || updatedRentProp.currentTenantId);

  console.log(`   ✓ Rental occupancyStatus: ${updatedRentProp.occupancyStatus}, assigned tenant: ${currTenantIdStr}`);
  if (updatedRentProp.occupancyStatus !== 'occupied') {
    throw new Error(`Expected occupancyStatus 'occupied', got '${updatedRentProp.occupancyStatus}'`);
  }
  if (currTenantIdStr !== tenant1IdStr) {
    throw new Error(`Expected assigned tenant ${tenant1IdStr}, got ${currTenantIdStr}`);
  }

  // SECTION 7: Rejection Flow & Payment Disabled
  console.log('\n7. Testing Request Rejection and Payment Disablement...');
  
  // List a 2nd rental property
  const rentProp2Res = await axios.post(
    `${API}/properties`,
    {
      title: 'Green Meadows 1BHK',
      propertyType: 'Residential',
      location: 'Chennai, OMR',
      price: 18000,
      transactionType: 'rent',
      description: 'Cozy 1BHK near IT park',
      bedrooms: 1
    },
    { headers: { 'x-auth-token': owner.token } }
  );
  const rentProp2Id = (rentProp2Res.data.property || rentProp2Res.data)._id;

  // Tenant 2 submits application
  const rentReq2Res = await axios.post(
    `${API}/requests`,
    { propertyId: rentProp2Id, type: 'rent', message: 'Application from Tenant 2' },
    { headers: { 'x-auth-token': tenant2.token } }
  );
  const rentReq2Id = (rentReq2Res.data.request || rentReq2Res.data)._id;

  // Owner rejects application
  console.log('   Owner rejects Tenant 2 application...');
  const rejectRes = await axios.put(
    `${API}/requests/${rentReq2Id}/reject`,
    { reason: 'Property not available for the requested lease duration.' },
    { headers: { 'x-auth-token': owner.token } }
  );
  const rejectedReq = rejectRes.data.request || rejectRes.data;
  console.log(`   ✓ Application rejected. Status: ${rejectedReq.status}`);
  if (rejectedReq.status !== 'rejected') {
    throw new Error(`Expected status 'rejected', got '${rejectedReq.status}'`);
  }

  // Tenant 2 attempts payment on rejected request -> MUST BE BLOCKED
  try {
    await axios.put(
      `${API}/requests/${rentReq2Id}/payment`,
      { amount: 18000, mode: 'upi', transactionId: 'BLOCKED-TXN' },
      { headers: { 'x-auth-token': tenant2.token } }
    );
    throw new Error('FAILED: Payment was accepted on a rejected request!');
  } catch (err) {
    if (err.response && err.response.status === 400 && (err.response.data.msg.includes('not eligible') || err.response.data.msg.includes('only be submitted'))) {
      console.log('   ✓ Payment successfully disabled on rejected request (400)');
    } else {
      throw err;
    }
  }

  // SECTION 8: Payment Rejection & Retry Workflow
  console.log('\n8. Testing Payment Rejection and Retry Workflow...');

  // Tenant 2 submits request for rentProp2 again (it was rejected so active request is cleared)
  const retryReqRes = await axios.post(
    `${API}/requests`,
    { propertyId: rentProp2Id, type: 'rent', message: 'Revised application with 11-month lease.' },
    { headers: { 'x-auth-token': tenant2.token } }
  );
  const retryReqId = (retryReqRes.data.request || retryReqRes.data)._id;

  // Owner accepts
  await axios.put(`${API}/requests/${retryReqId}/accept`, {}, { headers: { 'x-auth-token': owner.token } });

  // Tenant submits invalid / incorrect payment
  await axios.put(
    `${API}/requests/${retryReqId}/payment`,
    { amount: 1000, mode: 'upi', transactionId: 'WRONG-AMOUNT', screenshot: 'https://example.com/fake.png' },
    { headers: { 'x-auth-token': tenant2.token } }
  );

  // Owner rejects payment
  console.log('   Owner rejects invalid payment proof...');
  const rejectPayRes = await axios.put(
    `${API}/requests/${retryReqId}/reject-payment`,
    { reason: 'Incorrect amount submitted. Please submit ₹18,000.' },
    { headers: { 'x-auth-token': owner.token } }
  );
  const revertedReq = rejectPayRes.data.request || rejectPayRes.data;
  console.log(`   ✓ Payment rejected. Status reverted to: ${revertedReq.status}`);
  if (revertedReq.status !== 'accepted') {
    throw new Error(`Expected status to revert to 'accepted', got '${revertedReq.status}'`);
  }

  // Tenant submits corrected payment
  console.log('   Tenant submits corrected payment...');
  const validPayRes = await axios.put(
    `${API}/requests/${retryReqId}/payment`,
    { amount: 18000, mode: 'upi', transactionId: 'VALID-AMOUNT-UTR', screenshot: 'https://example.com/valid.png' },
    { headers: { 'x-auth-token': tenant2.token } }
  );
  console.log(`   ✓ Corrected payment submitted. Status: ${(validPayRes.data.request || validPayRes.data).status}`);

  // Owner verifies corrected payment
  const finalVerifyRes = await axios.put(
    `${API}/requests/${retryReqId}/verify-payment`,
    { notes: 'Verified full amount.' },
    { headers: { 'x-auth-token': owner.token } }
  );
  console.log(`   ✓ Corrected payment verified! Status: ${(finalVerifyRes.data.request || finalVerifyRes.data).status}`);

  console.log('\n================================================================');
  console.log('   ✓ ALL 8 TEST SECTIONS PASSED! WORKFLOW SIMPLIFICATION FULLY  ');
  console.log('   VERIFIED ACROSS BUY AND RENT WITH COMPLETE BACKWARD SAFETY.  ');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err?.response?.data || err.message);
  process.exit(1);
});

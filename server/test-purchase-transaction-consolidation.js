const axios = require('axios');
const assert = require('assert');

const API_BASE = 'http://localhost:5000/api';

async function registerAndVerify(name, email, purpose) {
  const regRes = await axios.post(`${API_BASE}/auth/register`, {
    name,
    email,
    password: 'password123',
    tamilRole: purpose === 'Owner' ? 'owners' : 'customers',
    registrationPurpose: purpose
  });
  const otp = regRes.data.devOtp;
  const verifyRes = await axios.post(`${API_BASE}/auth/verify-register-otp`, {
    email,
    otp
  });
  return {
    token: verifyRes.data.token,
    user: verifyRes.data.user
  };
}

async function run() {
  console.log('================================================================');
  console.log('   RESIDE: PURCHASE TRANSACTION CONSOLIDATION TEST              ');
  console.log('================================================================');

  const ts = Date.now();
  const sellerEmail = `test_seller_${ts}@reside.com`;
  const buyerEmail = `test_buyer_${ts}@reside.com`;

  // 1. Register Seller & Buyer
  console.log('\n1. Setting up Test Seller and Test Buyer...');
  const seller = await registerAndVerify('Test Seller', sellerEmail, 'Owner');
  const sellerToken = seller.token;
  const sellerId = seller.user.id || seller.user._id;

  const buyer = await registerAndVerify('Test Buyer', buyerEmail, 'Customer');
  const buyerToken = buyer.token;
  const buyerId = buyer.user.id || buyer.user._id;
  console.log('   ✓ Seller and Buyer accounts registered & verified.');

  // 2. Seller lists a property for sale
  console.log('\n2. Seller creates and lists a sale property...');
  const propRes = await axios.post(`${API_BASE}/properties`, {
    title: `Luxury Villa ${ts}`,
    propertyType: 'villa',
    location: 'Anna Nagar, Chennai',
    price: 15000000,
    transactionType: 'sale',
    description: 'Spacious independent luxury villa for sale',
    bedrooms: 4,
    facing: 'East',
    status: 'Ready to Move',
    listingStatus: 'listed',
    isListed: true,
  }, { headers: { 'x-auth-token': sellerToken } });

  const propertyId = propRes.data._id || propRes.data.id;
  console.log(`   ✓ Sale property created with ID: ${propertyId}`);

  // 3. Buyer submits a purchase offer
  console.log('\n3. Buyer submits a purchase offer...');
  const reqRes = await axios.post(`${API_BASE}/requests`, {
    propertyId: propertyId,
    type: 'buy',
    proposedPrice: 14500000,
    message: 'We are ready to close with immediate token advance.',
  }, { headers: { 'x-auth-token': buyerToken } });

  const requestId = reqRes.data._id || reqRes.data.id;
  console.log(`   ✓ Purchase offer submitted with Request ID: ${requestId}`);

  // 4. Verify Buyer tracks pending offer (accessible via buyer tenantRequests / Purchase Offers)
  console.log('\n4. Verifying Buyer tracks pending offer...');
  const buyerReqs = await axios.get(`${API_BASE}/requests/tenant`, { headers: { 'x-auth-token': buyerToken } });
  const pendingBuyReq = buyerReqs.data.find(r => (r._id || r.id) === requestId);
  assert(pendingBuyReq, 'Buyer can retrieve submitted purchase offer');
  assert.strictEqual(pendingBuyReq.status, 'pending', 'Offer initial status is pending');
  console.log('   ✓ Buyer can track pending offer under Purchase Offers');

  // Verify Seller receives inquiry on owned property
  const sellerReqs = await axios.get(`${API_BASE}/requests/owner`, { headers: { 'x-auth-token': sellerToken } });
  const sellerIncoming = sellerReqs.data.find(r => (r._id || r.id) === requestId);
  assert(sellerIncoming, 'Seller receives offer in property workspace');
  assert.strictEqual(String(sellerIncoming.property._id || sellerIncoming.property), String(propertyId));
  console.log('   ✓ Seller receives inquiry in property workspace (Requests & Offers)');

  // 5. Seller accepts purchase offer
  console.log('\n5. Seller accepts purchase offer...');
  await axios.put(`${API_BASE}/requests/${requestId}/approve`, {}, { headers: { 'x-auth-token': sellerToken } });
  
  const acceptedReq = (await axios.get(`${API_BASE}/requests/tenant`, { headers: { 'x-auth-token': buyerToken } })).data.find(r => (r._id || r.id) === requestId);
  assert(['accepted', 'approved'].includes(acceptedReq.status), 'Offer status updated to accepted');
  console.log('   ✓ Offer accepted; now eligible for advance payment');

  // 6. Test payment submission (unverified does NOT mark transaction complete)
  console.log('\n6. Buyer submits advance payment; verify unverified payment does not finalize transaction...');
  await axios.put(`${API_BASE}/requests/${requestId}/payment`, {
    amount: 500000,
    mode: 'UPI',
    transactionId: `TXN-BUY-${ts}`,
  }, { headers: { 'x-auth-token': buyerToken } });

  const payPendingReq = (await axios.get(`${API_BASE}/requests/tenant`, { headers: { 'x-auth-token': buyerToken } })).data.find(r => (r._id || r.id) === requestId);
  assert.strictEqual(payPendingReq.status, 'payment_pending', 'Payment submission sets status to payment_pending');

  // Check property ownership hasn't transferred before verification
  const preVerifyProp = (await axios.get(`${API_BASE}/properties/${propertyId}`, { headers: { 'x-auth-token': buyerToken } })).data;
  assert.notStrictEqual(String(preVerifyProp.owner?._id || preVerifyProp.owner), String(buyerId), 'Ownership is NOT transferred on unverified payment');
  console.log('   ✓ Unverified payment correctly requires owner verification; ownership not yet transferred');

  // 7. Seller verifies payment -> backend transfers ownership
  console.log('\n7. Seller verifies payment; verifying ownership transfer and property categorization...');
  await axios.put(`${API_BASE}/requests/${requestId}/verify-payment`, {}, { headers: { 'x-auth-token': sellerToken } });

  const verifiedReq = (await axios.get(`${API_BASE}/requests/tenant`, { headers: { 'x-auth-token': buyerToken } })).data.find(r => (r._id || r.id) === requestId);
  assert.strictEqual(verifiedReq.status, 'completed', 'Backend marks transaction completed upon verified payment');

  // Check buyer now owns the property!
  const buyerOwned = await axios.get(`${API_BASE}/properties/my`, { headers: { 'x-auth-token': buyerToken } });
  const buyerHasProp = buyerOwned.data.find(p => (p._id || p.id) === propertyId);
  assert(buyerHasProp, 'Purchased property automatically moves into Property Owned for Buyer');
  console.log('   ✓ Backend transferred ownership! Property now appears under Property Owned for the Buyer.');

  console.log('\n================================================================');
  console.log('   ✓ ALL PURCHASE CONSOLIDATION CHECKS PASSED!                  ');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('Test execution failed:', err?.response?.data || err.message);
  process.exit(1);
});

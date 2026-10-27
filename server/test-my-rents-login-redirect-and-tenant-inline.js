const axios = require('axios');

const API = 'http://127.0.0.1:5000/api';

function assert(condition, message) {
  if (!condition) {
    console.error(`   ✗ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`   ✓ ${message}`);
}

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

async function run() {
  console.log('========================================================================');
  console.log('   RESIDE: MY RENTS AUTH PRESERVATION & TENANT INLINE MANAGEMENT TEST    ');
  console.log('========================================================================\n');

  const ts = Date.now();

  // Test Case 1: An authenticated user can click My Rents without being redirected to login
  console.log('Test 1: User with no rental records accesses My Rents without auth error...');
  const freshTenant = await registerAndVerify('Fresh Tenant', `freshtenant_${ts}@example.com`, 'Customer');
  const freshAgreements = await axios.get(`${API}/agreements/tenant`, {
    headers: { 'x-auth-token': freshTenant.token }
  });
  assert(Array.isArray(freshAgreements.data) && freshAgreements.data.length === 0, 'No rental records returned for fresh user (empty list, not an error)');
  
  // Verify token remains fully valid and authenticated
  const meCheck = await axios.get(`${API}/auth/me`, {
    headers: { 'x-auth-token': freshTenant.token }
  });
  assert(meCheck.data.email === `freshtenant_${ts}@example.com`, 'User remains fully authenticated with active session');

  // Test Case 2: Create a Landlord and Rental Property, and sign an agreement with a Tenant
  console.log('\nTest 2: Establishing Rental Relationship for Tenant...');
  const landlord = await registerAndVerify('Landlord Liam', `landlord_liam_${ts}@example.com`, 'Owner');
  const tenant = await registerAndVerify('Tenant Tara', `tenant_tara_${ts}@example.com`, 'Customer');

  const propRes = await axios.post(
    `${API}/properties`,
    {
      title: 'Ocean Breeze Apartment 2BHK',
      propertyType: 'Residential',
      location: 'Besant Nagar, Chennai',
      price: 30000,
      transactionType: 'rent',
      description: 'Stunning sea-view rental apartment',
      bedrooms: 2
    },
    { headers: { 'x-auth-token': landlord.token } }
  );
  const propertyId = (propRes.data.property || propRes.data)._id;
  assert(propertyId, `Rental property listed: ${propertyId}`);

  // Tenant applies
  const applyRes = await axios.post(
    `${API}/requests`,
    {
      propertyId,
      type: 'rent',
      proposedPrice: 30000,
      message: 'Looking for a 1-year lease'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  const requestId = applyRes.data._id;
  assert(requestId, `Tenant applied for rent: ${requestId}`);

  // Landlord accepts
  await axios.put(`${API}/requests/${requestId}/accept`, {}, { headers: { 'x-auth-token': landlord.token } });

  // Tenant submits payment
  const payRes = await axios.put(
    `${API}/requests/${requestId}/payment`,
    {
      amount: 30000,
      mode: 'upi',
      transactionId: `UPI-RENT-${Date.now()}`,
      screenshot: 'https://example.com/payment.jpg'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  assert(payRes.status === 200, 'Tenant submitted advance payment');

  // Landlord verifies payment -> generates Agreement and RentRecords
  const verifyRes = await axios.put(
    `${API}/requests/${requestId}/verify-payment`,
    { notes: 'Advance rent verified' },
    { headers: { 'x-auth-token': landlord.token } }
  );
  assert(verifyRes.status === 200, 'Advance payment verified by landlord, creating Agreement');

  // Test Case 3: Existing rental properties appear in the horizontal selector and load correctly
  console.log('\nTest 3: Existing rental properties load in My Rents for Tenant...');
  const tenantRentalsRes = await axios.get(`${API}/agreements/tenant`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(tenantRentalsRes.data.length === 1, `Tenant has exactly 1 rental property record`);
  const agreement = tenantRentalsRes.data[0];
  const rentalProp = agreement.property;
  assert((rentalProp._id || rentalProp) === propertyId, `Rental property correctly linked to: ${propertyId}`);

  // Test Case 4: Ownership and Tenancy Data Segregation
  console.log('\nTest 4: Ownership and Rental Data Segregation...');
  const tenantOwned = await axios.get(`${API}/properties/my`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(tenantOwned.data.length === 0, 'Tenant does NOT own any properties (Property Owned is empty)');

  const landlordOwned = await axios.get(`${API}/properties/my`, {
    headers: { 'x-auth-token': landlord.token }
  });
  assert(landlordOwned.data.some(p => p._id === propertyId), 'Landlord owns the property under Property Owned');

  const landlordRents = await axios.get(`${API}/agreements/tenant`, {
    headers: { 'x-auth-token': landlord.token }
  });
  assert(landlordRents.data.length === 0, 'Landlord has 0 records in My Rents (not a tenant)');

  // Test Case 5: Owner Vacate Requests query on non-owned property returns 403 Forbidden (NOT 401), preserving session
  console.log('\nTest 5: Access Control — Tenant calling owner vacate requests endpoint...');
  try {
    await axios.get(`${API}/vacate-request/property/${propertyId}`, {
      headers: { 'x-auth-token': tenant.token }
    });
    assert(false, 'Tenant should NOT be allowed to access owner vacate requests');
  } catch (err) {
    assert(err.response?.status === 403, `Backend properly returns 403 Forbidden (got ${err.response?.status}): ${err.response?.data?.msg}`);
  }

  // Verify tenant session is still intact after receiving 403
  const tenantAuthCheck = await axios.get(`${API}/auth/me`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(tenantAuthCheck.data.email === `tenant_tara_${ts}@example.com`, 'Tenant session preserved after 403 resource authorization check');

  // Test Case 6: Tenant-Specific Functionality (Rent Records, Maintenance, Vacate Notice)
  console.log('\nTest 6: Tenant Management Functionality...');
  
  // 6a. Tenant Rent Records
  const tenantRentRecords = await axios.get(`${API}/payments/tenant/records`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(Array.isArray(tenantRentRecords.data), `Tenant rent records retrieved successfully (${tenantRentRecords.data.length} records)`);

  // 6b. Tenant Maintenance Request
  const maintRes = await axios.post(
    `${API}/requests/maintenance`,
    {
      propertyId,
      property: propertyId,
      issue: 'Leaking kitchen pipe',
      description: 'Under-sink pipe has a slow drip',
      category: 'Plumbing',
      priority: 'medium'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  assert(maintRes.status === 200 || maintRes.status === 201, 'Tenant can submit maintenance requests');

  const tenantMaintList = await axios.get(`${API}/requests/maintenance/tenant`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(tenantMaintList.data.some(m => m.issue === 'Leaking kitchen pipe'), 'Submitted maintenance request appears in tenant maintenance list');

  // 6c. Tenant Vacate Notice
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 2);
  const vacateRes = await axios.post(
    `${API}/vacate-request`,
    {
      propertyId,
      requestedVacateDate: futureDate.toISOString().slice(0, 10),
      reason: 'Job transfer to another city'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  assert(vacateRes.status === 200 || vacateRes.status === 201, 'Tenant can submit formal notice to vacate');
  const vacateRequestId = vacateRes.data._id;

  const tenantVacateList = await axios.get(`${API}/vacate-request/my`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(tenantVacateList.data.some(v => v._id === vacateRequestId), 'Vacate notice appears in tenant vacate requests');

  // Test Case 7: Tenant CANNOT perform Owner-Only Actions
  console.log('\nTest 7: Security Guardrails — Tenant prohibited from owner actions...');

  // 7a. Tenant cannot update property listing status
  try {
    await axios.put(
      `${API}/properties/${propertyId}/listing-status`,
      { listingStatus: 'unlisted' },
      { headers: { 'x-auth-token': tenant.token } }
    );
    assert(false, 'Tenant must not be allowed to change property listing status');
  } catch (err) {
    assert(err.response?.status === 401 || err.response?.status === 403, `Listing status change blocked (${err.response?.status})`);
  }

  // 7b. Tenant cannot delete the property
  try {
    await axios.delete(`${API}/properties/${propertyId}`, {
      headers: { 'x-auth-token': tenant.token }
    });
    assert(false, 'Tenant must not be allowed to delete the property');
  } catch (err) {
    assert(err.response?.status === 401 || err.response?.status === 403, `Property deletion blocked (${err.response?.status})`);
  }

  // 7c. Tenant cannot approve vacate requests
  try {
    await axios.put(
      `${API}/vacate-request/${vacateRequestId}/approve`,
      {},
      { headers: { 'x-auth-token': tenant.token } }
    );
    assert(false, 'Tenant must not be allowed to approve vacate requests');
  } catch (err) {
    assert(err.response?.status === 403, `Owner vacate approval blocked for tenant (${err.response?.status})`);
  }

  // Test Case 8: Genuine missing or invalid token correctly returns 401
  console.log('\nTest 8: Genuine Authentication Failures...');
  try {
    await axios.get(`${API}/auth/me`, {
      headers: { 'x-auth-token': 'invalid.token.here' }
    });
    assert(false, 'Invalid token must be rejected');
  } catch (err) {
    assert(err.response?.status === 401, `Invalid token correctly returned 401: ${err.response?.data?.msg}`);
  }

  try {
    await axios.get(`${API}/auth/me`);
    assert(false, 'Missing token must be rejected');
  } catch (err) {
    assert(err.response?.status === 401, `Missing token correctly returned 401: ${err.response?.data?.msg}`);
  }

  console.log('\n========================================================================');
  console.log('   ALL INTEGRATION & SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY!    ');
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error('Test failed with error:', err?.response?.data || err.message || err);
  process.exit(1);
});

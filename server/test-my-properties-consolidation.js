const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
  console.log('================================================================');
  console.log('   RESIDE: MY PROPERTIES & MY RENTS CONSOLIDATION TEST          ');
  console.log('================================================================\n');

  const ts = Date.now();

  // Step 1: Users setup
  console.log('1. Setting up Test Landlord and Test Tenant...');
  const landlord = await registerAndVerify('Landlord Leo', `landlord_${ts}@example.com`, 'Owner');
  const tenant = await registerAndVerify('Tenant Tina', `tenant_${ts}@example.com`, 'Customer');
  console.log('   ✓ Landlord and Tenant accounts registered & verified.');

  // Step 2: Landlord lists a property for rent
  console.log('\n2. Landlord creates and lists a rental property...');
  const createRes = await axios.post(
    `${API}/properties`,
    {
      title: 'Green Meadows Villa 3BHK',
      propertyType: 'Residential',
      location: 'OMR, Chennai',
      price: 25000,
      transactionType: 'rent',
      description: 'Spacious 3BHK villa with garden',
      bedrooms: 3,
      furnishingStatus: 'Semi-Furnished'
    },
    { headers: { 'x-auth-token': landlord.token } }
  );
  const property = createRes.data.property || createRes.data;
  const propertyId = property._id;
  assert(propertyId, `Property created with ID: ${propertyId}`);

  // Step 3: Verify Ownership vs Tenancy before agreement
  console.log('\n3. Verifying Ownership vs Tenancy Segregation (Initial State)...');
  const landlordOwnedInitial = await axios.get(`${API}/properties/my`, {
    headers: { 'x-auth-token': landlord.token }
  });
  const landlordTenancyInitial = await axios.get(`${API}/agreements/tenant`, {
    headers: { 'x-auth-token': landlord.token }
  });
  assert(
    landlordOwnedInitial.data.some(p => p._id === propertyId),
    'Landlord owns the property and it appears under Landlord owned properties'
  );
  assert(
    !landlordTenancyInitial.data.some(a => (a.property?._id || a.property) === propertyId),
    'Landlord does NOT have the property under My Rents'
  );

  const tenantOwnedInitial = await axios.get(`${API}/properties/my`, {
    headers: { 'x-auth-token': tenant.token }
  });
  const tenantTenancyInitial = await axios.get(`${API}/agreements/tenant`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(
    !tenantOwnedInitial.data.some(p => p._id === propertyId),
    'Tenant does NOT own the property'
  );
  assert(
    !tenantTenancyInitial.data.some(a => (a.property?._id || a.property) === propertyId),
    'Tenant does NOT rent the property yet'
  );

  // Step 4: Rental Application, Approval, Advance Payment & Tenancy Agreement creation
  console.log('\n4. Executing Rental Transaction to establish Tenancy...');
  const reqRes = await axios.post(
    `${API}/requests`,
    {
      propertyId,
      type: 'rent',
      message: 'Interested in leasing this property for 1 year.'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  const rentReq = reqRes.data.request || reqRes.data;
  const requestId = rentReq._id;
  assert(requestId, `Rental application submitted: ${requestId}`);

  // Landlord accepts application
  const acceptRes = await axios.put(
    `${API}/requests/${requestId}/accept`,
    {},
    { headers: { 'x-auth-token': landlord.token } }
  );
  const acceptedReq = acceptRes.data.request || acceptRes.data;
  assert(acceptedReq.status === 'accepted', 'Landlord accepted rental application');

  // Tenant pays advance rent
  const payRes = await axios.put(
    `${API}/requests/${requestId}/payment`,
    {
      amount: 25000,
      mode: 'upi',
      transactionId: `UPI-RENT-${Date.now()}`,
      screenshot: 'https://example.com/payment.jpg'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  const paidReq = payRes.data.request || payRes.data;
  assert(paidReq.status === 'payment_pending', 'Tenant submitted advance rent payment');

  // Landlord verifies payment -> generates Agreement and RentRecords
  const verifyPayRes = await axios.put(
    `${API}/requests/${requestId}/verify-payment`,
    { notes: 'Advance rent verified' },
    { headers: { 'x-auth-token': landlord.token } }
  );
  const verifiedReq = verifyPayRes.data.request || verifyPayRes.data;
  assert(verifiedReq.status === 'completed', 'Landlord verified payment; lease completed');

  // Step 5: Verify Post-Lease Ownership vs Tenancy Records
  console.log('\n5. Verifying Segregation After Tenancy Creation...');
  const landlordOwnedAfter = await axios.get(`${API}/properties/my`, {
    headers: { 'x-auth-token': landlord.token }
  });
  const landlordTenancyAfter = await axios.get(`${API}/agreements/tenant`, {
    headers: { 'x-auth-token': landlord.token }
  });
  assert(
    landlordOwnedAfter.data.some(p => p._id === propertyId),
    'Landlord still owns the property under Property Owned'
  );
  assert(
    !landlordTenancyAfter.data.some(a => (a.property?._id || a.property) === propertyId),
    'Landlord does NOT see owned property under My Rents'
  );

  const tenantOwnedAfter = await axios.get(`${API}/properties/my`, {
    headers: { 'x-auth-token': tenant.token }
  });
  const tenantTenancyAfter = await axios.get(`${API}/agreements/tenant`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(
    !tenantOwnedAfter.data.some(p => p._id === propertyId),
    'Tenant does NOT see rented property under Property Owned'
  );
  const tenantAgreement = tenantTenancyAfter.data.find(a => (a.property?._id || a.property) === propertyId);
  assert(!!tenantAgreement, 'Tenant sees the property under My Rents (persisted Agreement)');
  assert(tenantAgreement.rentAmount === 25000, `Agreement rentAmount is ₹25,000`);

  // Step 6: Verify Tenant-Specific Actions (Rent Records, Maintenance, Vacate)
  console.log('\n6. Verifying Tenant Actions within My Rents...');
  const recordsRes = await axios.get(`${API}/payments/tenant/records`, {
    headers: { 'x-auth-token': tenant.token }
  });
  assert(Array.isArray(recordsRes.data) && recordsRes.data.length > 0, `Tenant has rent records (${recordsRes.data.length} records)`);

  // Tenant creates maintenance request
  const maintRes = await axios.post(
    `${API}/requests/maintenance`,
    {
      propertyId,
      issue: 'Plumbing leak in guest bathroom',
      description: 'Water leaking under the sink and needs repair.',
      priority: 'medium'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  assert(maintRes.data.success || maintRes.data._id || maintRes.status === 200 || maintRes.status === 201, 'Tenant can submit maintenance request');

  // Tenant submits vacate request
  const vacateDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const vacateRes = await axios.post(
    `${API}/vacate-request`,
    {
      propertyId,
      requestedVacateDate: vacateDate,
      reason: 'Job relocation to another city'
    },
    { headers: { 'x-auth-token': tenant.token } }
  );
  assert(vacateRes.status === 200 || vacateRes.status === 201, 'Tenant can submit vacate request');

  // Step 7: Static Code & Router Verification
  console.log('\n7. Verifying Frontend Navigation and Routing Consolidation...');
  const userDashboardFile = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/UserDashboard.tsx'), 'utf8');
  const routerFile = fs.readFileSync(path.resolve(__dirname, '../frontend/src/router.tsx'), 'utf8');

  // Verification 7.1: Standalone rentals tab trigger removed from UserDashboard TabsList
  // Verification 7.1: Standalone tab triggers removed from UserDashboard TabsList
  assert(
    !userDashboardFile.includes('<TabsTrigger value="rentals"') &&
    !userDashboardFile.includes('<TabsTrigger value="my-requests"') &&
    !userDashboardFile.includes('<TabsTrigger value="incoming-requests"') &&
    !userDashboardFile.includes('<TabsTrigger value="transactions"'),
    'Standalone navigation triggers (my-requests, incoming-requests, transactions, rentals) successfully removed from navigation bar'
  );

  // Verification 7.2: TabsList grid columns consolidated to 5 destinations
  assert(
    userDashboardFile.includes('grid-cols-5'),
    'UserDashboard TabsList consolidated to 5 clean destinations (overview, properties, notifications, reports, settings)'
  );

  // Verification 7.3: Property Owned and My Rents section switcher buttons exist (Purchase Offers removed)
  assert(
    userDashboardFile.includes('id="tab-property-owned"') &&
    userDashboardFile.includes('id="tab-my-rents"') &&
    !userDashboardFile.includes('id="tab-purchase-offers"'),
    'Section switcher buttons (Property Owned and My Rents) are implemented in My Properties (Purchase Offers removed)'
  );

  // Verification 7.4: Owned and Rents sections render inline PropertyFullScreenView workspace
  assert(
    userDashboardFile.includes('propertySection === \'owned\' ? (') &&
    userDashboardFile.includes('isTenantView={false}') &&
    userDashboardFile.includes('isTenantView={true}'),
    'My Properties renders inline PropertyFullScreenView workspace for owned and rents'
  );

  // Verification 7.5: Embedded Transaction Journey & Timeline panel in PropertyFullScreenView
  const propertyFullScreenViewFile = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/PropertyFullScreenView.tsx'), 'utf8');
  assert(
    propertyFullScreenViewFile.includes('activeTx') &&
    propertyFullScreenViewFile.includes('getTimelineStages') &&
    propertyFullScreenViewFile.includes('getStatusBadge'),
    'PropertyFullScreenView embeds full persistent transaction timeline and status lifecycle'
  );

  // Verification 7.6: Router backward compatibility
  assert(
    routerFile.includes("const isMyRequests = tab === 'my-requests' || tab === 'requests'") &&
    routerFile.includes("const isIncoming = tab === 'incoming-requests'") &&
    routerFile.includes("const isTransactions = tab === 'transactions'") &&
    routerFile.includes("mappedTab = (isRentals || isMyRequests || isIncoming || isTransactions) ? 'properties' : tab"),
    'router.tsx preserves backward compatibility: legacy routes redirect into appropriate My Properties sections'
  );

  console.log('\n================================================================');
  console.log('   ✓ ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!               ');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('Test execution failed:', err?.response?.data || err.message);
  process.exit(1);
});

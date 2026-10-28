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
  console.log('================================================================');
  console.log('   RESIDE: SELF-MANAGED RENTAL SUITE TEST                       ');
  console.log('================================================================\n');

  const ts = Date.now();

  // Step 1: Users setup
  console.log('1. Setting up Tenant A and Tenant B...');
  const tenantA = await registerAndVerify('Tenant Alex', `tenant_a_${ts}@example.com`, 'Customer');
  const tenantB = await registerAndVerify('Tenant Beth', `tenant_b_${ts}@example.com`, 'Customer');
  console.log('   ✓ Registered and verified Tenant A & Tenant B');

  // Step 2: Empty rental list behavior
  console.log('\n2. Testing empty rental list behavior...');
  const emptyRes = await axios.get(`${API}/self-managed-rentals`, {
    headers: { 'x-auth-token': tenantA.token }
  });
  assert(Array.isArray(emptyRes.data) && emptyRes.data.length === 0, 'Empty rental list returns empty array without error');

  // Step 3: Validation - Reject invalid amounts and dates
  console.log('\n3. Testing validation for invalid amounts and dates...');
  try {
    await axios.post(
      `${API}/self-managed-rentals`,
      {
        propertyTitle: 'Invalid Rental',
        address: '123 Fake St',
        monthlyRent: -500, // Invalid
        startDate: '2026-01-01'
      },
      { headers: { 'x-auth-token': tenantA.token } }
    );
    assert(false, 'Should have rejected negative rent');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejected negative rent with 400 Bad Request');
  }

  try {
    await axios.post(
      `${API}/self-managed-rentals`,
      {
        propertyTitle: 'Invalid Date Rental',
        address: '123 Fake St',
        monthlyRent: 15000,
        startDate: '2026-10-01',
        endDate: '2026-05-01' // End date before start date
      },
      { headers: { 'x-auth-token': tenantA.token } }
    );
    assert(false, 'Should have rejected end date before start date');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejected end date before start date with 400 Bad Request');
  }

  // Step 4: Create self-managed rental without landlord (month-to-month)
  console.log('\n4. Tenant A creates self-managed rental without landlord (month-to-month)...');
  const createWithoutLandlordRes = await axios.post(
    `${API}/self-managed-rentals`,
    {
      propertyTitle: 'Cosy Studio Apt 4B',
      propertyType: 'Apartment',
      address: '42 Lotus Colony, Velachery',
      city: 'Chennai',
      postalCode: '600042',
      monthlyRent: 16000,
      securityDeposit: 50000,
      startDate: '2026-01-01',
      // No endDate -> Month-to-month
      rentDueDay: 5,
      paymentFrequency: 'monthly',
      notes: 'Tenant Alex private studio flat'
    },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(createWithoutLandlordRes.status === 201, 'Created month-to-month rental without landlord');
  const rental1 = createWithoutLandlordRes.data;
  assert(rental1.rentalMode === 'self_managed', 'Rental mode explicitly marked self_managed');
  assert(!rental1.endDate, 'Month-to-month rental has no fixed end date');
  assert(rental1.landlord?.connectionStatus === 'unconnected', 'Landlord status defaults to unconnected');

  // Step 5: Create self-managed rental with optional landlord details
  console.log('\n5. Tenant A creates self-managed rental with optional landlord details...');
  const createWithLandlordRes = await axios.post(
    `${API}/self-managed-rentals`,
    {
      propertyTitle: 'Greenwood Penthouse 1201',
      propertyType: 'Penthouse',
      address: '77 Sky High Towers',
      city: 'Chennai',
      postalCode: '600096',
      monthlyRent: 35000,
      securityDeposit: 150000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentDueDay: 1,
      paymentFrequency: 'monthly',
      landlord: {
        name: 'Mr. V. Sundaram',
        phone: '9876543210',
        email: 'sundaram.landlord@example.com',
        notes: 'Independent owner, pays via bank transfer'
      }
    },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(createWithLandlordRes.status === 201, 'Created rental with optional landlord contact');
  const rental2 = createWithLandlordRes.data;
  assert(rental2.landlord?.name === 'Mr. V. Sundaram', 'Landlord details saved correctly');

  // Step 6: Verify isolation from public listings and owner properties
  console.log('\n6. Verifying self-managed rental does NOT appear in public listings or owner portfolios...');
  const publicListingsRes = await axios.get(`${API}/properties`);
  const publicFound = (publicListingsRes.data || []).some(
    (p) => p.title === 'Cosy Studio Apt 4B' || p._id === rental1._id
  );
  assert(!publicFound, 'Self-managed rental is NEVER exposed in public listings');

  const ownerPropsRes = await axios.get(`${API}/properties/my`, {
    headers: { 'x-auth-token': tenantA.token }
  });
  const ownerFound = (ownerPropsRes.data || []).some(
    (p) => p.title === 'Cosy Studio Apt 4B' || p._id === rental1._id
  );
  assert(!ownerFound, 'Self-managed rental is NEVER exposed as an owned property');

  // Step 7: Record offline manual rent payment
  console.log('\n7. Recording offline external rent payments...');
  const paymentRes = await axios.post(
    `${API}/self-managed-rentals/${rental1._id}/payments`,
    {
      amount: 16000,
      paymentDate: '2026-02-05',
      periodMonth: '2026-02-01',
      paymentMethod: 'bank_transfer',
      reference: 'TXN-HDFC-998877',
      notes: 'February 2026 rent paid via NEFT'
    },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(paymentRes.status === 201, 'Payment recorded successfully');
  const payment1 = paymentRes.data.payment;
  assert(payment1.status === 'tenant_recorded', 'Payment status is tenant_recorded');
  assert(payment1.isTenantRecorded === true, 'isTenantRecorded flag is true');
  assert(payment1.reference === 'TXN-HDFC-998877', 'Transaction reference preserved');

  // Step 8: Duplicate payment reference handling
  console.log('\n8. Testing duplicate payment submission handling...');
  try {
    await axios.post(
      `${API}/self-managed-rentals/${rental1._id}/payments`,
      {
        amount: 16000,
        paymentDate: '2026-02-05',
        periodMonth: '2026-02-01',
        paymentMethod: 'bank_transfer',
        reference: 'TXN-HDFC-998877', // Identical reference
        notes: 'Duplicate submission attempt'
      },
      { headers: { 'x-auth-token': tenantA.token } }
    );
    assert(false, 'Should have flagged duplicate payment reference');
  } catch (err) {
    assert(err.response?.status === 409, 'Duplicate reference rejected with 409 Conflict');
  }

  // Step 9: Document upload and retrieval
  console.log('\n9. Testing private rental agreement document attachment...');
  const attachDocRes = await axios.post(
    `${API}/self-managed-rentals/${rental1._id}/documents`,
    {
      name: 'Lease_Agreement_2026.pdf',
      category: 'agreement',
      data: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...dummyBase64'
    },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(attachDocRes.status === 201, 'Document attached successfully');
  const attachedDoc = attachDocRes.data.document;
  assert(attachedDoc.name === 'Lease_Agreement_2026.pdf', 'Document name preserved');
  assert(attachedDoc.category === 'agreement', 'Document category preserved');

  // Step 10: Delete document
  console.log('\n10. Testing document deletion...');
  const deleteDocRes = await axios.delete(
    `${API}/self-managed-rentals/${rental1._id}/documents/${attachedDoc._id}`,
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(deleteDocRes.status === 200, 'Document deleted successfully');

  // Step 11: Delete recorded payment
  console.log('\n11. Testing payment deletion/correction...');
  const deletePayRes = await axios.delete(
    `${API}/self-managed-rentals/${rental1._id}/payments/${payment1._id}`,
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(deletePayRes.status === 200, 'Payment deleted successfully');

  // Step 12: Maintenance issue and expense recording
  console.log('\n12. Testing maintenance and expense tracking...');
  const maintRes = await axios.post(
    `${API}/self-managed-rentals/${rental1._id}/maintenance`,
    {
      title: 'Kitchen Tap Replacement',
      description: 'Replaced leaky brass faucet with new quarter-turn tap',
      category: 'Plumbing',
      cost: 1250,
      dateReported: '2026-03-10',
      status: 'logged'
    },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(maintRes.status === 201, 'Maintenance entry logged successfully');
  const maintEntry = maintRes.data.maintenance;
  assert(maintEntry.cost === 1250, 'Amount spent (cost) recorded');
  assert(maintEntry.category === 'Plumbing', 'Category recorded');

  // Update maintenance status
  const updateMaintRes = await axios.put(
    `${API}/self-managed-rentals/${rental1._id}/maintenance/${maintEntry._id}`,
    { status: 'resolved' },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(updateMaintRes.status === 200, 'Maintenance entry status updated to resolved');

  // Step 13: Move-out / Vacate planning
  console.log('\n13. Testing move-out / vacate planning...');
  const vacateRes = await axios.put(
    `${API}/self-managed-rentals/${rental1._id}/vacate`,
    {
      plannedDate: '2026-12-31',
      noticeDate: '2026-11-30',
      notes: 'Deposit return promised by Jan 10th. New address in Bangalore.',
      checklist: [
        { item: 'Return all keys', completed: true },
        { item: 'Settle final EB bill', completed: false }
      ]
    },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(vacateRes.status === 200, 'Vacate plan saved successfully');
  assert(vacateRes.data.vacate?.checklist?.length === 2, 'Checklist tasks preserved');

  // Step 14: Landlord connection endpoint
  console.log('\n14. Testing optional landlord connection endpoint...');
  const connectRes = await axios.post(
    `${API}/self-managed-rentals/${rental2._id}/connect-landlord`,
    {
      email: 'sundaram.landlord@example.com',
      phone: '9876543210'
    },
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(connectRes.status === 200, 'Landlord connection invitation initiated');
  assert(connectRes.data.connectionStatus === 'invited', 'Status updated to invited');

  // Step 15: Cross-Tenant Security & Authorization Enforcement
  console.log('\n15. Testing cross-tenant security and authorization guards...');
  // Tenant B attempts to read Tenant A's rental
  try {
    await axios.get(`${API}/self-managed-rentals/${rental1._id}`, {
      headers: { 'x-auth-token': tenantB.token }
    });
    assert(false, 'Tenant B should NOT be able to read Tenant A rental');
  } catch (err) {
    assert(err.response?.status === 403, 'Access denied with 403 Forbidden for unauthorized tenant');
  }

  // Tenant B attempts to add a payment to Tenant A's rental
  try {
    await axios.post(
      `${API}/self-managed-rentals/${rental1._id}/payments`,
      {
        amount: 50000,
        paymentDate: '2026-04-01',
        paymentMethod: 'cash'
      },
      { headers: { 'x-auth-token': tenantB.token } }
    );
    assert(false, 'Tenant B should NOT be able to record payments on Tenant A rental');
  } catch (err) {
    assert(err.response?.status === 403, 'Unauthorized payment rejected with 403 Forbidden');
  }

  // Tenant B attempts to delete Tenant A's rental
  try {
    await axios.delete(`${API}/self-managed-rentals/${rental1._id}`, {
      headers: { 'x-auth-token': tenantB.token }
    });
    assert(false, 'Tenant B should NOT be able to delete Tenant A rental');
  } catch (err) {
    assert(err.response?.status === 403, 'Unauthorized delete rejected with 403 Forbidden');
  }

  // Step 16: Tenant A deletes self-managed rental
  console.log('\n16. Testing safe deletion by authorized tenant...');
  const deleteRentalRes = await axios.delete(
    `${API}/self-managed-rentals/${rental1._id}`,
    { headers: { 'x-auth-token': tenantA.token } }
  );
  assert(deleteRentalRes.status === 200, 'Authorized tenant deleted rental successfully');

  // Verify it is gone
  const remainingListRes = await axios.get(`${API}/self-managed-rentals`, {
    headers: { 'x-auth-token': tenantA.token }
  });
  const stillExists = remainingListRes.data.some((r) => r._id === rental1._id);
  assert(!stillExists, 'Rental cleanly removed from tenant active rentals list');

  console.log('\n================================================================');
  console.log('   ALL SELF-MANAGED RENTAL TESTS PASSED SUCCESSFULLY!          ');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal error during test run:', err?.response?.data || err?.message || err);
  process.exit(1);
});

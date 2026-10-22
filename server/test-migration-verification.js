const axios = require('axios');

const API = 'http://127.0.0.1:5000/api';

async function runTests() {
  console.log('--- STARTING ROLE ARCHITECTURE MIGRATION VERIFICATION ---');

  const purposes = ['Customer', 'Owner', 'Builder', 'Dealer'];
  let customerUserToken = null;
  let customerUserId = null;
  let createdPropertyId = null;

  for (const purpose of purposes) {
    const email = `test_${purpose.toLowerCase()}_${Date.now()}@example.com`;
    console.log(`\nTesting registration with Registration Purpose: [${purpose}]...`);

    // 1. Register
    const regRes = await axios.post(`${API}/auth/register`, {
      name: `Test ${purpose}`,
      email,
      password: 'Password123!',
      registrationPurpose: purpose
    });

    console.log(`  -> Registration response:`, regRes.data.msg);
    const otp = regRes.data.devOtp;
    if (!otp) {
      throw new Error(`Dev OTP missing for ${email}`);
    }

    // 2. Verify OTP
    const verifyRes = await axios.post(`${API}/auth/verify-register-otp`, {
      email,
      otp
    });

    const user = verifyRes.data.user;
    console.log(`  -> Verified user role: [${user.role}]`);
    console.log(`  -> Verified registrationPurpose: [${user.registrationPurpose}]`);
    console.log(`  -> Verified legacy tamilRole: [${user.tamilRole}]`);

    if (user.role !== 'user') {
      throw new Error(`Expected role 'user', got '${user.role}'`);
    }
    if (user.registrationPurpose !== purpose) {
      throw new Error(`Expected purpose '${purpose}', got '${user.registrationPurpose}'`);
    }

    if (purpose === 'Customer') {
      customerUserToken = verifyRes.data.token;
      customerUserId = user.id;
    }
  }

  // 3. Test Multi-Activity: Customer lists a property
  console.log('\nTesting Multi-Activity: User registered as Customer lists a property...');
  const propertyRes = await axios.post(
    `${API}/properties`,
    {
      title: 'Customer Listed Villa',
      propertyType: 'Residential',
      location: 'Chennai, Velachery',
      price: 25000,
      transactionType: 'rent',
      description: 'A beautiful villa listed by a user who registered as Customer',
      bedrooms: 3
    },
    { headers: { 'x-auth-token': customerUserToken } }
  );

  createdPropertyId = propertyRes.data._id || propertyRes.data.id;
  console.log(`  -> Property created successfully! ID: ${createdPropertyId}`);
  console.log(`  -> Property owner: ${propertyRes.data.owner}`);

  if (String(propertyRes.data.owner) !== String(customerUserId)) {
    throw new Error('Property owner does not match customer user ID');
  }

  // 4. Test Resource Authorization: Customer cannot rent their own property
  console.log('\nTesting Resource-based Authorization: Customer attempting to rent their own property...');
  try {
    await axios.post(
      `${API}/requests`,
      {
        propertyId: createdPropertyId,
        type: 'rent',
        message: 'I want to rent this property from myself'
      },
      { headers: { 'x-auth-token': customerUserToken } }
    );
    throw new Error('Self-request should have been rejected with 400!');
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`  -> Correctly blocked with HTTP 400: "${err.response.data.msg}"`);
    } else {
      throw err;
    }
  }

  // 5. Test Admin Boundary: Regular USER cannot access Admin Overview
  console.log('\nTesting Security Boundary: Regular USER attempting Admin endpoint...');
  try {
    await axios.get(`${API}/users/admin/overview`, {
      headers: { 'x-auth-token': customerUserToken }
    });
    throw new Error('USER should not have access to admin overview!');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 401)) {
      console.log(`  -> Correctly blocked with HTTP ${err.response.status}: "${err.response.data.msg || 'Forbidden'}"`);
    } else {
      throw err;
    }
  }

  console.log('\n>>> ALL ROLE ARCHITECTURE MIGRATION TESTS PASSED SUCCESSFULLY! <<<\n');
}

runTests().catch((err) => {
  console.error('\nFAILED TEST:', err?.response?.data || err?.message || err);
  process.exit(1);
});

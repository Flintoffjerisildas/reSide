const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret'; // checking token creation

async function runVerification() {
  console.log('====================================================');
  console.log('VERIFYING OWNER-CONTROLLED PROPERTY LISTING VISIBILITY');
  console.log('====================================================');

  await mongoose.connect('mongodb://localhost:27017/resideai');
  const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
  const Property = mongoose.model('Property', new mongoose.Schema({}, { strict: false }));
  const Agreement = mongoose.model('Agreement', new mongoose.Schema({}, { strict: false }));

  // Find two users for testing: owner and an unrelated user
  const users = await User.find().limit(2);
  if (users.length < 2) {
    console.error('Need at least 2 users in DB to test authorization');
    process.exit(1);
  }
  const ownerUser = users[0];
  const unrelatedUser = users[1];

  const ownerToken = jwt.sign({ user: { id: ownerUser._id.toString(), role: ownerUser.role || 'user' } }, 'secret', { expiresIn: '1h' });
  const unrelatedToken = jwt.sign({ user: { id: unrelatedUser._id.toString(), role: unrelatedUser.role || 'user' } }, 'secret', { expiresIn: '1h' });

  console.log(`Owner User ID: ${ownerUser._id} (${ownerUser.email})`);
  console.log(`Unrelated User ID: ${unrelatedUser._id} (${unrelatedUser.email})`);

  // Create a clean test property owned by ownerUser
  const testProperty = new Property({
    title: 'Automated Test Villa ' + Date.now(),
    propertyType: 'house',
    location: 'Chennai ECR',
    price: 9000000,
    transactionType: 'purchase',
    description: 'A private test villa for verifying visibility',
    owner: ownerUser._id,
    status: 'approved',
    listingStatus: 'unlisted',
    isListed: false,
    occupancyStatus: 'vacant',
    saleStatus: 'available',
    tenant: null,
    buyer: null
  });
  await testProperty.save();
  const testPropertyId = testProperty._id.toString();
  console.log(`Created test property: "${testProperty.title}" (ID: ${testPropertyId})`);

  let allPassed = true;

  // ------------------------------------------------------------------------
  // TEST 1: Owned but unlisted property appears in owner's dashboard but NOT in public listings
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 1: Owned but unlisted property visibility ---');
  try {
    const publicRes = await axios.get(`${API_URL}/properties`);
    const foundInPublic = publicRes.data.some(p => (p._id || p.id) === testPropertyId);

    const ownerRes = await axios.get(`${API_URL}/properties/my`, {
      headers: { 'x-auth-token': ownerToken }
    });
    const foundInOwner = ownerRes.data.some(p => (p._id || p.id) === testPropertyId);

    if (!foundInPublic && foundInOwner) {
      console.log('✅ PASS: Property is hidden from public listings and visible in owner dashboard.');
    } else {
      console.error(`❌ FAIL: foundInPublic=${foundInPublic}, foundInOwner=${foundInOwner}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ FAIL in Test 1:', err.message);
    allPassed = false;
  }

  // ------------------------------------------------------------------------
  // TEST 2: Listing it for sale makes it appear in eligible Buy listings only
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 2: Listing for Sale ---');
  try {
    const listRes = await axios.put(`${API_URL}/properties/${testPropertyId}/listing-status`, {
      listingStatus: 'listed',
      transactionType: 'purchase',
      price: 9500000,
      description: 'Updated sale description'
    }, {
      headers: { 'x-auth-token': ownerToken }
    });

    console.log(`Updated listingStatus: ${listRes.data.listingStatus}, isListed: ${listRes.data.isListed}`);

    const buyRes = await axios.get(`${API_URL}/properties?transactionType=buy`);
    const inBuy = buyRes.data.some(p => (p._id || p.id) === testPropertyId);

    const rentRes = await axios.get(`${API_URL}/properties?transactionType=rent`);
    const inRent = rentRes.data.some(p => (p._id || p.id) === testPropertyId);

    if (inBuy && !inRent) {
      console.log('✅ PASS: Property appears in Buy listings only, NOT in Rent listings.');
    } else {
      console.error(`❌ FAIL: inBuy=${inBuy}, inRent=${inRent}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ FAIL in Test 2:', err.response?.data || err.message);
    allPassed = false;
  }

  // ------------------------------------------------------------------------
  // TEST 3: Listing it for rent makes it appear in eligible Rent listings only
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 3: Listing for Rent ---');
  try {
    await axios.put(`${API_URL}/properties/${testPropertyId}/listing-status`, {
      listingStatus: 'listed',
      transactionType: 'rent',
      price: 45000,
      description: 'Updated rent description'
    }, {
      headers: { 'x-auth-token': ownerToken }
    });

    const buyRes = await axios.get(`${API_URL}/properties?transactionType=buy`);
    const inBuy = buyRes.data.some(p => (p._id || p.id) === testPropertyId);

    const rentRes = await axios.get(`${API_URL}/properties?transactionType=rent`);
    const inRent = rentRes.data.some(p => (p._id || p.id) === testPropertyId);

    if (!inBuy && inRent) {
      console.log('✅ PASS: Property appears in Rent listings only, NOT in Buy listings.');
    } else {
      console.error(`❌ FAIL: inBuy=${inBuy}, inRent=${inRent}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ FAIL in Test 3:', err.response?.data || err.message);
    allPassed = false;
  }

  // ------------------------------------------------------------------------
  // TEST 4: Unlisting it removes it from public listings without deleting its record
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 4: Unlisting Property ---');
  try {
    const unlistRes = await axios.put(`${API_URL}/properties/${testPropertyId}/listing-status`, {
      listingStatus: 'unlisted'
    }, {
      headers: { 'x-auth-token': ownerToken }
    });

    const publicRes = await axios.get(`${API_URL}/properties`);
    const inPublic = publicRes.data.some(p => (p._id || p.id) === testPropertyId);

    const dbProp = await Property.findById(testPropertyId);

    if (!inPublic && dbProp && dbProp.listingStatus === 'unlisted' && !dbProp.isListed) {
      console.log('✅ PASS: Unlisting successfully removed from public listings without deleting property record.');
    } else {
      console.error(`❌ FAIL: inPublic=${inPublic}, existsInDb=${!!dbProp}`);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ FAIL in Test 4:', err.response?.data || err.message);
    allPassed = false;
  }

  // ------------------------------------------------------------------------
  // TEST 5: Unrelated users cannot change listing status (Authorization check)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 5: Authorization Security Check ---');
  try {
    let rejected = false;
    try {
      await axios.put(`${API_URL}/properties/${testPropertyId}/listing-status`, {
        listingStatus: 'listed',
        transactionType: 'purchase',
        price: 9000000
      }, {
        headers: { 'x-auth-token': unrelatedToken }
      });
    } catch (authErr) {
      if (authErr.response?.status === 403 || authErr.response?.status === 401) {
        rejected = true;
      }
    }

    if (rejected) {
      console.log('✅ PASS: Unrelated user was correctly forbidden from modifying listing status (403/401).');
    } else {
      console.error('❌ FAIL: Unrelated user was allowed to change listing status!');
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ FAIL in Test 5:', err.message);
    allPassed = false;
  }

  // ------------------------------------------------------------------------
  // TEST 6: Occupied or ineligible properties cannot be published
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 6: Occupancy / Conflict Safety Check ---');
  try {
    // Mark property as occupied with a tenant
    await Property.findByIdAndUpdate(testPropertyId, {
      occupancyStatus: 'occupied',
      tenant: unrelatedUser._id,
      currentTenantId: unrelatedUser._id
    });

    let conflictBlocked = false;
    try {
      await axios.put(`${API_URL}/properties/${testPropertyId}/listing-status`, {
        listingStatus: 'listed',
        transactionType: 'rent',
        price: 50000
      }, {
        headers: { 'x-auth-token': ownerToken }
      });
    } catch (confErr) {
      if (confErr.response?.status === 400) {
        conflictBlocked = true;
        console.log(`Backend rejection message: "${confErr.response.data.msg}"`);
      }
    }

    if (conflictBlocked) {
      console.log('✅ PASS: Attempting to list an occupied property was safely blocked (400 Bad Request).');
    } else {
      console.error('❌ FAIL: Occupied property was allowed to be published!');
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ FAIL in Test 6:', err.message);
    allPassed = false;
  }

  // Clean up test property
  await Property.findByIdAndDelete(testPropertyId);
  console.log(`\nCleaned up test property ${testPropertyId}`);

  console.log('\n====================================================');
  if (allPassed) {
    console.log('🎉 ALL 6 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.log('⚠️ SOME CHECKS FAILED. PLEASE REVIEW ABOVE.');
  }
  console.log('====================================================');

  process.exit(allPassed ? 0 : 1);
}

runVerification().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

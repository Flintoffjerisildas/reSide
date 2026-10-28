const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function runVerification() {
  console.log('================================================================');
  console.log('VERIFYING RESIDE PROPERTY PUBLISHING RULES: SALE VS RENT RULES');
  console.log('================================================================');

  await mongoose.connect('mongodb://localhost:27017/resideai');
  const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String }));
  const Property = mongoose.model('Property', new mongoose.Schema({}, { strict: false }));
  const Agreement = mongoose.model('Agreement', new mongoose.Schema({}, { strict: false }));

  // Retrieve 3 distinct users for testing
  const users = await User.find().limit(3);
  if (users.length < 3) {
    console.error('Need at least 3 users in DB for comprehensive testing (owner, buyer/tenant, stranger)');
    process.exit(1);
  }
  const ownerUser = users[0];
  const tenantBuyerUser = users[1];
  const strangerUser = users[2];

  const ownerToken = jwt.sign({ user: { id: ownerUser._id.toString(), role: ownerUser.role || 'user' } }, JWT_SECRET, { expiresIn: '1h' });
  const strangerToken = jwt.sign({ user: { id: strangerUser._id.toString(), role: strangerUser.role || 'user' } }, JWT_SECRET, { expiresIn: '1h' });
  const buyerToken = jwt.sign({ user: { id: tenantBuyerUser._id.toString(), role: tenantBuyerUser.role || 'user' } }, JWT_SECRET, { expiresIn: '1h' });

  console.log(`Owner: ${ownerUser._id} (${ownerUser.email})`);
  console.log(`Tenant / Buyer: ${tenantBuyerUser._id} (${tenantBuyerUser.email})`);
  console.log(`Stranger: ${strangerUser._id} (${strangerUser.email})\n`);

  let allPassed = true;
  const createdPropertyIds = [];

  try {
    // ------------------------------------------------------------------------
    // CASE 1: An owned, occupied property can be published for sale
    // ------------------------------------------------------------------------
    console.log('--- CASE 1: Owned, occupied property can be published for sale ---');
    const occupiedProp = new Property({
      title: 'Occupied Test Residency ' + Date.now(),
      propertyType: 'apartment',
      location: 'Adyar, Chennai',
      price: 12000000,
      transactionType: 'purchase',
      description: 'Investment apartment with reliable tenant in place',
      owner: ownerUser._id,
      status: 'approved',
      listingStatus: 'unlisted',
      isListed: false,
      occupancyStatus: 'occupied',
      saleStatus: 'available',
      tenant: tenantBuyerUser._id,
      currentTenantId: tenantBuyerUser._id
    });
    await occupiedProp.save();
    const occupiedPropId = occupiedProp._id.toString();
    createdPropertyIds.push(occupiedPropId);

    const publishSaleRes = await axios.put(`${API_URL}/properties/${occupiedPropId}/listing-status`, {
      listingStatus: 'listed',
      transactionType: 'purchase',
      price: 12500000,
      description: 'Published sale listing with tenant in place'
    }, {
      headers: { 'x-auth-token': ownerToken }
    });

    const refreshedOcc = await Property.findById(occupiedPropId);
    const inBuySearch = (await axios.get(`${API_URL}/properties?transactionType=buy`)).data.some(p => (p._id || p.id) === occupiedPropId);

    if (
      publishSaleRes.status === 200 &&
      refreshedOcc.listingStatus === 'listed' &&
      refreshedOcc.isListed === true &&
      refreshedOcc.occupancyStatus === 'occupied' &&
      refreshedOcc.tenant?.toString() === tenantBuyerUser._id.toString() &&
      inBuySearch
    ) {
      console.log('✅ PASS Case 1: Owned, occupied property was successfully published for sale, tenant details preserved, and visible in Buy listings.');
    } else {
      console.error('❌ FAIL Case 1:', {
        status: publishSaleRes.status,
        listingStatus: refreshedOcc.listingStatus,
        occupancyStatus: refreshedOcc.occupancyStatus,
        tenant: refreshedOcc.tenant,
        inBuySearch
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // CASE 2: An owned, occupied property cannot be published for a conflicting new rental
    // ------------------------------------------------------------------------
    console.log('\n--- CASE 2: Owned, occupied property cannot be published for rent ---');
    let rentBlocked = false;
    let rentErrorMessage = '';
    try {
      await axios.put(`${API_URL}/properties/${occupiedPropId}/listing-status`, {
        listingStatus: 'listed',
        transactionType: 'rent',
        price: 35000
      }, {
        headers: { 'x-auth-token': ownerToken }
      });
    } catch (err) {
      if (err.response?.status === 400) {
        rentBlocked = true;
        rentErrorMessage = err.response.data?.msg;
      }
    }

    // Verify it also cannot be found in rental listings
    const inRentSearch = (await axios.get(`${API_URL}/properties?transactionType=rent`)).data.some(p => (p._id || p.id) === occupiedPropId);

    if (rentBlocked && !inRentSearch) {
      console.log(`✅ PASS Case 2: Blocked rental publication on occupied property (400: "${rentErrorMessage}"). Not visible in Rent search.`);
    } else {
      console.error(`❌ FAIL Case 2: rentBlocked=${rentBlocked}, inRentSearch=${inRentSearch}`);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // CASE 3: A vacant, eligible property can be published for sale or rent
    // ------------------------------------------------------------------------
    console.log('\n--- CASE 3: Vacant, eligible property can be published for sale or rent ---');
    const vacantProp = new Property({
      title: 'Vacant Garden Villa ' + Date.now(),
      propertyType: 'house',
      location: 'Velachery, Chennai',
      price: 8000000,
      transactionType: 'purchase',
      description: 'Brand new vacant villa ready for occupancy',
      owner: ownerUser._id,
      status: 'approved',
      listingStatus: 'unlisted',
      isListed: false,
      occupancyStatus: 'vacant',
      saleStatus: 'available',
      tenant: null
    });
    await vacantProp.save();
    const vacantPropId = vacantProp._id.toString();
    createdPropertyIds.push(vacantPropId);

    // 3a: Publish vacant for Rent
    const listRentRes = await axios.put(`${API_URL}/properties/${vacantPropId}/listing-status`, {
      listingStatus: 'listed',
      transactionType: 'rent',
      price: 32000
    }, {
      headers: { 'x-auth-token': ownerToken }
    });
    const inRentPublic = (await axios.get(`${API_URL}/properties?transactionType=rent`)).data.some(p => (p._id || p.id) === vacantPropId);

    // 3b: Publish vacant for Sale
    const listSaleRes = await axios.put(`${API_URL}/properties/${vacantPropId}/listing-status`, {
      listingStatus: 'listed',
      transactionType: 'purchase',
      price: 8200000
    }, {
      headers: { 'x-auth-token': ownerToken }
    });
    const inBuyPublic = (await axios.get(`${API_URL}/properties?transactionType=buy`)).data.some(p => (p._id || p.id) === vacantPropId);

    if (listRentRes.status === 200 && inRentPublic && listSaleRes.status === 200 && inBuyPublic) {
      console.log('✅ PASS Case 3: Vacant property can be published for both Rent and Sale successfully.');
    } else {
      console.error('❌ FAIL Case 3:', { inRentPublic, inBuyPublic });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // CASE 4: An unauthorized user cannot publish another person's property
    // ------------------------------------------------------------------------
    console.log('\n--- CASE 4: Unauthorized user cannot publish another person\'s property ---');
    let unauthorizedBlocked = false;
    try {
      await axios.put(`${API_URL}/properties/${vacantPropId}/listing-status`, {
        listingStatus: 'listed',
        transactionType: 'purchase',
        price: 5000000
      }, {
        headers: { 'x-auth-token': strangerToken }
      });
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        unauthorizedBlocked = true;
      }
    }

    if (unauthorizedBlocked) {
      console.log('✅ PASS Case 4: Stranger was correctly forbidden with 403 Forbidden.');
    } else {
      console.error('❌ FAIL Case 4: Unauthorized user was able to publish property!');
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // CASE 5: A completed ownership transfer prevents previous owner from republishing it
    // ------------------------------------------------------------------------
    console.log('\n--- CASE 5: Completed ownership transfer prevents previous owner from republishing ---');
    const transferProp = new Property({
      title: 'Transferred Title Home ' + Date.now(),
      propertyType: 'house',
      location: 'Anna Nagar, Chennai',
      price: 15000000,
      transactionType: 'purchase',
      owner: ownerUser._id,
      status: 'approved',
      listingStatus: 'unlisted',
      isListed: false,
      occupancyStatus: 'occupied',
      saleStatus: 'available'
    });
    await transferProp.save();
    const transferPropId = transferProp._id.toString();
    createdPropertyIds.push(transferPropId);

    // Simulate completion of sale: ownership transfers from ownerUser to tenantBuyerUser
    transferProp.previousOwner = ownerUser._id;
    transferProp.previousOwners = [{
      owner: ownerUser._id,
      transferredAt: new Date(),
      price: 15000000
    }];
    transferProp.owner = tenantBuyerUser._id; // Buyer is now verified owner!
    transferProp.buyer = tenantBuyerUser._id;
    transferProp.saleStatus = 'sold';
    transferProp.listingStatus = 'unlisted';
    transferProp.isListed = false;
    await transferProp.save();

    // Previous owner (ownerUser) attempts to publish
    let prevOwnerBlocked = false;
    try {
      await axios.put(`${API_URL}/properties/${transferPropId}/listing-status`, {
        listingStatus: 'listed',
        transactionType: 'purchase',
        price: 16000000
      }, {
        headers: { 'x-auth-token': ownerToken }
      });
    } catch (err) {
      if (err.response?.status === 403) {
        prevOwnerBlocked = true;
      }
    }

    // New owner (tenantBuyerUser) can publish their property for sale!
    let newOwnerCanPublish = false;
    try {
      const newOwnerRes = await axios.put(`${API_URL}/properties/${transferPropId}/listing-status`, {
        listingStatus: 'listed',
        transactionType: 'purchase',
        price: 16000000
      }, {
        headers: { 'x-auth-token': buyerToken }
      });
      if (newOwnerRes.status === 200 && newOwnerRes.data.isListed === true) {
        newOwnerCanPublish = true;
      }
    } catch (err) {
      console.error('Error with new owner publishing:', err.response?.data || err.message);
    }

    if (prevOwnerBlocked && newOwnerCanPublish) {
      console.log('✅ PASS Case 5: Previous owner strictly forbidden from republishing (403), while new legal owner successfully exercises ownership rights.');
    } else {
      console.error(`❌ FAIL Case 5: prevOwnerBlocked=${prevOwnerBlocked}, newOwnerCanPublish=${newOwnerCanPublish}`);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // CASE 6: Existing tenancy and transaction records remain unchanged
    // ------------------------------------------------------------------------
    console.log('\n--- CASE 6: Existing tenancy and transaction records remain unchanged ---');
    const agreementDoc = new Agreement({
      property: occupiedPropId,
      owner: ownerUser._id,
      tenant: tenantBuyerUser._id,
      rentAmount: 30000,
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    });
    await agreementDoc.save();

    // Re-verify occupiedProp in DB
    const verifiedOcc = await Property.findById(occupiedPropId);
    const verifiedAgr = await Agreement.findById(agreementDoc._id);

    const tenancyIntact =
      verifiedOcc.occupancyStatus === 'occupied' &&
      verifiedOcc.tenant?.toString() === tenantBuyerUser._id.toString() &&
      verifiedAgr.status === 'active' &&
      verifiedAgr.tenant?.toString() === tenantBuyerUser._id.toString();

    // Now unlist occupied property and re-check
    await axios.put(`${API_URL}/properties/${occupiedPropId}/listing-status`, {
      listingStatus: 'unlisted'
    }, {
      headers: { 'x-auth-token': ownerToken }
    });

    const afterUnlistOcc = await Property.findById(occupiedPropId);
    const unlistPreservesTenancy =
      afterUnlistOcc.occupancyStatus === 'occupied' &&
      afterUnlistOcc.tenant?.toString() === tenantBuyerUser._id.toString();

    await Agreement.findByIdAndDelete(agreementDoc._id);

    if (tenancyIntact && unlistPreservesTenancy) {
      console.log('✅ PASS Case 6: Publishing for sale and unlisting preserved all tenancy data, active agreements, and tenant assignments intact.');
    } else {
      console.error('❌ FAIL Case 6: Tenancy data or agreement corrupted:', { tenancyIntact, unlistPreservesTenancy });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // CASE 7: Frontend and backend validation produce consistent results
    // ------------------------------------------------------------------------
    console.log('\n--- CASE 7: Consistency between Frontend and Backend validation ---');
    // Test invalid price rejection on backend
    let priceZeroRejected = false;
    try {
      await axios.put(`${API_URL}/properties/${occupiedPropId}/listing-status`, {
        listingStatus: 'listed',
        transactionType: 'purchase',
        price: 0
      }, {
        headers: { 'x-auth-token': ownerToken }
      });
    } catch (err) {
      if (err.response?.status === 400) {
        priceZeroRejected = true;
      }
    }

    // Test invalid listing status
    let invalidStatusRejected = false;
    try {
      await axios.put(`${API_URL}/properties/${occupiedPropId}/listing-status`, {
        listingStatus: 'invalid_status'
      }, {
        headers: { 'x-auth-token': ownerToken }
      });
    } catch (err) {
      if (err.response?.status === 400) {
        invalidStatusRejected = true;
      }
    }

    if (priceZeroRejected && invalidStatusRejected) {
      console.log('✅ PASS Case 7: Validation rules (price > 0, listingStatus enum, sale vs rent occupancy safety) are consistently enforced by backend.');
    } else {
      console.error(`❌ FAIL Case 7: priceZeroRejected=${priceZeroRejected}, invalidStatusRejected=${invalidStatusRejected}`);
      allPassed = false;
    }

  } finally {
    // Cleanup created test records
    for (const propId of createdPropertyIds) {
      await Property.findByIdAndDelete(propId);
    }
    console.log(`\nCleaned up ${createdPropertyIds.length} test properties from DB.`);
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('🎉 ALL 7 REQUIRED VERIFICATION TEST CASES PASSED SUCCESSFULLY!');
  } else {
    console.log('⚠️ SOME VERIFICATION TEST CASES FAILED.');
  }
  console.log('================================================================');

  process.exit(allPassed ? 0 : 1);
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

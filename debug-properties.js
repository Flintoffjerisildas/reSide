const mongoose = require('mongoose');
const Property = require('./server/models/Property');
const User = require('./server/models/User');
const dotenv = require('dotenv');

dotenv.config({ path: './server/.env' }); // Load from server/.env if exists, or just .env

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/resideai';
    console.log('Connecting to MongoDB:', mongoURI);
    await mongoose.connect(mongoURI);
    console.log('Connected.');

    const properties = await Property.find({});
    console.log(`Found ${properties.length} properties.`);
    
    properties.forEach(p => {
      console.log(`ID: ${p._id} | Owner: ${p.owner} | Title: ${p.title}`);
    });

    if (properties.length === 0) {
        console.log("No properties found in the database.");
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
};

run();

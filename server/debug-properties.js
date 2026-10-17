const mongoose = require('mongoose');
const Property = require('./models/Property');
const User = require('./models/User');
const dotenv = require('dotenv');

// Load .env from current directory
dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/resideai';
    console.log('Connecting to MongoDB:', mongoURI);
    
    // Connect to MongoDB
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

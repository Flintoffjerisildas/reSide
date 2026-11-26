const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  maintenanceMode: { type: Boolean, default: false },
  allowNewRegistrations: { type: Boolean, default: true },
  requirePhoneVerificationForListing: { type: Boolean, default: false },
  globalBannerMessage: { type: String, default: '', trim: true },
  updatedAt: { type: Date, default: Date.now },
});

systemConfigSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne({ key: 'global' });
  if (!doc) {
    doc = await this.create({ key: 'global' });
  }
  return doc;
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);

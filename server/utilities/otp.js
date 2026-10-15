const crypto = require('crypto');

function generateNumericOtp(length = 6) {
  const max = 10 ** length;
  const otp = crypto.randomInt(0, max).toString().padStart(length, '0');
  return otp;
}

function isOtpExpired(otpExpiry) {
  if (!otpExpiry) return true;
  return new Date(otpExpiry).getTime() < Date.now();
}

function canResendOtp(otpExpiry, cooldownMs = 60_000, validityMs = 5 * 60_000) {
  if (!otpExpiry) return true;
  const lastSent = new Date(new Date(otpExpiry).getTime() - validityMs);
  if (Number.isNaN(lastSent.getTime())) return true;
  return Date.now() - lastSent.getTime() >= cooldownMs;
}

module.exports = {
  generateNumericOtp,
  isOtpExpired,
  canResendOtp
};


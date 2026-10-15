const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.titan.email',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'info@krishub.in',
    pass: process.env.SMTP_PASS
  }
});

async function sendOtpEmail(to, otp, purpose) {
  const subject =
    purpose === 'register'
      ? 'Your Reside account verification code'
      : 'Your Reside password reset code';

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Reside Authentication</h2>
      <p>Your one-time password (OTP) is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>This code is valid for 5 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.MAIL_FROM || 'info@krishub.in',
    to,
    subject,
    html
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendOtpEmail
};


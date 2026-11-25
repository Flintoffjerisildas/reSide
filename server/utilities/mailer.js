const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  let port = Number(process.env.SMTP_PORT) || 587;
  if (host.includes('gmail.com') && port === 465) {
    port = 587;
  }
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000
  });
}

async function sendOtpEmail(to, otp, purpose) {
  console.log('\n============================================================');
  console.log(`[OTP DISPATCH] Destination: ${to}`);
  console.log(`[OTP DISPATCH] Purpose: ${purpose}`);
  console.log(`[OTP DISPATCH] CODE: ${otp}`);
  console.log('============================================================\n');

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
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@reside.com',
    to,
    subject,
    html
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`[OTP Mailer] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return { success: true, otp };
  } catch (err) {
    console.error(`[OTP Mailer Error] Failed to send email via SMTP to ${to}: ${err.message}`);
    console.warn(`[OTP Mailer Fallback] Proceeding with generated OTP: ${otp}`);
    return { success: false, error: err.message, otp };
  }
}

module.exports = {
  sendOtpEmail
};



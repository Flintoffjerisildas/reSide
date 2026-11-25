const nodemailer = require('nodemailer');

/**
 * Send 6-digit email verification code using configured provider:
 * 1. Google Apps Script Webhook (GMAIL_WEBHOOK_URL)
 * 2. Brevo HTTPS REST API (BREVO_API_KEY + SENDER_EMAIL)
 * 3. Nodemailer SMTP (SMTP_USER + SMTP_PASS)
 *
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit verification code
 * @param {string} [userName='User'] - Recipient name
 */
async function sendVerificationEmail(toEmail, otp, userName = 'User') {
  if (!toEmail || !otp) {
    throw new Error('Email and OTP are required to send verification email');
  }

  console.log('\n============================================================');
  console.log(`[OTP DISPATCH] Destination: ${toEmail}`);
  console.log(`[OTP DISPATCH] Recipient: ${userName}`);
  console.log(`[OTP DISPATCH] CODE: ${otp}`);
  console.log('============================================================\n');

  const gmailWebhookUrl = process.env.GMAIL_WEBHOOK_URL?.trim();
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = (process.env.SENDER_EMAIL || process.env.MAIL_FROM)?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  // Check which provider env vars exist
  const hasGmailWebhook = Boolean(gmailWebhookUrl);
  const hasBrevo = Boolean(brevoApiKey && senderEmail);
  const hasSmtp = Boolean(smtpUser && smtpPass);

  if (!hasGmailWebhook && !hasBrevo && !hasSmtp) {
    throw new Error('No email provider configured in server/.env (set GMAIL_WEBHOOK_URL, BREVO_API_KEY + SENDER_EMAIL, or SMTP_USER + SMTP_PASS)');
  }

  const subject = `${otp} is your Reside verification code`;
  const textContent = `Hello ${userName},\n\nYour Reside verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this code, please ignore this email.`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); border: 1px solid #e2e8f0; }
        .header { background: #2563eb; padding: 24px 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .content { padding: 32px; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
        .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-box { background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; margin: 0; }
        .notice { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 16px; }
        .footer { background: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reside</h1>
        </div>
        <div class="content">
          <div class="greeting">Hello ${userName},</div>
          <p class="intro">Thank you for choosing Reside. Please use the verification code below to verify your email address:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p class="notice"><strong>Important:</strong> This verification code is valid for <strong>5 minutes</strong>. If you did not initiate this request, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Reside Management System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Google Apps Script Webhook
  if (hasGmailWebhook) {
    const payload = {
      to: toEmail,
      email: toEmail,
      recipient: userName,
      name: userName,
      subject,
      otp,
      htmlContent,
      html: htmlContent,
      textContent,
      text: textContent,
    };

    let res;
    let rawText = '';
    try {
      res = await fetch(gmailWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });
      rawText = await res.text();
    } catch (fetchErr) {
      console.error('Google Apps Script network error:', fetchErr.message);
      throw new Error(`Google Apps Script connection failed: ${fetchErr.message}`);
    }

    let isSuccess = false;
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
      if (parsed.success === true || parsed.status === 'success' || parsed.result === 'success') {
        isSuccess = true;
      }
    } catch {}

    const isHtml = rawText.includes('<!DOCTYPE html>') || rawText.includes('<html') || rawText.includes('accounts.google.com');
    const isExplicitFailure = parsed && parsed.success === false;

    if (!res.ok || isHtml || isExplicitFailure) {
      console.error('Google Apps Script webhook rejected response:', res.status, rawText.slice(0, 500));
      throw new Error('Google Apps Script webhook rejected the request — ensure it is deployed as Web App with access set to Anyone');
    }

    console.log('[EMAIL SENT]', toEmail, 'GMAIL_WEBHOOK');
    return { success: true, provider: 'GMAIL_WEBHOOK' };
  }

  // 2. Brevo HTTPS REST API
  if (hasBrevo) {
    const payload = {
      sender: { name: 'Reside', email: senderEmail },
      to: [{ email: toEmail, name: userName }],
      subject,
      htmlContent,
    };

    let res;
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr) {
      console.error('Brevo network error:', fetchErr.message);
      throw new Error(`Brevo connection failed: ${fetchErr.message}`);
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('Brevo email error:', res.status, errorData);
      throw new Error(errorData.message || 'Brevo rejected the email request');
    }

    const data = await res.json().catch(() => ({}));
    console.log('[EMAIL SENT]', toEmail, 'BREVO');
    return { success: true, provider: 'BREVO', messageId: data.messageId };
  }

  // 3. Nodemailer SMTP
  if (hasSmtp) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    let port = parseInt(process.env.SMTP_PORT || '587', 10);
    // If Gmail is used and port 465 was provided, prefer port 587 (STARTTLS) which avoids ISP/network timeout blocks
    if (host.includes('gmail.com') && port === 465) {
      port = 587;
    }

    const createSmtpTransporter = (p) =>
      nodemailer.createTransport({
        host,
        port: p,
        secure: p === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
        tls: {
          rejectUnauthorized: false,
        },
      });

    let transporter = createSmtpTransporter(port);
    const fromAddress = senderEmail || smtpUser;

    let info;
    try {
      info = await transporter.sendMail({
        from: `"Reside Verification" <${fromAddress}>`,
        to: toEmail,
        subject,
        html: htmlContent,
        text: textContent,
      });
    } catch (primaryErr) {
      console.warn(`[SMTP Warning] Port ${port} send failed: ${primaryErr.message}. Attempting fallback to port 587...`);
      if (port !== 587) {
        try {
          const fallbackTransporter = createSmtpTransporter(587);
          info = await fallbackTransporter.sendMail({
            from: `"Reside Verification" <${fromAddress}>`,
            to: toEmail,
            subject,
            html: htmlContent,
            text: textContent,
          });
          console.log('[SMTP Fallback] Successfully sent email on port 587');
        } catch (fallbackErr) {
          console.error('SMTP send error on port 587 fallback:', fallbackErr.message);
          throw new Error(`SMTP delivery failed: ${fallbackErr.message}`);
        }
      } else {
        throw new Error(`SMTP delivery failed: ${primaryErr.message}`);
      }
    }

    if (info?.rejected && info.rejected.length > 0) {
      console.error('SMTP rejected recipients:', info.rejected);
      throw new Error(`SMTP rejected delivery to ${info.rejected.join(', ')}`);
    }

    console.log('[EMAIL SENT]', toEmail, 'SMTP (MessageId:', info?.messageId || 'sent', ')');
    return { success: true, provider: 'SMTP', messageId: info?.messageId };
  }
}

module.exports = {
  sendVerificationEmail,
};

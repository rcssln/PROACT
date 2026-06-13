const nodemailer = require('nodemailer');
const pool = require('../db');

/**
 * Sends a welcome email using configured SMTP settings.
 */
const sendWelcomeEmail = async (userEmail, firstName, tempPassword) => {
  // Default values (fallback to ENV)
  let smtpEmail = process.env.OUTLOOK_EMAIL;
  let smtpPassword = process.env.OUTLOOK_PASSWORD;
  let senderName = process.env.OUTLOOK_SENDER_NAME || 'DOST DRRMO';
  let host = 'smtp.office365.com';
  let port = 587;
  let senderEmail = '';

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  try {
    // Fetch SMTP settings from DB (Single Query)
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['smtp_config']);
    if (rows.length > 0 && rows[0].value) {
      const config = rows[0].value;
      if (config.username && config.password) {
        smtpEmail = config.username;
        smtpPassword = config.password;
        host = config.host || host;
        port = parseInt(config.port) || port;
        senderEmail = config.senderEmail || '';
        senderName = config.senderName || senderName;
      }
    }
  } catch (dbErr) {
    console.warn('[Mailer] Could not fetch SMTP config from DB, falling back to ENV', dbErr.message);
  }

  if (!smtpEmail || !smtpPassword || smtpEmail === 'your_email@outlook.com') {
    console.warn('[Mailer] SMTP Credentials not configured. Skipping email.');
    return { success: false, error: 'SMTP credentials not configured' };
  }

  // Construct fromAddress
  // Priority: "Name" <senderEmail> OR "Name" <authEmail>
  const fromAddress = `"${senderName}" <${senderEmail || smtpEmail}>`;

  console.log(`[Mailer] Preparing to send email via ${host}:${port} as ${smtpEmail}`);

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: {
      user: smtpEmail,
      pass: smtpPassword,
    },
    tls: {
      rejectUnauthorized: port === 587 || port === 25 ? false : true,
      ciphers: 'SSLv3' 
    },
    requireTLS: port === 587 || port === 25
  });

  const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .email-container {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            background-color: #ffffff;
          }
          .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            padding: 32px 24px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 32px 24px;
          }
          .welcome-text {
            font-size: 18px;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 16px;
          }
          .info-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
            text-align: center;
          }
          .label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 8px;
            display: block;
          }
          .password-value {
            font-family: 'Courier New', Courier, monospace;
            font-size: 28px;
            font-weight: 700;
            color: #1e293b;
            letter-spacing: 2px;
            margin: 12px 0;
            display: block;
          }
          .copy-hint {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 8px;
          }
          .btn-container {
            text-align: center;
            margin-top: 32px;
          }
          .btn {
            background-color: #2563eb;
            color: #ffffff !important;
            padding: 12px 32px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            display: inline-block;
            transition: background-color 0.2s;
          }
          .footer {
            background-color: #f1f5f9;
            padding: 24px;
            text-align: center;
            font-size: 13px;
            color: #64748b;
          }
          .footer p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>PROACT REPORTING SYSTEM</h1>
          </div>
          <div class="content">
            <div class="welcome-text">Welcome, ${firstName}!</div>
            <p>Your account has been successfully created. You can now access the PROACT Dashboard using the credentials below.</p>
            
            <div class="info-box">
              <span class="label">Registered Email</span>
              <div style="font-weight: 600; font-size: 16px; color: #1e293b; margin-bottom: 20px;">${userEmail}</div>
              
              <span class="label">Temporary Password</span>
              <div style="margin: 12px 0; display: inline-block; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 16px; position: relative;">
                <span class="password-value" style="margin: 0; display: inline; user-select: all; -webkit-user-select: all;">${tempPassword}</span>
              </div>
              <div class="copy-hint">Tip: Use this password to log in for the first time.</div>
            </div>

            <p>For security reasons, you will be prompted to change this password immediately upon your first login.</p>
            
            <div class="btn-container">
              <a href="${clientUrl}" class="btn">Login to Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} DOST DRRMO - PROACT. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      sender: fromAddress,
      replyTo: senderEmail || smtpEmail,
      to: userEmail,
      subject: "Welcome to PROACT - Your Account Details",
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': Date.now().toString(),
        'X-Auto-Response-Suppress': 'OOF, AutoReply'
      }
    });

    console.log('[Mailer] Email sent successfully to:', userEmail, 'MessageId:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer] Nodemailer Error:', error.message);
    // If it fails, maybe it's because of the spoofed "From" address?
    // Let's try one last time with the auth email if we tried a custom senderEmail
    if (senderEmail && senderEmail !== smtpEmail) {
      console.warn('[Mailer] Retrying with authenticated email as sender...');
      try {
        const info = await transporter.sendMail({
          from: `"${senderName}" <${smtpEmail}>`,
          sender: `"${senderName}" <${smtpEmail}>`,
          replyTo: smtpEmail,
          to: userEmail,
          subject: "Welcome to PROACT - Your Account Details",
          html: htmlContent
        });
        console.log('[Mailer] Email sent successfully on retry:', userEmail);
        return { success: true, messageId: info.messageId };
      } catch (retryError) {
        console.error('[Mailer] Retry failed:', retryError.message);
        return { success: false, error: retryError.message };
      }
    }
    return { success: false, error: error.message };
  }
};

/**
 * Sends a notification email about a new event.
 */
const sendEventNotificationEmail = async (userEmail, eventName, eventDetails) => {
  // Fetch SMTP settings from DB
  let smtpEmail = process.env.OUTLOOK_EMAIL;
  let smtpPassword = process.env.OUTLOOK_PASSWORD;
  let senderName = process.env.OUTLOOK_SENDER_NAME || 'DOST DRRMO';
  let host = 'smtp.office365.com';
  let port = 587;
  let senderEmail = '';

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  try {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['smtp_config']);
    if (rows.length > 0 && rows[0].value) {
      const config = rows[0].value;
      smtpEmail = config.username || smtpEmail;
      smtpPassword = config.password || smtpPassword;
      host = config.host || host;
      port = parseInt(config.port) || port;
      senderEmail = config.senderEmail || '';
      senderName = config.senderName || senderName;
    }
  } catch (dbErr) {
    console.warn('[Mailer] Could not fetch SMTP config from DB', dbErr.message);
  }

  if (!smtpEmail || !smtpPassword) return { success: false, error: 'SMTP not configured' };

  const fromAddress = `"${senderName}" <${senderEmail || smtpEmail}>`;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: smtpEmail, pass: smtpPassword },
    // Only use rejectUnauthorized: false if absolutely necessary for legacy servers
    tls: { 
      rejectUnauthorized: port === 587 || port === 25 ? false : true,
      ciphers: 'SSLv3' 
    }
  });

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #2563eb; padding: 24px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">PROACT Notification</h2>
      </div>
      <div style="padding: 32px 24px; color: #1e293b; line-height: 1.6;">
        <h3 style="margin-top: 0; color: #0f172a;">New Event: ${eventName}</h3>
        <p>A new monitoring event has been created in the PROACT system.</p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Event Details</h4>
          <div style="font-size: 15px;">
            ${eventDetails}
          </div>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <a href="${clientUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">Open Dashboard</a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0;">This is an automated notification from <strong>DOST PROACT</strong>.</p>
        <p style="margin: 4px 0 0 0;">Please do not reply to this email.</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: userEmail,
      subject: `[PROACT] New Event: ${eventName}`,
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': Date.now().toString(),
        'Precedence': 'bulk',
        'X-Auto-Response-Suppress': 'OOF, AutoReply' // Prevents out-of-office loops
      }
    });
    return { success: true };
  } catch (error) {
    console.error('[Mailer] Event Email Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendWelcomeEmail, sendEventNotificationEmail };

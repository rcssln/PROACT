const nodemailer = require('nodemailer');
const pool = require('../db');

/**
 * Sends a welcome email using Outlook via Nodemailer.
 */
const sendWelcomeEmail = async (userEmail, firstName, tempPassword) => {
  let outlookEmail = process.env.OUTLOOK_EMAIL;
  let outlookPassword = process.env.OUTLOOK_PASSWORD;
  let senderName = process.env.OUTLOOK_SENDER_NAME || 'DOST DRRMO';
  let host = 'smtp-mail.outlook.com';
  let port = 587;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  try {
    // Attempt to fetch SMTP settings from DB
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['smtp_config']);
    if (rows.length > 0 && rows[0].value) {
      const config = rows[0].value;
      if (config.username && config.password) {
        outlookEmail = config.username;
        outlookPassword = config.password;
        host = config.host || host;
        port = parseInt(config.port) || port;
        if (config.senderEmail) {
          senderName = 'PROACT Admin';
          // Use format "Sender Name <email>" if possible, but some providers require the from address to match the auth user.
          // The user requested: "sender email address (for the main email to not show) ex: noreply@gmail.com"
          // We will put it in the "from" field. Note: For Outlook/Office365, sending from a different address requires "Send As" permissions.
        }
      }
    }
  } catch (dbErr) {
    console.warn('[Mailer] Could not fetch SMTP config from DB, falling back to ENV', dbErr.message);
  }

  if (!outlookEmail || !outlookPassword || outlookEmail === 'your_email@outlook.com') {
    console.warn('[Mailer] OUTLOOK_EMAIL or OUTLOOK_PASSWORD is not configured. Skipping email.');
    return { success: false, error: 'Outlook credentials not configured' };
  }

  let fromAddress = `"${senderName}" <${outlookEmail}>`;
  
  // If the user specified a senderEmail in settings (like noreply@gmail.com), we try to use it for masking
  try {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', ['smtp_config']);
    if (rows.length > 0 && rows[0].value) {
      const dbConfig = rows[0].value;
      if (dbConfig.senderEmail) {
        // This is the "noreply@gmail.com" part the user wanted
        fromAddress = `"${senderName}" <${dbConfig.senderEmail}>`;
      }
    }
  } catch (e) {
    console.error('[Mailer] Error constructing fromAddress:', e.message);
  }

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465, 
    auth: {
      user: outlookEmail,
      pass: outlookPassword,
    },
    tls: {
      // Many modern providers require this for security, but allow fallback for older ones
      rejectUnauthorized: false
    }
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
                <div style="display: inline-block; margin-left: 12px; padding: 4px 8px; background: #2563eb; color: #ffffff; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; cursor: pointer;">
                  Copy
                </div>
              </div>
              <div class="copy-hint">Tip: Double-click the password to quickly select it</div>
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
      to: userEmail,
      subject: "Welcome to PROACT - Your Account Details",
      html: htmlContent
    });

    console.log('[Mailer] Email sent successfully to:', userEmail, 'MessageId:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer] Nodemailer Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendWelcomeEmail };

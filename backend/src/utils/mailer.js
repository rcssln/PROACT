const axios = require('axios');

/**
 * Sends a welcome email using the Brevo API directly via HTTP.
 * This avoids issues with the SDK constructor.
 */
const sendWelcomeEmail = async (userEmail, firstName, tempPassword) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'crtpatongan@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'DOST DRRMO';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (!apiKey || apiKey === 'your_api_key_here') {
    console.warn('[Mailer] BREVO_API_KEY is not configured. Skipping email.');
    return { success: false, error: 'API Key not configured' };
  }

  const emailData = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: userEmail, name: firstName }],
    subject: "Welcome to PROACT - Your Account Details",
    htmlContent: `
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
    `
  };

  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', emailData, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Mailer] Email sent successfully to:', userEmail);
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error('[Mailer] Brevo API Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
};

module.exports = { sendWelcomeEmail };

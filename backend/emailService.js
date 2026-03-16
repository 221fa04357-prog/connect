const nodemailer = require('nodemailer');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Detect whether real SMTP credentials have been provided
// ─────────────────────────────────────────────────────────────────────────────
const PLACEHOLDERS = ['your_gmail@gmail.com', 'your_app_password_here', '', undefined, null];

function isSmtpConfigured() {
    return (
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        !PLACEHOLDERS.includes(process.env.SMTP_USER.trim()) &&
        !PLACEHOLDERS.includes(process.env.SMTP_PASS.trim())
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the transporter only if credentials are present
// ─────────────────────────────────────────────────────────────────────────────
let transporter = null;

function buildTransporter() {
    const port = parseInt(process.env.SMTP_PORT || '587');
    // Port 465 requires secure:true (SSL). Port 587/25 use STARTTLS (secure:false).
    const secure = port === 465 ? true : (process.env.SMTP_SECURE === 'true');

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER.trim(),
            pass: process.env.SMTP_PASS.trim(),
        },
        // Connection & socket timeouts (ms)
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        // Pool connections for high throughput
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        // TLS options – accept self-signed certs in dev
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify SMTP connection at startup (non-blocking)
// ─────────────────────────────────────────────────────────────────────────────
async function verifySmtpConnection() {
    if (!isSmtpConfigured()) {
        console.warn('[EMAIL_SERVICE] ⚠️  SMTP not configured. OTPs will be logged to console (DEV MODE).');
        console.warn('[EMAIL_SERVICE]    → Set SMTP_USER and SMTP_PASS in backend/.env to enable real emails.');
        return;
    }

    transporter = buildTransporter();

    try {
        await transporter.verify();
        console.log(`[EMAIL_SERVICE] ✅ SMTP connection verified → ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} (user: ${process.env.SMTP_USER})`);
    } catch (err) {
        console.error('[EMAIL_SERVICE] ❌ SMTP connection FAILED at startup:');
        console.error(`[EMAIL_SERVICE]    → ${err.message}`);
        console.error('[EMAIL_SERVICE]    Common fixes:');
        console.error('[EMAIL_SERVICE]      • Gmail: use an App Password, not your login password');
        console.error('[EMAIL_SERVICE]        https://myaccount.google.com/apppasswords');
        console.error('[EMAIL_SERVICE]      • Gmail: 2-Step Verification must be ON');
        console.error('[EMAIL_SERVICE]      • Port 587 requires SMTP_SECURE=false (STARTTLS)');
        console.error('[EMAIL_SERVICE]      • Port 465 requires SMTP_SECURE=true  (SSL)');
        // Null out broken transporter so we fall back to console logging
        transporter = null;
    }
}

// Run verification at module load
verifySmtpConnection();

// ─────────────────────────────────────────────────────────────────────────────
// Build the professional HTML email body
// ─────────────────────────────────────────────────────────────────────────────
function buildOtpHtml(otp, email) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your NeuralChat account</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0B5CFF 0%,#1a3aff 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">NeuralChat</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Secure Email Verification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#333;line-height:1.6;">Hello,</p>
              <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7;">
                To complete your account registration, please use the 6-digit verification code below.
                This code will expire in <strong style="color:#0B5CFF;">5 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 0;">
                    <div style="display:inline-block;background:#f0f5ff;border:2px dashed #0B5CFF;border-radius:12px;padding:18px 36px;">
                      <span style="font-size:42px;font-weight:800;letter-spacing:14px;color:#0B5CFF;font-family:monospace;">${otp}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.6;border-top:1px solid #eee;padding-top:20px;">
                This code was requested for <strong>${email}</strong>.<br/>
                If you did not create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fc;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaa;">© 2026 NeuralChat. All rights reserved.</p>
              <p style="margin:6px 0 0;font-size:11px;color:#bbb;">This is an automated message, please do not reply.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main send function — with retry logic
// ─────────────────────────────────────────────────────────────────────────────
async function sendOTPEmail(email, otp, retries = 2) {
    // Validate email format before attempting to send
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.error(`[EMAIL_SERVICE] Invalid email address format: ${email}`);
        return { success: false, error: 'Invalid email address format' };
    }

    // ── Check Configuration & Fallback ──────────────────────────
    if (!isSmtpConfigured() || !transporter) {
        console.log('\n╔══════════════════════════════════════════╗');
        console.log('║        EMAIL SERVICE — DEV MODE           ║');
        console.log('╠══════════════════════════════════════════╣');
        console.log(`║  To: ${email.padEnd(36)}║`);
        console.log(`║  OTP: ${otp.padEnd(35)}║`);
        console.log('╠══════════════════════════════════════════╣');
        console.log('║  ⚠️  SMTP not configured. Real emails     ║');
        console.log('║  disabled. Check backend console for OTP. ║');
        console.log('╚══════════════════════════════════════════╝\n');
        
        return { 
            success: true, 
            devMode: true,
            warning: 'Running in developer mode (no real email sent)'
        };
    }

    // ── PRODUCTION MODE: attempt delivery ──────────────────────────────────
    const fromName = process.env.SMTP_FROM_NAME || 'NeuralChat';
    const fromAddr = process.env.SMTP_FROM_ADDR || process.env.SMTP_USER.trim();

    const mailOptions = {
        from: `"${fromName}" <${fromAddr}>`,
        to: email,
        subject: `${otp} is your NeuralChat verification code`,
        html: buildOtpHtml(otp, email),
        // Plain-text fallback for email clients that don't render HTML
        text: `Your NeuralChat verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
        // Headers to improve deliverability
        headers: {
            'X-Priority': '1',
            'X-Mailer': 'NeuralChat Mailer',
        },
    };

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            console.log(`[EMAIL_SERVICE] Attempt ${attempt}/${retries + 1}: Sending OTP to ${email}...`);
            const info = await transporter.sendMail(mailOptions);
            console.log(`[EMAIL_SERVICE] ✅ Email sent successfully to ${email}`);
            console.log(`[EMAIL_SERVICE]    Message ID: ${info.messageId}`);
            if (info.accepted?.length) console.log(`[EMAIL_SERVICE]    Accepted: ${info.accepted.join(', ')}`);
            if (info.rejected?.length) console.warn(`[EMAIL_SERVICE]    ⚠️ Rejected: ${info.rejected.join(', ')}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`[EMAIL_SERVICE] ❌ Attempt ${attempt} failed: ${error.message}`);
            console.error(`[EMAIL_SERVICE]    Code: ${error.code || 'N/A'} | Command: ${error.command || 'N/A'}`);

            if (attempt <= retries) {
                const waitMs = attempt * 1500; // 1.5s, then 3s
                console.log(`[EMAIL_SERVICE]    Retrying in ${waitMs}ms...`);
                await new Promise(r => setTimeout(r, waitMs));
            } else {
                // All attempts exhausted — give a diagnostic hint
                let hint = '';
                if (error.code === 'EAUTH')       hint = 'Authentication failed. Check SMTP_USER and SMTP_PASS. For Gmail, use an App Password.';
                else if (error.code === 'ECONNECTION') hint = 'Cannot connect to SMTP server. Check SMTP_HOST and SMTP_PORT, and ensure port is not blocked by firewall.';
                else if (error.code === 'ETIMEDOUT') hint = 'Connection timed out. Your network or hosting provider may be blocking outbound SMTP (port 587/465).';
                else if (error.responseCode === 550)  hint = 'Recipient rejected. The email address may not exist or the domain blocks automated mail.';
                else if (error.responseCode === 535)  hint = 'Credentials rejected. Use an App Password for Gmail, not your regular password.';

                console.error(`[EMAIL_SERVICE] 🔴 All ${retries + 1} attempts failed.`);
                if (hint) console.error(`[EMAIL_SERVICE]    💡 Hint: ${hint}`);
                return { success: false, error: error.message, code: error.code };
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic: test SMTP without sending a real OTP
// ─────────────────────────────────────────────────────────────────────────────
async function testSmtpConnection() {
    if (!isSmtpConfigured()) {
        return { configured: false, message: 'SMTP credentials not set in .env' };
    }

    const t = buildTransporter();
    try {
        await t.verify();
        return {
            configured: true,
            connected: true,
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            message: 'SMTP connection successful'
        };
    } catch (err) {
        return {
            configured: true,
            connected: false,
            error: err.message,
            code: err.code,
            message: 'SMTP connection failed'
        };
    }
}

module.exports = {
    sendOTPEmail,
    testSmtpConnection,
    isSmtpConfigured,
};

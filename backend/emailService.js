const { Resend } = require('resend');
require('dotenv').config();

// Initialize Resend lazily or with a fallback to avoid crashes if API key is missing during startup
const getResendClient = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn('[EmailService] Warning: RESEND_API_KEY is not defined in environment variables.');
    }
    return new Resend(apiKey);
};

const resend = getResendClient();

/**
 * Sends a verification email with a 6-digit OTP
 * @param {string} email - Recipient's email address
 * @param {string} code - The 6-digit verification code
 */
const sendVerificationEmail = async (email, code) => {
    try {
        console.log(`[EmailService] Attempting to send verification email to: ${email}`);
        
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is missing. Cannot send verification email.');
        }

        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev', // Simplified 'from' as display names can sometimes block sends on unverified domains
            to: [email],
            subject: 'Verify your email',
            html: `<strong>Your verification code is: ${code}</strong>`,
        });

        if (error) {
            console.error('[EmailService] Resend API Error:', error);
            // Provide more detail in the error message if possible
            const errorMsg = error.message || JSON.stringify(error);
            throw new Error(`Failed to send verification email: ${errorMsg}`);
        }

        console.log(`[EmailService] Verification email sent successfully to ${email}. ID: ${data ? data.id : 'unknown'}`);
        return data;
    } catch (err) {
        console.error('[EmailService] Unexpected Error:', err.message || err);
        throw err;
    }
};

module.exports = {
    sendVerificationEmail
};


const { Resend } = require('resend');
require('dotenv').config();

// Use the environment variable RESEND_API_KEY
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends a verification email with a 6-digit OTP
 * @param {string} email - Recipient's email address
 * @param {string} code - The 6-digit verification code
 */
const sendVerificationEmail = async (email, code) => {
    try {
        console.log(`[EmailService] Attempting to send verification email to: ${email}`);
        
        const { data, error } = await resend.emails.send({
            from: 'NeuralChat <onboarding@resend.dev>',
            to: [email],
            subject: 'Verify your email',
            html: `<strong>Your verification code is: ${code}</strong>`,
        });

        if (error) {
            console.error('[EmailService] Resend API Error:', error);
            throw new Error(`Failed to send verification email: ${error.message}`);
        }

        console.log(`[EmailService] Verification email sent successfully to ${email}. ID: ${data.id}`);
        return data;
    } catch (err) {
        console.error('[EmailService] unexpected Error:', err);
        throw err;
    }
};

module.exports = {
    sendVerificationEmail
};

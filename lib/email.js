import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL; // Verified sender

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log("SendGrid mail client configured.");
} else {
  console.warn("SENDGRID_API_KEY is not set. Email functionality will be disabled.");
}

/**
 * Sends an email with an attachment.
 * @param {object} mailOptions
 * @param {string} mailOptions.to Recipient email address.
 * @param {string} mailOptions.subject Email subject.
 * @param {string} mailOptions.text Plain text body (optional).
 * @param {string} mailOptions.html HTML body.
 * @param {Array<{content: string, filename: string, type: string, disposition: string}>} mailOptions.attachments Array of attachment objects.
 *        Content should be base64 encoded string.
 * @returns {Promise<void>}
 * @throws {Error} If sending fails or SendGrid is not configured.
 */
export const sendEmailWithAttachment = async ({ to, subject, text, html, attachments }) => {
  if (!SENDGRID_API_KEY) {
    throw new Error("SendGrid API Key not configured. Cannot send email.");
  }
  if (!SENDGRID_FROM_EMAIL) {
    throw new Error("SendGrid From Email not configured. Cannot send email.");
  }
  if (!to) {
    throw new Error("Recipient email ('to') is required.");
  }

  const msg = {
    to,
    from: SENDGRID_FROM_EMAIL,
    subject,
    text, // Optional: for clients that don't render HTML
    html,
    attachments, // Example: [{ content: 'base64EncodedString', filename: 'report.pdf', type: 'application/pdf', disposition: 'attachment' }]
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${to} with subject "${subject}".`);
  } catch (error) {
    console.error("Error sending email via SendGrid:", error);
    if (error.response) {
      console.error("SendGrid error details:", error.response.body);
    }
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

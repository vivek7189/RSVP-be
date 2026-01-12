import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();


const isEmailConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;


const transporter = isEmailConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}) : null;

export const sendCancellationEmail = async (
  email: string,
  name: string,
  token: string
): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3030';
  const cancellationLink = `${frontendUrl}/cancel?token=${token}`;

  if (!isEmailConfigured || !transporter) {
    console.log('\n=== DUMMY EMAIL (Email not configured) ===');
    console.log(`To: ${email}`);
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Event RSVP" <noreply@example.com>',
    to: email,
    subject: 'RSVP Confirmation - Cancellation Link',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>RSVP Confirmed!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for confirming your attendance. We're looking forward to seeing you at the event!</p>

        <h3>Event Details:</h3>
        <p><strong>Your RSVP has been successfully registered.</strong></p>

    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Cancellation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send cancellation email');
  }
};

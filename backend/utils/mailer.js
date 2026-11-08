const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: `"AdNU Trade Support" <${process.env.MAIL_USER}>`, // Matches your actual login user
    to: toEmail,
    subject: 'Your AdNU Trade Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #2b47a3; text-align: center;">Ateneo de Naga University Trade</h2>
        <p>Thank you for registering. Use the verification code below to complete your account setup:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="background: #f1f5f9; padding: 12px 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #2b47a3; border-radius: 8px; display: inline-block;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail };
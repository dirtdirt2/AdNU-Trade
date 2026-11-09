const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'AdNU Trade Support <onboarding@resend.dev>';

async function sendOtpEmail(toEmail, otp) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  if (typeof toEmail !== 'string' || !toEmail.trim()) {
    throw new Error('A valid recipient email address is required.');
  }

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #2b47a3; text-align: center;">Ateneo de Naga University Trade</h2>
      <p>Thank you for registering. Use the verification code below to complete your account setup:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="background: #f1f5f9; padding: 12px 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #2b47a3; border-radius: 8px; display: inline-block;">${otp}</span>
      </div>
      <p style="font-size: 13px; color: #64748b; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail.trim()],
      subject: 'Your AdNU Trade Verification Code',
      html,
      text: `Your AdNU Trade verification code is ${otp}. It will expire in 10 minutes.`
    })
  });

  const responseText = await response.text();
  let result = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }
  }

  if (!response.ok) {
    const details =
      result.message ||
      result.error?.message ||
      result.error ||
      response.statusText ||
      `HTTP ${response.status}`;

    throw new Error(
      `Resend API error (${response.status}): ${
        typeof details === 'string' ? details : JSON.stringify(details)
      }`
    );
  }

  return result;
}

module.exports = { sendOtpEmail };

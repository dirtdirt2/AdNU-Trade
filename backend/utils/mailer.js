async function sendOtpEmail(toEmail, otp) {
  const relayUrl = process.env.EMAIL_RELAY_URL;
  const relaySecret = process.env.EMAIL_RELAY_SECRET;

  if (!relayUrl || !relaySecret) {
    throw new Error('Email relay configuration is missing.');
  }

  if (typeof toEmail !== 'string' || !toEmail.trim()) {
    throw new Error('A valid recipient email address is required.');
  }

  const otpCode = String(otp);

  if (!/^\d{6}$/.test(otpCode)) {
    throw new Error('A valid six-digit OTP is required.');
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(relayUrl);
  } catch {
    throw new Error('EMAIL_RELAY_URL is invalid.');
  }

  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'script.google.com'
  ) {
    throw new Error('EMAIL_RELAY_URL must be a Google Apps Script HTTPS URL.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response;

  try {
    response = await fetch(relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        secret: relaySecret,
        to: toEmail.trim(),
        otp: otpCode
      }),
      signal: controller.signal,
      redirect: 'follow'
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Email relay connection timed out.');
    }

    throw new Error(`Could not connect to email relay: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  let result = {};

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('Email relay returned an invalid response.');
    }
  }

  if (!response.ok || result.ok !== true) {
    throw new Error(
      result.error || `Email relay request failed (${response.status}).`
    );
  }

  return result;
}

module.exports = { sendOtpEmail };
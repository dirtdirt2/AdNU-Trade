const express = require('express');
const { randomInt } = require('crypto');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/mailer');

// 1. REGISTER: Check existing user, send email, then create/update record
router.post('/register', async (req, res) => {
  try {
    const { idNumber, first, last, email, password, role } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (typeof first !== 'string' || !first.trim() || typeof last !== 'string' || !last.trim()) {
      return res.status(400).json({ error: 'First name and last name are required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (typeof idNumber !== 'string' || !/^\d{9}$/.test(idNumber)) {
      return res.status(400).json({ error: 'Your university ID must contain exactly 9 digits.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate AdNU email domain
    if (!/^[^\s@]+@adnu\.edu\.ph$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Only @adnu.edu.ph emails are allowed.' });
    }

    // CHECK FOR EXISTING USER
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ error: 'This email is already registered and verified. Please sign in instead.' });
    }

    // Only the account types supported by AdNU Trade may be registered.
    const userRole = typeof role === 'string' && role.trim() ? role.trim().toLowerCase() : 'student';
    const allowedRoles = new Set(['student', 'teacher', 'staff', 'admin']);
    if (!allowedRoles.has(userRole)) {
      return res.status(400).json({ error: 'Invalid account type.' });
    }

    // Admin accounts require approval from an existing administrator.
    const isApprovedStatus = userRole !== 'admin';

    // Use a cryptographically secure generator for the six-digit verification code.
    const otpCode = randomInt(100000, 1000000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Send the email first
    await sendOtpEmail(normalizedEmail, otpCode);

    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = `${first || ''} ${last || ''}`.trim() || 'AdNU User';

    // Save or update unverified user record
    await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        idNumber,
        fullName,
        password: hashedPassword,
        role: userRole,
        otpCode,
        otpExpiresAt,
        isVerified: false,
        isApproved: isApprovedStatus
      },
      create: {
        idNumber,
        email: normalizedEmail,
        fullName,
        password: hashedPassword,
        role: userRole,
        otpCode,
        otpExpiresAt,
        isVerified: false,
        isApproved: isApprovedStatus
      }
    });

    res.json({ message: 'Verification code sent successfully to your AdNU email.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to send verification email. Please check if your email address is correct and active.' });
  }
});

// 2. VERIFY OTP: Confirm code and mark user as verified
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (typeof email !== 'string' || !email.trim() || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'A valid email and six-digit verification code are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || user.otpCode !== code || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    // Mark user as verified and clear temporary OTP fields
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null
      }
    });

    res.json({ message: 'Email verified successfully!' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// 3. FORGOT PASSWORD: Send reset code
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ error: 'Email is required.' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.json({ message: 'If an account exists, a reset code was sent.' });
    }

    const resetOtp = randomInt(100000, 1000000).toString();
    const resetExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await prisma.user.update({
      where: { id: user.id },
      data: { resetOtp, resetExpiresAt }
    });

    await sendOtpEmail(normalizedEmail, resetOtp);

    res.json({ message: 'If an account exists, a reset code was sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// 4. RESET PASSWORD: Verify code & update password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (typeof email !== 'string' || !email.trim() || typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'A valid email, six-digit reset code, and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (
      !user ||
      !user.resetOtp ||
      user.resetOtp !== code ||
      !user.resetExpiresAt ||
      new Date() > new Date(user.resetExpiresAt)
    ) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetExpiresAt: null
      }
    });

    res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// 5. LOGIN: Existing user account
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Please provide email/ID and password.' });
    }

    const input = email.trim();
    const normalizedEmail = input.toLowerCase();

    // 1. Find user in the database (supports email or student ID lookup)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { idNumber: input }
        ]
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // 3. Email verification is required for every account type.
    if (user.isVerified !== true) {
      return res.status(403).json({
        error: 'Please verify your AdNU email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // 4. Check if admin account is approved by an existing admin
    if (user.role === 'admin' && !user.isApproved) {
      return res.status(403).json({
        error: 'Your administrator account is pending approval from an existing admin.'
      });
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, fullName: user.fullName, idNumber: user.idNumber, isVerified: true, isApproved: user.isApproved === true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Send token AND user details
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. GOOGLE AUTHENTICATION STRATEGY
// OAuth is optional during local development. Do not let blank credentials
// prevent the entire backend from starting.
const googleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
);

if (googleOAuthConfigured) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const emailRecord = profile.emails?.find((entry) => typeof entry.value === 'string');
      const email = emailRecord?.value?.trim().toLowerCase();
      const googleVerifiedEmail = profile._json?.email_verified === true || emailRecord?.verified === true;

      if (!email || !email.endsWith('@adnu.edu.ph') || !googleVerifiedEmail) {
        return done(null, false, { message: 'Use a Google-verified @adnu.edu.ph email address.' });
      }

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            fullName: profile.displayName,
            role: 'student',
            isVerified: true,
            isApproved: true,
          },
        });
      } else if (!user.isVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true, otpCode: null, otpExpiresAt: null },
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/api/auth/login-failed' }),
    (req, res) => {
      if (req.user.role === 'admin' && !req.user.isApproved) {
        return res.status(403).json({ error: 'Your administrator account is pending approval.' });
      }

      const token = jwt.sign(
        {
          userId: req.user.id,
          email: req.user.email,
          role: req.user.role,
          fullName: req.user.fullName,
          idNumber: req.user.idNumber,
          isVerified: req.user.isVerified === true,
          isApproved: req.user.isApproved === true,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Successfully authenticated with AdNU account!',
        token,
        user: {
          id: req.user.id,
          email: req.user.email,
          fullName: req.user.fullName,
          idNumber: req.user.idNumber,
          role: req.user.role,
        },
      });
    }
  );
} else {
  const googleOAuthUnavailable = (_req, res) => res.status(503).json({
    error: 'Google sign-in is not configured on this server. Use email and password instead.',
  });
  router.get('/google', googleOAuthUnavailable);
  router.get('/google/callback', googleOAuthUnavailable);
}

router.get('/login-failed', (req, res) => {
  res.status(403).json({ error: 'Authentication failed. Make sure you are using an official @adnu.edu.ph account.' });
});

module.exports = router;
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const publicUserSelect = {
  id: true,
  idNumber: true,
  email: true,
  fullName: true,
  role: true,
  isVerified: true,
  isApproved: true,
  createdAt: true,
};

const issueToken = (user) => jwt.sign(
  {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    idNumber: user.idNumber,
    isVerified: user.isVerified === true,
    isApproved: user.isApproved === true,
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// Return only persisted account fields. Do not expose password or OTP data.
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: publicUserSelect,
    });

    if (!user) return res.status(404).json({ error: 'Account not found.' });
    res.json({ user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Could not load your profile.' });
  }
});

// Update the real User.fullName record and issue a refreshed JWT so the
// new name is reflected in components that read the signed session token.
router.patch('/me', verifyToken, async (req, res) => {
  try {
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim().replace(/\s+/g, ' ') : '';
    if (fullName.length < 2 || fullName.length > 120) {
      return res.status(400).json({ error: 'Enter a name between 2 and 120 characters.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { fullName },
      select: publicUserSelect,
    });

    res.json({
      message: 'Profile name updated successfully.',
      user,
      token: issueToken(user),
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Could not update your profile.' });
  }
});

router.patch('/me/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Enter your current password and a new password.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'New password needs 8+ characters, an uppercase letter, a number, and a special character.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (!user.password) {
      return res.status(400).json({ error: 'This account does not have a password login configured.' });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) return res.status(400).json({ error: 'Your current password is incorrect.' });

    const password = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password } });
    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Could not change your password.' });
  }
});

// Persistent saved items belong to the signed-in account (not browser memory).
router.get('/favorites', verifyToken, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.userId },
      include: {
        product: {
          include: { seller: { select: { id: true, fullName: true, role: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(favorites.map((favorite) => favorite.product));
  } catch (error) {
    console.error('Error fetching saved items:', error);
    res.status(500).json({ error: 'Could not load your saved items.' });
  }
});

router.post('/favorites/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, status: true } });
    if (!product || product.status !== 'approved') {
      return res.status(404).json({ error: 'This listing is no longer available to save.' });
    }

    await prisma.favorite.upsert({
      where: { userId_productId: { userId: req.user.userId, productId } },
      update: {},
      create: { userId: req.user.userId, productId },
    });
    res.status(201).json({ message: 'Item saved.' });
  } catch (error) {
    console.error('Error saving item:', error);
    res.status(500).json({ error: 'Could not save this item.' });
  }
});

router.delete('/favorites/:productId', verifyToken, async (req, res) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user.userId, productId: req.params.productId },
    });
    res.json({ message: 'Item removed from saved items.' });
  } catch (error) {
    console.error('Error removing saved item:', error);
    res.status(500).json({ error: 'Could not remove this saved item.' });
  }
});

module.exports = router;

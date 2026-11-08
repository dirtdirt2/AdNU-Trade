const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');
const { notifyAdmins } = require('../utils/notifications');

const router = express.Router();
const prisma = new PrismaClient();
const proofDirectory = path.join(__dirname, '..', 'private-uploads', 'listing-payment-proofs');
fs.mkdirSync(proofDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, proofDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  },
});

const uploadProof = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return callback(new Error('Payment proof must be a JPG, PNG, WEBP, or PDF file.'));
    }
    callback(null, true);
  },
});

// Sellers receive transfer instructions only for their own product with an accepted fee.
router.get('/:productId/instructions', verifyToken, async (req, res) => {
  try {
    const feeFreeSetting = await prisma.appSetting.findUnique({ where: { key: 'free_listings_enabled' } });
    if (feeFreeSetting?.value) {
      return res.status(409).json({ error: 'Listing fees are currently waived. No e-wallet payment is required.' });
    }
    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, sellerId: req.user.userId },
      include: { listingFees: { where: { status: 'accepted' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!product) return res.status(404).json({ error: 'Your product listing was not found.' });
    if (product.listingFeeWaived) {
      return res.status(409).json({ error: 'Listing fees are waived for this listing. No e-wallet payment is required.' });
    }
    if (product.status !== 'awaiting_payment') {
      return res.status(409).json({ error: 'This listing is not currently awaiting payment.' });
    }
    const acceptedFee = product.listingFees[0];
    if (!acceptedFee) return res.status(409).json({ error: 'No accepted listing fee was found.' });

    res.json({
      amount: acceptedFee.proposedFee,
      instructions: {
        provider: process.env.LISTING_EWALLET_PROVIDER || '',
        accountName: process.env.LISTING_EWALLET_ACCOUNT_NAME || '',
        accountNumber: process.env.LISTING_EWALLET_ACCOUNT_NUMBER || '',
      },
    });
  } catch (error) {
    console.error('Error fetching listing payment instructions:', error);
    res.status(500).json({ error: 'Could not load payment instructions.' });
  }
});

const parsePaymentProof = (req, res, next) => {
  uploadProof.single('proof')(req, res, (error) => {
    if (error) return res.status(400).json({ error: error.message || 'Could not process payment proof.' });
    next();
  });
};

// The amount always comes from the accepted fee in the database, never from the browser.
router.post('/:productId', verifyToken, parsePaymentProof, async (req, res) => {
  try {
    const { productId } = req.params;
    const { walletProvider, senderName, referenceNumber } = req.body;
    const feeFreeSetting = await prisma.appSetting.findUnique({ where: { key: 'free_listings_enabled' } });
    if (feeFreeSetting?.value) {
      if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ error: 'Listing fees are currently waived. No e-wallet payment is required.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Upload your e-wallet transfer receipt or screenshot.' });
    if (!walletProvider?.trim() || !referenceNumber?.trim()) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'E-wallet provider and transfer reference number are required.' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, sellerId: req.user.userId },
      include: { listingFees: { where: { status: 'accepted' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!product) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Your product listing was not found.' });
    }
    if (product.listingFeeWaived) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ error: 'Listing fees are waived for this listing. No e-wallet payment is required.' });
    }
    if (product.status !== 'awaiting_payment') {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ error: 'This listing is not currently accepting a payment submission.' });
    }
    const acceptedFee = product.listingFees[0];
    if (!acceptedFee) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(409).json({ error: 'No accepted listing fee was found.' });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const transition = await tx.product.updateMany({
        where: { id: productId, sellerId: req.user.userId, status: 'awaiting_payment' },
        data: { status: 'payment_submitted' },
      });
      if (transition.count !== 1) {
        throw new Error('This listing already has a payment submission or is no longer awaiting payment.');
      }
      const submitted = await tx.listingPayment.create({
        data: {
          productId,
          listingFeeId: acceptedFee.id,
          sellerId: req.user.userId,
          amount: acceptedFee.proposedFee,
          walletProvider: walletProvider.trim(),
          senderName: senderName?.trim() || null,
          referenceNumber: referenceNumber.trim(),
          proofImage: req.file.filename,
          status: 'submitted',
        },
      });
      await notifyAdmins(tx, {
        type: 'payment_submitted',
        title: 'Listing payment needs verification',
        body: `A seller submitted an e-wallet payment proof for "${product.title}".`,
        link: '#/admin',
        entityId: productId,
      });
      return submitted;
    });

    res.status(201).json({
      message: 'Payment proof submitted. Your listing will go public after an admin verifies the transfer.',
      payment,
    });
  } catch (error) {
    if (req.file?.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }
    console.error('Error submitting listing payment:', error);
    res.status(500).json({ error: error.message || 'Could not submit listing payment.' });
  }
});

module.exports = router;

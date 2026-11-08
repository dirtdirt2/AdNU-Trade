
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');
const { notifyAdmins } = require('../utils/notifications');

const {
  uploadPaymentProof,
  deletePaymentProof,
} = require('../utils/cloudinaryProofs');

const router = express.Router();
const prisma = new PrismaClient();
const proofDirectory = path.join(__dirname, '..', 'private-uploads', 'listing-payment-proofs');

fs.mkdirSync(proofDirectory, { recursive: true });

const PAYMENT_PROOF_MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, proofDirectory),
  filename: (_req, file, callback) => {
    const extension = PAYMENT_PROOF_MIME_EXTENSIONS[file.mimetype];
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const uploadProof = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 16 * 1024,
    parts: 12,
  },
  fileFilter: (_req, file, callback) => {
    if (!Object.prototype.hasOwnProperty.call(PAYMENT_PROOF_MIME_EXTENSIONS, file.mimetype)) {
      const error = new Error('Payment proof must be a JPG, PNG, WEBP, or PDF file.');
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

const hasValidPaymentProofSignature = (mimeType, header) => {
  switch (mimeType) {
    case 'image/jpeg':
      return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case 'image/png':
      return header.length >= 8 && header.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    case 'image/webp':
      return header.length >= 12 &&
        header.toString('ascii', 0, 4) === 'RIFF' &&
        header.toString('ascii', 8, 12) === 'WEBP';
    case 'application/pdf':
      return header.length >= 5 && header.toString('ascii', 0, 5) === '%PDF-';
    default:
      return false;
  }
};

const validatePaymentProof = async (file) => {
  const handle = await fs.promises.open(file.path, 'r');

  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);

    if (!hasValidPaymentProofSignature(file.mimetype, header.subarray(0, bytesRead))) {
      const error = new Error(
        'The uploaded payment proof does not match a supported JPG, PNG, WEBP, or PDF file.'
      );
      error.statusCode = 400;
      throw error;
    }
  } finally {
    await handle.close().catch(() => {});
  }
};

// Sellers receive transfer instructions only for their own product with an accepted fee.
router.get('/:productId/instructions', verifyToken, async (req, res) => {
  try {
    const feeFreeSetting = await prisma.appSetting.findUnique({
      where: { key: 'free_listings_enabled' },
    });

    if (feeFreeSetting?.value) {
      return res.status(409).json({
        error: 'Listing fees are currently waived. No e-wallet payment is required.',
      });
    }

    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, sellerId: req.user.userId },
      include: {
        listingFees: {
          where: { status: 'accepted' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Your product listing was not found.' });
    }

    if (product.listingFeeWaived) {
      return res.status(409).json({
        error: 'Listing fees are waived for this listing. No e-wallet payment is required.',
      });
    }

    if (product.status !== 'awaiting_payment') {
      return res.status(409).json({
        error: 'This listing is not currently awaiting payment.',
      });
    }

    const acceptedFee = product.listingFees[0];

    if (!acceptedFee) {
      return res.status(409).json({ error: 'No accepted listing fee was found.' });
    }

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
    if (error) {
      return res.status(400).json({
        error: error.message || 'Could not process payment proof.',
      });
    }
    next();
  });
};

// The amount always comes from the accepted fee in the database, never from the browser.
router.post('/:productId', verifyToken, parsePaymentProof, async (req, res) => {
  let uploadedProof = null;

  try {
    const { productId } = req.params;
    const { walletProvider, senderName, referenceNumber } = req.body;

    const feeFreeSetting = await prisma.appSetting.findUnique({
      where: { key: 'free_listings_enabled' },
    });

    if (feeFreeSetting?.value) {
      return res.status(409).json({
        error: 'Listing fees are currently waived. No e-wallet payment is required.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Upload your e-wallet transfer receipt or screenshot.',
      });
    }

    await validatePaymentProof(req.file);

    if (
      typeof walletProvider !== 'string' ||
      !walletProvider.trim() ||
      walletProvider.trim().length > 50 ||
      typeof referenceNumber !== 'string' ||
      !referenceNumber.trim() ||
      referenceNumber.trim().length > 100 ||
      (senderName !== undefined &&
        (typeof senderName !== 'string' || senderName.trim().length > 120))
    ) {
      return res.status(400).json({
        error: 'E-wallet provider and transfer reference number are required.',
      });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, sellerId: req.user.userId },
      include: {
        listingFees: {
          where: { status: 'accepted' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Your product listing was not found.' });
    }

    if (product.listingFeeWaived) {
      return res.status(409).json({
        error: 'Listing fees are waived for this listing. No e-wallet payment is required.',
      });
    }

    if (product.status !== 'awaiting_payment') {
      return res.status(409).json({
        error: 'This listing is not currently accepting a payment submission.',
      });
    }

    const acceptedFee = product.listingFees[0];

    if (!acceptedFee) {
      return res.status(409).json({ error: 'No accepted listing fee was found.' });
    }

    // Upload only after all preliminary validations pass.
    const proof = await uploadPaymentProof(req.file);

    uploadedProof = {
      publicId: proof.publicId,
      resourceType: proof.resourceType,
    };

    const proofReference = proof.reference;

    const payment = await prisma.$transaction(async (tx) => {
      const transition = await tx.product.updateMany({
        where: {
          id: productId,
          sellerId: req.user.userId,
          status: 'awaiting_payment',
        },
        data: { status: 'payment_submitted' },
      });

      if (transition.count !== 1) {
        throw new Error(
          'This listing already has a payment submission or is no longer awaiting payment.'
        );
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
          proofImage: proofReference,
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

    // Database transaction succeeded; retain the Cloudinary asset.
    uploadedProof = null;

    return res.status(201).json({
      message: 'Payment proof submitted. Your listing will go public after an admin verifies the transfer.',
      payment,
    });
  } catch (error) {
    if (uploadedProof) {
      await deletePaymentProof(uploadedProof).catch((cleanupError) => {
        console.error('Could not remove failed Cloudinary payment proof:', cleanupError);
      });
    }

    console.error('Error submitting listing payment:', error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? error.message
        : 'Could not submit listing payment.',
    });
  } finally {
    if (req.file?.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
});

module.exports = router;

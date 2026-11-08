const express = require('express');
const path = require('path');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

router.use(verifyToken, verifyAdmin);

const FREE_LISTINGS_SETTING_KEY = 'free_listings_enabled';

const getFreeListingsEnabled = async (client = prisma) => {
  const setting = await client.appSetting.findUnique({
    where: { key: FREE_LISTINGS_SETTING_KEY },
  });
  return Boolean(setting?.value);
};

// The fee-free switch is stored in MySQL so it persists across admin sessions/restarts.
router.get('/settings/free-listings', async (_req, res) => {
  try {
    res.json({ freeListingsEnabled: await getFreeListingsEnabled() });
  } catch (error) {
    console.error('Error fetching fee-free listing setting:', error);
    res.status(500).json({ error: 'Could not load listing fee settings.' });
  }
});

router.put('/settings/free-listings', async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'The enabled setting must be true or false.' });
    }

    const currentEnabled = await getFreeListingsEnabled();
    if (currentEnabled === enabled) {
      return res.json({ freeListingsEnabled: enabled, message: 'Listing fee settings are already up to date.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({
        where: { key: FREE_LISTINGS_SETTING_KEY },
        create: { key: FREE_LISTINGS_SETTING_KEY, value: enabled },
        update: { value: enabled },
      });

      // Enabling fee-free mode waives in-progress fees, but listings still require
      // an administrator's approval before becoming public.
      if (enabled) {
        const affectedProducts = await tx.product.findMany({
          where: { status: { in: ['pending_review', 'fee_proposed', 'negotiating', 'awaiting_payment', 'payment_submitted'] } },
          select: { id: true, title: true, sellerId: true },
        });

        const affectedProductIds = affectedProducts.map((product) => product.id);
        if (affectedProductIds.length) {
          await tx.listingFee.updateMany({
            where: { productId: { in: affectedProductIds }, status: { in: ['pending', 'accepted'] } },
            data: { status: 'waived' },
          });

          await tx.listingPayment.updateMany({
            where: { productId: { in: affectedProductIds }, status: 'submitted' },
            data: {
              status: 'rejected',
              reviewedById: req.user.userId,
              reviewNote: 'Listing fee waived because AdNU Trade enabled fee-free mode.',
              reviewedAt: new Date(),
            },
          });

          await tx.product.updateMany({
            where: { id: { in: affectedProductIds } },
            data: { listingFeeWaived: true },
          });
          await tx.product.updateMany({
            where: { id: { in: affectedProductIds }, status: { in: ['fee_proposed', 'negotiating', 'awaiting_payment', 'payment_submitted'] } },
            data: { status: 'pending_review' },
          });

          await tx.notification.createMany({
            data: affectedProducts.map((product) => ({
              userId: product.sellerId,
              type: 'listing_fee_waived',
              title: 'Your listing fee has been waived',
              body: `The fee for "${product.title}" has been waived. Your listing still needs admin approval before it becomes public.`,
              link: '#/listings',
              entityId: product.id,
            })),
          });
        }
      }
    });

    res.json({
      freeListingsEnabled: enabled,
      message: enabled
        ? 'Fee-free mode enabled. All unapproved listings are now fee-waived; in-progress negotiations and payments were closed, and affected listings returned to admin review.'
        : 'Fee-free mode disabled. Listings already submitted while fee-free mode was enabled keep their fee waiver; new listings use the standard fee process.',
    });
  } catch (error) {
    console.error('Error updating fee-free listing setting:', error);
    res.status(500).json({ error: 'Could not update listing fee settings.' });
  }
});

// Pending administrator accounts.
router.get('/pending-admins', async (req, res) => {
  try {
    const pendingAdmins = await prisma.user.findMany({
      where: { role: 'admin', isApproved: false, isVerified: true },
      select: { id: true, fullName: true, email: true, idNumber: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(pendingAdmins);
  } catch (error) {
    console.error('Error fetching pending admins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/approve-admin/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.role !== 'admin') {
      return res.status(404).json({ error: 'Pending administrator account not found.' });
    }
    if (!user.isVerified) {
      return res.status(400).json({ error: 'The administrator must verify their email first.' });
    }
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isApproved: true },
      select: { id: true, fullName: true, email: true, role: true, isApproved: true },
    });
    res.json({ message: 'Administrator account successfully approved.', user: updatedUser });
  } catch (error) {
    console.error('Error approving admin account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initial review and seller/admin fee negotiation queue.
router.get('/products/pending', async (req, res) => {
  try {
    const pendingProducts = await prisma.product.findMany({
      where: {
        OR: [
          { status: 'pending_review' },
          {
            status: 'negotiating',
            listingFees: { some: { status: 'pending', proposedBy: 'seller' } },
          },
        ],
      },
      include: {
        seller: { select: { id: true, fullName: true, email: true, role: true } },
        listingFees: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(pendingProducts);
  } catch (error) {
    console.error('Error fetching pending products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin can approve a fee-waived listing, negotiate a standard fee, or reject a listing.
router.post('/products/:id/review', async (req, res) => {
  try {
    const productId = req.params.id;
    const adminId = req.user.userId;
    const action = String(req.body.action || '').trim().toLowerCase();
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (message.length > 1000) return res.status(400).json({ error: 'The negotiation message must be 1,000 characters or fewer.' });
    if (action === 'reject' && !message) return res.status(400).json({ error: 'A rejection reason is required so the seller receives an explanation.' });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { listingFees: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const latestFee = product.listingFees[0];

    if (action === 'approve_free') {
      const freeListingsEnabled = await getFreeListingsEnabled();
      if (!freeListingsEnabled && !product.listingFeeWaived) {
        return res.status(409).json({ error: 'This listing is not eligible for fee-free approval. Use the standard listing-fee review process.' });
      }
      if (product.status !== 'pending_review') {
        return res.status(400).json({ error: 'Only listings awaiting initial admin review can be approved for free.' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const productTransition = await tx.product.updateMany({
          where: { id: productId, status: 'pending_review' },
          data: { status: 'approved', listingFeeWaived: true },
        });
        if (productTransition.count !== 1) {
          throw new Error('This listing is no longer awaiting review. Refresh the queue.');
        }
        await createNotification(tx, {
          userId: product.sellerId,
          type: 'listing_approved',
          title: 'Your listing is now public',
          body: `"${product.title}" was approved and is now visible in the marketplace.${message ? `\n\nMessage from the administrator: ${message}` : ''}`,
          link: '#/listings',
          entityId: productId,
        });
        const updatedProduct = await tx.product.findUnique({ where: { id: productId } });
        return { product: updatedProduct };
      });
      return res.json({
        message: 'Listing approved for free and published on the marketplace.',
        ...result,
      });
    }

    if (action === 'reject') {
      const result = await prisma.$transaction(async (tx) => {
        if (latestFee?.status === 'pending') {
          await tx.listingFee.updateMany({
            where: { id: latestFee.id, status: 'pending' },
            data: { status: 'rejected' },
          });
        }
        const productTransition = await tx.product.updateMany({
          where: { id: productId, status: { in: ['pending_review', 'negotiating'] } },
          data: { status: 'rejected', rejectionReason: message },
        });
        if (productTransition.count !== 1) throw new Error('This listing is no longer in the review queue. Refresh the page.');
        await createNotification(tx, {
          userId: product.sellerId,
          type: 'listing_rejected',
          title: 'Your listing was rejected',
          body: `"${product.title}" was rejected. Reason: ${message}`,
          link: '#/listings',
          entityId: productId,
        });
        const updatedProduct = await tx.product.findUnique({ where: { id: productId } });
        return { product: updatedProduct };
      });
      return res.json({
        message: 'Product listing rejected and the seller has been notified.',
        product: result.product,
      });
    }

    if (['accept', 'propose', 'counter'].includes(action) && (await getFreeListingsEnabled() || product.listingFeeWaived)) {
      return res.status(409).json({ error: 'Listing fee negotiation is disabled while fee-free mode is enabled. Approve the listing for free or reject it.' });
    }

    if (action === 'accept') {
      if (!latestFee || latestFee.status !== 'pending' || latestFee.proposedBy !== 'seller' || product.status !== 'negotiating') {
        return res.status(400).json({ error: 'There is no pending seller counter-offer to accept.' });
      }
      const updatedProduct = await prisma.$transaction(async (tx) => {
        const feeTransition = await tx.listingFee.updateMany({
          where: { id: latestFee.id, status: 'pending', proposedBy: 'seller' },
          data: { status: 'accepted' },
        });
        if (feeTransition.count !== 1) throw new Error('This counter-offer has already been answered. Refresh the queue.');
        const productTransition = await tx.product.updateMany({
          where: { id: productId, status: 'negotiating' },
          data: { status: 'awaiting_payment' },
        });
        if (productTransition.count !== 1) throw new Error('This listing is no longer negotiating. Refresh the queue.');
        await tx.message.create({
          data: {
            productId,
            senderId: adminId,
            receiverId: product.sellerId,
            content: `Your counter-offer of ₱${Number(latestFee.proposedFee).toFixed(2)} has been accepted. Please pay the agreed fee using the e-wallet instructions in My Listings.`,
          },
        });
        return tx.product.findUnique({ where: { id: productId } });
      });
      return res.json({
        message: 'Seller counter-offer accepted. The seller must pay the agreed listing fee before the product is published.',
        product: updatedProduct,
      });
    }

    if (action === 'propose' || action === 'counter') {
      const fee = Number(req.body.proposedFee);
      if (!Number.isSafeInteger(fee) || fee < 1 || fee > 99999999) {
        return res.status(400).json({ error: 'Enter a whole-number listing fee from ₱1 to ₱99,999,999. Decimals, zero, and negative amounts are not allowed.' });
      }

      if (action === 'propose' && (product.status !== 'pending_review' || latestFee?.status === 'pending')) {
        return res.status(400).json({ error: 'A first fee can only be proposed while a listing is awaiting its initial review.' });
      }
      if (action === 'counter' && (!latestFee || latestFee.status !== 'pending' || latestFee.proposedBy !== 'seller')) {
        return res.status(400).json({ error: 'You can only counter a pending seller offer.' });
      }

      const result = await prisma.$transaction(async (tx) => {
        if (latestFee?.status === 'pending') {
          const feeTransition = await tx.listingFee.updateMany({
            where: { id: latestFee.id, status: 'pending', proposedBy: 'seller' },
            data: { status: 'countered' },
          });
          if (feeTransition.count !== 1) throw new Error('This seller offer has already been answered. Refresh the queue.');
        }
        const listingFee = await tx.listingFee.create({
          data: {
            productId,
            adminId,
            proposedFee: fee,
            proposedBy: 'admin',
            status: 'pending',
            message: message || null,
          },
        });
        const productTransition = await tx.product.updateMany({
          where: { id: productId, status: action === 'propose' ? 'pending_review' : 'negotiating' },
          data: { status: action === 'propose' ? 'fee_proposed' : 'negotiating' },
        });
        if (productTransition.count !== 1) throw new Error('This listing is no longer in the expected review state. Refresh the queue.');
        const updatedProduct = await tx.product.findUnique({ where: { id: productId } });
        const offerMessage = `Listing fee ${action === 'propose' ? 'proposal' : 'counter-offer'}: ₱${fee.toFixed(2)}.${message ? ` Message: ${message}` : ''}`;
        await tx.message.create({
          data: { productId, senderId: adminId, receiverId: product.sellerId, content: offerMessage },
        });
        return { listingFee, product: updatedProduct };
      });

      return res.status(201).json({
        message: action === 'propose' ? 'Listing fee proposed to seller.' : 'Counter-offer sent to seller.',
        ...result,
      });
    }

    return res.status(400).json({ error: 'Invalid review action.' });
  } catch (error) {
    console.error('Error reviewing product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Payments submitted by sellers are kept private until an admin verifies them.
router.get('/listing-payments/pending', async (req, res) => {
  try {
    const payments = await prisma.listingPayment.findMany({
      where: { status: 'submitted' },
      include: {
        product: { select: { id: true, title: true, category: true, price: true } },
        seller: { select: { id: true, fullName: true, email: true, idNumber: true } },
        listingFee: { select: { id: true, proposedFee: true, proposedBy: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(payments);
  } catch (error) {
    console.error('Error fetching listing payments:', error);
    res.status(500).json({ error: 'Could not fetch pending listing payments.' });
  }
});

router.get('/listing-payments/:paymentId/proof', async (req, res) => {
  try {
    const payment = await prisma.listingPayment.findUnique({
      where: { id: req.params.paymentId },
      select: { proofImage: true },
    });
    if (!payment) return res.status(404).json({ error: 'Payment proof not found.' });
    const proofPath = path.join(__dirname, '..', 'private-uploads', 'listing-payment-proofs', path.basename(payment.proofImage));
    return res.sendFile(proofPath, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode || 404).json({ error: 'Payment proof file not found.' });
    });
  } catch (error) {
    console.error('Error serving payment proof:', error);
    res.status(500).json({ error: 'Could not open payment proof.' });
  }
});

router.post('/listing-payments/:paymentId/review', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { action, reviewNote } = req.body;
    if (!['verify', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be verify or reject.' });
    }

    const payment = await prisma.listingPayment.findUnique({
      where: { id: paymentId },
      include: { product: true, listingFee: true },
    });
    if (!payment) return res.status(404).json({ error: 'Listing payment not found.' });
    if (payment.status !== 'submitted' || payment.product.status !== 'payment_submitted') {
      return res.status(409).json({ error: 'This payment has already been reviewed or is no longer awaiting verification.' });
    }
    if (payment.listingFee.status !== 'accepted') {
      return res.status(409).json({ error: 'The submitted payment is not linked to an accepted listing fee.' });
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const paymentTransition = await tx.listingPayment.updateMany({
        where: { id: paymentId, status: 'submitted' },
        data: {
          status: action === 'verify' ? 'verified' : 'rejected',
          reviewedById: req.user.userId,
          reviewNote: typeof reviewNote === 'string' ? reviewNote.trim() || null : null,
          reviewedAt: now,
        },
      });
      if (paymentTransition.count !== 1) {
        throw new Error('This payment has already been reviewed. Refresh the payment queue.');
      }
      const productTransition = await tx.product.updateMany({
        where: { id: payment.productId, status: 'payment_submitted' },
        data: { status: action === 'verify' ? 'approved' : 'awaiting_payment' },
      });
      if (productTransition.count !== 1) {
        throw new Error('The listing is no longer awaiting payment verification.');
      }
      const updatedPayment = await tx.listingPayment.findUnique({ where: { id: paymentId } });
      const updatedProduct = await tx.product.findUnique({ where: { id: payment.productId } });
      await createNotification(tx, {
        userId: payment.sellerId,
        type: action === 'verify' ? 'payment_verified' : 'payment_rejected',
        title: action === 'verify' ? 'Listing payment verified' : 'Listing payment needs attention',
        body: action === 'verify'
          ? `Your payment for "${payment.product.title}" was verified. The listing is now public.`
          : `Your payment proof for "${payment.product.title}" was rejected. ${typeof reviewNote === 'string' && reviewNote.trim() ? `Admin note: ${reviewNote.trim()}` : 'You may submit a new payment proof.'}`,
        link: '#/listings',
        entityId: payment.productId,
      });
      return { payment: updatedPayment, product: updatedProduct };
    });

    res.json({
      message: action === 'verify'
        ? 'Payment verified. The product is now public on the marketplace.'
        : 'Payment rejected. The seller can submit a new transfer proof.',
      ...result,
    });
  } catch (error) {
    console.error('Error reviewing listing payment:', error);
    res.status(500).json({ error: 'Could not review listing payment.' });
  }
});

module.exports = router;

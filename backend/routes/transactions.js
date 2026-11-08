const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

// Helper function to find a transaction by UUID or trackingCode (with or without #).
// Product's Prisma relation is named `seller` (not `user`), so include that
// relation explicitly when loading the transaction's product.
const findTransaction = async (idParam) => {
  if (!idParam) return null;

  const rawId = String(idParam).trim();
  const cleanId = rawId.replace(/^#/, '');
  const candidates = [...new Set([rawId, cleanId, `#${cleanId}`].filter(Boolean))];

  return prisma.transaction.findFirst({
    where: {
      OR: [
        ...candidates.map((id) => ({ id })),
        ...candidates.map((trackingCode) => ({ trackingCode })),
      ],
    },
    include: {
      product: {
        include: {
          seller: { select: { id: true, fullName: true, email: true, idNumber: true } },
        },
      },
      buyer: { select: { id: true, fullName: true, email: true, idNumber: true } },
      seller: { select: { id: true, fullName: true, email: true, idNumber: true } },
    },
  });
};

// 0. GET ALL TRANSACTIONS FOR LOGGED-IN USER
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
          { product: { sellerId: userId } }
        ]
      },
      include: {
        product: true,
        buyer: { select: { id: true, fullName: true, email: true, idNumber: true } },
        seller: { select: { id: true, fullName: true, email: true, idNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1. GET TRANSACTION BY ID OR TRACKING CODE
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const transaction = await findTransaction(id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const sellerId = transaction.sellerId || transaction.product?.sellerId;

    if (transaction.buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this transaction.' });
    }

    // Attach sellerId explicitly so the frontend reads it reliably
    res.json({
      ...transaction,
      sellerId: sellerId
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. BUYER UPDATES CAMPUS MEETUP DETAILS
router.put('/:id/meetup', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { location, meetupDate, meetupTime } = req.body;

    const transaction = await findTransaction(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
    if (transaction.buyerId !== userId) return res.status(403).json({ error: 'Unauthorized.' });

    const sellerId = transaction.sellerId || transaction.product?.sellerId;

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        fulfillmentMethod: 'meetup', // Strictly locked to campus meetup
        location,
        meetupDate,
        meetupTime,
        meetupStatus: 'pending_agreement'
      },
      include: { product: true, buyer: true, seller: true }
    });

    // Notifications are secondary: a notification failure must not undo the meetup update.
    try {
      await createNotification(prisma, {
        userId: sellerId,
        type: 'meetup_update',
        title: 'Buyer submitted meetup details',
        body: `The buyer submitted campus meetup details for "${transaction.product?.title || 'your item'}". Please review the transaction.`,
        link: '#/transactions',
        entityId: transaction.id,
      });
    } catch (notificationError) {
      console.error('Failed to create meetup notification for seller:', notificationError);
    }

    res.json({ message: 'Campus meetup details submitted for seller approval.', transaction: updated });
  } catch (error) {
    console.error('Error updating meetup details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. SELLER AGREES OR RENEGOTIATES CAMPUS MEETUP DETAILS
router.post('/:id/meetup-response', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { action, location, meetupDate, meetupTime } = req.body;

    const transaction = await findTransaction(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

    if (transaction.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot modify a cancelled transaction.' });
    }

    const sellerId = transaction.sellerId || transaction.product?.sellerId;
    if (sellerId !== userId) return res.status(403).json({ error: 'Unauthorized seller action.' });

    let updateData = {};
    if (action === 'agree') {
      updateData = {
        meetupStatus: 'agreed',
        status: 'confirmed',
        ...(!transaction.agreedAt && { agreedAt: new Date() }) // 👉 Save exact timestamp once
      };

      if (transaction.productId) {
        await prisma.product.update({
          where: { id: transaction.productId },
          data: { status: 'reserved' }
        }).catch(err => console.error("Could not update product status to reserved:", err));
      }
    } else if (action === 'renegotiate') {
      updateData = {
        fulfillmentMethod: 'meetup',
        location: location || transaction.location,
        meetupDate: meetupDate || transaction.meetupDate,
        meetupTime: meetupTime || transaction.meetupTime,
        meetupStatus: 'renegotiating'
      };
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "agree" or "renegotiate".' });
    }

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: updateData,
      include: { product: true, buyer: true, seller: true }
    });

    // Notify the buyer about the seller's meetup decision without exposing read receipts.
    try {
      await createNotification(prisma, {
        userId: transaction.buyerId,
        type: 'meetup_update',
        title: action === 'agree' ? 'Seller agreed to the meetup' : 'Seller suggested a meetup change',
        body: action === 'agree'
          ? `The seller agreed to the campus meetup for "${transaction.product?.title || 'your item'}".`
          : `The seller suggested different meetup details for "${transaction.product?.title || 'your item'}". Open the transaction to review them.`,
        link: '#/transactions',
        entityId: transaction.id,
      });
    } catch (notificationError) {
      console.error('Failed to create meetup response notification for buyer:', notificationError);
    }

    res.json({ message: action === 'agree' ? 'Campus meetup agreed successfully!' : 'Counter-offer sent to buyer.', transaction: updated });
  } catch (error) {
    console.error('Error handling meetup response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. PROGRESS TRANSACTION STATUS
router.post('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { newStatus, cancelReason } = req.body;

    const transaction = await findTransaction(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

    const sellerId = transaction.sellerId || transaction.product?.sellerId;
    if (transaction.buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    let updateData = { status: newStatus };

    if (newStatus === 'ready' && !transaction.readyAt) {
      updateData.readyAt = new Date();
    }

    if (newStatus === 'completed') {
      updateData.paymentStatus = 'paid';
      if (!transaction.completedAt) {
        updateData.completedAt = new Date(); // 👉 Save exact timestamp once
      }

      if (transaction.productId) {
        await prisma.product.update({
          where: { id: transaction.productId },
          data: { status: 'sold' }
        }).catch(err => console.error("Could not update product status:", err));
      }
    }

    if (newStatus === 'cancelled') {
      updateData.cancelledBy = userId === transaction.buyerId ? 'buyer' : 'seller';
      if (cancelReason) updateData.cancelReason = cancelReason;
      if (!transaction.cancelledAt) {
        updateData.cancelledAt = new Date(); // 👉 Save exact timestamp once
      }

      if (transaction.productId) {
        await prisma.product.update({
          where: { id: transaction.productId },
          data: { status: 'approved' }
        }).catch(err => console.error("Could not restore product status:", err));
      }
    }

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: updateData,
      include: { product: true, buyer: true, seller: true }
    });

    // Notify the other participant only when the transaction status actually changes.
    if (transaction.status !== newStatus) {
      const recipientId = userId === transaction.buyerId ? sellerId : transaction.buyerId;
      const statusLabels = {
        pending: 'awaiting seller agreement',
        confirmed: 'confirmed',
        ready: 'ready for meetup',
        completed: 'completed',
        cancelled: 'cancelled',
      };

      try {
        await createNotification(prisma, {
          userId: recipientId,
          type: newStatus === 'completed'
            ? 'transaction_completed'
            : newStatus === 'cancelled'
              ? 'transaction_cancelled'
              : 'transaction_update',
          title: newStatus === 'completed'
            ? 'Transaction completed'
            : newStatus === 'cancelled'
              ? 'Transaction cancelled'
              : 'Transaction updated',
          body: `The transaction for "${transaction.product?.title || 'the item'}" is now ${statusLabels[newStatus] || newStatus}.`,
          link: '#/transactions',
          entityId: transaction.id,
        });
      } catch (notificationError) {
        console.error('Failed to create transaction status notification:', notificationError);
      }
    }

    res.json({ message: 'Transaction status updated successfully.', transaction: updated });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
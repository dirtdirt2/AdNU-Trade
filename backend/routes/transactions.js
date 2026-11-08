const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const {
  ACTIVE_TRANSACTION_STATUSES,
  PENDING_PURCHASE_STATUSES,
  CANCELLABLE_TRANSACTION_STATUSES,
  isValidMeetupDate,
  isValidMeetupTime,
  validateTransactionTransition,
  partitionOtherActiveTransactions,
} = require('../utils/transactionRules');

const MEETUP_EDITABLE_STATUSES = ['pending_agreement', 'renegotiating'];

const makeConflict = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};

// Find a transaction by UUID or trackingCode (with or without #).
// Only expose the names and IDs needed by the two transaction participants.
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
          seller: { select: { id: true, fullName: true, role: true } },
        },
      },
      buyer: { select: { id: true, fullName: true, role: true } },
      seller: { select: { id: true, fullName: true, role: true } },
    },
  });
};

// 0. GET ALL TRANSACTIONS FOR THE LOGGED-IN USER.
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId },
          { product: { sellerId: userId } },
        ],
      },
      include: {
        product: true,
        buyer: { select: { id: true, fullName: true, role: true } },
        seller: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions list:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 1. GET TRANSACTION BY ID OR TRACKING CODE.
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const transaction = await findTransaction(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

    const sellerId = transaction.sellerId || transaction.product?.sellerId;
    if (transaction.buyerId !== req.user.userId && sellerId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized access to this transaction.' });
    }

    return res.json({ ...transaction, sellerId });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. BUYER UPDATES CAMPUS MEETUP DETAILS.
router.put('/:id/meetup', verifyToken, async (req, res) => {
  try {
    const transaction = await findTransaction(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
    if (transaction.buyerId !== req.user.userId) {
      return res.status(403).json({ error: 'Only the buyer can submit meetup details.' });
    }
    if (transaction.status !== 'pending' || !MEETUP_EDITABLE_STATUSES.includes(transaction.meetupStatus)) {
      return res.status(409).json({ error: 'Meetup details can only be changed while the seller has not agreed.' });
    }

    const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    const meetupDate = typeof req.body.meetupDate === 'string' ? req.body.meetupDate.trim() : '';
    const meetupTime = typeof req.body.meetupTime === 'string' ? req.body.meetupTime.trim() : '';
    if (!location || !meetupDate || !meetupTime || location.length > 250 ||
        !isValidMeetupDate(meetupDate) || !isValidMeetupTime(meetupTime)) {
      return res.status(400).json({ error: 'Enter a valid campus meetup location, calendar date, and 24-hour time.' });
    }

    const updateResult = await prisma.transaction.updateMany({
      where: {
        id: transaction.id,
        buyerId: req.user.userId,
        status: 'pending',
        meetupStatus: { in: MEETUP_EDITABLE_STATUSES },
      },
      data: {
        fulfillmentMethod: 'meetup',
        location,
        meetupDate,
        meetupTime,
        meetupStatus: 'pending_agreement',
      },
    });
    if (updateResult.count !== 1) {
      return res.status(409).json({ error: 'This transaction changed while you were editing it. Refresh and try again.' });
    }

    const updated = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        product: true,
        buyer: { select: { id: true, fullName: true, role: true } },
        seller: { select: { id: true, fullName: true, role: true } },
      },
    });

    try {
      await createNotification(prisma, {
        userId: transaction.sellerId,
        type: 'meetup_update',
        title: 'Buyer submitted meetup details',
        body: `The buyer submitted campus meetup details for "${transaction.product?.title || 'your item'}". Please review the transaction.`,
        link: '#/transactions',
        entityId: transaction.id,
      });
    } catch (notificationError) {
      console.error('Failed to create meetup notification for seller:', notificationError);
    }

    return res.json({ message: 'Campus meetup details submitted for seller approval.', transaction: updated });
  } catch (error) {
    console.error('Error updating meetup details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. SELLER AGREES OR RENEGOTIATES CAMPUS MEETUP DETAILS.
router.post('/:id/meetup-response', verifyToken, async (req, res) => {
  try {
    const transaction = await findTransaction(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

    const sellerId = transaction.sellerId || transaction.product?.sellerId;
    if (sellerId !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can respond to meetup details.' });
    }
    if (transaction.status !== 'pending' || !MEETUP_EDITABLE_STATUSES.includes(transaction.meetupStatus)) {
      return res.status(409).json({ error: 'This transaction is no longer awaiting a meetup decision.' });
    }

    const action = String(req.body.action || '').trim().toLowerCase();
    if (!['agree', 'renegotiate'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "agree" or "renegotiate".' });
    }

    const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    const meetupDate = typeof req.body.meetupDate === 'string' ? req.body.meetupDate.trim() : '';
    const meetupTime = typeof req.body.meetupTime === 'string' ? req.body.meetupTime.trim() : '';
    if (action === 'renegotiate' &&
        ((location && location.length > 250) ||
         (meetupDate && !isValidMeetupDate(meetupDate)) ||
         (meetupTime && !isValidMeetupTime(meetupTime)))) {
      return res.status(400).json({ error: 'Enter valid counter-proposal meetup details.' });
    }

    // A purchase request reserves the product as soon as it is created. This
    // conditional write also serializes seller decisions for legacy duplicate
    // requests, without requiring sellerId to be present on old transactions.
    const result = await prisma.$transaction(async (tx) => {
      if (action === 'agree') {
        // Lock the product row while resolving legacy duplicate requests. The
        // checkout route also updates this row when it creates the first order,
        // so a second seller decision cannot race the reservation.
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${transaction.productId} AND seller_id = ${sellerId} FOR UPDATE`;

        const product = await tx.product.findUnique({
          where: { id: transaction.productId },
          select: { status: true, sellerId: true },
        });
        if (!product || product.sellerId !== sellerId || !['approved', 'reserved'].includes(product.status)) {
          throw makeConflict('This listing is no longer available to complete this transaction.');
        }

        if (product.status === 'approved') {
          const reservation = await tx.product.updateMany({
            where: { id: transaction.productId, sellerId, status: 'approved' },
            data: { status: 'reserved' },
          });
          if (reservation.count !== 1) {
            throw makeConflict('This listing has just been reserved by another transaction.');
          }
        }
      }

      const otherActiveTransactions = await tx.transaction.findMany({
        where: {
          productId: transaction.productId,
          id: { not: transaction.id },
          status: { in: ACTIVE_TRANSACTION_STATUSES },
        },
        select: { id: true, buyerId: true, status: true, trackingCode: true },
      });
      const { pendingRequests, acceptedTransactions } =
        partitionOtherActiveTransactions(otherActiveTransactions);

      // A previously accepted/ready transaction must never be displaced by a
      // second legacy request. Pending duplicates, however, are closed when
      // the seller accepts the selected request.
      if (acceptedTransactions.length > 0) {
        throw makeConflict('Another purchase request for this listing has already been accepted.');
      }

      const autoCancelledTransactions = [];
      if (action === 'agree') {
        const cancelledAt = new Date();
        const cancelReason = 'The seller accepted another buyer’s request. This request was automatically cancelled because the listing was reserved.';

        for (const otherRequest of pendingRequests) {
          const cancelled = await tx.transaction.updateMany({
            where: {
              id: otherRequest.id,
              status: { in: PENDING_PURCHASE_STATUSES },
            },
            data: {
              status: 'cancelled',
              cancelledBy: 'system',
              cancelReason,
              cancelledAt,
            },
          });

          if (cancelled.count === 1) {
            autoCancelledTransactions.push(otherRequest);
          }
        }
      }

      const updateData = action === 'agree'
        ? {
            meetupStatus: 'agreed',
            status: 'confirmed',
            ...(!transaction.agreedAt && { agreedAt: new Date() }),
          }
        : {
            fulfillmentMethod: 'meetup',
            location: location || transaction.location,
            meetupDate: meetupDate || transaction.meetupDate,
            meetupTime: meetupTime || transaction.meetupTime,
            meetupStatus: 'renegotiating',
          };

      // The seller identity was checked above using transaction.sellerId OR
      // product.sellerId. Do not require sellerId in this conditional update:
      // that preserves compatibility with older records using the fallback.
      const transition = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: 'pending',
          meetupStatus: { in: MEETUP_EDITABLE_STATUSES },
        },
        data: updateData,
      });
      if (transition.count !== 1) {
        throw makeConflict('This meetup request has already been answered. Refresh the transaction.');
      }

      const updated = await tx.transaction.findUnique({
        where: { id: transaction.id },
        include: {
          product: true,
          buyer: { select: { id: true, fullName: true, role: true } },
          seller: { select: { id: true, fullName: true, role: true } },
        },
      });

      return { updated, autoCancelledTransactions };
    });

    // Notifications are sent after the database transaction commits. A
    // notification failure must not undo the accepted meetup or cancellations.
    for (const cancelledRequest of result.autoCancelledTransactions) {
      try {
        await createNotification(prisma, {
          userId: cancelledRequest.buyerId,
          type: 'transaction_cancelled',
          title: 'Purchase request closed',
          body: `Your request for "${transaction.product?.title || 'this item'}" was automatically cancelled because the seller accepted another buyer's request.`,
          link: '#/transactions',
          entityId: cancelledRequest.id,
        });
      } catch (notificationError) {
        console.error('Failed to notify buyer about an automatically cancelled request:', notificationError);
      }
    }

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

    return res.json({
      message: action === 'agree'
        ? `Campus meetup agreed successfully!${result.autoCancelledTransactions.length ? ` ${result.autoCancelledTransactions.length} other pending request(s) were automatically cancelled.` : ''}`
        : 'Counter-offer sent to buyer.',
      transaction: result.updated,
      autoCancelledCount: result.autoCancelledTransactions.length,
    });
  } catch (error) {
    console.error('Error handling meetup response:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
});

// 4. PROGRESS TRANSACTION STATUS. The server, not the browser, decides
// which participant can perform each transition.
router.post('/:id/status', verifyToken, async (req, res) => {
  try {
    const transaction = await findTransaction(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });

    const userId = req.user.userId;
    const sellerId = transaction.sellerId || transaction.product?.sellerId;
    const isBuyer = transaction.buyerId === userId;
    const isSeller = sellerId === userId;
    if (!isBuyer && !isSeller) return res.status(403).json({ error: 'Unauthorized.' });

    const newStatus = typeof req.body.newStatus === 'string' ? req.body.newStatus.trim().toLowerCase() : '';
    const cancelReason = typeof req.body.cancelReason === 'string' ? req.body.cancelReason.trim() : '';
    if (cancelReason.length > 500) {
      return res.status(400).json({ error: 'Cancellation reason must be 500 characters or fewer.' });
    }

    const transitionError = validateTransactionTransition({
      currentStatus: transaction.status,
      meetupStatus: transaction.meetupStatus,
      actorIsBuyer: isBuyer,
      actorIsSeller: isSeller,
      nextStatus: newStatus,
    });
    if (transitionError) {
      return res.status(transitionError.statusCode).json({ error: transitionError.error });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const expectedStatuses = newStatus === 'ready'
        ? ['confirmed']
        : newStatus === 'completed'
          ? ['ready']
          : CANCELLABLE_TRANSACTION_STATUSES;

      const updateData = { status: newStatus };
      if (newStatus === 'ready' && !transaction.readyAt) updateData.readyAt = new Date();
      if (newStatus === 'completed') {
        updateData.paymentStatus = 'paid';
        if (!transaction.completedAt) updateData.completedAt = new Date();
      }
      if (newStatus === 'cancelled') {
        updateData.cancelledBy = isBuyer ? 'buyer' : 'seller';
        updateData.cancelReason = cancelReason || null;
        if (!transaction.cancelledAt) updateData.cancelledAt = new Date();
      }

      const transition = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: expectedStatuses },
          ...(newStatus === 'ready' ? { meetupStatus: 'agreed' } : {}),
        },
        data: updateData,
      });
      if (transition.count !== 1) throw makeConflict('This transaction has already changed. Refresh and try again.');

      if (newStatus === 'completed') {
        const sold = await tx.product.updateMany({
          where: { id: transaction.productId, status: { in: ['reserved', 'approved'] } },
          data: { status: 'sold' },
        });
        if (sold.count !== 1) throw makeConflict('The product could not be marked sold. Contact an administrator before retrying.');
      }

      if (newStatus === 'cancelled') {
        const otherActiveTransaction = await tx.transaction.findFirst({
          where: {
            productId: transaction.productId,
            id: { not: transaction.id },
            status: { in: ACTIVE_TRANSACTION_STATUSES },
          },
          select: { id: true },
        });
        if (!otherActiveTransaction) {
          await tx.product.updateMany({
            where: { id: transaction.productId, status: 'reserved' },
            data: { status: 'approved' },
          });
        }
      }

      return tx.transaction.findUnique({
        where: { id: transaction.id },
        include: {
          product: true,
          buyer: { select: { id: true, fullName: true, role: true } },
          seller: { select: { id: true, fullName: true, role: true } },
        },
      });
    });

    if (transaction.status !== newStatus) {
      const recipientId = isBuyer ? sellerId : transaction.buyerId;
      const statusLabels = {
        ready: 'ready for meetup',
        completed: 'completed',
        cancelled: 'cancelled',
      };
      try {
        await createNotification(prisma, {
          userId: recipientId,
          type: newStatus === 'completed' ? 'transaction_completed' : newStatus === 'cancelled' ? 'transaction_cancelled' : 'transaction_update',
          title: newStatus === 'completed' ? 'Transaction completed' : newStatus === 'cancelled' ? 'Transaction cancelled' : 'Item ready for meetup',
          body: `The transaction for "${transaction.product?.title || 'the item'}" is now ${statusLabels[newStatus]}.`,
          link: '#/transactions',
          entityId: transaction.id,
        });
      } catch (notificationError) {
        console.error('Failed to create transaction status notification:', notificationError);
      }
    }

    return res.json({ message: 'Transaction status updated successfully.', transaction: updated });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const fs = require('fs');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken, optionalVerifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { createNotification, notifyAdmins } = require('../utils/notifications');

// Configure multer storage for uploaded product images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});
const upload = multer({ storage });

// 1. CREATE A PRODUCT LISTING. The admin sets the listing fee after reviewing it.
router.post('/', verifyToken, upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, price, category, condition } = req.body;
    const sellerId = req.user.userId;
    const numericPrice = Number(price);

    if (!title?.trim() || !Number.isSafeInteger(numericPrice) || numericPrice < 1 || numericPrice > 99999999 || !category) {
      return res.status(400).json({ error: 'A title, a whole-number price from ₱1 to ₱99,999,999, and a category are required.' });
    }

    const feeFreeSetting = await prisma.appSetting.findUnique({ where: { key: 'free_listings_enabled' } });
    const freeListingsEnabled = Boolean(feeFreeSetting?.value);
    const imagePaths = req.files ? req.files.map(file => `http://localhost:5000/uploads/${file.filename}`) : [];
    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          sellerId,
          title: title.trim(),
          description: description || '',
          price: numericPrice,
          category,
          condition: condition || 'Good',
          images: imagePaths,
          status: 'pending_review',
          listingFeeWaived: freeListingsEnabled,
        },
        include: { seller: { select: { id: true, fullName: true, email: true } } },
      });
      await notifyAdmins(tx, {
        type: 'listing_created',
        title: 'New listing awaiting review',
        body: `"${createdProduct.title}" has been submitted and is waiting for admin review.`,
        link: '#/admin',
        entityId: createdProduct.id,
      });
      return createdProduct;
    });

    res.status(201).json({
      message: freeListingsEnabled
        ? 'Product submitted. An admin will review and approve it. No listing fee or e-wallet payment is required while fee-free mode is enabled.'
        : 'Product submitted. An admin will review it and propose a listing fee.',
      product,
    });
  } catch (error) {
    console.error('Error creating product listing:', error);
    res.status(500).json({ error: 'Could not create product listing.' });
  }
});

// 2. GET ALL PUBLIC / APPROVED PRODUCTS (Marketplace Browsing)
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'approved',
        // Ensure no completed transaction exists for this product
        transactions: {
          none: {
            status: 'completed'
          }
        }
      },
      include: {
        seller: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (error) {
    console.error('Error fetching marketplace products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. GET THE LOGGED-IN SELLER'S LISTINGS, NEGOTIATION HISTORY, AND LATEST PAYMENT.
router.get('/my-listings', verifyToken, async (req, res) => {
  try {
    const userProducts = await prisma.product.findMany({
      where: { sellerId: req.user.userId },
      include: {
        seller: { select: { fullName: true, email: true } },
        listingFees: { orderBy: { createdAt: 'desc' } },
        listingPayments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, amount: true, walletProvider: true, referenceNumber: true, status: true, reviewNote: true, createdAt: true, reviewedAt: true },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedProducts = userProducts.map((product) => ({
      ...product,
      listingFees: product.listingFees.map((fee) => ({
        id: fee.id,
        proposedFee: fee.proposedFee,
        proposedBy: fee.proposedBy === 'admin' ? 'AdNU Trade Administration' : 'You',
        status: fee.status,
        message: fee.message,
        createdAt: fee.createdAt,
      })),
    }));
    res.json(sanitizedProducts);
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({ error: 'Could not fetch your listings.' });
  }
});

// SELLER-ONLY LISTING STATUS ACTIONS USED BY THE PROFILE PAGE.
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.sellerId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only change your own listings.' });
    }

    const action = String(req.body.action || '').trim().toLowerCase();
    let nextStatus;

    if (action === 'pause') {
      if (product.status !== 'approved') {
        return res.status(409).json({ error: 'Only active, approved listings can be paused.' });
      }
      nextStatus = 'paused';
    } else if (action === 'resume') {
      if (product.status !== 'paused') {
        return res.status(409).json({ error: 'Only paused listings can be resumed.' });
      }
      nextStatus = 'approved';
    } else if (action === 'sold') {
      if (!['approved', 'paused'].includes(product.status)) {
        return res.status(409).json({ error: 'Only active or paused listings can be marked as sold.' });
      }
      const activeTransaction = await prisma.transaction.findFirst({
        where: { productId: product.id, status: { in: ['placed', 'pending', 'confirmed', 'ready'] } },
        select: { id: true },
      });
      if (activeTransaction) {
        return res.status(409).json({ error: 'This item has an active transaction. Resolve it before marking the listing as sold.' });
      }
      nextStatus = 'sold';
    } else {
      return res.status(400).json({ error: 'Invalid listing action.' });
    }

    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: { status: nextStatus },
      include: { seller: { select: { id: true, fullName: true, email: true } } },
    });
    res.json({ message: 'Listing status updated.', product: updatedProduct });
  } catch (error) {
    console.error('Error changing listing status:', error);
    res.status(500).json({ error: 'Could not update listing status.' });
  }
});

// 4. SELLER ACCEPTS, COUNTERS, OR REJECTS THE LATEST ADMIN FEE OFFER.
router.post('/:id/fee-response', verifyToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.userId;
    const action = String(req.body.action || '').trim().toLowerCase();
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (message.length > 1000) return res.status(400).json({ error: 'The negotiation message must be 1,000 characters or fewer.' });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { listingFees: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.sellerId !== userId) {
      return res.status(403).json({ error: 'You can only respond to fees for your own listing.' });
    }

    const feeFreeSetting = await prisma.appSetting.findUnique({ where: { key: 'free_listings_enabled' } });
    if (feeFreeSetting?.value || product.listingFeeWaived) {
      return res.status(409).json({ error: 'Listing fees are waived for this listing. It is awaiting admin approval and no payment is required.' });
    }

    const latestFee = product.listingFees[0];
    if (!latestFee || latestFee.status !== 'pending' || latestFee.proposedBy !== 'admin') {
      return res.status(409).json({ error: 'There is no pending admin fee offer to respond to.' });
    }

    if (action === 'accept') {
      const result = await prisma.$transaction(async (tx) => {
        const feeTransition = await tx.listingFee.updateMany({
          where: { id: latestFee.id, status: 'pending', proposedBy: 'admin' },
          data: { status: 'accepted' },
        });
        if (feeTransition.count !== 1) throw new Error('This fee offer has already been answered. Refresh your listings.');
        const productTransition = await tx.product.updateMany({
          where: { id: productId, sellerId: userId, status: { in: ['fee_proposed', 'negotiating'] } },
          data: { status: 'awaiting_payment' },
        });
        if (productTransition.count !== 1) throw new Error('This listing is no longer waiting for a fee response.');
        const updated = await tx.product.findUnique({ where: { id: productId } });
        await tx.message.create({
          data: {
            productId,
            senderId: userId,
            receiverId: latestFee.adminId,
            content: `I accepted your listing fee proposal of ₱${Number(latestFee.proposedFee).toFixed(2)}. I will submit the e-wallet transfer proof.`,
          },
        });
        return updated;
      });
      return res.json({
        message: 'Listing fee accepted. Submit your e-wallet transfer proof to continue.',
        product: result,
        agreedFee: latestFee.proposedFee,
      });
    }

    if (action === 'reject') {
      const updated = await prisma.$transaction(async (tx) => {
        const feeTransition = await tx.listingFee.updateMany({
          where: { id: latestFee.id, status: 'pending', proposedBy: 'admin' },
          data: { status: 'rejected' },
        });
        if (feeTransition.count !== 1) throw new Error('This fee offer has already been answered. Refresh your listings.');
        const productTransition = await tx.product.updateMany({
          where: { id: productId, sellerId: userId, status: { in: ['fee_proposed', 'negotiating'] } },
          data: { status: 'rejected' },
        });
        if (productTransition.count !== 1) throw new Error('This listing is no longer waiting for a fee response.');
        await tx.message.create({
          data: {
            productId,
            senderId: userId,
            receiverId: latestFee.adminId,
            content: 'I rejected the proposed listing fee. Please close this listing.',
          },
        });
        return tx.product.findUnique({ where: { id: productId } });
      });
      return res.json({ message: 'Listing fee rejected. The listing has been closed.', product: updated });
    }

    if (action === 'counter') {
      const counterAmount = Number(req.body.counterOfferAmount);
      if (!Number.isSafeInteger(counterAmount) || counterAmount < 1 || counterAmount > 99999999) {
        return res.status(400).json({ error: 'Enter a whole-number counter-offer from ₱1 to ₱99,999,999. Decimals, zero, and negative amounts are not allowed.' });
      }
      const result = await prisma.$transaction(async (tx) => {
        const feeTransition = await tx.listingFee.updateMany({
          where: { id: latestFee.id, status: 'pending', proposedBy: 'admin' },
          data: { status: 'countered' },
        });
        if (feeTransition.count !== 1) throw new Error('This fee offer has already been answered. Refresh your listings.');
        const listingFee = await tx.listingFee.create({
          data: {
            productId,
            adminId: latestFee.adminId,
            proposedFee: counterAmount,
            proposedBy: 'seller',
            status: 'pending',
            message: message || null,
          },
        });
        const productTransition = await tx.product.updateMany({
          where: { id: productId, sellerId: userId, status: { in: ['fee_proposed', 'negotiating'] } },
          data: { status: 'negotiating' },
        });
        if (productTransition.count !== 1) throw new Error('This listing is no longer waiting for a fee response.');
        const updatedProduct = await tx.product.findUnique({ where: { id: productId } });
        await tx.message.create({
          data: {
            productId,
            senderId: userId,
            receiverId: latestFee.adminId,
            content: `I would like to counter your listing fee with ₱${counterAmount.toFixed(2)}.${message ? ` Message: ${message}` : ''}`,
          },
        });
        return { listingFee, product: updatedProduct };
      });
      return res.status(201).json({ message: 'Your counter-offer was sent to the admin.', ...result });
    }

    return res.status(400).json({ error: 'Invalid fee response action.' });
  } catch (error) {
    console.error('Error handling fee response:', error);
    res.status(500).json({ error: 'Could not process your fee response.' });
  }
});

// GET A SINGLE PRODUCT BY ID (For Product Detail Page)
router.get('/:id', optionalVerifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, fullName: true, email: true, role: true, idNumber: true },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Unpublished listings are visible only to their seller and administrators.
    if (product.status !== 'approved' && product.sellerId !== req.user?.userId && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching single product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. PURCHASE / CHECKOUT A PRODUCT (Blocks self-purchase & creates persistent transaction)
router.post('/:id/buy', verifyToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const buyerId = req.user.userId;
    const { fulfillmentMethod, location, meetupDate, meetupTime } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.sellerId === buyerId) {
      return res.status(400).json({ error: 'You cannot buy your own product.' });
    }

    if (product.status !== 'approved') {
      return res.status(409).json({ error: 'This listing is not publicly available for purchase.' });
    }

    const method = fulfillmentMethod || 'meetup';
    const deliveryFee = method === 'delivery' ? 30 : 0;
    const itemPrice = Number(product.price);
    const totalPrice = itemPrice + deliveryFee;

    const trackingCode = `#ADT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const transaction = await prisma.$transaction(async (tx) => {
      const createdTransaction = await tx.transaction.create({
        data: {
          trackingCode,
          product: { connect: { id: product.id } },
          buyer: { connect: { id: buyerId } },
          seller: { connect: { id: product.sellerId } },
          totalPrice,
          status: 'pending',
          fulfillmentMethod: method,
          location: location || null,
          meetupDate: meetupDate || null,
          meetupTime: meetupTime || null,
          meetupStatus: 'pending_agreement',
          paymentMethod: 'cash_on_meetup',
          paymentStatus: 'unpaid',
        },
        include: {
          product: true,
          buyer: { select: { id: true, fullName: true, email: true, idNumber: true } },
          seller: { select: { id: true, fullName: true, email: true, idNumber: true } },
        },
      });
      await createNotification(tx, {
        userId: product.sellerId,
        type: 'transaction_created',
        title: 'You received a purchase request',
        body: `${createdTransaction.buyer.fullName} placed an order for "${product.title}".`,
        link: '#/transactions',
        entityId: createdTransaction.id,
      });
      return createdTransaction;
    });

    res.json({
      message: 'Transaction created successfully.',
      transactionId: transaction.trackingCode,
      transaction,
    });
  } catch (error) {
    console.error('Error processing purchase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. EDIT AN EXISTING PRODUCT (Owner check enforced)
router.put('/:id', verifyToken, upload.array('images', 5), async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.userId;
    const { title, description, price, category, condition } = req.body;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.sellerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: You can only edit your own listings.' });
    }

    let numericPrice;
    if (price !== undefined) {
      numericPrice = Number(price);
      if (!Number.isSafeInteger(numericPrice) || numericPrice < 1 || numericPrice > 99999999) {
        return res.status(400).json({ error: 'Product price must be a whole number from ₱1 to ₱99,999,999. Decimals, zero, and negative amounts are not allowed.' });
      }
    }

    const newImagePaths = req.files && req.files.length > 0
      ? req.files.map(file => `http://localhost:5000/uploads/${file.filename}`)
      : undefined;

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: numericPrice }),
        ...(category && { category }),
        ...(condition && { condition }),
        ...(newImagePaths && { images: newImagePaths }),
      },
    });

    res.json({ message: 'Product updated successfully.', product: updatedProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 8. DELETE A PRODUCT (Owner check enforced)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.userId;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { listingPayments: { select: { proofImage: true } } },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.sellerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own listings.' });
    }
    if (product.status === 'payment_submitted') {
      return res.status(409).json({ error: 'You cannot delete this listing while its payment proof is under admin verification.' });
    }

    const existingTransaction = await prisma.transaction.findFirst({
      where: { productId },
      select: { id: true },
    });
    if (existingTransaction) {
      return res.status(409).json({ error: 'This listing has transaction history and cannot be deleted. You can leave it marked as sold instead.' });
    }

    await prisma.product.delete({ where: { id: productId } });
    await Promise.all((product.listingPayments || []).map((payment) => {
      const proofPath = path.join(__dirname, '..', 'private-uploads', 'listing-payment-proofs', path.basename(payment.proofImage));
      return fs.promises.unlink(proofPath).catch(() => {});
    }));

    res.json({ message: 'Product listing deleted successfully.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
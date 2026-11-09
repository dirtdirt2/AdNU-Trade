const express = require('express');
const fs = require('fs');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateUploadedImages, cleanupUploadedFiles } = require('../middleware/upload');
const path = require('path');
const { createNotification, notifyAdmins } = require('../utils/notifications');
const { ACTIVE_TRANSACTION_STATUSES, isValidMeetupDate, isValidMeetupTime } = require('../utils/transactionRules');
const cloudinary = require('../config/cloudinary');

async function deleteCloudinaryImages(assets = []) {
  await Promise.all(
    assets
      .filter(asset => asset?.public_id)
      .map(asset =>
        cloudinary.uploader.destroy(asset.public_id, {
          resource_type: 'image',
        }).catch(error => {
          console.error(
            'Failed to delete Cloudinary image:',
            error.message
          );
        })
      )
  );
}

async function uploadProductImages(files = []) {
  const uploadedAssets = [];

  try {
    for (const file of files) {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'image',
        folder: 'adnu-trade/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      });

      if (!result.secure_url || !result.public_id) {
        throw new Error('Cloudinary did not return a valid image URL.');
      }

      uploadedAssets.push(result);
    }

    return uploadedAssets;
  } catch (error) {
    await deleteCloudinaryImages(uploadedAssets);
    throw error;
  }
}


// 1. CREATE A PRODUCT LISTING. The admin sets the listing fee after reviewing it.
router.post('/', verifyToken, upload.array('images', 5), async (req, res) => {
  let uploadedAssets = [];

  try {
    await validateUploadedImages(req.files);

    const { title, description, price, category, condition } = req.body;
    const sellerId = req.user.userId;
    const numericPrice = Number(price);

    if (
      !title?.trim() ||
      !Number.isSafeInteger(numericPrice) ||
      numericPrice < 1 ||
      numericPrice > 99999999 ||
      !category
    ) {
      return res.status(400).json({
        error: 'A title, a whole-number price from ₱1 to ₱99,999,999, and a category are required.',
      });
    }

    const feeFreeSetting = await prisma.appSetting.findUnique({
      where: { key: 'free_listings_enabled' },
    });

    const freeListingsEnabled = Boolean(feeFreeSetting?.value);

    // Upload temporary files to Cloudinary and save permanent HTTPS URLs.
    uploadedAssets = await uploadProductImages(req.files || []);
    const imagePaths = uploadedAssets.map(asset => asset.secure_url);

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
        include: {
          seller: {
            select: { id: true, fullName: true, role: true },
          },
        },
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

    // Cloudinary images now belong to the successfully saved product.
    uploadedAssets = [];

    return res.status(201).json({
      message: freeListingsEnabled
        ? 'Product submitted. An admin will review and approve it. No listing fee or e-wallet payment is required while fee-free mode is enabled.'
        : 'Product submitted. An admin will review it and propose a listing fee.',
      product,
    });
  } catch (error) {
    await deleteCloudinaryImages(uploadedAssets);

    console.error('Error creating product listing:', error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? error.message
        : 'Could not create product listing.',
    });
  } finally {
    await cleanupUploadedFiles(req.files || []);
  }
});


// 2. GET ALL PUBLIC / APPROVED PRODUCTS (Marketplace Browsing)
router.get('/', verifyToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'approved',
        // Ensure no completed transaction exists for this product
        transactions: {
          none: {
            status: { in: ['placed', 'pending', 'confirmed', 'ready', 'completed'] }
          }
        }
      },
      include: {
        seller: {
          select: { id: true, fullName: true, role: true },
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
        seller: { select: { id: true, fullName: true, role: true } },
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
// Conditional updates prevent a pause/sold action from racing with checkout.
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.sellerId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only change your own listings.' });
    }

    const action = String(req.body.action || '').trim().toLowerCase();
    const allowedFrom = {
      pause: ['approved'],
      resume: ['paused'],
      sold: ['approved', 'paused'],
    };
    if (!allowedFrom[action]) return res.status(400).json({ error: 'Invalid listing action.' });

    const updatedProduct = await prisma.$transaction(async (tx) => {
      if (action === 'sold') {
        const activeTransaction = await tx.transaction.findFirst({
          where: { productId: product.id, status: { in: ['placed', 'pending', 'confirmed', 'ready'] } },
          select: { id: true },
        });
        if (activeTransaction) {
          const error = new Error('This item has an active transaction. Resolve it before marking the listing as sold.');
          error.statusCode = 409;
          throw error;
        }
      }

      const nextStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'approved' : 'sold';
      const transition = await tx.product.updateMany({
        where: { id: product.id, sellerId: req.user.userId, status: { in: allowedFrom[action] } },
        data: { status: nextStatus },
      });
      if (transition.count !== 1) {
        const error = new Error('This listing changed while you were updating it. Refresh and try again.');
        error.statusCode = 409;
        throw error;
      }
      return tx.product.findUnique({
        where: { id: product.id },
        include: { seller: { select: { id: true, fullName: true, role: true } } },
      });
    });

    return res.json({ message: 'Listing status updated.', product: updatedProduct });
  } catch (error) {
    console.error('Error changing listing status:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Could not update listing status.' });
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
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, fullName: true, role: true },
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

// 6. PURCHASE / CHECKOUT A PRODUCT. Reserving the listing and creating the
// transaction happen atomically, so two buyers cannot reserve the same item.
router.post('/:id/buy', verifyToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const buyerId = req.user.userId;
    const method = String(req.body.fulfillmentMethod || 'meetup').trim().toLowerCase();

    if (method !== 'meetup') {
      return res.status(400).json({ error: 'AdNU Trade currently supports campus meetup transactions only.' });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sellerId: true, title: true, price: true, status: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    if (product.sellerId === buyerId) {
      return res.status(400).json({ error: 'You cannot buy your own product.' });
    }
    if (product.status !== 'approved') {
      return res.status(409).json({ error: 'This listing is no longer available for purchase.' });
    }

    const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
    const meetupDate = typeof req.body.meetupDate === 'string' ? req.body.meetupDate.trim() : '';
    const meetupTime = typeof req.body.meetupTime === 'string' ? req.body.meetupTime.trim() : '';
    if (!location || !meetupDate || !meetupTime) {
      return res.status(400).json({ error: 'Campus meetup location, date, and time are required.' });
    }
    if (location.length > 250 || !isValidMeetupDate(meetupDate) || !isValidMeetupTime(meetupTime)) {
      return res.status(400).json({ error: 'Enter valid campus meetup details.' });
    }

    const totalPrice = Number(product.price);
    const trackingCode = `#ADT-${new Date().getFullYear()}-${require('crypto').randomBytes(4).toString('hex').toUpperCase()}`;

    const transaction = await prisma.$transaction(async (tx) => {
      const existingActiveTransaction = await tx.transaction.findFirst({
        where: { productId, status: { in: ACTIVE_TRANSACTION_STATUSES } },
        select: { id: true },
      });
      if (existingActiveTransaction) {
        const error = new Error('This item already has an active purchase request.');
        error.statusCode = 409;
        throw error;
      }

      // Conditional update locks the product row. Only one concurrent request
      // can move an approved product into the reserved state.
      const reservation = await tx.product.updateMany({
        where: { id: productId, sellerId: product.sellerId, status: 'approved' },
        data: { status: 'reserved' },
      });
      if (reservation.count !== 1) {
        const error = new Error('This item has just been reserved or is no longer available.');
        error.statusCode = 409;
        throw error;
      }

      return tx.transaction.create({
        data: {
          trackingCode,
          product: { connect: { id: product.id } },
          buyer: { connect: { id: buyerId } },
          seller: { connect: { id: product.sellerId } },
          totalPrice,
          status: 'pending',
          fulfillmentMethod: 'meetup',
          location,
          meetupDate,
          meetupTime,
          meetupStatus: 'pending_agreement',
          paymentMethod: 'cash_on_meetup',
          paymentStatus: 'unpaid',
        },
        include: {
          product: true,
          buyer: { select: { id: true, fullName: true, role: true } },
          seller: { select: { id: true, fullName: true, role: true } },
        },
      });
    });

    // Notifications are secondary; they must not undo a valid reservation.
    try {
      await createNotification(prisma, {
        userId: product.sellerId,
        type: 'transaction_created',
        title: 'You received a purchase request',
        body: `${transaction.buyer.fullName} placed an order for "${product.title}".`,
        link: '#/transactions',
        entityId: transaction.id,
      });
    } catch (notificationError) {
      console.error('Failed to create purchase notification:', notificationError);
    }

    return res.status(201).json({
      message: 'Transaction created successfully. The item is reserved while the seller reviews your meetup request.',
      transactionId: transaction.trackingCode,
      transaction,
    });
  } catch (error) {
    console.error('Error processing purchase:', error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Internal server error',
    });
  }
});


// 7. EDIT AN EXISTING PRODUCT (Owner check enforced)
router.put('/:id', verifyToken, upload.array('images', 5), async (req, res) => {
  let uploadedAssets = [];

  try {
    await validateUploadedImages(req.files);

    const productId = req.params.id;
    const userId = req.user.userId;
    const { title, description, price, category, condition } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.sellerId !== userId) {
      return res.status(403).json({
        error: 'Unauthorized: You can only edit your own listings.',
      });
    }

    if (['reserved', 'sold'].includes(product.status)) {
      return res.status(409).json({
        error: 'This listing cannot be edited while it is reserved or sold.',
      });
    }

    let numericPrice;

    if (price !== undefined) {
      numericPrice = Number(price);

      if (
        !Number.isSafeInteger(numericPrice) ||
        numericPrice < 1 ||
        numericPrice > 99999999
      ) {
        return res.status(400).json({
          error: 'Product price must be a whole number from ₱1 to ₱99,999,999. Decimals, zero, and negative amounts are not allowed.',
        });
      }
    }

    // Upload replacement images to Cloudinary when provided.
    let newImagePaths;

    if (req.files && req.files.length > 0) {
      uploadedAssets = await uploadProductImages(req.files);
      newImagePaths = uploadedAssets.map(asset => asset.secure_url);
    }

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

    // Keep the uploaded Cloudinary assets after the database update succeeds.
    uploadedAssets = [];

    return res.json({
      message: 'Product updated successfully.',
      product: updatedProduct,
    });
  } catch (error) {
    await deleteCloudinaryImages(uploadedAssets);

    console.error('Error updating product:', error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? error.message
        : 'Internal server error',
    });
  } finally {
    await cleanupUploadedFiles(req.files || []);
  }
});


// 8. DELETE A PRODUCT. Historical transactions are retained; a listing with
// any transaction record cannot be deleted. The conditional delete also races
// safely with checkout because reserved products are not deletable.
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.userId;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        listingPayments: { select: { proofImage: true } },
      },
    });
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.sellerId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: You can only delete your own listings.' });
    }
    if (product.status === 'payment_submitted') {
      return res.status(409).json({ error: 'You cannot delete this listing while its payment proof is under admin verification.' });
    }

    await prisma.$transaction(async (tx) => {
      const existingTransaction = await tx.transaction.findFirst({
        where: { productId },
        select: { id: true },
      });
      if (existingTransaction) {
        const error = new Error('This listing has transaction history and cannot be deleted. You can leave it marked as sold instead.');
        error.statusCode = 409;
        throw error;
      }

      const deletion = await tx.product.deleteMany({
        where: { id: productId, sellerId: userId, status: { not: 'reserved' } },
      });
      if (deletion.count !== 1) {
        const error = new Error('This listing has just been reserved or changed and cannot be deleted.');
        error.statusCode = 409;
        throw error;
      }
    });

    await Promise.all((product.listingPayments || []).map((payment) => {
      const proofPath = path.join(__dirname, '..', 'private-uploads', 'listing-payment-proofs', path.basename(payment.proofImage));
      return fs.promises.unlink(proofPath).catch(() => {});
    }));

    return res.json({ message: 'Product listing deleted successfully.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Internal server error' });
  }
});

module.exports = router;
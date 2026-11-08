const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken } = require('../middleware/auth');

// 1. GET ALL CONVERSATIONS / MESSAGES FOR THE LOGGED-IN USER
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Return only conversations in which the logged-in user is an actual participant.
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      select: {
        id: true,
        productId: true,
        senderId: true,
        receiverId: true,
        content: true,
        createdAt: true,
        readAt: true, // Used only to calculate the current recipient's unread state.
        product: { select: { id: true, title: true, price: true, category: true, sellerId: true } },
        sender: { select: { id: true, fullName: true, email: true, role: true } },
        receiver: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Never return readAt or a read/seen receipt to the sender. The flag below
    // is viewer-specific: it is true only for unread incoming messages.
    res.json(messages.map(({ readAt, ...message }) => (
      message.receiverId === userId && !readAt
        ? { ...message, unreadForViewer: true }
        : message
    )));
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. SEND A MESSAGE REGARDING A PRODUCT
router.post('/', verifyToken, async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { productId, receiverId, content } = req.body;

    if (!productId || !receiverId || !content) {
      return res.status(400).json({ error: 'Missing required fields: productId, receiverId, content.' });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Buyers may contact the seller; administrators may contact the seller about a listing.
    // Seller replies may go to a buyer who has already contacted them about this product.
    const isSeller = product.sellerId === senderId;
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && !isSeller && receiverId !== product.sellerId) {
      return res.status(403).json({ error: 'Messages about a listing must be sent to its seller.' });
    }
    if (isSeller) {
      const priorContact = await prisma.message.findFirst({
        where: { productId, senderId: receiverId, receiverId: senderId },
        select: { id: true },
      });
      if (!priorContact) {
        return res.status(403).json({ error: 'You can only reply to someone who has contacted you about this listing.' });
      }
    }
    if (isAdmin && receiverId !== product.sellerId) {
      return res.status(403).json({ error: 'Listing-related admin messages must be sent to the listing owner.' });
    }

    const newMessage = await prisma.message.create({
      data: {
        productId,
        senderId,
        receiverId,
        content,
      },
      select: { id: true, productId: true, senderId: true, receiverId: true, content: true, createdAt: true },
    });

    res.status(201).json({
      message: 'Message sent successfully.',
      data: newMessage,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Count unread incoming messages for the signed-in user only.
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: { receiverId: req.user.userId, readAt: null },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    res.status(500).json({ error: 'Could not load unread message count.' });
  }
});

// Mark a conversation as read for the current recipient only. This is private
// inbox state and is deliberately not exposed to the sender as a read receipt.
router.patch('/read', verifyToken, async (req, res) => {
  try {
    const { productId, otherUserId } = req.body;
    if (!productId || !otherUserId) {
      return res.status(400).json({ error: 'productId and otherUserId are required.' });
    }
    const result = await prisma.message.updateMany({
      where: {
        productId,
        senderId: otherUserId,
        receiverId: req.user.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    res.json({ message: 'Conversation updated.', updatedCount: result.count });
  } catch (error) {
    console.error('Error updating private message unread state:', error);
    res.status(500).json({ error: 'Could not update conversation.' });
  }
});

// 3. GET CONVERSATION HISTORY FOR A PRODUCT
router.get('/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;

    const userId = req.user.userId;
    const messages = await prisma.message.findMany({
      where: {
        productId,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: {
        id: true,
        productId: true,
        senderId: true,
        receiverId: true,
        content: true,
        createdAt: true,
        readAt: true,
        sender: { select: { id: true, fullName: true, email: true } },
        receiver: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages.map(({ readAt, ...message }) => (
      message.receiverId === userId && !readAt
        ? { ...message, unreadForViewer: true }
        : message
    )));
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
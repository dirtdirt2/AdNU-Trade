const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// Fetch the signed-in user's notification feed. No other user's notifications
// are ever returned by this API.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          entityId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Could not load notifications.' });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.userId, readAt: null },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    res.status(500).json({ error: 'Could not load unread notification count.' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.userId, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ message: 'All notifications marked as read.', updatedCount: result.count });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Could not update notifications.' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (!result.count) {
      const exists = await prisma.notification.findFirst({
        where: { id: req.params.id, userId: req.user.userId },
        select: { id: true },
      });
      if (!exists) return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Could not update notification.' });
  }
});

module.exports = router;

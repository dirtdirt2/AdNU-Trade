require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const app = express();

// 1. Global Middleware (Must come AFTER app is initialized)
app.use(cors());
app.use(express.json());

// 2. Static Folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Import & Mount Routes
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const listingPaymentRoutes = require('./routes/listingPayments');

const transactionRoutes = require('./routes/transactions');
app.use('/api/transactions', transactionRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/listing-payments', listingPaymentRoutes);
app.use('/uploads', express.static('uploads'));

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'AdNU Trade Backend is running successfully!' });
});

// TEMP DEV ROUTE: Generate a token for any user ID for Postman testing
app.get('/api/auth/dev-token/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found in database.' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, fullName: user.fullName, idNumber: user.idNumber },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Dev token generated successfully', token });
  } catch (error) {
    console.error('Error generating dev token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Only start the server if we are NOT running inside a Jest test
if (!process.env.JEST_WORKER_ID) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
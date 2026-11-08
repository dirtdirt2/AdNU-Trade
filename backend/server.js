require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const multer = require('multer');
const app = express();

// 1. Global Middleware (Must come AFTER app is initialized)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
}));

app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());

// 2. Static Folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  fallthrough: false,
  index: false,
  dotfiles: 'deny',
}));

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

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'AdNU Trade Backend is running successfully!' });
});

// Return safe, consistent errors for upload middleware and unexpected route failures.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Each image must be 5 MB or smaller.'
      : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'You can upload up to 5 images per request.'
        : 'The uploaded files could not be processed.';
    return res.status(400).json({ error: message });
  }

  const statusCode = error.statusCode || error.status;
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ error: error.message || 'The request could not be processed.' });
  }

  console.error('Unhandled request error:', error);
  return res.status(500).json({ error: 'Internal server error.' });
});

// Only start the server if we are NOT running inside a Jest test
if (!process.env.JEST_WORKER_ID) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
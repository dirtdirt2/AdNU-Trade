const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { verifyToken } = require('../middleware/auth');

// POST /api/upload - Accepts up to 5 images at once
router.post('/', verifyToken, upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided.' });
    }

    // Map uploaded files to relative URLs to save in your Product.images JSON field
    const imageUrls = req.files.map(file => `/uploads/${file.filename}`);

    res.status(200).json({
      message: 'Images uploaded successfully!',
      images: imageUrls
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ error: 'Internal server error during upload.' });
  }
});

module.exports = router;
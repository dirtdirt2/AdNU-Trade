
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  validateUploadedImages,
  cleanupUploadedFiles,
} = require('../middleware/upload');
const { verifyToken } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

router.post('/', verifyToken, upload.array('images', 5), async (req, res) => {
  const uploadedAssets = [];

  try {
    await validateUploadedImages(req.files);

    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'image',
        folder: 'adnu-trade/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      });

      uploadedAssets.push(result);
    }

    return res.status(200).json({
      message: 'Images uploaded successfully!',
      images: uploadedAssets.map((asset) => asset.secure_url),
    });
  } catch (error) {
    await Promise.all(
      uploadedAssets.map((asset) =>
        cloudinary.uploader.destroy(asset.public_id, {
          resource_type: 'image',
        }).catch(() => {})
      )
    );

    console.error('Error uploading images:', error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? error.message
        : 'Internal server error during image upload.',
    });
  } finally {
    await cleanupUploadedFiles(req.files || []);
  }
});

module.exports = router;

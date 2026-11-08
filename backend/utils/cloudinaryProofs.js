
const cloudinary = require('../config/cloudinary');

const uploadPaymentProof = async (file) => {
  const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
  const extension = file.mimetype === 'application/pdf'
    ? 'pdf'
    : file.mimetype === 'image/jpeg'
      ? 'jpg'
      : file.mimetype === 'image/png'
        ? 'png'
        : 'webp';

  const publicId = `adnu-trade/payment-proofs/${require('crypto').randomUUID()}.${extension}`;

  const result = await cloudinary.uploader.upload(file.path, {
    resource_type: resourceType,
    type: 'authenticated',
    public_id: publicId,
    overwrite: false,
  });

  return {
    reference: `cloudinary:${resourceType}:${result.public_id}`,
    publicId: result.public_id,
    resourceType,
    extension,
  };
};

const deletePaymentProof = async (proof) => {
  if (!proof?.publicId || !proof?.resourceType) return;

  await cloudinary.uploader.destroy(proof.publicId, {
    resource_type: proof.resourceType,
    type: 'authenticated',
    invalidate: true,
  });
};

const getPaymentProofUrl = (reference) => {
  if (typeof reference !== 'string' || !reference.startsWith('cloudinary:')) {
    throw new Error('Unsupported payment proof reference.');
  }

  const parts = reference.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid payment proof reference.');
  }

  const [, resourceType, publicId] = parts;
  if (!['image', 'raw'].includes(resourceType) || !publicId) {
    throw new Error('Invalid payment proof reference.');
  }

  const extension = publicId.split('.').pop();
  return cloudinary.utils.private_download_url(publicId, extension, {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 60,
  });
};

module.exports = {
  uploadPaymentProof,
  deletePaymentProof,
  getPaymentProofUrl,
};

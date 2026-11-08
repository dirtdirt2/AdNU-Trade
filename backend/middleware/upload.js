const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => {
    const extension = MIME_EXTENSIONS[file.mimetype];
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter = (_req, file, callback) => {
  if (!Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, file.mimetype)) {
    const error = new Error('Only JPEG, PNG, WEBP, and GIF images are allowed.');
    error.statusCode = 400;
    return callback(error);
  }
  return callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fields: 20,
    parts: 30,
  },
});

const matchesImageSignature = (mimeType, header) => {
  switch (mimeType) {
    case 'image/jpeg':
      return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case 'image/png':
      return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    case 'image/gif':
      return header.length >= 6 && ['GIF87a', 'GIF89a'].includes(header.toString('ascii', 0, 6));
    default:
      return false;
  }
};

async function validateUploadedImages(files = []) {
  for (const file of files) {
    let handle;
    try {
      handle = await fs.promises.open(file.path, 'r');
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      if (!matchesImageSignature(file.mimetype, header.subarray(0, bytesRead))) {
        const error = new Error('One of the uploaded files is not a valid supported image.');
        error.statusCode = 400;
        throw error;
      }
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  }
}

async function cleanupUploadedFiles(files = []) {
  await Promise.all((files || []).map((file) => {
    if (!file?.path) return Promise.resolve();
    return fs.promises.unlink(file.path).catch(() => {});
  }));
}

module.exports = upload;
module.exports.validateUploadedImages = validateUploadedImages;
module.exports.cleanupUploadedFiles = cleanupUploadedFiles;
module.exports.uploadDirectory = UPLOAD_DIR;

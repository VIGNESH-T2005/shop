import multer from 'multer';
import { ApiError } from '../utils/ApiError';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|avif|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, 'Only PNG, JPG, WebP, AVIF or GIF images are allowed.', 'BAD_FILE'));
  },
});

/**
 * routes/api.js
 * API routes for key generation, signing, and verification.
 *
 * Mounted at /api by server.js, so endpoints are:
 * - POST /api/generate-keys
 * - POST /api/sign
 * - POST /api/verify
 */

const express = require("express");
const multer = require("multer");
const cryptoController = require("../controllers/cryptoController");
const { ApiError } = require("../services/cryptoServices");

const router = express.Router();

/**
 * Wraps an async route handler so rejections are forwarded to Express error middleware.
 * @param {(req: any, res: any, next: any) => Promise<any>} handler Async handler.
 * @returns {(req: any, res: any, next: any) => void} Express middleware.
 */
function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

function uploadSingle(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new ApiError(413, "Payload Too Large", {
            issue: "file too large",
            limitBytes: MAX_UPLOAD_BYTES
          }));
        }
        return next(new ApiError(400, "Bad Request", {
          issue: "upload failed",
          code: err.code
        }));
      }

      return next(err);
    });
  };
}

// POST /api/generate-keys -> returns { publicKey: PEM, privateKey: PEM }
router.post("/generate-keys", wrapAsync(cryptoController.generateKeys));

// POST /api/sign (multipart) fields: document(file), privateKey(PEM) -> returns { signature: base64, hash: hex }
router.post("/sign", uploadSingle("document"), wrapAsync(cryptoController.sign));

// POST /api/verify (multipart) fields: document(file), signature(base64), publicKey(PEM) -> returns { isValid: boolean, hash: hex }
router.post("/verify", uploadSingle("document"), wrapAsync(cryptoController.verify));

module.exports = router;
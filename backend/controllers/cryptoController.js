/**
 * controllers/cryptoController.js
 * Controllers translate HTTP requests into service calls and shape responses.
 *
 * NOTE:
 * - Validation is primarily performed in the service layer for consistency.
 * - Errors are thrown as ApiError and handled by the global error middleware.
 */

const cryptoService = require("../services/cryptoServices");

/**
 * Handles POST /api/generate-keys.
 * @param {import("express").Request} req Express request.
 * @param {import("express").Response} res Express response.
 * @returns {Promise<void>} Resolves when response is sent.
 */
async function generateKeys(req, res) {
  const keys = await cryptoService.generateKeys();
  res.json(keys);
}

/**
 * Handles POST /api/sign.
 * Accepts either:
 * - JSON body: { document: string, privateKey: string (PEM) }
 * - multipart/form-data: document (file) + privateKey (text)
 * @param {import("express").Request} req Express request.
 * @param {import("express").Response} res Express response.
 * @returns {Promise<void>} Resolves when response is sent.
 */
async function sign(req, res) {
  const privateKey = req.body?.privateKey;
  const document = req.file?.buffer ?? req.body?.document;

  const result = await cryptoService.signDocument({ document, privateKey });
  res.json(result);
}

/**
 * Handles POST /api/verify.
 * Accepts either:
 * - JSON body: { document: string, signature: string (base64), publicKey: string (PEM) }
 * - multipart/form-data: document (file) + signature (text) + publicKey (text)
 * @param {import("express").Request} req Express request.
 * @param {import("express").Response} res Express response.
 * @returns {Promise<void>} Resolves when response is sent.
 */
async function verify(req, res) {
  const document = req.file?.buffer ?? req.body?.document;
  const signature = req.body?.signature;
  const publicKey = req.body?.publicKey;

  const result = await cryptoService.verifySignature({
    document,
    signature,
    publicKey
  });
  res.json(result);
}

module.exports = { generateKeys, sign, verify };
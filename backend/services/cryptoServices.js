/**
 * services/cryptoServices.js
 * Cryptography service using Node.js built-in crypto with DSA keys.
 *
 * Requirements implemented:
 * - DSA key generation via crypto.generateKeyPair('dsa')
 * - Signing/verifying via crypto.sign / crypto.verify
 * - Deterministic timestamped payload encoding + MD5 hashing (hex) returned alongside signature/verification
 * - No persistence (no DB, no filesystem)
 */

const crypto = require("node:crypto");

/**
 * Custom API error that carries an HTTP status code and optional details.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code.
   * @param {string} message Error message.
   * @param {any} [details] Optional diagnostic details for 4xx errors.
   */
  constructor(statusCode, message, details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    if (typeof details !== "undefined") {
      this.details = details;
    }
  }
}

/**
 * Ensures a value is a string. Allows empty strings unless allowEmpty is false.
 * @param {any} value Value to validate.
 * @param {string} fieldName Field name for error details.
 * @param {{ allowEmpty?: boolean }} [options] Options.
 * @returns {string} The validated string.
 * @throws {ApiError} If validation fails.
 */
function requireString(value, fieldName, options = {}) {
  const { allowEmpty = true } = options;

  if (typeof value !== "string") {
    throw new ApiError(400, "Bad Request", {
      field: fieldName,
      issue: "must be a string"
    });
  }

  if (!allowEmpty && value.length === 0) {
    throw new ApiError(400, "Bad Request", {
      field: fieldName,
      issue: "must not be empty"
    });
  }

  return value;
}

/**
 * Ensures the document is provided as either a UTF-8 string or a Buffer (raw bytes).
 * @param {any} value Document content.
 * @returns {Buffer} Document bytes.
 * @throws {ApiError} If validation fails.
 */
function requireDocumentBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === "string") return Buffer.from(value, "utf8");

  throw new ApiError(400, "Bad Request", {
    field: "document",
    issue: "must be a string or a file"
  });
}

/**
 * Computes MD5 hash for raw bytes.
 * @param {Buffer} bytes Bytes to hash.
 * @returns {string} Hex-encoded MD5 hash.
 */
function md5HexFromBytes(bytes) {
  // Critical logic: hashing must be done on the exact bytes signed/verified.
  return crypto.createHash("md5").update(bytes).digest("hex");
}

/**
 * Computes MD5 digest bytes for raw bytes.
 * @param {Buffer} bytes Bytes to hash.
 * @returns {Buffer} 16-byte MD5 digest.
 */
function md5DigestFromBytes(bytes) {
  return crypto.createHash("md5").update(bytes).digest();
}

/**
 * Builds deterministic, binary-safe payload bytes for signing/verifying.
 * Format: magic 'DSSv1' + 0x00 + tsLen UInt32BE + tsBytes + docLen UInt32BE + docBytes
 * @param {string} timestamp ISO timestamp string.
 * @param {Buffer} documentBytes Document bytes.
 * @returns {Buffer} Payload bytes.
 */
function buildTimestampedPayloadBytes(timestamp, documentBytes) {
  const tsBytes = Buffer.from(timestamp, "utf8");
  const tsLenBuf = Buffer.alloc(4);
  tsLenBuf.writeUInt32BE(tsBytes.length, 0);

  const docLenBuf = Buffer.alloc(4);
  docLenBuf.writeUInt32BE(documentBytes.length, 0);

  const magic = Buffer.from("DSSv1", "ascii");
  const zero = Buffer.from([0x00]);

  return Buffer.concat([magic, zero, tsLenBuf, tsBytes, docLenBuf, documentBytes]);
}

/**
 * Returns an RFC3339/ISO-8601 timestamp string in Philippines time (UTC+08:00).
 * Deterministic implementation with a fixed offset (PH has no DST).
 *
 * Format: YYYY-MM-DDTHH:mm:ss.SSS+08:00
 * Example: 2026-04-12T13:55:34.181+08:00
 *
 * @param {Date} [date] Base date/time (defaults to now).
 * @returns {string}
 */
function philippinesTimestamp(date = new Date()) {
  const pad2 = (n) => String(n).padStart(2, "0");
  const pad3 = (n) => String(n).padStart(3, "0");

  const offsetMinutes = 8 * 60;
  const offsetMs = offsetMinutes * 60 * 1000;

  // Shift the instant forward by +08:00, then format using UTC getters.
  // This avoids dependence on the server's local timezone.
  const shifted = new Date(date.getTime() + offsetMs);

  const year = shifted.getUTCFullYear();
  const month = pad2(shifted.getUTCMonth() + 1);
  const day = pad2(shifted.getUTCDate());
  const hours = pad2(shifted.getUTCHours());
  const minutes = pad2(shifted.getUTCMinutes());
  const seconds = pad2(shifted.getUTCSeconds());
  const millis = pad3(shifted.getUTCMilliseconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}+08:00`;
}

/**
 * Validates and parses a timestamp string.
 * - Required to be a non-empty string
 * - Must be parseable as a Date
 * - Recommended to be strict ISO 8601 / RFC3339 with an explicit offset
 * @param {any} value Timestamp to validate.
 * @returns {{ timestamp: string, date: Date }}
 */
function requireTimestamp(value) {
  const timestamp = requireString(value, "timestamp", { allowEmpty: false });

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Bad Request", {
      field: "timestamp",
      issue: "must be a parseable date string",
      recommendation: "use ISO 8601 / RFC3339, e.g. 2026-04-12T18:20:30.000+08:00"
    });
  }

  // Recommended (not enforced): strict ISO 8601 / RFC3339 timestamps.
  // Example: 2026-04-12T18:20:30.000+08:00

  return { timestamp, date };
}

/**
 * Optional replay/freshness guard.
 * Enabled only when ENFORCE_TIMESTAMP_FRESHNESS==='true'.
 *
 * Defaults:
 * - MAX_SIGNATURE_AGE_MS: 5 minutes
 * - MAX_FUTURE_SKEW_MS: 2 minutes
 *
 * @param {Date} timestampDate Parsed timestamp date.
 */
function maybeEnforceTimestampFreshness(timestampDate) {
  if (process.env.ENFORCE_TIMESTAMP_FRESHNESS !== "true") return;

  const maxAgeMsRaw = process.env.MAX_SIGNATURE_AGE_MS;
  const maxFutureSkewMsRaw = process.env.MAX_FUTURE_SKEW_MS;

  const maxAgeMsParsed = Number(maxAgeMsRaw);
  const maxFutureSkewMsParsed = Number(maxFutureSkewMsRaw);

  const maxAgeMs = Number.isFinite(maxAgeMsParsed) && maxAgeMsParsed > 0 ? maxAgeMsParsed : 5 * 60 * 1000;
  const maxFutureSkewMs =
    Number.isFinite(maxFutureSkewMsParsed) && maxFutureSkewMsParsed >= 0
      ? maxFutureSkewMsParsed
      : 2 * 60 * 1000;

  const nowMs = Date.now();
  const tsMs = timestampDate.getTime();

  if (tsMs - nowMs > maxFutureSkewMs) {
    throw new ApiError(400, "Bad Request", {
      field: "timestamp",
      issue: "is too far in the future",
      maxFutureSkewMs
    });
  }

  if (nowMs - tsMs > maxAgeMs) {
    throw new ApiError(400, "Bad Request", {
      field: "timestamp",
      issue: "is too old",
      maxAgeMs
    });
  }
}

/**
 * Validates that a base64 string is well-formed.
 * @param {string} value Base64 string.
 * @param {string} fieldName Field name for error details.
 * @returns {string} The validated base64 string.
 * @throws {ApiError} If invalid.
 */
function requireBase64(value, fieldName) {
  requireString(value, fieldName, { allowEmpty: false });

  // Strict-ish base64 validation (no whitespace; correct padding).
  const base64Regex =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  if (!base64Regex.test(value)) {
    throw new ApiError(400, "Bad Request", {
      field: fieldName,
      issue: "must be valid base64"
    });
  }

  return value;
}

/**
 * Parses a PEM-encoded private key into a KeyObject and ensures it is usable.
 * @param {string} privateKeyPem PEM-encoded private key.
 * @returns {crypto.KeyObject} Parsed private key KeyObject.
 * @throws {ApiError} If invalid or unsupported.
 */
function parsePrivateKey(privateKeyPem) {
  try {
    requireString(privateKeyPem, "privateKey", { allowEmpty: false });
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 400 && err?.details?.field === "privateKey") {
      throw new ApiError(
        400,
        "❌ Invalid private key! Please paste a valid DSA PEM private key.",
        err.details
      );
    }
    throw err;
  }

  // Lightweight pre-parse checks to catch common copy/paste mistakes.
  const pemText = privateKeyPem.trim();

  if (pemText.includes("BEGIN PUBLIC KEY") || pemText.includes("BEGIN DSA PUBLIC KEY")) {
    throw new ApiError(
      400,
      "❌ That looks like a public key! Please paste the PRIVATE key PEM to sign.",
      { field: "privateKey", issue: "must be a private key PEM" }
    );
  }

  const hasLiteralEscapedNewlines = pemText.includes("\\n");
  const hasRealNewlines = /[\r\n]/.test(pemText);
  if (hasLiteralEscapedNewlines && !hasRealNewlines) {
    throw new ApiError(
      400,
      "❌ The private key appears to have escaped newlines (\\n). Replace them with real line breaks, or copy the key directly from the textarea.",
      { field: "privateKey", issue: "must contain real line breaks (not escaped \\\\n sequences)" }
    );
  }

  const hasPemBegin = /-----BEGIN [A-Z0-9 ]+-----/.test(pemText);
  const hasPemEnd = /-----END [A-Z0-9 ]+-----/.test(pemText);
  if (!hasPemBegin || !hasPemEnd) {
    throw new ApiError(
      400,
      "❌ Private key PEM looks incomplete. Make sure you copied the entire block including the BEGIN/END lines.",
      { field: "privateKey", issue: "must include full PEM block (BEGIN/END lines)" }
    );
  }

  try {
    // Critical logic: createPrivateKey validates the PEM structure.
    const keyObject = crypto.createPrivateKey({
      key: privateKeyPem,
      format: "pem"
    });

    if (keyObject?.type !== "private") {
      throw new ApiError(400, "❌ Invalid private key! Please paste a valid DSA PEM private key.", {
        field: "privateKey",
        issue: "must be a valid private key (PEM)"
      });
    }

    if (keyObject?.asymmetricKeyType !== "dsa") {
      const foundType = typeof keyObject?.asymmetricKeyType === "string" && keyObject.asymmetricKeyType
        ? keyObject.asymmetricKeyType
        : "unknown";

      throw new ApiError(
        400,
        `❌ Wrong private key type: expected a DSA private key, but got ${foundType}.`,
        {
          field: "privateKey",
          issue: "must be a valid DSA private key (PEM)",
          foundType
        }
      );
    }

    return keyObject;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    const rawMessage = typeof err?.message === "string" ? err.message : "";
    const lowerMessage = rawMessage.toLowerCase();

    const looksEncrypted =
      lowerMessage.includes("encrypted") ||
      lowerMessage.includes("passphrase") ||
      lowerMessage.includes("pass phrase") ||
      lowerMessage.includes("bad decrypt") ||
      lowerMessage.includes("bad password") ||
      lowerMessage.includes("wrong tag") ||
      lowerMessage.includes("unknown cipher");

    const issue = looksEncrypted
      ? "must be an unencrypted DSA PEM private key (no passphrase)"
      : "must be a valid DSA PEM private key";

    const message = looksEncrypted
      ? "❌ Encrypted private key! Please paste an unencrypted DSA PEM private key."
      : "❌ Invalid private key! Please paste a valid DSA PEM private key.";

    throw new ApiError(400, message, {
      field: "privateKey",
      issue,
      cause: rawMessage
    });
  }
}

/**
 * Parses a PEM-encoded public key into a KeyObject and ensures it is usable.
 * @param {string} publicKeyPem PEM-encoded public key.
 * @returns {crypto.KeyObject} Parsed public key KeyObject.
 * @throws {ApiError} If invalid or unsupported.
 */
function parsePublicKey(publicKeyPem) {
  try {
    requireString(publicKeyPem, "publicKey", { allowEmpty: false });

    // Critical logic: createPublicKey validates the PEM structure.
    const keyObject = crypto.createPublicKey({
      key: publicKeyPem,
      format: "pem"
    });

    // Ensure the key is usable for this app: it must be a DSA public key.
    // (A valid-but-nonmatching DSA key is handled later as isValid=false, not an error.)
    if (keyObject?.type !== "public" || keyObject?.asymmetricKeyType !== "dsa") {
      throw new ApiError(400, "Wrong public key", {
        field: "publicKey",
        issue: "must be a valid DSA public key"
      });
    }

    return keyObject;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err?.details?.field === "publicKey" && err.message !== "Wrong public key") {
        throw new ApiError(400, "Wrong public key", err.details);
      }

      throw err;
    }

    throw new ApiError(400, "Wrong public key", {
      field: "publicKey",
      issue: "must be a valid DSA PEM public key",
      cause: err?.message
    });
  }
}

/**
 * Generates a DSA key pair (PEM-encoded).
 * @returns {Promise<{publicKey: string, privateKey: string}>} Key pair in PEM format.
 * @throws {ApiError} If generation fails.
 */
async function generateKeys() {
  // Use a Promise wrapper to make generateKeyPair awaitable.
  const keyPair = await new Promise((resolve, reject) => {
    crypto.generateKeyPair(
      "dsa",
      {
        // Common secure default sizes. divisorLength can be 224 or 256 for 2048-bit modulus.
        modulusLength: 2048,
        divisorLength: 224,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" }
      },
      (err, publicKey, privateKey) => {
        if (err) return reject(err);
        resolve({ publicKey, privateKey });
      }
    );
  }).catch((err) => {
    throw new ApiError(500, "Internal Server Error", {
      issue: "key generation failed",
      cause: err?.message
    });
  });

  return keyPair;
}

/**
 * Signs a document using a PEM private key.
 * @param {{document: any, privateKey: any}} input Input values (validated internally).
 * @returns {Promise<{signature: string, hash: string, timestamp: string}>} Signature (base64), payload hash (hex), and timestamp.
 * @throws {ApiError} If validation fails or signing fails.
 */
async function signDocument(input) {
  const missing = [];

  const documentValue = input?.document;
  if (
    typeof documentValue === "undefined" ||
    documentValue === null ||
    (typeof documentValue === "string" && documentValue.length === 0) ||
    (Buffer.isBuffer(documentValue) && documentValue.length === 0)
  ) {
    missing.push("document");
  }

  const privateKeyValue = input?.privateKey;
  if (
    typeof privateKeyValue === "undefined" ||
    privateKeyValue === null ||
    (typeof privateKeyValue === "string" && privateKeyValue.trim().length === 0)
  ) {
    missing.push("privateKey");
  }

  if (missing.length > 0) {
    throw new ApiError(
      400,
      "⚠️ Missing information! Please make sure the document, and private key are all provided.",
      { missing }
    );
  }

  const documentBytes = requireDocumentBytes(input?.document);
  const privateKeyObject = parsePrivateKey(input?.privateKey);

  const timestamp = philippinesTimestamp();
  const payloadBytes = buildTimestampedPayloadBytes(timestamp, documentBytes);
  const hash = md5HexFromBytes(payloadBytes);
  const md5DigestBytes = md5DigestFromBytes(payloadBytes);

  try {
    // Prefer signing the 16-byte MD5 digest bytes directly.
    // If the current Node/OpenSSL runtime doesn't support raw digest signing for DSA,
    // fall back to having OpenSSL compute the MD5 digest from the payload bytes.
    let signature;
    try {
      signature = crypto.sign(null, md5DigestBytes, privateKeyObject);
    } catch (rawErr) {
      const rawMsg = typeof rawErr?.message === "string" ? rawErr.message : "";
      const looksLikeUnsupportedRawDigest =
        rawErr instanceof TypeError ||
        rawMsg.toLowerCase().includes("digest") ||
        rawMsg.toLowerCase().includes("algorithm") ||
        rawMsg.toLowerCase().includes("unknown") ||
        rawMsg.toLowerCase().includes("unsupported");

      if (!looksLikeUnsupportedRawDigest) throw rawErr;

      signature = crypto.sign("md5", payloadBytes, privateKeyObject);
    }

    return {
      signature: signature.toString("base64"),
      hash,
      timestamp
    };
  } catch (err) {
    throw new ApiError(400, "Bad Request", {
      issue: "signing failed",
      cause: err?.message
    });
  }
}

/**
 * Verifies a signature against a document using a PEM public key.
 * @param {{document: any, signature: any, publicKey: any, timestamp: any}} input Input values (validated internally).
 * @returns {Promise<{isValid: boolean, hash: string, timestamp: string}>} Verification result and document hash (hex).
 * @throws {ApiError} If validation fails or verification fails unexpectedly.
 */
async function verifySignature(input) {
  const missing = [];

  const documentValue = input?.document;
  if (
    typeof documentValue === "undefined" ||
    documentValue === null ||
    (typeof documentValue === "string" && documentValue.length === 0) ||
    (Buffer.isBuffer(documentValue) && documentValue.length === 0)
  ) {
    missing.push("document");
  }

  const signatureValue = input?.signature;
  if (
    typeof signatureValue === "undefined" ||
    signatureValue === null ||
    (typeof signatureValue === "string" && signatureValue.trim().length === 0)
  ) {
    missing.push("signature");
  }

  const publicKeyValue = input?.publicKey;
  if (
    typeof publicKeyValue === "undefined" ||
    publicKeyValue === null ||
    (typeof publicKeyValue === "string" && publicKeyValue.trim().length === 0)
  ) {
    missing.push("publicKey");
  }

  const timestampValue = input?.timestamp;
  if (
    typeof timestampValue === "undefined" ||
    timestampValue === null ||
    (typeof timestampValue === "string" && timestampValue.trim().length === 0)
  ) {
    missing.push("timestamp");
  }

  if (missing.length > 0) {
    throw new ApiError(
      400,
      "⚠️ Missing information! Please make sure the document, signature, public key, and timestamp are all provided.",
      { missing }
    );
  }

  const documentBytes = requireDocumentBytes(input?.document);
  const { timestamp, date: timestampDate } = requireTimestamp(input?.timestamp);
  maybeEnforceTimestampFreshness(timestampDate);

  let signatureBase64;
  try {
    signatureBase64 = requireBase64(input?.signature, "signature");
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.statusCode === 400 &&
      err?.details?.field === "signature" &&
      err?.details?.issue === "must be valid base64"
    ) {
      throw new ApiError(
        400,
        "❌ Invalid signature! The signature itself appears to have been altered. Verification failed.",
        {
          field: "signature",
          issue: "must be valid base64"
        }
      );
    }

    throw err;
  }

  const publicKeyObject = parsePublicKey(input?.publicKey);

  const payloadBytes = buildTimestampedPayloadBytes(timestamp, documentBytes);
  const hash = md5HexFromBytes(payloadBytes);
  const md5DigestBytes = md5DigestFromBytes(payloadBytes);

  try {
    const signature = Buffer.from(signatureBase64, "base64");

    // Critical logic: algorithm and bytes must match signing.
    let isValid;
    try {
      isValid = crypto.verify(null, md5DigestBytes, publicKeyObject, signature);
    } catch (rawErr) {
      const rawMsg = typeof rawErr?.message === "string" ? rawErr.message : "";
      const looksLikeUnsupportedRawDigest =
        rawErr instanceof TypeError ||
        rawMsg.toLowerCase().includes("digest") ||
        rawMsg.toLowerCase().includes("algorithm") ||
        rawMsg.toLowerCase().includes("unknown") ||
        rawMsg.toLowerCase().includes("unsupported");

      if (!looksLikeUnsupportedRawDigest) throw rawErr;

      isValid = crypto.verify("md5", payloadBytes, publicKeyObject, signature);
    }

    return { isValid, hash, timestamp };
  } catch (err) {
    // Nice-to-have: if OpenSSL throws due to a key-type mismatch, surface a clearer error.
    // (Non-matching signatures should still return isValid=false, not throw.)
    const maybeKeyTypeMismatch =
      typeof err?.message === "string" &&
      (err.message.includes("key type") ||
        err.message.includes("public key") ||
        err.message.includes("PEM routines") ||
        err.message.includes("EVP_PKEY") ||
        err.message.includes("expecting"));

    if (maybeKeyTypeMismatch) {
      throw new ApiError(400, "Wrong public key", {
        field: "publicKey",
        issue: "must be a valid DSA public key",
        cause: err?.message
      });
    }

    throw new ApiError(400, "Wrong public key", {
      field: "publicKey",
      issue: "verification failed",
      cause: err?.message
    });
  }
}

module.exports = {
  ApiError,
  generateKeys,
  signDocument,
  verifySignature
};
/**
 * Client-side hashing helpers (legacy).
 *
 * Note: the signing/verifying scheme in this repo is performed on the backend over a
 * deterministic, timestamped payload and uses an MD5 digest for the signed bytes.
 *
 * This SHA-256 helper is kept only as an optional/legacy UI aid and is not part of
 * the signature verification contract.
 */

import md5 from 'blueimp-md5'

/**
 * Convert an ArrayBuffer to a lowercase hex string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToHex(buffer) {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Compute SHA-256 hash (hex) for a given string.
 * Critical flow: any change to the document changes this hash, which breaks signature verification.
 * @param {string} input
 * @returns {Promise<string>}
 */
export async function sha256Hex(input) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this browser/environment.')
  }

  // Critical: signatures are computed over bytes; we must hash the same UTF-8 bytes consistently.
  const encoder = new TextEncoder()
  const data = encoder.encode(input)

  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return arrayBufferToHex(digest)
}

/**
 * Compute an MD5 hex digest for a given value.
 *
 * Per project requirements, MD5 is used here strictly for demonstration.
 * Do NOT use MD5 for real password storage.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function md5Hex(value) {
  return md5(String(value ?? ''))
}

/**
 * Hash a password using MD5.
 *
 * IMPORTANT: callers should pass the raw password only to this function and never
 * persist the raw password. Store the returned hash instead.
 *
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  return md5Hex(password)
}
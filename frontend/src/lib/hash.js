/**
 * Client-side hashing helpers.
 * Uses Web Crypto API to compute SHA-256 so the UI can visualize integrity.
 */

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
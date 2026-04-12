import md5 from 'blueimp-md5'
import SparkMD5 from 'spark-md5'
import {
  KJUR,
  KEYUTIL,
  b64tohex,
  hextob64,
  DSA as JsrsasignDSA,
  Signature as JsrsasignSignature,
} from 'jsrsasign'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function pad3(n) {
  return String(n).padStart(3, '0')
}

/**
 * Returns an RFC3339/ISO-8601 timestamp string in Philippines time (UTC+08:00).
 * Format: YYYY-MM-DDTHH:mm:ss.SSS+08:00
 * @param {Date} [date]
 * @returns {string}
 */
function philippinesTimestamp(date = new Date()) {
  const offsetMinutes = 8 * 60
  const offsetMs = offsetMinutes * 60 * 1000
  const shifted = new Date(date.getTime() + offsetMs)

  const year = shifted.getUTCFullYear()
  const month = pad2(shifted.getUTCMonth() + 1)
  const day = pad2(shifted.getUTCDate())
  const hours = pad2(shifted.getUTCHours())
  const minutes = pad2(shifted.getUTCMinutes())
  const seconds = pad2(shifted.getUTCSeconds())
  const millis = pad3(shifted.getUTCMilliseconds())

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}+08:00`
}

function bytesToHex(bytes) {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function asciiBytes(text) {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff
  return out
}

function uint32beBytes(value) {
  const out = new Uint8Array(4)
  const view = new DataView(out.buffer)
  view.setUint32(0, value >>> 0, false)
  return out
}

async function documentToBytes(document) {
  if (document == null) {
    throw new Error('document is required')
  }

  if (typeof document === 'string') {
    return new TextEncoder().encode(document)
  }

  if (document instanceof Uint8Array) {
    return document
  }

  if (document instanceof ArrayBuffer) {
    return new Uint8Array(document)
  }

  // Support File/Blob without tying this module to React or storage.
  if (typeof Blob !== 'undefined' && document instanceof Blob) {
    const buf = await document.arrayBuffer()
    return new Uint8Array(buf)
  }

  // Some environments may provide objects with arrayBuffer() but without Blob.
  if (typeof document?.arrayBuffer === 'function') {
    const buf = await document.arrayBuffer()
    return new Uint8Array(buf)
  }

  throw new Error('document must be a string, ArrayBuffer, Uint8Array, File, or Blob')
}

function arrayBufferViewToArrayBuffer(view) {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
    return view.buffer
  }
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
}

/**
 * Builds deterministic, binary-safe payload bytes for signing/verifying.
 * Format: magic 'DSSv1' + 0x00 + tsLen UInt32BE + tsBytes + docLen UInt32BE + docBytes
 * @param {string} timestamp
 * @param {Uint8Array} documentBytes
 * @returns {Uint8Array}
 */
function buildTimestampedPayloadBytes(timestamp, documentBytes) {
  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    throw new Error('timestamp is required')
  }

  const tsBytes = new TextEncoder().encode(timestamp)
  const magic = asciiBytes('DSSv1')
  const zero = new Uint8Array([0x00])
  const tsLen = uint32beBytes(tsBytes.length)
  const docLen = uint32beBytes(documentBytes.length)

  const out = new Uint8Array(
    magic.length +
      zero.length +
      tsLen.length +
      tsBytes.length +
      docLen.length +
      documentBytes.length,
  )

  let offset = 0
  out.set(magic, offset)
  offset += magic.length
  out.set(zero, offset)
  offset += zero.length
  out.set(tsLen, offset)
  offset += tsLen.length
  out.set(tsBytes, offset)
  offset += tsBytes.length
  out.set(docLen, offset)
  offset += docLen.length
  out.set(documentBytes, offset)

  return out
}

function md5HexFromBytes(bytes) {
  const buffer = arrayBufferViewToArrayBuffer(bytes)
  return SparkMD5.ArrayBuffer.hash(buffer)
}

function isProbablyHexString(s) {
  return typeof s === 'string' && s.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(s)
}

function dsaSignRawMessageHashHex(privateKeyObj, messageHashHex) {
  if (!isProbablyHexString(messageHashHex)) {
    throw new Error('messageHashHex must be a hex string')
  }

  const candidates = [
    privateKeyObj?.signWithMessageHash,
    privateKeyObj?.signWithMessageHashHex,
    privateKeyObj?.sign,
  ]

  for (const fn of candidates) {
    if (typeof fn !== 'function') continue
    try {
      const out = fn.call(privateKeyObj, messageHashHex)
      if (typeof out === 'string' && isProbablyHexString(out)) return out
    } catch {
      // try next
    }
  }

  throw new Error('Raw DSA signing API is not available')
}

function dsaVerifyRawMessageHashHex(publicKeyObj, messageHashHex, signatureHex) {
  if (!isProbablyHexString(messageHashHex)) {
    throw new Error('messageHashHex must be a hex string')
  }
  if (!isProbablyHexString(signatureHex)) {
    throw new Error('signatureHex must be a hex string')
  }

  const candidates = [
    publicKeyObj?.verifyWithMessageHash,
    publicKeyObj?.verifyWithMessageHashHex,
    publicKeyObj?.verify,
  ]

  for (const fn of candidates) {
    if (typeof fn !== 'function') continue
    try {
      // jsrsasign has used different arg orders across APIs/versions.
      // Try (hash, sig) first, then (sig, hash).
      const attempts = [
        () => fn.call(publicKeyObj, messageHashHex, signatureHex),
        () => fn.call(publicKeyObj, signatureHex, messageHashHex),
      ]

      for (const attempt of attempts) {
        try {
          const out = attempt()
          if (typeof out === 'boolean') return out
          if (typeof out === 'number') return out === 1
        } catch {
          // try next arg order
        }
      }
    } catch {
      // try next
    }
  }

  throw new Error('Raw DSA verify API is not available')
}

function getSignatureCtor() {
  return JsrsasignSignature || KJUR?.crypto?.Signature
}

function ensureDsaImplementationLoaded() {
  // Some bundlers/tree-shakers can drop dynamically-referenced algorithms.
  // This forces a static reference to DSA so browser builds keep it.
  void JsrsasignDSA
  void KJUR?.crypto?.DSA
}

function ensureEcdsaImplementationLoaded() {
  // Similar to DSA: keep ECDSA code paths from being tree-shaken.
  void KJUR?.crypto?.ECDSA
}

function getKeyType(keyObj) {
  const t = String(keyObj?.type || keyObj?.keyType || keyObj?.alg || '').toUpperCase()
  if (t === 'DSA') return 'DSA'
  if (t === 'EC' || t === 'ECDSA') return 'EC'
  return ''
}

function normalizePem(pem) {
  return String(pem || '').trim().replace(/\r\n/g, '\n')
}

/**
 * Generate a keypair (PEM strings).
 * Browser builds of jsrsasign support RSA and EC key generation via KEYUTIL.generateKeypair.
 * @returns {Promise<{publicKey: string, privateKey: string}>}
 */
export async function generateKeys() {
  if (typeof KEYUTIL?.generateKeypair !== 'function') {
    throw new Error('jsrsasign KEYUTIL.generateKeypair is not available in this environment')
  }

  // Use a modern, widely supported curve.
  // jsrsasign expects curve name for EC keygen (aka P-256 / secp256r1).
  let keypair
  try {
    keypair = KEYUTIL.generateKeypair('EC', 'secp256r1')
  } catch {
    // Some versions accept an object form.
    keypair = KEYUTIL.generateKeypair('EC', { curve: 'secp256r1' })
  }

  const { prvKeyObj, pubKeyObj } = keypair

  const publicKey = KEYUTIL.getPEM(pubKeyObj)
  const privateKey = KEYUTIL.getPEM(prvKeyObj, 'PKCS8PRV')

  return { publicKey, privateKey }
}

/**
 * Compute the DSSv1 MD5 hash (hex) for a document + timestamp.
 * The hash is computed over the *payload bytes* (DSSv1 encoding), not just the document.
 * @param {any} document
 * @param {string} timestamp
 * @returns {Promise<string>} hex MD5 hash
 */
export async function hashDocument(document, timestamp) {
  const documentBytes = await documentToBytes(document)
  const payloadBytes = buildTimestampedPayloadBytes(timestamp, documentBytes)
  return md5HexFromBytes(payloadBytes)
}

/**
 * Sign a document with a private key.
 * - Timestamp is generated in UTC+08:00 and embedded into the DSSv1 payload.
 * - Payload is hashed with MD5 (returned as `hash`) for backend/UI compatibility.
 * - Signing strategy:
 *   - For DSA keys: prefer signing the raw MD5 digest; fall back to common DSA algs over payload.
 *   - For EC keys: sign the DSSv1 payload bytes with SHA256withECDSA.
 * @param {{ document: any, privateKey: string }} input
 * @returns {Promise<{signature: string, hash: string, timestamp: string}>}
 */
export async function signDocument(input) {
  const documentBytes = await documentToBytes(input?.document)
  const privateKeyPem = normalizePem(input?.privateKey)
  if (!privateKeyPem) throw new Error('privateKey is required')

  const timestamp = philippinesTimestamp()
  const payloadBytes = buildTimestampedPayloadBytes(timestamp, documentBytes)
  const hash = md5HexFromBytes(payloadBytes)

  ensureDsaImplementationLoaded()
  ensureEcdsaImplementationLoaded()

  let privateKeyObj
  try {
    privateKeyObj = KEYUTIL.getKey(privateKeyPem)
  } catch {
    throw new Error('Invalid private key PEM')
  }

  const keyType = getKeyType(privateKeyObj)

  const SignatureCtor = getSignatureCtor()
  if (typeof SignatureCtor !== 'function') {
    throw new Error('Signing failed')
  }

  const payloadHex = bytesToHex(payloadBytes)

  // DSA path (for existing stored keys):
  // Preferred is a raw DSA signature over MD5(payloadBytes).
  let signatureHex
  if (keyType === 'DSA' || !keyType) {
    try {
      signatureHex = dsaSignRawMessageHashHex(privateKeyObj, hash)
    } catch {
      // Fallback: sign the full payload with a widely-supported DSA signature algorithm.
      const fallbackAlgs = ['SHA1withDSA', 'SHA256withDSA']
      let lastErr

      for (const alg of fallbackAlgs) {
        try {
          const sig = new SignatureCtor({ alg })
          sig.init(privateKeyObj)
          sig.updateHex(payloadHex)
          signatureHex = sig.sign()
          break
        } catch (e) {
          lastErr = e
        }
      }

      // If this key is actually EC (or another type), we will try ECDSA next.
      if (!signatureHex && keyType === 'DSA') {
        const message = typeof lastErr?.message === 'string' ? lastErr.message : ''
        throw new Error(message || 'Signing failed')
      }
    }
  }

  // EC path (for newly generated keys): sign the DSSv1 payload bytes with ECDSA.
  if (!signatureHex) {
    try {
      const sig = new SignatureCtor({ alg: 'SHA256withECDSA' })
      sig.init(privateKeyObj)
      sig.updateHex(payloadHex)
      signatureHex = sig.sign()
    } catch (e) {
      const message = typeof e?.message === 'string' ? e.message : ''
      throw new Error(message || 'Signing failed')
    }
  }

  const signature = hextob64(signatureHex)
  return { signature, hash, timestamp }
}

/**
 * Verify a signature against a document with a public key (DSA or EC).
 * @param {{ document: any, signature: string, publicKey: string, timestamp: string }} input
 * @returns {Promise<{isValid: boolean, hash: string, timestamp: string}>}
 */
export async function verifySignature(input) {
  const documentBytes = await documentToBytes(input?.document)
  const signatureBase64 = String(input?.signature || '').trim()
  const publicKeyPem = normalizePem(input?.publicKey)
  const timestamp = String(input?.timestamp || '').trim()

  if (!signatureBase64) throw new Error('signature is required')
  if (!publicKeyPem) throw new Error('publicKey is required')
  if (!timestamp) throw new Error('timestamp is required')

  const payloadBytes = buildTimestampedPayloadBytes(timestamp, documentBytes)
  const hash = md5HexFromBytes(payloadBytes)

  ensureDsaImplementationLoaded()
  ensureEcdsaImplementationLoaded()

  let publicKeyObj
  try {
    publicKeyObj = KEYUTIL.getKey(publicKeyPem)
  } catch {
    throw new Error('Invalid public key PEM')
  }

  const keyType = getKeyType(publicKeyObj)

  let signatureHex
  try {
    signatureHex = b64tohex(signatureBase64)
  } catch {
    return { isValid: false, hash, timestamp }
  }

  // Strategy 1 (preferred): verify a raw-message-hash DSA signature over MD5(payloadBytes).
  if (keyType === 'DSA' || !keyType) {
    try {
      const isValid = dsaVerifyRawMessageHashHex(publicKeyObj, hash, signatureHex)
      if (isValid) return { isValid: true, hash, timestamp }
    } catch {
      // continue
    }
  }

  // Strategy 2 (compat): some builds support MD5withDSA; try it without failing hard.
  const SignatureCtor = getSignatureCtor()
  const payloadHex = bytesToHex(payloadBytes)

  if (keyType === 'DSA' || !keyType) {
    try {
      if (typeof SignatureCtor === 'function') {
        const sig = new SignatureCtor({ alg: 'MD5withDSA' })
        sig.init(publicKeyObj)
        sig.updateHex(payloadHex)
        if (Boolean(sig.verify(signatureHex))) return { isValid: true, hash, timestamp }
      }
    } catch {
      // continue
    }
  }

  // Strategy 3 (fallback): verify signature over the full payload with common DSA algs.
  try {
    if (typeof SignatureCtor !== 'function') return { isValid: false, hash, timestamp }

    if (keyType === 'DSA' || !keyType) {
      const fallbackAlgs = ['SHA1withDSA', 'SHA256withDSA']
      for (const alg of fallbackAlgs) {
        try {
          const sig = new SignatureCtor({ alg })
          sig.init(publicKeyObj)
          sig.updateHex(payloadHex)
          if (Boolean(sig.verify(signatureHex))) return { isValid: true, hash, timestamp }
        } catch {
          // try next
        }
      }
    }

    // Strategy 4: verify ECDSA signatures over the DSSv1 payload bytes.
    try {
      const sig = new SignatureCtor({ alg: 'SHA256withECDSA' })
      sig.init(publicKeyObj)
      sig.updateHex(payloadHex)
      if (Boolean(sig.verify(signatureHex))) return { isValid: true, hash, timestamp }
    } catch {
      // continue
    }

    return { isValid: false, hash, timestamp }
  } catch {
    // Treat unexpected verifier errors as invalid signatures (matches UI expectation).
    return { isValid: false, hash, timestamp }
  }
}

/**
 * Hash a password using MD5.
 * @param {string} password
 * @returns {string}
 */
export function hashPasswordMD5(password) {
  return md5(String(password ?? ''))
}

/**
 * Local API compatibility layer.
 *
 * This repo previously called a backend via /api/*.
 * Per requirements, the frontend now performs key generation, signing, and verification locally.
 *
 * We keep these exports for backward compatibility with any remaining imports,
 * but there is no network usage here.
 */

import {
  generateKeys as generateKeysLocal,
  signDocument as signDocumentLocal,
  verifySignature as verifySignatureLocal,
} from '../utils/cryptoUtils'

/**
 * Deprecated placeholder client; calling this indicates a stray backend dependency.
 */
export const api = {
  post() {
    throw new Error('Backend API calls are disabled in this build.')
  },
}

/**
 * Extract a beginner-friendly error message from an Axios error.
 * Requirement: prefer err.response.data.error.message when available.
 * @param {unknown} err
 * @returns {string}
 */
export function extractApiErrorMessage(err) {
  const maybeAxiosError = /** @type {any} */ (err)
  const messageFromBackend =
    maybeAxiosError?.response?.data?.error?.message || maybeAxiosError?.response?.data?.message

  const normalizedMessage = typeof messageFromBackend === 'string' ? messageFromBackend.trim() : ''
  const isGenericBackendMessage =
    !normalizedMessage ||
    normalizedMessage === 'Bad Request' ||
    normalizedMessage === 'Internal Server Error'

  // Only use backend details when the chosen backend message is generic/empty.
  if (isGenericBackendMessage) {
    const detailsFromBackend =
      maybeAxiosError?.response?.data?.error?.details ?? maybeAxiosError?.response?.data?.details

    if (detailsFromBackend && typeof detailsFromBackend === 'object') {
      if (Array.isArray(detailsFromBackend.missing) && detailsFromBackend.missing.length > 0) {
        return `Missing: ${detailsFromBackend.missing.join(', ')}`
      }

      if (typeof detailsFromBackend.field === 'string' && typeof detailsFromBackend.issue === 'string') {
        return `${detailsFromBackend.field}: ${detailsFromBackend.issue}`
      }
    }
  }

  if (typeof messageFromBackend === 'string' && messageFromBackend.trim()) {
    return messageFromBackend
  }

  if (typeof maybeAxiosError?.message === 'string' && maybeAxiosError.message.trim()) {
    return maybeAxiosError.message
  }

  return 'Something went wrong. Please try again.'
}

/**
 * POST /api/generate-keys
 * @returns {Promise<{ publicKey: string, privateKey: string }>}
 */
export async function generateKeys() {
  return generateKeysLocal()
}

/**
 * POST /api/sign
 * Supports both legacy JSON (document as string) and multipart upload (document as File).
 * When a File is provided, sends multipart FormData with field name `document`.
 * @param {{ document: any, privateKey: string }} payload
 * @returns {Promise<{ signature: string, hash: string, timestamp: string | number }>}
 */
export async function signDocument(payload) {
  return signDocumentLocal(payload)
}

/**
 * POST /api/verify
 * Supports both legacy JSON (document as string) and multipart upload (document as File).
 * When a File is provided, sends multipart FormData with field name `document`.
 * @param {{ document: any, signature: string, publicKey: string, timestamp: string | number }} payload
 * @returns {Promise<{ isValid: boolean, hash: string, timestamp?: string | number }>}
 */
export async function verifyDocument(payload) {
  const { isValid, hash, timestamp } = await verifySignatureLocal({
    document: payload?.document,
    signature: payload?.signature,
    publicKey: payload?.publicKey,
    timestamp: String(payload?.timestamp ?? ''),
  })

  return { isValid, hash, timestamp }
}

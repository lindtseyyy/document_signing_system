/**
 * Shared Axios API client for calling the backend.
 * All endpoints are under /api/... and are proxied in dev via Vite.
 */

import axios from 'axios'

/**
 * Create a preconfigured Axios instance.
 * Keeping it centralized ensures consistent headers/timeouts and easier debugging.
 */
function createApiClient() {
  return axios.create({
    baseURL: '',
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Singleton Axios client used across the app.
 */
export const api = createApiClient()

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
  const res = await api.post('/api/generate-keys')
  return res.data
}

/**
 * POST /api/sign
 * Supports both legacy JSON (document as string) and multipart upload (document as File).
 * When a File is provided, sends multipart FormData with field name `document`.
 * @param {{ document: any, privateKey: string }} payload
 * @returns {Promise<{ signature: string, hash: string, timestamp: string | number }>}
 */
export async function signDocument(payload) {
  const maybeDocument = payload?.document
  const isFile = typeof File !== 'undefined' && maybeDocument instanceof File

  if (isFile) {
    const form = new FormData()
    form.append('document', maybeDocument)
    form.append('privateKey', payload.privateKey)

    // IMPORTANT: use axios directly (not `api`) and do NOT set Content-Type manually.
    const res = await axios.post('/api/sign', form, { timeout: 30_000 })
    return res.data
  }

  const res = await api.post('/api/sign', payload)
  return res.data
}

/**
 * POST /api/verify
 * Supports both legacy JSON (document as string) and multipart upload (document as File).
 * When a File is provided, sends multipart FormData with field name `document`.
 * @param {{ document: any, signature: string, publicKey: string, timestamp: string | number }} payload
 * @returns {Promise<{ isValid: boolean, hash: string, timestamp?: string | number }>}
 */
export async function verifyDocument(payload) {
  const maybeDocument = payload?.document
  const isFile = typeof File !== 'undefined' && maybeDocument instanceof File

  if (isFile) {
    const form = new FormData()
    form.append('document', maybeDocument)
    form.append('signature', payload.signature)
    form.append('publicKey', payload.publicKey)
    form.append('timestamp', String(payload.timestamp ?? ''))

    // IMPORTANT: use axios directly (not `api`) and do NOT set Content-Type manually.
    const res = await axios.post('/api/verify', form, { timeout: 30_000 })
    const { isValid, hash, timestamp } = res.data || {}
    return { isValid, hash, timestamp }
  }

  const res = await api.post('/api/verify', payload)
  const { isValid, hash, timestamp } = res.data || {}
  return { isValid, hash, timestamp }
}

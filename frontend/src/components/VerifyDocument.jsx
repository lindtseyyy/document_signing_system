/**
 * VerifyDocument card.
 * Sends document + signature + public key to the backend to verify authenticity and integrity.
 */

import { useState } from 'react'
import { extractApiErrorMessage, verifyDocument } from '../lib/api'

const SCENARIO_MESSAGES = {
  valid: '✅ Signature is valid! The document and timestamp are authentic and have not been altered.',
  modifiedDoc:
    'Signature verification failed. This may indicate that either the document content or its associated timestamp has been modified..',
  wrongKey:
    '❌ Invalid signature! Either the signature is incorrect or the public key does not match the signer’s private key.',
  alteredSig:
    '❌ Invalid signature! The signature itself appears to have been altered. Verification failed.',
  missingInfo:
    '⚠️ Missing information! Please make sure the document, signature, public key, and timestamp are all provided.',
}

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024
const DOCUMENT_ACCEPT =
  '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

function validateDocumentFile(file) {
  if (!file) return 'Choose a document file first.'
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) return 'File is too large. Max size is 10 MiB.'

  const name = (file.name || '').toLowerCase()
  const ext = name.includes('.') ? name.split('.').pop() : ''
  const allowedExts = new Set(['pdf', 'docx', 'txt'])
  const allowedTypes = new Set([
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])

  if (allowedExts.has(ext) || allowedTypes.has(file.type)) return ''
  return 'Unsupported file type. Please upload a PDF, DOCX, or TXT.'
}

/**
 * A small status badge for scenario messages.
 * @param {{ statusMessage: string }} props
 */
function VerificationBadge({ statusMessage }) {
  if (!statusMessage) return null

  const classes = statusMessage.startsWith('✅')
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : statusMessage.startsWith('⚠️')
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-red-200 bg-red-50 text-red-800'

  return (
    <div
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${classes}`}
    >
      {statusMessage}
    </div>
  )
}

/**
 * VerifyDocument component.
 * @param {{
 *   documentFile: File | null,
 *   setDocumentFile: (next: File | null) => void,
 *   signature: string,
 *   setSignature: (next: string) => void,
 *   publicKey: string,
 *   setPublicKey: (next: string) => void,
 *   timestamp: string,
 *   setTimestamp: (next: string) => void,
 *   signedHash: string,
 *   signedSignatureSnapshot: string,
 *   signedPublicKeySnapshot: string,
 * }} props
 */
export default function VerifyDocument({
  documentFile,
  setDocumentFile,
  signature,
  setSignature,
  publicKey,
  setPublicKey,

  timestamp,
  setTimestamp,

  signedHash,
  signedSignatureSnapshot,
  signedPublicKeySnapshot,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [, setValid] = useState(/** @type {boolean | null} */ (null))
  const [serverHash, setServerHash] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [documentFileError, setDocumentFileError] = useState('')

  function normalizeHash(value) {
    return String(value || '').trim().toLowerCase()
  }

  function normalizeText(value) {
    return String(value || '').trim()
  }

  /**
   * Map backend error messages to the requested scenarios.
   * @param {string} message
   */
  function mapApiErrorToScenarioMessage(message) {
    if (!message) return ''
    if (message.includes('Missing information')) return SCENARIO_MESSAGES.missingInfo
    if (message.includes('Wrong public key')) return SCENARIO_MESSAGES.wrongKey
    if (message.includes('Invalid signature')) return SCENARIO_MESSAGES.alteredSig
    return ''
  }

  /**
   * Call backend to verify the signature with the provided public key.
   * Critical flow: if the document changes, its hash changes; the signature will no longer match.
   */
  async function handleVerify() {
    setStatusMessage('')
    setValid(null)
    setServerHash('')

    if (documentFileError) {
      setStatusMessage(documentFileError)
      return
    }

    // Guided flow: before calling backend, ensure all required inputs exist.
    const hasDocument = Boolean(documentFile)
    const hasSignature = Boolean(normalizeText(signature))
    const hasPublicKey = Boolean(normalizeText(publicKey))
    const hasTimestamp = Boolean(normalizeText(timestamp))
    if (!hasDocument || !hasSignature || !hasPublicKey || !hasTimestamp) {
      setStatusMessage(SCENARIO_MESSAGES.missingInfo)
      return
    }
    setIsLoading(true)

    try {
      const data = await verifyDocument({ document: documentFile, signature, publicKey, timestamp })

      const isValid = Boolean(data?.isValid)
      const returnedHash = data?.hash || ''
      setValid(isValid)
      setServerHash(returnedHash)

      if (isValid) {
        setStatusMessage(SCENARIO_MESSAGES.valid)
        return
      }

      const signedHashNormalized = normalizeHash(signedHash)
      const returnedHashNormalized = normalizeHash(returnedHash)
      if (signedHashNormalized && returnedHashNormalized && returnedHashNormalized !== signedHashNormalized) {
        setStatusMessage(SCENARIO_MESSAGES.modifiedDoc)
        return
      }

      const signedPublicKeyNormalized = normalizeText(signedPublicKeySnapshot)
      const publicKeyNormalized = normalizeText(publicKey)
      if (signedPublicKeyNormalized && publicKeyNormalized && publicKeyNormalized !== signedPublicKeyNormalized) {
        setStatusMessage(SCENARIO_MESSAGES.wrongKey)
        return
      }

      const signedSignatureNormalized = normalizeText(signedSignatureSnapshot)
      const signatureNormalized = normalizeText(signature)
      if (signedSignatureNormalized && signatureNormalized && signatureNormalized !== signedSignatureNormalized) {
        setStatusMessage(SCENARIO_MESSAGES.alteredSig)
        return
      }

      setStatusMessage(SCENARIO_MESSAGES.wrongKey)
    } catch (err) {
      setValid(null)
      setServerHash('')

      const apiMessage = extractApiErrorMessage(err)
      const mappedScenario = mapApiErrorToScenarioMessage(apiMessage)
      setStatusMessage(mappedScenario || apiMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Verify Document</h2>
      </header>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Document To Verify</label>
          <div>
            <input
              id="verify-document-file"
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null
                setStatusMessage('')
                setValid(null)
                setServerHash('')

                if (!nextFile) {
                  setDocumentFile(null)
                  setDocumentFileError('')
                  return
                }

                const validationMessage = validateDocumentFile(nextFile)
                if (validationMessage) {
                  setDocumentFile(null)
                  setDocumentFileError(validationMessage)
                  return
                }

                setDocumentFile(nextFile)
                setDocumentFileError('')
              }}
            />

            <label
              htmlFor="verify-document-file"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Upload File
            </label>
          </div>

          {documentFileError ? (
            <p className="text-sm text-red-700">{documentFileError}</p>
          ) : (
            <p className="text-sm text-slate-500">
              {documentFile ? `${documentFile.name} (${documentFile.size} bytes)` : ""}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Signature (base64)</label>
          <textarea
            className="w-full min-h-24 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Paste the signature from the Sign step…"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Public Key (PEM)</label>
          <textarea
            className="w-full min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="Paste the public key PEM here…"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Timestamp</label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder="Paste the timestamp returned from the Sign step…"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleVerify}
            disabled={isLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isLoading ? 'Verifying…' : 'Verify'}
          </button>

          <VerificationBadge statusMessage={statusMessage} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">Backend hash (hex)</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-900">
            {serverHash || '—'}
          </p>

          <p className="mt-3 text-xs font-medium text-slate-700">Timestamp (sent)</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-900">
            {normalizeText(timestamp) || '—'}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            If you verify a different file than the one that was signed, the signature check will
            fail because the signature is tied to the original hash.
          </p>
        </div>
      </div>
    </section>
  )
}
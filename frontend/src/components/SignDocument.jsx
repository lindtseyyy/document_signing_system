/**
 * SignDocument card.
 * Sends the document + private key to the backend to produce a signature and a hash.
 */

import { useState } from 'react'
import { extractApiErrorMessage, signDocument } from '../lib/api'
import PasswordModal from './PasswordModal.jsx'
import { loadUserKeys, verifyUserPassword } from '../lib/userKeysStorage'

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024
const DOCUMENT_ACCEPT =
  '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

function validateDocumentFile(file) {
  if (!file) return '⚠️ Missing information! Please make sure the document is provided.'
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
 * SignDocument component.
 * @param {{
 *   documentFile: File | null,
 *   setDocumentFile: (next: File | null) => void,
 *   publicKey: string,
 *   privateKey: string,
 *   setPrivateKey: (next: string) => void,
 *   onSignedSnapshot: (snapshot: { hash: string, signatureSnapshot: string, publicKeySnapshot: string, timestamp: string | number }) => void,
 * }} props
 */
export default function SignDocument({
  documentFile,
  setDocumentFile,
  publicKey,
  privateKey,
  setPrivateKey,
  onSignedSnapshot,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [serverHash, setServerHash] = useState('')
  const [signedSignature, setSignedSignature] = useState('')
  const [signedTimestamp, setSignedTimestamp] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [documentFileError, setDocumentFileError] = useState('')

  // Phase 4.1: Password verification gate
  // Before we allow the signing action to execute, we require the user to authenticate
  // as the owner of the selected/stored keypair. This prevents signing with a private key
  // without confirming the owner's password.
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [passwordModalError, setPasswordModalError] = useState('')
  const [pendingOwner, setPendingOwner] = useState('')

  function normalizePemForMatch(pem) {
    return String(pem || '')
      .trim()
      .replace(/\r\n/g, '\n')
  }

  /**
   * Best-effort owner detection:
   * - Prefer matching private key PEM (signing uses private key).
   * - Fall back to public key match when available.
   */
  function inferSigningOwner() {
    const storedUsers = loadUserKeys()
    const normalizedPrivate = normalizePemForMatch(privateKey)
    const normalizedPublic = normalizePemForMatch(publicKey)

    if (!storedUsers.length) return ''

    const byPrivate = storedUsers.find((u) => normalizePemForMatch(u?.privateKey) === normalizedPrivate)
    if (byPrivate?.owner) return String(byPrivate.owner)

    const byPublic = storedUsers.find((u) => normalizePemForMatch(u?.publicKey) === normalizedPublic)
    if (byPublic?.owner) return String(byPublic.owner)

    return ''
  }

  /**
   * Call backend to sign the document using the private key.
   * Critical flow: backend hashes the document, then signs that hash with the private key.
   */
  async function handleSign() {
    setErrorMessage('')
    if (documentFileError) {
      setErrorMessage(documentFileError)
      return
    }

    const isDocumentMissing = !documentFile
    const isPrivateKeyMissing = !String(privateKey || '').trim()

    if (isDocumentMissing && isPrivateKeyMissing) {
      setErrorMessage(
        '⚠️ Missing information! Please make sure the document, and private key are all provided.'
      )
      return
    }
    if (isDocumentMissing) {
      setErrorMessage('⚠️ Missing information! Please make sure the document is provided.')
      return
    }
    if (isPrivateKeyMissing) {
      setErrorMessage('⚠️ Missing information! Please make sure the private key is provided.')
      return
    }
    setIsLoading(true)

    try {
      const data = await signDocument({ document: documentFile, privateKey })
      const nextSignature = data?.signature || ''
      const nextHash = data?.hash || ''
      const nextTimestamp = data?.timestamp == null ? '' : String(data.timestamp)
      setSignedSignature(nextSignature)
      setServerHash(nextHash)
      setSignedTimestamp(nextTimestamp)

      onSignedSnapshot({
        hash: nextHash,
        signatureSnapshot: nextSignature,
        publicKeySnapshot: publicKey || '',
        timestamp: nextTimestamp,
      })
    } catch (err) {
      setErrorMessage(extractApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Password-gated click handler:
   * - Shows PasswordModal first.
   * - Only after successful password verification do we call the existing signing logic.
   */
  function handleSignClick() {
    setErrorMessage('')
    setPasswordModalError('')

    const owner = inferSigningOwner()
    if (!owner) {
      // Without a determinable owner, we cannot authenticate; block signing.
      setErrorMessage('Authentication required before signing.')
      return
    }

    setPendingOwner(owner)
    setIsPasswordModalOpen(true)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Sign Document</h2>

      </header>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Document</label>
          <div>
            <input
              id="sign-document-file"
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null
                setErrorMessage('')
                setServerHash('')
                setSignedSignature('')
                setSignedTimestamp('')

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
              htmlFor="sign-document-file"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Upload File
            </label>
          </div>

          {documentFileError ? (
            <VerificationBadge statusMessage={documentFileError} />
          ) : (
            <p className="text-sm text-slate-500">
              {documentFile ? `${documentFile.name} (${documentFile.size} bytes)` : 'Upload a PDF, DOCX, or TXT (max 10 MiB).'}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Private Key (PEM)</label>
          <textarea
            className="w-full min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Paste the private key PEM here…"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSignClick}
            disabled={isLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {isLoading ? 'Signing…' : 'Sign'}
          </button>

          {errorMessage ? (
            <div className="flex-1 min-w-0">
              <VerificationBadge statusMessage={errorMessage} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">
             
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Signature (base64)</label>
            <textarea
              className="w-full min-h-24 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900"
              value={signedSignature || ''}
              readOnly
              placeholder="After signing, the signature appears here (copy it to Verify)…"
              spellCheck={false}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">Backend hash (hex)</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-900">
              {serverHash || '—'}
            </p>

            <p className="mt-3 text-xs font-medium text-slate-700">Timestamp</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-900">
              {signedTimestamp || '—'}
            </p>
          </div>
        </div>
      </div>

      <PasswordModal
        isOpen={isPasswordModalOpen}
        title="Confirm password"
        bodyText={pendingOwner ? `Enter the password for “${pendingOwner}” to sign.` : undefined}
        error={passwordModalError}
        isSubmitting={false}
        onCancel={() => {
          // If the user cancels/closes without successful authentication, signing is blocked.
          setIsPasswordModalOpen(false)
          setPendingOwner('')
          setPasswordModalError('')
          setErrorMessage('Authentication required before signing.')
        }}
        onConfirm={(password) => {
          const ok = verifyUserPassword(pendingOwner, password)
          if (!ok) {
            setPasswordModalError('Incorrect password. Access denied.')
            setErrorMessage('Incorrect password. Access denied.')
            return
          }

          setIsPasswordModalOpen(false)
          setPendingOwner('')
          setPasswordModalError('')

          // Auth succeeded: proceed with the existing signing logic unchanged.
          void handleSign()
        }}
      />
    </section>
  )
}
/**
 * SignDocument card.
 * Sends the document + private key to the backend to produce a signature and a hash.
 */

import { useState } from 'react'
import { extractApiErrorMessage, signDocument } from '../lib/api'

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
 * SignDocument component.
 * @param {{
 *   documentFile: File | null,
 *   setDocumentFile: (next: File | null) => void,
 *   publicKey: string,
 *   privateKey: string,
 *   setPrivateKey: (next: string) => void,
 *   onSignedSnapshot: (snapshot: { hash: string, signatureSnapshot: string, publicKeySnapshot: string }) => void,
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
  const [errorMessage, setErrorMessage] = useState('')
  const [documentFileError, setDocumentFileError] = useState('')

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
    if (!documentFile) {
      setErrorMessage('Choose a document file first.')
      return
    }
    if (!String(privateKey || '').trim()) {
      setErrorMessage('Private key is required.')
      return
    }
    setIsLoading(true)

    try {
      const data = await signDocument({ document: documentFile, privateKey })
      const nextSignature = data?.signature || ''
      const nextHash = data?.hash || ''
      setSignedSignature(nextSignature)
      setServerHash(nextHash)

      onSignedSnapshot({
        hash: nextHash,
        signatureSnapshot: nextSignature,
        publicKeySnapshot: publicKey || '',
      })
    } catch (err) {
      setErrorMessage(extractApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">2) Sign Document</h2>

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
            <p className="text-sm text-red-700">{documentFileError}</p>
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
            onClick={handleSign}
            disabled={isLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isLoading ? 'Signing…' : 'Sign'}
          </button>

          {errorMessage ? (
            <p className="text-sm text-red-700">{errorMessage}</p>
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
          </div>
        </div>
      </div>
    </section>
  )
}
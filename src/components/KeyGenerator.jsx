/**
 * KeyGenerator card.
 * Generates an asymmetric DSA (Digital Signature Algorithm) keypair locally and displays PEM-encoded keys.
 */

import { useState } from 'react'
import { generateKeys, hashPasswordMD5 } from '../utils/cryptoUtils'
import { normalizeOwner, upsertUserKeys } from '../lib/userKeysStorage'

/**
 * Render a labeled read-only textarea used for PEM blocks.
 * @param {{ label: string, value: string }} props
 */
function PemField({ label, value }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea
        className="w-full min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 whitespace-pre-wrap break-normal"
        value={value || ''}
        onFocus={(e) => e.target.select()}
        onClick={(e) => e.target.select()}
        onMouseUp={(e) => e.preventDefault()}
        readOnly
        spellCheck={false}
      />
    </div>
  )
}

/**
 * KeyGenerator component.
 * @param {{
 *   onUserKeysStored?: () => void,
 * }} props
 */
export default function KeyGenerator({ onUserKeysStored }) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [generatedPublicKey, setGeneratedPublicKey] = useState('')
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState('')

  /**
   * Generate a keypair locally.
   * Inline critical flow: these keys are used for signing (private) and verifying (public).
   */
  async function handleGenerateKeys() {
    setErrorMessage('')

    const owner = normalizeOwner(userName)
    if (!owner) {
      setErrorMessage('Please complete all required fields.')
      return
    }

    if (!String(password || '').trim()) {
      setErrorMessage('Please complete all required fields.')
      return
    }

    setIsLoading(true)

    try {
      const data = await generateKeys()
      const nextPublicKey = data?.publicKey || ''
      const nextPrivateKey = data?.privateKey || ''
      setGeneratedPublicKey(nextPublicKey)
      setGeneratedPrivateKey(nextPrivateKey)

      // Per project requirements, we hash the password client-side using MD5.
      // IMPORTANT: never persist/store the raw password; only store this hash.
      const passwordHash = hashPasswordMD5(password)

      try {
        // Persist the user keys (and password hash) to localStorage via the shared storage API.
        upsertUserKeys({ owner, publicKey: nextPublicKey, privateKey: nextPrivateKey, passwordHash })
        onUserKeysStored?.()
      } catch {
        setErrorMessage('Generated keys, but failed to store them locally.')
      }
    } catch (err) {
      const message = typeof err?.message === 'string' ? err.message.trim() : ''
      setErrorMessage(message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Key Generator</h2>

      </header>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="keygen-username" className="text-sm font-medium text-slate-700">
            User Name
          </label>
          <input
            id="keygen-username"
            type="text"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value)
              if (errorMessage) setErrorMessage('')
            }}
            placeholder="Enter a name"
            autoComplete="name"
          />
          
        </div>

        <div className="space-y-2">
          <label htmlFor="keygen-password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="keygen-password"
            type="password"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errorMessage) setErrorMessage('')
            }}
            placeholder="Enter a password"
            autoComplete="new-password"
          />
         
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateKeys}
            disabled={isLoading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {isLoading ? 'Generating…' : 'Generate Keys'}
          </button>

          {errorMessage ? (
            <p className="text-sm text-red-700">{errorMessage}</p>
          ) : (
            <p className="text-sm text-slate-500"></p>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4">
        <PemField label="Public Key (PEM)" value={generatedPublicKey} />
        <PemField label="Private Key (PEM)" value={generatedPrivateKey} />
      </div>
    </section>
  )
}
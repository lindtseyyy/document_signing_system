/**
 * KeyGenerator card.
 * Generates an asymmetric DSA (Digital Signature Algorithm) keypair locally and displays PEM-encoded keys.
 */

import { useState } from 'react'
import { generateKeys, hashPasswordMD5 } from '../utils/cryptoUtils'
import { normalizeOwner, upsertUserKeys } from '../lib/userKeysStorage'
import { useToast } from '../hooks/useToast'

/**
 * Render a labeled read-only textarea used for PEM blocks.
 * @param {{ label: string, value: string, rightAction?: import('react').ReactNode }} props
 */
function PemField({ label, value, rightAction }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
      </div>
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
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [generatedPublicKey, setGeneratedPublicKey] = useState('')
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState('')
  const toast = useToast()

  async function handleCopyPublicKey() {
    const pemRaw = String(generatedPublicKey || '')
    const pemTrimmed = pemRaw.trim()

    if (!pemTrimmed) {
      toast.error('No public key to copy.')
      return
    }

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API not available')
      }

      await navigator.clipboard.writeText(pemRaw)
      toast.success('Public key copied to clipboard.')
    } catch {
      toast.error('Failed to copy public key.')
    }
  }

  async function handleCopyPrivateKey() {
    const pemRaw = String(generatedPrivateKey || '')
    const pemTrimmed = pemRaw.trim()

    if (!pemTrimmed) {
      toast.error('No private key to copy.')
      return
    }

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API not available')
      }

      await navigator.clipboard.writeText(pemRaw)
      toast.success('Private key copied to clipboard.')
    } catch {
      toast.error('Failed to copy private key.')
    }
  }

  /**
   * Generate a keypair locally.
   * Inline critical flow: these keys are used for signing (private) and verifying (public).
   */
  async function handleGenerateKeys() {
    const owner = normalizeOwner(userName)
    if (!owner) {
      toast.error('Please complete all required fields.')
      return
    }

    if (!String(password || '').trim()) {
      toast.error('Please complete all required fields.')
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
        toast.success('Keys generated and stored locally.')
      } catch {
        toast.error('Generated keys, but failed to store them locally.')
      }
    } catch (err) {
      const message = typeof err?.message === 'string' ? err.message.trim() : ''
      toast.error(message || 'Something went wrong. Please try again.')
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
            }}
            placeholder="Enter a name"
            autoComplete="name"
          />
          
        </div>

        <div className="space-y-2">
          <label htmlFor="keygen-password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="keygen-password"
              type={isPasswordVisible ? 'text' : 'password'}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
              }}
              placeholder="Enter a password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            >
              {isPasswordVisible ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.88 5.09A10.9 10.9 0 0112 4.8c5.05 0 9.27 3.36 10.5 7.2a11.6 11.6 0 01-3.24 4.93"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.61 6.6A11.58 11.58 0 001.5 12c1.23 3.84 5.45 7.2 10.5 7.2 1.53 0 2.98-.31 4.28-.86"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M1.5 12c1.23-3.84 5.45-7.2 10.5-7.2s9.27 3.36 10.5 7.2c-1.23 3.84-5.45 7.2-10.5 7.2S2.73 15.84 1.5 12z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
         
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
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4">
        <PemField
          label="Public Key (PEM)"
          value={generatedPublicKey}
          rightAction={
            <button
              type="button"
              onClick={handleCopyPublicKey}
              disabled={!String(generatedPublicKey || '').trim()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Copy
            </button>
          }
        />
        <PemField
          label="Private Key (PEM)"
          value={generatedPrivateKey}
          rightAction={
            <button
              type="button"
              onClick={handleCopyPrivateKey}
              disabled={!String(generatedPrivateKey || '').trim()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Copy
            </button>
          }
        />
      </div>
    </section>
  )
}
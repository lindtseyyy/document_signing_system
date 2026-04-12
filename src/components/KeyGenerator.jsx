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
          <input
            id="keygen-password"
            type="password"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
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
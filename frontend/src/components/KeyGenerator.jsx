/**
 * KeyGenerator card.
 * Calls the backend to generate an asymmetric DSA (Digital Signature Algorithm) keypair and displays PEM-encoded keys.
 */

import { useState } from 'react'
import { extractApiErrorMessage, generateKeys } from '../lib/api'

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
        readOnly
        spellCheck={false}
      />
    </div>
  )
}

/**
 * KeyGenerator component.
 * @param {{
 *   publicKey: string,
 *   privateKey: string,
 *   onKeysGenerated: (keys: { publicKey: string, privateKey: string }) => void
 * }} props
 */
export default function KeyGenerator({ publicKey, privateKey, onKeysGenerated }) {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  /**
   * Call the backend to generate a keypair.
   * Inline critical flow: these keys are used for signing (private) and verifying (public).
   */
  async function handleGenerateKeys() {
    setErrorMessage('')
    setIsLoading(true)

    try {
      const data = await generateKeys()
      const nextPublicKey = data?.publicKey || ''
      const nextPrivateKey = data?.privateKey || ''
      onKeysGenerated({ publicKey: nextPublicKey, privateKey: nextPrivateKey })
    } catch (err) {
      setErrorMessage(extractApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">1) Key Generator</h2>

      </header>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerateKeys}
          disabled={isLoading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isLoading ? 'Generating…' : 'Generate Keys'}
        </button>

        {errorMessage ? (
          <p className="text-sm text-red-700">{errorMessage}</p>
        ) : (
          <p className="text-sm text-slate-500"></p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4">
        <PemField label="Public Key (PEM)" value={publicKey} />
        <PemField label="Private Key (PEM)" value={privateKey} />
      </div>
    </section>
  )
}
/**
 * UserKeyManager
 * Manage multiple per-user DSA keypairs (localStorage-backed).
 */

import { useEffect, useState } from 'react'
import PasswordModal from './PasswordModal'
import { deleteUserKeys, loadUserKeys, normalizeOwner, verifyUserPassword } from '../lib/userKeysStorage'

/**
 * Stored user shape is managed by userKeysStorage.
 * `createdAt` may exist for legacy entries, so keep it optional for display.
 * @typedef {{ owner: string, publicKey: string, privateKey: string, passwordHash?: string, createdAt?: string }} StoredUserKeys
 */

/**
 * @param {{ storageRevision?: number }} props
 */
export default function UserKeyManager({ storageRevision }) {
  const [users, setUsers] = useState(/** @type {StoredUserKeys[]} */ ([]))
  const [toast, setToast] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // --- Private key protection state ---
  // We treat password verification as a *session-only unlock*.
  // Copy is allowed without re-prompting once unlocked in this session.
  // Showing the private key still requires a password prompt each time it is revealed.
  const [unlockedOwners, setUnlockedOwners] = useState(() => new Set())
  const [visibleOwners, setVisibleOwners] = useState(() => new Set())

  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordModalOwner, setPasswordModalOwner] = useState('')
  const [passwordModalIntent, setPasswordModalIntent] = useState(/** @type {'show' | 'copy' | ''} */ (''))
  const [passwordModalError, setPasswordModalError] = useState('')
  const [passwordModalSubmitting, setPasswordModalSubmitting] = useState(false)

  const MASKED_PRIVATE_KEY = '••••••••••'

  /**
   * Select the full PEM so copy includes BEGIN/END lines.
   * @param {import('react').SyntheticEvent<HTMLTextAreaElement>} event
   */
  function selectAllPem(event) {
    const el = event.currentTarget
    el.select()
  }

  useEffect(() => {
    setUsers(loadUserKeys())
  }, [storageRevision])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!errorMessage) return
    const t = window.setTimeout(() => setErrorMessage(''), 2200)
    return () => window.clearTimeout(t)
  }, [errorMessage])

  /**
   * @param {string} owner
   */
  function isUnlocked(owner) {
    const normalized = normalizeOwner(owner)
    return normalized ? unlockedOwners.has(normalized) : false
  }

  /**
   * @param {string} owner
   */
  function isVisible(owner) {
    const normalized = normalizeOwner(owner)
    return normalized ? visibleOwners.has(normalized) : false
  }

  /**
   * Open PasswordModal for an owner.
   * This is used both for revealing the private key and for copying it.
   * @param {string} owner
   * @param {'show' | 'copy'} intent
   */
  function requestPassword(owner, intent) {
    const normalized = normalizeOwner(owner)
    if (!normalized) return

    setPasswordModalOwner(normalized)
    setPasswordModalIntent(intent)
    setPasswordModalError('')
    setPasswordModalSubmitting(false)
    setPasswordModalOpen(true)
  }

  /**
   * Copy using the Clipboard API.
   * @param {string} text
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(String(text || ''))
      setToast('Copied private key to clipboard.')
    } catch {
      setErrorMessage('Failed to copy to clipboard.')
    }
  }

  /**
   * @param {StoredUserKeys} user
   */
  function handleDelete(user) {
    const owner = normalizeOwner(user?.owner)
    if (!owner) return

    const ok = window.confirm ? window.confirm(`Delete keys for “${owner}”?`) : true
    if (!ok) return

    // Secure deletion: remove the entry from localStorage via deleteUserKeys(owner).
    setUsers(deleteUserKeys(owner))
    setUnlockedOwners((prev) => {
      const next = new Set(prev)
      next.delete(owner)
      return next
    })
    setVisibleOwners((prev) => {
      const next = new Set(prev)
      next.delete(owner)
      return next
    })
    setToast(`Deleted “${owner}”.`)
  }

  /**
   * Toggle private key visibility.
   * Password verification is required every time the key is revealed.
   * @param {StoredUserKeys} user
   */
  function handleTogglePrivateKey(user) {
    const owner = normalizeOwner(user?.owner)
    if (!owner) return

    if (isVisible(owner)) {
      setVisibleOwners((prev) => {
        const next = new Set(prev)
        next.delete(owner)
        return next
      })
      return
    }

    // Always prompt before revealing (even if previously unlocked).
    requestPassword(owner, 'show')
  }

  /**
   * Attempt to copy a user's private key.
   * If owner is not unlocked yet, prompt for password before copying.
   * @param {StoredUserKeys} user
   */
  function handleCopyPrivateKey(user) {
    const owner = normalizeOwner(user?.owner)
    if (!owner) return

    if (isUnlocked(owner)) {
      void copyToClipboard(user?.privateKey || '')
      return
    }

    requestPassword(owner, 'copy')
  }

  function closePasswordModalWithCancel() {
    setPasswordModalOpen(false)
    setPasswordModalSubmitting(false)
    setPasswordModalError('')
    setPasswordModalOwner('')
    setPasswordModalIntent('')
    // Required exact error message on cancel / lack of auth.
    setErrorMessage('Password required to access private key.')
  }

  /**
   * Verify password using verifyUserPassword(owner, password).
   * On success, mark owner unlocked (session state) and proceed with the pending action.
   * @param {string} password
   */
  function confirmPassword(password) {
    const owner = normalizeOwner(passwordModalOwner)
    if (!owner) {
      closePasswordModalWithCancel()
      return
    }

    setPasswordModalSubmitting(true)

    const ok = verifyUserPassword(owner, password)
    if (!ok) {
      // Required exact error message on incorrect password.
      setPasswordModalError('Incorrect password. Access denied.')
      setPasswordModalSubmitting(false)
      return
    }

    setUnlockedOwners((prev) => new Set(prev).add(owner))

    const intent = passwordModalIntent
    setPasswordModalOpen(false)
    setPasswordModalSubmitting(false)
    setPasswordModalError('')
    setPasswordModalOwner('')
    setPasswordModalIntent('')

    // Apply the action requested after successful verification.
    if (intent === 'show') {
      setVisibleOwners((prev) => new Set(prev).add(owner))
      return
    }

    if (intent === 'copy') {
      const current = users.find((u) => normalizeOwner(u.owner) === owner)
      void copyToClipboard(current?.privateKey || '')
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">User Key Management</h2>
      </header>

      {toast ? <p className="mt-4 text-sm text-slate-700">{toast}</p> : null}
      {errorMessage ? <p className="mt-2 text-sm text-red-700">{errorMessage}</p> : null}

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Public Key (PEM)
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Private Key (PEM)
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {users.length ? (
              users.map((user) => (
                <tr key={user.owner} className="align-top">
                    <td className="w-40 px-4 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">{user.owner}</p>
                        {user.createdAt ? (
                          <p className="text-xs text-slate-500" title={user.createdAt}>
                            Saved {new Date(user.createdAt).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <textarea
                          className="w-full min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 whitespace-pre-wrap break-normal"
                          value={user.publicKey || ''}
                          readOnly
                          spellCheck={false}
                          title="Public key (safe to share)"
                          onFocus={selectAllPem}
                          onClick={selectAllPem}
                          onMouseUp={(e) => e.preventDefault()}
                        />
                       
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {isVisible(user.owner) ? (
                          <textarea
                            className="w-full min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 whitespace-pre-wrap break-normal"
                            value={user.privateKey || ''}
                            readOnly
                            spellCheck={false}
                            title="Private key (keep secret)"
                            onFocus={selectAllPem}
                            onClick={selectAllPem}
                            onMouseUp={(e) => e.preventDefault()}
                          />
                        ) : (
                          <div
                            className="w-full min-h-28 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
                            title="Private key is hidden"
                          >
                            {MASKED_PRIVATE_KEY}
                          </div>
                        )}
    
                      </div>
                    </td>

                    <td className="w-32 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePrivateKey(user)}
                          className="rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-600"
                          title={isVisible(user.owner) ? 'Hide private key' : 'Show private key (password required)'}
                        >
                          {isVisible(user.owner) ? 'Hide' : 'Show'}
                        </button>

                        <div className="relative inline-flex">
                          <button
                            type="button"
                            disabled={!isUnlocked(user.owner)}
                            onClick={() => handleCopyPrivateKey(user)}
                            className={
                              isUnlocked(user.owner)
                                ? 'rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60'
                                : 'rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed'
                            }
                            title={
                              isUnlocked(user.owner)
                                ? 'Copy private key to clipboard'
                                : 'Password verification required to copy'
                            }
                          >
                            Copy Private Key
                          </button>

                          {!isUnlocked(user.owner) ? (
                            // Button is disabled by default; this overlay captures the click attempt
                            // to trigger password verification, without enabling copy.
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-hidden="true"
                              className="absolute inset-0"
                              onClick={() => handleCopyPrivateKey(user)}
                              title="Password verification required to copy"
                            />
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                          title="Delete this user’s keys from localStorage"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  No stored keys yet. Generate keys in Key Generator, then return here to delete saved entries if needed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PasswordModal
        isOpen={passwordModalOpen}
        title="Verify Password"
        bodyText="Enter your password to access the private key for this user."
        error={passwordModalError}
        isSubmitting={passwordModalSubmitting}
        onCancel={closePasswordModalWithCancel}
        onConfirm={confirmPassword}
      />

    </section>
  )
}

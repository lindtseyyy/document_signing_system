/**
 * UserKeyManager
 * Manage multiple per-user DSA keypairs (localStorage-backed).
 */

import { useEffect, useState } from 'react'
import { deleteUserKeys, loadUserKeys, normalizeOwner } from '../lib/userKeysStorage'

/**
 * @typedef {{ owner: string, publicKey: string, privateKey: string, createdAt: string }} StoredUserKeys
 */

/**
 * @param {{ storageRevision?: number }} props
 */
export default function UserKeyManager({ storageRevision }) {
  const [users, setUsers] = useState(/** @type {StoredUserKeys[]} */ ([]))
  const [toast, setToast] = useState('')

  useEffect(() => {
    setUsers(loadUserKeys())
  }, [storageRevision])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(t)
  }, [toast])

  /**
   * @param {StoredUserKeys} user
   */
  function handleDelete(user) {
    const owner = normalizeOwner(user?.owner)
    if (!owner) return

    const ok = window.confirm ? window.confirm(`Delete keys for “${owner}”?`) : true
    if (!ok) return

    setUsers(deleteUserKeys(owner))
    setToast(`Deleted “${owner}”.`)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">User Key Management</h2>
        <p className="text-sm text-slate-600">
          Keys are stored locally in your browser (localStorage).
        </p>
      </header>

      {toast ? <p className="mt-4 text-sm text-slate-700">{toast}</p> : null}

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
                        <p className="text-xs text-slate-500" title={user.createdAt}>
                          Saved {new Date(user.createdAt).toLocaleString()}
                        </p>
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
                        />
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <textarea
                          className="w-full min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 whitespace-pre-wrap break-normal"
                          value={user.privateKey || ''}
                          readOnly
                          spellCheck={false}
                          title="Private key (keep secret)"
                        />
                        <p className="text-xs text-slate-500">Private keys are sensitive; handle with care.</p>
                      </div>
                    </td>

                    <td className="w-32 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-slate-50"
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

      <p className="mt-3 text-xs text-slate-500" title="Stored under dss.userKeys">
        Tip: This is local-only storage. Clearing site data will remove saved keys.
      </p>
    </section>
  )
}

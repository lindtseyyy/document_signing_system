/**
 * localStorage-backed storage for per-user DSA keypairs.
 *
 * Storage format (v1):
 * { version: 1, users: Array<{ owner: string, publicKey: string, privateKey: string, createdAt: string }> }
 */

const STORAGE_KEY = 'dss.userKeys'
const STORAGE_VERSION = 1

/**
 * @typedef {{ owner: string, publicKey: string, privateKey: string, createdAt: string }} StoredUserKeys
 */

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * @param {unknown} value
 * @returns {value is StoredUserKeys}
 */
function isStoredUserKeys(value) {
  const v = /** @type {any} */ (value)
  return (
    v &&
    typeof v === 'object' &&
    typeof v.owner === 'string' &&
    typeof v.publicKey === 'string' &&
    typeof v.privateKey === 'string' &&
    typeof v.createdAt === 'string'
  )
}

/**
 * @param {StoredUserKeys[]} users
 * @returns {StoredUserKeys[]}
 */
function dedupeAndSortUsers(users) {
  const byOwner = new Map()
  for (const user of users || []) {
    if (!isStoredUserKeys(user)) continue
    const owner = normalizeOwner(user.owner)
    if (!owner) continue
    byOwner.set(owner, { ...user, owner })
  }

  return Array.from(byOwner.values()).sort((a, b) => {
    return a.owner.localeCompare(b.owner)
  })
}

/**
 * @returns {StoredUserKeys[]}
 */
export function loadUserKeys() {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)

    // Support legacy storage where the root was directly an array.
    if (Array.isArray(parsed)) {
      return dedupeAndSortUsers(
        parsed.map((u) => {
          const v = /** @type {any} */ (u)
          return {
            owner: String(v?.owner || ''),
            publicKey: String(v?.publicKey || ''),
            privateKey: String(v?.privateKey || ''),
            createdAt: String(v?.createdAt || new Date().toISOString()),
          }
        })
      )
    }

    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed?.users)) {
      return []
    }

    return dedupeAndSortUsers(parsed.users)
  } catch {
    return []
  }
}

/**
 * @param {StoredUserKeys[]} users
 */
export function saveUserKeys(users) {
  if (!isBrowser()) return

  const nextUsers = dedupeAndSortUsers(users)
  const payload = { version: STORAGE_VERSION, users: nextUsers }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

/**
 * @param {string} owner
 * @returns {string}
 */
export function normalizeOwner(owner) {
  return String(owner || '').trim()
}

/**
 * Add or replace a user's keys.
 * @param {{ owner: string, publicKey: string, privateKey: string }} input
 * @returns {StoredUserKeys[]}
 */
export function upsertUserKeys(input) {
  const owner = normalizeOwner(input?.owner)
  if (!owner) return loadUserKeys()

  const users = loadUserKeys()
  const createdAt = new Date().toISOString()

  const next = users.filter((u) => normalizeOwner(u.owner) !== owner)
  next.push({ owner, publicKey: String(input?.publicKey || ''), privateKey: String(input?.privateKey || ''), createdAt })

  const normalized = dedupeAndSortUsers(next)
  saveUserKeys(normalized)
  return normalized
}

/**
 * Remove a user by owner name.
 * @param {string} owner
 * @returns {StoredUserKeys[]}
 */
export function deleteUserKeys(owner) {
  const normalizedOwner = normalizeOwner(owner)
  const users = loadUserKeys()
  const next = users.filter((u) => normalizeOwner(u.owner) !== normalizedOwner)
  saveUserKeys(next)
  return next
}

/**
 * localStorage-backed storage for per-user DSA keypairs.
 *
 * Storage format (current):
 * Root JSON array of user objects:
 *   [{ owner, publicKey, privateKey, passwordHash }]
 *
 * Backward compatibility:
 * - v1 versioned object: { version: 1, users: [...] }
 * - legacy root array entries that may not include passwordHash
 *
 * Migration behavior:
 * - When reading old formats, we migrate in-memory and rewrite localStorage to the
 *   new root-array format on the next write (and also immediately on load when safe).
 */

import { md5Hex } from './hash'

const STORAGE_KEY = 'dss.userKeys'
const STORAGE_VERSION = 1

/**
 * Current stored user shape.
 * @typedef {{ owner: string, publicKey: string, privateKey: string, passwordHash: string }} StoredUserKeys
 */

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Coerce unknown values into the current stored user format.
 *
 * This accepts legacy shapes (e.g., entries with `createdAt` and no `passwordHash`).
 * Any missing `passwordHash` is migrated to an empty string.
 *
 * @param {unknown} value
 * @returns {StoredUserKeys | null}
 */
function coerceStoredUserKeys(value) {
  const v = /** @type {any} */ (value)
  const owner = normalizeOwner(v?.owner)
  if (!owner) return null

  return {
    owner,
    publicKey: String(v?.publicKey || ''),
    privateKey: String(v?.privateKey || ''),
    passwordHash: typeof v?.passwordHash === 'string' ? v.passwordHash : '',
  }
}

/**
 * @param {StoredUserKeys[]} users
 * @returns {StoredUserKeys[]}
 */
function dedupeAndSortUsers(users) {
  const byOwner = new Map()
  for (const user of users || []) {
    const coerced = coerceStoredUserKeys(user)
    if (!coerced) continue
    byOwner.set(coerced.owner, coerced)
  }

  return Array.from(byOwner.values()).sort((a, b) => {
    return a.owner.localeCompare(b.owner)
  })
}

/**
 * Persist users in the new root-array format.
 * @param {StoredUserKeys[]} users
 */
function writeUsersArray(users) {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupeAndSortUsers(users)))
}

/**
 * Read localStorage and return users in the new format.
 * If old format is detected, the returned users are migrated and localStorage is rewritten.
 *
 * @returns {{ users: StoredUserKeys[], migrated: boolean }}
 */
function readAndMaybeMigrateUsers() {
  if (!isBrowser()) return { users: [], migrated: false }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { users: [], migrated: false }

    const parsed = JSON.parse(raw)

    // Current (and legacy) format: root array.
    if (Array.isArray(parsed)) {
      const users = dedupeAndSortUsers(parsed)
      const migrated = parsed.some((u) => typeof /** @type {any} */ (u)?.passwordHash !== 'string')
      if (migrated) writeUsersArray(users)
      return { users, migrated }
    }

    // Backward compatible v1 versioned object.
    if (parsed?.version === STORAGE_VERSION && Array.isArray(parsed?.users)) {
      const users = dedupeAndSortUsers(parsed.users)
      writeUsersArray(users)
      return { users, migrated: true }
    }

    return { users: [], migrated: false }
  } catch {
    return { users: [], migrated: false }
  }
}

/**
 * @returns {StoredUserKeys[]}
 */
export function loadUserKeys() {
  return readAndMaybeMigrateUsers().users
}

/**
 * @param {StoredUserKeys[]} users
 */
export function saveUserKeys(users) {
  if (!isBrowser()) return

  // Always write the new root-array format.
  writeUsersArray(dedupeAndSortUsers(users))
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
 *
 * IMPORTANT: Never store raw passwords. Pass in `passwordHash` (MD5 hex) instead.
 * If `passwordHash` is omitted and the user already exists, the existing hash is kept.
 *
 * @param {{ owner: string, publicKey: string, privateKey: string, passwordHash?: string }} input
 * @returns {StoredUserKeys[]}
 */
export function upsertUserKeys(input) {
  const owner = normalizeOwner(input?.owner)
  if (!owner) return loadUserKeys()

  const users = loadUserKeys()

  const existing = users.find((u) => normalizeOwner(u.owner) === owner) || null
  const nextPasswordHash =
    typeof input?.passwordHash === 'string' ? input.passwordHash : String(existing?.passwordHash || '')

  const next = users.filter((u) => normalizeOwner(u.owner) !== owner)
  next.push({
    owner,
    publicKey: String(input?.publicKey || ''),
    privateKey: String(input?.privateKey || ''),
    passwordHash: nextPasswordHash,
  })

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

/**
 * Verify a user's password against the stored MD5 hash.
 *
 * Password verification logic:
 * - Compute `md5Hex(password)` and compare to stored `passwordHash`.
 * - We never store or return raw passwords.
 *
 * @param {string} owner
 * @param {string} password
 * @returns {boolean}
 */
export function verifyUserPassword(owner, password) {
  const normalizedOwner = normalizeOwner(owner)
  if (!normalizedOwner) return false

  const users = loadUserKeys()
  const user = users.find((u) => normalizeOwner(u.owner) === normalizedOwner)
  if (!user?.passwordHash) return false

  const candidateHash = md5Hex(String(password ?? ''))
  return candidateHash === user.passwordHash
}

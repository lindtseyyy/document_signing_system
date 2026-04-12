/**
 * Clipboard helper.
 * Uses the modern Clipboard API when available, with a best-effort fallback.
 */

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
  const value = String(text || '')
  if (!value) return

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === 'undefined') return

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.left = '-9999px'

  document.body.appendChild(textarea)
  textarea.select()

  try {
    const ok = document.execCommand && document.execCommand('copy')
    if (!ok) {
      throw new Error('Copy command was rejected')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}

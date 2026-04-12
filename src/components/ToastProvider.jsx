import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * @typedef {'success' | 'error' | 'warning' | 'info'} ToastType
 */

/**
 * @typedef {{
 *  id: string,
 *  type: ToastType,
 *  message: string,
 *  title?: string,
 *  durationMs: number,
 * }} Toast
 */

/**
 * @typedef {{
 *  toast: (input: { type?: ToastType, message: string, title?: string, durationMs?: number }) => string,
 *  dismiss: (id: string) => void,
 *  success: (message: string, opts?: { title?: string, durationMs?: number }) => string,
 *  error: (message: string, opts?: { title?: string, durationMs?: number }) => string,
 *  warning: (message: string, opts?: { title?: string, durationMs?: number }) => string,
 *  info: (message: string, opts?: { title?: string, durationMs?: number }) => string,
 * }} ToastApi
 */

export const ToastContext = createContext(/** @type {ToastApi | null} */ (null))

function getToastStyles(type) {
  switch (type) {
    case 'success':
      return {
        border: 'border-emerald-200',
        stripe: 'bg-emerald-500',
        title: 'text-emerald-900',
      }
    case 'warning':
      return {
        border: 'border-amber-200',
        stripe: 'bg-amber-500',
        title: 'text-amber-900',
      }
    case 'error':
      return {
        border: 'border-red-200',
        stripe: 'bg-red-500',
        title: 'text-red-900',
      }
    default:
      return {
        border: 'border-slate-200',
        stripe: 'bg-slate-500',
        title: 'text-slate-900',
      }
  }
}

function createId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/**
 * ToastProvider (context + viewport).
 * @param {{ children: import('react').ReactNode }} props
 */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(/** @type {Toast[]} */ ([]))
  const timeoutsById = useRef(new Map())

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutsById.current.values()) {
        window.clearTimeout(timeoutId)
      }
      timeoutsById.current.clear()
    }
  }, [])

  const dismiss = useCallback((id) => {
    const timeoutId = timeoutsById.current.get(id)
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutsById.current.delete(id)
    }

    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    ({ type = 'info', message, title, durationMs = 2800 }) => {
      const id = createId()
      const next = /** @type {Toast} */ ({
        id,
        type,
        message: String(message || ''),
        title: title ? String(title) : undefined,
        durationMs: Math.max(800, Number(durationMs) || 0),
      })

      setToasts((prev) => {
        const capped = prev.length >= 5 ? prev.slice(prev.length - 4) : prev
        return [...capped, next]
      })

      const timeoutId = window.setTimeout(() => dismiss(id), next.durationMs)
      timeoutsById.current.set(id, timeoutId)

      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      toast,
      dismiss,
      success: (message, opts) => toast({ type: 'success', message, ...opts }),
      error: (message, opts) => toast({ type: 'error', message, ...opts }),
      warning: (message, opts) => toast({ type: 'warning', message, ...opts }),
      info: (message, opts) => toast({ type: 'info', message, ...opts }),
    }),
    [dismiss, toast],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] space-y-2"
      >
        {toasts.map((t) => {
          const styles = getToastStyles(t.type)
          return (
            <div
              key={t.id}
              role="status"
              className={`relative overflow-hidden rounded-lg border bg-white shadow-sm ${styles.border}`}
            >
              <div className={`absolute left-0 top-0 h-full w-1.5 ${styles.stripe}`} />

              <div className="flex gap-3 px-4 py-3 pl-5">
                <div className="min-w-0 flex-1">
                  {t.title ? (
                    <p className={`text-sm font-semibold ${styles.title}`}>{t.title}</p>
                  ) : null}
                  <p className="text-sm text-slate-700 break-words">{t.message}</p>
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-md px-2 text-slate-400 hover:text-slate-600"
                  aria-label="Dismiss notification"
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

import React, { useEffect, useState } from "react";

/**
 * PasswordModal
 *
 * Props:
 * - isOpen: boolean
 * - title: string
 * - bodyText?: string
 * - error?: string
 * - isSubmitting?: boolean
 * - onCancel: () => void
 * - onConfirm: (password: string) => void
 */
export default function PasswordModal({
  isOpen,
  title,
  bodyText,
  error,
  isSubmitting = false,
  onCancel,
  onConfirm,
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isOpen) setPassword("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(password);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {bodyText ? (
            <p className="mt-1 text-sm text-gray-600">{bodyText}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
            placeholder="Enter password"
            disabled={isSubmitting}
          />

          <div className="min-h-[1.25rem]">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-60"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            disabled={isSubmitting}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

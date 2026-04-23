import React, { useEffect, useState } from "react";
import { useToast } from "../hooks/useToast";

/**
 * PasswordModal
 *
 * Props:
 * - isOpen: boolean
 * - title: string
 * - bodyText?: string
 * - isSubmitting?: boolean
 * - onCancel: () => void
 * - onConfirm: (password: string) => void
 */
export default function PasswordModal({
  isOpen,
  title,
  bodyText,
  isSubmitting = false,
  onCancel,
  onConfirm,
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmedPassword = String(password || "").trim();
    if (!trimmedPassword) {
      toast.error("Password is required");
      return;
    }

    onConfirm(trimmedPassword);
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
          <label
            htmlFor="password-modal-input"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password-modal-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="Enter password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isSubmitting}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A9.77 9.77 0 0112 5c5 0 9 4 9 7a10.3 10.3 0 01-2.2 3.3M6.1 6.1C3.56 7.79 2 9.78 2 12c0 3 4 7 10 7a9.77 9.77 0 003.61-.67"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
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

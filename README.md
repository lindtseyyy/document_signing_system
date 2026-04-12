# Document Signing System (Frontend-only)

End-to-end demo of generating a DSA key pair, signing an uploaded document, and verifying that signature.

This repository is **frontend-only**: all cryptographic operations run locally in the browser. No backend server or API endpoints are required.

## How It Works

### Modules (design overview)

1. **User Key Management**
   - Keys are shown to the user as PEM strings.
   - The app does not persist keys to a server; users copy/paste keys as needed.

2. **Key Generation**
   - The frontend generates a DSA key pair on demand and displays PEM-encoded public/private keys.

3. **Document Signing**
   - The frontend generates a timestamp in **Philippines time (UTC+08:00)** and builds a deterministic payload from `{timestamp, documentBytes}`.
   - It computes an MD5 digest of that payload and signs the digest using the provided DSA private key.
   - Output includes the `signature`, the `hash` (MD5 hex of the signed payload), and the `timestamp`.

4. **Document Verification**
   - The verifier provides the same `timestamp` that was used during signing.
   - The frontend rebuilds the exact same `{timestamp, documentBytes}` payload, recomputes the MD5 digest, and verifies the DSA signature.
   - Output includes `isValid`, plus the recomputed `hash` and `timestamp`.

### Replay-prevention rationale

The timestamp is included in the bytes that are hashed and signed, so a signature is bound to a specific signing time as well as the document contents. Verification requires the timestamp.

## Technology Stack

- React + Vite
- Tailwind CSS

Scripts:
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

## Setup & Run Locally

### Prerequisites

- Node.js (recent LTS)
- npm

### Start the frontend (Vite dev server)

```bash
cd frontend
npm install
npm run dev
```

Open the Vite dev URL printed in the terminal (typically `http://localhost:5173`).

### Optional: build and preview

```bash
cd frontend
npm run build
npm run preview
```

## Usage (UI)

Open the frontend in your browser (typically `http://localhost:5173`) and follow the 3-step flow:

1. **Generate Keys**
   - Click **Generate Keys**.
   - Copy the **Private Key (PEM)** exactly as shown (including the `BEGIN/END` lines). You will paste this into the next step.
   - Copy the **Public Key (PEM)** (you will paste this in the Verify step).

2. **Sign Document**
   - Upload the document you want to sign.
   - Paste the **Private Key (PEM)** from step 1.
   - Click **Sign**.
   - Copy the returned **Signature (base64)** (you will paste this in the Verify step).
   - Copy the returned **Timestamp (RFC3339 / ISO)** (you will paste this in the Verify step).
   - (Optional) Note the returned **Hash (MD5 hex)**; it should match the hash shown during verification for the same file + timestamp.

3. **Verify Document**
   - Upload the **same document file** you signed.
   - Paste the **Signature (base64)** from step 2.
   - Paste the **Timestamp (RFC3339 / ISO, `+08:00`)** from step 2.
   - Paste the **Public Key (PEM)** from step 1.
   - Click **Verify** and confirm `isValid` is `true`.

Tip: If you change the file contents (even slightly) and verify again with the same signature, `isValid` should become `false`.

## Testing

```bash
cd frontend
npm run lint
npm run build
```

## Troubleshooting

- **Wrong public key**: make sure you’re using a **DSA** public key (PEM), not RSA/ECDSA.
- **Verification fails unexpectedly**: verify the *exact same file bytes* that were signed, and ensure the public key matches the private key used for signing.

# Document Signing System

End-to-end demo of generating a DSA key pair, signing an uploaded document, and verifying that signature. The frontend provides a simple 3-step flow, and the backend exposes a small REST API.

## How It Works (Frontend Flow + Backend API)

### Frontend flow
The UI (React) is organized into three sections:

1. **Generate Keys**
	 - Calls `POST /api/generate-keys`.
	 - Displays the returned **PEM-encoded** DSA public/private keys.

2. **Sign Document**
	 - User uploads a document (PDF/DOCX/TXT, max **10 MiB**) and pastes the private key (PEM).
	 - Calls `POST /api/sign` as `multipart/form-data` with:
		 - `document` (file)
		 - `privateKey` (text)
	 - Receives:
		 - `signature` (base64)
		 - `hash` (SHA-256 hex of the document bytes)

3. **Verify Document**
	 - User uploads a document, pastes the signature (base64) and the public key (PEM).
	 - Calls `POST /api/verify` as `multipart/form-data` with:
		 - `document` (file)
		 - `signature` (text)
		 - `publicKey` (text)
	 - Receives:
		 - `isValid` (`true`/`false`)
		 - `hash` (SHA-256 hex of the document bytes)

In development, the frontend calls `/api/...` and Vite proxies it to the backend at `http://localhost:3001`.

### Backend API behavior
The backend (Express) exposes three endpoints under `/api`:

- `POST /api/generate-keys`: generates a new DSA key pair.
- `POST /api/sign`: hashes + signs the provided document using the provided private key.
- `POST /api/verify`: verifies a signature against the provided document using the provided public key.

Uploads are held **in-memory** via `multer.memoryStorage()` and limited to **10 MiB**.

## Technology Stack

### Frontend
- React + Vite
- Tailwind CSS
- Axios

Scripts:
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

### Backend
- Node.js
- Express
- `cors`
- `multer`

Script:
- `npm start` (defaults to port **3001**)

## Algorithms & Data Formats Implemented

### DSA key generation
- Keypair generated using Node’s `crypto.generateKeyPair('dsa')` with:
	- `modulusLength: 2048`
	- `divisorLength: 224`
- Encodings:
	- Public key: PEM, **SPKI** (`type: 'spki', format: 'pem'`)
	- Private key: PEM, **PKCS#8** (`type: 'pkcs8', format: 'pem'`)

### Hashing (SHA-256)
- The backend computes the SHA-256 digest of the **exact document bytes** and returns it as a **hex string**.

### Signing / verifying
- Signing: Node `crypto.sign('sha256', documentBytes, privateKey)`
- Verifying: Node `crypto.verify('sha256', documentBytes, publicKey, signatureBytes)`

### Encodings / validation
- Document:
	- In multipart mode: raw bytes from the uploaded file.
	- In JSON mode: treated as UTF-8 text and converted to bytes.
- Hash: hex string.
- Signature: base64 string (strict-ish base64 validation on verify).
- Keys: PEM strings. Public key is validated to be a DSA public key.

## Setup & Run Locally

### Prerequisites
- Node.js (any recent LTS should work)
- npm

### 1) Start the backend (port 3001)
```bash
cd backend
npm install
npm start
```

The backend listens on `http://localhost:3001` by default.

### 2) Start the frontend (Vite dev server)
In another terminal:
```bash
cd frontend
npm install
npm run dev
```

Open the Vite dev URL printed in the terminal (typically `http://localhost:5173`).

Dev proxy behavior:
- The frontend makes requests to `/api/...`
- Vite proxies `/api` to `http://localhost:3001`

### Optional: build and preview the frontend
```bash
cd frontend
npm run build
npm run preview
```

## Usage (UI)

After starting both servers, open the frontend in your browser (typically `http://localhost:5173`) and follow the 3-step flow:

1. **Generate Keys**
	 - Click **Generate Keys**.
	 - Copy the **Private Key (PEM)** exactly as shown (including the `BEGIN/END` lines). You will paste this into the next step.
	 - Copy the **Public Key (PEM)** (you will paste this in the Verify step).

2. **Sign Document**
	 - Upload the document you want to sign.
	 - Paste the **Private Key (PEM)** from step 1.
	 - Click **Sign**.
	 - Copy the returned **Signature (base64)** (you will paste this in the Verify step).
	 - (Optional) Note the returned **Hash (SHA-256 hex)**; it should match the hash shown during verification for the same file.

3. **Verify Document**
	 - Upload the **same document file** you signed.
	 - Paste the **Signature (base64)** from step 2.
	 - Paste the **Public Key (PEM)** from step 1.
	 - Click **Verify** and confirm `isValid` is `true`.

Tip: If you change the file contents (even slightly) and verify again with the same signature, `isValid` should become `false`.

## API Reference

Base URL (local): `http://localhost:3001`

### POST /api/generate-keys
Generates a new DSA keypair.

Request:
- No body

Response (`200`):
```json
{
	"publicKey": "-----BEGIN PUBLIC KEY-----\n...",
	"privateKey": "-----BEGIN PRIVATE KEY-----\n..."
}
```

### POST /api/sign
Signs a document with a DSA private key.

Request (recommended): `multipart/form-data`
- `document`: file (field name must be `document`)
- `privateKey`: text (PEM)

Request (also supported): JSON
```json
{ "document": "string", "privateKey": "PEM string" }
```

Response (`200`):
```json
{ "signature": "base64...", "hash": "sha256-hex..." }
```

### POST /api/verify
Verifies a document signature with a DSA public key.

Request (recommended): `multipart/form-data`
- `document`: file (field name must be `document`)
- `signature`: text (base64)
- `publicKey`: text (PEM)

Request (also supported): JSON
```json
{ "document": "string", "signature": "base64...", "publicKey": "PEM string" }
```

Response (`200`):
```json
{ "isValid": true, "hash": "sha256-hex..." }
```

### Error shape
Most errors are returned as:
```json
{
	"error": {
		"message": "...",
		"details": { "...": "..." }
	}
}
```

Notable cases:
- Upload too large returns HTTP `413` with details including `limitBytes`.

## Curl Examples

### Generate keys (JSON response)
```bash
curl -sS -X POST http://localhost:3001/api/generate-keys
```

### Sign (multipart/form-data)
Prereq: save your private key to `private.pem` and choose a file (example: `./document.txt`).

**macOS/Linux (bash/zsh):**
```bash
curl -sS -X POST http://localhost:3001/api/sign \
	-F "document=@./document.txt" \
	-F "privateKey=$(cat ./private.pem)"
```

**Windows PowerShell:**
```powershell
curl.exe -sS -X POST http://localhost:3001/api/sign ^
	-F "document=@./document.txt" ^
	-F "privateKey=$([System.IO.File]::ReadAllText('private.pem'))"
```

### Verify (multipart/form-data)
Prereq: save your public key to `public.pem`, and have a base64 signature string.

**macOS/Linux (bash/zsh):**
```bash
curl -sS -X POST http://localhost:3001/api/verify \
	-F "document=@./document.txt" \
	-F "signature=PASTE_BASE64_SIGNATURE_HERE" \
	-F "publicKey=$(cat ./public.pem)"
```

**Windows PowerShell:**
```powershell
curl.exe -sS -X POST http://localhost:3001/api/verify ^
	-F "document=@./document.txt" ^
	-F "signature=PASTE_BASE64_SIGNATURE_HERE" ^
	-F "publicKey=$([System.IO.File]::ReadAllText('public.pem'))"
```

## Testing

### Frontend
```bash
cd frontend
npm run lint
npm run build
```

### Backend
There are no automated tests in this repo for the backend (no `npm test` script).

### Manual API smoke test
1. Start backend (`cd backend && npm start`).
2. Generate keys:
	 - `curl -X POST http://localhost:3001/api/generate-keys`
3. Save the returned keys into `public.pem` and `private.pem`.
4. Sign a small file with the `/api/sign` curl example.
5. Verify the same file + signature with the `/api/verify` curl example.
6. Modify the file and verify again; `isValid` should become `false`.

## Troubleshooting

- **Frontend calls fail / 404 on `/api/...`**: make sure the backend is running on port `3001`. In dev, Vite proxies `/api` to `http://localhost:3001`.
- **`Wrong public key`**: the backend requires a **DSA public key** (PEM). RSA/ECDSA keys (or malformed PEM) will be rejected.
- **`Invalid signature` / base64 errors**: the verify endpoint validates the signature string as base64; ensure it wasn’t truncated and contains no extra whitespace.
- **`Payload Too Large`**: uploaded documents are limited to **10 MiB**.
- **Verification fails unexpectedly**: ensure you are verifying the *exact same file bytes* that were signed, and that the public key matches the private key used for signing.

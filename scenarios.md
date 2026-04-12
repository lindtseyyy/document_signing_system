
## Scenarios & Expected Responses

This section enumerates common and security-relevant scenarios for this app.

Notes:
- Verification is performed over a deterministic payload built from the exact **timestamp string** + exact **document bytes**. If either differs, verification fails.
- A cryptographic mismatch (wrong file / wrong timestamp / wrong key / altered signature) generally returns `200` with `isValid: false`.
- Input validation and key parsing failures return `4xx` with the error shape shown above.
- When `ENFORCE_TIMESTAMP_FRESHNESS==='true'`, freshness checks run during **verify** only.
- Freshness config parsing: `MAX_SIGNATURE_AGE_MS` and `MAX_FUTURE_SKEW_MS` are parsed as numbers; malformed/negative values fall back to defaults (5 min / 2 min).
- Crypto runtime variability: if the current Node/OpenSSL build disallows DSA+MD5, signing/verifying may fail with a `400` and a `cause` in `error.details`.

### Happy path scenarios

**S01 — Generate keys (success)**
- Conditions: `POST /api/generate-keys`.
- Expected response: `200` with `{ publicKey, privateKey }`.
- Explanation: Generates a new DSA key pair in PEM format (no persistence).

**S02 — Sign (multipart, success)**
- Conditions: `POST /api/sign` with `multipart/form-data`: `document` (file) + `privateKey` (DSA PEM).
- Expected response: `200` with `{ signature, hash, timestamp }`.
- Explanation: Backend emits a Philippines-time timestamp, hashes a deterministic payload, and signs it.

**S03 — Sign (JSON, success)**
- Conditions: `POST /api/sign` with JSON `{ document: "...", privateKey: "..." }`.
- Expected response: `200` with `{ signature, hash, timestamp }`.
- Explanation: `document` is treated as UTF-8 text and converted to bytes before signing.

**S04 — Verify (multipart, success)**
- Conditions: `POST /api/verify` with the same file bytes, plus the exact `signature`, `publicKey`, and `timestamp` from signing.
- Expected response: `200` with `{ isValid: true, hash, timestamp }`.
- Explanation: Rebuilds the identical payload and verifies the DSA signature.

**S05 — Verify (JSON, success)**
- Conditions: `POST /api/verify` with JSON `{ document: "...", signature, publicKey, timestamp }` and the same `document` string used when signing via JSON.
- Expected response: `200` with `{ isValid: true, hash, timestamp }`.
- Explanation: Works when both signing and verification use the same text-to-bytes conversion.

### Input validation errors

**S06 — Sign missing document**
- Conditions: `POST /api/sign` with no `document` (or empty string / empty file).
- Expected response: `400` with `{ error: { message: "⚠️ Missing information! Please make sure the document and private key are both provided.", details: { missing: ["document"] } } }`.
- Explanation: The service requires a non-empty document.

**S07 — Sign missing private key**
- Conditions: `POST /api/sign` with no `privateKey` (or whitespace-only).
- Expected response: `400` with `{ error: { message: "⚠️ Missing information! Please make sure the document and private key are both provided.", details: { missing: ["privateKey"] } } }`.
- Explanation: Signing requires a DSA private key.

**S08 — Verify missing one or more required fields**
- Conditions: `POST /api/verify` missing any of `document`, `signature`, `publicKey`, `timestamp`.
- Expected response: `400` with `{ error: { message: "⚠️ Missing information! Please make sure the document, signature, public key, and timestamp are all provided.", details: { missing: ["..."] } } }`.
- Explanation: Verification needs all four inputs.

**S09 — Verify signature has leading/trailing whitespace**
- Conditions: `signature` contains spaces/newlines (even if base64 characters otherwise look right).
- Expected response: `400` with `{ error: { message: "❌ Invalid signature! The signature itself appears to have been altered. Verification failed.", details: { field: "signature", issue: "must be valid base64" } } }`.
- Explanation: The base64 validator is strict and rejects whitespace.

**S10 — Verify signature is not valid base64**
- Conditions: `signature` has invalid characters, wrong padding, URL-safe base64 (`-`/`_`), etc.
- Expected response: `400` with `{ error: { message: "❌ Invalid signature! The signature itself appears to have been altered. Verification failed.", details: { field: "signature", issue: "must be valid base64" } } }`.
- Explanation: Prevents attempting verification on obviously corrupted signature strings.

**S11 — Verify timestamp is not parseable**
- Conditions: `timestamp` is a non-empty string but `new Date(timestamp)` is invalid.
- Expected response: `400` with `{ error: { message, details: { field: "timestamp", issue: "must be a parseable date string" } } }`.
- Explanation: Timestamp must be a valid date string to support optional freshness checks.

**S12 — JSON document is not a string**
- Conditions: JSON `document` is a number/object/array.
- Expected response: `400` with `{ error: { message, details: { field: "document", issue: "must be a string or a file" } } }`.
- Explanation: In JSON mode, only UTF-8 strings are accepted.

**S13 — Multipart uses the wrong file field name**
- Conditions: Uploads a file under `file` (or any name other than `document`).
- Expected response: `400` with `{ error: { message, details: { missing: ["document"] } } }`.
- Explanation: Multer only reads the `document` field.

### Key errors (sign)

**S14 — Private key field contains a public key**
- Conditions: `privateKey` PEM contains `BEGIN PUBLIC KEY`.
- Expected response: `400` with `{ error: { message, details: { field: "privateKey" } } }`.
- Explanation: Helps catch copy/paste mistakes early.

**S15 — Private key has literal escaped newlines (\\n)**
- Conditions: `privateKey` contains `\\n` sequences instead of real line breaks.
- Expected response: `400` with `{ error: { message, details: { field: "privateKey" } } }`.
- Explanation: PEM must include real newlines to parse reliably.

**S16 — Private key PEM is incomplete**
- Conditions: Missing the full `-----BEGIN ...-----` / `-----END ...-----` block.
- Expected response: `400` with `{ error: { message, details: { field: "privateKey" } } }`.
- Explanation: The parser rejects partial PEM blocks.

**S17 — Private key is the wrong algorithm (RSA/ECDSA/etc.)**
- Conditions: `privateKey` is valid PEM but not DSA.
- Expected response: `400` with `{ error: { message, details: { field: "privateKey", foundType } } }`.
- Explanation: The service enforces DSA keys only.

**S18 — Private key is encrypted / passphrase-protected**
- Conditions: `privateKey` is an encrypted PEM.
- Expected response: `400` with `{ error: { message, details: { field: "privateKey", issue: "must be an unencrypted DSA PEM private key (no passphrase)" } } }`.
- Explanation: The API does not accept passphrases.

### Key errors (verify)

**S19 — Public key missing or malformed PEM**
- Conditions: `publicKey` is empty or not valid PEM.
- Expected response: `400` with `{ error: { message: "Wrong public key", details: { field: "publicKey" } } }`.
- Explanation: The verifier requires a parseable PEM key.

**S20 — Public key is the wrong algorithm (RSA/ECDSA/etc.)**
- Conditions: `publicKey` parses but is not a DSA public key.
- Expected response: `400` with `{ error: { message: "Wrong public key", details: { field: "publicKey", issue: "must be a valid DSA public key" } } }`.
- Explanation: Prevents verifying with unsupported key types.

**S21 — Public key is a different (but valid) DSA key than the signer used**
- Conditions: `publicKey` is a valid DSA public key, but not the one that matches the signing private key.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Inputs are valid; the signature just doesn’t match this key.

### Tampering & mismatch cases

**S22 — Document bytes were modified after signing**
- Conditions: Same `signature`/`timestamp`/`publicKey`, but the uploaded document differs by even 1 byte.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: The document bytes are part of the signed payload.

**S23 — Signature string was altered but still valid base64**
- Conditions: `signature` is base64, but characters were changed/truncated in a base64-valid way.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Signature verification fails, but inputs remain well-formed.

**S24 — Signature string was altered into invalid base64**
- Conditions: `signature` contains invalid base64 characters/padding.
- Expected response: `400` with `{ error: { message: "❌ Invalid signature! The signature itself appears to have been altered. Verification failed.", details: { field: "signature", issue: "must be valid base64" } } }`.
- Explanation: Rejected as malformed before crypto verification.

**S25 — Timestamp differs from the one returned by signing**
- Conditions: Uses a different timestamp string (even if it represents the “same moment” in another format).
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: The timestamp string itself is included in the signed bytes; it must match exactly.

**S26 — Timestamp is parseable but includes extra whitespace**
- Conditions: `timestamp` has leading/trailing spaces; still parseable as a Date.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Whitespace changes the payload bytes even if parsing succeeds.

**S27 — Mixing JSON-sign and multipart-verify (or vice versa) for the “same content”**
- Conditions: Signs via JSON string, then verifies using a file whose bytes are not identical to the UTF-8 bytes of that JSON string.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Verification is byte-exact; “same looking text” can still differ at the byte level.

### Timestamp freshness / replay scenarios (verify)

**S28 — Freshness disabled: old timestamps still verify**
- Conditions: `ENFORCE_TIMESTAMP_FRESHNESS!=='true'` and inputs match exactly, even if `timestamp` is very old.
- Expected response: `200` with `{ isValid: true, hash, timestamp }`.
- Explanation: No time-window enforcement is applied.

**S29 — Freshness enabled: timestamp too old**
- Conditions: `ENFORCE_TIMESTAMP_FRESHNESS==='true'` and `now - timestamp > MAX_SIGNATURE_AGE_MS`.
- Expected response: `400` with `{ error: { message: "Bad Request", details: { field: "timestamp", issue: "is too old", maxAgeMs } } }`.
- Explanation: Rejects stale signatures to reduce replay.

**S30 — Freshness enabled: timestamp too far in the future**
- Conditions: `ENFORCE_TIMESTAMP_FRESHNESS==='true'` and `timestamp - now > MAX_FUTURE_SKEW_MS`.
- Expected response: `400` with `{ error: { message: "Bad Request", details: { field: "timestamp", issue: "is too far in the future", maxFutureSkewMs } } }`.
- Explanation: Rejects timestamps beyond allowed clock skew.

**S31 — Replay within the freshness window**
- Conditions: `ENFORCE_TIMESTAMP_FRESHNESS==='true'`, but verification happens multiple times within the allowed window.
- Expected response: `200` with `{ isValid: true, hash, timestamp }` each time.
- Explanation: There is no stateful “one-time use” nonce store; freshness is a time-only guard.

### Encoding / upload edge cases

**S32 — Upload too large (multipart)**
- Conditions: Upload `document` larger than 10 MiB.
- Expected response: `413` with `{ error: { message: "Payload Too Large", details: { issue: "file too large", limitBytes } } }`.
- Explanation: Multer enforces the upload limit.

**S33 — Upload parsing error (multipart)**
- Conditions: Multipart request is malformed (e.g., truncated body/boundary issues).
- Expected response: `400` with `{ error: { message: "Bad Request", details: { issue: "upload failed", code } } }`.
- Explanation: The upload middleware rejects malformed multipart bodies.

**S34 — JSON body too large**
- Conditions: `application/json` body exceeds the server JSON limit (1 MiB).
- Expected response: `413` with `{ error: { message } }`.
- Explanation: Express JSON body parsing rejects oversized JSON payloads.

### General HTTP scenarios

**S35 — Unknown route**
- Conditions: Any request to a non-existent endpoint.
- Expected response: `404` with `{ error: { message: "Not Found" } }`.
- Explanation: Standard 404 handler.

**S36 — Key generation failure (rare runtime issue)**
- Conditions: OpenSSL/crypto cannot generate a key pair.
- Expected response: `500` with `{ error: { message: "Internal Server Error", details: { issue, cause } } }`.
- Explanation: Unexpected crypto failure surfaced as a server error.

### Additional realistic edge cases

**S37 — Verify with timestamp from a different signing operation (same doc + same key)**
- Conditions: Sign the same document twice with the same private key (two different `{ signature, timestamp }`), then verify using `signature` from signing #1 but `timestamp` from signing #2.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: The signature is bound to the exact timestamp string used during signing.

**S38 — Verify using a signature from one document against a different document**
- Conditions: Take `{ signature, timestamp }` from signing Document A, then verify using Document B bytes (with the same `publicKey` and `timestamp`).
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: The document bytes are part of the signed payload.

**S39 — Verify with correct doc+timestamp but signature produced by a different key**
- Conditions: Use a signature that was produced over the same `{ documentBytes, timestamp }` but with a different DSA private key than the one corresponding to `publicKey`.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Even if the payload matches, the signature must verify under the provided public key.

**S40 — Timestamp “same instant” but different string (explicit example)**
- Conditions: Signing returned `2026-04-12T18:20:30.000+08:00`, but verification uses `2026-04-12T10:20:30.000Z`.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: The timestamp string itself is included in the signed bytes (no normalization).

**S41 — Verify timestamp is parseable but non-RFC (still fails unless it matches exactly)**
- Conditions: Verify with a parseable but non-RFC string like `Sat Apr 12 2026 18:20:30 GMT+0800 (Philippine Time)`.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Parsing is only for optional freshness checks; the signed payload uses the exact original timestamp string.

**S42 — Verify timestamp provided as a number (JSON)**
- Conditions: `POST /api/verify` JSON with `timestamp: 1712923230000` (number, not string).
- Expected response: `400` with `{ error: { message: "Bad Request", details: { field: "timestamp", issue: "must be a string" } } }`.
- Explanation: The API requires timestamps as strings.

**S43 — Verify timestamp provided as a numeric string**
- Conditions: `timestamp: "1712923230000"`.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: In Node.js, `new Date("1712923230000")` is parseable (ms since epoch), so verification proceeds; it still fails because the timestamp string doesn’t match the one returned by `/api/sign`.

**S44 — Sign accepts private key PEM with CRLF newlines / surrounding whitespace**
- Conditions: `privateKey` PEM uses Windows newlines (`\r\n`) and/or has leading/trailing whitespace around the PEM block.
- Expected response: `200` with `{ signature, hash, timestamp }`.
- Explanation: Node/OpenSSL PEM parsing generally tolerates CRLF and surrounding whitespace.

**S45 — Verify accepts public key PEM with CRLF newlines / surrounding whitespace**
- Conditions: `publicKey` PEM uses `\r\n` and/or has leading/trailing whitespace around the PEM block.
- Expected response: `200` with `{ isValid: true|false, hash, timestamp }`.
- Explanation: Key parsing is tolerant of common newline/whitespace differences.

**S46 — Verify when publicKey field contains the signer’s private key PEM**
- Conditions: Paste the signer’s DSA private key PEM into the `publicKey` field (instead of the public key), with the correct `document`, `signature`, and `timestamp`.
- Expected response: `200` with `{ isValid: true, hash, timestamp }`.
- Explanation: `crypto.createPublicKey(...)` can derive a public key from a private key; verification still works (but you should never share private keys).

**S47 — Verify when publicKey field contains a different private key PEM**
- Conditions: Paste an unrelated DSA private key PEM into `publicKey` (with otherwise valid inputs).
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: The derived public key won’t match the signature.

**S48 — Base64 is valid but decoded signature length is unexpected**
- Conditions: Provide a base64 string that decodes successfully but is too short/long to be a valid DSA signature.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Base64 validation passes; crypto verification fails and returns `false`.

**S49 — Freshness enabled but MAX_SIGNATURE_AGE_MS malformed/negative**
- Conditions: `ENFORCE_TIMESTAMP_FRESHNESS==='true'` and `MAX_SIGNATURE_AGE_MS` is unset, non-numeric, or `<= 0`.
- Expected response: verification uses defaults and returns either `200 { isValid: true|false, ... }` or `400` freshness errors based on the default 5-minute window.
- Explanation: The service falls back to a safe default instead of crashing.

**S50 — Freshness enabled but MAX_FUTURE_SKEW_MS malformed/negative**
- Conditions: `ENFORCE_TIMESTAMP_FRESHNESS==='true'` and `MAX_FUTURE_SKEW_MS` is unset, non-numeric, or `< 0`.
- Expected response: freshness checks use the default 2-minute skew; outcomes match S30 behavior.
- Explanation: Invalid config values fall back to defaults.

**S51 — Freshness passes but timestamp string is wrong (still invalid)**
- Conditions: `ENFORCE_TIMESTAMP_FRESHNESS==='true'`, timestamp is within the allowed window and parseable, but not the exact string returned by signing.
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Freshness is a guardrail; payload bytes must still match exactly.

**S52 — Sign fails because DSA+MD5 is disallowed by the runtime**
- Conditions: The current Node/OpenSSL build refuses DSA signing with raw digest and also refuses `"md5"` signing (policy/FIPS/etc.).
- Expected response: `400` with `{ error: { message: "Bad Request", details: { issue: "signing failed", cause } } }`.
- Explanation: Behavior depends on crypto provider policy; the API surfaces the underlying failure.

**S53 — Verify fails because DSA+MD5 is disallowed by the runtime**
- Conditions: The runtime refuses verification for the requested operation even when inputs are well-formed.
- Expected response: `400` with `{ error: { message: "Wrong public key", details: { field: "publicKey", issue: "verification failed", cause } } }`.
- Explanation: Some crypto failures are surfaced through the verifier’s public-key error path.

**S54 — User-computed “hash” doesn’t match the server’s hash**
- Conditions: User computes `MD5(documentBytes)` (or hashes a differently-encoded payload) and compares it to the API’s `hash`.
- Expected response: `200` verify response still includes `{ hash, timestamp }` (server-computed), which may differ from the user’s local calculation.
- Explanation: The server hash is over the exact deterministic payload bytes (including the exact timestamp string and framing), not just the raw file.

**S55 — Text file verified after newline normalization (CRLF↔LF) by the client**
- Conditions: Sign a `.txt` file, then verify a version that looks identical but has different newline bytes (e.g., editor auto-converted line endings).
- Expected response: `200` with `{ isValid: false, hash, timestamp }`.
- Explanation: Verification is byte-exact; newline normalization changes the signed bytes.

**S56 — Verify succeeds but client expects a different timestamp format in the response**
- Conditions: Client expects `timestamp` to be normalized (e.g., always `Z`), but the API echoes the provided string.
- Expected response: `200` with `{ isValid: true|false, hash, timestamp }` where `timestamp` equals the request’s timestamp string.
- Explanation: The system treats timestamp as an exact input string for payload binding.
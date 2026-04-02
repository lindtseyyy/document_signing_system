/**
 * App root for the Document Signing System demo UI.
 * Provides a 3-card flow: Generate Keys → Sign Document → Verify Document (DSA (Digital Signature Algorithm)).
 */

import { useState } from 'react'
import KeyGenerator from './components/KeyGenerator.jsx'
import UserKeyManager from './components/UserKeyManager.jsx'
import SignDocument from './components/SignDocument.jsx'
import VerifyDocument from './components/VerifyDocument.jsx'

/**
 * App component.
 * Holds shared state (document/keys/signature) so the cards stay in sync.
 */
export default function App() {
  const [documentFile, setDocumentFile] = useState(/** @type {File | null} */ (null))
  const [publicKey, setPublicKey] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [signature, setSignature] = useState('')

  const [userKeysRevision, setUserKeysRevision] = useState(0)

  // Snapshots captured after a successful sign, used by Verify to classify scenarios.
  const [signedHash, setSignedHash] = useState('')
  const [signedSignatureSnapshot, setSignedSignatureSnapshot] = useState('')
  const [signedPublicKeySnapshot, setSignedPublicKeySnapshot] = useState('')

  const SECTIONS = [
    { id: 'userKeys', label: 'User Key Management' },
    { id: 'keys', label: 'Key Generation' },
    { id: 'sign', label: 'Document Signing' },
    { id: 'verify', label: 'Document Verification' },
  ]

  const [activeSection, setActiveSection] = useState('keys')

  /**
   * Compute the client-side SHA-256 whenever the document changes.
   * Requirement: useEffect-based hashing with Web Crypto.
   */
  // useEffect(() => {
  //   let isCancelled = false

  //   async function computeHash() {
  //     setHashError('')
  //     try {
  //       // Critical: any document edit changes this digest, which breaks signature verification.
  //       const hex = await sha256Hex(document)
  //       if (!isCancelled) setClientHash(hex)
  //     } catch (err) {
  //       const message = err instanceof Error ? err.message : 'Failed to compute hash.'
  //       if (!isCancelled) {
  //         setClientHash('')
  //         setHashError(message)
  //       }
  //     }
  //   }

  //   computeHash()

  //   return () => {
  //     isCancelled = true
  //   }
  // }, [document])

  /**
   * Capture the signing-time snapshots so Verify can classify mismatch scenarios.
   * @param {{ hash: string, signatureSnapshot: string, publicKeySnapshot: string }} snapshot
   */
  function handleSignedSnapshot(snapshot) {
    setSignedHash(snapshot.hash || '')
    setSignedSignatureSnapshot(snapshot.signatureSnapshot || '')
    setSignedPublicKeySnapshot(snapshot.publicKeySnapshot || '')
  }

  /**
   * A memoized status message for hashing so it doesn't flicker.
   */
  // const hashStatus = useMemo(() => {
  //   if (hashError) return { kind: 'error', text: hashError }
  //   if (!clientHash) return { kind: 'info', text: 'Computing SHA-256…' }
  //   return { kind: 'ok', text: 'SHA-256 computed locally (client-side).' }
  // }, [clientHash, hashError])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-slate-900">Document Signing System</h1>

        </header>

        

        <nav className="mt-6" aria-label="Sections">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'rounded-md px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {section.label}
                </button>
              )
            })}
          </div>
        </nav>

        <section className="mt-6 grid grid-cols-1 gap-6">
          <div className={activeSection === 'keys' ? '' : 'hidden'} aria-hidden={activeSection !== 'keys'}>
            <KeyGenerator
              onUserKeysStored={() => setUserKeysRevision((n) => n + 1)}
            />
          </div>

          <div
            className={activeSection === 'userKeys' ? '' : 'hidden'}
            aria-hidden={activeSection !== 'userKeys'}
          >
            <UserKeyManager storageRevision={userKeysRevision} />
          </div>

          <div className={activeSection === 'sign' ? '' : 'hidden'} aria-hidden={activeSection !== 'sign'}>
            <SignDocument
              documentFile={documentFile}
              setDocumentFile={setDocumentFile}
              publicKey={publicKey}
              privateKey={privateKey}
              setPrivateKey={setPrivateKey}
              onSignedSnapshot={handleSignedSnapshot}
            />
          </div>

          <div
            className={activeSection === 'verify' ? '' : 'hidden'}
            aria-hidden={activeSection !== 'verify'}
          >
            <VerifyDocument
              documentFile={documentFile}
              setDocumentFile={setDocumentFile}
              signature={signature}
              setSignature={setSignature}
              publicKey={publicKey}
              setPublicKey={setPublicKey}

              signedHash={signedHash}
              signedSignatureSnapshot={signedSignatureSnapshot}
              signedPublicKeySnapshot={signedPublicKeySnapshot}
   
            />
          </div>
        </section>
      </div>
    </main>
  )
}

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let googleProvider: GoogleAuthProvider | null = null
let db: Firestore | null = null
let firebaseAvailable = false

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    auth = getAuth(app)

    // Persist session across browser restarts
    if (typeof window !== 'undefined') {
      setPersistence(auth, browserLocalPersistence).catch((e) => {
        console.warn('Firebase setPersistence failed:', e)
      })
    }

    googleProvider = new GoogleAuthProvider()
    googleProvider.addScope('email')
    googleProvider.addScope('profile')

    db = getFirestore(app)
    firebaseAvailable = true
  }
} catch (e) {
  console.error('Firebase initialization failed:', e)
}

// ─── Firestore helpers ───────────────────────────────────────────────────────

/**
 * Create or update a user document in Firestore users/{uid}
 */
export async function upsertFirestoreUser(uid: string, data: {
  email: string
  name: string
  verified?: boolean
}) {
  if (!db || typeof navigator !== 'undefined' && !navigator.onLine) return
  try {
    const ref = doc(db, 'users', uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        email: data.email,
        name: data.name,
        verified: data.verified ?? false,
        createdAt: serverTimestamp(),
      })
    } else {
      // Only update mutable fields
      await setDoc(ref, {
        email: data.email,
        name: data.name,
        verified: data.verified ?? snap.data()?.verified ?? false,
      }, { merge: true })
    }
  } catch (e) {
    console.warn('Firestore upsertUser skipped:', e instanceof Error ? e.message : 'offline')
  }
}

/**
 * Store an OTP in Firestore otps/{email}
 */
export async function storeFirestoreOtp(email: string, code: string) {
  if (!db || typeof navigator !== 'undefined' && !navigator.onLine) return
  try {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    await setDoc(doc(db, 'otps', email), {
      code,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (e) {
    console.warn('Firestore storeOtp skipped:', e instanceof Error ? e.message : 'offline')
  }
}

/**
 * Delete OTP from Firestore after validation
 */
export async function deleteFirestoreOtp(email: string) {
  if (!db || typeof navigator !== 'undefined' && !navigator.onLine) return
  try {
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'otps', email))
  } catch (e) {
    console.warn('Firestore deleteOtp skipped:', e instanceof Error ? e.message : 'offline')
  }
}

export { app, auth, googleProvider, db, firebaseAvailable }
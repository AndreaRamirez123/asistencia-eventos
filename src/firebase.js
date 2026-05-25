import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

function isPlaceholder(value) {
  return !value || value.startsWith('TU_') || value.includes('YOUR_')
}

function hasValidFirebaseConfig(config) {
  return Object.values(config).every((value) => !isPlaceholder(value))
}

export const isFirebaseConfigured = hasValidFirebaseConfig(firebaseConfig)

let app = null
let auth = null
let db = null
let storage = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app, 'eventos-divergentes')
  storage = getStorage(app)
} else {
  console.warn(
    'Firebase no esta configurado con credenciales validas. La app seguira en modo preview local.',
  )
}

export { app, auth, db, storage, firebaseConfig }

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from './firebase'

const USERS_COLLECTION = 'eventoUsuarios'

export async function loginWithEmail(email, password) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth no esta configurado. Revisa .env.local.')
  }

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  const firebaseUser = credential.user
  const profile = await fetchUserProfile(firebaseUser.uid)

  if (!profile) {
    await signOut(auth)
    throw new Error(
      'Tu cuenta existe pero no tiene un rol asignado. Contacta al administrador del evento.',
    )
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role: profile.role,
    displayName: profile.displayName || deriveNameFromEmail(firebaseUser.email),
  }
}

export async function logout() {
  if (auth) {
    await signOut(auth)
  }
}

export async function fetchUserProfile(uid) {
  if (!db || !uid) {
    return null
  }

  try {
    const ref = doc(db, USERS_COLLECTION, uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      return null
    }
    const data = snap.data()
    if (data.active === false) {
      return null
    }
    return {
      role: data.role || '',
      displayName: data.displayName || '',
    }
  } catch (error) {
    console.error('No fue posible consultar el perfil del usuario.', error)
    return null
  }
}

function deriveNameFromEmail(email) {
  if (!email) return ''
  const local = email.split('@')[0] || ''
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function subscribeToAuthState(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null)
      return
    }

    const profile = await fetchUserProfile(firebaseUser.uid)
    if (!profile) {
      callback(null)
      return
    }

    callback({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: profile.role,
      displayName: profile.displayName || deriveNameFromEmail(firebaseUser.email),
    })
  })
}

import { deleteApp, initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfig, isFirebaseConfigured } from './firebase'

const USERS_COLLECTION = 'eventoUsuarios'

export async function loginWithEmail(email, password) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth no esta configurado. Revisa .env.local.')
  }

  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  const firebaseUser = credential.user
  const profile = await fetchUserProfile(firebaseUser.uid, firebaseUser.email)

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
    clienteId: profile.clienteId || '',
    displayName: profile.displayName || deriveNameFromEmail(firebaseUser.email),
  }
}

export async function loginWithGoogle() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth no esta configurado. Revisa .env.local.')
  }
  const provider = new GoogleAuthProvider()
  // iOS bloquea window.open() — usar redirect con mismo authDomain evita storage partitioning
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isIOS) {
    await signInWithRedirect(auth, provider)
    return null
  }
  const result = await signInWithPopup(auth, provider)
  const firebaseUser = result.user
  const profile = await fetchUserProfile(firebaseUser.uid, firebaseUser.email)
  if (!profile) {
    await signOut(auth)
    throw new Error(
      'Tu cuenta de Google no tiene un rol asignado. Contacta al administrador del evento.',
    )
  }
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    role: profile.role,
    clienteId: profile.clienteId || '',
    displayName: profile.displayName || deriveNameFromEmail(firebaseUser.email),
  }
}

export async function resetPassword(email) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth no esta configurado.')
  }
  await sendPasswordResetEmail(auth, email.trim())
}

export async function logout() {
  if (auth) {
    await signOut(auth)
  }
}

export async function fetchUserProfile(uid, email = '') {
  if (!db || !uid) return null

  try {
    const ref = doc(db, USERS_COLLECTION, uid)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      const data = snap.data()
      if (data.active === false) return null
      return {
        role: data.role || '',
        displayName: data.displayName || '',
        clienteId: data.clienteId || '',
        email: data.email || '',
      }
    }

    // Sin perfil propio — buscar invitación pendiente por email
    if (email) {
      const { buscarInvitacionPorEmail, aceptarInvitacion } = await import('./invitacionesStore')
      const invitacion = await buscarInvitacionPorEmail(email)
      if (invitacion) {
        const profileData = {
          email: email.toLowerCase(),
          displayName: invitacion.displayName || deriveNameFromEmail(email),
          role: invitacion.role,
          clienteId: invitacion.clienteId,
          active: true,
          creadaEn: serverTimestamp(),
        }
        await setDoc(doc(db, USERS_COLLECTION, uid), profileData)
        await aceptarInvitacion(invitacion.id)
        return {
          role: invitacion.role,
          displayName: profileData.displayName,
          clienteId: invitacion.clienteId,
          email: email.toLowerCase(),
        }
      }
    }

    return null
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

export async function invitarAdmin({ email, displayName, role = 'admin_empresa', clienteId }) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')

  const { crearInvitacion } = await import('./invitacionesStore')
  await crearInvitacion({ email, displayName, role, clienteId })

  // Intentar enviar correo de restablecimiento (funciona si ya tiene cuenta)
  try {
    await sendPasswordResetEmail(auth, email.trim())
    return
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err
  }

  // Si no tiene cuenta, crearla con instancia secundaria y enviar correo
  const tempPassword = `Inv${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}!`
  const secondaryApp = initializeApp(firebaseConfig, `invite-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)
  try {
    await createUserWithEmailAndPassword(secondaryAuth, email.trim(), tempPassword)
    await sendPasswordResetEmail(secondaryAuth, email.trim())
  } finally {
    await secondaryAuth.signOut().catch(() => {})
    await deleteApp(secondaryApp).catch(() => {})
  }
}

export function subscribeToAuthState(callback) {
  if (!auth) {
    callback(null)
    return () => {}
  }

  // Procesar resultado de signInWithRedirect si venimos de Google
  getRedirectResult(auth)
    .then(async (result) => {
      if (!result?.user) return
      const profile = await fetchUserProfile(result.user.uid, result.user.email)
      if (!profile) {
        await signOut(auth)
      }
    })
    .catch((error) => {
      console.error('Error en redirect de Google:', error.message)
    })

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null)
      return
    }

    const profile = await fetchUserProfile(firebaseUser.uid, firebaseUser.email)
    if (!profile) {
      callback(null)
      return
    }

    callback({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: profile.role,
      clienteId: profile.clienteId || '',
      displayName: profile.displayName || deriveNameFromEmail(firebaseUser.email),
    })
  })
}

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION = 'invitaciones'

export async function crearInvitacion({ email, displayName, role, clienteId }) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const data = {
    email: email.trim().toLowerCase(),
    displayName: displayName?.trim() || '',
    role,
    clienteId,
    estado: 'pendiente',
    creadaEn: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, COLLECTION), data)
  return { id: ref.id, ...data }
}

export async function buscarInvitacionPorEmail(email) {
  if (!isFirebaseConfigured || !db || !email) return null
  try {
    const q = query(
      collection(db, COLLECTION),
      where('email', '==', email.trim().toLowerCase()),
      where('estado', '==', 'pendiente'),
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  } catch {
    return null
  }
}

export async function aceptarInvitacion(invitacionId) {
  if (!isFirebaseConfigured || !db) return
  try {
    const { doc } = await import('firebase/firestore')
    const ref = doc(db, COLLECTION, invitacionId)
    await updateDoc(ref, { estado: 'aceptada' })
  } catch {
    // no crítico
  }
}

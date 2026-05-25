import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION = 'clientes'

export async function listClientes() {
  if (!isFirebaseConfigured || !db) return []
  try {
    const q = query(collection(db, COLLECTION), orderBy('nombre'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error('No fue posible cargar clientes.', e)
    return []
  }
}

export async function createCliente(payload) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const slug = String(payload.slug || payload.nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const data = {
    nombre: String(payload.nombre || '').trim(),
    slug,
    logoUrl: payload.logoUrl || '',
    colorAcento: payload.colorAcento || '#ffd166',
    activa: true,
    creadaEn: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, COLLECTION), data)
  return { id: ref.id, ...data, creadaEn: new Date().toISOString() }
}

export async function updateCliente(clienteId, updates) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const ref = doc(db, COLLECTION, clienteId)
  await updateDoc(ref, { ...updates, actualizadaEn: serverTimestamp() })
}

export async function deleteCliente(clienteId) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  await deleteDoc(doc(db, COLLECTION, clienteId))
}

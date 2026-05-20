import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION = 'eventoEstaciones'

export async function listEstaciones(eventoId) {
  if (!isFirebaseConfigured || !db) return []
  try {
    const q = query(collection(db, COLLECTION), where('eventoId', '==', eventoId))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error('No fue posible cargar estaciones.', error)
    return []
  }
}

export function subscribeToEstaciones(eventoId, callback) {
  if (!isFirebaseConfigured || !db) {
    callback([])
    return () => {}
  }
  const q = query(collection(db, COLLECTION), where('eventoId', '==', eventoId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function createEstacion(eventoId, data) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const ref = await addDoc(collection(db, COLLECTION), {
    eventoId,
    nombre: data.nombre || 'Nueva estación',
    tipo: data.tipo || 'stand',
    descripcion: data.descripcion || '',
    x: data.x ?? 10,
    y: data.y ?? 10,
    width: data.width ?? 15,
    height: data.height ?? 10,
    color: data.color || '#ffd166',
    forma: data.forma || 'rect',
    tieneTivia: false,
    createdAt: serverTimestamp(),
  })
  return { id: ref.id, eventoId, ...data }
}

export async function updateEstacion(estacionId, updates) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const ref = doc(db, COLLECTION, estacionId)
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() })
}

export async function deleteEstacion(estacionId) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  await deleteDoc(doc(db, COLLECTION, estacionId))
}

export async function saveEstacionesBulk(eventoId, estaciones) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const existentes = await listEstaciones(eventoId)
  for (const e of existentes) {
    await deleteEstacion(e.id)
  }
  const creadas = []
  for (const e of estaciones) {
    const creada = await createEstacion(eventoId, e)
    creadas.push(creada)
  }
  return creadas
}

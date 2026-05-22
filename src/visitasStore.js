import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION = 'eventoVisitas'

export async function registrarVisita(eventoId, estacionId, visitanteId) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const ref = await addDoc(collection(db, COLLECTION), {
    eventoId,
    estacionId,
    visitanteId,
    timestamp: serverTimestamp(),
  })
  return ref.id
}

export async function getVisitasPorVisitante(eventoId, visitanteId) {
  if (!isFirebaseConfigured || !db) return []
  try {
    const q = query(
      collection(db, COLLECTION),
      where('eventoId', '==', eventoId),
      where('visitanteId', '==', visitanteId),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error('No fue posible cargar visitas.', error)
    return []
  }
}

export async function getVisitasPorEstacion(eventoId, estacionId) {
  if (!isFirebaseConfigured || !db) return []
  try {
    const q = query(
      collection(db, COLLECTION),
      where('eventoId', '==', eventoId),
      where('estacionId', '==', estacionId),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error('No fue posible cargar visitas.', error)
    return []
  }
}

export async function yaVisito(eventoId, estacionId, visitanteId) {
  const visitas = await getVisitasPorVisitante(eventoId, visitanteId)
  return visitas.some((v) => v.estacionId === estacionId)
}

export async function resetVisitasDeVisitante(eventoId, visitanteId) {
  if (!isFirebaseConfigured || !db) return
  const visitas = await getVisitasPorVisitante(eventoId, visitanteId)
  await Promise.all(visitas.map((v) => deleteDoc(doc(db, COLLECTION, v.id))))
}

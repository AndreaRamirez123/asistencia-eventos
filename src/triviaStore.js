import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const TRIVIA_COLLECTION = 'eventoTrivias'
const RESULTADOS_COLLECTION = 'eventoTriviaResultados'

// ── Trivia config (preguntas por estación) ──────────────────────────────────

export async function getTriviaDeEstacion(estacionId) {
  if (!isFirebaseConfigured || !db) return null
  try {
    const q = query(collection(db, TRIVIA_COLLECTION), where('estacionId', '==', estacionId))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  } catch (error) {
    console.error('No fue posible cargar trivia.', error)
    return null
  }
}

export async function saveTriviaDeEstacion(estacionId, eventoId, preguntas) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  const existente = await getTriviaDeEstacion(estacionId)
  if (existente) {
    await setDoc(doc(db, TRIVIA_COLLECTION, existente.id), {
      estacionId,
      eventoId,
      preguntas,
      updatedAt: serverTimestamp(),
    })
    return existente.id
  } else {
    const ref = await addDoc(collection(db, TRIVIA_COLLECTION), {
      estacionId,
      eventoId,
      preguntas,
      createdAt: serverTimestamp(),
    })
    return ref.id
  }
}

export async function deleteTriviaDeEstacion(estacionId) {
  if (!isFirebaseConfigured || !db) return
  const existente = await getTriviaDeEstacion(estacionId)
  if (existente) {
    await deleteDoc(doc(db, TRIVIA_COLLECTION, existente.id))
  }
}

// ── Resultados ──────────────────────────────────────────────────────────────

export async function guardarResultado(eventoId, estacionId, nombre, puntos, tiempoSegundos) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')
  await addDoc(collection(db, RESULTADOS_COLLECTION), {
    eventoId,
    estacionId,
    nombre,
    puntos,
    tiempoSegundos,
    timestamp: serverTimestamp(),
  })
}

export async function getRankingDeEstacion(estacionId) {
  if (!isFirebaseConfigured || !db) return []
  try {
    const q = query(collection(db, RESULTADOS_COLLECTION), where('estacionId', '==', estacionId))
    const snap = await getDocs(q)
    const resultados = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return resultados.sort((a, b) => b.puntos - a.puntos || a.tiempoSegundos - b.tiempoSegundos)
  } catch (error) {
    console.error('No fue posible cargar ranking.', error)
    return []
  }
}

export function subscribeToRankingDeEstacion(estacionId, callback) {
  if (!isFirebaseConfigured || !db) {
    callback([])
    return () => {}
  }
  const q = query(collection(db, RESULTADOS_COLLECTION), where('estacionId', '==', estacionId))
  return onSnapshot(q, (snap) => {
    const resultados = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(resultados.sort((a, b) => b.puntos - a.puntos || a.tiempoSegundos - b.tiempoSegundos))
  })
}

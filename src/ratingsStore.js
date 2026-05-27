import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION_NAME = 'eventoCalificaciones'

function ensureFirestore() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase no esta configurado.')
  }
}

function toIsoDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return value
}

function mapDoc(snapshot) {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    ...data,
    createdAt: toIsoDate(data.createdAt),
  }
}

export async function saveRating({ stars, comment, empresaId, eventoId }) {
  ensureFirestore()
  const cleanStars = Math.max(1, Math.min(5, parseInt(stars, 10) || 0))
  if (cleanStars < 1) {
    throw new Error('La calificación debe ser entre 1 y 5 estrellas.')
  }
  const ref = collection(db, COLLECTION_NAME)
  await addDoc(ref, {
    stars: cleanStars,
    comment: String(comment || '').trim().slice(0, 600),
    empresaId: String(empresaId || '').trim(),
    eventoId: String(eventoId || '').trim(),
    createdAt: serverTimestamp(),
  })
}

export async function deleteRating(id) {
  ensureFirestore()
  await deleteDoc(doc(db, COLLECTION_NAME, id))
}

export async function deleteAllRatings(ids) {
  ensureFirestore()
  const batch = writeBatch(db)
  ids.forEach((id) => batch.delete(doc(db, COLLECTION_NAME, id)))
  await batch.commit()
}

export function subscribeToRatings(eventoId, onChange, onError) {
  ensureFirestore()
  const ref = collection(db, COLLECTION_NAME)
  // Sin index compuesto: solo orderBy, filtramos por evento client-side
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(mapDoc)
      const filtered = eventoId
        ? all.filter((r) => !r.eventoId || r.eventoId === eventoId)
        : all
      onChange(filtered)
    },
    (error) => {
      if (onError) onError(error)
    },
  )
}

import { collection, getDocs } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION_NAME = 'eventoEventos'

export async function listEventos() {
  if (!isFirebaseConfigured || !db) {
    return []
  }

  try {
    const ref = collection(db, COLLECTION_NAME)
    const snap = await getDocs(ref)
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('No fue posible cargar eventos.', error)
    return []
  }
}

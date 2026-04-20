import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION_NAME = 'eventoEmpresas'

export async function listEmpresas() {
  if (!isFirebaseConfigured || !db) {
    return []
  }

  try {
    const empresasRef = collection(db, COLLECTION_NAME)
    const q = query(empresasRef, orderBy('nombre'))
    const snap = await getDocs(q)
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('No fue posible cargar empresas.', error)
    return []
  }
}

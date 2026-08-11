import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION_NAME = 'eventoEmpresas'

export async function listEmpresas(clienteId) {
  if (!isFirebaseConfigured || !db) {
    return []
  }

  try {
    const empresasRef = collection(db, COLLECTION_NAME)
    const constraints = [orderBy('nombre')]
    if (clienteId) constraints.push(where('clienteId', '==', clienteId))
    const q = query(empresasRef, ...constraints)
    const snap = await getDocs(q)
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('No fue posible cargar empresas.', error)
    return []
  }
}

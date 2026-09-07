import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION = 'clientes'

export async function listClientes() {
  if (!isFirebaseConfigured || !db) return []
  try {
    const q = query(collection(db, COLLECTION), orderBy('nombre'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => {
      const data = d.data()
      // Normalizar campo colorPrimario para docs creados antes del renombre
      if (!data.colorPrimario && data.colorAcento) {
        data.colorPrimario = data.colorAcento
      }
      return { id: d.id, ...data }
    })
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

  const colorPrimario = payload.colorPrimario || payload.colorAcento || '#ffd166'
  const data = {
    nombre: String(payload.nombre || '').trim(),
    slug,
    logoUrl: payload.logoUrl || '',
    colorPrimario,
    colorAcento: colorPrimario, // backward compat
    colorSecundario: payload.colorSecundario || '',
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

export async function getClienteById(id) {
  if (!isFirebaseConfigured || !db || !id) return null
  try {
    const snap = await getDoc(doc(db, COLLECTION, id))
    if (!snap.exists()) return null
    const data = snap.data()
    if (!data.colorPrimario && data.colorAcento) data.colorPrimario = data.colorAcento
    return { id: snap.id, ...data }
  } catch (e) {
    console.error('No fue posible cargar cliente.', e)
    return null
  }
}

export async function getClienteBySlug(slug) {
  if (!isFirebaseConfigured || !db || !slug) return null
  try {
    const q = query(collection(db, COLLECTION), where('slug', '==', slug), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const data = snap.docs[0].data()
    if (!data.colorPrimario && data.colorAcento) data.colorPrimario = data.colorAcento
    return { id: snap.docs[0].id, ...data }
  } catch (e) {
    console.error('No fue posible cargar cliente por slug.', e)
    return null
  }
}

// Migra datos huérfanos (sin clienteId) asignándolos a un cliente específico
export async function migrarDatosHuerfanos(clienteId) {
  if (!isFirebaseConfigured || !db || !clienteId) throw new Error('ClienteId requerido.')
  const COLECCIONES = ['eventoEventos', 'eventoAsistentes']
  let total = 0
  for (const col of COLECCIONES) {
    const q = query(collection(db, col), where('clienteId', '==', ''))
    const snap = await getDocs(q)
    for (const d of snap.docs) {
      await updateDoc(doc(db, col, d.id), { clienteId })
      total++
    }
    // También documentos que no tienen el campo (más antigua compatibilidad)
    const q2 = query(collection(db, col))
    const snap2 = await getDocs(q2)
    for (const d of snap2.docs) {
      if (d.data().clienteId === undefined) {
        await updateDoc(doc(db, col, d.id), { clienteId })
        total++
      }
    }
  }
  return total
}

// Borra eventos/asistentes (y su data relacionada: estaciones, visitas,
// calificaciones, trivias) cuyo clienteId ya no corresponde a ningún cliente
// existente — sobras de empresas eliminadas con deleteCliente(), que no
// borra en cascada.
export async function limpiarDatosHuerfanos() {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase no configurado.')

  const clientesSnap = await getDocs(collection(db, COLLECTION))
  const idsValidos = new Set(clientesSnap.docs.map((d) => d.id))

  const eventosSnap = await getDocs(collection(db, 'eventoEventos'))
  const eventosHuerfanos = eventosSnap.docs.filter((d) => {
    const clienteId = d.data().clienteId
    return clienteId && !idsValidos.has(clienteId)
  })
  const eventoIdsHuerfanos = new Set(eventosHuerfanos.map((d) => d.id))

  let total = 0

  const RELACIONADAS = [
    'eventoAsistentes',
    'eventoEstaciones',
    'eventoVisitas',
    'eventoCalificaciones',
    'eventoTrivias',
    'eventoTriviaResultados',
  ]
  for (const col of RELACIONADAS) {
    const snap = await getDocs(collection(db, col))
    for (const d of snap.docs) {
      const data = d.data()
      const esHuerfanaPorCliente = data.clienteId && !idsValidos.has(data.clienteId)
      const esHuerfanaPorEvento = data.eventoId && eventoIdsHuerfanos.has(data.eventoId)
      if (esHuerfanaPorCliente || esHuerfanaPorEvento) {
        await deleteDoc(doc(db, col, d.id))
        total++
      }
    }
  }

  for (const d of eventosHuerfanos) {
    await deleteDoc(doc(db, 'eventoEventos', d.id))
    total++
  }

  return total
}

export async function getClienteStats(clienteId) {
  if (!isFirebaseConfigured || !db || !clienteId) return { eventos: 0, asistentes: 0 }
  try {
    const [eventosSnap, asistentesSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'eventoEventos'), where('clienteId', '==', clienteId))),
      getCountFromServer(query(collection(db, 'eventoAsistentes'), where('clienteId', '==', clienteId))),
    ])
    return {
      eventos: eventosSnap.data().count,
      asistentes: asistentesSnap.data().count,
    }
  } catch (e) {
    console.error('No fue posible cargar estadísticas del cliente.', e)
    return { eventos: 0, asistentes: 0 }
  }
}

export async function getGlobalStats() {
  if (!isFirebaseConfigured || !db) return { eventos: 0, asistentes: 0 }
  try {
    const [eventosSnap, asistentesSnap] = await Promise.all([
      getCountFromServer(collection(db, 'eventoEventos')),
      getCountFromServer(collection(db, 'eventoAsistentes')),
    ])
    return {
      eventos: eventosSnap.data().count,
      asistentes: asistentesSnap.data().count,
    }
  } catch (e) {
    console.error('No fue posible cargar estadísticas globales.', e)
    return { eventos: 0, asistentes: 0 }
  }
}

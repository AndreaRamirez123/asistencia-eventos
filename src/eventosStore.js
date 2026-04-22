import { collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
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

export async function updateEvento(eventoId, updates) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase no esta configurado.')
  }
  const ref = doc(db, COLLECTION_NAME, eventoId)
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() })
  return { id: eventoId, ...updates }
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

export async function addEmpresaInvitada(evento, nombre) {
  const cleanNombre = String(nombre || '').trim()
  if (!cleanNombre) {
    throw new Error('El nombre de la empresa es obligatorio.')
  }

  const current = Array.isArray(evento.empresasInvitadas) ? evento.empresasInvitadas : []
  const baseId = slugify(cleanNombre) || `empresa-${Date.now()}`
  let id = baseId
  let suffix = 2
  while (current.some((e) => e.id === id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  const duplicateByName = current.some(
    (e) => e.nombre.toLowerCase() === cleanNombre.toLowerCase(),
  )
  if (duplicateByName) {
    throw new Error('Ya existe una empresa invitada con ese nombre.')
  }

  const next = [...current, { id, nombre: cleanNombre }]
  await updateEvento(evento.id, { empresasInvitadas: next })
  return next
}

export async function removeEmpresaInvitada(evento, empresaInvitadaId) {
  const current = Array.isArray(evento.empresasInvitadas) ? evento.empresasInvitadas : []
  const next = current.filter((e) => e.id !== empresaInvitadaId)
  await updateEvento(evento.id, { empresasInvitadas: next })
  return next
}

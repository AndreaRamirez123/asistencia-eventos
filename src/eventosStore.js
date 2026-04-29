import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
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

export async function createEvento(payload = {}) {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase no esta configurado.')
  }
  const ref = collection(db, COLLECTION_NAME)
  const data = {
    nombre: String(payload.nombre || 'Evento sin titulo').trim(),
    empresasInvitadas: Array.isArray(payload.empresasInvitadas)
      ? payload.empresasInvitadas
      : [],
    categorias: Array.isArray(payload.categorias) ? payload.categorias : [],
    modoRegistro: payload.modoRegistro || 'pre',
    registroEnSitio: false,
    calificacionHabilitada: false,
    calificacionTitulo: payload.calificacionTitulo || '',
    archivado: false,
    active: true,
    createdAt: serverTimestamp(),
  }
  const docRef = await addDoc(ref, data)
  return {
    id: docRef.id,
    ...data,
    createdAt: new Date().toISOString(),
  }
}

export async function closeEventAndCreateNew(currentEvento, options = {}) {
  if (!currentEvento) {
    throw new Error('No hay evento actual para cerrar.')
  }

  // 1. Marcar el actual como archivado
  await updateEvento(currentEvento.id, {
    archivado: true,
    active: false,
    fechaCierre: new Date().toISOString(),
  })

  // 2. Crear el nuevo, opcionalmente heredando configuracion
  const inheritEmpresas = options.heredarEmpresas !== false
  const inheritCategorias = options.heredarCategorias !== false
  const inheritEncuestas = options.heredarEncuestas !== false

  let empresasInvitadas = []
  if (inheritEmpresas && Array.isArray(currentEvento.empresasInvitadas)) {
    empresasInvitadas = currentEvento.empresasInvitadas.map((e) => {
      if (inheritEncuestas) return { ...e }
      // heredar empresa pero sin encuestas
      const { encuestaPreguntas, encuestaHabilitada, encuestaObligatoria, ...rest } = e
      return rest
    })
  }

  const categorias =
    inheritCategorias && Array.isArray(currentEvento.categorias)
      ? currentEvento.categorias
      : []

  const nuevoEvento = await createEvento({
    nombre: options.nombreNuevo || `Nuevo evento ${new Date().toLocaleDateString('es-CO')}`,
    empresasInvitadas,
    categorias,
    modoRegistro: 'pre',
  })

  return nuevoEvento
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

export async function updateEmpresaInvitada(evento, empresaInvitadaId, changes) {
  const current = Array.isArray(evento.empresasInvitadas) ? evento.empresasInvitadas : []
  const next = current.map((e) =>
    e.id === empresaInvitadaId ? { ...e, ...changes } : e,
  )
  await updateEvento(evento.id, { empresasInvitadas: next })
  return next
}

export const DEFAULT_CATEGORIAS = [
  { id: 'general', nombre: 'General' },
  { id: 'vip', nombre: 'VIP' },
  { id: 'speaker', nombre: 'Speaker' },
  { id: 'press', nombre: 'Prensa' },
]

export function getCategorias(evento) {
  if (Array.isArray(evento?.categorias) && evento.categorias.length > 0) {
    return evento.categorias
  }
  return DEFAULT_CATEGORIAS
}

export async function setCategorias(evento, categorias) {
  if (!evento) {
    throw new Error('Evento no especificado.')
  }
  await updateEvento(evento.id, { categorias })
  return categorias
}

export async function addCategoria(evento, nombre) {
  const cleanNombre = String(nombre || '').trim()
  if (!cleanNombre) {
    throw new Error('El nombre de la categoria es obligatorio.')
  }
  const current = getCategorias(evento)
  const baseId = slugify(cleanNombre) || `cat-${Date.now()}`
  let id = baseId
  let suffix = 2
  while (current.some((c) => c.id === id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }
  const duplicateByName = current.some(
    (c) => c.nombre.toLowerCase() === cleanNombre.toLowerCase(),
  )
  if (duplicateByName) {
    throw new Error('Ya existe una categoria con ese nombre.')
  }
  const next = [...current, { id, nombre: cleanNombre }]
  return setCategorias(evento, next)
}

export async function removeCategoria(evento, categoriaId) {
  const current = getCategorias(evento)
  const next = current.filter((c) => c.id !== categoriaId)
  if (next.length === 0) {
    throw new Error('Debe quedar al menos una categoria.')
  }
  return setCategorias(evento, next)
}

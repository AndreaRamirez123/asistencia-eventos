import QRCode from 'qrcode'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

const COLLECTION_NAME = 'eventoAsistentes'

function createQrToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function buildQrPayload(attendee, qrToken, source) {
  const qrValue = JSON.stringify({
    event: 'evento-principal',
    attendee: attendee.email || attendee.documentId,
    token: qrToken,
    source,
  })

  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    width: 320,
    margin: 2,
    color: { dark: '#13212d', light: '#fffaf1' },
  })

  return { qrValue, qrDataUrl }
}

export function normalizeDocumentId(value) {
  return String(value || '')
    .replace(/[\s.\-_,;:/\\]/g, '')
    .toUpperCase()
}

function normalizeAttendee(payload) {
  const surveyAnswers =
    payload.surveyAnswers && typeof payload.surveyAnswers === 'object'
      ? payload.surveyAnswers
      : {}

  return {
    fullName: String(payload.fullName || '').trim(),
    documentId: normalizeDocumentId(payload.documentId),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: String(payload.phone || '').replace(/\s+/g, ''),
    organization: String(payload.organization || '').trim(),
    attendeeType: String(payload.attendeeType || 'general').trim(),
    notes: String(payload.notes || '').trim(),
    hasFaceConsent: Boolean(payload.hasFaceConsent),
    status: String(payload.status || 'approved').trim(),
    source: String(payload.source || 'admin-panel').trim(),
    empresaId: String(payload.empresaId || '').trim(),
    eventoId: String(payload.eventoId || '').trim(),
    surveyAnswers,
  }
}

function validateAttendee(attendee) {
  const errors = []
  if (!attendee.fullName) errors.push('El nombre completo es obligatorio.')
  if (!attendee.documentId) errors.push('El documento es obligatorio.')
  if (!attendee.phone) errors.push('El telefono es obligatorio.')
  return errors
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
    updatedAt: toIsoDate(data.updatedAt),
    checkedInAt: toIsoDate(data.checkedInAt),
  }
}

function ensureFirestore() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase no esta configurado. Verifica las credenciales en .env.local.')
  }
}

export async function listAttendees() {
  ensureFirestore()
  const attendeesRef = collection(db, COLLECTION_NAME)
  const q = query(attendeesRef, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(mapDoc)
}

export function subscribeToAttendees(onChange, onError) {
  ensureFirestore()
  const attendeesRef = collection(db, COLLECTION_NAME)
  const q = query(attendeesRef, orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(mapDoc)),
    (error) => {
      if (onError) onError(error)
    },
  )
}

export async function registerAttendee(payload) {
  ensureFirestore()
  const attendee = normalizeAttendee(payload)

  if (attendee.source === 'public-registration') {
    attendee.status = 'pre-registered'
  }

  const errors = validateAttendee(attendee)
  if (errors.length > 0) {
    const error = new Error(errors.join(' '))
    error.validations = errors
    throw error
  }

  const attendeesRef = collection(db, COLLECTION_NAME)

  const duplicateQuery = query(attendeesRef, where('documentId', '==', attendee.documentId))
  const duplicateSnap = await getDocs(duplicateQuery)
  if (!duplicateSnap.empty) {
    const error = new Error(
      'Ya existe un asistente registrado con este numero de documento.',
    )
    error.validations = ['Documento duplicado.']
    throw error
  }

  const qrToken = createQrToken()
  const { qrValue, qrDataUrl } = await buildQrPayload(attendee, qrToken, attendee.source)

  const record = {
    ...attendee,
    qrToken,
    qrValue,
    createdAt: serverTimestamp(),
  }

  const docRef = await addDoc(attendeesRef, record)

  return {
    item: {
      id: docRef.id,
      ...attendee,
      qrToken,
      qrValue,
      createdAt: new Date().toISOString(),
    },
    qrDataUrl,
  }
}

export async function updateAttendee(id, payload) {
  ensureFirestore()
  const attendee = normalizeAttendee(payload)
  const errors = validateAttendee(attendee)
  if (errors.length > 0) {
    const error = new Error(errors.join(' '))
    error.validations = errors
    throw error
  }

  const ref = doc(db, COLLECTION_NAME, id)
  const update = { ...attendee, updatedAt: serverTimestamp() }
  await updateDoc(ref, update)

  return {
    id,
    ...attendee,
    updatedAt: new Date().toISOString(),
  }
}

export async function updateAttendeeStatus(id, status) {
  ensureFirestore()
  const ref = doc(db, COLLECTION_NAME, id)
  const update = { status, updatedAt: serverTimestamp() }
  await updateDoc(ref, update)
  return { id, status, updatedAt: new Date().toISOString() }
}

export async function bulkApproveAttendees(attendeeIds) {
  ensureFirestore()
  if (!attendeeIds || attendeeIds.length === 0) {
    return { updated: 0 }
  }

  // Firestore batch soporta maximo 500 operaciones por batch
  const chunks = []
  for (let i = 0; i < attendeeIds.length; i += 450) {
    chunks.push(attendeeIds.slice(i, i + 450))
  }

  let updated = 0
  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const id of chunk) {
      const ref = doc(db, COLLECTION_NAME, id)
      batch.update(ref, {
        status: 'approved',
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    updated += chunk.length
  }

  return { updated }
}

export async function deleteAttendee(id) {
  ensureFirestore()
  const ref = doc(db, COLLECTION_NAME, id)
  await deleteDoc(ref)
  return { id }
}

export function isAttendeeOrphan(attendee) {
  if (!attendee.empresaId || !attendee.eventoId) return true
  const normalizedDoc = normalizeDocumentId(attendee.documentId)
  if (normalizedDoc && normalizedDoc !== attendee.documentId) return true
  return false
}

export async function migrateOrphanAttendees({ empresaId, eventoId }) {
  ensureFirestore()
  if (!empresaId || !eventoId) {
    throw new Error('Se requiere empresaId y eventoId para migrar.')
  }

  const attendeesRef = collection(db, COLLECTION_NAME)
  const snap = await getDocs(attendeesRef)

  let migrated = 0
  let skipped = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const updates = {}

    if (!data.empresaId) updates.empresaId = empresaId
    if (!data.eventoId) updates.eventoId = eventoId

    // Normalizar documentId si aun no esta normalizado
    const normalizedDoc = normalizeDocumentId(data.documentId)
    if (normalizedDoc && normalizedDoc !== data.documentId) {
      updates.documentId = normalizedDoc
    }

    if (Object.keys(updates).length === 0) {
      skipped += 1
      continue
    }

    updates.updatedAt = serverTimestamp()
    await updateDoc(docSnap.ref, updates)
    migrated += 1
  }

  return { migrated, skipped, total: snap.docs.length }
}

export async function performCheckin({
  qrToken,
  documentId,
  accessPoint,
  checkedInBy = '',
  checkedInByName = '',
}) {
  ensureFirestore()

  const cleanQrToken = String(qrToken || '').trim()
  const cleanDocumentId = normalizeDocumentId(documentId)

  if (!cleanQrToken && !cleanDocumentId) {
    return {
      status: 'invalid',
      message: 'Debes enviar un token QR o un numero de documento.',
    }
  }

  const attendeesRef = collection(db, COLLECTION_NAME)
  const field = cleanQrToken ? 'qrToken' : 'documentId'
  const value = cleanQrToken || cleanDocumentId
  const q = query(attendeesRef, where(field, '==', value))
  const snap = await getDocs(q)

  if (snap.empty) {
    return {
      status: 'not-found',
      message: `No se encontro ningun asistente con ${field}: "${value}". Verifica el valor o usa el documento del asistente.`,
    }
  }

  const docSnap = snap.docs[0]
  const current = mapDoc(docSnap)

  if (current.status === 'checked-in') {
    return {
      status: 'duplicate',
      message: 'Este asistente ya hizo check-in.',
      item: current,
    }
  }

  if (current.status !== 'approved') {
    return {
      status: 'not-approved',
      message:
        'El asistente todavia no esta aprobado. Debe ser aprobado desde el panel admin antes del ingreso.',
      item: current,
    }
  }

  const update = {
    status: 'checked-in',
    checkedInAt: serverTimestamp(),
    checkinPoint: accessPoint || 'general',
    checkedInBy: checkedInBy || '',
    checkedInByName: checkedInByName || '',
    updatedAt: serverTimestamp(),
  }

  await updateDoc(docSnap.ref, update)

  return {
    status: 'ok',
    message: 'Check-in registrado correctamente.',
    item: {
      ...current,
      status: 'checked-in',
      checkedInAt: new Date().toISOString(),
      checkinPoint: update.checkinPoint,
      checkedInBy: update.checkedInBy,
      checkedInByName: update.checkedInByName,
      updatedAt: new Date().toISOString(),
    },
  }
}

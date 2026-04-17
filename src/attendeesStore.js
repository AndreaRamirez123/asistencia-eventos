import QRCode from 'qrcode'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
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

function normalizeAttendee(payload) {
  return {
    fullName: String(payload.fullName || '').trim(),
    documentId: String(payload.documentId || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: String(payload.phone || '').trim(),
    organization: String(payload.organization || '').trim(),
    attendeeType: String(payload.attendeeType || 'general').trim(),
    notes: String(payload.notes || '').trim(),
    hasFaceConsent: Boolean(payload.hasFaceConsent),
    status: String(payload.status || 'approved').trim(),
    source: String(payload.source || 'admin-panel').trim(),
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

  const qrToken = createQrToken()
  const { qrValue, qrDataUrl } = await buildQrPayload(attendee, qrToken, attendee.source)

  const record = {
    ...attendee,
    qrToken,
    qrValue,
    createdAt: serverTimestamp(),
  }

  const attendeesRef = collection(db, COLLECTION_NAME)
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

export async function deleteAttendee(id) {
  ensureFirestore()
  const ref = doc(db, COLLECTION_NAME, id)
  await deleteDoc(ref)
  return { id }
}

export async function performCheckin({ qrToken, documentId, accessPoint }) {
  ensureFirestore()
  if (!qrToken && !documentId) {
    return {
      status: 'invalid',
      message: 'Debes enviar un token QR o un numero de documento.',
    }
  }

  const attendeesRef = collection(db, COLLECTION_NAME)
  const field = qrToken ? 'qrToken' : 'documentId'
  const value = qrToken || documentId
  const q = query(attendeesRef, where(field, '==', value))
  const snap = await getDocs(q)

  if (snap.empty) {
    return {
      status: 'not-found',
      message: 'QR no reconocido. Verifica el registro del asistente.',
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
      updatedAt: new Date().toISOString(),
    },
  }
}

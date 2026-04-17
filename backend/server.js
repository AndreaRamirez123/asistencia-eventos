const express = require('express')
const cors = require('cors')
const QRCode = require('qrcode')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = Number(process.env.PORT) || 4000
const DATA_DIR = path.join(__dirname, 'data')
const ATTENDEES_FILE = path.join(DATA_DIR, 'attendees.json')

const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const STAFF_USER = process.env.STAFF_USER || 'staff'
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'staff123'

const sessions = new Map()

function createSessionToken(user) {
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, {
    username: user.username,
    role: user.role,
    createdAt: new Date().toISOString(),
  })
  return token
}

function getSessionFromRequest(request) {
  const header = request.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return null
  }
  const session = sessions.get(token)
  return session ? { token, ...session } : null
}

function requireAuth(request, response, next) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return response.status(401).json({ error: 'Autenticacion requerida.' })
  }
  request.session = session
  return next()
}

function requireRole(allowedRoles) {
  return (request, response, next) => {
    const session = getSessionFromRequest(request)
    if (!session) {
      return response.status(401).json({ error: 'Autenticacion requerida.' })
    }
    if (!allowedRoles.includes(session.role)) {
      return response.status(403).json({ error: 'Rol sin permiso suficiente.' })
    }
    request.session = session
    return next()
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  if (!fs.existsSync(ATTENDEES_FILE)) {
    fs.writeFileSync(ATTENDEES_FILE, '[]', 'utf8')
  }
}

function loadAttendeesFromDisk() {
  ensureDataFile()

  try {
    const raw = fs.readFileSync(ATTENDEES_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('No fue posible leer attendees.json. Se iniciara con lista vacia.', error)
    return []
  }
}

function saveAttendeesToDisk(items) {
  ensureDataFile()
  fs.writeFileSync(ATTENDEES_FILE, JSON.stringify(items, null, 2), 'utf8')
}

const attendees = loadAttendeesFromDisk()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  }),
)
app.use(express.json({ limit: '1mb' }))

function createQrToken() {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeText(value) {
  return String(value || '').trim()
}

function buildAttendeePayload(payload = {}) {
  return {
    fullName: normalizeText(payload.fullName),
    documentId: normalizeText(payload.documentId),
    email: normalizeText(payload.email).toLowerCase(),
    phone: normalizeText(payload.phone),
    organization: normalizeText(payload.organization),
    attendeeType: normalizeText(payload.attendeeType) || 'general',
    notes: normalizeText(payload.notes),
    hasFaceConsent: Boolean(payload.hasFaceConsent),
    status: normalizeText(payload.status) || 'approved',
    source: normalizeText(payload.source) || 'admin-panel',
  }
}

function validateAttendee(attendee) {
  const errors = []

  if (!attendee.fullName) {
    errors.push('El nombre completo es obligatorio.')
  }

  if (!attendee.documentId) {
    errors.push('El documento es obligatorio.')
  }

  if (!attendee.phone) {
    errors.push('El telefono es obligatorio.')
  }

  return errors
}

function findAttendeeIndex(id) {
  return attendees.findIndex((item) => item.id === id)
}

async function createQrPayload(attendee, qrToken) {
  const qrValue = JSON.stringify({
    event: process.env.EVENT_CODE || 'evento-principal',
    attendee: attendee.email || attendee.documentId,
    token: qrToken,
    source: attendee.source,
  })

  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    width: 320,
    margin: 2,
    color: {
      dark: '#13212d',
      light: '#fffaf1',
    },
  })

  return { qrValue, qrDataUrl }
}

app.post('/api/auth/login', (request, response) => {
  const username = normalizeText(request.body.username)
  const password = String(request.body.password || '')

  let role = ''
  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    role = 'admin'
  } else if (username === STAFF_USER && password === STAFF_PASSWORD) {
    role = 'staff'
  }

  if (!role) {
    return response.status(401).json({ error: 'Credenciales invalidas.' })
  }

  const token = createSessionToken({ username, role })
  return response.json({
    token,
    user: { username, role },
  })
})

app.post('/api/auth/logout', (request, response) => {
  const session = getSessionFromRequest(request)
  if (session) {
    sessions.delete(session.token)
  }
  return response.json({ message: 'Sesion cerrada.' })
})

app.get('/api/auth/me', (request, response) => {
  const session = getSessionFromRequest(request)
  if (!session) {
    return response.status(401).json({ error: 'Sin sesion activa.' })
  }
  return response.json({
    user: { username: session.username, role: session.role },
  })
})

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'admin-backend',
    timestamp: new Date().toISOString(),
    attendeesStored: attendees.length,
  })
})

app.get('/api/meta', (_request, response) => {
  response.json({
    appName: 'asistencia-evento-backend',
    mode: 'file-store',
    endpoints: [
      'GET /health',
      'GET /api/meta',
      'GET /api/attendees',
      'POST /api/attendees/register',
      'PUT /api/attendees/:id',
      'PATCH /api/attendees/:id/status',
      'DELETE /api/attendees/:id',
      'POST /api/qr/generate',
      'POST /api/checkin',
    ],
  })
})

app.get('/api/attendees', requireAuth, (_request, response) => {
  response.json({
    items: attendees,
    total: attendees.length,
  })
})

app.post('/api/qr/generate', async (request, response) => {
  try {
    const attendee = buildAttendeePayload(request.body)
    const qrToken = createQrToken()
    const qr = await createQrPayload(attendee, qrToken)

    response.status(201).json({
      qrToken,
      ...qr,
    })
  } catch (error) {
    response.status(500).json({
      error: 'No fue posible generar el QR.',
      detail: error.message,
    })
  }
})

app.post('/api/attendees/register', async (request, response) => {
  try {
    const attendee = buildAttendeePayload(request.body)
    const session = getSessionFromRequest(request)

    if (attendee.source !== 'public-registration' && !session) {
      return response.status(401).json({ error: 'Autenticacion requerida para registrar desde admin.' })
    }

    if (attendee.source === 'public-registration') {
      attendee.status = 'pre-registered'
    }

    const errors = validateAttendee(attendee)

    if (errors.length > 0) {
      return response.status(400).json({
        error: 'Datos invalidos.',
        validations: errors,
      })
    }

    const qrToken = createQrToken()
    const qr = await createQrPayload(attendee, qrToken)

    const record = {
      id: `att-${Date.now()}`,
      ...attendee,
      qrToken,
      qrValue: qr.qrValue,
      createdAt: new Date().toISOString(),
    }

    attendees.unshift(record)
    saveAttendeesToDisk(attendees)

    return response.status(201).json({
      message: 'Asistente registrado correctamente.',
      item: record,
      qrDataUrl: qr.qrDataUrl,
    })
  } catch (error) {
    return response.status(500).json({
      error: 'No fue posible registrar el asistente.',
      detail: error.message,
    })
  }
})

app.put('/api/attendees/:id', requireAuth, (request, response) => {
  try {
    const attendeeIndex = findAttendeeIndex(request.params.id)

    if (attendeeIndex === -1) {
      return response.status(404).json({
        error: 'Asistente no encontrado.',
      })
    }

    const currentRecord = attendees[attendeeIndex]
    const attendee = buildAttendeePayload({
      ...currentRecord,
      ...request.body,
      qrToken: currentRecord.qrToken,
    })
    const errors = validateAttendee(attendee)

    if (errors.length > 0) {
      return response.status(400).json({
        error: 'Datos invalidos.',
        validations: errors,
      })
    }

    const updatedRecord = {
      ...currentRecord,
      ...attendee,
      updatedAt: new Date().toISOString(),
    }

    attendees[attendeeIndex] = updatedRecord
    saveAttendeesToDisk(attendees)

    return response.json({
      message: 'Asistente actualizado correctamente.',
      item: updatedRecord,
    })
  } catch (error) {
    return response.status(500).json({
      error: 'No fue posible actualizar el asistente.',
      detail: error.message,
    })
  }
})

app.patch('/api/attendees/:id/status', requireRole(['admin']), (request, response) => {
  try {
    const attendeeIndex = findAttendeeIndex(request.params.id)

    if (attendeeIndex === -1) {
      return response.status(404).json({
        error: 'Asistente no encontrado.',
      })
    }

    const nextStatus = normalizeText(request.body.status)

    if (!nextStatus) {
      return response.status(400).json({
        error: 'El estado es obligatorio.',
      })
    }

    const currentRecord = attendees[attendeeIndex]
    const updatedRecord = {
      ...currentRecord,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    }

    attendees[attendeeIndex] = updatedRecord
    saveAttendeesToDisk(attendees)

    return response.json({
      message: 'Estado actualizado correctamente.',
      item: updatedRecord,
    })
  } catch (error) {
    return response.status(500).json({
      error: 'No fue posible actualizar el estado del asistente.',
      detail: error.message,
    })
  }
})

app.post('/api/checkin', requireRole(['admin', 'staff']), (request, response) => {
  try {
    const qrToken = normalizeText(request.body.qrToken)
    const documentId = normalizeText(request.body.documentId)
    const accessPoint = normalizeText(request.body.accessPoint) || 'general'

    if (!qrToken && !documentId) {
      return response.status(400).json({
        status: 'invalid',
        error: 'Debes enviar un token QR o un numero de documento.',
      })
    }

    const attendeeIndex = attendees.findIndex((item) => {
      if (qrToken && item.qrToken === qrToken) {
        return true
      }
      if (documentId && item.documentId === documentId) {
        return true
      }
      return false
    })

    if (attendeeIndex === -1) {
      return response.status(404).json({
        status: 'not-found',
        error: 'QR no reconocido. Verifica el registro del asistente.',
      })
    }

    const currentRecord = attendees[attendeeIndex]

    if (currentRecord.status === 'checked-in') {
      return response.status(409).json({
        status: 'duplicate',
        error: 'Este asistente ya hizo check-in.',
        item: currentRecord,
      })
    }

    if (currentRecord.status !== 'approved') {
      return response.status(403).json({
        status: 'not-approved',
        error:
          'El asistente todavia no esta aprobado. Debe ser aprobado desde el panel admin antes del ingreso.',
        item: currentRecord,
      })
    }

    const updatedRecord = {
      ...currentRecord,
      status: 'checked-in',
      checkedInAt: new Date().toISOString(),
      checkinPoint: accessPoint,
      updatedAt: new Date().toISOString(),
    }

    attendees[attendeeIndex] = updatedRecord
    saveAttendeesToDisk(attendees)

    return response.json({
      status: 'ok',
      message: 'Check-in registrado correctamente.',
      item: updatedRecord,
    })
  } catch (error) {
    return response.status(500).json({
      status: 'error',
      error: 'No fue posible registrar el check-in.',
      detail: error.message,
    })
  }
})

app.delete('/api/attendees/:id', requireRole(['admin']), (request, response) => {
  try {
    const attendeeIndex = findAttendeeIndex(request.params.id)

    if (attendeeIndex === -1) {
      return response.status(404).json({
        error: 'Asistente no encontrado.',
      })
    }

    const [removedItem] = attendees.splice(attendeeIndex, 1)
    saveAttendeesToDisk(attendees)

    return response.json({
      message: 'Asistente eliminado correctamente.',
      item: removedItem,
    })
  } catch (error) {
    return response.status(500).json({
      error: 'No fue posible eliminar el asistente.',
      detail: error.message,
    })
  }
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend admin escuchando en http://localhost:${PORT}`)
  })
}

module.exports = {
  app,
  attendees,
  loadAttendeesFromDisk,
  saveAttendeesToDisk,
  buildAttendeePayload,
  createQrPayload,
  findAttendeeIndex,
  validateAttendee,
}

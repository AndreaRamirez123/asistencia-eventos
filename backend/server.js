const express = require('express')
const cors = require('cors')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = Number(process.env.PORT) || 4000
const DATA_DIR = path.join(__dirname, 'data')
const ATTENDEES_FILE = path.join(DATA_DIR, 'attendees.json')

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
    ],
  })
})

app.get('/api/attendees', (_request, response) => {
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

app.put('/api/attendees/:id', (request, response) => {
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

app.patch('/api/attendees/:id/status', (request, response) => {
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

app.delete('/api/attendees/:id', (request, response) => {
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

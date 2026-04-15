const express = require('express')
const cors = require('cors')
const QRCode = require('qrcode')

const app = express()
const PORT = Number(process.env.PORT) || 4000

const attendees = []

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
    attendeesInMemory: attendees.length,
  })
})

app.get('/api/meta', (_request, response) => {
  response.json({
    appName: 'asistencia-evento-backend',
    mode: 'memory-store',
    endpoints: [
      'GET /health',
      'GET /api/meta',
      'GET /api/attendees',
      'POST /api/attendees/register',
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend admin escuchando en http://localhost:${PORT}`)
  })
}

module.exports = {
  app,
  attendees,
  buildAttendeePayload,
  createQrPayload,
  validateAttendee,
}

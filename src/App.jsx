import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const metrics = [
  { value: '1,248', label: 'registros aprobados' },
  { value: '834', label: 'check-ins confirmados' },
  { value: '04', label: 'puntos de acceso activos' },
  { value: '17', label: 'casos pendientes' },
]

const modules = [
  {
    title: 'Registro asistido por staff',
    description:
      'El administrador o su equipo pueden registrar asistentes manualmente desde mesa de apoyo o backoffice.',
    detail: 'Util para casos VIP, prensa, invitados de ultima hora o correcciones.',
  },
  {
    title: 'Control de accesos',
    description:
      'Vista central para coordinar scanners, validar incidencias y supervisar ingresos por punto de acceso.',
    detail: 'Permite tomar decisiones rapidas durante el evento.',
  },
  {
    title: 'Validaciones especiales',
    description:
      'Casos de QR duplicado, busqueda manual, cambios de categoria y autorizaciones excepcionales.',
    detail: 'Todo operado desde la cuenta admin o supervisores.',
  },
  {
    title: 'Pantalla operativa',
    description:
      'Resumen en tiempo real para aforo, flujo, alertas y estado general del evento.',
    detail: 'Ideal para coordinacion de produccion y recepcion.',
  },
]

const adminLanes = [
  {
    name: 'Admin principal',
    action: 'Configura el evento, controla accesos, monitorea metricas y toma decisiones operativas.',
  },
  {
    name: 'Supervisor de ingreso',
    action: 'Gestiona filas, valida excepciones y coordina el staff de scanners.',
  },
  {
    name: 'Mesa de soporte',
    action: 'Registra asistentes manualmente, corrige datos y resuelve casos sin QR.',
  },
]

const roadmap = [
  'Panel admin con autenticacion y roles.',
  'Registro manual y edicion de asistentes.',
  'Scanner QR y validacion anti-duplicado.',
  'Dashboard en vivo con incidencias y aforo.',
  'Reportes, exportaciones y mejoras avanzadas.',
]

const liveFeed = [
  { time: '08:41', person: 'Valentina Perez', status: 'Ingreso validado', point: 'Entrada norte' },
  { time: '08:43', person: 'Carlos Mendez', status: 'QR duplicado bloqueado', point: 'Acceso VIP' },
  { time: '08:44', person: 'Sandra Rojas', status: 'Registro manual por admin', point: 'Mesa 2' },
  { time: '08:45', person: 'Equipo Prensa', status: '04 acreditaciones aprobadas', point: 'Backstage' },
]

const incidents = [
  '2 asistentes sin QR enviados a mesa de soporte.',
  '1 duplicado detectado y bloqueado en acceso VIP.',
  '1 cambio de categoria pendiente de aprobacion.',
]

const initialForm = {
  fullName: '',
  documentId: '',
  email: '',
  phone: '',
  organization: '',
  attendeeType: 'general',
  notes: '',
  hasFaceConsent: false,
}

function createQrToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function buildAttendeePayload(form, qrToken) {
  return {
    fullName: form.fullName.trim(),
    documentId: form.documentId.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    organization: form.organization.trim(),
    attendeeType: form.attendeeType,
    notes: form.notes.trim(),
    hasFaceConsent: form.hasFaceConsent,
    qrToken,
    status: 'approved',
    source: 'admin-panel',
  }
}

async function createLocalSubmission(attendee, qrToken) {
  const qrValue = JSON.stringify({
    event: 'evento-principal',
    attendee: attendee.email || attendee.documentId,
    token: qrToken,
    source: 'admin',
  })

  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    width: 320,
    margin: 2,
    color: {
      dark: '#13212d',
      light: '#fffaf1',
    },
  })

  return {
    recordId: `preview-${qrToken.slice(0, 8)}`,
    qrDataUrl,
    mode: 'preview',
    attendee,
  }
}

function formatDate(value) {
  if (!value) {
    return 'Pendiente'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Pendiente'
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submission, setSubmission] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [backendStatus, setBackendStatus] = useState('checking')
  const [attendees, setAttendees] = useState([])
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false)

  const loadAttendees = async ({ silent = false } = {}) => {
    if (backendStatus !== 'online') {
      setAttendees([])
      return
    }

    if (!silent) {
      setIsLoadingAttendees(true)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendees`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No fue posible consultar asistentes.')
      }

      setAttendees(data.items || [])
    } catch (error) {
      console.error(error)
    } finally {
      if (!silent) {
        setIsLoadingAttendees(false)
      }
    }
  }

  useEffect(() => {
    let isMounted = true

    async function checkBackend() {
      try {
        const response = await fetch(`${API_BASE_URL}/health`)
        if (!response.ok) {
          throw new Error('Backend no disponible')
        }

        if (isMounted) {
          setBackendStatus('online')
        }
      } catch {
        if (isMounted) {
          setBackendStatus('offline')
        }
      }
    }

    checkBackend()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (backendStatus === 'online') {
      loadAttendees()
    } else if (backendStatus === 'offline') {
      setAttendees([])
    }
  }, [backendStatus])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const qrToken = createQrToken()
      const attendee = buildAttendeePayload(form, qrToken)

      if (backendStatus === 'online') {
        const response = await fetch(`${API_BASE_URL}/api/attendees/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attendee),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.validations?.join(' ') || data.error || 'No fue posible registrar.')
        }

        setSubmission({
          recordId: data.item.id,
          qrDataUrl: data.qrDataUrl,
          mode: 'backend',
          attendee: data.item,
        })
        setAttendees((current) => [data.item, ...current])
        setForm(initialForm)
        return
      }

      if (isFirebaseConfigured) {
        const qrValue = JSON.stringify({
          event: 'evento-principal',
          attendee: attendee.email || attendee.documentId,
          token: qrToken,
          source: 'admin',
        })
        const qrDataUrl = await QRCode.toDataURL(qrValue, {
          width: 320,
          margin: 2,
          color: {
            dark: '#13212d',
            light: '#fffaf1',
          },
        })

        const docRef = await addDoc(collection(db, 'attendees'), {
          ...attendee,
          qrValue,
          createdAt: serverTimestamp(),
        })

        setSubmission({
          recordId: docRef.id,
          qrDataUrl,
          mode: 'firestore',
          attendee,
        })
        setForm(initialForm)
        return
      }

      setSubmission(await createLocalSubmission(attendee, qrToken))
      setForm(initialForm)
    } catch (error) {
      setErrorMessage(
        error.message ||
          'No fue posible guardar el registro desde el panel admin. Revisa el backend o Firebase.',
      )
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const modeLabel =
    backendStatus === 'online'
      ? 'backend activo'
      : isFirebaseConfigured
        ? 'guardado en Firestore'
        : 'modo preview local'

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Panel administrativo del evento</p>
          <h1>Centro de control para registro, accesos, soporte e incidencias.</h1>
          <p className="hero-text">
            Esta vista queda orientada al admin para operar el evento, registrar personas
            manualmente, supervisar entradas y resolver casos especiales en tiempo real.
          </p>

          <div className="hero-actions">
            <a href="#registro-admin" className="primary-action">
              Registrar desde admin
            </a>
            <a href="#asistentes" className="secondary-action">
              Ver asistentes
            </a>
          </div>
        </div>

        <section className="command-board" aria-label="Resumen operativo">
          <div className="board-header">
            <span className="board-kicker">Control en vivo</span>
            <strong>Consola admin</strong>
          </div>

          <div className="board-grid">
            {metrics.map((item) => (
              <article key={item.label} className="metric-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>

          <div className="status-strip">
            <span className={`status-pill ${backendStatus === 'online' ? 'online' : 'alert'}`}>
              {backendStatus === 'checking'
                ? 'Verificando backend...'
                : backendStatus === 'online'
                  ? 'Backend admin conectado'
                  : 'Backend no disponible'}
            </span>
            <span className="status-pill standby">
              {isFirebaseConfigured ? 'Firebase listo' : 'Firebase en preview'}
            </span>
            <span className="status-pill alert">{attendees.length} registros cargados</span>
          </div>
        </section>
      </header>

      <main className="content-grid">
        <section id="registro-admin" className="panel registration-panel">
          <div className="panel-heading">
            <p className="eyebrow">Alta manual</p>
            <h2>Registro directo desde el panel del administrador</h2>
            <p className="section-copy">
              Este modulo sirve para que el admin o la mesa de soporte creen asistentes, corrijan
              datos y generen QR en el momento.
            </p>
          </div>

          <div className="registration-layout">
            <form className="attendee-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Nombre completo</span>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Ej. Laura Martinez"
                  required
                />
              </label>

              <label className="field">
                <span>Documento</span>
                <input
                  name="documentId"
                  value={form.documentId}
                  onChange={handleChange}
                  placeholder="Ej. 1032456789"
                  required
                />
              </label>

              <label className="field">
                <span>Correo electronico</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="correo@evento.com"
                />
              </label>

              <label className="field">
                <span>Telefono</span>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Ej. 3001234567"
                  required
                />
              </label>

              <label className="field">
                <span>Empresa o institucion</span>
                <input
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="Ej. Universidad o empresa"
                />
              </label>

              <label className="field">
                <span>Categoria</span>
                <select name="attendeeType" value={form.attendeeType} onChange={handleChange}>
                  <option value="general">General</option>
                  <option value="vip">VIP</option>
                  <option value="speaker">Speaker</option>
                  <option value="staff">Staff</option>
                  <option value="press">Prensa</option>
                </select>
              </label>

              <label className="field field-wide">
                <span>Notas internas</span>
                <input
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Ej. invitado de gerencia, requiere acreditacion especial"
                />
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="hasFaceConsent"
                  checked={form.hasFaceConsent}
                  onChange={handleChange}
                />
                <span>Marcar si el asistente autorizo reconocimiento facial opcional.</span>
              </label>

              {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

              <button type="submit" className="submit-button" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando desde admin...' : 'Crear registro y QR'}
              </button>

              <p className="helper-text">Estado actual: {modeLabel}</p>
            </form>

            <aside className="preview-card">
              <p className="eyebrow">Resultado operativo</p>
              {submission ? (
                <>
                  <h3>Asistente aprobado</h3>
                  <p className="preview-copy">
                    {submission.attendee.fullName} fue creado desde admin con estado{' '}
                    <strong>{submission.attendee.status}</strong>.
                  </p>
                  <img
                    className="qr-preview"
                    src={submission.qrDataUrl}
                    alt={`QR de ${submission.attendee.fullName}`}
                  />
                  <div className="preview-meta">
                    <span>ID: {submission.recordId}</span>
                    <span>
                      Modo:{' '}
                      {submission.mode === 'backend'
                        ? 'Backend API'
                        : submission.mode === 'firestore'
                          ? 'Firestore activo'
                          : 'Preview local'}
                    </span>
                    <span>Categoria: {submission.attendee.attendeeType}</span>
                  </div>
                </>
              ) : (
                <>
                  <h3>QR y trazabilidad</h3>
                  <p className="preview-copy">
                    Cuando el admin cree un asistente, aqui aparecera su QR junto con el estado del
                    registro.
                  </p>
                  <div className="qr-placeholder" aria-hidden="true">
                    <span>ADMIN</span>
                  </div>
                </>
              )}
            </aside>
          </div>
        </section>

        <section id="asistentes" className="panel">
          <div className="panel-heading table-heading">
            <div>
              <p className="eyebrow">Control de asistentes</p>
              <h2>Listado operativo del backend</h2>
              <p className="section-copy">
                Este bloque muestra los registros creados desde el panel admin mientras el backend
                este activo.
              </p>
            </div>

            <button
              type="button"
              className="ghost-action"
              onClick={() => loadAttendees()}
              disabled={backendStatus !== 'online' || isLoadingAttendees}
            >
              {isLoadingAttendees ? 'Actualizando...' : 'Actualizar lista'}
            </button>
          </div>

          {backendStatus !== 'online' ? (
            <div className="empty-state">
              <h3>Backend no conectado</h3>
              <p>
                Inicia `backend` con `npm start` para ver aqui los asistentes reales creados desde
                la API.
              </p>
            </div>
          ) : attendees.length === 0 ? (
            <div className="empty-state">
              <h3>Sin asistentes registrados todavia</h3>
              <p>
                Cuando el admin cree el primer registro, aparecera aqui con documento, categoria,
                estado y fecha de creacion.
              </p>
            </div>
          ) : (
            <div className="attendee-table" role="table" aria-label="Listado de asistentes">
              <div className="attendee-row attendee-head" role="row">
                <span>Nombre</span>
                <span>Documento</span>
                <span>Categoria</span>
                <span>Estado</span>
                <span>Creado</span>
              </div>

              {attendees.map((item) => (
                <div key={item.id} className="attendee-row" role="row">
                  <span>{item.fullName || 'Sin nombre'}</span>
                  <span>{item.documentId || 'Sin documento'}</span>
                  <span>{item.attendeeType || 'general'}</span>
                  <span>{item.status || 'pendiente'}</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="operacion" className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Modulos admin</p>
            <h2>Bloques que necesita el administrador para operar el evento</h2>
          </div>

          <div className="modules-grid">
            {modules.map((module) => (
              <article key={module.title} className="module-card">
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <small>{module.detail}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel split-panel">
          <div>
            <div className="panel-heading">
              <p className="eyebrow">Roles de operacion</p>
              <h2>Quien usa este panel y para que</h2>
            </div>

            <div className="lane-list">
              {adminLanes.map((lane) => (
                <article key={lane.name} className="lane-card">
                  <strong>{lane.name}</strong>
                  <p>{lane.action}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="sidebar-card">
            <p className="eyebrow">Colecciones sugeridas</p>
            <ul className="tag-list">
              <li>events</li>
              <li>attendees</li>
              <li>checkins</li>
              <li>users</li>
              <li>devices</li>
              <li>incidents</li>
            </ul>
            <p className="sidebar-note">
              El admin deberia trabajar con roles y permisos para distinguir mesa de soporte,
              scanner, supervisor y administrador principal.
            </p>
          </aside>
        </section>

        <section className="panel split-panel">
          <div id="roadmap">
            <div className="panel-heading">
              <p className="eyebrow">Ruta recomendada</p>
              <h2>Prioridades del panel administrativo</h2>
            </div>

            <ol className="roadmap-list">
              {roadmap.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <div className="priority-card">
            <h3>Incidencias actuales</h3>
            {incidents.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <p className="eyebrow">Actividad del evento</p>
            <h2>Bitacora en vivo para el administrador</h2>
          </div>

          <div className="feed-table" role="table" aria-label="Actividad en vivo">
            <div className="feed-row feed-head" role="row">
              <span>Hora</span>
              <span>Registro</span>
              <span>Estado</span>
              <span>Punto</span>
            </div>
            {liveFeed.map((item) => (
              <div key={`${item.time}-${item.person}`} className="feed-row" role="row">
                <span>{item.time}</span>
                <span>{item.person}</span>
                <span>{item.status}</span>
                <span>{item.point}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App

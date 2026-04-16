import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'
import ActivitySection from './components/ActivitySection'
import AdminHero from './components/AdminHero'
import AdminRegistrationPanel from './components/AdminRegistrationPanel'
import AttendeeTableSection from './components/AttendeeTableSection'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import ModulesSection from './components/ModulesSection'
import OperationsSection from './components/OperationsSection'
import PublicRegistrationPage from './components/PublicRegistrationPage'
import RoadmapSection from './components/RoadmapSection'
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

const initialPublicForm = {
  fullName: '',
  documentId: '',
  email: '',
  phone: '',
  organization: '',
  attendeeType: 'general',
  hasFaceConsent: false,
}

const initialFilters = {
  query: '',
  attendeeType: 'all',
  status: 'all',
}

function getCurrentView() {
  const path = window.location.pathname.toLowerCase()

  if (path === '/registro') {
    return 'public'
  }

  if (path === '/admin') {
    return 'admin'
  }

  return 'admin'
}

function createQrToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function buildAttendeePayload(form, qrToken, overrides = {}) {
  return {
    fullName: form.fullName.trim(),
    documentId: form.documentId.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    organization: form.organization.trim(),
    attendeeType: form.attendeeType,
    notes: form.notes?.trim?.() || '',
    hasFaceConsent: form.hasFaceConsent,
    qrToken,
    status: overrides.status || 'approved',
    source: overrides.source || 'admin-panel',
  }
}

async function createLocalSubmission(attendee, qrToken, source = 'admin') {
  const qrValue = JSON.stringify({
    event: 'evento-principal',
    attendee: attendee.email || attendee.documentId,
    token: qrToken,
    source,
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

async function parseApiResponse(response) {
  const rawText = await response.text()

  try {
    return rawText ? JSON.parse(rawText) : {}
  } catch {
    if (!response.ok) {
      throw new Error(
        'El backend respondio en un formato inesperado. Reinicia el servidor de Node con npm start.',
      )
    }

    return {}
  }
}

function App() {
  const [currentView, setCurrentView] = useState(getCurrentView)
  const [form, setForm] = useState(initialForm)
  const [publicForm, setPublicForm] = useState(initialPublicForm)
  const [editingAttendeeId, setEditingAttendeeId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublicSubmitting, setIsPublicSubmitting] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState('')
  const [isUpdatingStatusId, setIsUpdatingStatusId] = useState('')
  const [pendingDeleteAttendee, setPendingDeleteAttendee] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [publicSubmission, setPublicSubmission] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [publicErrorMessage, setPublicErrorMessage] = useState('')
  const [backendStatus, setBackendStatus] = useState('checking')
  const [attendees, setAttendees] = useState([])
  const [filters, setFilters] = useState(initialFilters)
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
      const data = await parseApiResponse(response)

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
    const syncView = () => setCurrentView(getCurrentView())

    window.addEventListener('popstate', syncView)

    return () => {
      window.removeEventListener('popstate', syncView)
    }
  }, [])

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
    if (backendStatus === 'online' && currentView === 'admin') {
      loadAttendees()
    } else if (backendStatus === 'offline') {
      setAttendees([])
    }
  }, [backendStatus, currentView])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handlePublicChange = (event) => {
    const { name, value, type, checked } = event.target

    setPublicForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleEdit = (attendee) => {
    setSubmission(null)
    setErrorMessage('')
    setEditingAttendeeId(attendee.id)
    setForm({
      fullName: attendee.fullName || '',
      documentId: attendee.documentId || '',
      email: attendee.email || '',
      phone: attendee.phone || '',
      organization: attendee.organization || '',
      attendeeType: attendee.attendeeType || 'general',
      notes: attendee.notes || '',
      hasFaceConsent: Boolean(attendee.hasFaceConsent),
    })
    window.location.hash = 'registro-admin'
  }

  const handleCancelEdit = () => {
    setEditingAttendeeId('')
    setForm(initialForm)
    setErrorMessage('')
  }

  const handleRequestDelete = (attendee) => {
    setPendingDeleteAttendee(attendee)
  }

  const handleCancelDelete = () => {
    if (isDeletingId) {
      return
    }

    setPendingDeleteAttendee(null)
  }

  const handleStatusAction = async (attendeeId, nextStatus) => {
    if (backendStatus !== 'online') {
      setErrorMessage('La actualizacion de estado solo esta disponible con el backend conectado.')
      return
    }

    setIsUpdatingStatusId(attendeeId)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendees/${attendeeId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await parseApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || 'No fue posible actualizar el estado.')
      }

      setAttendees((current) => current.map((item) => (item.id === attendeeId ? data.item : item)))
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible actualizar el estado.')
      console.error(error)
    } finally {
      setIsUpdatingStatusId('')
    }
  }

  const handleConfirmDelete = async (attendee) => {
    if (backendStatus !== 'online') {
      setErrorMessage('La eliminacion solo esta disponible cuando el backend esta conectado.')
      return
    }

    setIsDeletingId(attendee.id)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendees/${attendee.id}`, {
        method: 'DELETE',
      })
      const data = await parseApiResponse(response)

      if (!response.ok) {
        throw new Error(data.error || 'No fue posible eliminar el asistente.')
      }

      setAttendees((current) => current.filter((item) => item.id !== attendee.id))
      setPendingDeleteAttendee(null)

      if (editingAttendeeId === attendee.id) {
        handleCancelEdit()
      }
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible eliminar el asistente.')
      console.error(error)
    } finally {
      setIsDeletingId('')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const qrToken = createQrToken()
      const attendee = buildAttendeePayload(form, qrToken, {
        source: 'admin-panel',
        status: 'approved',
      })

      if (backendStatus === 'online' && editingAttendeeId) {
        const response = await fetch(`${API_BASE_URL}/api/attendees/${editingAttendeeId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attendee),
        })

        const data = await parseApiResponse(response)

        if (!response.ok) {
          throw new Error(data.validations?.join(' ') || data.error || 'No fue posible actualizar.')
        }

        setAttendees((current) =>
          current.map((item) => (item.id === editingAttendeeId ? data.item : item)),
        )
        setSubmission(null)
        setEditingAttendeeId('')
        setForm(initialForm)
        return
      }

      if (backendStatus === 'online') {
        const response = await fetch(`${API_BASE_URL}/api/attendees/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attendee),
        })

        const data = await parseApiResponse(response)

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
        setEditingAttendeeId('')
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
      setEditingAttendeeId('')
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

  const handlePublicSubmit = async (event) => {
    event.preventDefault()
    setIsPublicSubmitting(true)
    setPublicErrorMessage('')

    try {
      const qrToken = createQrToken()
      const attendee = buildAttendeePayload(publicForm, qrToken, {
        source: 'public-registration',
        status: 'pre-registered',
      })

      if (backendStatus === 'online') {
        const response = await fetch(`${API_BASE_URL}/api/attendees/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attendee),
        })

        const data = await parseApiResponse(response)

        if (!response.ok) {
          throw new Error(data.validations?.join(' ') || data.error || 'No fue posible registrar.')
        }

        setPublicSubmission({
          recordId: data.item.id,
          qrDataUrl: data.qrDataUrl,
          mode: 'backend',
          attendee: data.item,
        })
        setPublicForm(initialPublicForm)
        return
      }

      if (isFirebaseConfigured) {
        const qrValue = JSON.stringify({
          event: 'evento-principal',
          attendee: attendee.email || attendee.documentId,
          token: qrToken,
          source: 'public',
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

        setPublicSubmission({
          recordId: docRef.id,
          qrDataUrl,
          mode: 'firestore',
          attendee,
        })
        setPublicForm(initialPublicForm)
        return
      }

      setPublicSubmission(await createLocalSubmission(attendee, qrToken, 'public'))
      setPublicForm(initialPublicForm)
    } catch (error) {
      setPublicErrorMessage(
        error.message || 'No fue posible completar tu registro. Intenta nuevamente.',
      )
      console.error(error)
    } finally {
      setIsPublicSubmitting(false)
    }
  }

  const modeLabel =
    backendStatus === 'online'
      ? 'backend activo'
      : isFirebaseConfigured
        ? 'guardado en Firestore'
        : 'modo preview local'

  const normalizedQuery = filters.query.trim().toLowerCase()
  const filteredAttendees = attendees.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      item.fullName?.toLowerCase().includes(normalizedQuery) ||
      item.documentId?.toLowerCase().includes(normalizedQuery) ||
      item.email?.toLowerCase().includes(normalizedQuery)

    const matchesType =
      filters.attendeeType === 'all' || item.attendeeType === filters.attendeeType

    const matchesStatus = filters.status === 'all' || item.status === filters.status

    return matchesQuery && matchesType && matchesStatus
  })

  if (currentView === 'public') {
    return (
      <PublicRegistrationPage
        backendStatus={backendStatus}
        errorMessage={publicErrorMessage}
        form={publicForm}
        handleChange={handlePublicChange}
        handleSubmit={handlePublicSubmit}
        isSubmitting={isPublicSubmitting}
        submission={publicSubmission}
      />
    )
  }

  return (
    <div className="app-shell">
      <AdminHero
        attendeesCount={attendees.length}
        backendStatus={backendStatus}
        isFirebaseConfigured={isFirebaseConfigured}
        metrics={metrics}
      />

      <main className="content-grid">
        <AdminRegistrationPanel
          editingAttendeeId={editingAttendeeId}
          errorMessage={errorMessage}
          form={form}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          modeLabel={modeLabel}
          onCancelEdit={handleCancelEdit}
          submission={submission}
        />

        <AttendeeTableSection
          attendees={filteredAttendees}
          backendStatus={backendStatus}
          filterState={filters}
          filteredCount={filteredAttendees.length}
          handleDelete={handleRequestDelete}
          handleEdit={handleEdit}
          handleFilterChange={handleFilterChange}
          handleStatusAction={handleStatusAction}
          formatDate={formatDate}
          isDeletingId={isDeletingId}
          isUpdatingStatusId={isUpdatingStatusId}
          isLoadingAttendees={isLoadingAttendees}
          loadAttendees={loadAttendees}
        />

        <ModulesSection modules={modules} />
        <OperationsSection adminLanes={adminLanes} />
        <RoadmapSection incidents={incidents} roadmap={roadmap} />
        <ActivitySection liveFeed={liveFeed} />
      </main>

      <DeleteConfirmModal
        attendee={pendingDeleteAttendee}
        isDeleting={Boolean(isDeletingId)}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default App

import { useEffect, useMemo, useState } from 'react'
import { isFirebaseConfigured } from './firebase'
import {
  deleteAttendee,
  listAttendees,
  registerAttendee,
  updateAttendee,
  updateAttendeeStatus,
} from './attendeesStore'
import AdminHero from './components/AdminHero'
import AdminRegistrationPanel from './components/AdminRegistrationPanel'
import AttendeeTableSection from './components/AttendeeTableSection'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import LoginPage from './components/LoginPage'
import PublicRegistrationPage from './components/PublicRegistrationPage'
import ScannerPage from './components/ScannerPage'
import { authFetch, clearSession, getStoredUser, getToken } from './auth'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

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

  if (path === '/admin/login' || path === '/login') {
    return 'login'
  }

  if (path === '/scanner') {
    return 'scanner'
  }

  return 'admin'
}

function createQrToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function buildAttendeePayload(form, overrides = {}) {
  return {
    fullName: form.fullName.trim(),
    documentId: form.documentId.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    organization: form.organization.trim(),
    attendeeType: form.attendeeType,
    notes: form.notes?.trim?.() || '',
    hasFaceConsent: form.hasFaceConsent,
    status: overrides.status || 'approved',
    source: overrides.source || 'admin-panel',
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

  const handleLogout = async () => {
    try {
      await authFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' })
    } catch {
      // ignore network errors on logout
    }
    clearSession()
    window.location.href = '/admin/login'
  }

  const loadAttendees = async ({ silent = false } = {}) => {
    if (!isFirebaseConfigured) {
      setAttendees([])
      return
    }

    if (!silent) {
      setIsLoadingAttendees(true)
    }

    try {
      const items = await listAttendees()
      setAttendees(items)
    } catch (error) {
      console.error(error)
      setErrorMessage(error.message || 'No fue posible consultar asistentes.')
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
    if (isFirebaseConfigured && currentView === 'admin') {
      loadAttendees()
    }
  }, [currentView])

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
    if (!isFirebaseConfigured) {
      setErrorMessage('Firestore no esta configurado. Revisa .env.local.')
      return
    }

    setIsUpdatingStatusId(attendeeId)
    setErrorMessage('')

    try {
      const updated = await updateAttendeeStatus(attendeeId, nextStatus)
      setAttendees((current) =>
        current.map((item) => (item.id === attendeeId ? { ...item, ...updated } : item)),
      )
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible actualizar el estado.')
      console.error(error)
    } finally {
      setIsUpdatingStatusId('')
    }
  }

  const handleConfirmDelete = async (attendee) => {
    if (!isFirebaseConfigured) {
      setErrorMessage('Firestore no esta configurado. Revisa .env.local.')
      return
    }

    setIsDeletingId(attendee.id)
    setErrorMessage('')

    try {
      await deleteAttendee(attendee.id)

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
      const attendee = buildAttendeePayload(form, {
        source: 'admin-panel',
        status: 'approved',
      })

      if (editingAttendeeId) {
        const updated = await updateAttendee(editingAttendeeId, attendee)
        setAttendees((current) =>
          current.map((item) => (item.id === editingAttendeeId ? { ...item, ...updated } : item)),
        )
        setSubmission(null)
        setEditingAttendeeId('')
        setForm(initialForm)
        return
      }

      const result = await registerAttendee(attendee)
      setSubmission({
        recordId: result.item.id,
        qrDataUrl: result.qrDataUrl,
        mode: 'firestore',
        attendee: result.item,
      })
      setAttendees((current) => [result.item, ...current])
      setEditingAttendeeId('')
      setForm(initialForm)
    } catch (error) {
      setErrorMessage(
        error.message ||
          'No fue posible guardar el registro desde el panel admin. Revisa Firestore.',
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
      const attendee = buildAttendeePayload(publicForm, {
        source: 'public-registration',
        status: 'pre-registered',
      })

      const result = await registerAttendee(attendee)
      setPublicSubmission({
        recordId: result.item.id,
        qrDataUrl: result.qrDataUrl,
        mode: 'firestore',
        attendee: result.item,
      })
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

  const modeLabel = isFirebaseConfigured ? 'Firestore activo' : 'Firebase no configurado'

  const liveMetrics = useMemo(() => {
    const total = attendees.length
    const approved = attendees.filter((item) => item.status === 'approved').length
    const checkedIn = attendees.filter((item) => item.status === 'checked-in').length
    const pending = attendees.filter(
      (item) => item.status === 'pre-registered' || item.status === 'pending',
    ).length

    return [
      { value: String(total), label: 'registros totales' },
      { value: String(approved), label: 'aprobados' },
      { value: String(checkedIn), label: 'check-ins confirmados' },
      { value: String(pending), label: 'pendientes' },
    ]
  }, [attendees])

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

  if (currentView === 'login') {
    return <LoginPage />
  }

  const currentUser = getStoredUser()
  const hasToken = Boolean(getToken())

  if (!hasToken || !currentUser) {
    window.location.href = '/admin/login'
    return null
  }

  if (currentView === 'scanner') {
    if (!['admin', 'staff'].includes(currentUser.role)) {
      return <LoginPage />
    }
    return <ScannerPage currentUser={currentUser} onLogout={handleLogout} />
  }

  if (currentUser.role !== 'admin') {
    window.location.href = '/scanner'
    return null
  }

  return (
    <div className="app-shell">
      <AdminHero
        attendeesCount={attendees.length}
        backendStatus={backendStatus}
        isFirebaseConfigured={isFirebaseConfigured}
        metrics={liveMetrics}
        currentUser={currentUser}
        onLogout={handleLogout}
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

import { useEffect, useMemo, useState } from 'react'
import { isFirebaseConfigured } from './firebase'
import {
  bulkApproveAttendees,
  deleteAttendee,
  isAttendeeOrphan,
  listAttendees,
  migrateOrphanAttendees,
  registerAttendee,
  subscribeToAttendees,
  updateAttendee,
  updateAttendeeStatus,
} from './attendeesStore'
import { listEmpresas } from './empresasStore'
import { listEventos } from './eventosStore'
import AdminHero from './components/AdminHero'
import AdminRegistrationPanel from './components/AdminRegistrationPanel'
import AttendeeTableSection from './components/AttendeeTableSection'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import EmpresasInvitadasPanel from './components/EmpresasInvitadasPanel'
import LoginPage from './components/LoginPage'
import PublicRegistrationPage from './components/PublicRegistrationPage'
import QrViewerModal from './components/QrViewerModal'
import ScannerPage from './components/ScannerPage'
import { logout as firebaseLogout, subscribeToAuthState } from './auth'
import './App.css'

const initialForm = {
  fullName: '',
  documentId: '',
  email: '',
  phone: '',
  organization: '',
  empresaInvitadaId: '',
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
  empresaInvitadaId: '',
  attendeeType: 'general',
  hasFaceConsent: false,
}

const initialFilters = {
  query: '',
  attendeeType: 'all',
  status: 'all',
  empresa: 'all',
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
  const empresasInvitadas = overrides.empresasInvitadas || []
  const isCustom = form.empresaInvitadaId === '__otra__'
  const matched = !isCustom && form.empresaInvitadaId
    ? empresasInvitadas.find((e) => e.id === form.empresaInvitadaId)
    : null

  const resolvedEmpresaInvitadaId = matched ? matched.id : ''
  const resolvedOrganization = matched
    ? matched.nombre
    : (form.organization || '').trim()

  return {
    fullName: form.fullName.trim(),
    documentId: form.documentId.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    organization: resolvedOrganization,
    empresaInvitadaId: resolvedEmpresaInvitadaId,
    attendeeType: form.attendeeType,
    notes: form.notes?.trim?.() || '',
    hasFaceConsent: form.hasFaceConsent,
    status: overrides.status || 'approved',
    source: overrides.source || 'admin-panel',
    empresaId: overrides.empresaId || '',
    eventoId: overrides.eventoId || '',
  }
}

function downloadAttendeesCsv(attendees) {
  const headers = [
    'Nombre',
    'Documento',
    'Email',
    'Telefono',
    'Empresa',
    'Categoria',
    'Estado',
    'Fuente',
    'Creado',
    'Check-in',
    'Punto de acceso',
    'Validado por',
  ]

  const toCsv = (value) => {
    const str = value === null || value === undefined ? '' : String(value)
    return `"${str.replace(/"/g, '""')}"`
  }

  const formatForCsv = (value) => {
    if (!value) return ''
    try {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toISOString()
    } catch {
      return String(value)
    }
  }

  const rows = attendees.map((a) => [
    a.fullName || '',
    a.documentId || '',
    a.email || '',
    a.phone || '',
    a.organization || '',
    a.attendeeType || '',
    a.status || '',
    a.source || '',
    formatForCsv(a.createdAt),
    formatForCsv(a.checkedInAt),
    a.checkinPoint || '',
    a.checkedInByName || a.checkedInBy || '',
  ])

  const csvLines = [headers, ...rows].map((row) => row.map(toCsv).join(','))
  const csv = '\uFEFF' + csvLines.join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `asistentes-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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
  const [viewingQrAttendee, setViewingQrAttendee] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [publicSubmission, setPublicSubmission] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [publicErrorMessage, setPublicErrorMessage] = useState('')
  const [attendees, setAttendees] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [eventos, setEventos] = useState([])
  const [isMigrating, setIsMigrating] = useState(false)
  const [isBulkApproving, setIsBulkApproving] = useState(false)
  const [filters, setFilters] = useState(initialFilters)
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  const handleLogout = async () => {
    try {
      await firebaseLogout()
    } catch (error) {
      console.error(error)
    }
    setCurrentUser(null)
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
    const unsubscribe = subscribeToAuthState((user) => {
      setCurrentUser(user)
      setIsAuthChecking(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) return

    listEmpresas()
      .then(setEmpresas)
      .catch((error) => console.error(error))
    listEventos()
      .then(setEventos)
      .catch((error) => console.error(error))
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || currentView !== 'admin' || !currentUser) {
      return
    }

    setIsLoadingAttendees(true)
    const unsubscribe = subscribeToAttendees(
      (items) => {
        setAttendees(items)
        setIsLoadingAttendees(false)
      },
      (error) => {
        console.error(error)
        setErrorMessage(error.message || 'No fue posible consultar asistentes.')
        setIsLoadingAttendees(false)
      },
    )

    return unsubscribe
  }, [currentView, currentUser])

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

  const handleAdminCedulaFill = (data) => {
    setForm((current) => ({
      ...current,
      fullName: data.fullName || current.fullName,
      documentId: data.documentId || current.documentId,
    }))
  }

  const handlePublicCedulaFill = (data) => {
    setPublicForm((current) => ({
      ...current,
      fullName: data.fullName || current.fullName,
      documentId: data.documentId || current.documentId,
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
        empresaId: activeEmpresaId,
        eventoId: activeEventoId,
        empresasInvitadas,
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
        empresaId: activeEmpresaId,
        eventoId: activeEventoId,
        empresasInvitadas,
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

    const empresasRepresentadas = new Set()
    for (const a of attendees) {
      const key = (a.organization || '').trim().toLowerCase()
      if (key) empresasRepresentadas.add(key)
    }

    return [
      { value: String(total), label: 'registros totales' },
      { value: String(approved), label: 'aprobados' },
      { value: String(checkedIn), label: 'check-ins confirmados' },
      { value: String(pending), label: 'pendientes' },
      { value: String(empresasRepresentadas.size), label: 'empresas representadas' },
    ]
  }, [attendees])

  const empresasMap = useMemo(() => {
    const map = {}
    for (const empresa of empresas) {
      map[empresa.id] = empresa.nombre || empresa.id
    }
    return map
  }, [empresas])

  const activeEmpresaId = useMemo(() => {
    const active = empresas.find((e) => e.active !== false) || empresas[0]
    return active?.id || ''
  }, [empresas])

  const activeEvento = useMemo(() => {
    return eventos.find((e) => e.active !== false) || eventos[0] || null
  }, [eventos])

  const activeEventoId = activeEvento?.id || ''

  const empresasInvitadas = useMemo(() => {
    return Array.isArray(activeEvento?.empresasInvitadas) ? activeEvento.empresasInvitadas : []
  }, [activeEvento])

  const handleEmpresasInvitadasChange = (next) => {
    if (!activeEvento) return
    setEventos((current) =>
      current.map((e) =>
        e.id === activeEvento.id ? { ...e, empresasInvitadas: next } : e,
      ),
    )
  }

  const orphanAttendeesCount = useMemo(
    () => attendees.filter(isAttendeeOrphan).length,
    [attendees],
  )

  const handleMigrateOrphans = async () => {
    const defaultEmpresa = empresas.find((e) => e.active !== false) || empresas[0]
    const defaultEvento = eventos.find((e) => e.active !== false) || eventos[0]

    if (!defaultEmpresa || !defaultEvento) {
      setErrorMessage(
        'Debes tener al menos una empresa y un evento creados antes de migrar.',
      )
      return
    }

    setIsMigrating(true)
    setErrorMessage('')

    try {
      const result = await migrateOrphanAttendees({
        empresaId: defaultEmpresa.id,
        eventoId: defaultEvento.id,
      })
      await loadAttendees({ silent: true })
      window.alert(
        `Migracion completa.\nAsignados: ${result.migrated}\nYa estaban migrados: ${result.skipped}\nTotal: ${result.total}`,
      )
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible migrar asistentes.')
    } finally {
      setIsMigrating(false)
    }
  }

  const handleBulkApprove = async (ids) => {
    if (!ids || ids.length === 0) return
    const confirmed = window.confirm(
      `Vas a aprobar ${ids.length} asistente(s) pendiente(s). Todos pasaran a estado "approved" y podran hacer check-in. Continuar?`,
    )
    if (!confirmed) return

    setIsBulkApproving(true)
    setErrorMessage('')

    try {
      const result = await bulkApproveAttendees(ids)
      setAttendees((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, status: 'approved' } : item,
        ),
      )
      window.alert(`${result.updated} asistentes aprobados correctamente.`)
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible aprobar en masa.')
    } finally {
      setIsBulkApproving(false)
    }
  }

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

    const matchesEmpresa =
      filters.empresa === 'all' ||
      (filters.empresa === '__otra__' && !item.empresaInvitadaId) ||
      item.empresaInvitadaId === filters.empresa

    return matchesQuery && matchesType && matchesStatus && matchesEmpresa
  })

  if (currentView === 'public') {
    return (
      <PublicRegistrationPage
        errorMessage={publicErrorMessage}
        form={publicForm}
        handleChange={handlePublicChange}
        handleSubmit={handlePublicSubmit}
        isSubmitting={isPublicSubmitting}
        submission={publicSubmission}
        onCedulaFill={handlePublicCedulaFill}
        empresasInvitadas={empresasInvitadas}
      />
    )
  }

  if (currentView === 'login') {
    return <LoginPage />
  }

  if (isAuthChecking) {
    return (
      <div className="app-shell" style={{ padding: 40 }}>
        <p>Verificando sesion...</p>
      </div>
    )
  }

  if (!currentUser) {
    window.location.href = '/admin/login'
    return null
  }

  const ADMIN_ROLES = ['admin', 'superadmin', 'admin_empresa']
  const SCANNER_ROLES = [...ADMIN_ROLES, 'staff']

  if (currentView === 'scanner') {
    if (!SCANNER_ROLES.includes(currentUser.role)) {
      return <LoginPage />
    }
    return <ScannerPage currentUser={currentUser} onLogout={handleLogout} />
  }

  if (!ADMIN_ROLES.includes(currentUser.role)) {
    window.location.href = '/scanner'
    return null
  }

  return (
    <div className="app-shell">
      <AdminHero
        attendeesCount={attendees.length}
        isFirebaseConfigured={isFirebaseConfigured}
        metrics={liveMetrics}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="content-grid">
        {orphanAttendeesCount > 0 && currentUser?.role === 'superadmin' ? (
          <div className="migration-banner">
            <div>
              <strong>{orphanAttendeesCount}</strong> asistente(s) sin empresa o evento asignado.
              <p className="helper-text">
                Asigna a todos la empresa y evento activos para que aparezcan correctamente en el
                listado.
              </p>
            </div>
            <button
              type="button"
              className="submit-button"
              onClick={handleMigrateOrphans}
              disabled={isMigrating}
            >
              {isMigrating ? 'Migrando...' : 'Migrar automaticamente'}
            </button>
          </div>
        ) : null}

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
          onCedulaFill={handleAdminCedulaFill}
          empresasInvitadas={empresasInvitadas}
        />

        <EmpresasInvitadasPanel
          evento={activeEvento}
          onChange={handleEmpresasInvitadasChange}
        />

        <AttendeeTableSection
          attendees={filteredAttendees}
          empresasMap={empresasMap}
          empresasInvitadas={empresasInvitadas}
          handleExportCsv={() => downloadAttendeesCsv(filteredAttendees)}
          handleViewQr={setViewingQrAttendee}
          handleBulkApprove={handleBulkApprove}
          isBulkApproving={isBulkApproving}
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

      {viewingQrAttendee ? (
        <QrViewerModal
          attendee={viewingQrAttendee}
          onClose={() => setViewingQrAttendee(null)}
        />
      ) : null}
    </div>
  )
}

export default App

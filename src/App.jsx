import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { isFirebaseConfigured } from './firebase'
import {
  bulkApproveAttendees,
  deleteAttendee,
  findAttendeeByDocument,
  isAttendeeOrphan,
  listAttendees,
  migrateOrphanAttendees,
  registerAttendee,
  subscribeToAttendees,
  updateAttendee,
  updateAttendeeStatus,
} from './attendeesStore'
import { listEmpresas } from './empresasStore'
import { createEvento, listEventos } from './eventosStore'
import { getClienteById, getClienteBySlug } from './clientesStore'
import { getEventoById } from './eventosStore'
import { subscribeToRatings } from './ratingsStore'
import { subscribeToEstaciones } from './stacionesStore'
import AdminHero from './components/AdminHero'
import AttendeeTableSection from './components/AttendeeTableSection'
import EditAttendeeModal from './components/EditAttendeeModal'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import AdminSection from './components/AdminSection'
import CalificacionPage from './components/CalificacionPage'
import MapaPublicoPage from './components/MapaPublicoPage'
import TriviaQuizPage from './components/TriviaQuizPage'
import MapEditorPanel from './components/MapEditorPanel'
import TriviaEditorPanel from './components/TriviaEditorPanel'
import EstacionesDashboard from './components/EstacionesDashboard'
import CalificacionEstacionesPanel from './components/CalificacionEstacionesPanel'
import EstacionQRPanel from './components/EstacionQRPanel'
import EstacionPublicaPage from './components/EstacionPublicaPage'
import MiEventoPage from './components/MiEventoPage'
import CalificacionPanel from './components/CalificacionPanel'
import CategoriasPanel from './components/CategoriasPanel'
import CerrarEventoPanel from './components/CerrarEventoPanel'
import GestionEventosPanel from './components/GestionEventosPanel'
import HorarioEventoPanel, { getEstadoEvento } from './components/HorarioEventoPanel'
import EmpresasInvitadasPanel from './components/EmpresasInvitadasPanel'
import KioskoQrPanel from './components/KioskoQrPanel'
import LoginPage from './components/LoginPage'
import SuperAdminPage from './components/SuperAdminPage'
import PublicRegistrationPage from './components/PublicRegistrationPage'
import QrViewerModal from './components/QrViewerModal'
import ScannerPage from './components/ScannerPage'
import { logout as firebaseLogout, subscribeToAuthState } from './auth'
import { useTheme } from './useTheme'
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
  status: 'approved',
}

const initialPublicForm = {
  fullName: '',
  documentType: 'CC',
  documentId: '',
  email: '',
  phone: '',
  organization: '',
  empresaInvitadaId: '',
  attendeeType: 'general',
  hasFaceConsent: false,
  hasCompanions: false,
  companionsCount: '',
  surveyAnswers: {},
}

const initialFilters = {
  query: '',
  attendeeType: 'all',
  status: 'all',
  empresa: 'all',
  origen: 'all',
}

const EMPRESA_VIEW_MAP = {
  admin: 'admin',
  registro: 'public',
  scanner: 'scanner',
  calificar: 'rating',
  'mi-evento': 'mi-evento',
  mapa: 'mapa',
  trivia: 'trivia',
  estacion: 'estacion',
}

function getRouteSlug() {
  const match = window.location.pathname.match(/^\/e\/([^/]+)\//i)
  return match ? match[1].toLowerCase() : null
}

function getCurrentView() {
  const path = window.location.pathname.toLowerCase()

  // Rutas por empresa: /e/:slug/:view
  const empresaMatch = path.match(/^\/e\/[^/]+\/(.+)$/)
  if (empresaMatch) {
    return EMPRESA_VIEW_MAP[empresaMatch[1]] || 'admin'
  }

  if (path === '/registro') return 'public'
  if (path === '/calificar') return 'rating'
  if (path === '/mapa') return 'mapa'
  if (path === '/trivia') return 'trivia'
  if (path === '/estacion') return 'estacion'
  if (path === '/mi-evento') return 'mi-evento'
  if (path === '/admin/login' || path === '/login') return 'login'
  if (path === '/scanner') return 'scanner'
  if (path === '/superadmin') return 'superadmin'

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
    clienteId: overrides.clienteId || '',
    documentType: form.documentType || 'CC',
    companionsCount: form.hasCompanions ? Number(form.companionsCount) || 0 : 0,
    surveyAnswers: form.surveyAnswers || {},
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

function getPublicUrlOptions() {
  if (typeof window === 'undefined') return { empresaParam: '', kiosk: false }
  const params = new URLSearchParams(window.location.search)
  return {
    empresaParam: params.get('empresa') || '',
    kiosk: params.get('kiosk') === '1',
  }
}

function App() {
  const [dark, toggleTheme] = useTheme()
  const [currentView, setCurrentView] = useState(getCurrentView)
  const [form, setForm] = useState(initialForm)
  const [publicForm, setPublicForm] = useState(initialPublicForm)
  const [publicUrlOptions] = useState(getPublicUrlOptions)
  const [editingAttendeeId, setEditingAttendeeId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublicSubmitting, setIsPublicSubmitting] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState('')
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isUpdatingStatusId, setIsUpdatingStatusId] = useState('')
  const [pendingDeleteAttendee, setPendingDeleteAttendee] = useState(null)
  const [viewingQrAttendee, setViewingQrAttendee] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [publicSubmission, setPublicSubmission] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [publicErrorMessage, setPublicErrorMessage] = useState('')
  const [publicLookupStatus, setPublicLookupStatus] = useState('idle')
  const [attendees, setAttendees] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [eventos, setEventos] = useState([])
  const [eventosLoaded, setEventosLoaded] = useState(false)
  const [ratings, setRatings] = useState([])
  const [estaciones, setEstaciones] = useState([])
  const [activeEventoIdState, setActiveEventoIdState] = useState(() => {
    try {
      return localStorage.getItem('asistencia-evento:activeEventoId') || ''
    } catch {
      return ''
    }
  })
  const [isMigrating, setIsMigrating] = useState(false)
  const [isBulkApproving, setIsBulkApproving] = useState(false)
  const [superadminClienteActivo, setSuperadminClienteActivo] = useState(null)
  const [activeCliente, setActiveCliente] = useState(null)
  const [routeSlug] = useState(getRouteSlug)
  const [nuevoEventoNombre, setNuevoEventoNombre] = useState('')
  const [isCreandoEvento, setIsCreandoEvento] = useState(false)
  const [crearEventoError, setCrearEventoError] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const [activeSectionId, setActiveSectionId] = useState('listado')
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)

  const activeClienteId = superadminClienteActivo?.id || activeCliente?.id || currentUser?.clienteId || ''
  const brandingCliente = superadminClienteActivo || activeCliente
  const empresaConfigFromCliente = brandingCliente
    ? {
        ...brandingCliente,
        colorPrimario: brandingCliente.colorPrimario || brandingCliente.colorAcento || '',
      }
    : null

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
    return () => window.removeEventListener('popstate', syncView)
  }, [])

  // Cargar empresa desde el slug en la URL (rutas /e/:slug/*)
  useEffect(() => {
    if (!routeSlug) return
    getClienteBySlug(routeSlug).then((cliente) => {
      if (!cliente) return
      setActiveCliente(cliente)
      // Cargamos eventos en el mismo callback para no esperar otro ciclo de render
      if (isFirebaseConfigured) {
        listEventos(cliente.id)
          .then((items) => {
            setEventos(items)
            setEventosLoaded(true)
          })
          .catch(() => setEventosLoaded(true))
      }
    })
  }, [routeSlug])

  // Cargar empresa desde ?cliente= o ?evento= en la URL (páginas públicas sin slug)
  useEffect(() => {
    if (routeSlug) return // ya tiene slug, no hace falta
    const params = new URLSearchParams(window.location.search)
    const clienteId = params.get('cliente')
    const eventoId = params.get('evento')
    if (clienteId) {
      getClienteById(clienteId).then((cliente) => {
        if (cliente) setActiveCliente(cliente)
      })
      return
    }
    if (!eventoId) return
    getEventoById(eventoId).then((ev) => {
      if (!ev?.clienteId) return
      getClienteById(ev.clienteId).then((cliente) => {
        if (cliente) setActiveCliente(cliente)
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cargar empresa del usuario logueado (para branding aunque no use slug en URL)
  useEffect(() => {
    if (!currentUser?.clienteId) return
    if (activeCliente?.id === currentUser.clienteId) return
    getClienteById(currentUser.clienteId).then((cliente) => {
      if (cliente) setActiveCliente(cliente)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.clienteId])

  // Cargar eventos para rutas públicas (visitantes sin login que usan /e/:slug/)
  useEffect(() => {
    if (!isFirebaseConfigured) return
    if (currentUser) return // el efecto de admin lo maneja
    if (!activeCliente?.id) return
    listEventos(activeCliente.id)
      .then((items) => {
        setEventos(items)
        setEventosLoaded(true)
      })
      .catch(() => setEventosLoaded(true))
  }, [activeCliente, currentUser])

  // Aplicar branding de la empresa activa como CSS variables
  useEffect(() => {
    const cliente = superadminClienteActivo || activeCliente
    // Si aún no hay cliente cargado, no tocar las variables — el script inline
    // de index.html ya aplicó el cache; si lo removemos aquí causamos el flash.
    if (!cliente) return
    const primario = cliente?.colorPrimario || cliente?.colorAcento
    const secundario = cliente?.colorSecundario
    if (primario) {
      document.documentElement.style.setProperty('--accent', primario)
      document.documentElement.style.setProperty('--accent-strong', secundario || primario)
    } else {
      document.documentElement.style.removeProperty('--accent')
      document.documentElement.style.removeProperty('--accent-strong')
    }
    if (secundario) {
      document.documentElement.style.setProperty('--accent2', secundario)
    } else {
      document.documentElement.style.removeProperty('--accent2')
    }
    // Guardar en localStorage para aplicar sin flash en la siguiente carga
    const slug = cliente?.slug
    if (slug && primario) {
      try {
        localStorage.setItem(`ae:branding:${slug}`, JSON.stringify({
          accent: primario,
          accentStrong: secundario || primario,
          accent2: secundario || '',
        }))
      } catch { /* ignore */ }
    }
  }, [superadminClienteActivo, activeCliente])

  // Redirigir admin_empresa a su URL /e/:slug/admin tras login
  // El staff NO debe ser redirigido — su destino es /scanner, no /admin
  useEffect(() => {
    if (!currentUser || currentUser.role === 'superadmin') return
    if (currentUser.role === 'staff') return
    if (!activeCliente?.slug) return
    const path = window.location.pathname.toLowerCase()
    const expectedPrefix = `/e/${activeCliente.slug}/`
    if (!path.startsWith(expectedPrefix)) {
      history.replaceState(null, '', `/e/${activeCliente.slug}/admin`)
      setCurrentView('admin')
    }
  }, [currentUser, activeCliente])

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setCurrentUser(user)
      setIsAuthChecking(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return

    listEmpresas()
      .then(setEmpresas)
      .catch((error) => console.error(error))
    listEventos(activeClienteId)
      .then((items) => {
        setEventos(items)
        setEventosLoaded(true)
      })
      .catch((error) => {
        console.error(error)
        setEventosLoaded(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, superadminClienteActivo])

  useEffect(() => {
    const target = publicUrlOptions.empresaParam
    if (!target || currentView !== 'public') return
    setPublicForm((current) => {
      if (current.empresaInvitadaId === target) return current
      return { ...current, empresaInvitadaId: target, surveyAnswers: {} }
    })
  }, [publicUrlOptions.empresaParam, currentView])

  useEffect(() => {
    if (!isFirebaseConfigured) return
    if (currentView !== 'admin' || !currentUser) return
    // Cargamos TODAS las calificaciones; el filtro por evento se hace en cliente
    // (eventRatings memo) para que al cambiar de evento activo se vea su data sin recargar.
    const unsubscribe = subscribeToRatings(
      '',
      (items) => setRatings(items),
      (error) => console.error('No fue posible cargar calificaciones', error),
    )
    return unsubscribe
  }, [currentView, currentUser])

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
      activeClienteId,
    )

    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, currentUser, superadminClienteActivo])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handlePublicChange = (event) => {
    const { name, value, type, checked } = event.target

    setPublicForm((current) => {
      const next = {
        ...current,
        [name]: type === 'checkbox' ? checked : value,
      }
      if (name === 'empresaInvitadaId') {
        next.surveyAnswers = {}
      }
      return next
    })

    if (name === 'documentId') {
      setPublicLookupStatus('idle')
    }

    // Si cambia la empresa y ya hay documento escrito, re-disparar el lookup
    // contra la NUEVA empresa para que reevalue match vs personalMatch.
    if (name === 'empresaInvitadaId') {
      const docActual = publicForm.documentId?.trim()
      if (docActual && docActual.length >= 5) {
        const nuevaEmpresa = value === '__otra__' ? '' : value
        handlePublicDocumentLookup(docActual, nuevaEmpresa)
      }
    }
  }

  const handlePublicSurveyChange = (questionId, value) => {
    setPublicForm((current) => ({
      ...current,
      surveyAnswers: { ...(current.surveyAnswers || {}), [questionId]: value },
    }))
  }

  const handlePublicDocumentLookup = async (documentValue, empresaOverride) => {
    const cleaned = String(documentValue || '').trim()
    if (cleaned.length < 5) {
      setPublicLookupStatus('idle')
      return
    }
    setPublicLookupStatus('searching')
    try {
      const empresaActual =
        empresaOverride !== undefined
          ? empresaOverride
          : publicForm.empresaInvitadaId || ''
      const empresaNombre =
        empresasInvitadas.find((e) => e.id === empresaActual)?.nombre || ''
      const result = await findAttendeeByDocument(
        cleaned,
        empresaActual,
        empresaNombre,
      )

      // Caso 1: Encontrado en la MISMA empresa actual → llenar todo
      if (result.match) {
        const found = result.match
        setPublicForm((current) => ({
          ...current,
          fullName: current.fullName || found.fullName || '',
          email: current.email || found.email || '',
          phone: current.phone || found.phone || '',
          organization: current.organization || found.organization || '',
          documentType: found.documentType || current.documentType || 'CC',
          empresaInvitadaId:
            current.empresaInvitadaId || found.empresaInvitadaId || '',
        }))
        setPublicLookupStatus('found')
        return
      }

      // Caso 2: Existe en OTRA empresa → solo info personal, no de empresa
      if (result.personalMatch) {
        const found = result.personalMatch
        setPublicForm((current) => ({
          ...current,
          fullName: current.fullName || found.fullName || '',
          email: current.email || found.email || '',
          phone: current.phone || found.phone || '',
          documentType: found.documentType || current.documentType || 'CC',
          // organization, nit y empresaInvitadaId quedan como están (vacíos o lo que el usuario ya puso)
        }))
        setPublicLookupStatus('found-other-empresa')
        return
      }

      // Caso 3: Nunca registrado
      setPublicLookupStatus('not-found')
    } catch (error) {
      console.error('Lookup fallido', error)
      setPublicLookupStatus('idle')
    }
  }

  const handleAdminCedulaFill = (data) => {
    setForm((current) => ({
      ...current,
      fullName: data.fullName || current.fullName,
      documentId: data.documentId || current.documentId,
    }))
  }

  const handlePublicCedulaFill = (data) => {
    if (data.documentId) {
      handlePublicDocumentLookup(data.documentId)
    }
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
      empresaInvitadaId: attendee.empresaInvitadaId || '',
      attendeeType: attendee.attendeeType || 'general',
      notes: attendee.notes || '',
      hasFaceConsent: Boolean(attendee.hasFaceConsent),
      status: attendee.status || 'approved',
    })
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

  const handleBulkDelete = async (ids, onSuccess) => {
    if (!ids || ids.length === 0) return
    const confirmed = window.confirm(
      `Vas a eliminar ${ids.length} asistente(s) de forma permanente. Esta acción no se puede deshacer. ¿Continuar?`
    )
    if (!confirmed) return
    setIsBulkDeleting(true)
    setErrorMessage('')
    try {
      await Promise.all(ids.map((id) => deleteAttendee(id)))
      setAttendees((current) => current.filter((a) => !ids.includes(a.id)))
      onSuccess?.()
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible eliminar los asistentes seleccionados.')
      console.error(error)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const attendee = buildAttendeePayload(form, {
        source: 'admin-panel',
        status: editingAttendeeId ? (form.status || 'approved') : 'approved',
        empresaId: activeEmpresaId,
        eventoId: activeEventoId,
        clienteId: activeClienteId,
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
    if (!activeEventoId) {
      setPublicErrorMessage('El evento aún está cargando. Espera un momento e intenta de nuevo.')
      return
    }
    setIsPublicSubmitting(true)
    setPublicErrorMessage('')

    try {
      const selectedEmpresa = empresasInvitadas.find(
        (e) => e.id === publicForm.empresaInvitadaId,
      )
      if (
        selectedEmpresa?.encuestaHabilitada &&
        selectedEmpresa?.encuestaObligatoria
      ) {
        const preguntas = Array.isArray(selectedEmpresa.encuestaPreguntas)
          ? selectedEmpresa.encuestaPreguntas
          : []
        const missing = preguntas.find((p) => {
          const value = publicForm.surveyAnswers?.[p.id]
          return !value || String(value).trim() === ''
        })
        if (missing) {
          setPublicErrorMessage(
            'Debes responder todas las preguntas de la encuesta antes de continuar.',
          )
          setIsPublicSubmitting(false)
          return
        }
      }

      const eventoModo =
        activeEvento?.modoRegistro ||
        (activeEvento?.registroEnSitio ? 'onsite' : 'pre')
      const isOnSite = publicUrlOptions.kiosk || eventoModo === 'onsite'
      const attendee = buildAttendeePayload(publicForm, {
        source: isOnSite ? 'kiosk-registration' : 'public-registration',
        status: isOnSite ? 'approved' : 'pre-registered',
        empresaId: activeEmpresaId,
        eventoId: activeEventoId,
        clienteId: activeClienteId,
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
    if (activeEventoIdState) {
      const match = eventos.find((e) => e.id === activeEventoIdState)
      if (match) return match
    }
    // fallback: primer evento NO archivado
    return (
      eventos.find((e) => !e.archivado) ||
      eventos.find((e) => e.active !== false) ||
      eventos[0] ||
      null
    )
  }, [eventos, activeEventoIdState])

  const activeEventoId = activeEvento?.id || ''


  useEffect(() => {
    if (!isFirebaseConfigured || !activeEvento?.id) return
    const unsub = subscribeToEstaciones(activeEvento.id, setEstaciones)
    return unsub
  }, [activeEvento?.id])

  const eventAttendees = useMemo(() => {
    if (!activeEventoId) return attendees
    return attendees.filter(
      (a) => !a.eventoId || a.eventoId === activeEventoId,
    )
  }, [attendees, activeEventoId])

  const eventRatings = useMemo(() => {
    if (!activeEventoId) return []
    return ratings.filter(
      (r) => !r.eventoId || r.eventoId === activeEventoId,
    )
  }, [ratings, activeEventoId])

  const liveMetrics = useMemo(() => {
    const total = eventAttendees.length
    const approved = eventAttendees.filter((item) => item.status === 'approved').length
    const checkedIn = eventAttendees.filter((item) => item.status === 'checked-in').length
    const pending = eventAttendees.filter(
      (item) => item.status === 'pre-registered' || item.status === 'pending',
    ).length

    const totalCompanions = eventAttendees.reduce(
      (sum, item) => sum + (Number(item.companionsCount) || 0),
      0,
    )
    const peopleAtEvent = total + totalCompanions

    const empresasRepresentadas = new Set()
    for (const a of eventAttendees) {
      const key = (a.empresaInvitadaId || a.organization || '').trim().toLowerCase()
      if (key) empresasRepresentadas.add(key)
    }

    const ratingsTotal = eventRatings.length
    const ratingAvg =
      ratingsTotal > 0
        ? (eventRatings.reduce((acc, r) => acc + (r.stars || 0), 0) / ratingsTotal).toFixed(1)
        : '0.0'

    return [
      { value: String(total), label: 'registros totales' },
      { value: String(peopleAtEvent), label: 'personas en el evento' },
      { value: String(approved), label: 'aprobados' },
      { value: String(checkedIn), label: 'check-ins confirmados' },
      { value: String(pending), label: 'pendientes' },
      { value: String(empresasRepresentadas.size), label: 'empresas representadas' },
      { value: `${ratingAvg} ★`, label: `calificación (${ratingsTotal})` },
    ]
  }, [eventAttendees, eventRatings])

  const handleSelectEvento = (eventoId) => {
    setActiveEventoIdState(eventoId)
    try {
      localStorage.setItem('asistencia-evento:activeEventoId', eventoId)
    } catch {
      // ignore
    }
  }

  const empresasInvitadas = useMemo(() => {
    return Array.isArray(activeEvento?.empresasInvitadas) ? activeEvento.empresasInvitadas : []
  }, [activeEvento])

  const categoriasEvento = useMemo(() => {
    if (Array.isArray(activeEvento?.categorias) && activeEvento.categorias.length > 0) {
      return activeEvento.categorias
    }
    return [
      { id: 'general', nombre: 'General' },
      { id: 'vip', nombre: 'VIP' },
      { id: 'speaker', nombre: 'Speaker' },
      { id: 'press', nombre: 'Prensa' },
    ]
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

  const handleCrearEvento = async (e) => {
    e.preventDefault()
    const nombre = nuevoEventoNombre.trim() || `Evento ${new Date().toLocaleDateString('es-CO')}`
    setIsCreandoEvento(true)
    setCrearEventoError('')
    try {
      const nuevo = await createEvento({ nombre }, activeClienteId)
      setActiveEventoIdState(nuevo.id)
      localStorage.setItem('asistencia-evento:activeEventoId', nuevo.id)
      setNuevoEventoNombre('')
      setEventos((prev) => [nuevo, ...prev])
    } catch (err) {
      setCrearEventoError(err.message || 'No fue posible crear el evento.')
    } finally {
      setIsCreandoEvento(false)
    }
  }

  const normalizedQuery = filters.query.trim().toLowerCase()
  const filteredAttendees = eventAttendees.filter((item) => {
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

    const matchesOrigen =
      filters.origen === 'all' ||
      (filters.origen === 'pre' && item.source === 'public-registration') ||
      (filters.origen === 'onsite' && item.source === 'kiosk-registration') ||
      (filters.origen === 'admin' && item.source === 'admin-panel')

    return matchesQuery && matchesType && matchesStatus && matchesEmpresa && matchesOrigen
  })

  const themeTogglePortal = createPortal(
    <button
      type="button"
      onClick={toggleTheme}
      title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      {dark ? '☀️' : '🌙'}
    </button>,
    document.getElementById('theme-overlay') || document.body,
  )

  const publicFooter = (
    <footer className="public-footer">
      <span>Powered by <strong>Divergency AI</strong></span>
      <span>© 2026 Todos los derechos reservados.</span>
    </footer>
  )

  if (currentView === 'public') {
    return (
      <div className="public-page-outer">
        {themeTogglePortal}
        <div className="public-overlay-spacer" />
        <PublicRegistrationPage
            errorMessage={publicErrorMessage}
            form={publicForm}
            handleChange={handlePublicChange}
            handleSurveyChange={handlePublicSurveyChange}
            handleSubmit={handlePublicSubmit}
            handleDocumentLookup={handlePublicDocumentLookup}
            lookupStatus={publicLookupStatus}
            isSubmitting={isPublicSubmitting}
            submission={publicSubmission}
            onCedulaFill={handlePublicCedulaFill}
            empresasInvitadas={empresasInvitadas}
            categorias={categoriasEvento}
            kioskMode={publicUrlOptions.kiosk}
            eventoModoRegistro={
              activeEvento?.modoRegistro ||
              (activeEvento?.registroEnSitio ? 'onsite' : 'pre')
            }
            eventoLoaded={true}
            eventoNombre={activeEvento?.nombre || ''}
            eventoId={activeEvento?.id || ''}
            empresaConfig={empresasInvitadas.find((e) => e.id === publicUrlOptions.empresaParam) || empresaConfigFromCliente || null}
            onResetSubmission={() => {
              setPublicSubmission(null)
              setPublicForm(initialPublicForm)
              setPublicLookupStatus('idle')
            }}
          />
          {publicFooter}
        </div>
    )
  }

  if (currentView === 'mapa') {
    return (
      <div className="public-page-outer">
        {themeTogglePortal}
        <div className="public-overlay-spacer" />
        <MapaPublicoPage />
        {publicFooter}
      </div>
    )
  }

  if (currentView === 'trivia') {
    return (
      <div className="public-page-outer">
        {themeTogglePortal}
        <div className="public-overlay-spacer" />
        <TriviaQuizPage />
        {publicFooter}
      </div>
    )
  }

  if (currentView === 'estacion') {
    return (
      <div className="public-page-outer">
        {themeTogglePortal}
        <div className="public-overlay-spacer" />
        <EstacionPublicaPage />
        {publicFooter}
      </div>
    )
  }

  if (currentView === 'mi-evento') {
    return (
      <div className="public-page-outer">
        {themeTogglePortal}
        <div className="public-overlay-spacer" />
        <MiEventoPage />
        {publicFooter}
      </div>
    )
  }

  if (currentView === 'rating') {
    return (
      <div className="public-page-outer">
        {themeTogglePortal}
        <div className="public-overlay-spacer" />
        <CalificacionPage
          evento={activeEvento}
          empresasInvitadas={empresasInvitadas}
          eventoLoaded={eventosLoaded}
        />
        {publicFooter}
      </div>
    )
  }

  if (currentView === 'login') {
    // Usuario vuelve del redirect de Google en móvil ya autenticado
    if (!isAuthChecking && currentUser) {
      const target = currentUser.role === 'staff' ? '/scanner' : '/admin'
      window.location.href = target
      return null
    }
    return (
      <div className="public-page-outer">
        {themeTogglePortal}
        <div className="public-overlay-spacer" />
        <LoginPage />
        {publicFooter}
      </div>
    )
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

  const ADMIN_ROLES = ['admin', 'admin_empresa', 'superadmin']
  const SCANNER_ROLES = [...ADMIN_ROLES, 'staff']

  // Scanner es accesible para todos los roles autenticados, incluyendo superadmin
  if (currentView === 'scanner') {
    if (!SCANNER_ROLES.includes(currentUser.role)) {
      return <>{themeTogglePortal}<LoginPage /></>
    }
    return (
      <>
        <div className="public-page-outer">
          <div className="public-overlay-spacer" />
          <ScannerPage
            currentUser={currentUser}
            onLogout={handleLogout}
            evento={activeEvento}
            empresaConfig={empresaConfigFromCliente}
            dark={dark}
            onToggleTheme={toggleTheme}
            onBack={currentUser.role !== 'staff' ? () => {
              if (currentUser.role === 'superadmin' && !superadminClienteActivo && activeCliente) {
                setSuperadminClienteActivo(activeCliente)
              }
              const adminPath = brandingCliente?.slug
                ? `/e/${brandingCliente.slug}/admin`
                : '/admin'
              history.pushState(null, '', adminPath)
              setCurrentView('admin')
            } : null}
          />
          {publicFooter}
        </div>
      </>
    )
  }

  if (currentUser.role === 'superadmin' && !superadminClienteActivo) {
    return (
      <>
        <div className="public-page-outer">
          <div className="public-overlay-spacer" />
          <SuperAdminPage
            currentUser={currentUser}
            onLogout={handleLogout}
            onEnterPanel={(cliente) => setSuperadminClienteActivo(cliente)}
            dark={dark}
            onToggleTheme={toggleTheme}
          />
          {publicFooter}
        </div>
      </>
    )
  }

  if (!ADMIN_ROLES.includes(currentUser.role)) {
    window.location.href = '/scanner'
    return null
  }

  const sectionLabels = {
    'crear-evento': 'Crear nuevo evento',
    'evento-config': 'Configuración del evento',
    'horario': 'Horario del evento',
    'empresas-invitadas': 'Empresas invitadas',
    'categorias': 'Categorías de asistentes',
    'mapa': 'Mapa del evento',
    'trivia': 'Trivia por estación',
    'estacion-qr': 'QR por estación',
    'listado': 'Listado de asistentes',
    'dashboard': 'Dashboard de estaciones',
    'calificacion': 'Calificación del evento',
    'calificaciones-estaciones': 'Calificaciones de estaciones',
    'gestion-eventos': 'Gestionar eventos',
    'cerrar-evento': 'Cierre del evento',
  }

  return (
    <div className="app-shell">
      {superadminClienteActivo ? (
        <div className="superadmin-impersonate-bar">
          <span>
            Viendo panel de: <strong>{superadminClienteActivo.nombre}</strong>
          </span>
          <button
            type="button"
            className="ghost-action"
            onClick={() => setSuperadminClienteActivo(null)}
          >
            ← Volver al panel superadmin
          </button>
        </div>
      ) : null}
      <AdminHero
        attendeesCount={attendees.length}
        isFirebaseConfigured={isFirebaseConfigured}
        metrics={liveMetrics}
        currentUser={currentUser}
        onLogout={handleLogout}
        empresaConfig={empresaConfigFromCliente}
        dark={dark}
        onToggleTheme={toggleTheme}
        onOpenScanner={() => {
          const scannerPath = brandingCliente?.slug
            ? `/e/${brandingCliente.slug}/scanner`
            : '/scanner'
          window.open(scannerPath, '_blank')
        }}
      />

      <main className="content-grid">
        {eventos.length > 0 ? (
          <div className="evento-selector">
            <label>
              <span className="evento-selector-label">Evento activo:</span>
              <select
                value={activeEventoId}
                onChange={(event) => handleSelectEvento(event.target.value)}
              >
                {eventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.nombre || `Evento ${ev.id.slice(0, 6)}`}
                    {ev.archivado ? ' (archivado)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {activeEvento?.archivado ? (
              <span className="evento-selector-badge">Solo lectura</span>
            ) : null}
            {activeEvento && !activeEvento.archivado ? (
              (() => {
                const estado = getEstadoEvento(activeEvento)
                return (
                  <span
                    className={`evento-estado-pill estado-${estado.codigo}`}
                    title="Estado del evento basado en su horario"
                  >
                    {estado.label}
                  </span>
                )
              })()
            ) : null}
          </div>
        ) : null}

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

        {!activeEvento && eventosLoaded ? (
          <div className="no-evento-banner">
            <div>
              <strong>No hay ningún evento activo</strong>
              <p>Crea un evento en la sección de abajo para comenzar a usar el panel.</p>
            </div>
          </div>
        ) : null}

        {/* Admin navigation: sidebar + content */}
        <div className="admin-layout">

          {/* Hamburger toggle — visible only on mobile */}
          <button
            type="button"
            className="admin-menu-toggle"
            onClick={() => setAdminMenuOpen((o) => !o)}
            aria-label="Abrir menú de navegación"
          >
            <span className="admin-menu-toggle-icon">{adminMenuOpen ? '✕' : '☰'}</span>
            <span className="admin-menu-toggle-label">{sectionLabels[activeSectionId] || 'Menú'}</span>
            <span className="admin-menu-toggle-chevron">{adminMenuOpen ? '▲' : '▼'}</span>
          </button>

          {/* Overlay for mobile tap-to-close */}
          {adminMenuOpen && (
            <div className="admin-sidebar-overlay" onClick={() => setAdminMenuOpen(false)} />
          )}

          {/* Sidebar nav */}
          <nav className={`admin-sidebar${adminMenuOpen ? ' is-open' : ''}`}>

            <div className="admin-sidebar-section-label">Configuración</div>

            <button
              type="button"
              className={`admin-tile ${activeSectionId === 'crear-evento' ? 'is-active' : ''}`}
              onClick={() => { setActiveSectionId('crear-evento'); setAdminMenuOpen(false) }}
            >
              <span className="admin-tile-title">Crear nuevo evento</span>
              <span className="admin-tile-sub">Crea un evento independiente del activo</span>
            </button>

            {activeEvento ? (
              <>
                <button type="button" className={`admin-tile ${activeSectionId === 'evento-config' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('evento-config'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Configuración del evento</span>
                  <span className="admin-tile-sub">Modo de registro y QR del evento</span>
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'horario' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('horario'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Horario del evento</span>
                  <span className="admin-tile-sub">Inicio, fin y estado actual</span>
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'empresas-invitadas' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('empresas-invitadas'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Empresas invitadas</span>
                  <span className="admin-tile-sub">Configurar empresas y sus encuestas</span>
                  {empresasInvitadas.length > 0 ? <span className="admin-tile-badge">{empresasInvitadas.length}</span> : null}
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'categorias' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('categorias'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Categorías de asistentes</span>
                  <span className="admin-tile-sub">Tipos de asistente disponibles en el evento</span>
                  {categoriasEvento.length > 0 ? <span className="admin-tile-badge">{categoriasEvento.length}</span> : null}
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'mapa' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('mapa'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Mapa del evento</span>
                  <span className="admin-tile-sub">Editor de plano y estaciones con IA</span>
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'trivia' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('trivia'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Trivia por estación</span>
                  <span className="admin-tile-sub">Configura preguntas para cada punto del evento</span>
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'estacion-qr' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('estacion-qr'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">QR por estación</span>
                  <span className="admin-tile-sub">Imprime el QR de cada punto</span>
                </button>
              </>
            ) : null}

            <div className="admin-sidebar-section-label">Gestión en vivo</div>

            <button
              type="button"
              className={`admin-tile ${activeSectionId === 'listado' ? 'is-active' : ''}`}
              onClick={() => { setActiveSectionId('listado'); setAdminMenuOpen(false) }}
            >
              <span className="admin-tile-title">Listado de asistentes</span>
              <span className="admin-tile-sub">Control y aprobación de asistentes</span>
              {filteredAttendees.length > 0 ? <span className="admin-tile-badge">{filteredAttendees.length}</span> : null}
            </button>

            {activeEvento ? (
              <>
                <button type="button" className={`admin-tile ${activeSectionId === 'dashboard' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('dashboard'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Dashboard de estaciones</span>
                  <span className="admin-tile-sub">Estadísticas de visitas y trivia</span>
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'calificacion' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('calificacion'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Calificación del evento</span>
                  <span className="admin-tile-sub">Encuesta de satisfacción post-evento</span>
                </button>

                <button type="button" className={`admin-tile ${activeSectionId === 'calificaciones-estaciones' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('calificaciones-estaciones'); setAdminMenuOpen(false) }}>
                  <span className="admin-tile-title">Calificaciones de estaciones</span>
                  <span className="admin-tile-sub">Opiniones y estrellas por punto del evento</span>
                </button>
              </>
            ) : null}

            <div className="admin-sidebar-section-label">Cierre</div>

            <button type="button" className={`admin-tile ${activeSectionId === 'gestion-eventos' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('gestion-eventos'); setAdminMenuOpen(false) }}>
              <span className="admin-tile-title">Gestionar eventos</span>
              <span className="admin-tile-sub">Eliminar eventos archivados</span>
              {eventos.filter((e) => e.archivado).length > 0 ? <span className="admin-tile-badge">{eventos.filter((e) => e.archivado).length}</span> : null}
            </button>

            <button type="button" className={`admin-tile ${activeSectionId === 'cerrar-evento' ? 'is-active' : ''}`} onClick={() => { setActiveSectionId('cerrar-evento'); setAdminMenuOpen(false) }}>
              <span className="admin-tile-title">Cierre del evento</span>
              <span className="admin-tile-sub">Archivar el evento actual</span>
            </button>

          </nav>

          {/* Contenido de la sección activa */}
          <div className="admin-tile-content">
          {activeSectionId === 'listado' && (
            <AttendeeTableSection
              attendees={filteredAttendees}
              empresasMap={empresasMap}
              empresasInvitadas={empresasInvitadas}
              categorias={categoriasEvento}
              handleExportCsv={() => downloadAttendeesCsv(filteredAttendees)}
              handleViewQr={setViewingQrAttendee}
              handleBulkApprove={handleBulkApprove}
              isBulkApproving={isBulkApproving}
              handleBulkDelete={handleBulkDelete}
              isBulkDeleting={isBulkDeleting}
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
          )}

          {activeSectionId === 'crear-evento' && (
            <section className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Nuevo evento</p>
                <h2>Crear evento desde cero</h2>
                <p className="section-copy">
                  Crea un evento nuevo. El evento activo no se cierra; puedes cambiar entre eventos
                  desde el selector de arriba.
                </p>
              </div>
              <form className="crear-evento-form" onSubmit={handleCrearEvento}>
                <label className="field">
                  <span>Nombre del evento</span>
                  <input
                    type="text"
                    value={nuevoEventoNombre}
                    onChange={(e) => setNuevoEventoNombre(e.target.value)}
                    placeholder={`Evento ${new Date().toLocaleDateString('es-CO')}`}
                    disabled={isCreandoEvento}
                  />
                </label>
                {crearEventoError ? <p className="feedback error">{crearEventoError}</p> : null}
                <button type="submit" className="submit-button" disabled={isCreandoEvento}>
                  {isCreandoEvento ? 'Creando...' : 'Crear evento'}
                </button>
              </form>
            </section>
          )}

          {activeSectionId === 'empresas-invitadas' && activeEvento && (
            <EmpresasInvitadasPanel
              evento={activeEvento}
              onChange={handleEmpresasInvitadasChange}
            />
          )}

          {activeSectionId === 'categorias' && activeEvento && (
            <CategoriasPanel
              evento={activeEvento}
              onChange={(nextEvento) =>
                setEventos((current) =>
                  current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
                )
              }
            />
          )}

          {activeSectionId === 'evento-config' && activeEvento && (
            <KioskoQrPanel
              empresasInvitadas={empresasInvitadas}
              evento={activeEvento}
              empresaSlug={brandingCliente?.slug || ''}
              onEventoChange={(nextEvento) =>
                setEventos((current) =>
                  current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
                )
              }
            />
          )}

          {activeSectionId === 'horario' && activeEvento && (
            <HorarioEventoPanel
              evento={activeEvento}
              onEventoChange={(nextEvento) =>
                setEventos((current) =>
                  current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
                )
              }
            />
          )}

          {activeSectionId === 'calificacion' && activeEvento && (
            <CalificacionPanel
              evento={activeEvento}
              ratings={eventRatings}
              empresaSlug={brandingCliente?.slug || ''}
              empresasInvitadas={empresasInvitadas}
              onEventoChange={(nextEvento) =>
                setEventos((current) =>
                  current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
                )
              }
            />
          )}

          {activeSectionId === 'mapa' && activeEvento && (
            <MapEditorPanel
              evento={activeEvento}
              estaciones={estaciones}
              onEventoChange={(nextEvento) =>
                setEventos((current) =>
                  current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
                )
              }
            />
          )}

          {activeSectionId === 'trivia' && activeEvento && (
            <TriviaEditorPanel
              evento={activeEvento}
              estaciones={estaciones}
            />
          )}

          {activeSectionId === 'estacion-qr' && activeEvento && (
            <EstacionQRPanel
              evento={activeEvento}
              estaciones={estaciones}
            />
          )}

          {activeSectionId === 'dashboard' && activeEvento && (
            <EstacionesDashboard
              evento={activeEvento}
              estaciones={estaciones}
            />
          )}

          {activeSectionId === 'calificaciones-estaciones' && activeEvento && (
            <CalificacionEstacionesPanel
              evento={activeEvento}
              estaciones={estaciones}
            />
          )}

          {activeSectionId === 'gestion-eventos' && (
            <GestionEventosPanel
              eventos={eventos}
              activeEventoId={activeEventoId}
              attendees={attendees}
              ratings={ratings}
              onEliminados={(ids) => {
                const idSet = new Set(ids)
                setEventos((current) => current.filter((e) => !idSet.has(e.id)))
                setAttendees((current) =>
                  current.filter((a) => !idSet.has(a.eventoId)),
                )
                if (idSet.has(activeEventoId)) {
                  // si por algo eliminaron el activo (no debería, son archivados)
                  handleSelectEvento('')
                }
              }}
            />
          )}

          {activeSectionId === 'cerrar-evento' && (
            <CerrarEventoPanel
              evento={activeEvento}
              onCerrado={() => {
                setEventos((current) =>
                  current.map((e) =>
                    e.id === activeEventoId
                      ? { ...e, archivado: true, active: false, fechaCierre: new Date().toISOString() }
                      : e,
                  ),
                )
                const next = eventos.find((e) => e.id !== activeEventoId && !e.archivado)
                handleSelectEvento(next?.id || '')
              }}
              onEliminado={(eventoIdEliminado) => {
                setEventos((current) => current.filter((e) => e.id !== eventoIdEliminado))
                setAttendees((current) => current.filter((a) => a.eventoId !== eventoIdEliminado))
                setEventos((current) => {
                  const remaining = current
                  const next =
                    remaining.find((e) => !e.archivado) || remaining[0]
                  handleSelectEvento(next?.id || '')
                  return current
                })
              }}
            />
          )}
          </div>{/* end admin-tile-content */}
        </div>{/* end admin-layout */}
      </main>

      <DeleteConfirmModal
        attendee={pendingDeleteAttendee}
        isDeleting={Boolean(isDeletingId)}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />

      {editingAttendeeId ? (
        <EditAttendeeModal
          attendee={eventAttendees.find((a) => a.id === editingAttendeeId) || null}
          form={form}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onCancel={handleCancelEdit}
          empresasInvitadas={empresasInvitadas}
          categorias={categoriasEvento}
        />
      ) : null}

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

import { useEffect, useMemo, useState } from 'react'
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
import { listEventos } from './eventosStore'
import { subscribeToRatings } from './ratingsStore'
import AdminHero from './components/AdminHero'
import AdminRegistrationPanel from './components/AdminRegistrationPanel'
import AttendeeTableSection from './components/AttendeeTableSection'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import AdminSection from './components/AdminSection'
import CalificacionPage from './components/CalificacionPage'
import CalificacionPanel from './components/CalificacionPanel'
import CategoriasPanel from './components/CategoriasPanel'
import CerrarEventoPanel from './components/CerrarEventoPanel'
import GestionEventosPanel from './components/GestionEventosPanel'
import HorarioEventoPanel, { getEstadoEvento } from './components/HorarioEventoPanel'
import EmpresasInvitadasPanel from './components/EmpresasInvitadasPanel'
import KioskoQrPanel from './components/KioskoQrPanel'
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
  registrationMode: 'pre',
  surveyAnswers: {},
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

  if (path === '/calificar') {
    return 'rating'
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
  const [currentView, setCurrentView] = useState(getCurrentView)
  const [form, setForm] = useState(initialForm)
  const [publicForm, setPublicForm] = useState(initialPublicForm)
  const [publicUrlOptions] = useState(getPublicUrlOptions)
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
  const [publicLookupStatus, setPublicLookupStatus] = useState('idle')
  const [attendees, setAttendees] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [eventos, setEventos] = useState([])
  const [eventosLoaded, setEventosLoaded] = useState(false)
  const [ratings, setRatings] = useState([])
  const [activeEventoIdState, setActiveEventoIdState] = useState(() => {
    try {
      return localStorage.getItem('asistencia-evento:activeEventoId') || ''
    } catch {
      return ''
    }
  })
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
      .then((items) => {
        setEventos(items)
        setEventosLoaded(true)
      })
      .catch((error) => {
        console.error(error)
        setEventosLoaded(true)
      })
  }, [])

  useEffect(() => {
    const target = publicUrlOptions.empresaParam
    if (!target || currentView !== 'public') return
    setPublicForm((current) => {
      if (current.empresaInvitadaId === target) return current
      return { ...current, empresaInvitadaId: target, surveyAnswers: {} }
    })
  }, [publicUrlOptions.empresaParam, currentView])

  useEffect(() => {
    if (currentView !== 'public' || !publicUrlOptions.kiosk) return
    setPublicForm((current) => {
      if (current.registrationMode === 'onsite') return current
      return { ...current, registrationMode: 'onsite' }
    })
  }, [publicUrlOptions.kiosk, currentView])

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
      const isOnSite =
        publicUrlOptions.kiosk ||
        eventoModo === 'onsite' ||
        (eventoModo === 'both' && publicForm.registrationMode === 'onsite')
      const attendee = buildAttendeePayload(publicForm, {
        source: isOnSite ? 'kiosk-registration' : 'public-registration',
        status: isOnSite ? 'approved' : 'pre-registered',
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

  const eventAttendees = useMemo(() => {
    if (!activeEventoId) return attendees
    return attendees.filter(
      (a) => !a.eventoId || a.eventoId === activeEventoId,
    )
  }, [attendees, activeEventoId])

  const eventRatings = useMemo(() => {
    if (!activeEventoId) return ratings
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
      const key = (a.organization || '').trim().toLowerCase()
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

    return matchesQuery && matchesType && matchesStatus && matchesEmpresa
  })

  if (currentView === 'public') {
    return (
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
        eventoLoaded={eventosLoaded}
        onResetSubmission={() => {
          setPublicSubmission(null)
          setPublicForm(initialPublicForm)
          setPublicLookupStatus('idle')
        }}
      />
    )
  }

  if (currentView === 'rating') {
    return (
      <CalificacionPage
        evento={activeEvento}
        empresasInvitadas={empresasInvitadas}
        eventoLoaded={eventosLoaded}
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
    return (
      <ScannerPage
        currentUser={currentUser}
        onLogout={handleLogout}
        evento={activeEvento}
      />
    )
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

        <AdminSection
          id="registro-manual"
          title="Registro manual"
          subtitle="Crear asistente desde el panel"
          defaultOpen={false}
        >
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
            categorias={categoriasEvento}
          />
        </AdminSection>

        <AdminSection
          id="empresas-invitadas"
          title="Empresas invitadas"
          subtitle="Configurar empresas y sus encuestas"
          badge={empresasInvitadas.length}
          defaultOpen={false}
        >
          <EmpresasInvitadasPanel
            evento={activeEvento}
            onChange={handleEmpresasInvitadasChange}
          />
        </AdminSection>

        <AdminSection
          id="categorias"
          title="Categorías de asistentes"
          subtitle="Tipos de asistente disponibles en el evento"
          badge={categoriasEvento.length}
          defaultOpen={false}
        >
          <CategoriasPanel
            evento={activeEvento}
            onChange={(nextEvento) =>
              setEventos((current) =>
                current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
              )
            }
          />
        </AdminSection>

        <AdminSection
          id="evento-config"
          title="Configuración del evento"
          subtitle="Modo de registro y QR del evento"
          defaultOpen={false}
        >
          <KioskoQrPanel
            empresasInvitadas={empresasInvitadas}
            evento={activeEvento}
            onEventoChange={(nextEvento) =>
              setEventos((current) =>
                current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
              )
            }
          />
        </AdminSection>

        <AdminSection
          id="horario"
          title="Horario del evento"
          subtitle="Inicio, fin y estado actual"
          defaultOpen={false}
        >
          <HorarioEventoPanel
            evento={activeEvento}
            onEventoChange={(nextEvento) =>
              setEventos((current) =>
                current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
              )
            }
          />
        </AdminSection>

        <AdminSection
          id="calificacion"
          title="Calificación del evento"
          subtitle="Encuesta de satisfacción post-evento"
          defaultOpen={false}
        >
          <CalificacionPanel
            evento={activeEvento}
            ratings={eventRatings}
            empresasInvitadas={empresasInvitadas}
            onEventoChange={(nextEvento) =>
              setEventos((current) =>
                current.map((e) => (e.id === nextEvento.id ? nextEvento : e)),
              )
            }
          />
        </AdminSection>

        <AdminSection
          id="gestion-eventos"
          title="Gestionar eventos guardados"
          subtitle="Eliminar eventos archivados (uno o varios)"
          badge={eventos.filter((e) => e.archivado).length}
          defaultOpen={false}
        >
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
        </AdminSection>

        <AdminSection
          id="cerrar-evento"
          title="Cierre del evento"
          subtitle="Archivar evento actual y empezar uno nuevo"
          defaultOpen={false}
        >
          <CerrarEventoPanel
            evento={activeEvento}
            onCerrado={(nuevoEvento) => {
              setEventos((current) => {
                // marcar el actual como archivado en estado local
                const updated = current.map((e) =>
                  e.id === activeEventoId
                    ? { ...e, archivado: true, active: false, fechaCierre: new Date().toISOString() }
                    : e,
                )
                return [nuevoEvento, ...updated]
              })
              handleSelectEvento(nuevoEvento.id)
            }}
            onEliminado={(eventoIdEliminado) => {
              // Quitar del estado local y limpiar asistentes asociados
              setEventos((current) => current.filter((e) => e.id !== eventoIdEliminado))
              setAttendees((current) => current.filter((a) => a.eventoId !== eventoIdEliminado))
              // Cambiar a otro evento (el primer no archivado, o el primero disponible)
              setEventos((current) => {
                const remaining = current
                const next =
                  remaining.find((e) => !e.archivado) || remaining[0]
                handleSelectEvento(next?.id || '')
                return current
              })
            }}
          />
        </AdminSection>

        <AdminSection
          id="listado"
          title="Listado de asistentes"
          subtitle="Control y aprobación de asistentes"
          badge={filteredAttendees.length}
          defaultOpen={true}
        >
          <AttendeeTableSection
            attendees={filteredAttendees}
            empresasMap={empresasMap}
            empresasInvitadas={empresasInvitadas}
            categorias={categoriasEvento}
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
        </AdminSection>
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

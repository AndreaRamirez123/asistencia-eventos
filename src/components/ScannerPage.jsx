import { useEffect, useMemo, useRef, useState } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import QRCode from 'qrcode'
import { performCheckin } from '../attendeesStore'
import ScannerInstructions from './ScannerInstructions'
import KioskoInstructions from './KioskoInstructions'

const ACCESS_POINT_KEY = 'asistencia-evento:accessPoint'

function toAccessPointValue(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entrada'
}

function loadStoredAccessPoint() {
  try {
    return localStorage.getItem(ACCESS_POINT_KEY) || ''
  } catch {
    return ''
  }
}

const feedbackStyles = {
  ok: { tone: 'online', title: 'Ingreso validado' },
  duplicate: { tone: 'alert', title: 'QR duplicado bloqueado' },
  'not-found': { tone: 'alert', title: 'QR no reconocido' },
  'not-approved': { tone: 'alert', title: 'Asistente sin aprobar' },
  invalid: { tone: 'alert', title: 'QR invalido' },
  error: { tone: 'alert', title: 'Error de conexion' },
}

const EXPRESS_MODE_KEY = 'asistencia-evento:expressMode'

function loadExpressMode() {
  try {
    return localStorage.getItem(EXPRESS_MODE_KEY) === '1'
  } catch {
    return false
  }
}

function ScannerPage({ currentUser, onLogout, evento, empresaConfig = null, onBack }) {
  const accessPoints = (() => {
    const puntos = evento?.puntosAcceso
    if (Array.isArray(puntos) && puntos.length > 0) {
      return puntos.map((label) => ({ value: toAccessPointValue(label), label }))
    }
    return []
  })()
  const showAccessSelector = accessPoints.length > 1

  const [accessPoint, setAccessPoint] = useState(() => {
    const saved = loadStoredAccessPoint()
    if (accessPoints.length === 0) return saved || 'entrada'
    const found = accessPoints.find((p) => p.value === saved)
    return found ? saved : accessPoints[0].value
  })
  const [isScanning, setIsScanning] = useState(true)
  const [cameraSupported, setCameraSupported] = useState(true)
  const [manualInput, setManualInput] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [history, setHistory] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expressMode, setExpressMode] = useState(loadExpressMode)
  const [miEventoQr, setMiEventoQr] = useState('')
  const lastTokenRef = useRef({ token: '', at: 0 })
  const autoResumeRef = useRef(null)
  const cameraErrorHandledRef = useRef(false)

  const sendCheckin = async (payload) => {
    setIsSubmitting(true)
    setIsScanning(false)
    if (autoResumeRef.current) {
      clearTimeout(autoResumeRef.current)
      autoResumeRef.current = null
    }

    let result
    try {
      const data = await performCheckin({
        ...payload,
        accessPoint,
        checkedInBy: currentUser?.email || '',
        checkedInByName: currentUser?.displayName || '',
      })

      result = {
        status: data.status,
        message: data.message,
        attendee: data.item || null,
        accessPoint,
        scannedAt: new Date().toISOString(),
      }

      setLastResult(result)
      setHistory((current) => [result, ...current].slice(0, 8))
    } catch (error) {
      result = {
        status: 'error',
        message: error.message || 'No fue posible registrar el check-in.',
        attendee: null,
        accessPoint,
        scannedAt: new Date().toISOString(),
      }
      setLastResult(result)
    } finally {
      setIsSubmitting(false)
    }

    // Solo auto-resume en duplicados y errores leves; 'ok' muestra el QR de estaciones
    // y espera a que el staff presione "Escanear siguiente"
    const shouldAutoResume = result?.status === 'duplicate'
    if (shouldAutoResume) {
      const delay = expressMode ? 800 : 1500
      autoResumeRef.current = setTimeout(() => {
        setLastResult(null)
        lastTokenRef.current = { token: '', at: 0 }
        setIsScanning(true)
        autoResumeRef.current = null
      }, delay)
    }
  }

  const handleManualSubmit = async (event) => {
    event.preventDefault()
    const value = manualInput.trim()
    if (!value || isSubmitting) {
      return
    }

    let payload = null

    if (value.startsWith('{')) {
      try {
        const parsed = JSON.parse(value)
        if (parsed.token) {
          payload = { qrToken: parsed.token }
        }
      } catch {
        payload = null
      }
    }

    if (!payload) {
      payload = /^\d+$/.test(value) ? { documentId: value } : { qrToken: value }
    }

    await sendCheckin(payload)
    setManualInput('')
  }

  const handleAccessPointChange = (event) => {
    const next = event.target.value
    setAccessPoint(next)
    try {
      localStorage.setItem(ACCESS_POINT_KEY, next)
    } catch {
      // localStorage not available, ignore
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(ACCESS_POINT_KEY, accessPoint)
    } catch {
      // localStorage not available, ignore
    }
  }, [accessPoint])

  useEffect(() => {
    try {
      localStorage.setItem(EXPRESS_MODE_KEY, expressMode ? '1' : '0')
    } catch {
      // ignore
    }
  }, [expressMode])

  useEffect(() => {
    return () => {
      if (autoResumeRef.current) {
        clearTimeout(autoResumeRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (lastResult?.status !== 'ok' || !lastResult?.attendee?.documentId) {
      setMiEventoQr('')
      return
    }
    const docId = lastResult.attendee.documentId
    const slug = empresaConfig?.slug
    const url = slug
      ? `${window.location.origin}/e/${slug}/mi-evento?doc=${docId}`
      : `${window.location.origin}/mi-evento?doc=${docId}`
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#13212d', light: '#fffaf1' } })
      .then(setMiEventoQr)
      .catch(() => setMiEventoQr(''))
  }, [lastResult?.status, lastResult?.attendee?.documentId, empresaConfig?.slug])

  const resumeScan = () => {
    setLastResult(null)
    lastTokenRef.current = { token: '', at: 0 }
    cameraErrorHandledRef.current = false
    setCameraSupported(true)
    setIsScanning(true)
  }

  const handleScan = async (detected) => {
    if (!detected || detected.length === 0 || isSubmitting) {
      return
    }

    const rawValue = detected[0]?.rawValue || ''
    if (!rawValue || rawValue.length > 2000) {
      return
    }

    let qrToken = ''
    try {
      const parsed = JSON.parse(rawValue)
      qrToken = parsed.token || ''
    } catch {
      qrToken = rawValue
    }

    if (!qrToken) {
      return
    }

    const now = Date.now()
    if (
      qrToken === lastTokenRef.current.token &&
      now - lastTokenRef.current.at < 2500
    ) {
      return
    }
    lastTokenRef.current = { token: qrToken, at: now }

    await sendCheckin({ qrToken })
  }

  const handleError = (error) => {
    // Evitar múltiples setState por errores repetidos de la librería de cámara
    if (cameraErrorHandledRef.current) return
    const message = String(error?.message || error || '').toLowerCase()
    const noCamara =
      message.includes('permission') ||
      message.includes('notallowed') ||
      message.includes('not allowed') ||
      message.includes('notfound') ||
      message.includes('not found') ||
      message.includes('devicenotfound') ||
      message.includes('device not found') ||
      message.includes('could not start') ||
      message.includes('no camera') ||
      error?.name === 'NotFoundError' ||
      error?.name === 'NotAllowedError' ||
      error?.name === 'NotReadableError'
    if (noCamara) {
      cameraErrorHandledRef.current = true
      setCameraSupported(false)
      setIsScanning(false)
    }
  }

  const feedback = lastResult ? feedbackStyles[lastResult.status] || feedbackStyles.error : null

  const kioskoEnabled = Boolean(evento?.registroEnSitio)
  const kioskoEmpresaId = evento?.registroEnSitioEmpresaId || ''
  const [showStaffMode, setShowStaffMode] = useState(false)

  const kioskoUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const base = empresaConfig?.slug
      ? `${window.location.origin}/e/${empresaConfig.slug}`
      : window.location.origin
    const params = new URLSearchParams({ kiosk: '1' })
    if (kioskoEmpresaId) params.set('empresa', kioskoEmpresaId)
    // Incluir clienteId como fallback cuando no hay slug, para que el registro cargue el branding
    if (!empresaConfig?.slug && empresaConfig?.id) params.set('cliente', empresaConfig.id)
    return `${base}/registro?${params.toString()}`
  }, [kioskoEmpresaId, empresaConfig?.slug, empresaConfig?.id])

  const [kioskoQrDataUrl, setKioskoQrDataUrl] = useState('')
  useEffect(() => {
    if (!kioskoEnabled) return
    let cancelled = false
    QRCode.toDataURL(kioskoUrl, {
      width: 720,
      margin: 2,
      color: { dark: '#13212d', light: '#fffaf1' },
    })
      .then((dataUrl) => {
        if (!cancelled) setKioskoQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setKioskoQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [kioskoEnabled, kioskoUrl])

  const modoRegistro = evento?.modoRegistro || (evento?.registroEnSitio ? 'onsite' : 'pre')
  const isOnsite = modoRegistro === 'onsite' || modoRegistro === 'both'

  const brandColor = empresaConfig?.colorPrimario || empresaConfig?.colorAcento || ''
  const brandSecondary = empresaConfig?.colorSecundario || brandColor
  // Solo aplicar inline cuando hay color de empresa; si no, el var global de App.jsx toma el control
  const brandStyle = brandColor
    ? { '--accent': brandColor, '--accent-strong': brandSecondary || brandColor }
    : {}

  if (kioskoEnabled && !showStaffMode) {
    return (
      <div className="scanner-kiosko" style={brandStyle}>
        <header className="scanner-kiosko-head">
          <div>
            {empresaConfig?.logoUrl ? (
              <img
                src={empresaConfig.logoUrl}
                alt={empresaConfig.nombre || 'Logo'}
                className="empresa-logo-hero"
                style={{ marginBottom: 12 }}
              />
            ) : null}
            <p className="eyebrow">Registro en sitio</p>
            <h1>Escanea este QR para registrarte</h1>
            <p className="hero-text">
              {isOnsite
                ? 'Apunta la camara de tu celular al codigo, llena tus datos y queda registrado.'
                : 'Apunta la camara de tu celular al codigo. Llena tus datos y recibe tu QR de ingreso.'}
            </p>
          </div>
          <div className="scanner-kiosko-actions">
            <button
              type="button"
              className="ghost-action"
              onClick={() => setShowStaffMode(true)}
            >
              Modo staff (validar QR)
            </button>
            {onLogout ? (
              <button type="button" className="ghost-action" onClick={onLogout}>
                Cerrar sesion
              </button>
            ) : null}
          </div>
        </header>

        <div className="scanner-kiosko-body">
          <div className="scanner-kiosko-qr-wrap">
            {kioskoQrDataUrl ? (
              <img
                className="scanner-kiosko-qr"
                src={kioskoQrDataUrl}
                alt="QR de registro"
              />
            ) : (
              <div className="qr-placeholder">
                <span>Generando...</span>
              </div>
            )}
            <p className="scanner-kiosko-url">{kioskoUrl}</p>
          </div>

          <KioskoInstructions />
        </div>
      </div>
    )
  }

  return (
    <div className="public-shell" style={brandStyle}>
      <header className="public-hero">
        <div>
          {empresaConfig?.logoUrl ? (
            <img
              src={empresaConfig.logoUrl}
              alt={empresaConfig.nombre || 'Logo'}
              className="empresa-logo-hero"
            />
          ) : null}
          <p className="eyebrow">Control de ingreso</p>
          <h1>Scanner QR para validacion de asistentes</h1>
          <p className="hero-text">
            Apunta la camara al codigo QR del asistente. El sistema valida, registra la hora y
            bloquea duplicados automaticamente.
          </p>
        </div>

        <div className="public-status">
          {showAccessSelector ? (
            <label className="toolbar-field">
              <span>Punto de acceso</span>
              <select value={accessPoint} onChange={handleAccessPointChange}>
                {accessPoints.map((point) => (
                  <option key={point.value} value={point.value}>
                    {point.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="checkbox-field express-toggle" title="Reduce el tiempo entre escaneos para flujos rapidos (40+ personas/min)">
            <input
              type="checkbox"
              checked={expressMode}
              onChange={(event) => setExpressMode(event.target.checked)}
            />
            <span>Modo Express (alta velocidad)</span>
          </label>
          {kioskoEnabled ? (
            <button
              type="button"
              className="ghost-action"
              onClick={() => setShowStaffMode(false)}
            >
              ← Modo kiosko
            </button>
          ) : null}
          {onBack ? (
            <button type="button" className="ghost-action" onClick={onBack}>
              ← Panel admin
            </button>
          ) : ['admin', 'superadmin', 'admin_empresa'].includes(currentUser?.role) ? (
            <a href="/admin" className="secondary-action">
              ← Panel admin
            </a>
          ) : null}
          {onLogout ? (
            <button type="button" className="ghost-action" onClick={onLogout}>
              Cerrar sesion
            </button>
          ) : null}
        </div>
      </header>

      <section className="scanner-context-banner">
        <div>
          <p className="eyebrow">Estas validando en</p>
          <strong className="banner-point">
            {accessPoints.find((p) => p.value === accessPoint)?.label || (showAccessSelector ? accessPoint : 'Entrada')}
          </strong>
        </div>
        <div>
          <p className="eyebrow">Staff de turno</p>
          <strong className="banner-staff">
            {currentUser?.displayName || currentUser?.email || 'Sin sesion'}
          </strong>
        </div>
      </section>

      <section className="panel public-panel">
        <div className="panel-heading">
          <p className="eyebrow">Camara activa</p>
          <h2>Escaneo en vivo</h2>
        </div>

        <div className="registration-layout">
          <div className="attendee-form">
            <div className="scanner-frame">
              {isScanning && cameraSupported ? (
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{ facingMode: 'environment' }}
                  styles={{ container: { width: '100%' } }}
                />
              ) : (
                <div className="qr-placeholder" aria-hidden="true">
                  <span>{cameraSupported ? 'PAUSADO' : 'SIN CAMARA'}</span>
                </div>
              )}
            </div>

            {cameraSupported && !isScanning ? (
              <button type="button" className="submit-button" onClick={resumeScan}>
                Escanear siguiente asistente
              </button>
            ) : (
              <p className="helper-text">
                {!cameraSupported
                  ? 'No se detecto camara. Usa la entrada manual abajo.'
                  : isSubmitting
                    ? 'Validando QR...'
                    : 'Camara lista para escanear.'}
              </p>
            )}

            <form className="manual-checkin" onSubmit={handleManualSubmit}>
              <label className="field">
                <span>Busqueda manual (documento o token QR)</span>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(event) => setManualInput(event.target.value)}
                  placeholder="Ej. 1032456789 o evt-..."
                  disabled={isSubmitting}
                />
              </label>
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting || !manualInput.trim()}
              >
                {isSubmitting ? 'Validando...' : 'Validar ingreso manual'}
              </button>
            </form>
          </div>

          <aside className={`preview-card${lastResult && feedback ? '' : ' preview-card-guide'}`}>
            {lastResult && feedback ? (
              <>
                <p className="eyebrow">Resultado</p>
                <div
                  className={`result-animation result-${lastResult.status}`}
                  key={lastResult.scannedAt}
                  aria-hidden="true"
                >
                  <span className="result-icon">
                    {lastResult.status === 'ok'
                      ? '\u2713'
                      : lastResult.status === 'duplicate'
                        ? '!'
                        : lastResult.status === 'not-approved'
                          ? '\u23F3'
                          : lastResult.status === 'not-found'
                            ? '?'
                            : '\u2715'}
                  </span>
                  <span className="result-ring" />
                </div>
                <h3>{feedback.title}</h3>
                <span className={`status-pill ${feedback.tone}`}>{lastResult.status}</span>
                {lastResult.attendee ? (
                  <>
                    <div className="preview-meta">
                      <span>Asistente: {lastResult.attendee.fullName}</span>
                      <span>Documento: {lastResult.attendee.documentId}</span>
                      <span>Categoria: {lastResult.attendee.attendeeType}</span>
                      <span>Estado: {lastResult.attendee.status}</span>
                      <span>Punto: {lastResult.accessPoint}</span>
                    </div>
                    {lastResult.status !== 'ok' ? (
                      <p className="preview-copy">{lastResult.message}</p>
                    ) : null}
                    {lastResult.status === 'ok' && miEventoQr ? (
                      <div className="scanner-mi-evento-wrap">
                        <p className="eyebrow" style={{ marginTop: 12, marginBottom: 4 }}>Recorrido de estaciones</p>
                        <p className="helper-text" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
                          El visitante puede escanear este QR para iniciar su recorrido
                        </p>
                        <img src={miEventoQr} alt="QR mis estaciones" className="scanner-mi-evento-qr" />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="preview-copy">{lastResult.message}</p>
                )}
              </>
            ) : (
              <ScannerInstructions />
            )}
          </aside>
        </div>

        {history.length > 0 ? (
          <div className="attendee-table" role="table" aria-label="Historial de escaneos">
            <div className="attendee-row attendee-head" role="row">
              <span>Hora</span>
              <span>Asistente</span>
              <span>Estado</span>
              <span>Punto</span>
            </div>
            {history.map((item, index) => (
              <div key={`${item.scannedAt}-${index}`} className="attendee-row" role="row">
                <span>{new Date(item.scannedAt).toLocaleTimeString('es-CO')}</span>
                <span>{item.attendee?.fullName || '—'}</span>
                <span>{item.status}</span>
                <span>{item.accessPoint}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default ScannerPage

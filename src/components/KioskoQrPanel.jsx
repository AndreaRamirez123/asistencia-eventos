import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { updateEvento } from '../eventosStore'

function buildKioskUrl({ empresaId }) {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  const params = new URLSearchParams({ kiosk: '1' })
  if (empresaId) params.set('empresa', empresaId)
  return `${origin}/registro?${params.toString()}`
}

function KioskoQrPanel({ empresasInvitadas = [], evento, onEventoChange }) {
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copyState, setCopyState] = useState('')

  const url = useMemo(
    () => buildKioskUrl({ empresaId: selectedEmpresaId }),
    [selectedEmpresaId],
  )

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 560,
      margin: 2,
      color: { dark: '#13212d', light: '#fffaf1' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const selectedLabel =
    empresasInvitadas.find((e) => e.id === selectedEmpresaId)?.nombre ||
    'Sin empresa (registro general)'

  const modoRegistro =
    evento?.modoRegistro || (evento?.registroEnSitio ? 'onsite' : 'pre')
  const [isTogglingMode, setIsTogglingMode] = useState(false)
  const [modeError, setModeError] = useState('')

  const handleModoChange = async (event) => {
    if (!evento) return
    const next = event.target.value
    setIsTogglingMode(true)
    setModeError('')
    try {
      const isOnsite = next === 'onsite' || next === 'both'
      await updateEvento(evento.id, {
        modoRegistro: next,
        registroEnSitio: isOnsite,
        registroEnSitioEmpresaId: isOnsite ? selectedEmpresaId : '',
      })
      onEventoChange?.({
        ...evento,
        modoRegistro: next,
        registroEnSitio: isOnsite,
        registroEnSitioEmpresaId: isOnsite ? selectedEmpresaId : '',
      })
    } catch (err) {
      setModeError(err.message || 'No fue posible guardar el modo.')
    } finally {
      setIsTogglingMode(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyState('copiado')
      setTimeout(() => setCopyState(''), 2000)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState(''), 2000)
    }
  }

  const handlePrint = () => {
    if (!qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>QR registro - ${selectedLabel}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
            h1 { margin: 0 0 8px; font-size: 28px; }
            p { color: #555; margin: 0 0 24px; }
            img { width: 80%; max-width: 520px; }
            .url { margin-top: 18px; font-size: 12px; color: #888; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1>Registro al evento</h1>
          <p>${selectedLabel}</p>
          <p>Escanea con la camara de tu celular para registrarte.</p>
          <img src="${qrDataUrl}" alt="QR registro" />
          <div class="url">${url}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Configuración del evento</p>
        <h2>Modo de registro y QR del evento</h2>
      </div>

      <div className="kiosko-mode">
        <p className="eyebrow">Modo de registro de este evento</p>
        <div className="modo-options">
          <label className={`modo-card ${modoRegistro === 'pre' ? 'active' : ''}`}>
            <input
              type="radio"
              name="modoRegistro"
              value="pre"
              checked={modoRegistro === 'pre'}
              onChange={handleModoChange}
              disabled={isTogglingMode}
            />
            <div>
              <strong>Pre-registro desde casa</strong>
              <p>Los asistentes se inscriben antes y llegan con su QR. El scanner valida los QR.</p>
            </div>
          </label>

          <label className={`modo-card ${modoRegistro === 'onsite' ? 'active' : ''}`}>
            <input
              type="radio"
              name="modoRegistro"
              value="onsite"
              checked={modoRegistro === 'onsite'}
              onChange={handleModoChange}
              disabled={isTogglingMode}
            />
            <div>
              <strong>Registro en sitio</strong>
              <p>Los asistentes llegan al evento, escanean el QR de abajo y se registran ahí. No necesitan QR.</p>
            </div>
          </label>

        </div>
        {modeError ? <p className="feedback error">{modeError}</p> : null}
      </div>

      <div className="kiosko-layout">
        <div className="kiosko-controls">
          <label className="field">
            <span>Empresa invitada (opcional)</span>
            <select
              value={selectedEmpresaId}
              onChange={(event) => setSelectedEmpresaId(event.target.value)}
            >
              <option value="">Sin empresa (registro general)</option>
              {empresasInvitadas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
            <small className="helper-text">
              Si seleccionas una empresa, el form se abre con esa empresa ya elegida y muestra su
              encuesta (si tiene).
            </small>
          </label>

          <label className="field">
            <span>URL del QR</span>
            <input type="text" value={url} readOnly onFocus={(e) => e.target.select()} />
          </label>

          <div className="kiosko-actions">
            <button type="button" className="ghost-action" onClick={handleCopy}>
              {copyState === 'copiado'
                ? 'Copiado'
                : copyState === 'error'
                  ? 'No se pudo copiar'
                  : 'Copiar URL'}
            </button>
            {qrDataUrl ? (
              <a
                className="ghost-action"
                href={qrDataUrl}
                download={`qr-registro-${selectedEmpresaId || 'general'}.png`}
              >
                Descargar PNG
              </a>
            ) : null}
            <button
              type="button"
              className="submit-button"
              onClick={handlePrint}
              disabled={!qrDataUrl}
            >
              Imprimir
            </button>
          </div>
        </div>

        <div className="kiosko-preview">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR de registro" className="kiosko-qr-image" />
          ) : (
            <div className="qr-placeholder">
              <span>QR</span>
            </div>
          )}
          <p className="helper-text kiosko-label">{selectedLabel}</p>
        </div>
      </div>
    </section>
  )
}

export default KioskoQrPanel

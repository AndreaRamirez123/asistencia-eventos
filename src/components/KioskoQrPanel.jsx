import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { updateEvento } from '../eventosStore'

function buildUrl(slug, kiosk = false) {
  if (typeof window === 'undefined') return ''
  const base = slug
    ? `${window.location.origin}/e/${slug}`
    : window.location.origin
  return kiosk ? `${base}/registro?kiosk=1` : `${base}/registro`
}

async function generateQr(url) {
  return QRCode.toDataURL(url, {
    width: 560,
    margin: 2,
    color: { dark: '#13212d', light: '#fffaf1' },
  })
}

function KioskoQrPanel({ evento, onEventoChange, empresaSlug = '' }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [preQrDataUrl, setPreQrDataUrl] = useState('')
  const [copyState, setCopyState] = useState('')
  const [preCopyState, setPreCopyState] = useState('')

  const kioskUrl = buildUrl(empresaSlug, true)
  const preUrl = buildUrl(empresaSlug, false)

  useEffect(() => {
    let cancelled = false
    generateQr(kioskUrl)
      .then((dataUrl) => { if (!cancelled) setQrDataUrl(dataUrl) })
      .catch(() => { if (!cancelled) setQrDataUrl('') })
    return () => { cancelled = true }
  }, [kioskUrl])

  useEffect(() => {
    let cancelled = false
    generateQr(preUrl)
      .then((dataUrl) => { if (!cancelled) setPreQrDataUrl(dataUrl) })
      .catch(() => { if (!cancelled) setPreQrDataUrl('') })
    return () => { cancelled = true }
  }, [preUrl])

  const modoRegistroFromProp =
    evento?.modoRegistro || (evento?.registroEnSitio ? 'onsite' : 'pre')
  const [pendingModo, setPendingModo] = useState(null)
  const modoRegistro = pendingModo ?? modoRegistroFromProp
  const [isTogglingMode, setIsTogglingMode] = useState(false)
  const [modeError, setModeError] = useState('')

  const handleModoChange = async (event) => {
    if (!evento) return
    const next = event.target.value
    const isOnsite = next === 'onsite' || next === 'both'
    setPendingModo(next)
    setIsTogglingMode(true)
    setModeError('')
    try {
      await updateEvento(evento.id, {
        modoRegistro: next,
        registroEnSitio: isOnsite,
      })
      onEventoChange?.({
        ...evento,
        modoRegistro: next,
        registroEnSitio: isOnsite,
      })
      setPendingModo(null)
    } catch (err) {
      setPendingModo(null)
      setModeError(err.message || 'No fue posible guardar el modo.')
    } finally {
      setIsTogglingMode(false)
    }
  }

  const handleCopy = async (targetUrl, setter) => {
    try {
      await navigator.clipboard.writeText(targetUrl)
      setter('copiado')
      setTimeout(() => setter(''), 2000)
    } catch {
      setter('error')
      setTimeout(() => setter(''), 2000)
    }
  }

  const handlePrint = (targetUrl, targetQr, label) => {
    if (!targetQr) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>QR registro - Evento</title>
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
          <p>${label}</p>
          <p>Escanea con la camara de tu celular para registrarte.</p>
          <img src="${targetQr}" alt="QR registro" />
          <div class="url">${targetUrl}</div>
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

      {/* Pre-registro: mostrar URL y QR para compartir con asistentes */}
      {modoRegistro === 'pre' && (
        <div className="kiosko-layout">
          <div className="kiosko-controls">
            <p className="helper-text">
              Comparte este enlace o QR con los asistentes para que se pre-registren desde casa. Llegarán al evento con su código QR.
            </p>
            <label className="field">
              <span>URL de pre-registro (para compartir)</span>
              <input type="text" value={preUrl} readOnly onFocus={(e) => e.target.select()} />
            </label>
            <div className="kiosko-actions">
              <button type="button" className="ghost-action" onClick={() => handleCopy(preUrl, setPreCopyState)}>
                {preCopyState === 'copiado' ? '✓ Copiado' : preCopyState === 'error' ? 'No se pudo copiar' : 'Copiar URL'}
              </button>
              {preQrDataUrl ? (
                <a className="ghost-action" href={preQrDataUrl} download="qr-preregistro-evento.png">
                  Descargar PNG
                </a>
              ) : null}
              <button type="button" className="submit-button" onClick={() => handlePrint(preUrl, preQrDataUrl, 'Pre-registro desde casa')} disabled={!preQrDataUrl}>
                Imprimir
              </button>
            </div>
          </div>

          <div className="kiosko-preview">
            {preQrDataUrl ? (
              <img src={preQrDataUrl} alt="QR de pre-registro" className="kiosko-qr-image" />
            ) : (
              <div className="qr-placeholder"><span>QR</span></div>
            )}
            <p className="helper-text kiosko-label">Pre-registro desde casa</p>
          </div>
        </div>
      )}

      {modoRegistro !== 'pre' && (
        <div className="kiosko-layout">
          <div className="kiosko-controls">
            <p className="helper-text">
              Muestra este QR en la entrada del evento. Los asistentes lo escanean con su celular y
              se registran directamente.
            </p>
            <label className="field">
              <span>URL del formulario (kiosko en sitio)</span>
              <input type="text" value={kioskUrl} readOnly onFocus={(e) => e.target.select()} />
            </label>
            <div className="kiosko-actions">
              <button type="button" className="ghost-action" onClick={() => handleCopy(kioskUrl, setCopyState)}>
                {copyState === 'copiado' ? '✓ Copiado' : copyState === 'error' ? 'No se pudo copiar' : 'Copiar URL'}
              </button>
              {qrDataUrl ? (
                <a className="ghost-action" href={qrDataUrl} download="qr-registro-evento.png">
                  Descargar PNG
                </a>
              ) : null}
              <button type="button" className="submit-button" onClick={() => handlePrint(kioskUrl, qrDataUrl, 'Registro en sitio')} disabled={!qrDataUrl}>
                Imprimir
              </button>
            </div>
          </div>

          <div className="kiosko-preview">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR de registro" className="kiosko-qr-image" />
            ) : (
              <div className="qr-placeholder"><span>QR</span></div>
            )}
            <p className="helper-text kiosko-label">Registro en sitio</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default KioskoQrPanel

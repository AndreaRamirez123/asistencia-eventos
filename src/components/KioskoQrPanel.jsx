import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { updateEvento } from '../eventosStore'
import { storage } from '../firebase'

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

function createExtraQuestion() {
  return {
    id: `qx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo: 'texto',
    label: '',
    opciones: [],
  }
}

function KioskoQrPanel({ evento, onEventoChange, empresaSlug = '' }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [preQrDataUrl, setPreQrDataUrl] = useState('')
  const [copyState, setCopyState] = useState('')
  const [preCopyState, setPreCopyState] = useState('')
  const [logosText, setLogosText] = useState(
    (evento?.logosCoOrganizadores || []).join('\n'),
  )
  const [logosSaving, setLogosSaving] = useState(false)
  const [logosSaved, setLogosSaved] = useState(false)
  const [logosError, setLogosError] = useState('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)

  const [ocultarCategoria, setOcultarCategoria] = useState(
    Boolean(evento?.ocultarCategoria),
  )
  const [ocultarAcompanantes, setOcultarAcompanantes] = useState(
    Boolean(evento?.ocultarAcompanantes),
  )
  const [camposError, setCamposError] = useState('')

  const toggleOcultarCategoria = async (event) => {
    const checked = event.target.checked
    setOcultarCategoria(checked)
    setCamposError('')
    try {
      await updateEvento(evento.id, { ocultarCategoria: checked })
      onEventoChange?.({ ...evento, ocultarCategoria: checked })
    } catch (err) {
      setOcultarCategoria(!checked)
      setCamposError(err.message || 'No fue posible guardar.')
    }
  }

  const toggleOcultarAcompanantes = async (event) => {
    const checked = event.target.checked
    setOcultarAcompanantes(checked)
    setCamposError('')
    try {
      await updateEvento(evento.id, { ocultarAcompanantes: checked })
      onEventoChange?.({ ...evento, ocultarAcompanantes: checked })
    } catch (err) {
      setOcultarAcompanantes(!checked)
      setCamposError(err.message || 'No fue posible guardar.')
    }
  }

  const [draftPreguntas, setDraftPreguntas] = useState(
    Array.isArray(evento?.preguntasExtra) ? evento.preguntasExtra : [],
  )
  const [preguntasObligatorio, setPreguntasObligatorio] = useState(
    Boolean(evento?.preguntasExtraObligatorio),
  )
  const [preguntasSaving, setPreguntasSaving] = useState(false)
  const [preguntasSaved, setPreguntasSaved] = useState(false)
  const [preguntasError, setPreguntasError] = useState('')

  const [expandedPreguntaIds, setExpandedPreguntaIds] = useState(new Set())

  const toggleExpandedPregunta = (id) => {
    setExpandedPreguntaIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addExtraPregunta = () => {
    const nueva = createExtraQuestion()
    setDraftPreguntas((current) => [...current, nueva])
    setExpandedPreguntaIds((current) => new Set(current).add(nueva.id))
  }

  const cargarPlantillaDTalks = () => {
    setDraftPreguntas([
      { ...createExtraQuestion(), tipo: 'texto', label: 'Cargo' },
      {
        ...createExtraQuestion(),
        tipo: 'opcion',
        label: 'Sector',
        opciones: [
          'Educación', 'Tecnología', 'Salud', 'Gobierno', 'Comercio',
          'Industria', 'Emprendimiento', 'Independiente', 'Otro',
        ],
      },
      { ...createExtraQuestion(), tipo: 'si-no', label: '¿Confirmas tu asistencia?' },
      {
        ...createExtraQuestion(),
        tipo: 'si-no',
        label:
          'Autorizo el tratamiento de mis datos personales de acuerdo con la Ley 1581 de 2012 y acepto recibir información sobre próximos eventos, capacitaciones y actividades organizadas por D Talks y KUN, Divergency y la CUN.',
      },
    ])
  }

  const removeExtraPregunta = (id) => {
    setDraftPreguntas((current) => current.filter((p) => p.id !== id))
  }

  const updateExtraPregunta = (id, changes) => {
    setDraftPreguntas((current) =>
      current.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    )
  }

  const handleGuardarPreguntas = async () => {
    if (!evento) return
    const cleaned = draftPreguntas
      .map((p) => ({
        ...p,
        label: (p.label || '').trim(),
        opciones:
          p.tipo === 'opcion'
            ? (p.opciones || []).map((o) => String(o).trim()).filter(Boolean)
            : [],
      }))
      .filter((p) => p.label)
    setPreguntasSaving(true)
    setPreguntasError('')
    setPreguntasSaved(false)
    try {
      await updateEvento(evento.id, {
        preguntasExtra: cleaned,
        preguntasExtraObligatorio: preguntasObligatorio,
      })
      setDraftPreguntas(cleaned)
      onEventoChange?.({
        ...evento,
        preguntasExtra: cleaned,
        preguntasExtraObligatorio: preguntasObligatorio,
      })
      setPreguntasSaved(true)
      setTimeout(() => setPreguntasSaved(false), 2000)
    } catch (err) {
      setPreguntasError(err.message || 'No fue posible guardar las preguntas.')
    } finally {
      setPreguntasSaving(false)
    }
  }

  const handleSubirArchivos = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || !evento || !storage) return
    setIsUploadingLogo(true)
    setLogosError('')
    try {
      const nuevasUrls = []
      for (const file of files) {
        const path = `eventoLogos/${evento.id}/${Date.now()}-${file.name}`
        const fileRef = ref(storage, path)
        await uploadBytes(fileRef, file, { contentType: file.type })
        const url = await getDownloadURL(fileRef)
        nuevasUrls.push(url)
      }
      setLogosText((current) => {
        const lineas = current.split('\n').map((l) => l.trim()).filter(Boolean)
        return [...lineas, ...nuevasUrls].join('\n')
      })
    } catch (err) {
      setLogosError(err.message || 'No fue posible subir el archivo.')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleGuardarLogos = async () => {
    if (!evento) return
    const urls = logosText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    setLogosSaving(true)
    setLogosError('')
    setLogosSaved(false)
    try {
      await updateEvento(evento.id, { logosCoOrganizadores: urls })
      onEventoChange?.({ ...evento, logosCoOrganizadores: urls })
      setLogosSaved(true)
      setTimeout(() => setLogosSaved(false), 2000)
    } catch (err) {
      setLogosError(err.message || 'No fue posible guardar los logos.')
    } finally {
      setLogosSaving(false)
    }
  }

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

      <div className="kiosko-mode">
        <p className="eyebrow">Logos de co-organizadores (solo este evento)</p>
        <p className="helper-text">
          Si este evento lo organizan varias marcas, pega aquí una URL de logo por línea. Se
          muestran en fila arriba del formulario público de registro, solo para este evento —
          no afecta el logo de la empresa ni a otros eventos.
        </p>
        <label className="field">
          <span>Subir archivos de logo (PNG/JPG, máx. 3MB c/u)</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleSubirArchivos}
            disabled={isUploadingLogo}
          />
        </label>
        {isUploadingLogo ? <p className="helper-text">Subiendo...</p> : null}
        <label className="field">
          <span>O pega URLs de logos ya hospedados (una por línea)</span>
          <textarea
            rows={4}
            value={logosText}
            onChange={(e) => setLogosText(e.target.value)}
            placeholder={'https://.../logo1.png\nhttps://.../logo2.png'}
          />
        </label>
        {logosError ? <p className="feedback error">{logosError}</p> : null}
        <div className="kiosko-actions">
          <button
            type="button"
            className="submit-button"
            onClick={handleGuardarLogos}
            disabled={logosSaving}
          >
            {logosSaving ? 'Guardando...' : logosSaved ? '✓ Guardado' : 'Guardar logos'}
          </button>
        </div>
      </div>

      <div className="kiosko-mode">
        <p className="eyebrow">Campos del formulario (solo este evento)</p>
        <p className="helper-text">
          Oculta campos fijos que no apliquen a este evento. No afecta a otros eventos.
        </p>
        <label className="checkbox-field consent-inline">
          <input type="checkbox" checked={ocultarCategoria} onChange={toggleOcultarCategoria} />
          <span>Ocultar el campo "Categoría"</span>
        </label>
        <label className="checkbox-field consent-inline">
          <input type="checkbox" checked={ocultarAcompanantes} onChange={toggleOcultarAcompanantes} />
          <span>Ocultar el campo "¿Llevas acompañantes?"</span>
        </label>
        {camposError ? <p className="feedback error">{camposError}</p> : null}
      </div>

      <div className="kiosko-mode">
        <p className="eyebrow">Preguntas extra del formulario (solo este evento)</p>
        <p className="helper-text">
          Agrega campos adicionales al registro público — por ejemplo Cargo, Sector, cómo se
          enteraron del evento, o autorización de datos personales. Solo aplican a este evento,
          no afectan a otros.
        </p>

        {draftPreguntas.map((pregunta) => {
          const isExpanded = expandedPreguntaIds.has(pregunta.id)
          const tipoLabel =
            pregunta.tipo === 'opcion' ? 'Selección' : pregunta.tipo === 'si-no' ? 'Sí/No' : 'Texto libre'
          return (
            <div
              key={pregunta.id}
              className="pregunta-extra-row"
              style={{ marginBottom: '10px', border: '1px solid rgba(148,163,184,0.25)', borderRadius: '8px', overflow: 'hidden' }}
            >
              <button
                type="button"
                onClick={() => toggleExpandedPregunta(pregunta.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <span>
                  <strong>{pregunta.label || 'Nueva pregunta (sin texto)'}</strong>
                  <span className="helper-text" style={{ marginLeft: '8px' }}>{tipoLabel}</span>
                </span>
                <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
              </button>

              {isExpanded ? (
                <div style={{ display: 'grid', gap: '8px', padding: '0 12px 12px' }}>
                  <label className="field">
                    <span>Texto de la pregunta</span>
                    <input
                      type="text"
                      value={pregunta.label}
                      onChange={(e) => updateExtraPregunta(pregunta.id, { label: e.target.value })}
                      placeholder="Ej. Cargo, Sector, ¿Cómo te enteraste del evento?"
                    />
                  </label>
                  <label className="field">
                    <span>Tipo de respuesta</span>
                    <select
                      value={pregunta.tipo}
                      onChange={(e) => updateExtraPregunta(pregunta.id, { tipo: e.target.value })}
                    >
                      <option value="texto">Texto libre</option>
                      <option value="opcion">Selección (varias opciones)</option>
                      <option value="si-no">Sí / No</option>
                    </select>
                  </label>
                  {pregunta.tipo === 'opcion' ? (
                    <label className="field">
                      <span>Opciones (separadas por coma)</span>
                      <input
                        type="text"
                        defaultValue={(pregunta.opciones || []).join(', ')}
                        onBlur={(e) =>
                          updateExtraPregunta(pregunta.id, {
                            opciones: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Ej. Educación, Tecnología, Salud, Gobierno"
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => removeExtraPregunta(pregunta.id)}
                  >
                    Quitar pregunta
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}

        <div className="kiosko-actions">
          <button type="button" className="ghost-action" onClick={addExtraPregunta}>
            + Agregar pregunta
          </button>
          <button type="button" className="ghost-action" onClick={cargarPlantillaDTalks}>
            Usar plantilla D Talks (Cargo, Sector, Confirmación, Autorización)
          </button>
        </div>

        <label className="checkbox-field consent-inline">
          <input
            type="checkbox"
            checked={preguntasObligatorio}
            onChange={(e) => setPreguntasObligatorio(e.target.checked)}
          />
          <span>Hacer obligatorias estas preguntas para poder registrarse</span>
        </label>

        {preguntasError ? <p className="feedback error">{preguntasError}</p> : null}
        <div className="kiosko-actions">
          <button
            type="button"
            className="submit-button"
            onClick={handleGuardarPreguntas}
            disabled={preguntasSaving}
          >
            {preguntasSaving ? 'Guardando...' : preguntasSaved ? '✓ Guardado' : 'Guardar preguntas'}
          </button>
        </div>
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
              <div className="kiosko-qr-image-wrap">
                <img src={preQrDataUrl} alt="QR de pre-registro" />
              </div>
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
              <div className="kiosko-qr-image-wrap">
                <img src={qrDataUrl} alt="QR de registro" />
              </div>
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

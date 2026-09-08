import { useEffect, useRef, useState } from 'react'
import { Circle, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva'
import { saveEstacionesBulk } from '../stacionesStore'
import { updateEvento } from '../eventosStore'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY

const COLORES = [
  '#ffd166', '#ff9f43', '#ff6b6b', '#48dbfb',
  '#1dd1a1', '#a29bfe', '#fd79a8', '#636e72',
]

const TIPOS = [
  { value: 'stand', label: 'Stand / Expositor' },
  { value: 'actividad', label: 'Actividad / Juego' },
  { value: 'info', label: 'Información' },
  { value: 'entrada', label: 'Entrada / Salida' },
]

function generarId() {
  return Math.random().toString(36).slice(2, 9)
}

function MapEditorPanel({ evento, onEventoChange, estaciones: estacionesIniciales = [] }) {
  const [estaciones, setEstaciones] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [planoImg, setPlanoImg] = useState(null)
  const [planoBase64, setPlanoBase64] = useState(evento?.planoBase64 || '')
  const [iaSugerencias, setIaSugerencias] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [iaError, setIaError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [stageSize, setStageSize] = useState({ width: 700, height: 420 })
  const stageRef = useRef(null)
  const trRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  // Cargar estaciones iniciales — se resincroniza cada vez que cambia el
  // evento seleccionado, incluso si el nuevo tiene cero estaciones (si no,
  // quedaban las del evento anterior y "Guardar mapa" las sobreescribía).
  useEffect(() => {
    setEstaciones(estacionesIniciales.map((e) => ({ ...e, localId: e.id || generarId() })))
    setSelectedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?.id, estacionesIniciales])

  // Cargar plano desde evento — igual, se resincroniza por evento.id (no solo
  // por planoBase64) para que planoBase64 y planoImg nunca queden
  // desalineados con el evento realmente seleccionado.
  useEffect(() => {
    if (evento?.planoBase64) {
      setPlanoBase64(evento.planoBase64)
      cargarImagenDesdeBase64(evento.planoBase64)
    } else {
      setPlanoBase64('')
      setPlanoImg(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?.id])

  // Responsive stage
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth
        setStageSize({ width: w, height: Math.round(w * 0.6) })
      }
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Transformer
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return
    const stage = stageRef.current
    const node = stage.findOne(`#${selectedId}`)
    if (node) {
      trRef.current.nodes([node])
      trRef.current.getLayer().batchDraw()
    } else {
      trRef.current.nodes([])
    }
  }, [selectedId])

  function cargarImagenDesdeBase64(base64) {
    const img = new window.Image()
    img.src = base64
    img.onload = () => setPlanoImg(img)
  }

  const handlePlanoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const original = ev.target.result
      const img = new window.Image()
      img.onload = () => {
        const MAX_PX = 1200
        let { width, height } = img
        if (width > MAX_PX || height > MAX_PX) {
          if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX }
          else { width = Math.round(width * MAX_PX / height); height = MAX_PX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', 0.75)
        setPlanoBase64(compressed)
        cargarImagenDesdeBase64(compressed)
      }
      img.src = original
    }
    reader.readAsDataURL(file)
  }

  const agregarEstacion = () => {
    const nueva = {
      localId: generarId(),
      nombre: `Estación ${estaciones.length + 1}`,
      tipo: 'stand',
      descripcion: '',
      x: 10,
      y: 10,
      width: 15,
      height: 12,
      color: COLORES[estaciones.length % COLORES.length],
      forma: 'rect',
    }
    setEstaciones((prev) => [...prev, nueva])
    setSelectedId(nueva.localId)
  }

  const updateSelected = (changes) => {
    setEstaciones((prev) =>
      prev.map((e) => (e.localId === selectedId ? { ...e, ...changes } : e)),
    )
  }

  const eliminarSelected = () => {
    setEstaciones((prev) => prev.filter((e) => e.localId !== selectedId))
    setSelectedId(null)
  }

  const selected = estaciones.find((e) => e.localId === selectedId)

  const handleDragEnd = (localId, e) => {
    setEstaciones((prev) =>
      prev.map((est) =>
        est.localId === localId
          ? {
              ...est,
              x: parseFloat(((e.target.x() / stageSize.width) * 100).toFixed(2)),
              y: parseFloat(((e.target.y() / stageSize.height) * 100).toFixed(2)),
            }
          : est,
      ),
    )
  }

  const handleTransformEnd = (localId, e) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    setEstaciones((prev) =>
      prev.map((est) =>
        est.localId === localId
          ? {
              ...est,
              x: parseFloat(((node.x() / stageSize.width) * 100).toFixed(2)),
              y: parseFloat(((node.y() / stageSize.height) * 100).toFixed(2)),
              width: parseFloat((((node.width() * scaleX) / stageSize.width) * 100).toFixed(2)),
              height: parseFloat((((node.height() * scaleY) / stageSize.height) * 100).toFixed(2)),
            }
          : est,
      ),
    )
  }

  // ── IA Gemini ───────────────────────────────────────────────────────────────
  const detectarConIA = async () => {
    if (!planoBase64) {
      setIaError('Primero sube el plano del lugar.')
      return
    }
    if (!GEMINI_KEY) {
      setIaError('No hay API key de Gemini configurada.')
      return
    }
    setIaLoading(true)
    setIaError('')
    setIaSugerencias('')
    try {
      const base64Data = planoBase64.split(',')[1]
      const mimeType = planoBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'

      const body = {
        contents: [
          {
            parts: [
              {
                text: `Analiza este plano de evento/recinto. Identifica las zonas o áreas principales (stands, escenarios, entradas, pasillos, áreas de actividades, etc).

Para cada zona devuelve un JSON con este formato exacto:
[
  {
    "nombre": "Nombre del área",
    "tipo": "stand|actividad|info|entrada",
    "descripcion": "Descripción breve",
    "x_pct": número entre 0 y 100 (posición horizontal en %),
    "y_pct": número entre 0 y 100 (posición vertical en %),
    "w_pct": número entre 5 y 40 (ancho en %),
    "h_pct": número entre 5 y 30 (alto en %)
  }
]

Responde SOLO con el array JSON, sin texto adicional.`,
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }

      // Detectar modelo disponible dinámicamente
      const modelsRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`,
      )
      if (!modelsRes.ok) throw new Error(`No se pudo listar modelos: ${modelsRes.status}`)
      const modelsData = await modelsRes.json()
      const modelo = (modelsData.models || []).find(
        (m) =>
          (m.supportedGenerationMethods || []).includes('generateContent') &&
          (m.name.includes('flash') || m.name.includes('pro')),
      )
      if (!modelo) throw new Error('No hay modelos Gemini disponibles para esta key.')
      const modelId = modelo.name.replace('models/', '')

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const msg = errBody?.error?.message || res.statusText || res.status
        throw new Error(`Error Gemini ${res.status}: ${msg}`)
      }
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('La IA no devolvió un JSON válido.')

      const zonas = JSON.parse(jsonMatch[0])
      setIaSugerencias(`${zonas.length} zona(s) detectada(s)`)

      const nuevas = zonas.map((z) => ({
        localId: generarId(),
        nombre: z.nombre || 'Zona',
        tipo: z.tipo || 'stand',
        descripcion: z.descripcion || '',
        x: z.x_pct,
        y: z.y_pct,
        width: z.w_pct,
        height: z.h_pct,
        color: COLORES[Math.floor(Math.random() * COLORES.length)],
        forma: 'rect',
      }))

      setEstaciones(nuevas)
    } catch (err) {
      setIaError(err.message || 'Error al procesar con IA.')
    } finally {
      setIaLoading(false)
    }
  }

  const comprimirBase64 = (b64) =>
    new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        const MAX_PX = 1200
        let { width, height } = img
        if (width > MAX_PX || height > MAX_PX) {
          if (width > height) { height = Math.round(height * MAX_PX / width); width = MAX_PX }
          else { width = Math.round(width * MAX_PX / height); height = MAX_PX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = b64
    })

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!evento) return
    setIsSaving(true)
    setSaveMsg('')
    try {
      // Guardar plano en el evento
      if (planoBase64 !== (evento.planoBase64 || '')) {
        // Comprimir si supera ~900KB en base64
        const planoFinal = planoBase64.length > 900_000
          ? await comprimirBase64(planoBase64)
          : planoBase64
        if (planoFinal !== planoBase64) setPlanoBase64(planoFinal)
        await updateEvento(evento.id, { planoBase64: planoFinal })
        onEventoChange?.({ ...evento, planoBase64: planoFinal })
      }

      // Estado ya almacena porcentajes — solo quitar localId antes de guardar
      const estacionesParaGuardar = estaciones.map(({ localId, ...e }) => ({ ...e }))

      await saveEstacionesBulk(evento.id, estacionesParaGuardar)
      setSaveMsg('Mapa guardado correctamente.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveMsg('Error al guardar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Convertir estaciones (% → px) para render en Konva
  const estacionesEnPx = estaciones.map((e) => ({
    ...e,
    x: (e.x / 100) * stageSize.width,
    y: (e.y / 100) * stageSize.height,
    width: (e.width / 100) * stageSize.width,
    height: (e.height / 100) * stageSize.height,
  }))

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Mapa del evento</p>
        <h2>Editor de mapa e estaciones</h2>
      </div>

      {/* Subir plano */}
      <div className="map-toolbar">
        <button type="button" className="ghost-action" onClick={() => fileInputRef.current?.click()}>
          {planoBase64 ? 'Cambiar plano' : 'Subir plano del lugar'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePlanoUpload}
        />

        {planoBase64 && (
          <button
            type="button"
            className="ghost-action ia-btn"
            onClick={detectarConIA}
            disabled={iaLoading}
          >
            {iaLoading ? 'Analizando...' : '✦ Detectar zonas con IA'}
          </button>
        )}

        <button type="button" className="ghost-action" onClick={agregarEstacion}>
          + Agregar estación
        </button>

        <button
          type="button"
          className="submit-button"
          style={{ minHeight: '38px', padding: '0 20px', fontSize: '0.9rem' }}
          onClick={handleGuardar}
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar mapa'}
        </button>
      </div>

      {iaError ? <p className="feedback error">{iaError}</p> : null}
      {iaSugerencias ? <p className="feedback success">{iaSugerencias} — ajusta las zonas en el mapa.</p> : null}
      {saveMsg ? <p className={`feedback ${saveMsg.startsWith('Error') ? 'error' : 'success'}`}>{saveMsg}</p> : null}

      <div className="map-layout">
        {/* Canvas */}
        <div ref={containerRef} className="map-stage-container">
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null)
            }}
          >
            <Layer>
              {planoImg && (
                <KonvaImage
                  image={planoImg}
                  x={0}
                  y={0}
                  width={stageSize.width}
                  height={stageSize.height}
                  opacity={0.85}
                />
              )}
              {estacionesEnPx.map((est) => {
                const isSelected = est.localId === selectedId
                const commonProps = {
                  id: est.localId,
                  key: est.localId,
                  x: est.x,
                  y: est.y,
                  fill: est.color + 'aa',
                  stroke: isSelected ? '#13212d' : est.color,
                  strokeWidth: isSelected ? 2 : 1,
                  draggable: true,
                  onClick: () => setSelectedId(est.localId),
                  onTap: () => setSelectedId(est.localId),
                  onDragEnd: (e) => handleDragEnd(est.localId, e),
                  onTransformEnd: (e) => handleTransformEnd(est.localId, e),
                }
                return est.forma === 'circle' ? (
                  <Circle
                    {...commonProps}
                    radius={Math.min(est.width, est.height) / 2}
                  />
                ) : (
                  <Rect
                    {...commonProps}
                    width={est.width}
                    height={est.height}
                    cornerRadius={4}
                  />
                )
              })}
              {estacionesEnPx.map((est) => (
                <Text
                  key={`lbl-${est.localId}`}
                  x={est.x}
                  y={est.y}
                  text={est.nombre}
                  fontSize={14}
                  fill="#ffffff"
                  fontStyle="bold"
                  listening={false}
                  width={est.width}
                  height={est.height}
                  align="center"
                  verticalAlign="middle"
                  wrap="word"
                  ellipsis
                  shadowColor="rgba(0,0,0,0.6)"
                  shadowBlur={3}
                  shadowOffsetX={0}
                  shadowOffsetY={1}
                />
              ))}
              <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(old, nw) => ({
                ...nw,
                width: Math.max(40, nw.width),
                height: Math.max(30, nw.height),
              })} />
            </Layer>
          </Stage>
        </div>

        {/* Panel de propiedades */}
        {selected ? (
          <div className="map-props-panel">
            <h3>Propiedades</h3>

            <label className="field">
              <span>Nombre</span>
              <input
                type="text"
                value={selected.nombre}
                onChange={(e) => updateSelected({ nombre: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Tipo</span>
              <select
                value={selected.tipo}
                onChange={(e) => updateSelected({ tipo: e.target.value })}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Descripción</span>
              <input
                type="text"
                value={selected.descripcion || ''}
                onChange={(e) => updateSelected({ descripcion: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Forma</span>
              <select
                value={selected.forma}
                onChange={(e) => updateSelected({ forma: e.target.value })}
              >
                <option value="rect">Rectángulo</option>
                <option value="circle">Círculo</option>
              </select>
            </label>

            <div className="field">
              <span>Color</span>
              <div className="color-picker-row">
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="color-dot"
                    style={{
                      background: c,
                      outline: selected.color === c ? '2px solid #13212d' : 'none',
                    }}
                    onClick={() => updateSelected({ color: c })}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="ghost-action"
              style={{ color: '#e55', borderColor: '#e55', marginTop: '8px', width: '100%' }}
              onClick={eliminarSelected}
            >
              Eliminar estación
            </button>
          </div>
        ) : (
          <div className="map-props-panel map-props-empty">
            <p className="helper-text">Haz clic en una estación para editar sus propiedades.</p>
            {estaciones.length === 0 && (
              <p className="helper-text">
                Sube el plano del lugar y usa <strong>Detectar zonas con IA</strong>, o agrega
                estaciones manualmente.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Lista resumen */}
      {estaciones.length > 0 && (
        <div className="map-list">
          <h3>Estaciones ({estaciones.length})</h3>
          <ul className="map-list-items">
            {estaciones.map((e) => (
              <li
                key={e.localId}
                className={`map-list-item ${e.localId === selectedId ? 'map-list-item--selected' : ''}`}
                onClick={() => setSelectedId(e.localId)}
              >
                <span className="map-list-dot" style={{ background: e.color }} />
                <span>{e.nombre}</span>
                <span className="map-list-tipo">{TIPOS.find((t) => t.value === e.tipo)?.label || e.tipo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default MapEditorPanel

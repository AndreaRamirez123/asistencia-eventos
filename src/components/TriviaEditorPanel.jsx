import { useEffect, useState } from 'react'
import { getTriviaDeEstacion, saveTriviaDeEstacion } from '../triviaStore'
import { updateEstacion } from '../stacionesStore'

function preguntaVacia() {
  return {
    id: Math.random().toString(36).slice(2),
    texto: '',
    opciones: ['', '', '', ''],
    correcta: 0,
    tiempo: 30,
  }
}

function TriviaEditorPanel({ evento, estaciones = [] }) {
  const [estacionId, setEstacionId] = useState('')
  const [preguntas, setPreguntas] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const estacionSel = estaciones.find((e) => e.id === estacionId)

  useEffect(() => {
    if (!estacionId) {
      setPreguntas([])
      return
    }
    setIsLoading(true)
    getTriviaDeEstacion(estacionId).then((trivia) => {
      setPreguntas(trivia?.preguntas?.length ? trivia.preguntas : [preguntaVacia()])
      setIsLoading(false)
    })
  }, [estacionId])

  const agregarPregunta = () => setPreguntas((p) => [...p, preguntaVacia()])

  const eliminarPregunta = (id) => setPreguntas((p) => p.filter((q) => q.id !== id))

  const updatePregunta = (id, changes) =>
    setPreguntas((p) => p.map((q) => (q.id === id ? { ...q, ...changes } : q)))

  const updateOpcion = (pregId, idx, valor) =>
    setPreguntas((p) =>
      p.map((q) =>
        q.id === pregId
          ? { ...q, opciones: q.opciones.map((o, i) => (i === idx ? valor : o)) }
          : q,
      ),
    )

  const handleGuardar = async () => {
    if (!estacionId || !evento) return
    const invalidas = preguntas.filter((q) => !q.texto.trim() || q.opciones.some((o) => !o.trim()))
    if (invalidas.length) {
      setMsg('Completa todas las preguntas y opciones antes de guardar.')
      return
    }
    setIsSaving(true)
    setMsg('')
    try {
      await saveTriviaDeEstacion(estacionId, evento.id, preguntas)
      await updateEstacion(estacionId, { tieneTivia: true })
      setMsg('Trivia guardada correctamente.')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setMsg('Error al guardar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Trivia por estación</p>
        <h2>Editor de preguntas</h2>
      </div>

      <label className="field" style={{ maxWidth: '360px' }}>
        <span>Estación</span>
        <select value={estacionId} onChange={(e) => setEstacionId(e.target.value)}>
          <option value="">Selecciona una estación</option>
          {estaciones.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
              {e.tieneTivia ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </label>

      {!estacionId && (
        <p className="helper-text">Selecciona una estación para agregar preguntas de trivia.</p>
      )}

      {estacionId && isLoading && <p className="helper-text">Cargando...</p>}

      {estacionId && !isLoading && (
        <>
          <div className="trivia-preguntas">
            {preguntas.map((q, qi) => (
              <div key={q.id} className="trivia-pregunta-card">
                <div className="trivia-pregunta-header">
                  <span className="trivia-pregunta-num">Pregunta {qi + 1}</span>
                  {preguntas.length > 1 && (
                    <button
                      type="button"
                      className="ghost-action"
                      style={{ color: '#e55', borderColor: '#e55', fontSize: '0.8rem', minHeight: '30px', padding: '0 10px' }}
                      onClick={() => eliminarPregunta(q.id)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <label className="field">
                  <span>Pregunta</span>
                  <input
                    type="text"
                    value={q.texto}
                    onChange={(e) => updatePregunta(q.id, { texto: e.target.value })}
                    placeholder="Escribe la pregunta..."
                  />
                </label>

                <div className="trivia-opciones">
                  {q.opciones.map((op, oi) => (
                    <div key={oi} className="trivia-opcion-row">
                      <input
                        type="radio"
                        name={`correcta-${q.id}`}
                        checked={q.correcta === oi}
                        onChange={() => updatePregunta(q.id, { correcta: oi })}
                        title="Marcar como correcta"
                      />
                      <input
                        type="text"
                        className={`trivia-opcion-input ${q.correcta === oi ? 'trivia-opcion-correcta' : ''}`}
                        value={op}
                        onChange={(e) => updateOpcion(q.id, oi, e.target.value)}
                        placeholder={`Opción ${oi + 1}`}
                      />
                    </div>
                  ))}
                  <small className="helper-text">El círculo seleccionado indica la respuesta correcta.</small>
                </div>

                <label className="field" style={{ maxWidth: '160px' }}>
                  <span>Tiempo (seg)</span>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={q.tiempo}
                    onChange={(e) => updatePregunta(q.id, { tiempo: Number(e.target.value) })}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="trivia-actions">
            <button type="button" className="ghost-action" onClick={agregarPregunta}>
              + Agregar pregunta
            </button>
            <button
              type="button"
              className="submit-button"
              style={{ minHeight: '40px', padding: '0 24px', fontSize: '0.9rem' }}
              onClick={handleGuardar}
              disabled={isSaving}
            >
              {isSaving ? 'Guardando...' : 'Guardar trivia'}
            </button>
          </div>

          {msg && (
            <p className={`feedback ${msg.startsWith('Error') || msg.startsWith('Completa') ? 'error' : 'success'}`}>
              {msg}
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default TriviaEditorPanel

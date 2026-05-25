import { useEffect, useState } from 'react'
import { getTriviaDeEstacion, saveTriviaDeEstacion } from '../triviaStore'
import { updateEstacion } from '../stacionesStore'

function preguntaVacia() {
  return {
    id: Math.random().toString(36).slice(2),
    texto: '',
    tipo: 'opcion_unica',
    opciones: ['', ''],
    correcta: 0,
    correctas: [],
    tiempo: null,
  }
}

function TriviaEditorPanel({ evento, estaciones = [] }) {
  const [estacionId, setEstacionId] = useState('')
  const [preguntas, setPreguntas] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!estacionId) { setPreguntas([]); return }
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

  const handleChangeTipo = (id, tipo) => {
    setPreguntas((p) =>
      p.map((q) => {
        if (q.id !== id) return q
        const opciones = q.opciones?.length >= 2 ? q.opciones : ['', '']
        return { ...q, tipo, opciones, correcta: 0, correctas: [] }
      }),
    )
  }

  const updateOpcion = (pregId, idx, valor) =>
    setPreguntas((p) =>
      p.map((q) =>
        q.id === pregId
          ? { ...q, opciones: q.opciones.map((o, i) => (i === idx ? valor : o)) }
          : q,
      ),
    )

  const addOpcion = (pregId) =>
    setPreguntas((p) =>
      p.map((q) => (q.id === pregId ? { ...q, opciones: [...q.opciones, ''] } : q)),
    )

  const removeOpcion = (pregId, idx) =>
    setPreguntas((p) =>
      p.map((q) => {
        if (q.id !== pregId) return q
        const newOpciones = q.opciones.filter((_, i) => i !== idx)
        let newCorrecta = q.correcta
        if (q.correcta === idx) newCorrecta = 0
        else if (q.correcta > idx) newCorrecta = q.correcta - 1
        const newCorrectas = (q.correctas || [])
          .filter((i) => i !== idx)
          .map((i) => (i > idx ? i - 1 : i))
        return { ...q, opciones: newOpciones, correcta: newCorrecta, correctas: newCorrectas }
      }),
    )

  const toggleCorrectaMultiple = (pregId, idx) =>
    setPreguntas((p) =>
      p.map((q) => {
        if (q.id !== pregId) return q
        const curr = q.correctas || []
        const next = curr.includes(idx) ? curr.filter((i) => i !== idx) : [...curr, idx]
        return { ...q, correctas: next }
      }),
    )

  const handleGuardar = async () => {
    if (!estacionId || !evento) return
    const invalidas = preguntas.filter((q) => {
      if (!q.texto.trim()) return true
      if (q.tipo === 'abierta') return false
      if (q.opciones.some((o) => !o.trim())) return true
      if (q.tipo === 'multiple' && (!q.correctas || q.correctas.length === 0)) return true
      return false
    })
    if (invalidas.length) {
      setMsg('Completa todas las preguntas y opciones. En selección múltiple marca al menos una correcta.')
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
              {e.nombre}{e.tieneTivia ? ' ✓' : ''}
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={q.tipo || 'opcion_unica'}
                      onChange={(e) => handleChangeTipo(q.id, e.target.value)}
                      className="trivia-tipo-select"
                    >
                      <option value="opcion_unica">Opción única</option>
                      <option value="multiple">Selección múltiple</option>
                      <option value="abierta">Respuesta abierta</option>
                    </select>
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

                {q.tipo === 'abierta' ? (
                  <p className="helper-text" style={{ marginBottom: 8 }}>
                    Las respuestas serán registradas pero no validadas — el usuario puede escribir lo que quiera.
                  </p>
                ) : (
                  <div className="trivia-opciones">
                    {q.opciones.map((op, oi) => {
                      const isCorrecta =
                        q.tipo === 'multiple'
                          ? (q.correctas || []).includes(oi)
                          : q.correcta === oi
                      return (
                        <div key={oi} className="trivia-opcion-row">
                          {q.tipo === 'multiple' ? (
                            <input
                              type="checkbox"
                              checked={isCorrecta}
                              onChange={() => toggleCorrectaMultiple(q.id, oi)}
                              title="Marcar como correcta"
                            />
                          ) : (
                            <input
                              type="radio"
                              name={`correcta-${q.id}`}
                              checked={isCorrecta}
                              onChange={() => updatePregunta(q.id, { correcta: oi })}
                              title="Marcar como correcta"
                            />
                          )}
                          <input
                            type="text"
                            className={`trivia-opcion-input${isCorrecta ? ' trivia-opcion-correcta' : ''}`}
                            value={op}
                            onChange={(e) => updateOpcion(q.id, oi, e.target.value)}
                            placeholder={`Opción ${oi + 1}`}
                          />
                          {q.opciones.length > 2 && (
                            <button
                              type="button"
                              className="trivia-opcion-delete"
                              onClick={() => removeOpcion(q.id, oi)}
                              title="Eliminar opción"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                      <button
                        type="button"
                        className="ghost-action"
                        style={{ fontSize: '0.8rem', minHeight: '30px', padding: '0 10px' }}
                        onClick={() => addOpcion(q.id)}
                      >
                        + Opción
                      </button>
                      <small className="helper-text" style={{ margin: 0 }}>
                        {q.tipo === 'multiple'
                          ? 'Las casillas marcadas son las respuestas correctas.'
                          : 'El círculo seleccionado es la respuesta correcta.'}
                      </small>
                    </div>
                  </div>
                )}

                {/* Timer opcional */}
                <div className="trivia-tiempo-row">
                  <label className="trivia-tiempo-toggle">
                    <input
                      type="checkbox"
                      checked={q.tiempo !== null && q.tiempo !== undefined}
                      onChange={(e) =>
                        updatePregunta(q.id, { tiempo: e.target.checked ? 30 : null })
                      }
                    />
                    <span>Tiempo límite</span>
                  </label>
                  {q.tiempo !== null && q.tiempo !== undefined && (
                    <input
                      type="number"
                      className="trivia-tiempo-input"
                      min="5"
                      max="300"
                      value={q.tiempo}
                      onChange={(e) => updatePregunta(q.id, { tiempo: Number(e.target.value) })}
                    />
                  )}
                  {q.tiempo !== null && q.tiempo !== undefined && (
                    <span className="helper-text" style={{ margin: 0, fontSize: '0.8rem' }}>seg</span>
                  )}
                </div>
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

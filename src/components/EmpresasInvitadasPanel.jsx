import { useEffect, useRef, useState } from 'react'
import {
  addEmpresaInvitada,
  removeEmpresaInvitada,
  updateEmpresaInvitada,
} from '../eventosStore'

function createQuestion() {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo: 'texto',
    label: '',
    opciones: [],
  }
}

function serializePreguntas(preguntas) {
  return JSON.stringify(
    preguntas.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      label: p.label || '',
      opciones: p.opciones || [],
    })),
  )
}

function OpcionesInput({ pregunta, onUpdate }) {
  const initialText = (pregunta.opciones || []).join(', ')
  const [text, setText] = useState(initialText)
  const lastSyncedRef = useRef(initialText)

  useEffect(() => {
    const externalText = (pregunta.opciones || []).join(', ')
    if (externalText !== lastSyncedRef.current) {
      lastSyncedRef.current = externalText
      setText(externalText)
    }
  }, [pregunta.opciones])

  const commit = (value) => {
    const opciones = value
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    lastSyncedRef.current = opciones.join(', ')
    onUpdate(pregunta.id, { opciones })
  }

  return (
    <input
      type="text"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      placeholder="Ej. Redes, Amigo, Email"
    />
  )
}

function EncuestaEditor({ evento, empresa, onChange }) {
  const [isSaving, setIsSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  const habilitada = Boolean(empresa.encuestaHabilitada)
  const obligatoria = Boolean(empresa.encuestaObligatoria)
  const savedPreguntas = Array.isArray(empresa.encuestaPreguntas)
    ? empresa.encuestaPreguntas
    : []

  const [draftPreguntas, setDraftPreguntas] = useState(savedPreguntas)

  useEffect(() => {
    setDraftPreguntas(savedPreguntas)
  }, [empresa.id, serializePreguntas(savedPreguntas)])

  const isDirty =
    serializePreguntas(draftPreguntas) !== serializePreguntas(savedPreguntas)

  const persist = async (changes) => {
    setIsSaving(true)
    setLocalError('')
    try {
      const next = await updateEmpresaInvitada(evento, empresa.id, changes)
      onChange?.(next)
    } catch (error) {
      setLocalError(error.message || 'No fue posible guardar la encuesta.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleHabilitada = (event) => {
    persist({ encuestaHabilitada: event.target.checked })
  }

  const toggleObligatoria = (event) => {
    persist({ encuestaObligatoria: event.target.checked })
  }

  const handleSaveDraft = () => {
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
    persist({ encuestaPreguntas: cleaned })
  }

  const handleDiscardDraft = () => {
    setDraftPreguntas(savedPreguntas)
  }

  const addPregunta = () => {
    setDraftPreguntas((current) => [...current, createQuestion()])
  }

  const removePregunta = (id) => {
    setDraftPreguntas((current) => current.filter((p) => p.id !== id))
  }

  const updatePregunta = (id, changes) => {
    setDraftPreguntas((current) =>
      current.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    )
  }

  return (
    <div className="encuesta-editor">

      {/* Personalización visual */}
      <div className="marca-config">
        <h4 style={{ margin: '0 0 10px', color: 'var(--heading)', fontSize: '0.95rem' }}>
          Personalización visual del formulario
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label className="field">
            <span>Color primario</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={empresa.colorPrimario || '#ffd166'}
                onChange={(e) => persist({ colorPrimario: e.target.value })}
                style={{ width: '42px', height: '36px', padding: '2px', borderRadius: '6px', border: '1.5px solid var(--border-strong)', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={empresa.colorPrimario || '#ffd166'}
                onChange={(e) => persist({ colorPrimario: e.target.value })}
                style={{ flex: 1 }}
                placeholder="#ffd166"
              />
            </div>
          </label>
          <label className="field">
            <span>URL del logo</span>
            <input
              type="url"
              defaultValue={empresa.logoUrl || ''}
              onBlur={(e) => persist({ logoUrl: e.target.value.trim() })}
              placeholder="https://empresa.com/logo.png"
            />
          </label>
        </div>
        {empresa.colorPrimario && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: empresa.colorPrimario + '22',
            borderLeft: `4px solid ${empresa.colorPrimario}`,
            borderRadius: '6px',
            fontSize: '0.82rem',
            color: 'var(--muted)',
          }}>
            El formulario de registro mostrará este color cuando el asistente acceda con el link de esta empresa.
          </div>
        )}
      </div>

      <div className="encuesta-toggles">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={habilitada}
            onChange={toggleHabilitada}
            disabled={isSaving}
          />
          <span>Activar encuesta para esta empresa</span>
        </label>

        {habilitada ? (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={obligatoria}
              onChange={toggleObligatoria}
              disabled={isSaving}
            />
            <span>Responder encuesta es obligatorio</span>
          </label>
        ) : null}
      </div>

      {habilitada ? (
        <div className="encuesta-preguntas">
          {draftPreguntas.length === 0 ? (
            <p className="helper-text">Aun no hay preguntas. Agrega la primera abajo.</p>
          ) : (
            <ul className="encuesta-list">
              {draftPreguntas.map((pregunta, index) => (
                <li key={pregunta.id} className="encuesta-item">
                  <div className="encuesta-item-head">
                    <strong>Pregunta {index + 1}</strong>
                    <button
                      type="button"
                      className="mini-action danger"
                      onClick={() => removePregunta(pregunta.id)}
                    >
                      Quitar
                    </button>
                  </div>

                  <label className="field">
                    <span>Texto de la pregunta</span>
                    <input
                      type="text"
                      value={pregunta.label || ''}
                      onChange={(event) =>
                        updatePregunta(pregunta.id, { label: event.target.value })
                      }
                      placeholder="Ej. ¿Como te enteraste del evento?"
                    />
                  </label>

                  <label className="field">
                    <span>Tipo</span>
                    <select
                      value={pregunta.tipo}
                      onChange={(event) => {
                        const tipo = event.target.value
                        updatePregunta(pregunta.id, {
                          tipo,
                          opciones: tipo === 'opcion' ? pregunta.opciones || [] : [],
                        })
                      }}
                    >
                      <option value="texto">Texto libre</option>
                      <option value="opcion">Opcion multiple</option>
                      <option value="si-no">Si / No</option>
                    </select>
                  </label>

                  {pregunta.tipo === 'opcion' ? (
                    <label className="field">
                      <span>Opciones (separadas por coma)</span>
                      <OpcionesInput pregunta={pregunta} onUpdate={updatePregunta} />
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="encuesta-actions">
            <button
              type="button"
              className="ghost-action"
              onClick={addPregunta}
            >
              + Agregar pregunta
            </button>

            <div className="encuesta-save-bar">
              <span
                className={`encuesta-status ${isDirty ? 'dirty' : 'clean'}`}
              >
                {isSaving
                  ? 'Guardando...'
                  : isDirty
                    ? 'Cambios sin guardar'
                    : 'Guardado'}
              </span>
              {isDirty ? (
                <button
                  type="button"
                  className="ghost-action"
                  onClick={handleDiscardDraft}
                  disabled={isSaving}
                >
                  Descartar
                </button>
              ) : null}
              <button
                type="button"
                className="submit-button"
                onClick={handleSaveDraft}
                disabled={isSaving || !isDirty}
              >
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {localError ? <p className="feedback error">{localError}</p> : null}
    </div>
  )
}

function EmpresasInvitadasPanel({ evento, onChange }) {
  const [newName, setNewName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const empresas = Array.isArray(evento?.empresasInvitadas) ? evento.empresasInvitadas : []

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!newName.trim() || !evento) return

    setIsAdding(true)
    setErrorMessage('')
    try {
      const next = await addEmpresaInvitada(evento, newName)
      onChange?.(next)
      setNewName('')
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible agregar la empresa.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (id) => {
    if (!evento) return
    setRemovingId(id)
    setErrorMessage('')
    try {
      const next = await removeEmpresaInvitada(evento, id)
      onChange?.(next)
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible quitar la empresa.')
    } finally {
      setRemovingId('')
    }
  }

  if (!evento) {
    return null
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Empresas invitadas</p>
        <h2>Lista de empresas invitadas al evento</h2>
        <p className="section-copy">
          Los asistentes podran seleccionar su empresa de esta lista cuando se registren. Si no
          esta, pueden escoger "Otra" y escribirla manualmente.
        </p>
      </div>

      <form onSubmit={handleAdd} className="empresas-invitadas-form">
        <label className="field field-wide">
          <span>Agregar nueva empresa</span>
          <div className="empresas-inline-row">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ej. Microsoft"
              maxLength={60}
            />
            <button
              type="submit"
              className="submit-button"
              disabled={isAdding || !newName.trim()}
            >
              {isAdding ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </label>
        {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
      </form>

      {empresas.length === 0 ? (
        <div className="empty-state">
          <h3>Aun no hay empresas invitadas</h3>
          <p>
            Agrega la primera empresa arriba. Si prefieres no usar lista predefinida, puedes dejar
            esto vacio y los asistentes escribiran su empresa libremente.
          </p>
        </div>
      ) : (
        <ul className="empresas-invitadas-list">
          {empresas.map((empresa) => {
            const isExpanded = expandedId === empresa.id
            const preguntasCount = Array.isArray(empresa.encuestaPreguntas)
              ? empresa.encuestaPreguntas.length
              : 0
            return (
              <li key={empresa.id} className="empresa-invitada-item">
                <div className="empresa-invitada-row">
                  <span>{empresa.nombre}</span>
                  <div className="empresa-invitada-actions">
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() =>
                        setExpandedId(isExpanded ? '' : empresa.id)
                      }
                    >
                      {isExpanded
                        ? 'Ocultar encuesta'
                        : empresa.encuestaHabilitada
                          ? `Encuesta (${preguntasCount})`
                          : 'Configurar encuesta'}
                    </button>
                    <button
                      type="button"
                      className="mini-action danger"
                      onClick={() => handleRemove(empresa.id)}
                      disabled={removingId === empresa.id}
                    >
                      {removingId === empresa.id ? 'Quitando...' : 'Quitar'}
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <EncuestaEditor
                    evento={evento}
                    empresa={empresa}
                    onChange={onChange}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default EmpresasInvitadasPanel

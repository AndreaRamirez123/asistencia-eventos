import { useMemo, useState } from 'react'
import { bulkDeleteEventos, updateEvento } from '../eventosStore'

function formatFecha(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
    }).format(d)
  } catch {
    return '—'
  }
}

function GestionEventosPanel({
  eventos = [],
  activeEventoId,
  attendees = [],
  ratings = [],
  onEliminados,
  onRecuperado,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmText, setConfirmText] = useState('')
  const [step, setStep] = useState('idle') // idle | confirm | running | done
  const [errorMessage, setErrorMessage] = useState('')
  const [resultMessage, setResultMessage] = useState('')
  const [recuperandoId, setRecuperandoId] = useState('')

  const archivedEventos = useMemo(
    () => eventos.filter((e) => e.archivado),
    [eventos],
  )

  const counts = useMemo(() => {
    const map = {}
    for (const e of eventos) {
      map[e.id] = {
        asistentes: attendees.filter((a) => a.eventoId === e.id).length,
        calificaciones: ratings.filter((r) => r.eventoId === e.id).length,
      }
    }
    return map
  }, [eventos, attendees, ratings])

  const totalSeleccionado = useMemo(() => {
    let asistentes = 0
    let calificaciones = 0
    for (const id of selectedIds) {
      asistentes += counts[id]?.asistentes || 0
      calificaciones += counts[id]?.calificaciones || 0
    }
    return { asistentes, calificaciones, eventos: selectedIds.size }
  }, [selectedIds, counts])

  const handleRecuperar = async (eventoId) => {
    setRecuperandoId(eventoId)
    try {
      await updateEvento(eventoId, { archivado: false, active: true, fechaCierre: null })
      onRecuperado?.(eventoId)
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible recuperar el evento.')
    } finally {
      setRecuperandoId('')
    }
  }

  if (archivedEventos.length === 0) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Gestionar eventos</p>
          <h2>Limpieza de eventos archivados</h2>
          <p className="section-copy">
            No tienes eventos archivados todavía. Cuando cierres un evento, podrás eliminarlo
            desde aquí (de uno en uno o varios a la vez).
          </p>
        </div>
      </section>
    )
  }

  const toggleId = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const seleccionarTodos = () => {
    setSelectedIds(new Set(archivedEventos.map((e) => e.id)))
  }

  const limpiarSeleccion = () => {
    setSelectedIds(new Set())
  }

  const handleEliminar = async () => {
    if (confirmText.trim().toLowerCase() !== 'eliminar') {
      setErrorMessage('Escribe "eliminar" para confirmar.')
      return
    }
    setStep('running')
    setErrorMessage('')
    try {
      const ids = Array.from(selectedIds)
      const result = await bulkDeleteEventos(ids, { borrarAsistentes: true })
      const msg = `Se eliminaron ${result.eliminados} evento${result.eliminados === 1 ? '' : 's'} y ${result.asistentesEliminados} asistente${result.asistentesEliminados === 1 ? '' : 's'}.${result.errores.length ? ` ${result.errores.length} con error.` : ''}`
      setResultMessage(msg)
      onEliminados?.(ids)
      setStep('done')
      setSelectedIds(new Set())
      setConfirmText('')
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible eliminar los eventos.')
      setStep('confirm')
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Gestionar eventos</p>
        <h2>Eliminar eventos archivados en lote</h2>
        <p className="section-copy">
          Solo se pueden eliminar eventos archivados. El evento activo no aparece en esta lista.
        </p>
      </div>

      {step === 'done' ? (
        <div className="bulk-result">
          <p className="feedback success">{resultMessage}</p>
          <button
            type="button"
            className="ghost-action"
            onClick={() => {
              setStep('idle')
              setResultMessage('')
            }}
          >
            Volver
          </button>
        </div>
      ) : (
        <>
          <div className="bulk-toolbar">
            <button
              type="button"
              className="ghost-action"
              onClick={seleccionarTodos}
              disabled={step === 'running'}
            >
              Seleccionar todos ({archivedEventos.length})
            </button>
            <button
              type="button"
              className="ghost-action"
              onClick={limpiarSeleccion}
              disabled={selectedIds.size === 0 || step === 'running'}
            >
              Limpiar selección
            </button>
            <span className="bulk-counter">
              {selectedIds.size} de {archivedEventos.length} seleccionado{selectedIds.size === 1 ? '' : 's'}
            </span>
          </div>

          <div className="bulk-table">
            <div className="bulk-row bulk-head">
              <span>Sel.</span>
              <span>Nombre</span>
              <span>Cerrado</span>
              <span>Asistentes</span>
              <span>Calificaciones</span>
              <span>Acciones</span>
            </div>
            {archivedEventos.map((ev) => (
              <div key={ev.id} className="bulk-row">
                <input
                  type="checkbox"
                  checked={selectedIds.has(ev.id)}
                  onChange={() => toggleId(ev.id)}
                  disabled={step === 'running'}
                />
                <span>{ev.nombre || `Evento ${ev.id.slice(0, 6)}`}</span>
                <span>{formatFecha(ev.fechaCierre)}</span>
                <span>{counts[ev.id]?.asistentes || 0}</span>
                <span>{counts[ev.id]?.calificaciones || 0}</span>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={() => handleRecuperar(ev.id)}
                  disabled={recuperandoId === ev.id || step === 'running'}
                  title="Vuelve a poner este evento como activo, editable de nuevo"
                >
                  {recuperandoId === ev.id ? 'Recuperando...' : 'Recuperar'}
                </button>
              </div>
            ))}
          </div>

          {selectedIds.size > 0 ? (
            <div className="bulk-action-zone">
              {step === 'idle' ? (
                <button
                  type="button"
                  className="mini-action danger"
                  onClick={() => setStep('confirm')}
                >
                  Eliminar {selectedIds.size} evento{selectedIds.size === 1 ? '' : 's'} seleccionado{selectedIds.size === 1 ? '' : 's'}
                </button>
              ) : null}

              {step === 'confirm' || step === 'running' ? (
                <div className="eliminar-confirm">
                  <p>
                    Vas a eliminar <strong>{totalSeleccionado.eventos}</strong> evento{totalSeleccionado.eventos === 1 ? '' : 's'}.
                    Esto borrará en total:
                  </p>
                  <ul>
                    <li><strong>{totalSeleccionado.asistentes}</strong> asistentes</li>
                    <li>Los documentos de los eventos (config, encuestas, empresas)</li>
                  </ul>
                  <p>
                    Las <strong>{totalSeleccionado.calificaciones}</strong> calificaciones quedan
                    en la base sin enlazar (no se pueden borrar).
                  </p>

                  <label className="field">
                    <span>Para confirmar, escribe <strong>eliminar</strong>:</span>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      placeholder='eliminar'
                      disabled={step === 'running'}
                    />
                  </label>

                  {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

                  <div className="cerrar-evento-actions">
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => {
                        setStep('idle')
                        setConfirmText('')
                        setErrorMessage('')
                      }}
                      disabled={step === 'running'}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="mini-action danger"
                      onClick={handleEliminar}
                      disabled={
                        step === 'running' ||
                        confirmText.trim().toLowerCase() !== 'eliminar'
                      }
                    >
                      {step === 'running'
                        ? 'Eliminando...'
                        : `Sí, eliminar ${totalSeleccionado.eventos}`}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

export default GestionEventosPanel

import { useState } from 'react'
import { addCategoria, getCategorias, removeCategoria } from '../eventosStore'

function CategoriasPanel({ evento, onChange }) {
  const [newName, setNewName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  if (!evento) return null

  const categorias = getCategorias(evento)

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!newName.trim()) return
    setIsAdding(true)
    setErrorMessage('')
    try {
      const next = await addCategoria(evento, newName)
      onChange?.({ ...evento, categorias: next })
      setNewName('')
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible agregar la categoria.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (id) => {
    setRemovingId(id)
    setErrorMessage('')
    try {
      const next = await removeCategoria(evento, id)
      onChange?.({ ...evento, categorias: next })
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible quitar la categoria.')
    } finally {
      setRemovingId('')
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Categorías de asistentes</p>
        <h2>Tipos de asistente que tendrá este evento</h2>
        <p className="section-copy">
          Define las categorías que aparecerán en el formulario de registro. Por ejemplo:
          General, VIP, Speaker, Prensa, Patrocinador, Estudiante, etc.
        </p>
      </div>

      <form onSubmit={handleAdd} className="empresas-invitadas-form">
        <label className="field field-wide">
          <span>Agregar nueva categoría</span>
          <div className="empresas-inline-row">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ej. Patrocinador"
              maxLength={40}
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

      {categorias.length === 0 ? (
        <div className="empty-state">
          <h3>Sin categorías configuradas</h3>
          <p>Agrega la primera categoría arriba.</p>
        </div>
      ) : (
        <ul className="empresas-invitadas-list">
          {categorias.map((cat) => (
            <li key={cat.id} className="empresa-invitada-item">
              <div className="empresa-invitada-row">
                <span>{cat.nombre}</span>
                <div className="empresa-invitada-actions">
                  <button
                    type="button"
                    className="mini-action danger"
                    onClick={() => handleRemove(cat.id)}
                    disabled={removingId === cat.id || categorias.length <= 1}
                    title={
                      categorias.length <= 1
                        ? 'Debe quedar al menos una categoría'
                        : 'Quitar categoría'
                    }
                  >
                    {removingId === cat.id ? 'Quitando...' : 'Quitar'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default CategoriasPanel

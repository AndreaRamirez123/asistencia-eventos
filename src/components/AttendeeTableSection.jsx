function AttendeeTableSection({
  attendees,
  backendStatus,
  filterState,
  filteredCount,
  handleDelete,
  handleEdit,
  handleFilterChange,
  handleStatusAction,
  formatDate,
  isDeletingId,
  isUpdatingStatusId,
  isLoadingAttendees,
  loadAttendees,
}) {
  return (
    <section id="asistentes" className="panel">
      <div className="panel-heading table-heading">
        <div>
          <p className="eyebrow">Control de asistentes</p>
          <h2>Listado operativo del backend</h2>
          <p className="section-copy">
            Este bloque muestra los registros creados desde el panel admin mientras el backend este
            activo.
          </p>
          <p className="section-copy">Coincidencias visibles: {filteredCount}</p>
        </div>

        <div className="table-toolbar">
          <label className="toolbar-field">
            <span>Buscar</span>
            <input
              type="text"
              name="query"
              value={filterState.query}
              onChange={handleFilterChange}
              placeholder="Nombre, documento o correo"
            />
          </label>

          <label className="toolbar-field">
            <span>Categoria</span>
            <select name="attendeeType" value={filterState.attendeeType} onChange={handleFilterChange}>
              <option value="all">Todas</option>
              <option value="general">General</option>
              <option value="vip">VIP</option>
              <option value="speaker">Speaker</option>
              <option value="staff">Staff</option>
              <option value="press">Prensa</option>
            </select>
          </label>

          <label className="toolbar-field">
            <span>Estado</span>
            <select name="status" value={filterState.status} onChange={handleFilterChange}>
              <option value="all">Todos</option>
              <option value="approved">Aprobado</option>
              <option value="checked-in">Check-in</option>
              <option value="pending">Pendiente</option>
            </select>
          </label>

          <button
            type="button"
            className="ghost-action"
            onClick={() => loadAttendees()}
            disabled={backendStatus !== 'online' || isLoadingAttendees}
          >
            {isLoadingAttendees ? 'Actualizando...' : 'Actualizar lista'}
          </button>
        </div>
      </div>

      {backendStatus !== 'online' ? (
        <div className="empty-state">
          <h3>Backend no conectado</h3>
          <p>
            Inicia `backend` con `npm start` para ver aqui los asistentes reales creados desde la
            API.
          </p>
        </div>
      ) : attendees.length === 0 ? (
        <div className="empty-state">
          <h3>Sin asistentes registrados todavia</h3>
          <p>
            Cuando el admin cree el primer registro, aparecera aqui con documento, categoria,
            estado y fecha de creacion.
          </p>
        </div>
      ) : (
        <div className="attendee-table" role="table" aria-label="Listado de asistentes">
          <div className="attendee-row attendee-head" role="row">
            <span>Nombre</span>
            <span>Documento</span>
            <span>Categoria</span>
            <span>Estado</span>
            <span>Creado</span>
            <span>Acciones</span>
          </div>

          {attendees.map((item) => (
            <div key={item.id} className="attendee-row" role="row">
              <span>{item.fullName || 'Sin nombre'}</span>
              <span>{item.documentId || 'Sin documento'}</span>
              <span>{item.attendeeType || 'general'}</span>
              <span>{item.status || 'pendiente'}</span>
              <span>{formatDate(item.createdAt)}</span>
              <span className="table-actions">
                {item.status === 'pre-registered' ? (
                  <button
                    type="button"
                    className="mini-action success"
                    onClick={() => handleStatusAction(item.id, 'approved')}
                    disabled={isUpdatingStatusId === item.id}
                  >
                    {isUpdatingStatusId === item.id ? 'Actualizando...' : 'Aprobar'}
                  </button>
                ) : null}

                <button type="button" className="mini-action" onClick={() => handleEdit(item)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="mini-action danger"
                  onClick={() => handleDelete(item)}
                  disabled={isDeletingId === item.id}
                >
                  {isDeletingId === item.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default AttendeeTableSection

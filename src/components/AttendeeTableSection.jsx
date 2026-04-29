function AttendeeTableSection({
  attendees,
  empresasMap = {},
  empresasInvitadas = [],
  categorias = [],
  filterState,
  filteredCount,
  handleDelete,
  handleEdit,
  handleFilterChange,
  handleStatusAction,
  handleExportCsv,
  handleViewQr,
  handleBulkApprove,
  isBulkApproving = false,
  formatDate,
  isDeletingId,
  isUpdatingStatusId,
  isLoadingAttendees,
  loadAttendees,
}) {
  const categoriasMap = Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))
  const pendingIds = attendees
    .filter((a) => a.status === 'pre-registered' || a.status === 'pending')
    .map((a) => a.id)
  return (
    <section id="asistentes" className="panel">
      <div className="panel-heading table-heading">
        <div>
          <p className="eyebrow">Control de asistentes</p>
          <h2>Listado operativo</h2>
          <p className="section-copy">
            Este bloque muestra los registros creados.
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
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
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

          <label className="toolbar-field">
            <span>Origen</span>
            <select
              name="origen"
              value={filterState.origen || 'all'}
              onChange={handleFilterChange}
            >
              <option value="all">Todos</option>
              <option value="pre">Pre-registro (con QR)</option>
              <option value="onsite">En sitio (sin QR)</option>
              <option value="admin">Manual (admin)</option>
            </select>
          </label>

          {empresasInvitadas.length > 0 ? (
            <label className="toolbar-field">
              <span>Empresa</span>
              <select
                name="empresa"
                value={filterState.empresa || 'all'}
                onChange={handleFilterChange}
              >
                <option value="all">Todas</option>
                {empresasInvitadas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
                <option value="__otra__">Otras</option>
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="table-actions-bar">
        <button
          type="button"
          className="ghost-action"
          onClick={() => loadAttendees()}
          disabled={isLoadingAttendees}
        >
          {isLoadingAttendees ? 'Actualizando...' : 'Actualizar lista'}
        </button>

        {handleBulkApprove ? (
          <button
            type="button"
            className="ghost-action bulk-approve-action"
            onClick={() => handleBulkApprove(pendingIds)}
            disabled={isBulkApproving || pendingIds.length === 0}
            title={
              pendingIds.length === 0
                ? 'No hay asistentes pendientes por aprobar'
                : `Aprobar los ${pendingIds.length} pendientes visibles`
            }
          >
            {isBulkApproving
              ? 'Aprobando...'
              : pendingIds.length === 0
                ? 'Todos aprobados'
                : `Aprobar todos (${pendingIds.length})`}
          </button>
        ) : null}

        {handleExportCsv ? (
          <button
            type="button"
            className="ghost-action"
            onClick={handleExportCsv}
            disabled={attendees.length === 0}
          >
            Exportar CSV
          </button>
        ) : null}
      </div>

      {attendees.length === 0 ? (
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
            <span>Empresa</span>
            <span>Categoria</span>
            <span>Acompañantes</span>
            <span>Origen</span>
            <span>Estado</span>
            <span>Creado</span>
            <span>Acciones</span>
          </div>

          {attendees.map((item) => {
            const isKiosk = item.source === 'kiosk-registration'
            const companions = Number(item.companionsCount) || 0
            return (
              <div key={item.id} className="attendee-row" role="row">
                <span>{item.fullName || 'Sin nombre'}</span>
                <span>
                  {item.documentType ? `${item.documentType} ` : ''}
                  {item.documentId || 'Sin documento'}
                </span>
                <span>{item.organization || '—'}</span>
                <span>{categoriasMap[item.attendeeType] || item.attendeeType || 'general'}</span>
                <span>
                  {companions > 0 ? (
                    <strong>+{companions}</strong>
                  ) : (
                    <span className="muted-cell">—</span>
                  )}
                </span>
                <span>
                  {isKiosk ? (
                    <span className="origin-badge kiosk">En sitio</span>
                  ) : item.source === 'public-registration' ? (
                    <span className="origin-badge public">Pre-registro</span>
                  ) : (
                    <span className="origin-badge admin">Admin</span>
                  )}
                </span>
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

                  {handleViewQr && !isKiosk ? (
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() => handleViewQr(item)}
                    >
                      Ver QR
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
            )
          })}
        </div>
      )}
    </section>
  )
}

export default AttendeeTableSection

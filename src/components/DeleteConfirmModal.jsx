function DeleteConfirmModal({ attendee, isDeleting, onCancel, onConfirm }) {
  if (!attendee) {
    return null
  }

  const attendeeLabel = attendee.fullName || attendee.documentId || 'este asistente'

  return (
    <div className="modal-backdrop" role="presentation" onClick={isDeleting ? undefined : onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Confirmacion requerida</p>
        <h2 id="delete-modal-title">Eliminar asistente</h2>
        <p className="modal-copy">
          Se eliminara <strong>{attendeeLabel}</strong> del listado y del archivo persistente del
          backend. Esta accion no se puede deshacer.
        </p>

        <div className="modal-actions">
          <button type="button" className="ghost-action" onClick={onCancel} disabled={isDeleting}>
            Cancelar
          </button>
          <button
            type="button"
            className="submit-button danger-submit"
            onClick={() => onConfirm(attendee)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Eliminando...' : 'Si, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal

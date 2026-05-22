import { useState } from 'react'
import CedulaScanner from './CedulaScanner'

// Flag para mostrar/ocultar la lectura de cedula. Cambiar a true para reactivar.
const SHOW_CEDULA_SCANNER = false
// Flag para mostrar/ocultar el check de reconocimiento facial. Cambiar a true para reactivar.
const SHOW_FACE_CONSENT = false

function AdminRegistrationPanel({
  editingAttendeeId,
  errorMessage,
  form,
  handleChange,
  handleSubmit,
  isSubmitting,
  modeLabel,
  onCancelEdit,
  submission,
  onCedulaFill,
  empresasInvitadas = [],
  categorias = [],
  eventoModoRegistro = 'pre',
}) {
  const efectiveOnsite = eventoModoRegistro === 'onsite'
  const [showScanner, setShowScanner] = useState(false)

  const handleExtract = (data) => {
    onCedulaFill?.(data)
    setShowScanner(false)
  }
  return (
    <section id="registro-admin" className="panel registration-panel">
      <div className="panel-heading">
        <p className="eyebrow">Alta manual</p>
        <h2>
          {editingAttendeeId
            ? 'Edicion de asistente desde el panel del administrador'
            : 'Registro directo desde el panel del administrador'}
        </h2>
        <p className="section-copy">
          Este modulo sirve para que el admin o la mesa de soporte creen asistentes, corrijan datos
          y generen QR en el momento.
        </p>
      </div>

      <div className="registration-layout">
        <form className="attendee-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Nombre completo</span>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Ej. Laura Martinez"
              required
            />
          </label>

          <label className="field">
            <span>Documento</span>
            <input
              name="documentId"
              value={form.documentId}
              onChange={handleChange}
              placeholder="Ej. 1032456789"
              required
            />
          </label>

          <label className="field">
            <span>Correo electronico</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="correo@evento.com"
            />
          </label>

          <label className="field">
            <span>Telefono</span>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Ej. 3001234567"
              required
            />
          </label>

          {empresasInvitadas.length > 0 ? (
            <>
              <label className="field">
                <span>Empresa o institucion</span>
                <select
                  name="empresaInvitadaId"
                  value={form.empresaInvitadaId || ''}
                  onChange={handleChange}
                >
                  <option value="">Selecciona...</option>
                  {empresasInvitadas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                  <option value="__otra__">Otra (especificar)</option>
                </select>
              </label>

              {form.empresaInvitadaId === '__otra__' ? (
                <label className="field">
                  <span>Nombre de la otra empresa</span>
                  <input
                    name="organization"
                    value={form.organization}
                    onChange={handleChange}
                    placeholder="Escribe la empresa"
                  />
                </label>
              ) : null}
            </>
          ) : (
            <label className="field">
              <span>Empresa o institucion</span>
              <input
                name="organization"
                value={form.organization}
                onChange={handleChange}
                placeholder="Ej. Universidad o empresa"
              />
            </label>
          )}

          <label className="field">
            <span>Categoria</span>
            <select name="attendeeType" value={form.attendeeType} onChange={handleChange}>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </label>

          {editingAttendeeId ? (
            <label className="field">
              <span>Estado</span>
              <select name="status" value={form.status || 'approved'} onChange={handleChange}>
                <option value="approved">Aprobado</option>
                <option value="pre-registered">Pre-registro</option>
                <option value="checked-in">Check-in</option>
                <option value="pending">Pendiente</option>
              </select>
            </label>
          ) : null}

          <label className="field field-wide">
            <span>Notas internas</span>
            <input
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Ej. invitado de gerencia, requiere acreditacion especial"
            />
          </label>

          {SHOW_CEDULA_SCANNER || SHOW_FACE_CONSENT ? (
            <fieldset className="consent-section">
              <legend>Apoyos opcionales al registro</legend>
              <p className="helper-text">
                Estas opciones son voluntarias y el asistente debe autorizarlas. Los datos se
                tratan conforme a la Ley 1581 de 2012 (habeas data).
              </p>

              {SHOW_CEDULA_SCANNER ? (
                <div className="consent-item">
                  <div>
                    <strong>Escanear cedula para autocompletar</strong>
                    <p className="helper-text">
                      Se lee el codigo de barras del reverso y se rellenan nombre y documento. La
                      imagen no se almacena.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-action cedula-trigger"
                    onClick={() => setShowScanner(true)}
                  >
                    Escanear cedula
                  </button>
                </div>
              ) : null}

              {SHOW_FACE_CONSENT ? (
                <label className="checkbox-field consent-checkbox">
                  <input
                    type="checkbox"
                    name="hasFaceConsent"
                    checked={form.hasFaceConsent}
                    onChange={handleChange}
                  />
                  <span>Marcar si el asistente autorizo reconocimiento facial opcional.</span>
                </label>
              ) : null}
            </fieldset>
          ) : null}

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

          {editingAttendeeId ? (
            <div className="form-actions-row">
              <button type="submit" className="submit-button" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando cambios...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="ghost-action form-ghost"
                onClick={onCancelEdit}
                disabled={isSubmitting}
              >
                Cancelar edicion
              </button>
            </div>
          ) : (
            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando desde admin...'
                : efectiveOnsite
                  ? 'Crear registro (sin QR)'
                  : 'Crear registro y QR'}
            </button>
          )}

          <p className="helper-text">Estado actual: {modeLabel}</p>
        </form>

        <aside className="preview-card">
          <p className="eyebrow">Resultado operativo</p>
          {submission ? (
            <>
              <h3>Asistente aprobado</h3>
              <p className="preview-copy">
                {submission.attendee.fullName} fue creado desde admin con estado{' '}
                <strong>{submission.attendee.status}</strong>.
              </p>
              {efectiveOnsite ? (
                <div className="qr-placeholder" aria-hidden="true">
                  <span>&#10003;</span>
                </div>
              ) : (
                <img
                  className="qr-preview"
                  src={submission.qrDataUrl}
                  alt={`QR de ${submission.attendee.fullName}`}
                />
              )}
              <div className="preview-meta">
                <span>ID: {submission.recordId}</span>
                <span>Categoria: {submission.attendee.attendeeType}</span>
                {efectiveOnsite ? (
                  <span>Modo: registro en sitio (sin QR)</span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h3>{efectiveOnsite ? 'Confirmación' : 'QR y trazabilidad'}</h3>
              <p className="preview-copy">
                {efectiveOnsite
                  ? 'Cuando crees un asistente, aquí aparecerá la confirmación. No se genera QR porque la persona ya está en el evento.'
                  : 'Cuando el admin cree un asistente, aquí aparecerá su QR junto con el estado del registro.'}
              </p>
              <div className="qr-placeholder" aria-hidden="true">
                <span>ADMIN</span>
              </div>
            </>
          )}
        </aside>
      </div>

      {SHOW_CEDULA_SCANNER && showScanner ? (
        <CedulaScanner onExtract={handleExtract} onClose={() => setShowScanner(false)} />
      ) : null}
    </section>
  )
}

export default AdminRegistrationPanel

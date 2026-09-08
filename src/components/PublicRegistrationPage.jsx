import { Fragment, useState } from 'react'
import CedulaScanner from './CedulaScanner'

// Flag para mostrar/ocultar la lectura de cedula. Cambiar a true para reactivar.
const SHOW_CEDULA_SCANNER = false
// Flag para mostrar/ocultar el check de reconocimiento facial. Cambiar a true para reactivar.
const SHOW_FACE_CONSENT = false

function PublicRegistrationPage({
  errorMessage,
  form,
  handleChange,
  handleSurveyChange,
  handleSubmit,
  handleDocumentLookup,
  lookupStatus = 'idle',
  isSubmitting,
  submission,
  onCedulaFill,
  empresasInvitadas = [],
  categorias = [],
  kioskMode = false,
  eventoModoRegistro = 'pre',
  eventoLoaded = true,
  onResetSubmission,
  eventoNombre = '',
  eventoId = '',
  empresaConfig = null,
  logosCoOrganizadores = [],
  preguntasEvento = [],
  preguntasEventoObligatorio = false,
  ocultarCategoria = false,
  ocultarAcompanantes = false,
  soloMapa = false,
}) {
  const [showScanner, setShowScanner] = useState(false)

  const verEstacionesLabel = soloMapa ? 'Ver el mapa del evento →' : 'Ver mis estaciones y trivias →'

  const handleExtract = (data) => {
    onCedulaFill?.(data)
    setShowScanner(false)
  }

  const selectedEmpresa = empresasInvitadas.find(
    (e) => e.id === form.empresaInvitadaId,
  )
  const encuestaActiva = Boolean(selectedEmpresa?.encuestaHabilitada)
  const preguntasEmpresa =
    encuestaActiva && Array.isArray(selectedEmpresa?.encuestaPreguntas)
      ? selectedEmpresa.encuestaPreguntas
      : []
  const preguntas = [...preguntasEmpresa, ...preguntasEvento]
  const encuestaObligatoria =
    (preguntasEmpresa.length > 0 && Boolean(selectedEmpresa?.encuestaObligatoria)) ||
    (preguntasEvento.length > 0 && preguntasEventoObligatorio)

  const showModeToggle = false
  const effectiveMode =
    kioskMode || eventoModoRegistro === 'onsite' ? 'onsite' : 'pre'
  const isOnSite = effectiveMode === 'onsite'

  if (!eventoLoaded) {
    return (
      <div className="public-shell">
        <div className="public-loading">
          <div className="public-loading-spinner" aria-hidden="true" />
          <p>Cargando configuración del evento...</p>
        </div>
      </div>
    )
  }

  if (isOnSite && submission) {
    return (
      <div className="kiosk-success">
        <div className="kiosk-success-card">
          <div className="kiosk-success-check" aria-hidden="true">&#10003;</div>
          <p className="eyebrow">Registro completado</p>
          <h1>¡Bienvenido, {submission.attendee.fullName.split(' ')[0] || 'asistente'}!</h1>
          <p className="kiosk-copy">
            Tu registro quedo guardado. Ya puedes ingresar al evento.
          </p>
          <div className="kiosk-meta-card">
            <div>
              <span className="kiosk-meta-label">Nombre</span>
              <strong>{submission.attendee.fullName}</strong>
            </div>
            <div>
              <span className="kiosk-meta-label">Documento</span>
              <strong>{submission.attendee.documentId}</strong>
            </div> 
          </div>
          <div className="kiosk-success-actions">
            <a
              href={`/mi-evento?doc=${submission.attendee.documentId}&evento=${submission.attendee.eventoId || ''}`}
              className="submit-button reg-cta-estaciones"
            >
              {verEstacionesLabel}
            </a>
            <p className="helper-text kiosk-tip">
              {soloMapa
                ? 'Guarda ese enlace para ver el mapa del evento. Si el staff te lo solicita, muestra esta pantalla.'
                : 'Guarda ese enlace para acceder al recorrido y las trivias. Si el staff te lo solicita, muestra esta pantalla.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const brandColor = empresaConfig?.colorPrimario || empresaConfig?.colorAcento || ''
  const brandSecondary = empresaConfig?.colorSecundario || brandColor
  // Solo aplicar inline cuando hay color de empresa; si no, el var global de App.jsx toma el control
  const brandStyle = brandColor
    ? { '--accent': brandColor, '--accent-strong': brandSecondary || brandColor }
    : {}

  return (
    <div className="public-shell" style={brandStyle}>
      <header className="public-hero">
        <div>
          {logosCoOrganizadores.length > 0 ? (
            <div className="public-hero-cologos">
              {logosCoOrganizadores.map((logo, index) => {
                const urlClaro = typeof logo === 'string' ? logo : logo.url
                const urlOscuro = typeof logo === 'object' && logo.urlOscuro

                if (!urlOscuro) {
                  return <img key={`${urlClaro}-${index}`} src={urlClaro} alt="Logo organizador" />
                }

                
                return (
                  <Fragment key={`${urlClaro}-${index}`}>
                    <img src={urlClaro} alt="Logo organizador" className="logo-solo-claro" />
                    <img src={urlOscuro} alt="Logo organizador" className="logo-solo-oscuro" />
                  </Fragment>
                )
              })}
            </div>
          ) : (
            empresaConfig?.logoUrl && (
              <img
                src={empresaConfig.logoUrl}
                alt="Logo"
                style={{ height: '48px', objectFit: 'contain', marginBottom: '12px', display: 'block' }}
              />
            )
          )}
          <p className="eyebrow">Registro publico del evento</p>
          {(() => {
            const subtitulo = isOnSite
              ? 'Registrate y entra al evento.'
              : 'Inscribete y recibe tu codigo QR de asistencia.'
            return eventoNombre ? (
              <>
                <h1>{eventoNombre}</h1>
                <p className="public-hero-subtitulo">{subtitulo}</p>
              </>
            ) : (
              <h1>{subtitulo}</h1>
            )
          })()}
          <p className="hero-text">
            Diligencia tus datos y quedarás registrado para el evento.
          </p>
        </div>

      </header>

      <section className="panel public-panel">
        <div className="panel-heading">
          <p className="eyebrow">
            {submission ? 'Registro exitoso' : 'Formulario del asistente'}
          </p>
          <h2>{submission ? 'Tu registro está listo ✓' : 'Completa tu informacion'}</h2>
          {!submission && (
            <p className="section-copy">
              {isOnSite
                ? 'Al finalizar quedaras registrado y podras ingresar al evento.'
                : 'Al finalizar se genera tu confirmacion con QR para el ingreso al evento.'}
            </p>
          )}
        </div>

        <div className={`registration-layout ${isOnSite || submission ? 'no-preview' : ''}`}>
          {!submission && <form className="attendee-form" onSubmit={handleSubmit}>
            {SHOW_CEDULA_SCANNER ? (
              <div className="cedula-shortcut">
                <div>
                  <strong>
                    ¿Tienes tu cedula a la mano?{' '}
                    <span className="cedula-optional">(opcional)</span>
                  </strong>
                  <p className="helper-text">
                    Escanea el codigo de barras del reverso y se llenan automaticamente{' '}
                    <strong>nombres, apellidos y numero de documento</strong>. La imagen no se
                    almacena. Si prefieres, puedes omitir este paso y llenar los datos manualmente.
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

            <label className="field field-wide">
              <span>Documento o NIT</span>
              <div className="document-input-row">
                <select
                  name="documentType"
                  value={form.documentType || 'CC'}
                  onChange={handleChange}
                  className="document-type-select"
                >
                  <option value="CC">CC</option>
                  <option value="NIT">NIT</option>
                  <option value="CE">CE</option>
                  <option value="TI">TI</option>
                  <option value="PA">PA</option>
                </select>
                <input
                  name="documentId"
                  value={form.documentId}
                  onChange={handleChange}
                  onBlur={(event) => handleDocumentLookup?.(event.target.value)}
                  placeholder="Ej. 1032456789"
                  required
                />
              </div>
              {lookupStatus === 'searching' ? (
                <small className="lookup-feedback">Buscando registros previos...</small>
              ) : lookupStatus === 'found' ? (
                <small className="lookup-feedback found">
                  &#10003; Te encontramos registrado en esta empresa.{' '}
                  <a
                    href={`/mi-evento?doc=${form.documentId}${eventoId ? `&evento=${eventoId}` : ''}`}
                    className="lookup-estaciones-link"
                  >
                    Ver mis estaciones →
                  </a>
                </small>
              ) : lookupStatus === 'found-other-empresa' ? (
                <small className="lookup-feedback partial">
                  Te identificamos. Llenamos tu info personal pero como vienes con una empresa
                  diferente, completa los datos de empresa abajo.
                </small>
              ) : lookupStatus === 'not-found' ? (
                <small className="lookup-feedback">
                  Es tu primer registro. Completa los datos abajo.
                </small>
              ) : null}
            </label>

            <label className="field">
              <span>Correo electronico</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="correo@evento.com"
                required
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
                  <span>  Empresa u organización</span>
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
                <span>  Empresa u organización</span>
                <input
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="Ej. Universidad o empresa"
                />
              </label>
            )}

            {ocultarCategoria ? null : (
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
            )}

            {ocultarAcompanantes ? null : (
              <label className="field">
                <span>¿Llevas acompañantes?</span>
                <select
                  name="hasCompanions"
                  value={form.hasCompanions ? 'si' : 'no'}
                  onChange={(event) =>
                    handleChange({
                      target: {
                        name: 'hasCompanions',
                        type: 'checkbox',
                        checked: event.target.value === 'si',
                      },
                    })
                  }
                >
                  <option value="no">No, voy solo</option>
                  <option value="si">Si, llevo acompañantes</option>
                </select>
              </label>
            )}

            {!ocultarAcompanantes && form.hasCompanions ? (
              <label className="field">
                <span>¿Cuántos acompañantes?</span>
                <input
                  type="number"
                  name="companionsCount"
                  value={form.companionsCount || ''}
                  onChange={handleChange}
                  min="1"
                  max="20"
                  placeholder="Ej. 2"
                  required
                />
              </label>
            ) : null}

            {preguntas.length > 0 ? (
              <fieldset className="encuesta-section">
                <legend>
                  {encuestaObligatoria
                    ? ''
                    : ''}
                </legend>
                <p className="helper-text">
                  {encuestaObligatoria
                    ? ''
                    : ''}
                </p>

                {preguntas.map((pregunta) => {
                  const value = form.surveyAnswers?.[pregunta.id] || ''
                  const required = encuestaObligatoria

                  if (pregunta.tipo === 'opcion') {
                    const esOtro = value.trim().toLowerCase() === 'otro'
                    const otroValue = form.surveyAnswers?.[`${pregunta.id}__otro`] || ''
                    return (
                      <label key={pregunta.id} className="field">
                        <span>{pregunta.label}</span>
                        <select
                          value={value}
                          onChange={(event) =>
                            handleSurveyChange?.(pregunta.id, event.target.value)
                          }
                          required={required}
                        >
                          <option value="">Selecciona...</option>
                          {(pregunta.opciones || []).map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        {esOtro ? (
                          <input
                            type="text"
                            value={otroValue}
                            onChange={(event) =>
                              handleSurveyChange?.(`${pregunta.id}__otro`, event.target.value)
                            }
                            placeholder="Especifica..."
                            required={required}
                            style={{ marginTop: '8px' }}
                          />
                        ) : null}
                      </label>
                    )
                  }

                  if (pregunta.tipo === 'si-no' && pregunta.requiereSi) {
                    return (
                      <label key={pregunta.id} className="field field-wide consent-toggle">
                        <input
                          type="checkbox"
                          checked={value === 'si'}
                          onChange={(event) =>
                            handleSurveyChange?.(pregunta.id, event.target.checked ? 'si' : '')
                          }
                          required
                        />
                        <span className="consent-toggle-track" aria-hidden="true" />
                        <span className="consent-toggle-label">{pregunta.label}</span>
                      </label>
                    )
                  }

                  if (pregunta.tipo === 'si-no') {
                    return (
                      <label key={pregunta.id} className="field">
                        <span>{pregunta.label}</span>
                        <select
                          value={value}
                          onChange={(event) =>
                            handleSurveyChange?.(pregunta.id, event.target.value)
                          }
                          required={required}
                        >
                          <option value="">Selecciona...</option>
                          <option value="si">Si</option>
                          <option value="no">No</option>
                        </select>
                      </label>
                    )
                  }

                  return (
                    <label key={pregunta.id} className="field">
                      <span>{pregunta.label}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          handleSurveyChange?.(pregunta.id, event.target.value)
                        }
                        required={required}
                      />
                    </label>
                  )
                })}
              </fieldset>
            ) : null}

            {SHOW_FACE_CONSENT ? (
              <label className="checkbox-field consent-inline">
                <input
                  type="checkbox"
                  name="hasFaceConsent"
                  checked={form.hasFaceConsent}
                  onChange={handleChange}
                />
                <span>
                  Autorizo reconocimiento facial opcional como apoyo al ingreso.
                  <small className="helper-text">
                    Voluntario. Datos tratados conforme a la Ley 1581 de 2012 (habeas data).
                  </small>
                </span>
              </label>
            ) : null}

            {errorMessage ? (
              <div>
                <p className="feedback error">{errorMessage}</p>
                {form.documentId && /registrado|duplicado/i.test(errorMessage) ? (
                  <a
                    href={`/mi-evento?doc=${form.documentId}${eventoId ? `&evento=${eventoId}` : ''}`}
                    className="submit-button"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginTop: '10px', minHeight: '44px', boxSizing: 'border-box' }}
                  >
                    {verEstacionesLabel}
                  </a>
                ) : null}
              </div>
            ) : null}

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando registro...' : 'Registrarme'}
            </button>
          </form>}

          {!isOnSite ? (
            <aside className="preview-card">
              <p className="eyebrow">Confirmacion</p>
              {submission ? (
                <>
                  <h3>Registro completado &#10003;</h3>
                  <p className="preview-copy">
                    {submission.attendee.fullName}, tu registro quedo guardado. El dia del evento
                    muestra este QR al staff para ingresar, o simplemente di tu numero de
                    documento.
                  </p>

                  {/* CTA principal: ver estaciones */}
                  <a
                    href={`/mi-evento?doc=${submission.attendee.documentId}&evento=${submission.attendee.eventoId || ''}`}
                    className="submit-button reg-cta-estaciones"
                  >
                    {verEstacionesLabel}
                  </a>
                  <p className="preview-copy" style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.7 }}>
                    {soloMapa
                      ? 'Guarda ese enlace para ver el mapa del evento.'
                      : 'Guarda ese enlace para acceder al recorrido y las trivias del evento.'}
                  </p>

                  <img
                    className="qr-preview"
                    src={submission.qrDataUrl}
                    alt={`QR de ${submission.attendee.fullName}`}
                  />
                  <div className="preview-meta">
                    <span>Documento: {submission.attendee.documentId}</span>
                    <span>Estado: {submission.attendee.status}</span>
                    <span>&#128274; Guarda este QR, lo necesitas para ingresar.</span>
                  </div>
                  <div className="preview-actions">
                    <a
                      className="primary-action download-action"
                      href={submission.qrDataUrl}
                      download={`qr-${submission.attendee.documentId || submission.recordId}.png`}
                    >
                      Descargar QR
                    </a>
                  </div>
                  {onResetSubmission && (
                    <button
                      type="button"
                      className="ghost-action"
                      style={{ marginTop: '14px', width: '100%', textAlign: 'center' }}
                      onClick={onResetSubmission}
                    >
                      ← Volver
                    </button>
                  )}
                </>
              ) : (
                <>
                  <h3>Tu QR aparecera aqui</h3>
                  <p className="preview-copy">
                    Despues de registrarte, este espacio mostrara tu confirmacion con codigo QR.
                  </p>
                  <div className="qr-placeholder" aria-hidden="true">
                    <span>QR</span>
                  </div>
                </>
              )}
            </aside>
          ) : null}
        </div>
      </section>

      {SHOW_CEDULA_SCANNER && showScanner ? (
        <CedulaScanner onExtract={handleExtract} onClose={() => setShowScanner(false)} />
      ) : null}
    </div>
  )
}

export default PublicRegistrationPage

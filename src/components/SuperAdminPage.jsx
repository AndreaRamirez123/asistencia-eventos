import { useEffect, useState } from 'react'
import { invitarAdmin } from '../auth'
import {
  createCliente,
  deleteCliente,
  getClienteStats,
  getGlobalStats,
  listClientes,
  migrarDatosHuerfanos,
  updateCliente,
} from '../clientesStore'

const emptyForm = {
  nombre: '',
  slug: '',
  logoUrl: '',
  colorPrimario: '#ffd166',
  colorSecundario: '',
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function ClienteModal({ cliente, onSave, onClose }) {
  const isEdit = Boolean(cliente?.id)
  const [form, setForm] = useState(
    isEdit
      ? {
          nombre: cliente.nombre,
          slug: cliente.slug,
          logoUrl: cliente.logoUrl || '',
          colorPrimario: cliente.colorPrimario || cliente.colorAcento || '#ffd166',
          colorSecundario: cliente.colorSecundario || '',
        }
      : emptyForm,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'nombre' && !isEdit) next.slug = slugify(value)
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.slug.trim()) { setError('El slug es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.message || 'No fue posible guardar.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Editar empresa' : 'Nueva empresa'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Nombre de la empresa</span>
            <input
              name="nombre"
              type="text"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Ej. Universidad CUN"
              disabled={saving}
              autoFocus
            />
          </label>

          <label className="field">
            <span>Slug (URL)</span>
            <div className="slug-preview-wrap">
              <span className="slug-prefix">/e/</span>
              <input
                name="slug"
                type="text"
                value={form.slug}
                onChange={handleChange}
                placeholder="universidad-cun"
                disabled={saving}
              />
            </div>
            <span className="field-hint">Solo letras, números y guiones. Único por empresa.</span>
          </label>

          <label className="field">
            <span>Color primario</span>
            <div className="color-field-wrap">
              <input
                name="colorPrimario"
                type="color"
                value={form.colorPrimario}
                onChange={handleChange}
                disabled={saving}
              />
              <input
                name="colorPrimario"
                type="text"
                value={form.colorPrimario}
                onChange={handleChange}
                placeholder="#ffd166"
                disabled={saving}
                className="color-text-input"
              />
            </div>
            <span className="field-hint">Botones, highlights y encabezados.</span>
          </label>

          <label className="field">
            <span>Color secundario <span className="field-hint" style={{ fontWeight: 400 }}>(opcional)</span></span>
            <div className="color-field-wrap">
              <input
                name="colorSecundario"
                type="color"
                value={form.colorSecundario || '#cccccc'}
                onChange={handleChange}
                disabled={saving}
              />
              <input
                name="colorSecundario"
                type="text"
                value={form.colorSecundario}
                onChange={handleChange}
                placeholder="#cccccc"
                disabled={saving}
                className="color-text-input"
              />
            </div>
            <span className="field-hint">Segundo color de la marca. Déjalo vacío si solo usas uno.</span>
          </label>

          <label className="field">
            <span>URL del logo (opcional)</span>
            <input
              name="logoUrl"
              type="url"
              value={form.logoUrl}
              onChange={handleChange}
              placeholder="https://empresa.com/logo.png"
              disabled={saving}
            />
          </label>

          {error ? <p className="feedback error">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" className="ghost-action" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="submit-button" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InvitarAdminModal({ cliente, onClose }) {
  const [form, setForm] = useState({ email: '', displayName: '', role: 'admin_empresa' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email.trim()) { setError('El correo es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      await invitarAdmin({ ...form, clienteId: cliente.id })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'No fue posible enviar la invitación.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invitar usuario — {cliente.nombre}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="feedback success">
              ✓ Invitación enviada. El usuario recibirá un correo para establecer su contraseña.
            </p>
            <button type="button" className="submit-button" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Correo electrónico</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="admin@empresa.com"
                disabled={saving}
                autoFocus
              />
            </label>

            <label className="field">
              <span>Nombre (opcional)</span>
              <input
                name="displayName"
                type="text"
                value={form.displayName}
                onChange={handleChange}
                placeholder="Nombre del administrador"
                disabled={saving}
              />
            </label>

            <label className="field">
              <span>Rol</span>
              <select name="role" value={form.role} onChange={handleChange} disabled={saving}>
                <option value="admin_empresa">Admin empresa</option>
                <option value="staff">Staff / Scanner</option>
              </select>
            </label>

            <p className="helper-text">
              Se creará la cuenta y se enviará un correo para que el usuario establezca su contraseña.
            </p>

            {error ? <p className="feedback error">{error}</p> : null}

            <div className="modal-actions">
              <button type="button" className="ghost-action" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="submit-button" disabled={saving}>
                {saving ? 'Enviando invitación...' : 'Enviar invitación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ClienteCard({ cliente, onEdit, onToggle, onDelete, onEnterPanel, onInvitar, onMigrar }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [working, setWorking] = useState(false)
  const [migrando, setMigrando] = useState(false)
  const [migrResult, setMigrResult] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getClienteStats(cliente.id).then(setStats)
  }, [cliente.id])

  const handleToggle = async () => {
    setWorking(true)
    try { await onToggle(cliente) } finally { setWorking(false) }
  }

  const handleDelete = async () => {
    setWorking(true)
    try { await onDelete(cliente.id) } finally { setWorking(false) }
  }

  const handleMigrar = async () => {
    setMigrando(true)
    setMigrResult(null)
    try {
      const total = await onMigrar(cliente.id)
      setMigrResult({ ok: true, total })
    } catch (err) {
      setMigrResult({ ok: false, msg: err.message })
    } finally {
      setMigrando(false)
    }
  }

  return (
    <div className={`cliente-card ${cliente.activa ? '' : 'cliente-card--inactiva'}`}>
      <div className="cliente-card-color" style={{ background: cliente.colorPrimario || cliente.colorAcento || '#ffd166' }} />

      <div className="cliente-card-body">
        {cliente.logoUrl ? (
          <img src={cliente.logoUrl} alt={cliente.nombre} className="cliente-card-logo" />
        ) : (
          <div className="cliente-card-initials" style={{ background: cliente.colorPrimario || cliente.colorAcento || '#ffd166' }}>
            {cliente.nombre.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="cliente-card-info">
          <strong className="cliente-card-nombre">{cliente.nombre}</strong>
          <span className="cliente-card-slug">/e/{cliente.slug}</span>
          <span className={`status-pill ${cliente.activa ? 'approved' : 'pending'}`}>
            {cliente.activa ? 'Activa' : 'Inactiva'}
          </span>
          {stats ? (
            <span className="cliente-card-stats">
              {stats.eventos} evento{stats.eventos !== 1 ? 's' : ''} · {stats.asistentes} asistente{stats.asistentes !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="cliente-card-stats cliente-card-stats--loading">cargando...</span>
          )}
        </div>
      </div>

      <div className="cliente-card-actions">
        <button type="button" className="mini-action success" onClick={() => onEnterPanel(cliente)} disabled={working}>
          Abrir panel
        </button>
        <button type="button" className="mini-action" onClick={() => onEdit(cliente)} disabled={working}>
          Editar
        </button>
        <button type="button" className="mini-action" onClick={() => onInvitar(cliente)} disabled={working}>
          + Admin
        </button>
        <button type="button" className="mini-action" onClick={handleMigrar} disabled={working || migrando} title="Asigna a esta empresa todos los datos históricos que no tienen empresa asignada">
          {migrando ? 'Migrando...' : 'Migrar datos'}
        </button>
        {migrResult ? (
          <span className={`mini-action-result ${migrResult.ok ? 'ok' : 'err'}`}>
            {migrResult.ok ? `✓ ${migrResult.total} docs migrados` : `✗ ${migrResult.msg}`}
          </span>
        ) : null}
        <button
          type="button"
          className={`mini-action ${cliente.activa ? '' : 'success'}`}
          onClick={handleToggle}
          disabled={working}
        >
          {working ? '...' : cliente.activa ? 'Desactivar' : 'Activar'}
        </button>
        {confirmDelete ? (
          <>
            <button type="button" className="mini-action danger" onClick={handleDelete} disabled={working}>
              {working ? 'Eliminando...' : 'Confirmar'}
            </button>
            <button type="button" className="mini-action" onClick={() => setConfirmDelete(false)} disabled={working}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="mini-action danger" onClick={() => setConfirmDelete(true)} disabled={working}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

function SuperAdminPage({ currentUser, onLogout, onEnterPanel, dark = false, onToggleTheme }) {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'create' | cliente obj para editar
  const [invitandoCliente, setInvitandoCliente] = useState(null)
  const [globalStats, setGlobalStats] = useState(null)

  useEffect(() => {
    listClientes().then((list) => {
      setClientes(list)
      setLoading(false)
    })
    getGlobalStats().then(setGlobalStats)
  }, [])

  const handleSave = async (form) => {
    if (modal?.id) {
      await updateCliente(modal.id, form)
      setClientes((prev) => prev.map((c) => (c.id === modal.id ? { ...c, ...form } : c)))
    } else {
      const nuevo = await createCliente(form)
      setClientes((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    }
  }

  const handleToggle = async (cliente) => {
    await updateCliente(cliente.id, { activa: !cliente.activa })
    setClientes((prev) => prev.map((c) => (c.id === cliente.id ? { ...c, activa: !c.activa } : c)))
  }

  const handleDelete = async (clienteId) => {
    await deleteCliente(clienteId)
    setClientes((prev) => prev.filter((c) => c.id !== clienteId))
  }

  const handleMigrar = async (clienteId) => {
    return migrarDatosHuerfanos(clienteId)
  }

  const activas = clientes.filter((c) => c.activa).length

  return (
    <div className="superadmin-shell">
      <header className="superadmin-header">
        <div className="superadmin-header-brand">
          <span className="superadmin-badge">SUPERADMIN</span>
          <h1>Panel de empresas</h1>
        </div>
        <div className="superadmin-header-right">
          <span className="superadmin-user">{currentUser?.displayName || currentUser?.email}</span>
          <button type="button" className="ghost-action" onClick={onLogout}>
            Cerrar sesión
          </button>
          {onToggleTheme ? (
            <button
              type="button"
              className="ghost-action hero-theme-toggle"
              onClick={onToggleTheme}
              title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
          ) : null}
        </div>
      </header>

      <main className="superadmin-main">
        <div className="superadmin-stats">
          <div className="superadmin-stat">
            <span className="superadmin-stat-value">{clientes.length}</span>
            <span className="superadmin-stat-label">Empresas registradas</span>
          </div>
          <div className="superadmin-stat">
            <span className="superadmin-stat-value">{activas}</span>
            <span className="superadmin-stat-label">Activas</span>
          </div>
          <div className="superadmin-stat">
            <span className="superadmin-stat-value">{clientes.length - activas}</span>
            <span className="superadmin-stat-label">Inactivas</span>
          </div>
          <div className="superadmin-stat">
            <span className="superadmin-stat-value">
              {globalStats ? globalStats.eventos : '—'}
            </span>
            <span className="superadmin-stat-label">Eventos (total)</span>
          </div>
          <div className="superadmin-stat">
            <span className="superadmin-stat-value">
              {globalStats ? globalStats.asistentes : '—'}
            </span>
            <span className="superadmin-stat-label">Asistentes (total)</span>
          </div>
        </div>

        <div className="superadmin-toolbar">
          <h2>Empresas cliente</h2>
          <button type="button" className="submit-button" onClick={() => setModal('create')}>
            + Nueva empresa
          </button>
        </div>

        {loading ? (
          <p className="section-copy">Cargando empresas...</p>
        ) : clientes.length === 0 ? (
          <div className="empty-state">
            <h3>Sin empresas registradas</h3>
            <p>Crea la primera empresa para empezar a configurar su app.</p>
          </div>
        ) : (
          <div className="clientes-grid">
            {clientes.map((c) => (
              <ClienteCard
                key={c.id}
                cliente={c}
                onEdit={(cl) => setModal(cl)}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEnterPanel={onEnterPanel}
                onInvitar={(cl) => setInvitandoCliente(cl)}
                onMigrar={handleMigrar}
              />
            ))}
          </div>
        )}
      </main>

      {modal ? (
        <ClienteModal
          cliente={modal === 'create' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      ) : null}

      {invitandoCliente ? (
        <InvitarAdminModal
          cliente={invitandoCliente}
          onClose={() => setInvitandoCliente(null)}
        />
      ) : null}
    </div>
  )
}

export default SuperAdminPage

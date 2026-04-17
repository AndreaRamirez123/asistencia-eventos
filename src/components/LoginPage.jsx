import { useState } from 'react'
import { saveSession } from '../auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function LoginPage({ redirectTo = '/admin' }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'No fue posible iniciar sesion.')
      }

      saveSession(data.token, data.user)
      const target = data.user.role === 'staff' ? '/scanner' : redirectTo
      window.location.href = target
    } catch (error) {
      setErrorMessage(error.message || 'Credenciales invalidas.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Acceso restringido</p>
          <h1>Inicia sesion para operar el evento</h1>
          <p className="hero-text">
            Esta vista es solo para el equipo administrativo y staff de ingreso. Los asistentes no
            necesitan iniciar sesion, pueden registrarse directamente en{' '}
            <a href="/registro" className="secondary-action inline-link">
              /registro
            </a>
            .
          </p>
        </div>
      </header>

      <section className="panel public-panel">
        <div className="panel-heading">
          <p className="eyebrow">Credenciales</p>
          <h2>Ingreso al panel</h2>
          <p className="section-copy">
            Usuarios admin y staff. Si olvidaste la clave, contacta al administrador del evento.
          </p>
        </div>

        <form className="attendee-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Usuario</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin o staff"
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>Contrasena</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Iniciar sesion'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default LoginPage

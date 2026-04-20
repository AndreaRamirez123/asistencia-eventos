import { useState } from 'react'
import { loginWithEmail } from '../auth'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const user = await loginWithEmail(email, password)
      const target = user.role === 'staff' ? '/scanner' : '/admin'
      window.location.href = target
    } catch (error) {
      const code = error.code || ''
      let message = error.message || 'No fue posible iniciar sesion.'

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        message = 'Credenciales invalidas. Verifica el correo y la contrasena.'
      } else if (code === 'auth/user-not-found') {
        message = 'No existe una cuenta con ese correo.'
      } else if (code === 'auth/too-many-requests') {
        message = 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.'
      } else if (code === 'auth/invalid-email') {
        message = 'El correo electronico no tiene un formato valido.'
      }

      setErrorMessage(message)
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
            necesitan iniciar sesion aqui.
          </p>
          <a href="/registro" className="text-link">
            Si eres asistente, registrate aqui &rarr;
          </a>
        </div>
      </header>

      <section className="panel public-panel">
        <div className="panel-heading">
          <p className="eyebrow">Credenciales</p>
          <h2>Ingreso al panel</h2>
          <p className="section-copy">
            Usa el correo y contrasena asignados por el administrador del evento.
          </p>
        </div>

        <form className="attendee-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Correo electronico</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@cun.edu.co"
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

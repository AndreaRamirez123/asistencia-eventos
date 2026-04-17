const TOKEN_KEY = 'asistencia-evento:token'
const USER_KEY = 'asistencia-evento:user'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...authHeaders(),
  }
  const response = await fetch(url, { ...options, headers })
  if (response.status === 401) {
    clearSession()
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/admin/login'
    }
  }
  return response
}

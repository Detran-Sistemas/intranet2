import jwt from 'jsonwebtoken'
import Cookies from 'js-cookie'

export const AUTH_SYNC_STORAGE_KEY = 'detran_auth_sync_event'
export const AUTH_SYNC_CHANNEL_NAME = 'detran_auth_sync'

const REASON_MESSAGES = {
  missing_cookie: 'Sua sessão foi encerrada em outra janela. Faça login novamente.',
  invalid_token: 'Sua sessão tornou-se inválida. Faça login novamente.',
  guest_token: 'Sua sessão expirou e voltou para acesso anônimo. Faça login novamente.',
  user_changed: 'Outro usuário iniciou sessão nesta estação. Faça login novamente.',
  token_expired: 'Sua sessão expirou por tempo de inatividade. Faça login novamente.',
  logout_other_tab: 'Você saiu do sistema em outra aba. Redirecionando para o login...',
  http_401: 'Sessão não autorizada ou expirada. Faça login novamente.'
}

/**
 * Return localized explanation for why the active session was invalidated.
 *
 * @param {string} reason
 * @returns {string}
 */
export function getInvalidationMessage (reason) {
  return REASON_MESSAGES[reason] || 'Sua sessão foi encerrada. Faça login novamente.'
}

/**
 * Check whether a GraphQL error message indicates an auth or permission boundary failure.
 *
 * @param {string} message
 * @returns {boolean}
 */
export function isAuthFailureMessage (message) {
  if (!message || typeof message !== 'string') return false
  const lower = message.toLowerCase()
  return (
    lower === 'forbidden' ||
    lower === 'unauthorized' ||
    lower.includes('não autenticado') ||
    lower.includes('nao autenticado') ||
    lower.includes('permissiondeniederror') ||
    lower.includes('faça login')
  )
}

/**
 * Decode JWT payload safely without throwing on malformed cookies.
 *
 * @param {string} token
 * @returns {Object|null}
 */
export function decodeJwtPayload (token) {
  if (!token || typeof token !== 'string') return null
  try {
    const decoded = jwt.decode(token)
    return (decoded && typeof decoded === 'object') ? decoded : null
  } catch {
    return null
  }
}

/**
 * Validate whether the current JWT cookie still belongs to the authenticated Vuex user.
 *
 * @param {string|undefined|null} jwtToken
 * @param {number} expectedUserId
 * @param {boolean} expectedAuthenticated
 * @param {number} [nowMs]
 * @returns {{ valid: boolean, reason?: string, userId?: number, tokenUserId?: number, anonymous?: boolean }}
 */
export function validateSessionJwt (jwtToken, expectedUserId, expectedAuthenticated, nowMs = Date.now()) {
  const expectedId = Number(expectedUserId) || 0
  if (!expectedAuthenticated && (expectedId <= 0 || expectedId === 2)) {
    return { valid: true, anonymous: true }
  }

  if (!jwtToken) {
    return { valid: false, reason: 'missing_cookie' }
  }

  const decoded = decodeJwtPayload(jwtToken)
  if (!decoded || !decoded.id) {
    return { valid: false, reason: 'invalid_token' }
  }

  const tokenUserId = Number(decoded.id) || 0
  if (tokenUserId <= 0 || tokenUserId === 2) {
    return { valid: false, reason: 'guest_token' }
  }

  if (expectedId > 0 && tokenUserId !== expectedId) {
    return { valid: false, reason: 'user_changed', tokenUserId }
  }

  if (decoded.exp && (Number(decoded.exp) * 1000) <= nowMs) {
    return { valid: false, reason: 'token_expired' }
  }

  return { valid: true, userId: tokenUserId }
}

/**
 * Notify all open browser tabs that the user explicitly logged out.
 *
 * @param {number} [userId]
 * @param {Object} [options]
 */
export function broadcastLogout (userId = 0, options = {}) {
  const win = options.win || (typeof window !== 'undefined' ? window : null)
  const payload = {
    type: 'logout',
    userId: Number(userId) || 0,
    at: Date.now(),
    nonce: Math.random().toString(36).slice(2)
  }

  const storage = options.storage || (win && win.localStorage ? win.localStorage : null)
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore storage quota / private mode restrictions
    }
  }

  let channel = options.channel || null
  let createdInternally = false
  if (!channel && win && typeof win.BroadcastChannel === 'function') {
    try {
      channel = new win.BroadcastChannel(AUTH_SYNC_CHANNEL_NAME)
      createdInternally = true
    } catch {
      channel = null
    }
  }

  if (channel && typeof channel.postMessage === 'function') {
    try {
      channel.postMessage(payload)
    } catch {
      // Ignore channel delivery failures
    } finally {
      if (createdInternally && typeof channel.close === 'function') {
        try {
          channel.close()
        } catch {}
      }
    }
  }
}

/**
 * Create a cross-tab session guard coordinating logout listeners, tab focus checks,
 * and pre-flight GraphQL validation.
 *
 * @param {Object} options
 * @returns {{ checkSession: Function, assertRequestSession: Function, invalidate: Function, destroy: Function }}
 */
export function createSessionGuard (options = {}) {
  const store = options.store
  const win = options.win || (typeof window !== 'undefined' ? window : null)
  const doc = options.doc || (typeof document !== 'undefined' ? document : null)
  const getCookie = options.getCookie || (() => Cookies.get('jwt'))
  const redirectTo = options.redirectTo || '/login'
  const redirectDelayMs = options.redirectDelayMs !== undefined ? Number(options.redirectDelayMs) : 800

  let invalidated = false
  let redirectTimer = null
  let channelInstance = options.channel || null
  let ownsChannel = false

  if (!channelInstance && win && typeof win.BroadcastChannel === 'function') {
    try {
      channelInstance = new win.BroadcastChannel(AUTH_SYNC_CHANNEL_NAME)
      ownsChannel = true
    } catch {
      channelInstance = null
    }
  }

  const invalidate = (reason) => {
    const userState = (store && store.state && store.state.user) || {}
    const wasAuthenticated = Boolean(userState.authenticated)
    if (!wasAuthenticated && invalidated) {
      return false
    }
    if (!wasAuthenticated && (!userState.id || Number(userState.id) <= 0 || Number(userState.id) === 2)) {
      return false
    }

    invalidated = true
    const message = getInvalidationMessage(reason)

    if (store && typeof store.commit === 'function') {
      try {
        store.commit('user/CLEAR_AUTH')
      } catch {}
      try {
        store.commit('showNotification', {
          style: 'red',
          message,
          icon: 'alert'
        })
      } catch {}
    }

    const currentPath = (win && win.location && win.location.pathname) ? win.location.pathname : ''
    if (win && win.location && typeof win.location.assign === 'function' && currentPath !== redirectTo && !redirectTimer) {
      if (redirectDelayMs <= 0) {
        try {
          win.location.assign(redirectTo)
        } catch {}
      } else {
        redirectTimer = setTimeout(() => {
          redirectTimer = null
          try {
            win.location.assign(redirectTo)
          } catch {}
        }, redirectDelayMs)
      }
    }

    return true
  }

  const checkSession = () => {
    const userState = (store && store.state && store.state.user) || {}
    const result = validateSessionJwt(getCookie(), userState.id, Boolean(userState.authenticated))
    if (!result.valid) {
      invalidate(result.reason)
    }
    return result
  }

  const assertRequestSession = () => {
    const result = checkSession()
    if (!result.valid) {
      const err = new Error(getInvalidationMessage(result.reason))
      err.isSessionInvalidated = true
      throw err
    }
    return result
  }

  const handleLogoutSignal = (payload) => {
    if (!payload || payload.type !== 'logout') return
    const userState = (store && store.state && store.state.user) || {}
    if (!userState.authenticated) return
    if (!payload.userId || Number(payload.userId) === Number(userState.id)) {
      invalidate('logout_other_tab')
    }
  }

  const onStorage = (evt) => {
    if (!evt || evt.key !== AUTH_SYNC_STORAGE_KEY || !evt.newValue) return
    try {
      handleLogoutSignal(JSON.parse(evt.newValue))
    } catch {}
  }

  const onChannelMessage = (evt) => {
    handleLogoutSignal(evt && evt.data ? evt.data : evt)
  }

  const onFocus = () => {
    checkSession()
  }

  const onVisibilityChange = () => {
    if (!doc || !doc.visibilityState || doc.visibilityState === 'visible') {
      checkSession()
    }
  }

  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('storage', onStorage)
    win.addEventListener('focus', onFocus)
  }
  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('visibilitychange', onVisibilityChange)
  }
  if (channelInstance && typeof channelInstance.addEventListener === 'function') {
    channelInstance.addEventListener('message', onChannelMessage)
  }

  const destroy = () => {
    if (redirectTimer) {
      clearTimeout(redirectTimer)
      redirectTimer = null
    }
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('storage', onStorage)
      win.removeEventListener('focus', onFocus)
    }
    if (doc && typeof doc.removeEventListener === 'function') {
      doc.removeEventListener('visibilitychange', onVisibilityChange)
    }
    if (channelInstance && typeof channelInstance.removeEventListener === 'function') {
      channelInstance.removeEventListener('message', onChannelMessage)
    }
    if (ownsChannel && channelInstance && typeof channelInstance.close === 'function') {
      try {
        channelInstance.close()
      } catch {}
    }
  }

  return {
    checkSession,
    assertRequestSession,
    invalidate,
    destroy
  }
}

export default {
  AUTH_SYNC_STORAGE_KEY,
  AUTH_SYNC_CHANNEL_NAME,
  getInvalidationMessage,
  isAuthFailureMessage,
  decodeJwtPayload,
  validateSessionJwt,
  broadcastLogout,
  createSessionGuard
}

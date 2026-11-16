const jwt = require('jsonwebtoken')

const getAuthSync = () => require('../../../../client/modules/auth-sync')
const userStore = require('../../../../client/store/user').default

function makeFakeJwt(payload) {
  return jwt.sign(payload, 'detran-test-secret')
}

describe('Detran Auth Sync & Cross-Tab Session Security (Etapa 1 TDD)', () => {
  test('validateSessionJwt detects missing cookie, guest token, user mismatch, and expiration', () => {
    const { validateSessionJwt } = getAuthSync()
    const now = Date.now()
    const validExp = Math.floor(now / 1000) + 3600
    const expiredExp = Math.floor(now / 1000) - 60

    // Anonymous tab remains valid without cookie
    expect(validateSessionJwt(undefined, 0, false, now)).toEqual({
      valid: true,
      anonymous: true
    })

    // Authenticated tab with missing cookie -> invalid
    expect(validateSessionJwt(undefined, 10, true, now)).toEqual({
      valid: false,
      reason: 'missing_cookie'
    })

    // Authenticated tab where cookie became Guest (id: 2)
    const guestToken = makeFakeJwt({ id: 2, name: 'Guest', exp: validExp })
    expect(validateSessionJwt(guestToken, 10, true, now)).toEqual({
      valid: false,
      reason: 'guest_token'
    })

    // Authenticated tab where another user (id: 20) signed in on another tab
    const otherUserToken = makeFakeJwt({ id: 20, email: 'revisor@detran.mg.gov.br', exp: validExp })
    expect(validateSessionJwt(otherUserToken, 10, true, now)).toEqual({
      valid: false,
      reason: 'user_changed',
      tokenUserId: 20
    })

    // Expired JWT cookie
    const expiredToken = makeFakeJwt({ id: 10, email: 'editor@detran.mg.gov.br', exp: expiredExp })
    expect(validateSessionJwt(expiredToken, 10, true, now)).toEqual({
      valid: false,
      reason: 'token_expired'
    })

    // Matching valid JWT
    const validToken = makeFakeJwt({ id: 10, email: 'editor@detran.mg.gov.br', exp: validExp })
    expect(validateSessionJwt(validToken, 10, true, now)).toEqual({
      valid: true,
      userId: 10
    })
  })

  test('Vuex user/REFRESH_AUTH clears state when JWT cookie disappears or expires, and CLEAR_AUTH resets fields', () => {
    const Cookies = require('js-cookie')
    const validExp = Math.floor(Date.now() / 1000) + 3600
    const token = makeFakeJwt({
      id: 101,
      email: 'editor@detran.mg.gov.br',
      name: 'Editor Detran',
      permissions: ['read:pages', 'write:drafts'],
      iat: Math.floor(Date.now() / 1000),
      exp: validExp
    })

    const getSpy = jest.spyOn(Cookies, 'get').mockReturnValue(token)

    const st = { ...userStore.state }
    userStore.mutations.REFRESH_AUTH(st)
    expect(st.authenticated).toBe(true)
    expect(st.id).toBe(101)
    expect(st.permissions).toEqual(['read:pages', 'write:drafts'])

    // Now simulate logoff in another tab (cookie removed)
    getSpy.mockReturnValue(undefined)
    userStore.mutations.REFRESH_AUTH(st)
    expect(st.authenticated).toBe(false)
    expect(st.id).toBe(0)
    expect(st.email).toBe('')
    expect(st.permissions).toEqual([])

    // Restore and test explicit CLEAR_AUTH
    getSpy.mockReturnValue(token)
    userStore.mutations.REFRESH_AUTH(st)
    expect(st.authenticated).toBe(true)
    userStore.mutations.CLEAR_AUTH(st)
    expect(st.authenticated).toBe(false)
    expect(st.id).toBe(0)

    getSpy.mockRestore()
  })

  test('broadcastLogout, storage/focus listeners, and GraphQL guard clear auth, alert, and redirect once', () => {
    jest.useFakeTimers()
    const {
      AUTH_SYNC_STORAGE_KEY,
      broadcastLogout,
      createSessionGuard
    } = getAuthSync()

    const storageMap = {}
    const fakeStorage = {
      setItem: jest.fn((k, v) => {
        storageMap[k] = v
      }),
      getItem: jest.fn(k => storageMap[k] || null)
    }
    const channelMessages = []
    const fakeChannel = {
      postMessage: jest.fn(msg => channelMessages.push(msg)),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn()
    }

    // Broadcast logout event
    broadcastLogout(101, { storage: fakeStorage, channel: fakeChannel })
    expect(fakeStorage.setItem).toHaveBeenCalledWith(
      AUTH_SYNC_STORAGE_KEY,
      expect.stringContaining('"type":"logout"')
    )
    expect(fakeChannel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'logout', userId: 101 })
    )

    // Setup authenticated store + fake browser listeners
    const listeners = {}
    const docListeners = {}
    const assignMock = jest.fn()
    const fakeWin = {
      location: { pathname: '/w/dashboard', assign: assignMock },
      addEventListener: jest.fn((evt, cb) => {
        listeners[evt] = cb
      }),
      removeEventListener: jest.fn()
    }
    const fakeDoc = {
      visibilityState: 'visible',
      addEventListener: jest.fn((evt, cb) => {
        docListeners[evt] = cb
      }),
      removeEventListener: jest.fn()
    }

    const fakeStore = {
      state: { user: { id: 101, authenticated: true } },
      commit: jest.fn((mutation) => {
        if (mutation === 'user/CLEAR_AUTH') {
          fakeStore.state.user.id = 0
          fakeStore.state.user.authenticated = false
        }
      })
    }

    let currentCookie = makeFakeJwt({ id: 101, exp: Math.floor(Date.now() / 1000) + 3600 })
    const guard = createSessionGuard({
      store: fakeStore,
      win: fakeWin,
      doc: fakeDoc,
      getCookie: () => currentCookie,
      storage: fakeStorage,
      channel: fakeChannel,
      redirectDelayMs: 500
    })

    // 1. Valid cookie lets GraphQL pre-flight pass
    expect(() => guard.assertRequestSession()).not.toThrow()

    // 2. Cookie vanishes (logged out in another tab) -> GraphQL pre-flight aborts and clears auth
    currentCookie = undefined
    expect(() => guard.assertRequestSession()).toThrow(/sessão/i)
    expect(fakeStore.commit).toHaveBeenCalledWith('user/CLEAR_AUTH')
    expect(fakeStore.commit).toHaveBeenCalledWith(
      'showNotification',
      expect.objectContaining({ style: 'red' })
    )

    // Subsequent triggers do not fire duplicate redirects
    listeners.focus()
    docListeners.visibilitychange()
    jest.advanceTimersByTime(600)
    expect(assignMock).toHaveBeenCalledTimes(1)
    expect(assignMock).toHaveBeenCalledWith('/login')

    guard.destroy()
    jest.useRealTimers()
  })

  test('storage event with logout payload invalidates active tab immediately even before cookie polling', () => {
    jest.useFakeTimers()
    const {
      AUTH_SYNC_STORAGE_KEY,
      createSessionGuard
    } = getAuthSync()

    const listeners = {}
    const assignMock = jest.fn()
    const fakeWin = {
      location: { pathname: '/e/pt-br/pagina', assign: assignMock },
      addEventListener: jest.fn((evt, cb) => {
        listeners[evt] = cb
      }),
      removeEventListener: jest.fn()
    }
    const fakeDoc = {
      visibilityState: 'visible',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }
    const fakeStore = {
      state: { user: { id: 55, authenticated: true } },
      commit: jest.fn((mutation) => {
        if (mutation === 'user/CLEAR_AUTH') {
          fakeStore.state.user.id = 0
          fakeStore.state.user.authenticated = false
        }
      })
    }

    const validCookie = makeFakeJwt({ id: 55, exp: Math.floor(Date.now() / 1000) + 3600 })
    const guard = createSessionGuard({
      store: fakeStore,
      win: fakeWin,
      doc: fakeDoc,
      getCookie: () => validCookie,
      redirectDelayMs: 300
    })

    // Fire cross-tab storage logout event
    listeners.storage({
      key: AUTH_SYNC_STORAGE_KEY,
      newValue: JSON.stringify({ type: 'logout', userId: 55, at: Date.now() })
    })

    expect(fakeStore.commit).toHaveBeenCalledWith('user/CLEAR_AUTH')
    jest.advanceTimersByTime(350)
    expect(assignMock).toHaveBeenCalledWith('/login')

    guard.destroy()
    jest.useRealTimers()
  })
})

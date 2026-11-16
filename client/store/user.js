import { make } from 'vuex-pathify'
import jwt from 'jsonwebtoken'
import Cookies from 'js-cookie'

const getDefaultState = () => ({
  id: 0,
  email: '',
  name: '',
  pictureUrl: '',
  localeCode: '',
  defaultEditor: '',
  timezone: '',
  dateFormat: '',
  appearance: '',
  permissions: [],
  iat: 0,
  exp: 0,
  authenticated: false
})

const state = getDefaultState()

export default {
  namespaced: true,
  state,
  mutations: {
    ...make.mutations(state),
    CLEAR_AUTH(st) {
      Object.assign(st, getDefaultState())
    },
    REFRESH_AUTH(st) {
      const jwtCookie = Cookies.get('jwt')
      if (!jwtCookie) {
        Object.assign(st, getDefaultState())
        return
      }
      try {
        const jwtData = jwt.decode(jwtCookie)
        if (!jwtData || !jwtData.id || Number(jwtData.id) <= 0 || Number(jwtData.id) === 2) {
          Object.assign(st, getDefaultState())
          return
        }
        if (jwtData.exp && (Number(jwtData.exp) * 1000) <= Date.now()) {
          Object.assign(st, getDefaultState())
          return
        }
        st.id = jwtData.id
        st.email = jwtData.email
        st.name = jwtData.name
        st.pictureUrl = jwtData.av
        st.localeCode = jwtData.lc
        st.timezone = jwtData.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        st.dateFormat = jwtData.df || ''
        st.appearance = jwtData.ap || ''
        // st.defaultEditor = jwtData.defaultEditor
        st.permissions = jwtData.permissions
        st.iat = jwtData.iat
        st.exp = jwtData.exp
        st.authenticated = true
      } catch (err) {
        console.debug('Invalid JWT. Silent authentication skipped.')
        Object.assign(st, getDefaultState())
      }
    }
  }
}

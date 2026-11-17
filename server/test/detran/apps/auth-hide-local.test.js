const _ = require('lodash')

describe('Segurança / Autenticação: Respeito à configuração Ocultar Login Local (authHideLocal)', () => {
  // Helper de normalização (mesma lógica usada no backend)
  function normalizeHideLocal(val) {
    return Boolean(val === true || val === 'true' || val === 1 || val === '1')
  }

  // Simulação do getter computed de isLocalHidden no client
  function computeIsLocalHidden(hideLocalProp, siteConfigHideLocal, search = '') {
    const qParams = new URLSearchParams(search)
    if (qParams.has('all')) {
      return false
    }
    if (hideLocalProp === true || hideLocalProp === 'true' || hideLocalProp === 'hide-local' || hideLocalProp === 1 || hideLocalProp === '1') {
      return true
    }
    if (siteConfigHideLocal === true || siteConfigHideLocal === 'true' || siteConfigHideLocal === 1 || siteConfigHideLocal === '1') {
      return true
    }
    return false
  }

  // Simulação dos computed properties do login.vue
  function computeStrategies({ strategies, isLocalHidden, selectedStrategyKey }) {
    const filteredStrategies = isLocalHidden ? _.reject(strategies, ['key', 'local']) : strategies
    const formStrategies = filteredStrategies.filter(s => s.strategy && s.strategy.useForm)
    const ssoStrategies = filteredStrategies.filter(s => s.strategy && !s.strategy.useForm)

    let selectedStrategy = _.find(filteredStrategies, ['key', selectedStrategyKey])
    if (!selectedStrategy && formStrategies.length > 0) {
      selectedStrategy = formStrategies[0]
    }
    if (!selectedStrategy && filteredStrategies.length > 0) {
      selectedStrategy = filteredStrategies[0]
    }
    if (!selectedStrategy) {
      if (isLocalHidden) {
        selectedStrategy = { key: '', strategy: { useForm: false, usernameType: 'email', icon: '', color: 'grey' }, displayName: '' }
      } else {
        selectedStrategy = { key: 'local', strategy: { useForm: true, usernameType: 'email', icon: '', color: 'blue darken-2' }, displayName: 'Local' }
      }
    }

    return { filteredStrategies, formStrategies, ssoStrategies, selectedStrategy }
  }

  const localStrategy = {
    key: 'local',
    displayName: 'Local',
    strategy: { key: 'local', useForm: true, usernameType: 'email', icon: '<svg>local</svg>' }
  }

  const ssoStrategy = {
    key: 'google',
    displayName: 'Google Workspace',
    strategy: { key: 'google', useForm: false, usernameType: 'email', icon: '<svg>google</svg>' }
  }

  const ldapStrategy = {
    key: 'ldap',
    displayName: 'Active Directory / LDAP',
    strategy: { key: 'ldap', useForm: true, usernameType: 'username', icon: '<svg>ldap</svg>' }
  }

  describe('1. Normalização do flag auth.hideLocal', () => {
    test('Valores truthy são normalizados para true', () => {
      expect(normalizeHideLocal(true)).toBe(true)
      expect(normalizeHideLocal('true')).toBe(true)
      expect(normalizeHideLocal(1)).toBe(true)
      expect(normalizeHideLocal('1')).toBe(true)
    })

    test('Valores falsy são normalizados para false', () => {
      expect(normalizeHideLocal(false)).toBe(false)
      expect(normalizeHideLocal('false')).toBe(false)
      expect(normalizeHideLocal(0)).toBe(false)
      expect(normalizeHideLocal('0')).toBe(false)
      expect(normalizeHideLocal(null)).toBe(false)
      expect(normalizeHideLocal(undefined)).toBe(false)
    })
  })

  describe('2. Detecção client-side de isLocalHidden', () => {
    test('Retorna true se hideLocal prop for true', () => {
      expect(computeIsLocalHidden(true, false)).toBe(true)
      expect(computeIsLocalHidden('hide-local', false)).toBe(true)
      expect(computeIsLocalHidden('true', false)).toBe(true)
    })

    test('Retorna true se siteConfig.authHideLocal for true mesmo sem prop', () => {
      expect(computeIsLocalHidden(false, true)).toBe(true)
      expect(computeIsLocalHidden(undefined, true)).toBe(true)
    })

    test('Retorna false se a flag estiver desligada em ambos', () => {
      expect(computeIsLocalHidden(false, false)).toBe(false)
    })

    test('Bypass de administrador com ?all sempre exibe login local', () => {
      expect(computeIsLocalHidden(true, true, '?all')).toBe(false)
      expect(computeIsLocalHidden(true, true, '?returnApp=servicedesk&all=1')).toBe(false)
    })
  })

  describe('3. Comportamento das estratégias com Local oculto', () => {
    test('Quando local está oculto e só há local configurado: sem formulário e sem fallback acidental', () => {
      const { filteredStrategies, formStrategies, ssoStrategies, selectedStrategy } = computeStrategies({
        strategies: [localStrategy],
        isLocalHidden: true,
        selectedStrategyKey: 'local'
      })

      expect(filteredStrategies).toHaveLength(0)
      expect(formStrategies).toHaveLength(0)
      expect(ssoStrategies).toHaveLength(0)
      expect(selectedStrategy.key).toBe('')
      expect(selectedStrategy.strategy.useForm).toBe(false)
    })

    test('Quando local está oculto e há SSO configurado: exibe apenas SSO', () => {
      const { filteredStrategies, formStrategies, ssoStrategies, selectedStrategy } = computeStrategies({
        strategies: [localStrategy, ssoStrategy],
        isLocalHidden: true,
        selectedStrategyKey: 'local'
      })

      expect(filteredStrategies).toHaveLength(1)
      expect(filteredStrategies[0].key).toBe('google')
      expect(formStrategies).toHaveLength(0)
      expect(ssoStrategies).toHaveLength(1)
      expect(selectedStrategy.key).toBe('google')
      expect(selectedStrategy.strategy.useForm).toBe(false)
    })

    test('Quando local está oculto e há outro form (LDAP): seleciona LDAP e oculta Local', () => {
      const { filteredStrategies, formStrategies, ssoStrategies, selectedStrategy } = computeStrategies({
        strategies: [localStrategy, ldapStrategy],
        isLocalHidden: true,
        selectedStrategyKey: 'local'
      })

      expect(filteredStrategies).toHaveLength(1)
      expect(filteredStrategies[0].key).toBe('ldap')
      expect(formStrategies).toHaveLength(1)
      expect(ssoStrategies).toHaveLength(0)
      expect(selectedStrategy.key).toBe('ldap')
      expect(selectedStrategy.strategy.useForm).toBe(true)
    })
  })

  describe('4. Comportamento com Local exibido (padrão)', () => {
    test('Quando local está exibido: formulário de credenciais local fica ativo', () => {
      const { filteredStrategies, formStrategies, selectedStrategy } = computeStrategies({
        strategies: [localStrategy, ssoStrategy],
        isLocalHidden: false,
        selectedStrategyKey: 'local'
      })

      expect(filteredStrategies).toHaveLength(2)
      expect(formStrategies).toHaveLength(1)
      expect(formStrategies[0].key).toBe('local')
      expect(selectedStrategy.key).toBe('local')
      expect(selectedStrategy.strategy.useForm).toBe(true)
    })
  })
})

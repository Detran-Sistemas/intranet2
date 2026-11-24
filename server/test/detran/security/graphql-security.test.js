const { buildSchema, parse, validate } = require('graphql')
const {
  noIntrospectionValidationRule,
  formatGraphQLError,
  getGraphQLSecurityOptions
} = require('../../../helpers/graphql-security')

describe('GraphQL Security Hardening (Anti-Introspection & Error Sanitization)', () => {
  const sampleSchema = buildSchema(`
    type Query {
      hello: String
      analytics: String
    }
  `)

  describe('getGraphQLSecurityOptions (Fail-Closed Policy)', () => {
    test('desabilita introspection, playground e debug por padrão mesmo sem NODE_ENV definido', () => {
      const opts = getGraphQLSecurityOptions({}, false)
      expect(opts.introspection).toBe(false)
      expect(opts.playground).toBe(false)
      expect(opts.debug).toBe(false)
      expect(Array.isArray(opts.validationRules)).toBe(true)
      expect(opts.validationRules).toContain(noIntrospectionValidationRule)
      expect(typeof opts.formatError).toBe('function')
    })

    test('mantém introspection e playground desabilitados em produção mesmo com variáveis opt-in ativas', () => {
      const opts = getGraphQLSecurityOptions({
        NODE_ENV: 'production',
        WIKI_GRAPHQL_INTROSPECTION: 'true',
        WIKI_GRAPHQL_PLAYGROUND: 'true'
      }, true)

      expect(opts.introspection).toBe(false)
      expect(opts.playground).toBe(false)
      expect(opts.debug).toBe(false)
      expect(opts.validationRules).toContain(noIntrospectionValidationRule)
    })

    test('mantém introspection e playground desabilitados em development sem opt-in explícito', () => {
      const opts = getGraphQLSecurityOptions({ NODE_ENV: 'development' }, true)
      expect(opts.introspection).toBe(false)
      expect(opts.playground).toBe(false)
      expect(opts.debug).toBe(true)
      expect(opts.validationRules).toContain(noIntrospectionValidationRule)
    })

    test('permite habilitar introspection e playground apenas com opt-in explícito em development', () => {
      const opts = getGraphQLSecurityOptions({
        NODE_ENV: 'development',
        WIKI_GRAPHQL_INTROSPECTION: 'true',
        WIKI_GRAPHQL_PLAYGROUND: 'true'
      }, true)

      expect(opts.introspection).toBe(true)
      expect(opts.playground).toBe(true)
      expect(opts.debug).toBe(true)
      expect(opts.validationRules).toBeUndefined()
    })
  })

  describe('noIntrospectionValidationRule', () => {
    test('bloqueia consulta direta a __schema', () => {
      const doc = parse('query { __schema { types { name } } }')
      const errors = validate(sampleSchema, doc, [noIntrospectionValidationRule])
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('GraphQL introspection is disabled.')
    })

    test('bloqueia consulta direta a __type', () => {
      const doc = parse('query { __type(name: "Query") { fields { name } } }')
      const errors = validate(sampleSchema, doc, [noIntrospectionValidationRule])
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('GraphQL introspection is disabled.')
    })

    test('bloqueia introspecção via alias ou fragmento inline', () => {
      const doc = parse(`
        query {
          ... on Query {
            leakedSchema: __schema {
              queryType { name }
            }
          }
        }
      `)
      const errors = validate(sampleSchema, doc, [noIntrospectionValidationRule])
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('GraphQL introspection is disabled.')
    })

    test('permite consultas normais com __typename (usado pelo Apollo Client no frontend)', () => {
      const doc = parse('query { __typename hello }')
      const errors = validate(sampleSchema, doc, [noIntrospectionValidationRule])
      expect(errors).toEqual([])
    })
  })

  describe('formatGraphQLError', () => {
    test('remove sugestões de campo ("Did you mean...") para impedir enumeração de schema', () => {
      const rawError = {
        message: 'Cannot query field "analyticz" on type "Query". Did you mean "analytics"?',
        extensions: {
          code: 'GRAPHQL_VALIDATION_FAILED',
          exception: {
            stacktrace: ['Error: Cannot query field...', 'at Object.validate (...)']
          }
        }
      }

      const sanitized = formatGraphQLError(rawError, {
        allowFieldSuggestions: false,
        allowStacktrace: false
      })

      expect(sanitized.message).toBe('Cannot query field "analyticz" on type "Query".')
      expect(sanitized.message).not.toContain('Did you mean')
      expect(sanitized.extensions.code).toBe('GRAPHQL_VALIDATION_FAILED')
      expect(sanitized.extensions.exception).toBeUndefined()
    })

    test('preserva mensagens de erro de negócio e autenticação', () => {
      const rawError = {
        message: 'Unauthorized',
        extensions: { code: 'UNAUTHENTICATED' }
      }

      const sanitized = formatGraphQLError(rawError, {
        allowFieldSuggestions: false,
        allowStacktrace: false
      })

      expect(sanitized.message).toBe('Unauthorized')
      expect(sanitized.extensions.code).toBe('UNAUTHENTICATED')
    })
  })
})

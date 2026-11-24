const { GraphQLError } = require('graphql')

const FIELD_SUGGESTION_REGEX = /\s*Did you mean\s+[\s\S]*?\?/gi

/**
 * GraphQL validation rule that blocks schema introspection fields (__schema, __type)
 * anywhere in the document AST (including aliases and fragments), while allowing
 * __typename which Apollo Client relies on for cache normalization.
 */
function noIntrospectionValidationRule (context) {
  return {
    Field (node) {
      const fieldName = node && node.name && node.name.value
      if (fieldName === '__schema' || fieldName === '__type') {
        context.reportError(
          new GraphQLError('GraphQL introspection is disabled.', [node])
        )
      }
    }
  }
}

/**
 * Sanitizes GraphQL error responses to prevent schema discovery ("Did you mean...")
 * and stack trace disclosure outside explicit debug mode.
 *
 * @param {Object} err - Formatted GraphQL error object
 * @param {Object} [options]
 * @param {boolean} [options.allowFieldSuggestions=false]
 * @param {boolean} [options.allowStacktrace=false]
 * @returns {Object} Sanitized error object
 */
function formatGraphQLError (err, options = {}) {
  if (!err || typeof err !== 'object') {
    return err
  }

  const allowFieldSuggestions = Boolean(options.allowFieldSuggestions)
  const allowStacktrace = Boolean(options.allowStacktrace)

  const sanitized = { ...err }

  if (!allowFieldSuggestions && typeof sanitized.message === 'string') {
    sanitized.message = sanitized.message.replace(FIELD_SUGGESTION_REGEX, '').trim()
  }

  if (!allowStacktrace && sanitized.extensions && typeof sanitized.extensions === 'object') {
    const nextExtensions = { ...sanitized.extensions }
    if (nextExtensions.exception && typeof nextExtensions.exception === 'object') {
      const nextException = { ...nextExtensions.exception }
      delete nextException.stacktrace
      if (Object.keys(nextException).length === 0) {
        delete nextExtensions.exception
      } else {
        nextExtensions.exception = nextException
      }
    }
    sanitized.extensions = nextExtensions
  }

  return sanitized
}

/**
 * Builds fail-closed ApolloServer security options.
 * Introspection, Playground, and Debug mode are strictly disabled by default
 * regardless of whether NODE_ENV is set, and can only be opted into explicitly
 * when NODE_ENV === 'development'.
 *
 * @param {Object} [env=process.env]
 * @param {boolean} [isDebug=false]
 * @returns {Object} ApolloServer options fragment
 */
function getGraphQLSecurityOptions (env = process.env, isDebug = false) {
  const safeEnv = env || {}
  const isExplicitDev = safeEnv.NODE_ENV === 'development'

  const introspection = Boolean(isExplicitDev && safeEnv.WIKI_GRAPHQL_INTROSPECTION === 'true')
  const playground = Boolean(isExplicitDev && safeEnv.WIKI_GRAPHQL_PLAYGROUND === 'true')
  const debug = Boolean(isExplicitDev && isDebug)

  const options = {
    introspection,
    playground,
    debug,
    formatError: (err) => formatGraphQLError(err, {
      allowFieldSuggestions: introspection,
      allowStacktrace: debug
    })
  }

  if (!introspection) {
    options.validationRules = [noIntrospectionValidationRule]
  }

  return options
}

module.exports = {
  noIntrospectionValidationRule,
  formatGraphQLError,
  getGraphQLSecurityOptions
}

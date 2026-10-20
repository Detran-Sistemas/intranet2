const Model = require('objection').Model

/**
 * Detran Workflow Policies Model
 * Defines workflow policies (approval levels, review intervals) per path prefix.
 */
module.exports = class DetranWfPolicy extends Model {
  static get tableName() {
    return 'detranWfPolicies'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['pathPrefix'],

      properties: {
        id: { type: 'integer' },
        pathPrefix: { type: 'string' },
        approvalLevels: { type: 'integer', default: 1 },
        reviewIntervalDays: { type: 'integer', default: 365 },
        autoArchiveOnExpire: { type: 'boolean', default: false },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  $beforeInsert() {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
    if (!this.approvalLevels) {
      this.approvalLevels = 1
    }
    if (!this.reviewIntervalDays) {
      this.reviewIntervalDays = 365
    }
    if (this.autoArchiveOnExpire === undefined) {
      this.autoArchiveOnExpire = false
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  $parseDatabaseJson(json) {
    json = super.$parseDatabaseJson(json)
    if (json.autoArchiveOnExpire !== undefined) {
      json.autoArchiveOnExpire = Boolean(json.autoArchiveOnExpire)
    }
    return json
  }

  /**
   * Find matching policy for a given path by longest prefix match
   * @param {string} path
   * @returns {Promise<DetranWfPolicy|null>}
   */
  static async getMatchingPolicy(path) {
    const cleanPath = (path.startsWith('/') ? path : `/${path}`).toLowerCase()
    const policies = await this.query().orderBy('pathPrefix', 'desc')
    for (const policy of policies) {
      const rawPrefix = policy.pathPrefix.toLowerCase()
      const prefix = rawPrefix.startsWith('/') ? rawPrefix : `/${rawPrefix}`
      if (cleanPath.startsWith(prefix) || cleanPath === prefix.replace(/\/$/, '')) {
        return policy
      }
    }
    return null
  }
}

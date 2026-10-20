const _ = require('lodash')
const DetranWfPolicy = require('../../models/detranWfPolicy')
const eventsDispatcher = require('./events-dispatcher')

const DEFAULT_POLICY = {
  pathPrefix: '/',
  approvalLevels: 1,
  reviewIntervalDays: 365,
  autoArchiveOnExpire: false
}

/**
 * Detran Workflow Policies Service
 * Manages route policies, validity intervals, and the contingency feature flag.
 */
class PoliciesService {
  constructor() {
    this.DEFAULT_POLICY = DEFAULT_POLICY
  }

  /**
   * Check if Detran Workflow is enabled (Feature Flag)
   *
   * @returns {boolean}
   */
  isWorkflowEnabled() {
    if (process.env.DETRAN_WF_ENABLED === 'false') {
      return false
    }
    return Boolean(_.get(global, 'WIKI.config.detranWorkflow.enabled', true))
  }

  /**
   * Set Detran Workflow enabled status (Feature Flag)
   *
   * @param {boolean} enabled
   */
  setWorkflowEnabled(enabled) {
    const val = Boolean(enabled)
    _.set(global, 'WIKI.config.detranWorkflow.enabled', val)
    process.env.DETRAN_WF_ENABLED = String(val)
    return val
  }

  /**
   * Get current workflow configuration
   *
   * @returns {{ enabled: boolean, teamsWebhookUrl: string|null }}
   */
  getWorkflowConfig() {
    return {
      enabled: this.isWorkflowEnabled(),
      teamsWebhookUrl: eventsDispatcher.getTeamsWebhookUrl()
    }
  }

  /**
   * Set workflow configuration
   *
   * @param {Object} opts
   * @param {boolean} [opts.enabled]
   * @param {string|null} [opts.teamsWebhookUrl]
   * @returns {{ enabled: boolean, teamsWebhookUrl: string|null }}
   */
  async setWorkflowConfig(opts = {}) {
    if (opts.enabled !== undefined) {
      this.setWorkflowEnabled(opts.enabled)
    }
    if (opts.teamsWebhookUrl !== undefined) {
      eventsDispatcher.setTeamsWebhookUrl(opts.teamsWebhookUrl ? opts.teamsWebhookUrl.trim() : null)
      _.set(global, 'WIKI.config.detranWorkflow.teamsWebhookUrl', opts.teamsWebhookUrl ? opts.teamsWebhookUrl.trim() : null)
    }
    return this.getWorkflowConfig()
  }

  /**
   * List all configured workflow policies
   *
   * @returns {Promise<Array>}
   */
  async listPolicies() {
    try {
      const list = await DetranWfPolicy.query().orderBy('pathPrefix', 'asc')
      return list
    } catch {
      return []
    }
  }

  /**
   * Resolves the effective policy for a given document path.
   *
   * @param {string} path - Document path (e.g. 'normativos/portaria-01')
   * @returns {Promise<Object>} Policy object with approvalLevels, reviewIntervalDays, autoArchiveOnExpire
   */
  async resolvePolicy(path) {
    // If workflow is disabled via feature flag, return 1-level bypass policy
    if (!this.isWorkflowEnabled()) {
      return {
        ...DEFAULT_POLICY,
        approvalLevels: 1,
        reviewIntervalDays: 0,
        disabled: true,
        contingency: true
      }
    }

    if (!path) {
      return { ...DEFAULT_POLICY }
    }

    try {
      const matched = await DetranWfPolicy.getMatchingPolicy(path)
      if (matched) {
        return {
          id: matched.id,
          pathPrefix: matched.pathPrefix,
          approvalLevels: matched.approvalLevels || 1,
          reviewIntervalDays: matched.reviewIntervalDays !== undefined ? matched.reviewIntervalDays : 365,
          autoArchiveOnExpire: Boolean(matched.autoArchiveOnExpire)
        }
      }
    } catch {
      // In isolated tests without DB or if table is empty, fallback to default
    }

    return { ...DEFAULT_POLICY }
  }

  /**
   * Create or update a policy for a path prefix
   *
   * @param {Object} data
   * @param {number} [data.id]
   * @param {string} data.pathPrefix
   * @param {number} data.approvalLevels
   * @param {number} [data.reviewIntervalDays]
   * @param {boolean} [data.autoArchiveOnExpire]
   * @returns {Promise<Object>}
   */
  async setPolicy(data) {
    const rawPrefix = (data.pathPrefix || '/').trim()
    const pathPrefix = rawPrefix.startsWith('/') ? rawPrefix : `/${rawPrefix}`
    const approvalLevels = Math.min(2, Math.max(1, Number(data.approvalLevels) || 1))
    const reviewIntervalDays = data.reviewIntervalDays !== undefined ? Math.max(0, Number(data.reviewIntervalDays)) : 365
    const autoArchiveOnExpire = Boolean(data.autoArchiveOnExpire)

    const payload = {
      pathPrefix,
      approvalLevels,
      reviewIntervalDays,
      autoArchiveOnExpire
    }

    if (data.id) {
      await DetranWfPolicy.query().findById(data.id).patch(payload)
      return DetranWfPolicy.query().findById(data.id)
    }

    // Check if a policy with the same prefix already exists
    const existing = await DetranWfPolicy.query().where('pathPrefix', pathPrefix).first()
    if (existing) {
      await existing.$query().patch(payload)
      return DetranWfPolicy.query().findById(existing.id)
    }

    return DetranWfPolicy.query().insert(payload)
  }

  /**
   * Delete a policy by ID
   *
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async deletePolicy(id) {
    const deletedCount = await DetranWfPolicy.query().deleteById(id)
    return deletedCount > 0
  }

  /**
   * Validates and normalizes the requested approval mode against the effective policy.
   * If the policy mandates 2 levels, 1 level is not permitted.
   *
   * @param {string} requestedMode - '1_level' or '2_levels'
   * @param {Object} policy - Effective policy
   * @returns {string} Normalized approval mode
   */
  normalizeApprovalMode(requestedMode, policy) {
    if (!this.isWorkflowEnabled()) {
      return '1_level'
    }

    if (policy && policy.approvalLevels === 2) {
      return '2_levels'
    }

    if (requestedMode === '2_levels') {
      return '2_levels'
    }

    return '1_level'
  }

  /**
   * Calculates the review due date from a given start date and policy interval.
   *
   * @param {Date|string} fromDate - Starting date (defaults to now)
   * @param {number} intervalDays - Interval in days (defaults to 365)
   * @returns {string} ISO 8601 timestamp string
   */
  calculateReviewDueDate(fromDate = new Date(), intervalDays = 365) {
    const base = fromDate instanceof Date ? fromDate : new Date(fromDate)
    const dueDate = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000)
    return dueDate.toISOString()
  }
}

module.exports = new PoliciesService()

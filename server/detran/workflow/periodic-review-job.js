const _ = require('lodash')
const DetranWfDraft = require('../../models/detranWfDraft')
const stateMachine = require('./state-machine')
const policiesService = require('./policies')
const eventsDispatcher = require('./events-dispatcher')

/**
 * Periodic Review Job Engine for Detran-MG Normativos.
 * Scans published documents whose validity cycle (default 12 months) has elapsed,
 * transitions them to 'revisao_periodica', generates pending revalidation tasks,
 * and provides quick revalidation functionality.
 */
class PeriodicReviewJob {
  constructor() {
    this.systemUser = {
      id: 1,
      name: 'Sistema de Revisão Periódica'
    }
    this.intervalTimer = null
    this.isScanning = false
  }

  /**
   * Find all published drafts whose reviewDueDate is on or before the reference date.
   *
   * @param {Date|string} [referenceDate=new Date()]
   * @returns {Promise<Array>}
   */
  async findExpiredDrafts(referenceDate = new Date()) {
    const refIso = (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)).toISOString()

    const drafts = await DetranWfDraft.query()
      .where('state', stateMachine.STATES.PUBLISHED)
      .whereNotNull('reviewDueDate')
      .where('reviewDueDate', '<=', refIso)
      .orderBy('reviewDueDate', 'asc')

    return drafts
  }

  /**
   * Find upcoming drafts expiring within a given window (e.g. 30 days).
   *
   * @param {Object} [options]
   * @param {number} [options.daysAhead=30]
   * @param {Date|string} [options.referenceDate=new Date()]
   * @returns {Promise<Array>}
   */
  async findUpcomingReviews({ daysAhead = 30, referenceDate = new Date() } = {}) {
    const refDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
    const startIso = refDate.toISOString()
    const endIso = new Date(refDate.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString()

    const drafts = await DetranWfDraft.query()
      .where('state', stateMachine.STATES.PUBLISHED)
      .whereNotNull('reviewDueDate')
      .where('reviewDueDate', '>', startIso)
      .where('reviewDueDate', '<=', endIso)
      .orderBy('reviewDueDate', 'asc')

    return drafts
  }

  /**
   * Run the review scan process.
   * Identifies expired normativos, moves them to revisao_periodica (or archived if policy dictates),
   * records audit log in detranWfEvents, and dispatches notifications.
   *
   * @param {Object} [options]
   * @param {Date|string} [options.referenceDate=new Date()]
   * @param {boolean} [options.dryRun=false]
   * @param {Object} [options.user=null]
   * @param {boolean} [options.force=false]
   * @returns {Promise<Object>} Execution summary
   */
  async runReviewScan(options = {}) {
    const startTime = Date.now()
    const {
      referenceDate = new Date(),
      dryRun = false,
      user = null,
      force = false
    } = options

    if (this.isScanning && !force) {
      return {
        status: 'skipped',
        reason: 'Scan already in progress',
        scannedCount: 0,
        expiredCount: 0,
        expiredDrafts: [],
        errors: []
      }
    }

    this.isScanning = true
    const actingUser = user || this.systemUser
    const expiredDrafts = []
    const errors = []

    try {
      const candidates = await this.findExpiredDrafts(referenceDate)

      if (dryRun) {
        return {
          status: 'dry_run',
          scannedCount: candidates.length,
          expiredCount: 0,
          candidateCount: candidates.length,
          candidates,
          errors: []
        }
      }

      for (const draft of candidates) {
        try {
          const policy = await policiesService.resolvePolicy(draft.path)
          const shouldArchive = Boolean(policy.autoArchiveOnExpire)
          const action = shouldArchive ? stateMachine.ACTIONS.ARCHIVE : stateMachine.ACTIONS.EXPIRE
          const comment = shouldArchive
            ? 'Vigência de 12 meses expirada. Documento arquivado automaticamente conforme política institucional.'
            : 'Vigência periódica de 12 meses expirada. Documento transferido para o estado de revisão periódica para revalidação.'

          const transitionResult = await stateMachine.executeTransition(
            draft,
            action,
            actingUser,
            { comment }
          )

          // Dispatch decoupled event for email / teams notifications
          eventsDispatcher.dispatch('wf:expired', {
            draft: transitionResult.draft,
            user: actingUser,
            comment,
            action
          })

          expiredDrafts.push(transitionResult.draft)
        } catch (err) {
          errors.push({
            draftId: draft.id,
            path: draft.path,
            error: err.message
          })
        }
      }

      return {
        status: 'completed',
        success: errors.length === 0,
        scannedCount: candidates.length,
        expiredCount: expiredDrafts.length,
        expiredDrafts,
        errors,
        referenceDate: (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)).toISOString(),
        durationMs: Date.now() - startTime
      }
    } finally {
      this.isScanning = false
    }
  }

  /**
   * Action: Quick revalidation of an expired or under review document for another cycle (+12 months).
   * Resets reviewDueDate to now + 365 days (or configured interval) and restores state to published.
   *
   * @param {number|string|Object} draftOrId - Draft instance or ID
   * @param {Object} user - Acting user (with review/approval privileges)
   * @param {Object} [options] - Optional params: comment, reviewIntervalDays
   * @returns {Promise<Object>}
   */
  async revalidate(draftOrId, user, options = {}) {
    let draft = draftOrId
    if (typeof draftOrId === 'number' || typeof draftOrId === 'string') {
      draft = await DetranWfDraft.query().findById(draftOrId)
      if (!draft) {
        throw new Error(`Draft #${draftOrId} not found`)
      }
    }

    if (!draft || !draft.id) {
      throw new Error('Invalid draft provided to revalidate')
    }

    const policy = await policiesService.resolvePolicy(draft.path)
    const intervalDays = options.reviewIntervalDays || options.intervalDays || policy.reviewIntervalDays || 365
    const comment = options.comment || 'Vigência do normativo revalidada por mais 12 meses sem alterações de conteúdo.'

    const result = await stateMachine.executeTransition(
      draft,
      stateMachine.ACTIONS.REVALIDATE,
      user || this.systemUser,
      {
        comment,
        reviewIntervalDays: intervalDays
      }
    )

    eventsDispatcher.dispatch('wf:revalidated', {
      draft: result.draft,
      user: user || this.systemUser,
      comment
    })

    return {
      success: true,
      draft: result.draft,
      newReviewDueDate: result.draft.reviewDueDate
    }
  }

  /**
   * Schedule recurring scan execution.
   *
   * @param {number} [intervalMs=86400000] - Interval in milliseconds (default 24h)
   * @returns {PeriodicReviewJob}
   */
  schedule(intervalMs = 24 * 60 * 60 * 1000) {
    this.stop()

    // 1. Integration with Wiki.js scheduler if available
    if (global.WIKI && global.WIKI.scheduler && typeof global.WIKI.scheduler.registerJob === 'function') {
      try {
        global.WIKI.scheduler.registerJob({
          name: 'detran-periodic-review',
          immediate: false,
          schedule: 'P1D',
          repeat: true
        })
      } catch {
        // Fallback to internal interval
      }
    }

    // 2. Standalone interval timer
    this.intervalTimer = setInterval(() => {
      this.runReviewScan().catch(err => {
        if (global.WIKI && global.WIKI.logger && typeof global.WIKI.logger.error === 'function') {
          global.WIKI.logger.error(`[PeriodicReviewJob] Scan execution failed: ${err.message}`)
        }
      })
    }, intervalMs)

    if (this.intervalTimer.unref) {
      this.intervalTimer.unref()
    }

    return this
  }

  /**
   * Stop scheduled execution
   */
  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }
  }
}

const instance = new PeriodicReviewJob()
instance.PeriodicReviewJob = PeriodicReviewJob

module.exports = instance

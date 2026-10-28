const {
  InvalidTransitionError,
  FourEyesViolationError
} = require('./errors')
const conflictDetector = require('./conflict-detector')
const policiesService = require('./policies')
const DetranWfEvent = require('../../models/detranWfEvent')

const STATES = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  AWAITING_APPROVAL: 'awaiting_approval',
  PUBLISHED: 'published',
  PERIODIC_REVIEW: 'revisao_periodica',
  ARCHIVED: 'archived'
}

const ACTIONS = {
  SAVE_DRAFT: 'save_draft',
  SUBMIT: 'submit',
  REQUEST_CHANGES: 'request_changes',
  APPROVE_STEP: 'approve_step',
  PUBLISH: 'publish',
  EXPIRE: 'expire',
  REVALIDATE: 'revalidate',
  ARCHIVE: 'archive'
}

/**
 * State Machine Engine for Detran-MG Document Workflow
 */
class WorkflowStateMachine {
  constructor() {
    this.STATES = STATES
    this.ACTIONS = ACTIONS
  }

  /**
   * Determine the target state and new level for a proposed transition.
   *
   * @param {Object} draft - Draft record
   * @param {string} action - Workflow action (from ACTIONS)
   * @returns {{ targetState: string, currentLevel: number }}
   * @throws {InvalidTransitionError}
   */
  resolveTargetState(draft, action) {
    const currentState = draft.state || STATES.DRAFT
    const mode = draft.approvalMode || '1_level'

    switch (action) {
      case ACTIONS.SAVE_DRAFT:
        if (currentState !== STATES.DRAFT && currentState !== STATES.CHANGES_REQUESTED) {
          throw new InvalidTransitionError(currentState, action, 'Can only save edits while in draft or changes requested')
        }
        return { targetState: currentState, currentLevel: draft.currentLevel || 1 }

      case ACTIONS.SUBMIT:
        if (currentState !== STATES.DRAFT && currentState !== STATES.CHANGES_REQUESTED) {
          throw new InvalidTransitionError(currentState, action, 'Can only submit from draft or changes requested')
        }
        return { targetState: STATES.IN_REVIEW, currentLevel: 1 }

      case ACTIONS.REQUEST_CHANGES:
        if (currentState !== STATES.IN_REVIEW && currentState !== STATES.AWAITING_APPROVAL) {
          throw new InvalidTransitionError(currentState, action, 'Changes can only be requested while under review or approval')
        }
        return { targetState: STATES.CHANGES_REQUESTED, currentLevel: draft.currentLevel || 1 }

      case ACTIONS.APPROVE_STEP:
        if (currentState !== STATES.IN_REVIEW) {
          throw new InvalidTransitionError(currentState, action, 'Can only approve step from in_review')
        }
        if (mode !== '2_levels') {
          throw new InvalidTransitionError(currentState, action, 'Step approval only applies to 2-level workflows. Use publish for 1-level workflows.')
        }
        return { targetState: STATES.AWAITING_APPROVAL, currentLevel: 2 }

      case ACTIONS.PUBLISH:
        if (mode === '1_level') {
          if (currentState !== STATES.IN_REVIEW) {
            throw new InvalidTransitionError(currentState, action, '1-level workflow must be in_review to publish')
          }
        } else if (mode === '2_levels') {
          if (currentState !== STATES.AWAITING_APPROVAL) {
            throw new InvalidTransitionError(currentState, action, '2-level workflow must reach awaiting_approval before publishing')
          }
        } else {
          throw new InvalidTransitionError(currentState, action, `Unknown approval mode: ${mode}`)
        }
        return { targetState: STATES.PUBLISHED, currentLevel: mode === '2_levels' ? 2 : 1 }

      case ACTIONS.EXPIRE:
        if (currentState !== STATES.PUBLISHED) {
          throw new InvalidTransitionError(currentState, action, 'Only published documents can expire')
        }
        return { targetState: STATES.PERIODIC_REVIEW, currentLevel: draft.currentLevel || 1 }

      case ACTIONS.REVALIDATE:
        if (currentState !== STATES.PERIODIC_REVIEW && currentState !== 'periodic_review') {
          throw new InvalidTransitionError(currentState, action, 'Only documents under periodic review can be revalidated')
        }
        return { targetState: STATES.PUBLISHED, currentLevel: draft.currentLevel || 1 }

      case ACTIONS.ARCHIVE:
        if (currentState !== STATES.PUBLISHED && currentState !== STATES.PERIODIC_REVIEW && currentState !== 'periodic_review') {
          throw new InvalidTransitionError(currentState, action, 'Only published or expired documents can be archived')
        }
        return { targetState: STATES.ARCHIVED, currentLevel: draft.currentLevel || 1 }

      default:
        throw new InvalidTransitionError(currentState, action, `Unknown action "${action}"`)
    }
  }

  /**
   * Validate security and business rules for the proposed transition.
   *
   * @param {Object} draft - Draft record
   * @param {string} action - Workflow action
   * @param {Object} user - Authenticated user executing the action
   * @param {Object} [options] - Additional options (e.g. livePage)
   * @throws {FourEyesViolationError|ConcurrencyConflictError}
   */
  validateBusinessRules(draft, action, user, options = {}) {
    const isApprovalAction = action === ACTIONS.APPROVE_STEP || action === ACTIONS.PUBLISH

    // Rule: Four-Eyes Principle (Princípio dos 4 Olhos)
    // The author cannot approve or publish their own document
    if (isApprovalAction && user && user.id && draft.authorId) {
      if (Number(user.id) === Number(draft.authorId)) {
        throw new FourEyesViolationError()
      }
    }

    // Rule: Concurrency Conflict Detection on Publication
    if (action === ACTIONS.PUBLISH) {
      const livePage = options.livePage || null
      conflictDetector.assertNoConflict(draft, livePage)
    }
  }

  /**
   * Check if an action is valid without throwing errors.
   *
   * @param {Object} draft
   * @param {string} action
   * @param {Object} user
   * @param {Object} [options]
   * @returns {{ allowed: boolean, reason?: string }}
   */
  canTransition(draft, action, user, options = {}) {
    try {
      this.resolveTargetState(draft, action)
      this.validateBusinessRules(draft, action, user, options)
      return { allowed: true }
    } catch (err) {
      return { allowed: false, reason: err.message, code: err.code }
    }
  }

  /**
   * Execute a workflow transition, updating draft state and recording an audit event.
   *
   * @param {Object} draft - DetranWfDraft instance
   * @param {string} action - Workflow action
   * @param {Object} user - Acting user { id, name, ... }
   * @param {Object} [options] - Options: comment, livePage, reviewIntervalDays
   * @returns {Promise<{ draft: Object, event: Object|null, previousState: string, nextState: string }>}
   */
  async executeTransition(draft, action, user, options = {}) {
    // 1. Resolve and validate
    const fromState = draft.state || STATES.DRAFT
    const { targetState, currentLevel } = this.resolveTargetState(draft, action)
    this.validateBusinessRules(draft, action, user, options)

    // 2. Prepare patch payload
    const patchData = {
      state: targetState,
      currentLevel
    }

    // When publishing or revalidating, calculate new review due date
    if (targetState === STATES.PUBLISHED) {
      const intervalDays = options.reviewIntervalDays || 365
      patchData.reviewDueDate = policiesService.calculateReviewDueDate(new Date(), intervalDays)
    }

    // 3. Update database if draft is an Objection Model instance
    let updatedDraft = draft
    if (draft.$query && typeof draft.$query === 'function') {
      await draft.$query().patch(patchData)
      updatedDraft = await draft.$query()
    } else {
      Object.assign(draft, patchData)
    }

    // 4. Record audit event in detranWfEvents
    let event = null
    const shouldRecordEvent = action !== ACTIONS.SAVE_DRAFT // save_draft is autosave/edit; all other actions are state transitions
    if (shouldRecordEvent && user && user.id && draft.id) {
      try {
        event = await DetranWfEvent.query().insert({
          draftId: draft.id,
          action,
          fromState,
          toState: targetState,
          userId: user.id,
          comment: options.comment || null
        })
      } catch {
        // Fallback for non-persistent tests
      }
    }

    return {
      draft: updatedDraft,
      event,
      previousState: fromState,
      nextState: targetState
    }
  }
}

module.exports = new WorkflowStateMachine()

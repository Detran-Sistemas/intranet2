/**
 * Custom Errors for Detran-MG Workflow Engine
 */

class WorkflowError extends Error {
  constructor(message, code = 'WORKFLOW_ERROR') {
    super(message)
    this.name = 'WorkflowError'
    this.code = code
  }
}

class InvalidTransitionError extends WorkflowError {
  constructor(fromState, action, reason = '') {
    const detail = reason ? ` (${reason})` : ''
    super(`Cannot perform action "${action}" on draft in state "${fromState}"${detail}`, 'INVALID_TRANSITION')
    this.name = 'InvalidTransitionError'
    this.fromState = fromState
    this.action = action
  }
}

class FourEyesViolationError extends WorkflowError {
  constructor(message = 'The author cannot approve or publish their own document (Four-Eyes Principle)') {
    super(message, 'FOUR_EYES_VIOLATION')
    this.name = 'FourEyesViolationError'
  }
}

class ConcurrencyConflictError extends WorkflowError {
  constructor(message = 'Document was modified concurrently by another user', details = {}) {
    super(message, 'CONCURRENCY_CONFLICT')
    this.name = 'ConcurrencyConflictError'
    this.details = details
  }
}

class PermissionDeniedError extends WorkflowError {
  constructor(message = 'User does not have permission to execute this workflow action') {
    super(message, 'PERMISSION_DENIED')
    this.name = 'PermissionDeniedError'
  }
}

module.exports = {
  WorkflowError,
  InvalidTransitionError,
  FourEyesViolationError,
  ConcurrencyConflictError,
  PermissionDeniedError
}

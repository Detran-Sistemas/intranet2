const Diff = require('diff')
const Diff2Html = require('diff2html')
const _ = require('lodash')

/**
 * Detran Workflow Review Logic Helper
 * Pure JS helper to manage diff calculation, comment indexing, and reviewer action state.
 */

/**
 * Generate a unified diff patch between original live content and proposed draft content.
 *
 * @param {object} params
 * @param {string} params.path - Document path
 * @param {string} [params.originalContent=''] - Live published content
 * @param {string} [params.draftContent=''] - Draft content in review
 * @returns {string} Unified diff patch
 */
function generateDiffPatch({ path = 'document', originalContent = '', draftContent = '' }) {
  const safePath = path.startsWith('/') ? path : `/${path}`
  const orig = originalContent || ''
  const draft = draftContent || ''
  return Diff.createPatch(safePath, orig, draft, 'Versão Publicada', 'Rascunho Proposto')
}

/**
 * Render diff string to HTML using diff2html
 *
 * @param {object} params
 * @param {string} params.patch - Unified diff patch
 * @param {('line-by-line'|'side-by-side')} [params.viewMode='side-by-side']
 * @returns {string} Rendered HTML string
 */
function renderDiffHtml({ patch, viewMode = 'side-by-side' }) {
  if (!patch) return ''
  return Diff2Html.html(patch, {
    inputFormat: 'diff',
    drawFileList: false,
    matching: 'lines',
    outputFormat: viewMode === 'line-by-line' ? 'line-by-line' : 'side-by-side'
  })
}

/**
 * Group comments by line number and calculate summary counts
 *
 * @param {Array<object>} comments
 * @returns {{ byLine: object, general: Array<object>, unresolvedCount: number, totalCount: number }}
 */
function groupCommentsByLine(comments = []) {
  const safeComments = Array.isArray(comments) ? comments : []
  const byLine = {}
  const general = []
  let unresolvedCount = 0

  for (const c of safeComments) {
    if (!c.resolved) {
      unresolvedCount++
    }
    const line = _.toSafeInteger(c.lineNumber)
    if (line > 0) {
      if (!byLine[line]) {
        byLine[line] = []
      }
      byLine[line].push(c)
    } else {
      general.push(c)
    }
  }

  return {
    byLine,
    general,
    unresolvedCount,
    totalCount: safeComments.length
  }
}

/**
 * Determine which reviewer/approver actions are available for a given draft state and approval mode.
 *
 * @param {object} params
 * @param {string} params.state - 'draft', 'in_review', 'in_approval_step2', 'changes_requested', 'published', 'rejected'
 * @param {string} params.approvalMode - '1_level' or '2_levels'
 * @param {object} [params.permissions={}] - User effective permissions
 * @returns {object} Action flags
 */
function getAvailableReviewActions(draftOrOptions = {}, permissionsArg = null) {
  const state = draftOrOptions?.state
  const approvalMode = draftOrOptions?.approvalMode || '1_level'
  const permissions = permissionsArg || draftOrOptions?.permissions || {}
  const canReview = Boolean(permissions['review:pages'] || permissions['manage:pages'] || permissions['manage:system'])
  const canApprove = Boolean(permissions['approve:pages'] || permissions['manage:pages'] || permissions['manage:system'])

  const actions = {
    canRequestChanges: false,
    canApproveStep: false,
    canPublish: false,
    canRevalidate: false,
    labelApproveStep: 'Aprovar Nível 1 (Técnico)',
    labelPublish: 'Homologar e Publicar',
    labelRevalidate: 'Revalidar Vigência (+12m)',
    statusDescription: ''
  }

  if (state === 'in_review') {
    actions.canRequestChanges = canReview || canApprove
    if (approvalMode === '2_levels') {
      actions.canApproveStep = canReview || canApprove
      actions.statusDescription = 'Aguardando Revisão Técnica (Nível 1 de 2)'
    } else {
      actions.canPublish = canApprove
      actions.statusDescription = 'Aguardando Homologação Direta (Nível Único)'
    }
  } else if (state === 'awaiting_approval' || state === 'in_approval_step2') {
    actions.canRequestChanges = canApprove
    actions.canPublish = canApprove
    actions.statusDescription = 'Aguardando Homologação Final (Nível 2 de 2)'
  } else if (state === 'revisao_periodica' || state === 'periodic_review') {
    actions.canRevalidate = canApprove
    actions.canRequestChanges = canReview || canApprove
    actions.statusDescription = 'Vigência de 12 meses expirada. Aguardando revalidação periódica ou revisão.'
  } else if (state === 'changes_requested') {
    actions.statusDescription = 'Ajustes solicitados ao autor. Aguardando reedição e nova submissão.'
  } else if (state === 'published') {
    actions.statusDescription = 'Documento homologado e publicado oficialmente na intranet.'
  } else if (state === 'draft') {
    actions.statusDescription = 'Rascunho ainda em elaboração pelo autor.'
  }

  return actions
}

/**
 * Extract target line number from a clicked diff element.
 *
 * @param {HTMLElement|object} el - Clicked element or mock object with className/innerText/attributes
 * @returns {number|null} Line number or null
 */
function extractLineFromDiffElement(el) {
  if (!el) return null

  // If clicked directly on linenumber or parent line row
  let current = el
  for (let i = 0; i < 5 && current; i++) {
    const className = current.className || ''
    const text = (current.innerText || current.textContent || '').trim()

    if (typeof className === 'string' && className.includes('d2h-code-linenumber')) {
      const parsed = parseInt(text, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }

    if (current.dataset && current.dataset.lineNumber) {
      const parsed = parseInt(current.dataset.lineNumber, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }

    current = current.parentElement
  }

  return null
}

module.exports = {
  generateDiffPatch,
  renderDiffHtml,
  groupCommentsByLine,
  getAvailableReviewActions,
  extractLineFromDiffElement
}

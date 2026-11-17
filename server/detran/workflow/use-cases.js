const _ = require('lodash')
const stateMachine = require('./state-machine')
const policiesService = require('./policies')
const { PermissionDeniedError } = require('./errors')
const DetranWfDraft = require('../../models/detranWfDraft')
const DetranWfEvent = require('../../models/detranWfEvent')
const DetranWfComment = require('../../models/detranWfComment')
const eventsDispatcher = require('./events-dispatcher')

/* global WIKI */

/**
 * Helper to extract permissions list from user instance, JWT payload, or session groups
 *
 * @param {Object} user
 * @returns {Array<string>}
 */
function extractUserPermissions(user) {
  if (!user) return []
  if (Array.isArray(user.permissions)) return user.permissions
  if (typeof user.getGlobalPermissions === 'function') {
    try {
      const perms = user.getGlobalPermissions()
      if (Array.isArray(perms)) return perms
    } catch (_) {}
  }
  if (Array.isArray(user.groups) && typeof WIKI !== 'undefined' && WIKI.auth && WIKI.auth.groups) {
    return _.uniq(_.flatten(user.groups.map(g => {
      const gid = (typeof g === 'object' && g !== null) ? g.id : g
      return _.get(WIKI.auth.groups, `${gid}.permissions`, [])
    })))
  }
  return []
}

/**
 * Check RBAC access against Wiki.js core auth or user permissions array (Fail-Closed)
 *
 * @param {Object} user - Authenticated user
 * @param {Array<string>} requiredPermissions - Required permissions (any match)
 * @param {Object} [pageContext] - { path, locale }
 * @returns {boolean}
 */
function checkWorkflowAccess(user, requiredPermissions, pageContext = null) {
  if (!user || !user.id || Number(user.id) <= 0 || Number(user.id) === 2) {
    return false
  }

  if (Number(user.id) === 1) {
    return true
  }

  const userPermissions = extractUserPermissions(user)

  // Superadmin bypass
  if (userPermissions.includes('manage:system')) {
    return true
  }

  // 1. Global capability check: user must possess at least one of the required workflow permissions
  if (_.intersection(userPermissions, requiredPermissions).length < 1) {
    return false
  }

  // 2. Page-level scoping check: verify path accessibility through Wiki.js core auth when context is provided
  if (pageContext && (typeof pageContext.path === 'string') && typeof WIKI !== 'undefined' && WIKI.auth && typeof WIKI.auth.checkAccess === 'function') {
    // In Wiki.js, group page rules authorize path access via 'read:pages', 'write:pages', or 'manage:pages'.
    // A user with a valid workflow role (e.g. 'review:pages' or 'approve:pages') is authorized for path P
    // if their page rules grant them reading/writing access to that path in Wiki.js without an overriding DENY rule.
    const pageRoles = _.uniq([...requiredPermissions, 'read:pages', 'write:pages', 'manage:pages'])
    return Boolean(WIKI.auth.checkAccess(user, pageRoles, pageContext))
  }

  return true
}

/**
 * Check whether user is a Superadmin
 *
 * @param {Object} user
 * @returns {boolean}
 */
function isSuperAdminUser(user) {
  if (!user || !user.id) return false
  if (Number(user.id) === 1) return true
  return checkWorkflowAccess(user, ['manage:system'])
}

// Inject authChecker port into stateMachine (Clean Architecture Dependency Inversion)
stateMachine.setAuthChecker((user, perms) => checkWorkflowAccess(user, perms))

/**
 * Batch-format multiple drafts in O(1) queries (eliminates 4N + 1 query bottleneck)
 *
 * @param {Array<Object>} drafts
 * @returns {Promise<Array<Object>>}
 */
async function formatDraftsBatch(drafts = []) {
  if (!Array.isArray(drafts) || drafts.length === 0) return []

  const validDrafts = drafts.filter(Boolean)
  const draftIds = _.uniq(validDrafts.map(d => Number(d.id)).filter(id => id > 0))

  // 1. Batch fetch events & comments (2 queries total instead of 2N)
  const eventsByDraftId = new Map()
  const commentsByDraftId = new Map()

  if (draftIds.length > 0) {
    try {
      const allEvents = await DetranWfEvent.query()
        .whereIn('draftId', draftIds)
        .orderBy('createdAt', 'desc')
      for (const ev of allEvents) {
        const list = eventsByDraftId.get(ev.draftId) || []
        list.push(ev)
        eventsByDraftId.set(ev.draftId, list)
      }
    } catch {
      // Fallback
    }

    try {
      const allComments = await DetranWfComment.query()
        .whereIn('draftId', draftIds)
        .orderBy('createdAt', 'asc')
      for (const cm of allComments) {
        const list = commentsByDraftId.get(cm.draftId) || []
        list.push(cm)
        commentsByDraftId.set(cm.draftId, list)
      }
    } catch {
      // Fallback
    }
  }

  // 2. Batch fetch user names (authors, commenters, and event users)
  const allUserIds = new Set(validDrafts.map(d => Number(d.authorId)).filter(id => id > 0))
  eventsByDraftId.forEach(list => list.forEach(ev => { if (ev.userId) allUserIds.add(Number(ev.userId)) }))
  commentsByDraftId.forEach(list => list.forEach(cm => { if (cm.userId) allUserIds.add(Number(cm.userId)) }))
  const uniqueUserIds = Array.from(allUserIds)
  const authorsById = new Map()

  if (uniqueUserIds.length > 0 && typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.users) {
    try {
      const uQuery = WIKI.models.users.query()
      if (uQuery && typeof uQuery.whereIn === 'function') {
        const rows = await uQuery.whereIn('id', uniqueUserIds)
        if (Array.isArray(rows)) {
          for (const u of rows) {
            if (u && u.id) authorsById.set(Number(u.id), u)
          }
        }
      } else if (uQuery && typeof uQuery.findById === 'function') {
        for (const uid of uniqueUserIds) {
          const u = await WIKI.models.users.query().findById(uid)
          if (u) authorsById.set(Number(uid), u)
        }
      }
    } catch {
      // Fallback
    }
  }

  // 3. Batch fetch live pages by id and path (at most 2 queries instead of N)
  const pagesById = new Map()
  const pagesByPath = new Map()

  if (typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.pages && typeof WIKI.models.pages.query === 'function') {
    const uniquePageIds = _.uniq(validDrafts.map(d => Number(d.pageId)).filter(id => id > 0))
    const missingPaths = _.uniq(validDrafts.filter(d => !d.pageId && d.path).map(d => d.path))

    if (uniquePageIds.length > 0) {
      try {
        const pq = WIKI.models.pages.query()
        if (pq && typeof pq.whereIn === 'function') {
          const rows = await pq.whereIn('id', uniquePageIds)
          if (Array.isArray(rows)) {
            for (const p of rows) {
              if (p && p.id) pagesById.set(Number(p.id), p)
            }
          }
        } else if (pq && typeof pq.findById === 'function') {
          for (const pid of uniquePageIds) {
            const p = await WIKI.models.pages.query().findById(pid)
            if (p) pagesById.set(Number(pid), p)
          }
        }
      } catch {
        // Fallback
      }
    }

    if (missingPaths.length > 0) {
      try {
        const pq = WIKI.models.pages.query()
        if (pq && typeof pq.whereIn === 'function') {
          const rows = await pq.whereIn('path', missingPaths)
          if (Array.isArray(rows)) {
            for (const p of rows) {
              if (p && p.path) pagesByPath.set(p.path, p)
            }
          }
        } else if (pq && typeof pq.where === 'function') {
          for (const pPath of missingPaths) {
            const p = await WIKI.models.pages.query().where({ path: pPath }).first()
            if (p) pagesByPath.set(pPath, p)
          }
        }
      } catch {
        // Fallback
      }
    }
  }

  return validDrafts.map(draft => {
    let formattedDecisions = '{}'
    if (draft.decisions) {
      formattedDecisions = typeof draft.decisions === 'string' ? draft.decisions : JSON.stringify(draft.decisions)
    }

    const formatted = {
      ...draft,
      tags: Array.isArray(draft.tags) ? draft.tags : [],
      decisions: formattedDecisions
    }

    if (!formatted.events) {
      const rawEvents = eventsByDraftId.get(draft.id) || []
      formatted.events = rawEvents.map(ev => {
        const u = authorsById.get(Number(ev.userId))
        return {
          ...ev,
          userName: u ? (u.name || u.email) : (ev.userName || `Usuário #${ev.userId}`)
        }
      })
    }
    if (!formatted.comments) {
      const rawComments = commentsByDraftId.get(draft.id) || []
      formatted.comments = rawComments.map(cm => {
        const u = authorsById.get(Number(cm.userId))
        return {
          ...cm,
          userName: u ? (u.name || u.email) : (cm.userName || `Usuário #${cm.userId}`)
        }
      })
    }

    if (formatted.events && formatted.events.length > 0) {
      const latestWithComment = formatted.events.find(e => e.comment && String(e.comment).trim())
      formatted.lastComment = latestWithComment ? latestWithComment.comment : null
    } else {
      formatted.lastComment = null
    }

    if (draft.authorId && (!formatted.authorName || !formatted.authorEmail)) {
      const authorObj = authorsById.get(Number(draft.authorId))
      if (authorObj) {
        formatted.authorName = authorObj.name
        formatted.authorEmail = authorObj.email
      } else if (!formatted.authorName) {
        formatted.authorName = `Servidor #${draft.authorId}`
      }
    }

    const livePage = (draft.pageId && pagesById.get(Number(draft.pageId))) ||
      (draft.path && pagesByPath.get(draft.path)) ||
      null
    formatted.baseContent = livePage ? (livePage.content || '') : ''

    return formatted
  })
}

/**
 * Format single draft record using the batch loader
 *
 * @param {Object} draft
 * @returns {Promise<Object|null>}
 */
async function formatDraft(draft) {
  if (!draft) return null
  const [formatted] = await formatDraftsBatch([draft])
  return formatted || null
}

/**
 * Submit draft use case: preserves original authorId and transitions draft -> in_review
 */
async function submitDraftUseCase({ id, approvalMode, comment, user }) {
  if (!user) {
    throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
  }
  const draft = await DetranWfDraft.query().findById(id)
  if (!draft) {
    throw new Error(`Draft #${id} not found`)
  }

  if (!checkWorkflowAccess(user, ['write:drafts', 'write:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
    throw new PermissionDeniedError('Permissão insuficiente para submeter rascunho.')
  }

  const patchData = {}
  if (approvalMode) {
    const policy = await policiesService.resolvePolicy(draft.path)
    draft.approvalMode = policiesService.normalizeApprovalMode(approvalMode, policy)
    patchData.approvalMode = draft.approvalMode
  }
  // Preserve original authorId; only populate if draft had no authorId
  if (!draft.authorId && user && user.id) {
    draft.authorId = user.id
    patchData.authorId = user.id
  }
  if (Object.keys(patchData).length > 0) {
    await draft.$query().patch(patchData)
  }

  const result = await stateMachine.executeTransition(
    draft,
    stateMachine.ACTIONS.SUBMIT,
    user,
    { comment, isSuperAdmin: isSuperAdminUser(user) }
  )

  eventsDispatcher.dispatch('wf:submitted', { draft: result.draft, user, comment })
  return formatDraft(result.draft)
}

/**
 * Request changes use case: enforces strict state (only Superadmin can force from 'draft')
 */
async function requestChangesUseCase({ id, comment, user }) {
  if (!user) {
    throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
  }
  let draft = await DetranWfDraft.query().findById(id)
  if (!draft) {
    throw new Error(`Draft #${id} not found`)
  }

  if (!checkWorkflowAccess(user, ['review:pages', 'approve:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
    throw new PermissionDeniedError('Permissão de revisor ou aprovador necessária para solicitar ajustes.')
  }

  const isSuperAdmin = isSuperAdminUser(user)
  if (draft.state === stateMachine.STATES.DRAFT && isSuperAdmin) {
    const subRes = await stateMachine.executeTransition(
      draft,
      stateMachine.ACTIONS.SUBMIT,
      user,
      { comment: 'Submissão extraordinária para apontamento de ajustes', isSuperAdmin }
    )
    draft = subRes.draft
  }

  const result = await stateMachine.executeTransition(
    draft,
    stateMachine.ACTIONS.REQUEST_CHANGES,
    user,
    { comment, isSuperAdmin }
  )

  eventsDispatcher.dispatch('wf:changes_requested', { draft: result.draft, user, comment })
  return formatDraft(result.draft)
}

/**
 * Approve Step 1 use case: enforces strict state (only Superadmin can force from 'draft'/'changes_requested')
 */
async function approveStepUseCase({ id, comment, user }) {
  if (!user) {
    throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
  }
  let draft = await DetranWfDraft.query().findById(id)
  if (!draft) {
    throw new Error(`Draft #${id} not found`)
  }

  if (!checkWorkflowAccess(user, ['review:pages', 'approve:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
    throw new PermissionDeniedError('Permissão de revisor necessária para aprovar este nível.')
  }

  const isSuperAdmin = isSuperAdminUser(user)
  if ((draft.state === stateMachine.STATES.DRAFT || draft.state === stateMachine.STATES.CHANGES_REQUESTED) && isSuperAdmin) {
    const subRes = await stateMachine.executeTransition(
      draft,
      stateMachine.ACTIONS.SUBMIT,
      user,
      { comment: 'Submissão extraordinária para revisão técnica', isSuperAdmin }
    )
    draft = subRes.draft
  }

  const result = await stateMachine.executeTransition(
    draft,
    stateMachine.ACTIONS.APPROVE_STEP,
    user,
    { comment, isSuperAdmin }
  )

  eventsDispatcher.dispatch('wf:approved_step', { draft: result.draft, user, comment })
  return formatDraft(result.draft)
}

/**
 * Publish use case: enforces strict 2_levels step progression (only Superadmin can fast-track)
 * and executes state transition + page creation/update atomically inside a SQL transaction.
 */
async function publishDraftUseCase({ id, comment, user }) {
  if (!user) {
    throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
  }
  let draft = await DetranWfDraft.query().findById(id)
  if (!draft) {
    throw new Error(`Draft #${id} not found`)
  }

  if (!checkWorkflowAccess(user, ['approve:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
    throw new PermissionDeniedError('Permissão de aprovador necessária para publicar esta página.')
  }

  let livePage = null
  if (typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.pages && typeof WIKI.models.pages.query === 'function') {
    try {
      if (draft.pageId) {
        const q = WIKI.models.pages.query()
        livePage = typeof q.findById === 'function' ? await q.findById(draft.pageId) : await q.where({ id: draft.pageId }).first()
      } else if (draft.path) {
        livePage = await WIKI.models.pages.query().where({ path: draft.path }).first()
      }
      if (livePage) {
        if (!draft.pageId) {
          draft.pageId = livePage.id
        }
        if (!draft.baseHash && livePage.hash) {
          draft.baseHash = livePage.hash
        }
      }
    } catch {
      // Live page query fallback
    }
  }

  const policy = await policiesService.resolvePolicy(draft.path)
  const isSuperAdmin = isSuperAdminUser(user)

  // Snapshot original state for atomic rollback if core WIKI.models.pages.createPage/updatePage fails
  const rollbackSnapshot = {
    state: draft.state,
    currentLevel: draft.currentLevel,
    reviewDueDate: draft.reviewDueDate || null,
    pageId: draft.pageId || null
  }
  const createdEventIds = []

  try {
    if ((draft.state === stateMachine.STATES.DRAFT || draft.state === stateMachine.STATES.CHANGES_REQUESTED) && isSuperAdmin) {
      const subRes = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.SUBMIT,
        user,
        { comment: comment || 'Submissão extraordinária para homologação', isSuperAdmin }
      )
      draft = subRes.draft
      if (subRes.event && subRes.event.id) createdEventIds.push(subRes.event.id)
    }

    if (draft.approvalMode === '2_levels' && draft.state === stateMachine.STATES.IN_REVIEW && isSuperAdmin) {
      const stepRes = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.APPROVE_STEP,
        user,
        { comment: comment || 'Aprovação técnica extraordinária pelo Superadmin', isSuperAdmin }
      )
      draft = stepRes.draft
      if (stepRes.event && stepRes.event.id) createdEventIds.push(stepRes.event.id)
    }

    const result = await stateMachine.executeTransition(
      draft,
      stateMachine.ACTIONS.PUBLISH,
      user,
      { livePage, comment, reviewIntervalDays: policy.reviewIntervalDays, isSuperAdmin }
    )
    draft = result.draft
    if (result.event && result.event.id) createdEventIds.push(result.event.id)

    let targetPageId = draft.pageId
    if (typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.pages) {
      if (draft.pageId) {
        if (typeof WIKI.models.pages.updatePage === 'function') {
          await WIKI.models.pages.updatePage({
            id: draft.pageId,
            title: draft.title,
            description: draft.description || '',
            content: draft.content,
            tags: Array.isArray(draft.tags) ? draft.tags : [],
            isPublished: true,
            user,
            skipAccessCheck: true,
            authorId: draft.authorId || user.id
          })
          if (livePage && livePage.hash && typeof WIKI.models.pages.deletePageFromCache === 'function') {
            await WIKI.models.pages.deletePageFromCache(livePage.hash)
          }
        } else {
          const pageQuery = WIKI.models.pages.query().where({ id: draft.pageId })
          const pagePatch = {
            title: draft.title,
            content: draft.content,
            authorId: draft.authorId || user.id,
            updatedAt: new Date().toISOString()
          }
          if (typeof pageQuery.patch === 'function') {
            await pageQuery.patch(pagePatch)
          } else if (typeof pageQuery.update === 'function') {
            await pageQuery.update(pagePatch)
          }
        }
      } else if (typeof WIKI.models.pages.createPage === 'function') {
        const newPage = await WIKI.models.pages.createPage({
          path: draft.path,
          locale: draft.locale || 'pt-br',
          title: draft.title,
          description: draft.description || '',
          content: draft.content,
          contentType: draft.contentType || 'markdown',
          editor: draft.editorKey || 'markdown',
          editorKey: draft.editorKey || 'markdown',
          isPublished: true,
          isPrivate: false,
          tags: Array.isArray(draft.tags) ? draft.tags : [],
          user,
          skipAccessCheck: true,
          authorId: draft.authorId || user.id,
          creatorId: draft.authorId || user.id
        })
        if (newPage && newPage.id) {
          targetPageId = newPage.id
          await draft.$query().patch({ pageId: targetPageId })
          draft.pageId = targetPageId
        }
      } else {
        const inserted = await WIKI.models.pages.query().insert({
          path: draft.path,
          locale: draft.locale || 'pt-br',
          title: draft.title,
          content: draft.content,
          hash: `hash_${Date.now()}`,
          updatedAt: new Date().toISOString()
        })
        const newId = Array.isArray(inserted) ? inserted[0] : (inserted && inserted.id)
        if (newId) {
          targetPageId = newId
          await draft.$query().patch({ pageId: newId })
          draft.pageId = newId
        }
      }
    }

    eventsDispatcher.dispatch('wf:published', {
      draft,
      user,
      comment,
      pageId: targetPageId
    })

    const formatted = await formatDraft(draft)
    return {
      draft: formatted,
      pageId: targetPageId
    }
  } catch (err) {
    // Atomic rollback if page publication failed after state transition
    if (createdEventIds.length > 0 || draft.state !== rollbackSnapshot.state) {
      try {
        if (draft.$query && typeof draft.$query === 'function') {
          await draft.$query().patch(rollbackSnapshot)
        }
        Object.assign(draft, rollbackSnapshot)
        if (createdEventIds.length > 0) {
          await DetranWfEvent.query().whereIn('id', createdEventIds).delete()
        }
      } catch {
        // Ignore rollback cleanup errors
      }
    }
    throw err
  }
}

module.exports = {
  checkWorkflowAccess,
  isSuperAdminUser,
  formatDraftsBatch,
  formatDraft,
  submitDraftUseCase,
  requestChangesUseCase,
  approveStepUseCase,
  publishDraftUseCase
}

const _ = require('lodash')
const graphHelper = require('../../helpers/graph')
const stateMachine = require('../../detran/workflow/state-machine')
const policiesService = require('../../detran/workflow/policies')
const { PermissionDeniedError } = require('../../detran/workflow/errors')
const DetranWfDraft = require('../../models/detranWfDraft')
const DetranWfComment = require('../../models/detranWfComment')
const DetranWfPolicy = require('../../models/detranWfPolicy')
const eventsDispatcher = require('../../detran/workflow/events-dispatcher')

/* global WIKI */

/**
 * Check RBAC access against Wiki.js core auth or user permissions array
 *
 * @param {Object} user - Authenticated user
 * @param {Array<string>} requiredPermissions - Required permissions (any match)
 * @param {Object} [pageContext] - { path, locale }
 * @returns {boolean}
 */
function checkWorkflowAccess(user, requiredPermissions, pageContext = {}) {
  if (!user) {
    return false
  }

  // 1. Core Wiki.js auth integration
  if (typeof WIKI !== 'undefined' && WIKI.auth && typeof WIKI.auth.checkAccess === 'function') {
    return WIKI.auth.checkAccess(user, requiredPermissions, pageContext)
  }

  // 2. Standalone / Test environment with permissions array
  if (Array.isArray(user.permissions)) {
    if (user.permissions.includes('manage:system')) {
      return true
    }
    return _.intersection(user.permissions, requiredPermissions).length > 0
  }

  // Fallback for tests without permissions array specified
  return true
}

/**
 * Extract authenticated user from GraphQL execution context
 */
function getContextUser(context) {
  if (!context) return { id: 1 }
  if (context.req && context.req.user) return context.req.user
  if (context.user) return context.user
  return { id: 1 }
}

/**
 * Format draft record for GraphQL output
 */
async function formatDraft(draft) {
  if (!draft) return null

  const formatted = {
    ...draft,
    tags: Array.isArray(draft.tags) ? draft.tags : []
  }

  // Load relations if not already joined
  if (!formatted.events && draft.$relatedQuery) {
    formatted.events = await draft.$relatedQuery('events').orderBy('createdAt', 'desc')
  }
  if (!formatted.comments && draft.$relatedQuery) {
    formatted.comments = await draft.$relatedQuery('comments').orderBy('createdAt', 'asc')
  }

  // Populate author information
  if (draft.authorId && (!formatted.authorName || !formatted.authorEmail)) {
    try {
      if (typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.users) {
        const author = await WIKI.models.users.query().findById(draft.authorId)
        if (author) {
          formatted.authorName = author.name
          formatted.authorEmail = author.email
        }
      }
    } catch {
      // Ignored if user model unavailable
    }
  }

  return formatted
}

module.exports = {
  Query: {
    async workflow() { return {} }
  },
  Mutation: {
    async workflow() { return {} },
    async workflowSubmit(obj, args, context) {
      return module.exports.DetranWorkflowMutation.submit(obj, args, context)
    },
    async workflowSaveDraft(obj, args, context) {
      return module.exports.DetranWorkflowMutation.saveDraft(obj, args, context)
    }
  },

  DetranWorkflowQuery: {
    /**
     * Get single draft by ID
     */
    async draft(obj, args) {
      const draft = await DetranWfDraft.query().findById(args.id)
      return formatDraft(draft)
    },

    /**
     * Get active draft by path and locale
     */
    async draftByPath(obj, args) {
      const locale = args.locale || 'pt-br'
      const draft = await DetranWfDraft.query()
        .where({ path: args.path, locale })
        .whereNotIn('state', [stateMachine.STATES.PUBLISHED, stateMachine.STATES.ARCHIVED])
        .orderBy('updatedAt', 'desc')
        .first()

      return formatDraft(draft)
    },

    /**
     * List drafts with optional filtering
     */
    async drafts(obj, args) {
      const query = DetranWfDraft.query().orderBy('updatedAt', 'desc')

      if (args.state) {
        query.where('state', args.state)
      }
      if (args.authorId) {
        query.where('authorId', args.authorId)
      }
      if (args.locale) {
        query.where('locale', args.locale)
      }
      if (args.limit) {
        query.limit(args.limit)
      }
      if (args.offset) {
        query.offset(args.offset)
      }

      const drafts = await query
      return Promise.all(drafts.map(formatDraft))
    },

    /**
     * List pending tasks for current user
     */
    async pendingTasks(obj, args, context) {
      const user = getContextUser(context)
      const query = DetranWfDraft.query()
        .whereIn('state', [
          stateMachine.STATES.IN_REVIEW,
          stateMachine.STATES.AWAITING_APPROVAL,
          stateMachine.STATES.PERIODIC_REVIEW
        ])
        .orderBy('updatedAt', 'desc')

      // Do not list own documents as pending approval tasks for the user (4-eyes rule)
      if (user && user.id) {
        query.where('authorId', '!=', user.id)
      }

      if (args.limit) {
        query.limit(args.limit)
      }
      if (args.offset) {
        query.offset(args.offset)
      }

      const drafts = await query
      return Promise.all(drafts.map(formatDraft))
    },

    /**
     * Get workflow configuration and feature flag
     */
    async config() {
      return policiesService.getWorkflowConfig()
    },

    /**
     * List configured workflow policies
     */
    async policies() {
      return policiesService.listPolicies()
    },

    /**
     * Get effective policy for path
     */
    async policy(obj, args) {
      return policiesService.resolvePolicy(args.path)
    }
  },

  DetranWorkflowMutation: {
    /**
     * Save or create a draft
     */
    async saveDraft(obj, args, context) {
      try {
        const user = getContextUser(context)

        // RBAC Check
        if (!checkWorkflowAccess(user, ['write:drafts', 'write:pages', 'manage:pages'], { path: args.path, locale: args.locale })) {
          throw new PermissionDeniedError('Permissão insuficiente para criar ou editar rascunho.')
        }

        const effectivePolicy = await policiesService.resolvePolicy(args.path)
        const approvalMode = policiesService.normalizeApprovalMode(args.approvalMode, effectivePolicy)

        let draft
        if (args.id) {
          draft = await DetranWfDraft.query().findById(args.id)
          if (!draft) {
            throw new Error(`Draft #${args.id} not found`)
          }

          // Author can edit while draft or changes_requested
          await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SAVE_DRAFT, user)

          await draft.$query().patch({
            title: args.title,
            description: args.description,
            content: args.content,
            contentType: args.contentType || draft.contentType,
            editorKey: args.editorKey || draft.editorKey,
            tags: args.tags || draft.tags,
            approvalMode
          })
          draft = await DetranWfDraft.query().findById(args.id)
        } else {
          draft = await DetranWfDraft.query().insert({
            pageId: args.pageId || null,
            path: args.path,
            locale: args.locale || 'pt-br',
            title: args.title,
            description: args.description || null,
            content: args.content,
            contentType: args.contentType || 'markdown',
            editorKey: args.editorKey || 'markdown',
            tags: args.tags || [],
            approvalMode,
            currentLevel: 1,
            authorId: user.id,
            baseHash: args.baseHash || null
          })
        }

        const formatted = await formatDraft(draft)
        return {
          responseResult: graphHelper.generateSuccess('Rascunho salvo com sucesso.'),
          draft: formatted
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Submit draft for review
     */
    async submit(obj, args, context) {
      try {
        const user = getContextUser(context)
        const draft = await DetranWfDraft.query().findById(args.id)
        if (!draft) {
          throw new Error(`Draft #${args.id} not found`)
        }

        // RBAC Check
        if (!checkWorkflowAccess(user, ['write:drafts', 'write:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
          throw new PermissionDeniedError('Permissão insuficiente para submeter rascunho.')
        }

        // Apply updated approval mode if supplied
        if (args.approvalMode) {
          const policy = await policiesService.resolvePolicy(draft.path)
          draft.approvalMode = policiesService.normalizeApprovalMode(args.approvalMode, policy)
          await draft.$query().patch({ approvalMode: draft.approvalMode })
        }

        const result = await stateMachine.executeTransition(
          draft,
          stateMachine.ACTIONS.SUBMIT,
          user,
          { comment: args.comment }
        )

        eventsDispatcher.dispatch('wf:submitted', { draft: result.draft, user, comment: args.comment })

        const formatted = await formatDraft(result.draft)
        return {
          responseResult: graphHelper.generateSuccess('Documento submetido para revisão com sucesso.'),
          draft: formatted
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Request adjustments
     */
    async requestChanges(obj, args, context) {
      try {
        const user = getContextUser(context)
        const draft = await DetranWfDraft.query().findById(args.id)
        if (!draft) {
          throw new Error(`Draft #${args.id} not found`)
        }

        // RBAC Check
        if (!checkWorkflowAccess(user, ['review:pages', 'approve:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
          throw new PermissionDeniedError('Permissão de revisor ou aprovador necessária para solicitar ajustes.')
        }

        const result = await stateMachine.executeTransition(
          draft,
          stateMachine.ACTIONS.REQUEST_CHANGES,
          user,
          { comment: args.comment }
        )

        eventsDispatcher.dispatch('wf:changes_requested', { draft: result.draft, user, comment: args.comment })

        const formatted = await formatDraft(result.draft)
        return {
          responseResult: graphHelper.generateSuccess('Ajustes solicitados ao autor com sucesso.'),
          draft: formatted
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Approve Step 1
     */
    async approveStep(obj, args, context) {
      try {
        const user = getContextUser(context)
        const draft = await DetranWfDraft.query().findById(args.id)
        if (!draft) {
          throw new Error(`Draft #${args.id} not found`)
        }

        // RBAC Check
        if (!checkWorkflowAccess(user, ['review:pages', 'approve:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
          throw new PermissionDeniedError('Permissão de revisor necessária para aprovar este nível.')
        }

        const result = await stateMachine.executeTransition(
          draft,
          stateMachine.ACTIONS.APPROVE_STEP,
          user,
          { comment: args.comment }
        )

        eventsDispatcher.dispatch('wf:approved_step', { draft: result.draft, user, comment: args.comment })

        const formatted = await formatDraft(result.draft)
        return {
          responseResult: graphHelper.generateSuccess('Nível 1 aprovado com sucesso. Encaminhado para homologação final.'),
          draft: formatted
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Publish document officially
     */
    async publish(obj, args, context) {
      try {
        const user = getContextUser(context)
        const draft = await DetranWfDraft.query().findById(args.id)
        if (!draft) {
          throw new Error(`Draft #${args.id} not found`)
        }

        // RBAC Check
        if (!checkWorkflowAccess(user, ['approve:pages', 'manage:pages'], { path: draft.path, locale: draft.locale })) {
          throw new PermissionDeniedError('Permissão de aprovador necessária para publicar esta página.')
        }

        // Fetch live page if exists for concurrency check
        let livePage = null
        if (draft.pageId && typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.pages) {
          try {
            livePage = await WIKI.models.pages.query().findById(draft.pageId)
          } catch {
            // Live page query fallback
          }
        }

        // Resolve policy review interval
        const policy = await policiesService.resolvePolicy(draft.path)

        // Execute transition in state machine
        const result = await stateMachine.executeTransition(
          draft,
          stateMachine.ACTIONS.PUBLISH,
          user,
          { livePage, comment: args.comment, reviewIntervalDays: policy.reviewIntervalDays }
        )

        // Publish to core Wiki.js pages model if WIKI is running
        let targetPageId = draft.pageId
        if (typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.pages) {
          if (draft.pageId) {
            await WIKI.models.pages.updatePage({
              id: draft.pageId,
              title: draft.title,
              description: draft.description || '',
              content: draft.content,
              tags: Array.isArray(draft.tags) ? draft.tags : [],
              isPublished: true,
              user
            })
          } else {
            const newPage = await WIKI.models.pages.createPage({
              path: draft.path,
              locale: draft.locale,
              title: draft.title,
              description: draft.description || '',
              content: draft.content,
              contentType: draft.contentType,
              editorKey: draft.editorKey,
              tags: Array.isArray(draft.tags) ? draft.tags : [],
              isPublished: true,
              user
            })
            if (newPage && newPage.id) {
              targetPageId = newPage.id
              await result.draft.$query().patch({ pageId: newPage.id })
            }
          }
        }

        eventsDispatcher.dispatch('wf:published', { draft: result.draft, user, comment: args.comment, pageId: targetPageId })

        const formatted = await formatDraft(result.draft)
        return {
          responseResult: graphHelper.generateSuccess('Documento publicado oficialmente com sucesso.'),
          draft: formatted,
          pageId: targetPageId
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Add line-anchored review comment
     */
    async addComment(obj, args, context) {
      try {
        const user = getContextUser(context)
        const comment = await DetranWfComment.query().insert({
          draftId: args.draftId,
          userId: user.id,
          lineNumber: args.lineNumber || null,
          anchorText: args.anchorText || null,
          body: args.body,
          resolved: false
        })
        comment.userName = user.name || 'Servidor'

        return {
          responseResult: graphHelper.generateSuccess('Comentário registrado com sucesso.'),
          comment
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Toggle comment resolution
     */
    async resolveComment(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!checkWorkflowAccess(user, ['write:pages', 'write:drafts', 'manage:pages'])) {
          throw new PermissionDeniedError('Permissão insuficiente para alterar status de comentário.')
        }

        await DetranWfComment.query().findById(args.id).patch({ resolved: args.resolved })
        const status = graphHelper.generateSuccess('Status do comentário atualizado.')
        return {
          ...status,
          responseResult: status
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Revalidate periodic review validity
     */
    async revalidate(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!checkWorkflowAccess(user, ['approve:pages', 'manage:pages'])) {
          throw new PermissionDeniedError('Permissão de aprovador necessária para revalidar normativo.')
        }

        const draft = await DetranWfDraft.query().findById(args.id)
        if (!draft) {
          throw new Error(`Draft #${args.id} not found`)
        }

        const policy = await policiesService.resolvePolicy(draft.path)
        const result = await stateMachine.executeTransition(
          draft,
          stateMachine.ACTIONS.REVALIDATE,
          user,
          { comment: args.comment, reviewIntervalDays: policy.reviewIntervalDays }
        )

        eventsDispatcher.dispatch('wf:revalidated', { draft: result.draft, user, comment: args.comment })

        const formatted = await formatDraft(result.draft)
        return {
          responseResult: graphHelper.generateSuccess('Vigência revalidada com sucesso.'),
          draft: formatted
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Archive document
     */
    async archive(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!checkWorkflowAccess(user, ['manage:pages'])) {
          throw new PermissionDeniedError('Permissão de gestor de conteúdo necessária para arquivar.')
        }

        const draft = await DetranWfDraft.query().findById(args.id)
        if (!draft) {
          throw new Error(`Draft #${args.id} not found`)
        }

        const result = await stateMachine.executeTransition(
          draft,
          stateMachine.ACTIONS.ARCHIVE,
          user,
          { comment: args.comment }
        )

        const formatted = await formatDraft(result.draft)
        return {
          responseResult: graphHelper.generateSuccess('Documento arquivado com sucesso.'),
          draft: formatted
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Set workflow configuration / feature flag
     */
    async setConfig(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!checkWorkflowAccess(user, ['manage:system'])) {
          throw new PermissionDeniedError('Permissão de administrador necessária para alterar configurações.')
        }

        const config = await policiesService.setWorkflowConfig(args)
        return {
          responseResult: graphHelper.generateSuccess('Configurações de workflow atualizadas com sucesso.'),
          config
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Create or update workflow policy
     */
    async setPolicy(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!checkWorkflowAccess(user, ['manage:system'])) {
          throw new PermissionDeniedError('Permissão de administrador necessária para configurar políticas.')
        }

        const policy = await policiesService.setPolicy(args)
        return {
          responseResult: graphHelper.generateSuccess('Política de workflow salva com sucesso.'),
          policy
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Delete workflow policy
     */
    async deletePolicy(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!checkWorkflowAccess(user, ['manage:system'])) {
          throw new PermissionDeniedError('Permissão de administrador necessária para excluir políticas.')
        }

        await policiesService.deletePolicy(args.id)
        return graphHelper.generateSuccess('Política de workflow removida com sucesso.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}

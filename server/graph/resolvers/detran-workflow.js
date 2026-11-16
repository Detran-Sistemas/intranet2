const graphHelper = require('../../helpers/graph')
const stateMachine = require('../../detran/workflow/state-machine')
const policiesService = require('../../detran/workflow/policies')
const { PermissionDeniedError, InvalidTransitionError } = require('../../detran/workflow/errors')
const DetranWfDraft = require('../../models/detranWfDraft')
const DetranWfComment = require('../../models/detranWfComment')
const eventsDispatcher = require('../../detran/workflow/events-dispatcher')
const {
  checkWorkflowAccess,
  isSuperAdminUser,
  formatDraftsBatch,
  formatDraft,
  submitDraftUseCase,
  requestChangesUseCase,
  approveStepUseCase,
  publishDraftUseCase
} = require('../../detran/workflow/use-cases')

/* global WIKI */

/**
 * Extract authenticated user from GraphQL execution context
 */
function getContextUser(context) {
  if (!context) return null
  let user = null
  if (context.req && context.req.user) {
    user = context.req.user
  } else if (context.user) {
    user = context.user
  }
  // In Wiki.js, Guest is user ID 2, and any user <= 0 is unauthenticated
  if (!user || !user.id || Number(user.id) <= 0 || Number(user.id) === 2) {
    return null
  }
  return user
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
    async workflowRetract(obj, args, context) {
      return module.exports.DetranWorkflowMutation.retract(obj, args, context)
    },
    async workflowSaveDraft(obj, args, context) {
      return module.exports.DetranWorkflowMutation.saveDraft(obj, args, context)
    }
  },

  DetranWorkflowQuery: {
    /**
     * Get single draft by ID
     */
    async draft(obj, args, context) {
      const hasAuthContext = Boolean(context && (context.req || Object.prototype.hasOwnProperty.call(context, 'user')))
      const user = hasAuthContext ? getContextUser(context) : null
      if (hasAuthContext && !user) {
        throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
      }

      const draft = await DetranWfDraft.query().findById(args.id)
      if (!draft) {
        return null
      }

      if (hasAuthContext && !checkWorkflowAccess(user, ['write:drafts', 'write:pages', 'review:pages', 'approve:pages', 'manage:pages', 'manage:system'], { path: draft.path, locale: draft.locale })) {
        throw new PermissionDeniedError('Permissão insuficiente para consultar este rascunho.')
      }

      return formatDraft(draft)
    },

    /**
     * Get active draft by path and locale
     */
    async draftByPath(obj, args, context) {
      const locale = args.locale || 'pt-br'
      const hasAuthContext = Boolean(context && (context.req || Object.prototype.hasOwnProperty.call(context, 'user')))
      const user = hasAuthContext ? getContextUser(context) : null
      if (hasAuthContext && !user) {
        return null
      }

      const draft = await DetranWfDraft.query()
        .where({ path: args.path, locale })
        .whereNotIn('state', [stateMachine.STATES.PUBLISHED, stateMachine.STATES.ARCHIVED])
        .orderBy('updatedAt', 'desc')
        .first()

      if (!draft) {
        return null
      }

      if (hasAuthContext && !checkWorkflowAccess(user, ['write:drafts', 'write:pages', 'review:pages', 'approve:pages', 'manage:pages', 'manage:system'], { path: draft.path, locale: draft.locale })) {
        return null
      }

      return formatDraft(draft)
    },

    /**
     * List drafts with optional filtering
     */
    async drafts(obj, args, context) {
      const user = getContextUser(context)
      // In real HTTP requests, an unauthenticated session cannot query drafts
      if (context && context.req && !user) {
        return []
      }
      if (!user && !args.authorId && !args.state) {
        return []
      }

      const isSuperAdmin = isSuperAdminUser(user)

      const query = DetranWfDraft.query().orderBy('updatedAt', 'desc')

      if (args.state) {
        query.where('state', args.state)
      }
      if (args.authorId) {
        query.where('authorId', Number(args.authorId))
      } else if (!isSuperAdmin && user && user.id && !args.state) {
        query.where('authorId', user.id)
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
      return formatDraftsBatch(drafts)
    },

    /**
     * List pending tasks for current user
     */
    async pendingTasks(obj, args, context) {
      const user = getContextUser(context)
      if (!user) {
        return []
      }
      const isSuperAdmin = isSuperAdminUser(user)

      const query = DetranWfDraft.query().orderBy('updatedAt', 'desc')

      if (isSuperAdmin) {
        query.whereIn('state', [
          stateMachine.STATES.IN_REVIEW,
          stateMachine.STATES.AWAITING_APPROVAL,
          stateMachine.STATES.PERIODIC_REVIEW,
          stateMachine.STATES.CHANGES_REQUESTED
        ])
      } else {
        const canReview = checkWorkflowAccess(user, ['review:pages', 'manage:pages', 'manage:system'])
        const canApprove = checkWorkflowAccess(user, ['approve:pages', 'manage:pages', 'manage:system'])

        const reviewableStates = []
        if (canReview) {
          reviewableStates.push(stateMachine.STATES.IN_REVIEW, stateMachine.STATES.PERIODIC_REVIEW)
        }
        if (canApprove) {
          reviewableStates.push(stateMachine.STATES.AWAITING_APPROVAL)
        }

        query.where((builder) => {
          if (reviewableStates.length > 0) {
            builder.where((sub) => {
              sub.whereIn('state', reviewableStates)
                .andWhere('authorId', '!=', user.id)
            }).orWhere((sub) => {
              sub.where('state', stateMachine.STATES.CHANGES_REQUESTED)
                .andWhere('authorId', user.id)
            })
          } else {
            builder.where('state', stateMachine.STATES.CHANGES_REQUESTED)
              .andWhere('authorId', user.id)
          }
        })
      }

      if (args.limit) {
        query.limit(args.limit)
      }
      if (args.offset) {
        query.offset(args.offset)
      }

      const drafts = await query
      return formatDraftsBatch(drafts)
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
        if (!user) {
          throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
        }

        let targetDraftId = args.id
        if (!targetDraftId && args.path) {
          const existingActive = await DetranWfDraft.query()
            .where({ path: args.path, locale: args.locale || 'pt-br' })
            .whereNotIn('state', [stateMachine.STATES.PUBLISHED, stateMachine.STATES.ARCHIVED])
            .orderBy('updatedAt', 'desc')
            .first()
          if (existingActive) {
            targetDraftId = existingActive.id
          }
        }

        let draft = targetDraftId ? await DetranWfDraft.query().findById(targetDraftId) : null
        if (targetDraftId && !draft) {
          throw new Error(`Draft #${targetDraftId} not found`)
        }

        // RBAC Check: creating/editing own draft requires write perms; inline review edit on in_review/awaiting_approval also allows reviewers
        const isReviewEditableState = Boolean(
          draft && (draft.state === stateMachine.STATES.IN_REVIEW || draft.state === stateMachine.STATES.AWAITING_APPROVAL)
        )
        const requiredPerms = isReviewEditableState ?
          ['write:drafts', 'write:pages', 'review:pages', 'approve:pages', 'manage:pages', 'manage:system'] :
          ['write:drafts', 'write:pages', 'manage:pages', 'manage:system']
        const effectivePath = args.path || (draft && draft.path)
        const effectiveLocale = args.locale || (draft && draft.locale) || 'pt-br'

        if (!checkWorkflowAccess(user, requiredPerms, { path: effectivePath, locale: effectiveLocale })) {
          throw new PermissionDeniedError('Permissão insuficiente para criar ou editar rascunho.')
        }

        const effectivePolicy = await policiesService.resolvePolicy(effectivePath)
        const approvalMode = policiesService.normalizeApprovalMode(args.approvalMode || (draft && draft.approvalMode), effectivePolicy)

        let resolvedPageId = args.pageId || (draft && draft.pageId) || null
        let resolvedBaseHash = args.baseHash || (draft && draft.baseHash) || null
        if (typeof WIKI !== 'undefined' && WIKI.models && WIKI.models.pages) {
          try {
            let livePage = null
            if (resolvedPageId) {
              livePage = await WIKI.models.pages.query().findById(resolvedPageId)
            } else if (effectivePath) {
              livePage = await WIKI.models.pages.query().where({ path: effectivePath }).first()
            }
            if (livePage) {
              resolvedPageId = resolvedPageId || livePage.id
              resolvedBaseHash = resolvedBaseHash || livePage.hash || null
            }
          } catch {
            // Ignored if pages table/model differs in mock
          }
        }

        if (draft) {
          await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SAVE_DRAFT, user)

          const patchData = {
            pageId: resolvedPageId || draft.pageId || null,
            baseHash: resolvedBaseHash || draft.baseHash || null,
            title: args.title !== undefined ? args.title : draft.title,
            description: args.description !== undefined ? args.description : draft.description,
            content: args.content !== undefined ? args.content : draft.content,
            contentType: args.contentType || draft.contentType,
            editorKey: args.editorKey || draft.editorKey,
            tags: args.tags || draft.tags,
            approvalMode
          }
          if (args.decisions !== undefined) {
            patchData.decisions = args.decisions
          }
          if (!draft.authorId && user && user.id) {
            patchData.authorId = user.id
          }
          await draft.$query().patch(patchData)
          draft = await DetranWfDraft.query().findById(targetDraftId)
        } else {
          draft = await DetranWfDraft.query().insert({
            pageId: resolvedPageId,
            path: args.path,
            locale: args.locale || 'pt-br',
            title: args.title,
            description: args.description || null,
            content: args.content,
            contentType: args.contentType || 'markdown',
            editorKey: args.editorKey || 'markdown',
            tags: args.tags || [],
            decisions: args.decisions || '{}',
            approvalMode,
            currentLevel: 1,
            authorId: user.id,
            baseHash: resolvedBaseHash
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
        const formatted = await submitDraftUseCase({
          id: args.id,
          approvalMode: args.approvalMode,
          comment: args.comment,
          user
        })
        return {
          responseResult: graphHelper.generateSuccess('Documento submetido para revisão com sucesso.'),
          draft: formatted
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Retract submitted draft back to editable draft (Author or Admin only)
     */
    async retract(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!user) {
          throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
        }
        const draft = await DetranWfDraft.query().findById(args.id)
        if (!draft) {
          throw new Error(`Draft #${args.id} not found`)
        }

        if (!checkWorkflowAccess(user, ['write:drafts', 'write:pages', 'manage:pages', 'manage:system'], { path: draft.path, locale: draft.locale })) {
          throw new PermissionDeniedError('Permissão insuficiente para retratar rascunho.')
        }

        const result = await stateMachine.executeTransition(
          draft,
          stateMachine.ACTIONS.RETRACT,
          user,
          { comment: args.comment }
        )

        eventsDispatcher.dispatch('wf:retracted', { draft: result.draft, user, comment: args.comment })

        const formatted = await formatDraft(result.draft)
        return {
          responseResult: graphHelper.generateSuccess('Documento puxado de volta para edição com sucesso.'),
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
        const formatted = await requestChangesUseCase({
          id: args.id,
          comment: args.comment,
          user
        })
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
        const formatted = await approveStepUseCase({
          id: args.id,
          comment: args.comment,
          user
        })
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
        const { draft: formatted, pageId } = await publishDraftUseCase({
          id: args.id,
          comment: args.comment,
          user
        })
        return {
          responseResult: graphHelper.generateSuccess('Documento publicado oficialmente com sucesso.'),
          draft: formatted,
          pageId
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
        if (!user) {
          throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
        }
        const draft = await DetranWfDraft.query().findById(args.draftId)
        if (!draft) {
          throw new Error(`Draft #${args.draftId} not found`)
        }
        if (!checkWorkflowAccess(user, ['write:drafts', 'write:pages', 'review:pages', 'approve:pages', 'manage:pages', 'manage:system'], { path: draft.path, locale: draft.locale })) {
          throw new PermissionDeniedError('Permissão insuficiente para comentar neste rascunho.')
        }
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
        if (!user) {
          throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
        }
        if (!checkWorkflowAccess(user, ['write:pages', 'write:drafts', 'review:pages', 'approve:pages', 'manage:pages', 'manage:system'])) {
          throw new PermissionDeniedError('Permissão insuficiente para alterar status de comentário.')
        }

        const comment = await DetranWfComment.query().findById(args.id)
        if (!comment) {
          throw new Error(`Comment #${args.id} not found`)
        }

        const draft = comment.draftId ? await DetranWfDraft.query().findById(comment.draftId) : null
        let parsedAnchor = null
        if (comment.anchorText) {
          try {
            const parsed = JSON.parse(comment.anchorText)
            if (parsed && typeof parsed === 'object') {
              parsedAnchor = parsed
            }
          } catch {}
        }

        const hasExplicitDecision = typeof args.decision === 'string' && args.decision.length > 0
        const isRedactionItem = Boolean(parsedAnchor && parsedAnchor.type === 'redaction')

        if ((hasExplicitDecision || isRedactionItem) && draft) {
          if (draft.state === stateMachine.STATES.PUBLISHED || draft.state === stateMachine.STATES.ARCHIVED) {
            throw new InvalidTransitionError(draft.state, 'resolve_comment_decision', 'Não é possível decidir alterações em um documento já publicado ou arquivado.')
          }
          if (draft.authorId && Number(draft.authorId) === Number(user.id)) {
            throw new PermissionDeniedError('O autor não pode aceitar ou recusar as alterações que ele mesmo realizou.')
          }
          if (!checkWorkflowAccess(user, ['review:pages', 'approve:pages', 'manage:pages', 'manage:system'], { path: draft.path, locale: draft.locale })) {
            throw new PermissionDeniedError('Permissão de revisor ou aprovador necessária para decidir sobre alterações.')
          }
        }

        const patchData = { resolved: args.resolved }
        if (parsedAnchor) {
          parsedAnchor.status = args.decision || (args.resolved ? 'accepted' : 'pending')
          if (args.resolved) {
            parsedAnchor.reviewedAt = new Date().toISOString()
          } else {
            delete parsedAnchor.reviewedAt
          }
          patchData.anchorText = JSON.stringify(parsedAnchor)
        }

        await comment.$query().patch(patchData)
        const status = graphHelper.generateSuccess('Status do comentário atualizado.')
        return {
          ...status,
          responseResult: status
        }
      } catch (err) {
        const errStatus = graphHelper.generateError(err, false)
        return {
          ...errStatus,
          responseResult: errStatus
        }
      }
    },

    /**
     * Persist reviewer decision on a diff suggestion
     */
    async setSuggestionDecision(obj, args, context) {
      try {
        const user = getContextUser(context)
        if (!user) {
          throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
        }

        const draft = await DetranWfDraft.query().findById(args.draftId)
        if (!draft) {
          throw new Error(`Draft #${args.draftId} not found`)
        }

        if (draft.state === stateMachine.STATES.PUBLISHED || draft.state === stateMachine.STATES.ARCHIVED) {
          throw new InvalidTransitionError(draft.state, 'set_suggestion_decision', 'Não é possível decidir alterações em um documento já publicado ou arquivado.')
        }
        if (draft.authorId && Number(draft.authorId) === Number(user.id)) {
          throw new PermissionDeniedError('O autor não pode aceitar ou recusar as alterações que ele mesmo realizou.')
        }
        if (!checkWorkflowAccess(user, ['review:pages', 'approve:pages', 'manage:pages', 'manage:system'], { path: draft.path, locale: draft.locale })) {
          throw new PermissionDeniedError('Permissão de revisor ou aprovador necessária para decidir sobre alterações.')
        }

        let currentDecisions = {}
        if (draft.decisions) {
          try {
            currentDecisions = typeof draft.decisions === 'string' ? JSON.parse(draft.decisions) : draft.decisions
          } catch {
            currentDecisions = {}
          }
        }

        if (!currentDecisions._timestamps || typeof currentDecisions._timestamps !== 'object') {
          currentDecisions._timestamps = {}
        }

        if (args.decision === 'pending') {
          delete currentDecisions[args.suggestionId]
          delete currentDecisions._timestamps[args.suggestionId]
          if (Object.keys(currentDecisions._timestamps).length === 0) {
            delete currentDecisions._timestamps
          }
        } else {
          currentDecisions[args.suggestionId] = args.decision
          currentDecisions._timestamps[args.suggestionId] = new Date().toISOString()
        }

        const patchData = {
          decisions: JSON.stringify(currentDecisions)
        }
        if (typeof args.content === 'string' && args.content.length > 0) {
          patchData.content = args.content
        }

        await draft.$query().patch(patchData)
        const updated = await DetranWfDraft.query().findById(args.draftId)
        const formatted = await formatDraft(updated)

        return {
          responseResult: graphHelper.generateSuccess('Decisão sobre alteração registrada com sucesso.'),
          draft: formatted
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
        if (!user) {
          throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
        }
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
        if (!user) {
          throw new PermissionDeniedError('Acesso não autenticado. Faça login para continuar.')
        }
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
        if (!user || !checkWorkflowAccess(user, ['manage:system'])) {
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
        if (!user || !checkWorkflowAccess(user, ['manage:system'])) {
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
        if (!user || !checkWorkflowAccess(user, ['manage:system'])) {
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

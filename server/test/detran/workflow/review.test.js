const fs = require('fs')
const path = require('path')
const knex = require('knex')
const {
  generateDiffPatch,
  renderDiffHtml,
  groupCommentsByLine,
  getAvailableReviewActions,
  extractLineFromDiffElement,
  canEditDraftContentInReview,
  canDecideReviewSuggestion,
  sortReviewItems
} = require('../../../../client/store/detran-workflow-review')
const DraftModel = require('../../../models/detranWfDraft')
const CommentModel = require('../../../models/detranWfComment')
const EventModel = require('../../../models/detranWfEvent')
const PolicyModel = require('../../../models/detranWfPolicy')
const PagesModel = require('../../../models/pages')
const migrator = require('../../../detran/workflow/migrator')
const workflowResolvers = require('../../../graph/resolvers/detran-workflow')

describe('Etapa 3.1: Tela Comparativa de Revisão, Diff e Anotações', () => {
  let db

  beforeAll(async () => {
    db = knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    })

    // Setup core tables
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary()
      table.string('name')
      table.string('email')
    })

    await db.schema.createTable('pages', (table) => {
      table.increments('id').primary()
      table.string('path')
      table.string('localeCode').defaultTo('pt-BR')
      table.string('title')
      table.string('description').nullable()
      table.text('content')
      table.string('contentType').defaultTo('markdown')
      table.boolean('isPublished').defaultTo(true)
      table.boolean('isPrivate').defaultTo(false)
      table.integer('authorId').defaultTo(1)
      table.timestamp('createdAt').defaultTo(db.fn.now())
      table.timestamp('updatedAt').defaultTo(db.fn.now())
    })

    // Run detran workflow migrations
    await migrator.up(db)

    // Bind Objection models
    DraftModel.knex(db)
    CommentModel.knex(db)
    EventModel.knex(db)
    PolicyModel.knex(db)
    PagesModel.knex(db)

    // Setup global WIKI mock
    global.WIKI = {
      models: {
        knex: db,
        detranWfDraft: DraftModel,
        detranWfComment: CommentModel,
        detranWfEvent: EventModel,
        detranWfPolicy: PolicyModel,
        pages: {
          query() {
            return PagesModel.query()
          },
          async createPage(payload) {
            const page = await PagesModel.query().insert({
              path: payload.path,
              localeCode: payload.locale || 'pt-BR',
              title: payload.title,
              description: payload.description || '',
              content: payload.content,
              contentType: payload.contentType || 'markdown',
              isPublished: true,
              authorId: payload.user ? payload.user.id : 1
            })
            return page
          },
          async updatePage(payload) {
            await PagesModel.query().findById(payload.id).patch({
              title: payload.title,
              description: payload.description || '',
              content: payload.content,
              isPublished: true,
              authorId: payload.user ? payload.user.id : 1
            })
            return PagesModel.query().findById(payload.id)
          }
        },
        pageHistory: {
          addVersion: jest.fn().mockResolvedValue(true)
        }
      },
      config: {
        lang: { code: 'pt-BR' }
      }
    }

    // Seed test users
    await db('users').insert([
      { id: 10, name: 'Autor Servidor', email: 'autor@detran.mg.gov.br' },
      { id: 20, name: 'Revisor Técnico', email: 'revisor@detran.mg.gov.br' },
      { id: 30, name: 'Aprovador Diretor', email: 'diretor@detran.mg.gov.br' }
    ])
  })

  afterAll(async () => {
    await db.destroy()
  })

  describe('1. Review Helper (Diff, Patch e Linhas)', () => {
    it('deve gerar patch unificado entre versão no ar e rascunho proposto', () => {
      const orig = 'Linha 1: Versao Antiga\nLinha 2: Texto Mantido\nLinha 3: Revogada'
      const draft = 'Linha 1: Versao Nova\nLinha 2: Texto Mantido\nLinha 4: Nova Clausula'

      const patch = generateDiffPatch({
        path: '/normas/portaria-123',
        originalContent: orig,
        draftContent: draft
      })

      expect(patch).toContain('--- /normas/portaria-123')
      expect(patch).toContain('+++ /normas/portaria-123')
      expect(patch).toContain('-Linha 1: Versao Antiga')
      expect(patch).toContain('+Linha 1: Versao Nova')
      expect(patch).toContain('-Linha 3: Revogada')
      expect(patch).toContain('+Linha 4: Nova Clausula')
    })

    it('deve gerar diff para criação de documento onde versão no ar é vazia', () => {
      const patch = generateDiffPatch({
        path: 'instrucao-nova',
        originalContent: '',
        draftContent: 'Novo Parágrafo Único'
      })

      expect(patch).toContain('+Novo Parágrafo Único')
      expect(patch).toContain('--- /instrucao-nova')
    })

    it('deve renderizar HTML via diff2html em formato side-by-side e line-by-line', () => {
      const patch = generateDiffPatch({
        path: '/documento',
        originalContent: 'A\nB',
        draftContent: 'A\nC'
      })

      const htmlSide = renderDiffHtml({ patch, viewMode: 'side-by-side' })
      expect(htmlSide).toContain('d2h-wrapper')
      expect(htmlSide).toContain('d2h-file-side-diff')

      const htmlLine = renderDiffHtml({ patch, viewMode: 'line-by-line' })
      expect(htmlLine).toContain('d2h-wrapper')
      expect(htmlLine).toContain('d2h-diff-table')
    })

    it('deve extrair linha de elementos clicados no diff', () => {
      const el = {
        className: 'd2h-code-linenumber d2h-ins',
        innerText: ' 42 '
      }
      expect(extractLineFromDiffElement(el)).toBe(42)

      const parentEl = {
        className: 'd2h-code-line',
        dataset: { lineNumber: '15' }
      }
      const childEl = {
        className: 'd2h-code-line-ctn',
        parentElement: parentEl
      }
      expect(extractLineFromDiffElement(childEl)).toBe(15)

      expect(extractLineFromDiffElement(null)).toBeNull()
    })
  })

  describe('2. Gestão de Comentários Ancorados por Linha', () => {
    it('deve agrupar comentários por número de linha e calcular contadores de pendências', () => {
      const comments = [
        { id: 1, lineNumber: 10, body: 'Ajustar redação do Art. 1º', resolved: false },
        { id: 2, lineNumber: 10, body: 'Concordo com a redação', resolved: true },
        { id: 3, lineNumber: 25, body: 'Verificar concordância', resolved: false },
        { id: 4, lineNumber: 0, body: 'Parecer geral sobre a estrutura', resolved: false },
        { id: 5, lineNumber: null, body: 'Observação final', resolved: true }
      ]

      const grouped = groupCommentsByLine(comments)

      expect(grouped.totalCount).toBe(5)
      expect(grouped.unresolvedCount).toBe(3)
      expect(grouped.byLine[10]).toHaveLength(2)
      expect(grouped.byLine[25]).toHaveLength(1)
      expect(grouped.general).toHaveLength(2)
    })
  })

  describe('3. Matriz de Ações do Revisor e Aprovador', () => {
    it('deve habilitar Homologar/Publicar diretamente para fluxo de 1 nível em in_review', () => {
      const actions = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '1_level',
        permissions: { 'review:pages': true, 'approve:pages': true }
      })

      expect(actions.canRequestChanges).toBe(true)
      expect(actions.canPublish).toBe(true)
      expect(actions.canApproveStep).toBe(false)
      expect(actions.statusDescription).toContain('Nível Único')
    })

    it('deve exigir Aprovar Nível 1 para fluxo de 2 níveis em in_review', () => {
      const actions = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '2_levels',
        permissions: { 'review:pages': true, 'approve:pages': false }
      })

      expect(actions.canRequestChanges).toBe(true)
      expect(actions.canApproveStep).toBe(true)
      expect(actions.canPublish).toBe(false)
      expect(actions.statusDescription).toContain('Nível 1 de 2')
    })

    it('deve habilitar Homologação Final quando em awaiting_approval ou in_approval_step2', () => {
      const actions = getAvailableReviewActions({
        state: 'awaiting_approval',
        approvalMode: '2_levels',
        permissions: { 'approve:pages': true }
      })

      expect(actions.canRequestChanges).toBe(true)
      expect(actions.canPublish).toBe(true)
      expect(actions.canApproveStep).toBe(false)
      expect(actions.statusDescription).toContain('Nível 2 de 2')
    })

    it('não deve permitir aprovações quando já estiver publicado ou em ajustes', () => {
      const actChanges = getAvailableReviewActions({ state: 'changes_requested' })
      expect(actChanges.canPublish).toBe(false)
      expect(actChanges.canApproveStep).toBe(false)

      const actPublished = getAvailableReviewActions({ state: 'published' })
      expect(actPublished.canPublish).toBe(false)
      expect(actPublished.canRequestChanges).toBe(false)
    })
  })

  describe('4. Integração GraphQL de Revisão: Comentários e Decisões', () => {
    let testDraft

    beforeEach(async () => {
      testDraft = await DraftModel.query().insert({
        path: 'portarias/revisao-detran',
        locale: 'pt-BR',
        title: 'Portaria de Revisão Técnica',
        description: 'Rascunho de teste para homologação',
        content: 'Conteúdo submetido para apreciação.',
        state: 'in_review',
        approvalMode: '2_levels',
        currentLevel: 1,
        authorId: 10
      })
    })

    it('deve adicionar comentário ancorado por linha via addComment', async () => {
      const user = { id: 20, name: 'Revisor Técnico', permissions: ['review:pages'] }
      const res = await workflowResolvers.DetranWorkflowMutation.addComment(
        null,
        {
          draftId: testDraft.id,
          lineNumber: 14,
          anchorText: 'Conteúdo submetido',
          body: 'Corrigir pontuação e incluir referência ao Decreto Estadual.'
        },
        { user }
      )

      expect(res.responseResult.succeeded).toBe(true)
      expect(res.comment).toBeDefined()
      expect(res.comment.draftId).toBe(testDraft.id)
      expect(res.comment.lineNumber).toBe(14)
      expect(res.comment.anchorText).toBe('Conteúdo submetido')
      expect(res.comment.resolved).toBe(false)
      expect(res.comment.userName).toBe('Revisor Técnico')

      // Verificar persistência no banco
      const inDb = await CommentModel.query().findById(res.comment.id)
      expect(inDb.body).toContain('Corrigir pontuação')
    })

    it('deve alternar status de resolução do comentário via resolveComment', async () => {
      const comment = await CommentModel.query().insert({
        draftId: testDraft.id,
        userId: 20,
        lineNumber: 5,
        body: 'Nota a ser resolvida',
        resolved: false
      })

      const user = { id: 10, name: 'Autor Servidor', permissions: ['write:drafts', 'write:pages'] }
      const res = await workflowResolvers.DetranWorkflowMutation.resolveComment(
        null,
        { id: comment.id, resolved: true },
        { user }
      )

      expect(res.succeeded).toBe(true)

      const updated = await CommentModel.query().findById(comment.id)
      expect(updated.resolved).toBe(true)
    })

    it('deve devolver rascunho ao autor via requestChanges', async () => {
      const user = { id: 20, name: 'Revisor Técnico', permissions: ['review:pages'] }
      const res = await workflowResolvers.DetranWorkflowMutation.requestChanges(
        null,
        {
          id: testDraft.id,
          comment: 'Favor adequar as anotações feitas nas linhas 5 e 14.'
        },
        { user }
      )

      expect(res.responseResult.succeeded).toBe(true)
      expect(res.draft.state).toBe('changes_requested')

      // Verificar se gravou evento
      const events = await EventModel.query().where('draftId', testDraft.id)
      const reqEvent = events.find((e) => e.action === 'request_changes')
      expect(reqEvent).toBeDefined()
      expect(reqEvent.toState).toBe('changes_requested')
      expect(reqEvent.comment).toContain('linhas 5 e 14')
    })

    it('deve aprovar etapa 1 e transitar para awaiting_approval via approveStep', async () => {
      const user = { id: 20, name: 'Revisor Técnico', permissions: ['review:pages'] }
      const res = await workflowResolvers.DetranWorkflowMutation.approveStep(
        null,
        {
          id: testDraft.id,
          comment: 'Revisão técnica concluída sem óbices. Encaminhando para homologação.'
        },
        { user }
      )

      expect(res.responseResult.succeeded).toBe(true)
      expect(res.draft.state).toBe('awaiting_approval')
      expect(res.draft.currentLevel).toBe(2)
    })

    it('deve homologar e publicar oficialmente em pages via publish', async () => {
      // Ajustar estado para awaiting_approval (homologação final em 2 níveis)
      await testDraft.$query().patch({ state: 'awaiting_approval', currentLevel: 2 })

      const user = { id: 30, name: 'Aprovador Diretor', permissions: ['approve:pages'] }
      const res = await workflowResolvers.DetranWorkflowMutation.publish(
        null,
        {
          id: testDraft.id,
          comment: 'Homologado nos termos da Portaria Institucional.'
        },
        { user }
      )

      expect(res.responseResult.succeeded).toBe(true)
      expect(res.draft.state).toBe('published')
      expect(res.pageId).toBeDefined()

      // Verificar publicação na tabela core pages
      const publishedPage = await PagesModel.query().findById(res.pageId)
      expect(publishedPage).toBeDefined()
      expect(publishedPage.title).toBe('Portaria de Revisão Técnica')
      expect(publishedPage.content).toBe('Conteúdo submetido para apreciação.')
      expect(publishedPage.authorId).toBe(30) // Autoria do homologador
      expect(publishedPage.isPublished).toBe(1)
    })

    it('deve bloquear auto-avanço de rascunho em estado draft por aprovador comum e permitir apenas ao Superadmin', async () => {
      const draftInit = await DraftModel.query().insert({
        path: 'guias/estilos-markdown',
        locale: 'pt-BR',
        title: 'Guia de Estilos Markdown',
        content: '# Guia Atualizado',
        state: 'draft',
        approvalMode: '1_level',
        authorId: 10
      })

      const regularApprover = { id: 30, name: 'Aprovador Diretor', permissions: ['approve:pages'] }
      const blockedRes = await workflowResolvers.DetranWorkflowMutation.publish(
        null,
        {
          id: draftInit.id,
          comment: 'Tentativa direta sem submissão'
        },
        { user: regularApprover }
      )
      expect(blockedRes.responseResult.succeeded).toBe(false)
      expect(blockedRes.responseResult.slug).toBe('InvalidTransitionError')

      const superAdmin = { id: 1, name: 'Superadmin', permissions: ['manage:system', 'approve:pages'] }
      const res = await workflowResolvers.DetranWorkflowMutation.publish(
        null,
        {
          id: draftInit.id,
          comment: 'Homologado diretamente pelo Superadmin'
        },
        { user: superAdmin }
      )

      expect(res.responseResult.succeeded).toBe(true)
      expect(res.draft.state).toBe('published')
      expect(res.pageId).toBeDefined()

      const publishedPage = await PagesModel.query().findById(res.pageId)
      expect(publishedPage).toBeDefined()
      expect(publishedPage.title).toBe('Guia de Estilos Markdown')
      expect(publishedPage.content).toBe('# Guia Atualizado')
    })
  })

  describe('Etapa 2: Regras de Autor vs Revisor e Bloqueio de Aprovação com Pendências', () => {
    it('canEditDraftContentInReview bloqueia edição do autor em in_review/awaiting_approval, mas permite ao revisor terceiro', () => {
      expect(canEditDraftContentInReview({ state: 'draft', isAuthor: true, canReviewOrApprove: false })).toBe(true)
      expect(canEditDraftContentInReview({ state: 'changes_requested', isAuthor: true, canReviewOrApprove: false })).toBe(true)
      expect(canEditDraftContentInReview({ state: 'in_review', isAuthor: true, canReviewOrApprove: true })).toBe(false)
      expect(canEditDraftContentInReview({ state: 'awaiting_approval', isAuthor: true, canReviewOrApprove: true })).toBe(false)
      expect(canEditDraftContentInReview({ state: 'in_review', isAuthor: false, canReviewOrApprove: true })).toBe(true)
      expect(canEditDraftContentInReview({ state: 'awaiting_approval', isAuthor: false, canReviewOrApprove: true })).toBe(true)
      expect(canEditDraftContentInReview({ state: 'in_review', isAuthor: false, canReviewOrApprove: false })).toBe(false)
      expect(canEditDraftContentInReview({ state: 'published', isAuthor: true, canReviewOrApprove: true })).toBe(false)
    })

    it('canDecideReviewSuggestion aplica Quatro Olhos irrestrito e trava fora dos estados ativos de revisão', () => {
      // Autor mesmo com perfil de revisor/aprovador não decide nenhum tipo de card
      expect(canDecideReviewSuggestion({ isAuthor: true, canReviewOrApprove: true, state: 'in_review', itemType: 'suggestion' })).toBe(false)
      expect(canDecideReviewSuggestion({ isAuthor: true, canReviewOrApprove: true, state: 'in_review', itemType: 'redaction' })).toBe(false)
      expect(canDecideReviewSuggestion({ isAuthor: true, canReviewOrApprove: true, state: 'in_review', itemType: 'comment' })).toBe(false)

      // Sem permissão de revisão/aprovação não decide
      expect(canDecideReviewSuggestion({ isAuthor: false, canReviewOrApprove: false, state: 'in_review', itemType: 'suggestion' })).toBe(false)

      // Estados fora de revisão ativa bloqueiam decisão
      expect(canDecideReviewSuggestion({ isAuthor: false, canReviewOrApprove: true, state: 'draft', itemType: 'suggestion' })).toBe(false)
      expect(canDecideReviewSuggestion({ isAuthor: false, canReviewOrApprove: true, state: 'changes_requested', itemType: 'redaction' })).toBe(false)
      expect(canDecideReviewSuggestion({ isAuthor: false, canReviewOrApprove: true, state: 'published', itemType: 'comment' })).toBe(false)

      // Terceiro revisor/aprovador decide durante in_review ou awaiting_approval
      expect(canDecideReviewSuggestion({ isAuthor: false, canReviewOrApprove: true, state: 'in_review', itemType: 'suggestion' })).toBe(true)
      expect(canDecideReviewSuggestion({ isAuthor: false, canReviewOrApprove: true, state: 'awaiting_approval', itemType: 'redaction' })).toBe(true)
      expect(canDecideReviewSuggestion({ isAuthor: false, canReviewOrApprove: true, state: 'awaiting_approval', itemType: 'comment' })).toBe(true)
    })

    it('getAvailableReviewActions oculta aprovação/devolução do autor e libera retração', () => {
      const authorInReview = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '2_levels',
        isAuthor: true,
        permissions: { 'review:pages': true, 'approve:pages': true, 'manage:pages': true }
      })
      expect(authorInReview.canApproveStep).toBe(false)
      expect(authorInReview.canPublish).toBe(false)
      expect(authorInReview.canRequestChanges).toBe(false)
      expect(authorInReview.canRetract).toBe(true)
      expect(authorInReview.canEditText).toBe(false)
      expect(authorInReview.canSubmit).toBe(false)

      const authorChangesRequested = getAvailableReviewActions({
        state: 'changes_requested',
        approvalMode: '1_level',
        isAuthor: true,
        permissions: { 'write:pages': true }
      })
      expect(authorChangesRequested.canRetract).toBe(false)
      expect(authorChangesRequested.canEditText).toBe(true)
      expect(authorChangesRequested.canSubmit).toBe(true)
    })

    it('getAvailableReviewActions bloqueia aprovação/publicação enquanto houver pendências e preserva Devolver com Ajustes', () => {
      const blockedPublish = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '1_level',
        isAuthor: false,
        pendingReviewCount: 2,
        permissions: { 'approve:pages': true }
      })
      expect(blockedPublish.canRequestChanges).toBe(true)
      expect(blockedPublish.canPublish).toBe(true)
      expect(blockedPublish.isApprovalBlockedByPendingItems).toBe(true)
      expect(blockedPublish.canFinalizePublish).toBe(false)
      expect(blockedPublish.canEditText).toBe(true)

      const unblockedPublish = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '1_level',
        isAuthor: false,
        pendingReviewCount: 0,
        permissions: { 'approve:pages': true }
      })
      expect(unblockedPublish.isApprovalBlockedByPendingItems).toBe(false)
      expect(unblockedPublish.canFinalizePublish).toBe(true)

      const blockedStep = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '2_levels',
        userId: 99,
        authorId: 10,
        pendingReviewCount: 1,
        permissions: { 'review:pages': true }
      })
      expect(blockedStep.canApproveStep).toBe(true)
      expect(blockedStep.isApprovalBlockedByPendingItems).toBe(true)
      expect(blockedStep.canFinalizeApproveStep).toBe(false)
      expect(blockedStep.canRequestChanges).toBe(true)
    })

    it('sortReviewItems coloca itens já revisados ao final da lista e ordena do mais novo para o mais antigo', () => {
      const mixed = [
        { id: 'sug-1', status: 'accepted', createdAt: '2026-11-16T09:00:00.000Z' },
        { id: 'com-1', rawCommentId: 1, status: 'pending', createdAt: '2026-11-16T09:10:00.000Z' },
        { id: 'com-2', rawCommentId: 2, status: 'rejected', createdAt: '2026-11-16T09:05:00.000Z', updatedAt: '2026-11-16T10:20:00.000Z' },
        { id: 'com-3', rawCommentId: 3, status: 'pending', createdAt: '2026-11-16T10:15:00.000Z' },
        { id: 'sug-2', status: 'pending' },
        { id: 'sug-3', status: 'accepted', createdAt: '2026-11-16T09:00:00.000Z' }
      ]

      const sorted = sortReviewItems(mixed, {
        fallbackCreatedAt: '2026-11-16T09:30:00.000Z',
        reviewedTimestamps: {
          'sug-1': '2026-11-16T10:05:00.000Z',
          'sug-3': '2026-11-16T10:30:00.000Z'
        }
      })

      // 1. Todos os pendentes vêm primeiro, do mais novo para o mais antigo (10:15 -> 09:30 -> 09:10)
      // 2. Todos os já revisados ficam no fim da lista, do mais novo para o mais antigo (10:30 -> 10:20 -> 10:05)
      expect(sorted.map(i => i.id)).toEqual([
        'com-3',
        'sug-2',
        'com-1',
        'sug-3',
        'com-2',
        'sug-1'
      ])

      const rcSrc = fs.readFileSync(
        path.resolve(__dirname, '../../../../client/components/workflow/review-comments.vue'),
        'utf8'
      )
      expect(rcSrc).toContain('sortReviewItems(')
    })

    it('sinaliza requiresApproverToPublish para Revisor em 1_level / awaiting_approval e libera encaminhamento em 2_levels', () => {
      const reviewer1Level = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '1_level',
        isAuthor: false,
        pendingReviewCount: 0,
        permissions: { 'review:pages': true }
      })
      expect(reviewer1Level.canPublish).toBe(false)
      expect(reviewer1Level.canApproveStep).toBe(false)
      expect(reviewer1Level.canRequestChanges).toBe(true)
      expect(reviewer1Level.requiresApproverToPublish).toBe(true)
      expect(reviewer1Level.awaitingFinalApprovalOnly).toBe(false)

      const reviewer2LevelsStep1 = getAvailableReviewActions({
        state: 'in_review',
        approvalMode: '2_levels',
        isAuthor: false,
        pendingReviewCount: 0,
        permissions: { 'review:pages': true }
      })
      expect(reviewer2LevelsStep1.canApproveStep).toBe(true)
      expect(reviewer2LevelsStep1.canFinalizeApproveStep).toBe(true)
      expect(reviewer2LevelsStep1.canPublish).toBe(false)
      expect(reviewer2LevelsStep1.requiresApproverToPublish).toBe(false)

      const reviewer2LevelsStep2 = getAvailableReviewActions({
        state: 'awaiting_approval',
        approvalMode: '2_levels',
        isAuthor: false,
        pendingReviewCount: 0,
        permissions: { 'review:pages': true }
      })
      expect(reviewer2LevelsStep2.canPublish).toBe(false)
      expect(reviewer2LevelsStep2.requiresApproverToPublish).toBe(true)
      expect(reviewer2LevelsStep2.awaitingFinalApprovalOnly).toBe(true)

      const approverPublish = getAvailableReviewActions({
        state: 'awaiting_approval',
        approvalMode: '2_levels',
        isAuthor: false,
        pendingReviewCount: 0,
        permissions: { 'approve:pages': true }
      })
      expect(approverPublish.canPublish).toBe(true)
      expect(approverPublish.requiresApproverToPublish).toBe(false)

      const reviewVueSrc = fs.readFileSync(
        path.resolve(__dirname, '../../../../client/components/workflow/review.vue'),
        'utf8'
      )
      expect(reviewVueSrc).toContain('requiresApproverToPublish')
      expect(reviewVueSrc).not.toContain('pronto para aprovar/publicar')
    })
  })
})

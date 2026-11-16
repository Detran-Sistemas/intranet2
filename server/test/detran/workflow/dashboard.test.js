const knex = require('knex')
const {
  getUrgencyLevel,
  getDraftActionRoute,
  calculateDashboardStats,
  partitionDashboardDrafts,
  getTab2DraftActions
} = require('../../../../client/store/detran-workflow-dashboard')
const DraftModel = require('../../../models/detranWfDraft')
const CommentModel = require('../../../models/detranWfComment')
const EventModel = require('../../../models/detranWfEvent')
const PolicyModel = require('../../../models/detranWfPolicy')
const PagesModel = require('../../../models/pages')
const migrator = require('../../../detran/workflow/migrator')
const workflowResolvers = require('../../../graph/resolvers/detran-workflow')

describe('Etapa 3.2: Central de Tarefas (/w) e Notificador no Cabeçalho', () => {
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

    // Run detran migrations
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
        pages: PagesModel
      },
      config: {
        lang: { code: 'pt-BR' }
      }
    }

    // Seed test users
    await db('users').insert([
      { id: 100, name: 'Servidor Autor', email: 'autor@detran.mg.gov.br' },
      { id: 200, name: 'Revisor Chefe', email: 'revisor@detran.mg.gov.br' }
    ])
  })

  afterAll(async () => {
    await db.destroy()
  })

  describe('1. Dashboard Helper Logic', () => {
    it('deve classificar corretamente os níveis de urgência por prazo de vigência', () => {
      const baseDate = new Date('2026-10-16T12:00:00Z')

      // 1. Data nula
      const nullUrgency = getUrgencyLevel(null, baseDate)
      expect(nullUrgency.level).toBe('normal')
      expect(nullUrgency.color).toBe('grey')

      // 2. Vencido (-5 dias)
      const expiredDate = new Date('2026-10-11T12:00:00Z')
      const expUrgency = getUrgencyLevel(expiredDate, baseDate)
      expect(expUrgency.level).toBe('expired')
      expect(expUrgency.label).toContain('Expirado há 5 dia(s)')
      expect(expUrgency.color).toBe('red darken-3')

      // 3. Urgente (10 dias)
      const urgentDate = new Date('2026-10-26T12:00:00Z')
      const urgUrgency = getUrgencyLevel(urgentDate, baseDate)
      expect(urgUrgency.level).toBe('urgent')
      expect(urgUrgency.label).toContain('Vence em 10 dia(s)')
      expect(urgUrgency.color).toBe('deep-orange darken-2')

      // 4. Atenção (45 dias)
      const warnDate = new Date('2026-11-30T12:00:00Z')
      const warnUrgency = getUrgencyLevel(warnDate, baseDate)
      expect(warnUrgency.level).toBe('warning')
      expect(warnUrgency.label).toContain('Vence em 45 dia(s)')

      // 5. Regular (180 dias)
      const normalDate = new Date('2027-04-14T12:00:00Z')
      const normUrgency = getUrgencyLevel(normalDate, baseDate)
      expect(normUrgency.level).toBe('normal')
      expect(normUrgency.label).toContain('Válido por 180 dias')
      expect(normUrgency.color).toBe('green darken-2')
    })

    it('deve determinar a rota correta para cada estado do documento', () => {
      // Ajustes solicitados -> Revisão com Edição Integrada (?edit=1)
      const routeChanges = getDraftActionRoute({ id: 1, path: 'normas/doc', locale: 'pt-br', state: 'changes_requested' })
      expect(routeChanges.route).toBe('/w/review/1?edit=1')
      expect(routeChanges.label).toContain('Editar')

      // Rascunho -> Revisão com Edição Integrada (?edit=1)
      const routeDraft = getDraftActionRoute({ id: 2, path: 'normas/doc2', locale: 'pt-br', state: 'draft' })
      expect(routeDraft.route).toBe('/w/review/2?edit=1')

      // Em revisão -> Tela de Revisão
      const routeReview = getDraftActionRoute({ id: 3, path: 'normas/doc3', locale: 'pt-br', state: 'in_review' })
      expect(routeReview.route).toBe('/w/review/3')

      // Aguardando homologação -> Tela de Revisão
      const routeAppr = getDraftActionRoute({ id: 4, path: 'normas/doc4', locale: 'pt-br', state: 'awaiting_approval' })
      expect(routeAppr.route).toBe('/w/review/4')

      // Publicado -> Página no Ar
      const routePub = getDraftActionRoute({ id: 5, path: 'normas/doc5', locale: 'pt-br', state: 'published' })
      expect(routePub.route).toBe('/pt-br/normas/doc5')
    })

    it('deve calcular estatísticas de cards do dashboard (KPIs)', () => {
      const stats = calculateDashboardStats({
        pendingTasks: [{ id: 1 }, { id: 2 }],
        myDrafts: [
          { id: 10, state: 'draft' },
          { id: 11, state: 'changes_requested' },
          { id: 12, state: 'in_review' }
        ],
        expiringNorms: [{ id: 99 }]
      })

      expect(stats.pendingCount).toBe(2)
      expect(stats.myDraftsCount).toBe(3)
      expect(stats.changesRequestedCount).toBe(1)
      expect(stats.expiringCount).toBe(1)
    })
  })

  describe('2. Consultas GraphQL para o Dashboard', () => {
    beforeAll(async () => {
      // Limpar rascunhos anteriores
      await db('detranWfDrafts').del()

      // Inserir rascunho criado pelo Servidor Autor (id: 100)
      await DraftModel.query().insert({
        id: 101,
        path: 'portarias/autor-proprio',
        locale: 'pt-br',
        title: 'Portaria do Autor',
        description: 'Texto do autor',
        content: 'Minha Portaria',
        state: 'in_review',
        approvalMode: '1_level',
        currentLevel: 1,
        authorId: 100
      })

      // Inserir rascunho criado por outro usuário (aguardando revisão pelo usuário 200)
      await DraftModel.query().insert({
        id: 102,
        path: 'portarias/outro-servidor',
        locale: 'pt-br',
        title: 'Portaria de Outro Servidor',
        description: 'Aguardando parecer do chefe',
        content: 'Texto a revisar',
        state: 'in_review',
        approvalMode: '2_levels',
        currentLevel: 1,
        authorId: 999
      })

      // Inserir rascunho com ajustes solicitados para o autor 100
      await DraftModel.query().insert({
        id: 103,
        path: 'normas/ajustes-pendentes',
        locale: 'pt-br',
        title: 'Norma com Ajustes Solicitados',
        description: 'Corrigir redação',
        content: 'Texto em ajuste',
        state: 'changes_requested',
        approvalMode: '1_level',
        currentLevel: 1,
        authorId: 100
      })

      // Inserir documento em periodic_review (revisão periódica a vencer)
      await DraftModel.query().insert({
        id: 104,
        path: 'instrucoes/anual-vencendo',
        locale: 'pt-br',
        title: 'Instrução de Serviço Anual',
        description: 'Vigência próxima do término',
        content: 'Texto da instrução',
        state: 'periodic_review',
        approvalMode: '1_level',
        currentLevel: 1,
        authorId: 999,
        reviewDueDate: new Date('2026-10-30T00:00:00Z').toISOString()
      })
    })

    it('deve retornar tarefas pendentes em pendingTasks respeitando regra dos 4 olhos', async () => {
      // Usuário 100 (autor do draft 101, com perfil de revisor para avaliar terceiros): não deve ver o 101 nas suas pendências de aprovação
      const user100 = { id: 100, name: 'Servidor Autor', permissions: ['read:pages', 'write:drafts', 'review:pages'] }
      const resUser100 = await workflowResolvers.DetranWorkflowQuery.pendingTasks(
        null,
        {},
        { user: user100 }
      )
      const idsUser100 = resUser100.map((d) => d.id)
      expect(idsUser100).not.toContain(101)
      expect(idsUser100).toContain(102)
      // O autor do documento 103 (em changes_requested) deve ser notificado em pendingTasks
      expect(idsUser100).toContain(103)

      // Usuário 200 (revisor chefe, não é autor do 101 nem do 102): vê ambos
      const user200 = { id: 200, name: 'Revisor Chefe', permissions: ['read:pages', 'review:pages', 'approve:pages'] }
      const resUser200 = await workflowResolvers.DetranWorkflowQuery.pendingTasks(
        null,
        {},
        { user: user200 }
      )
      const idsUser200 = resUser200.map((d) => d.id)
      expect(idsUser200).toContain(101)
      expect(idsUser200).toContain(102)
      // Usuário 200 não é o autor de 103, logo não vê 103 como pendência de aprovação
      expect(idsUser200).not.toContain(103)

      // Usuário Editor (sem review:pages nem approve:pages): não deve ver pendências de terceiros
      const userEditor = { id: 300, name: 'Editor Detran', permissions: ['read:pages', 'write:pages', 'write:drafts'] }
      const resEditor = await workflowResolvers.DetranWorkflowQuery.pendingTasks(null, {}, { user: userEditor })
      const idsEditor = resEditor.map((d) => d.id)
      expect(idsEditor).not.toContain(101)
      expect(idsEditor).not.toContain(102)
      expect(idsEditor).not.toContain(103)
    })

    it('deve retornar rascunhos filtrados por autor em drafts(authorId)', async () => {
      const resAuthor100 = await workflowResolvers.DetranWorkflowQuery.drafts(
        null,
        { authorId: 100 },
        {}
      )

      expect(resAuthor100.length).toBe(2)
      const ids = resAuthor100.map((d) => d.id)
      expect(ids).toContain(101)
      expect(ids).toContain(103)
      expect(ids).not.toContain(102)

      // Testar fallback automático para o autor autenticado quando não for superadmin e sem args.authorId
      const resSelf = await workflowResolvers.DetranWorkflowQuery.drafts(
        null,
        {},
        { user: { id: 100, permissions: ['read:pages', 'write:pages'] } }
      )
      expect(resSelf.length).toBe(2)
      expect(resSelf.map((d) => d.id)).toContain(101)
    })

    it('deve preencher baseContent a partir da página publicada correspondente', async () => {
      // Inserir uma página publicada no banco
      await db('pages').insert({
        id: 999,
        path: 'transito/regras',
        localeCode: 'pt-BR',
        title: 'Regras de Trânsito',
        content: 'Conteúdo original publicado de referência'
      })

      // Criar rascunho vinculado à página 999
      await DraftModel.query().insert({
        id: 999,
        pageId: 999,
        path: 'transito/regras',
        locale: 'pt-BR',
        title: 'Regras de Trânsito Alteradas',
        content: 'Conteúdo novo com modificações',
        state: 'in_review',
        approvalMode: '1_level',
        currentLevel: 1,
        authorId: 100
      })

      const draftResult = await workflowResolvers.DetranWorkflowQuery.draft(null, { id: 999 })
      expect(draftResult).toBeDefined()
      expect(draftResult.baseContent).toBe('Conteúdo original publicado de referência')
      expect(draftResult.content).toBe('Conteúdo novo com modificações')
    })

    it('deve listar normativos em revisão periódica em drafts(state: "periodic_review")', async () => {
      const resExpiring = await workflowResolvers.DetranWorkflowQuery.drafts(
        null,
        { state: 'periodic_review' },
        {}
      )

      expect(resExpiring.length).toBe(1)
      expect(resExpiring[0].id).toBe(104)
      expect(resExpiring[0].title).toBe('Instrução de Serviço Anual')
    })

    it('deve revalidar vigência de normativo via mutation revalidate', async () => {
      const user = { id: 200, name: 'Revisor Chefe', permissions: ['approve:pages', 'manage:pages'] }
      const res = await workflowResolvers.DetranWorkflowMutation.revalidate(
        null,
        {
          id: 104,
          comment: 'Revisão periódica concluída. Vigência estendida por 12 meses.'
        },
        { user }
      )

      expect(res.responseResult.succeeded).toBe(true)
      expect(res.draft.state).toBe('published')
      expect(res.draft.reviewDueDate).toBeDefined()

      // Verificar que a nova data é posterior à data anterior
      const prevDate = new Date('2026-10-30T00:00:00Z').getTime()
      const newDate = new Date(res.draft.reviewDueDate).getTime()
      expect(newDate).toBeGreaterThan(prevDate)
    })
  })

  describe('Etapa 2: Separação de Abas e Ações de Retração na Central', () => {
    it('partitionDashboardDrafts separa pendências, documentos ativos em tramitação e histórico publicado/arquivado', () => {
      const partitioned = partitionDashboardDrafts({
        currentUserId: 10,
        pendingTasks: [
          { id: 1, state: 'changes_requested', authorId: 10 },
          { id: 2, state: 'in_review', authorId: 10 }, // próprio documento não deve ir para Aguardando Minha Ação se estiver em revisão
          { id: 3, state: 'in_review', authorId: 20 }
        ],
        myDrafts: [
          { id: 1, state: 'changes_requested', authorId: 10, updatedAt: '2026-11-01T10:00:00Z' },
          { id: 2, state: 'in_review', authorId: 10, updatedAt: '2026-11-02T10:00:00Z' },
          { id: 4, state: 'draft', authorId: 10, updatedAt: '2026-11-03T10:00:00Z' },
          { id: 5, state: 'published', authorId: 10, updatedAt: '2026-10-10T10:00:00Z' },
          { id: 6, state: 'archived', authorId: 10, updatedAt: '2026-10-20T10:00:00Z' }
        ],
        expiringNorms: [
          { id: 99, state: 'periodic_review', authorId: 30 }
        ]
      })

      expect(partitioned.pendingTasks.map((d) => d.id)).toEqual([1, 3])
      expect(partitioned.activeDrafts.map((d) => d.id)).toEqual([1, 2, 4])
      expect(partitioned.historyDrafts.map((d) => d.id)).toEqual([6, 5])
      expect(partitioned.expiringNorms.map((d) => d.id)).toEqual([99])
    })

    it('getTab2DraftActions substitui ?edit=1 por Acompanhar Revisão e Puxar de Volta quando em análise', () => {
      const inReviewActions = getTab2DraftActions({ id: 42, state: 'in_review', path: 'teste', locale: 'pt-br' })
      expect(inReviewActions.canEdit).toBe(false)
      expect(inReviewActions.editRoute).toBeNull()
      expect(inReviewActions.canRetract).toBe(true)
      expect(inReviewActions.retractLabel).toBe('Puxar de Volta para Edição')
      expect(inReviewActions.canTrack).toBe(true)
      expect(inReviewActions.trackRoute).toBe('/review/42')
      expect(inReviewActions.trackRoute).not.toContain('edit=1')

      const awaitingActions = getTab2DraftActions({ id: 43, state: 'awaiting_approval', path: 'teste', locale: 'pt-br' })
      expect(awaitingActions.canEdit).toBe(false)
      expect(awaitingActions.canRetract).toBe(true)

      const draftActions = getTab2DraftActions({ id: 44, state: 'draft', path: 'teste', locale: 'pt-br' })
      expect(draftActions.canEdit).toBe(true)
      expect(draftActions.editRoute).toBe('/review/44?edit=1')
      expect(draftActions.canRetract).toBe(false)

      const changesActions = getTab2DraftActions({ id: 45, state: 'changes_requested', path: 'teste', locale: 'pt-br' })
      expect(changesActions.canEdit).toBe(true)
      expect(changesActions.editRoute).toBe('/review/45?edit=1')
      expect(changesActions.editLabel).toBe('Editar e Corrigir')
      expect(changesActions.canRetract).toBe(false)
    })
  })
})

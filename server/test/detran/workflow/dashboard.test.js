const knex = require('knex')
const {
  getUrgencyLevel,
  getDraftActionRoute,
  calculateDashboardStats
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
      // Ajustes solicitados -> Editor
      const routeChanges = getDraftActionRoute({ id: 1, path: 'normas/doc', locale: 'pt-br', state: 'changes_requested' })
      expect(routeChanges.route).toBe('/e/pt-br/normas/doc')
      expect(routeChanges.label).toContain('Editor')

      // Rascunho -> Editor
      const routeDraft = getDraftActionRoute({ id: 2, path: 'normas/doc2', locale: 'pt-br', state: 'draft' })
      expect(routeDraft.route).toBe('/e/pt-br/normas/doc2')

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
      // Usuário 100 (autor do draft 101): não deve ver o 101 nas suas pendências de aprovação
      const user100 = { id: 100, name: 'Servidor Autor' }
      const resUser100 = await workflowResolvers.DetranWorkflowQuery.pendingTasks(
        null,
        {},
        { user: user100 }
      )
      const idsUser100 = resUser100.map((d) => d.id)
      expect(idsUser100).not.toContain(101)
      expect(idsUser100).toContain(102)

      // Usuário 200 (revisor chefe, não é autor do 101 nem do 102): vê ambos
      const user200 = { id: 200, name: 'Revisor Chefe' }
      const resUser200 = await workflowResolvers.DetranWorkflowQuery.pendingTasks(
        null,
        {},
        { user: user200 }
      )
      const idsUser200 = resUser200.map((d) => d.id)
      expect(idsUser200).toContain(101)
      expect(idsUser200).toContain(102)
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
})

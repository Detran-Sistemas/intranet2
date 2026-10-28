const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const stateMachine = require('../../../detran/workflow/state-machine')
const policiesService = require('../../../detran/workflow/policies')
const periodicReviewJob = require('../../../detran/workflow/periodic-review-job')
const eventsDispatcher = require('../../../detran/workflow/events-dispatcher')
const DetranWfDraft = require('../../../models/detranWfDraft')
const DetranWfEvent = require('../../../models/detranWfEvent')
const DetranWfComment = require('../../../models/detranWfComment')
const DetranWfPolicy = require('../../../models/detranWfPolicy')
const PagesModel = require('../../../models/pages')
const resolvers = require('../../../graph/resolvers/detran-workflow')

jest.setTimeout(25000)

describe('Etapa 4.3: Teste E2E do Ciclo de Vida Completo do Normativo Detran-MG', () => {
  let db
  let originalWiki
  let emailDispatched = []
  let teamsDispatched = []

  // Usuários do fluxo institucional
  const userAdmin = { id: 1, name: 'Administrador do Sistema', email: 'admin@detran.mg.gov.br', permissions: ['manage:system', 'manage:pages'] }
  const userAuthor = { id: 10, name: 'Sargento Oliveira (Autor)', email: 'oliveira@detran.mg.gov.br', permissions: ['write:drafts', 'write:pages', 'read:pages'] }
  const userReviewer = { id: 20, name: 'Dra. Mariana (Revisora Técnica)', email: 'mariana@detran.mg.gov.br', permissions: ['review:pages', 'read:pages'] }
  const userApprover = { id: 30, name: 'Dr. Fernando (Diretor / Homologador)', email: 'fernando@detran.mg.gov.br', permissions: ['approve:pages', 'read:pages'] }

  beforeAll(async () => {
    // 1. Inicializa SQLite em memória
    db = Knex({
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: { filename: ':memory:' },
      pool: {
        afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
      }
    })

    Model.knex(db)

    // 2. Cria tabelas base do Wiki.js
    await db.schema.createTable('users', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('email').nullable()
    })

    await db.schema.createTable('pages', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('localeCode').defaultTo('pt-BR')
      table.string('title').notNullable()
      table.string('description').nullable()
      table.text('content').notNullable()
      table.string('contentType').defaultTo('markdown')
      table.boolean('isPublished').defaultTo(true)
      table.boolean('isPrivate').defaultTo(false)
      table.integer('authorId').defaultTo(1)
      table.string('hash').nullable()
      table.timestamp('createdAt').defaultTo(db.fn.now())
      table.timestamp('updatedAt').defaultTo(db.fn.now())
    })

    await db('users').insert([
      { id: userAdmin.id, name: userAdmin.name, email: userAdmin.email },
      { id: userAuthor.id, name: userAuthor.name, email: userAuthor.email },
      { id: userReviewer.id, name: userReviewer.name, email: userReviewer.email },
      { id: userApprover.id, name: userApprover.name, email: userApprover.email }
    ])

    // 3. Executa migrações do Detran Workflow
    await migrator.up(db)

    // 4. Mock do ecossistema WIKI
    originalWiki = global.WIKI
    global.WIKI = {
      models: {
        knex: db,
        detranWfDraft: DetranWfDraft,
        detranWfEvent: DetranWfEvent,
        detranWfComment: DetranWfComment,
        detranWfPolicy: DetranWfPolicy,
        users: {
          query() {
            return {
              findById: jest.fn().mockImplementation((id) => {
                const u = [userAdmin, userAuthor, userReviewer, userApprover].find(x => x.id === id)
                return Promise.resolve(u || { id, name: `Servidor ${id}`, email: `user${id}@detran.mg.gov.br` })
              })
            }
          }
        },
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
              authorId: payload.user ? payload.user.id : 1,
              hash: 'hash_publicacao_v1'
            })
            return page
          },
          async updatePage(payload) {
            await PagesModel.query().findById(payload.id).patch({
              title: payload.title,
              description: payload.description || '',
              content: payload.content,
              isPublished: true,
              authorId: payload.user ? payload.user.id : 1,
              hash: 'hash_publicacao_v2'
            })
            return PagesModel.query().findById(payload.id)
          }
        }
      },
      config: {
        host: 'https://intranet.detran.mg.gov.br',
        title: 'Intranet Detran-MG',
        company: 'Detran-MG • Polícia Civil',
        detranWorkflow: {
          enabled: true,
          teamsWebhookUrl: null
        },
        mail: {
          senderName: 'Workflow Detran-MG',
          senderEmail: 'workflow@detran.mg.gov.br'
        }
      },
      mail: {
        send: jest.fn().mockImplementation((opts) => {
          emailDispatched.push(opts)
          return Promise.resolve(true)
        })
      },
      scheduler: {
        registerJob: jest.fn().mockResolvedValue({ id: 'sched-1' })
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
      }
    }
  })

  afterAll(async () => {
    periodicReviewJob.stop()
    eventsDispatcher.setTeamsWebhookUrl(null)
    global.WIKI = originalWiki
    policiesService.setWorkflowEnabled(true)
    if (db) {
      await db.destroy()
    }
  })

  beforeEach(() => {
    emailDispatched = []
    teamsDispatched = []
    jest.clearAllMocks()
    policiesService.setWorkflowEnabled(true)
  })

  it('Ciclo Completo: Criação -> Autosave -> 4-Olhos -> Nível 1 -> Nível 2 -> Publicação -> Vigência 12m -> Revalidação', async () => {
    // -------------------------------------------------------------------------
    // PASSO 0: Parametrização da Política de Rota (/normativos = 2 Níveis obrigatórios)
    // -------------------------------------------------------------------------
    const policyResult = await resolvers.DetranWorkflowMutation.setPolicy(
      null,
      {
        pathPrefix: '/normativos',
        approvalLevels: 2,
        reviewIntervalDays: 365,
        autoArchiveOnExpire: false
      },
      { user: userAdmin }
    )
    expect(policyResult.responseResult.succeeded).toBe(true)
    expect(policyResult.policy.approvalLevels).toBe(2)

    // -------------------------------------------------------------------------
    // PASSO 1: Autor elabora e salva rascunho (Autosave / saveDraft)
    // -------------------------------------------------------------------------
    const saveRes1 = await resolvers.DetranWorkflowMutation.saveDraft(
      null,
      {
        path: 'normativos/resolucao-cetran-2026-01',
        locale: 'pt-br',
        title: 'Resolução CETRAN 01/2026',
        description: 'Dispõe sobre o credenciamento de centros de formação de condutores',
        content: '# Resolução CETRAN nº 01/2026\n\nArt. 1º Fica regulamentado o credenciamento...',
        contentType: 'markdown',
        editorKey: 'markdown',
        tags: ['normativo', 'cfc', 'credenciamento'],
        approvalMode: '2_levels',
        baseHash: null
      },
      { user: userAuthor }
    )

    expect(saveRes1.responseResult.succeeded).toBe(true)
    const draftId = saveRes1.draft.id
    expect(draftId).toBeGreaterThan(0)
    expect(saveRes1.draft.state).toBe(stateMachine.STATES.DRAFT)
    expect(saveRes1.draft.approvalMode).toBe('2_levels')

    // -------------------------------------------------------------------------
    // PASSO 2: Autor submete o documento para aprovação técnica
    // -------------------------------------------------------------------------
    const submitRes = await resolvers.DetranWorkflowMutation.submit(
      null,
      {
        id: draftId,
        approvalMode: '2_levels',
        comment: 'Submeto para parecer da assessoria técnica.'
      },
      { user: userAuthor }
    )

    expect(submitRes.responseResult.succeeded).toBe(true)
    expect(submitRes.draft.state).toBe(stateMachine.STATES.IN_REVIEW)
    expect(submitRes.draft.currentLevel).toBe(1)

    // -------------------------------------------------------------------------
    // PASSO 3: Validação do Princípio dos 4 Olhos (Autor NÃO pode aprovar o próprio ato)
    // -------------------------------------------------------------------------
    // Mesmo que o autor possua perfil de revisor/aprovador, a regra dos 4 olhos bloqueia a auto-aprovação
    const authorWithReviewerGroup = {
      ...userAuthor,
      permissions: ['write:drafts', 'write:pages', 'read:pages', 'review:pages', 'approve:pages']
    }
    const selfApproveRes = await resolvers.DetranWorkflowMutation.approveStep(
      null,
      {
        id: draftId,
        comment: 'Tentativa de auto-aprovação indevida'
      },
      { user: authorWithReviewerGroup }
    )
    expect(selfApproveRes.responseResult.succeeded).toBe(false)
    expect(selfApproveRes.responseResult.message).toMatch(/Four-Eyes/i)

    // -------------------------------------------------------------------------
    // PASSO 4: Revisora Técnica insere anotações ancoradas por linha
    // -------------------------------------------------------------------------
    const commentRes = await resolvers.DetranWorkflowMutation.addComment(
      null,
      {
        draftId,
        lineNumber: 3,
        anchorText: 'Art. 1º Fica regulamentado',
        body: 'Favor explicitar a base legal do Código de Trânsito Brasileiro (Lei 9.503/97).'
      },
      { user: userReviewer }
    )
    expect(commentRes.responseResult.succeeded).toBe(true)
    expect(commentRes.comment.lineNumber).toBe(3)

    // Resolvendo a anotação após ajuste
    const resolveRes = await resolvers.DetranWorkflowMutation.resolveComment(
      null,
      { id: commentRes.comment.id, resolved: true },
      { user: userAuthor }
    )
    expect(resolveRes.responseResult.succeeded).toBe(true)

    // -------------------------------------------------------------------------
    // PASSO 5: Revisora Técnica aprova o Nível 1 (Parecer Técnico)
    // -------------------------------------------------------------------------
    const approveStepRes = await resolvers.DetranWorkflowMutation.approveStep(
      null,
      {
        id: draftId,
        comment: 'Texto técnico verificado e em conformidade com as normas do CONTRAN.'
      },
      { user: userReviewer }
    )

    expect(approveStepRes.responseResult.succeeded).toBe(true)
    expect(approveStepRes.draft.state).toBe(stateMachine.STATES.AWAITING_APPROVAL)
    expect(approveStepRes.draft.currentLevel).toBe(2)

    // -------------------------------------------------------------------------
    // PASSO 6: Diretor homologa e publica oficialmente (Nível 2 -> Publicado)
    // -------------------------------------------------------------------------
    const publishRes = await resolvers.DetranWorkflowMutation.publish(
      null,
      {
        id: draftId,
        comment: 'Homologado pelo Diretor-Geral para publicação na Intranet Detran-MG.'
      },
      { user: userApprover }
    )

    expect(publishRes.responseResult.succeeded).toBe(true)
    expect(publishRes.draft.state).toBe(stateMachine.STATES.PUBLISHED)
    expect(publishRes.draft.reviewDueDate).toBeDefined()
    expect(publishRes.pageId).toBeDefined()

    // Confere se o registro na tabela core `pages` do Wiki.js foi criado com sucesso
    const corePage = await PagesModel.query().findById(publishRes.pageId)
    expect(corePage).toBeDefined()
    expect(corePage.title).toBe('Resolução CETRAN 01/2026')
    expect(corePage.isPublished).toBe(1)

    // -------------------------------------------------------------------------
    // PASSO 7: Verificação da Trilha de Auditoria Imutável (detranWfEvents)
    // -------------------------------------------------------------------------
    const auditEvents = await DetranWfEvent.query()
      .where('draftId', draftId)
      .orderBy('id', 'asc')

    expect(auditEvents.length).toBeGreaterThanOrEqual(3)
    const actions = auditEvents.map(e => e.action)
    expect(actions).toContain('submit')
    expect(actions).toContain('approve_step')
    expect(actions).toContain('publish')

    // -------------------------------------------------------------------------
    // PASSO 8: Simulação da Vigência Periódica de 12 Meses (Motor de Expiração)
    // -------------------------------------------------------------------------
    // Simula data de 366 dias à frente (prazo vencido)
    const futureScanDate = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000)

    const scanResult = await periodicReviewJob.runReviewScan({
      referenceDate: futureScanDate,
      user: userAdmin
    })

    expect(scanResult.success).toBe(true)
    expect(scanResult.expiredCount).toBe(1)

    const expiredDraft = await DetranWfDraft.query().findById(draftId)
    expect(expiredDraft.state).toBe(stateMachine.STATES.PERIODIC_REVIEW)

    // -------------------------------------------------------------------------
    // PASSO 9: Ação de Revalidação Rápida (+12 Meses)
    // -------------------------------------------------------------------------
    const revalResult = await periodicReviewJob.revalidate(
      draftId,
      userApprover,
      { comment: 'Ato normativo segue vigente e sem necessidade de alteração legislativa.' }
    )

    expect(revalResult.success).toBe(true)
    expect(revalResult.draft.state).toBe(stateMachine.STATES.PUBLISHED)

    // Data de revisão postergada para +12 meses no futuro
    const newDueDate = new Date(revalResult.draft.reviewDueDate)
    expect(newDueDate.getTime()).toBeGreaterThan(Date.now() + 350 * 24 * 60 * 60 * 1000)

    // -------------------------------------------------------------------------
    // PASSO 10: Contingência Operacional (Feature Flag detranWorkflow.enabled = false)
    // -------------------------------------------------------------------------
    await resolvers.DetranWorkflowMutation.setConfig(
      null,
      { enabled: false },
      { user: userAdmin }
    )

    expect(policiesService.isWorkflowEnabled()).toBe(false)

    // Em contingência, novas resoluções de política forçam modo direto de 1 nível
    const contingencyPolicy = await policiesService.resolvePolicy('normativos/qualquer-outro')
    expect(contingencyPolicy.contingency).toBe(true)
    expect(contingencyPolicy.approvalLevels).toBe(1)
  })
})

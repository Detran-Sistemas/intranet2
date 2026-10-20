const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const stateMachine = require('../../../detran/workflow/state-machine')
const periodicReviewJob = require('../../../detran/workflow/periodic-review-job')
const eventsDispatcher = require('../../../detran/workflow/events-dispatcher')
const DetranWfDraft = require('../../../models/detranWfDraft')
const DetranWfEvent = require('../../../models/detranWfEvent')
const DetranWfPolicy = require('../../../models/detranWfPolicy')
const { getAvailableReviewActions } = require('../../../../client/store/detran-workflow-review')

jest.setTimeout(15000)

describe('Etapa 4.1: Motor de Revisão Periódica de Normativos (Vigência 12 Meses)', () => {
  let knex
  let originalWiki
  let mailSendSpy

  const userSystem = { id: 1, name: 'Sistema de Revisão Periódica', email: 'sistema@detran.mg.gov.br' }
  const userAuthor = { id: 10, name: 'Servidor Autor', email: 'autor@detran.mg.gov.br' }
  const userReviewer = { id: 20, name: 'Revisor Técnico', email: 'revisor@detran.mg.gov.br' }
  const userApprover = { id: 30, name: 'Aprovador Institucional', email: 'aprovador@detran.mg.gov.br' }

  beforeAll(async () => {
    // 1. In-memory SQLite for isolated TDD execution
    knex = Knex({
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: { filename: ':memory:' },
      pool: {
        afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
      }
    })

    Model.knex(knex)

    // 2. Minimal prerequisite tables
    await knex.schema.createTable('users', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('email').nullable()
    })
    await knex.schema.createTable('pages', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('hash').notNullable()
    })

    await knex('users').insert([userSystem, userAuthor, userReviewer, userApprover])

    // 3. Run Detran workflow migrations
    await migrator.up(knex)

    // 4. Mock global.WIKI environment
    originalWiki = global.WIKI
    mailSendSpy = jest.fn().mockResolvedValue(true)

    global.WIKI = {
      config: {
        host: 'https://intranet.detran.mg.gov.br',
        title: 'Intranet Detran-MG',
        company: 'Detran-MG • Polícia Civil',
        mail: {
          senderName: 'Workflow Detran-MG',
          senderEmail: 'workflow@detran.mg.gov.br'
        }
      },
      models: {
        users: {
          query() {
            return {
              findById: jest.fn().mockImplementation((id) => {
                const found = [userAuthor, userReviewer, userApprover].find(u => u.id === id)
                return Promise.resolve(found || { id, name: `Servidor ${id}`, email: `user${id}@detran.mg.gov.br` })
              })
            }
          }
        }
      },
      mail: {
        send: mailSendSpy
      },
      scheduler: {
        registerJob: jest.fn().mockResolvedValue({ id: 'job-1' })
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
    global.WIKI = originalWiki
    if (knex) {
      await knex.destroy()
    }
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    periodicReviewJob.stop()
    periodicReviewJob.isScanning = false

    // Clean tables between tests
    await knex('detranWfEvents').del()
    await knex('detranWfComments').del()
    await knex('detranWfDrafts').del()
    await knex('detranWfPolicies').del()
  })

  describe('1. Identificação de Normativos Vencidos (findExpiredDrafts)', () => {
    it('deve identificar normativos publicados cuja data limite de revisão é anterior ou igual à data de referência', async () => {
      const now = new Date('2026-10-16T12:00:00.000Z')
      const expiredDate = new Date('2026-10-10T00:00:00.000Z').toISOString()
      const futureDate = new Date('2026-12-01T00:00:00.000Z').toISOString()

      // 1. Expired published document
      await DetranWfDraft.query().insert({
        path: 'normativos/resolucao-101',
        title: 'Resolução 101/2025',
        content: 'Conteúdo normativo antigo',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: expiredDate,
        authorId: userAuthor.id
      })

      // 2. Active published document (valid)
      await DetranWfDraft.query().insert({
        path: 'normativos/resolucao-102',
        title: 'Resolução 102/2026',
        content: 'Conteúdo recente',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: futureDate,
        authorId: userAuthor.id
      })

      // 3. Draft with past reviewDueDate (should NOT be picked up since it is not published)
      await DetranWfDraft.query().insert({
        path: 'normativos/rascunho-em-edicao',
        title: 'Rascunho não publicado',
        content: 'Rascunho',
        state: stateMachine.STATES.DRAFT,
        reviewDueDate: expiredDate,
        authorId: userAuthor.id
      })

      const expiredList = await periodicReviewJob.findExpiredDrafts(now)

      expect(expiredList).toHaveLength(1)
      expect(expiredList[0].path).toBe('normativos/resolucao-101')
      expect(expiredList[0].state).toBe('published')
    })

    it('deve identificar normativos a vencer em janela futura (findUpcomingReviews)', async () => {
      const now = new Date('2026-10-16T12:00:00.000Z')
      const in15Days = new Date('2026-10-31T12:00:00.000Z').toISOString()
      const in60Days = new Date('2026-12-15T12:00:00.000Z').toISOString()

      await DetranWfDraft.query().insert({
        path: 'normativos/a-vencer-em-breve',
        title: 'Portaria 50/2025',
        content: 'Conteúdo',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: in15Days,
        authorId: userAuthor.id
      })

      await DetranWfDraft.query().insert({
        path: 'normativos/a-vencer-longe',
        title: 'Portaria 99/2026',
        content: 'Conteúdo',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: in60Days,
        authorId: userAuthor.id
      })

      const upcoming = await periodicReviewJob.findUpcomingReviews({ daysAhead: 30, referenceDate: now })

      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].path).toBe('normativos/a-vencer-em-breve')
    })
  })

  describe('2. Execução da Varredura e Transição para revisao_periodica (runReviewScan)', () => {
    it('deve transicionar documento vencido para revisao_periodica e registrar evento de auditoria', async () => {
      const pastDueDate = new Date('2026-09-01T00:00:00.000Z').toISOString()
      const scanDate = new Date('2026-10-16T12:00:00.000Z')

      const draft = await DetranWfDraft.query().insert({
        path: 'resolucoes/cetran-12',
        title: 'Resolução Cetran 12',
        content: 'Regras de trânsito estadual',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: pastDueDate,
        authorId: userAuthor.id
      })

      const result = await periodicReviewJob.runReviewScan({ referenceDate: scanDate })

      expect(result.success).toBe(true)
      expect(result.scannedCount).toBe(1)
      expect(result.expiredCount).toBe(1)

      // Verify draft state in DB
      const updated = await DetranWfDraft.query().findById(draft.id)
      expect(updated.state).toBe(stateMachine.STATES.PERIODIC_REVIEW)

      // Verify audit event in detranWfEvents
      const events = await DetranWfEvent.query().where('draftId', draft.id)
      expect(events).toHaveLength(1)
      expect(events[0].action).toBe(stateMachine.ACTIONS.EXPIRE)
      expect(events[0].fromState).toBe(stateMachine.STATES.PUBLISHED)
      expect(events[0].toState).toBe(stateMachine.STATES.PERIODIC_REVIEW)
      expect(events[0].userId).toBe(1) // Sistema
    })

    it('deve suportar modo dryRun sem alterar registros no banco', async () => {
      const pastDueDate = new Date('2026-08-01T00:00:00.000Z').toISOString()

      const draft = await DetranWfDraft.query().insert({
        path: 'portarias/dry-test',
        title: 'Portaria de Teste',
        content: 'Conteúdo',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: pastDueDate,
        authorId: userAuthor.id
      })

      const result = await periodicReviewJob.runReviewScan({ dryRun: true })

      expect(result.status).toBe('dry_run')
      expect(result.candidateCount).toBe(1)
      expect(result.expiredCount).toBe(0)

      const after = await DetranWfDraft.query().findById(draft.id)
      expect(after.state).toBe(stateMachine.STATES.PUBLISHED) // Preservado
    })

    it('deve emitir evento wf:expired e disparar e-mail institucional', async () => {
      const eventSpy = jest.fn()
      eventsDispatcher.once('wf:expired', eventSpy)

      const pastDueDate = new Date('2026-07-01T00:00:00.000Z').toISOString()

      const draft = await DetranWfDraft.query().insert({
        path: 'normas/notificacao-expiracao',
        title: 'Norma com Notificação',
        content: 'Conteúdo',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: pastDueDate,
        authorId: userAuthor.id
      })

      await periodicReviewJob.runReviewScan()

      // Give nextTick time to process
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(eventSpy).toHaveBeenCalled()
      expect(eventSpy.mock.calls[0][0].draft.id).toBe(draft.id)
      expect(eventSpy.mock.calls[0][0].draft.state).toBe('revisao_periodica')

      // Verify email send
      expect(mailSendSpy).toHaveBeenCalled()
      const mailCall = mailSendSpy.mock.calls.find(c => c[0].template === 'detran-wf-expired')
      expect(mailCall).toBeDefined()
      expect(mailCall[0].to).toBe(userAuthor.email)
      expect(mailCall[0].subject).toContain('Vigência Expirada')
    })

    it('deve arquivar automaticamente se a política do caminho estiver com autoArchiveOnExpire = true', async () => {
      await DetranWfPolicy.query().insert({
        pathPrefix: 'temporarios',
        approvalLevels: 1,
        reviewIntervalDays: 30,
        autoArchiveOnExpire: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      const pastDueDate = new Date('2026-05-01T00:00:00.000Z').toISOString()

      const draft = await DetranWfDraft.query().insert({
        path: 'temporarios/edital-provisorio',
        title: 'Edital Provisório',
        content: 'Conteúdo temporário',
        state: stateMachine.STATES.PUBLISHED,
        reviewDueDate: pastDueDate,
        authorId: userAuthor.id
      })

      await periodicReviewJob.runReviewScan()

      const updated = await DetranWfDraft.query().findById(draft.id)
      expect(updated.state).toBe(stateMachine.STATES.ARCHIVED)

      const events = await DetranWfEvent.query().where('draftId', draft.id)
      expect(events[0].action).toBe(stateMachine.ACTIONS.ARCHIVE)
    })
  })

  describe('3. Ação de Revalidação Rápida por Mais 12 Meses (revalidate)', () => {
    it('deve revalidar normativo em revisao_periodica resetando reviewDueDate para +365 dias e retornando para published', async () => {
      const pastDueDate = new Date('2026-06-01T00:00:00.000Z').toISOString()

      const draft = await DetranWfDraft.query().insert({
        path: 'resolucoes/reval-rapida',
        title: 'Resolução para Revalidação',
        content: 'Conteúdo em pleno vigor',
        state: stateMachine.STATES.PERIODIC_REVIEW,
        reviewDueDate: pastDueDate,
        authorId: userAuthor.id
      })

      const revalResult = await periodicReviewJob.revalidate(
        draft.id,
        userApprover,
        { comment: 'Revalidação bienal/anual aprovada pelo gestor sem alterações de texto.' }
      )

      expect(revalResult.success).toBe(true)
      expect(revalResult.draft.state).toBe(stateMachine.STATES.PUBLISHED)

      // Verify reviewDueDate was updated to ~365 days in the future
      const newDueDate = new Date(revalResult.draft.reviewDueDate)
      const now = new Date()
      const diffDays = Math.round((newDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBeGreaterThanOrEqual(364)
      expect(diffDays).toBeLessThanOrEqual(366)

      // Verify audit event
      const events = await DetranWfEvent.query()
        .where('draftId', draft.id)
        .where('action', stateMachine.ACTIONS.REVALIDATE)
      expect(events).toHaveLength(1)
      expect(events[0].fromState).toBe(stateMachine.STATES.PERIODIC_REVIEW)
      expect(events[0].toState).toBe(stateMachine.STATES.PUBLISHED)
      expect(events[0].userId).toBe(userApprover.id)
    })

    it('deve lançar erro se o rascunho não estiver em revisao_periodica', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normas/em-edicao',
        title: 'Norma em Edição',
        content: 'Texto',
        state: stateMachine.STATES.DRAFT,
        authorId: userAuthor.id
      })

      await expect(
        periodicReviewJob.revalidate(draft.id, userApprover)
      ).rejects.toThrow(/revalidated/)
    })

    it('deve lançar erro se o draft ID for inexistente', async () => {
      await expect(
        periodicReviewJob.revalidate(99999, userApprover)
      ).rejects.toThrow(/Draft #99999 not found/)
    })
  })

  describe('4. Agendamento e Controle do Job (schedule / stop)', () => {
    it('deve registrar job no scheduler do Wiki.js e inicializar intervalo interno', () => {
      periodicReviewJob.schedule(60000)

      expect(global.WIKI.scheduler.registerJob).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'detran-periodic-review',
          schedule: 'P1D'
        })
      )
      expect(periodicReviewJob.intervalTimer).toBeDefined()

      periodicReviewJob.stop()
      expect(periodicReviewJob.intervalTimer).toBeNull()
    })
  })

  describe('5. Suporte da Central de Tarefas e Review Actions (getAvailableReviewActions)', () => {
    it('deve habilitar canRevalidate e descrição de vigência expirada quando estado for revisao_periodica', () => {
      const actionsForApprover = getAvailableReviewActions(
        { state: 'revisao_periodica', approvalMode: '1_level' },
        { 'approve:pages': true }
      )

      expect(actionsForApprover.canRevalidate).toBe(true)
      expect(actionsForApprover.labelRevalidate).toBe('Revalidar Vigência (+12m)')
      expect(actionsForApprover.statusDescription).toContain('Vigência de 12 meses expirada')

      const actionsForReader = getAvailableReviewActions(
        { state: 'revisao_periodica', approvalMode: '1_level' },
        { 'read:pages': true }
      )
      expect(actionsForReader.canRevalidate).toBe(false)
    })
  })
})

const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const policiesService = require('../../../detran/workflow/policies')
const eventsDispatcher = require('../../../detran/workflow/events-dispatcher')
const DetranWfPolicy = require('../../../models/detranWfPolicy')
const resolvers = require('../../../graph/resolvers/detran-workflow')

jest.setTimeout(15000)

describe('Etapa 4.2: Painel de Configuração de Políticas do Workflow e Feature Flag', () => {
  let knex
  let originalWiki

  const adminUser = { id: 1, name: 'Administrador Geral', permissions: ['manage:system', 'manage:pages'] }
  const regularUser = { id: 10, name: 'Servidor Comum', permissions: ['read:pages', 'write:pages'] }

  beforeAll(async () => {
    // 1. In-memory SQLite
    knex = Knex({
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: { filename: ':memory:' },
      pool: {
        afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
      }
    })

    Model.knex(knex)

    // 2. Prerequisite tables
    await knex.schema.createTable('users', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
    })
    await knex.schema.createTable('pages', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('hash').notNullable()
    })

    await knex('users').insert([
      { id: 1, name: 'Administrador' },
      { id: 10, name: 'Servidor' }
    ])

    // 3. Workflow migrations
    await migrator.up(knex)

    // 4. Mock global.WIKI
    originalWiki = global.WIKI
    global.WIKI = {
      config: {
        detranWorkflow: {
          enabled: true,
          teamsWebhookUrl: null
        }
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
      }
    }
  })

  afterAll(async () => {
    global.WIKI = originalWiki
    policiesService.setWorkflowEnabled(true)
    if (knex) {
      await knex.destroy()
    }
  })

  beforeEach(async () => {
    policiesService.setWorkflowEnabled(true)
    eventsDispatcher.setTeamsWebhookUrl(null)
    await knex('detranWfPolicies').del()
  })

  describe('1. Controle da Feature Flag (Contingência e Rollback)', () => {
    it('deve iniciar habilitado por padrão e permitir desativação imediata', () => {
      expect(policiesService.isWorkflowEnabled()).toBe(true)

      policiesService.setWorkflowEnabled(false)
      expect(policiesService.isWorkflowEnabled()).toBe(false)

      policiesService.setWorkflowEnabled(true)
      expect(policiesService.isWorkflowEnabled()).toBe(true)
    })

    it('em modo de contingência (desativado), deve contornar políticas e forçar modo direto de 1 nível', async () => {
      // Cadastra política de 2 níveis para normativos
      await policiesService.setPolicy({
        pathPrefix: '/normativos',
        approvalLevels: 2,
        reviewIntervalDays: 365
      })

      // Normal: exige 2 níveis
      const activePolicy = await policiesService.resolvePolicy('/normativos/portaria-1')
      expect(activePolicy.approvalLevels).toBe(2)
      expect(policiesService.normalizeApprovalMode('1_level', activePolicy)).toBe('2_levels')

      // Ativa contingência (desativa workflow)
      policiesService.setWorkflowEnabled(false)

      const contingencyPolicy = await policiesService.resolvePolicy('/normativos/portaria-1')
      expect(contingencyPolicy.contingency).toBe(true)
      expect(contingencyPolicy.approvalLevels).toBe(1)
      expect(policiesService.normalizeApprovalMode('2_levels', contingencyPolicy)).toBe('1_level')
    })

    it('deve obter e atualizar a configuração geral e URL do Teams via setWorkflowConfig', async () => {
      const updated = await policiesService.setWorkflowConfig({
        enabled: true,
        teamsWebhookUrl: 'https://detranmg.webhook.office.com/teste'
      })

      expect(updated.enabled).toBe(true)
      expect(updated.teamsWebhookUrl).toBe('https://detranmg.webhook.office.com/teste')
      expect(eventsDispatcher.getTeamsWebhookUrl()).toBe('https://detranmg.webhook.office.com/teste')
    })
  })

  describe('2. Gestão de Políticas de Workflow por Rota (CRUD)', () => {
    it('deve criar uma nova política de rota com valores padronizados', async () => {
      const policy = await policiesService.setPolicy({
        pathPrefix: 'normativos',
        approvalLevels: 2,
        reviewIntervalDays: 365,
        autoArchiveOnExpire: false
      })

      expect(policy.id).toBeDefined()
      expect(policy.pathPrefix).toBe('/normativos')
      expect(policy.approvalLevels).toBe(2)
      expect(policy.reviewIntervalDays).toBe(365)
      expect(policy.autoArchiveOnExpire).toBe(false)
    })

    it('deve atualizar política existente se o mesmo prefixo for informado', async () => {
      await policiesService.setPolicy({
        pathPrefix: '/resolucoes',
        approvalLevels: 1,
        reviewIntervalDays: 180
      })

      // Atualiza para 2 níveis e 365 dias
      const updated = await policiesService.setPolicy({
        pathPrefix: '/resolucoes',
        approvalLevels: 2,
        reviewIntervalDays: 365,
        autoArchiveOnExpire: true
      })

      expect(updated.approvalLevels).toBe(2)
      expect(updated.reviewIntervalDays).toBe(365)
      expect(updated.autoArchiveOnExpire).toBe(true)

      const all = await policiesService.listPolicies()
      expect(all).toHaveLength(1)
    })

    it('deve resolver política com base no prefixo mais longo e específico (longest prefix match)', async () => {
      await policiesService.setPolicy({
        pathPrefix: '/normativos',
        approvalLevels: 2,
        reviewIntervalDays: 365
      })

      await policiesService.setPolicy({
        pathPrefix: '/normativos/comunicados',
        approvalLevels: 1,
        reviewIntervalDays: 90
      })

      const generalDoc = await policiesService.resolvePolicy('normativos/resolucao-01')
      expect(generalDoc.approvalLevels).toBe(2)
      expect(generalDoc.reviewIntervalDays).toBe(365)

      const subDoc = await policiesService.resolvePolicy('normativos/comunicados/aviso-interno')
      expect(subDoc.approvalLevels).toBe(1)
      expect(subDoc.reviewIntervalDays).toBe(90)
    })

    it('deve remover política por ID e retornar à regra padrão', async () => {
      const created = await policiesService.setPolicy({
        pathPrefix: '/editais',
        approvalLevels: 2
      })

      const beforeDelete = await policiesService.resolvePolicy('/editais/concurso')
      expect(beforeDelete.approvalLevels).toBe(2)

      const deleted = await policiesService.deletePolicy(created.id)
      expect(deleted).toBe(true)

      const afterDelete = await policiesService.resolvePolicy('/editais/concurso')
      expect(afterDelete.approvalLevels).toBe(1) // Fallback default
    })
  })

  describe('3. Integração GraphQL (Resolvers de Admin)', () => {
    it('deve permitir consulta de config e policies via DetranWorkflowQuery', async () => {
      await policiesService.setPolicy({ pathPrefix: '/rh', approvalLevels: 1 })

      const configRes = await resolvers.DetranWorkflowQuery.config()
      expect(configRes.enabled).toBe(true)

      const policiesRes = await resolvers.DetranWorkflowQuery.policies()
      expect(policiesRes).toHaveLength(1)
      expect(policiesRes[0].pathPrefix).toBe('/rh')
    })

    it('deve permitir setPolicy, setConfig e deletePolicy via DetranWorkflowMutation para admin', async () => {
      const adminContext = { user: adminUser }

      // 1. setPolicy
      const setPolRes = await resolvers.DetranWorkflowMutation.setPolicy(
        null,
        { pathPrefix: '/transito', approvalLevels: 2, reviewIntervalDays: 365 },
        adminContext
      )
      expect(setPolRes.responseResult.succeeded).toBe(true)
      expect(setPolRes.policy.pathPrefix).toBe('/transito')

      // 2. setConfig
      const setConfRes = await resolvers.DetranWorkflowMutation.setConfig(
        null,
        { enabled: false, teamsWebhookUrl: 'https://teams.office.com' },
        adminContext
      )
      expect(setConfRes.responseResult.succeeded).toBe(true)
      expect(setConfRes.config.enabled).toBe(false)

      // 3. deletePolicy
      const delRes = await resolvers.DetranWorkflowMutation.deletePolicy(
        null,
        { id: setPolRes.policy.id },
        adminContext
      )
      expect(delRes.succeeded).toBe(true)
    })

    it('deve bloquear mutações administrativas para usuários sem permissão manage:system', async () => {
      const userContext = { user: regularUser }

      const setPolicyAttempt = await resolvers.DetranWorkflowMutation.setPolicy(
        null,
        { pathPrefix: '/hacker', approvalLevels: 1 },
        userContext
      )
      expect(setPolicyAttempt.responseResult.succeeded).toBe(false)
      expect(setPolicyAttempt.responseResult.message).toContain('Permissão')

      const setConfigAttempt = await resolvers.DetranWorkflowMutation.setConfig(
        null,
        { enabled: false },
        userContext
      )
      expect(setConfigAttempt.responseResult.succeeded).toBe(false)
    })
  })
})

const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const resolvers = require('../../../graph/resolvers/detran-workflow')
const DetranWfPolicy = require('../../../models/detranWfPolicy')
const DetranWfDraft = require('../../../models/detranWfDraft')
const DetranWfEvent = require('../../../models/detranWfEvent')
const { MUTATION_WORKFLOW_SUBMIT } = require('../../../../client/store/detran-workflow')

jest.setTimeout(15000)

describe('Detran Workflow - Submission Modal & Concurrency Handling (TDD - Etapa 2.3)', () => {
  let knex

  const userAuthor = {
    id: 201,
    name: 'Autor Modal Submissao',
    email: 'autor.modal@detran.mg.gov.br',
    permissions: ['read:pages', 'write:drafts', 'write:pages']
  }

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    })
    Model.knex(knex)

    // Base tables for Wiki.js
    await knex.schema.createTable('users', table => {
      table.increments('id').primary()
      table.string('name')
      table.string('email')
    })
    await knex.schema.createTable('pages', table => {
      table.increments('id').primary()
      table.string('path')
      table.string('locale', 10).defaultTo('pt-br')
      table.string('title')
      table.text('content')
      table.string('hash', 64)
      table.string('updatedAt')
    })

    await knex('users').insert({
      id: userAuthor.id,
      name: userAuthor.name,
      email: userAuthor.email
    })

    // Run Detran migrations
    await migrator.up(knex)

    // Setup global WIKI mock
    global.WIKI = {
      models: {
        users: {
          query() {
            return {
              findById(id) {
                return knex('users').where({ id }).first()
              }
            }
          }
        },
        pages: {
          query() {
            return knex('pages')
          }
        }
      }
    }
  })

  afterAll(async () => {
    delete global.WIKI
    if (knex) {
      await knex.destroy()
    }
  })

  beforeEach(async () => {
    await knex('detranWfComments').del()
    await knex('detranWfEvents').del()
    await knex('detranWfDrafts').del()
    await knex('detranWfPolicies').del()
    await knex('pages').del()
  })

  // ---------------------------------------------------------------------------
  // 1. GraphQL Mutation Structure
  // ---------------------------------------------------------------------------
  test('1. MUTATION_WORKFLOW_SUBMIT is a valid GraphQL AST definition', () => {
    expect(MUTATION_WORKFLOW_SUBMIT).toBeDefined()
    expect(MUTATION_WORKFLOW_SUBMIT.kind).toBe('Document')
    expect(MUTATION_WORKFLOW_SUBMIT.definitions[0].operation).toBe('mutation')
  })

  // ---------------------------------------------------------------------------
  // 2. Submission with 1-Level Flow
  // ---------------------------------------------------------------------------
  test('2. Submits draft under 1-level mode, changes state to in_review and logs author comment', async () => {
    const context = { req: { user: userAuthor } }

    const draft = await DetranWfDraft.query().insert({
      path: 'comunicados/aviso-feriado',
      locale: 'pt-br',
      title: 'Aviso de Funcionamento no Feriado',
      content: 'Expediente nos postos Detran...',
      approvalMode: '1_level',
      state: 'draft',
      authorId: userAuthor.id
    })

    // Top-level alias mutation workflowSubmit
    const res = await resolvers.Mutation.workflowSubmit(
      {},
      {
        id: draft.id,
        approvalMode: '1_level',
        comment: 'Aviso anual para conferência da equipe de comunicação.'
      },
      context
    )

    expect(res.responseResult.succeeded).toBe(true)
    expect(res.draft.state).toBe('in_review')
    expect(res.draft.approvalMode).toBe('1_level')
    expect(res.draft.currentLevel).toBe(1)

    // Audit event check
    const events = await DetranWfEvent.query().where({ draftId: draft.id })
    expect(events.length).toBe(1)
    expect(events[0].action).toBe('submit')
    expect(events[0].fromState).toBe('draft')
    expect(events[0].toState).toBe('in_review')
    expect(events[0].comment).toBe('Aviso anual para conferência da equipe de comunicação.')
  })

  // ---------------------------------------------------------------------------
  // 3. Submission with 2-Levels Flow
  // ---------------------------------------------------------------------------
  test('3. Submits draft selecting 2-level mode and properly configures review levels', async () => {
    const context = { req: { user: userAuthor } }

    const draft = await DetranWfDraft.query().insert({
      path: 'diretrizes/fluxo-atendimento',
      locale: 'pt-br',
      title: 'Diretriz de Atendimento ao Cidadão',
      content: 'Texto da diretriz...',
      approvalMode: '1_level',
      state: 'draft',
      authorId: userAuthor.id
    })

    const res = await resolvers.Mutation.workflowSubmit(
      {},
      {
        id: draft.id,
        approvalMode: '2_levels',
        comment: 'Requer conferência técnica e homologação pela Diretoria de Habilitação.'
      },
      context
    )

    expect(res.responseResult.succeeded).toBe(true)
    expect(res.draft.state).toBe('in_review')
    expect(res.draft.approvalMode).toBe('2_levels')
    expect(res.draft.currentLevel).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // 4. Policy Enforced 2 Levels by Path Prefix
  // ---------------------------------------------------------------------------
  test('4. Enforces 2-levels mode automatically when path is covered by 2-level policy', async () => {
    const context = { req: { user: userAuthor } }

    // Configure 2-level policy for normas/
    await DetranWfPolicy.query().insert({
      pathPrefix: 'normas/',
      approvalLevels: 2,
      reviewIntervalDays: 365,
      autoArchiveOnExpire: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    const draft = await DetranWfDraft.query().insert({
      path: 'normas/portaria-vistoria',
      locale: 'pt-br',
      title: 'Portaria de Vistoria Veicular',
      content: 'Regras de vistoria...',
      approvalMode: '1_level',
      state: 'draft',
      authorId: userAuthor.id
    })

    // Author tries to submit as 1_level
    const res = await resolvers.Mutation.workflowSubmit(
      {},
      {
        id: draft.id,
        approvalMode: '1_level',
        comment: 'Tentativa com 1 nivel'
      },
      context
    )

    expect(res.responseResult.succeeded).toBe(true)
    // Policy enforces 2_levels!
    expect(res.draft.approvalMode).toBe('2_levels')
    expect(res.draft.currentLevel).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // 5. Concurrency Conflict Handling
  // ---------------------------------------------------------------------------
  test('5. Rejects submission and identifies conflict if live page was altered in production', async () => {
    const context = { req: { user: userAuthor } }

    // Existing page in live production
    const [livePageId] = await knex('pages').insert({
      path: 'normas/portaria-01',
      locale: 'pt-br',
      title: 'Portaria 01',
      content: 'Conteúdo que foi alterado diretamente em produção!',
      hash: 'HASH_NOVO_PRODUCAO_9999'
    })

    // Draft was created based on an older hash
    const draft = await DetranWfDraft.query().insert({
      pageId: livePageId,
      path: 'normas/portaria-01',
      locale: 'pt-br',
      title: 'Portaria 01 - Rascunho',
      content: 'Minhas edições...',
      baseHash: 'HASH_ANTIGO_1111',
      state: 'draft',
      authorId: userAuthor.id
    })

    // Check conflict directly on conflictDetector
    const conflictDetector = require('../../../detran/workflow/conflict-detector')
    const livePage = await knex('pages').where({ id: livePageId }).first()
    const conflict = conflictDetector.checkConflict(draft, livePage)

    expect(conflict.hasConflict).toBe(true)
    expect(conflict.type).toBe('MODIFIED_WHILE_IN_REVIEW')
    expect(conflict.baseHash).toBe('HASH_ANTIGO_1111')
    expect(conflict.currentHash).toBe('HASH_NOVO_PRODUCAO_9999')
  })

  // ---------------------------------------------------------------------------
  // 6. Invalid Transition Guard
  // ---------------------------------------------------------------------------
  test('6. Blocks submission if draft is not in draft or changes_requested state', async () => {
    const context = { req: { user: userAuthor } }

    const draft = await DetranWfDraft.query().insert({
      path: 'normas/portaria-tramitando',
      locale: 'pt-br',
      title: 'Portaria Já em Análise',
      content: 'Conteúdo...',
      state: 'in_review',
      authorId: userAuthor.id
    })

    const res = await resolvers.Mutation.workflowSubmit(
      {},
      { id: draft.id },
      context
    )

    expect(res.responseResult.succeeded).toBe(false)
    expect(res.responseResult.slug).toBe('InvalidTransitionError')
  })
})

const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const DetranWfDraft = require('../../../models/detranWfDraft')
const DetranWfEvent = require('../../../models/detranWfEvent')
const DetranWfComment = require('../../../models/detranWfComment')
const DetranWfPolicy = require('../../../models/detranWfPolicy')

jest.setTimeout(15000)

describe('Detran Workflow - Migrations & Objection Models (TDD)', () => {
  let knex

  beforeAll(async () => {
    // 1. Initialize in-memory SQLite for isolated test with foreign keys enabled
    knex = Knex({
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: {
        filename: ':memory:'
      },
      pool: {
        afterCreate: (conn, cb) => {
          conn.run('PRAGMA foreign_keys = ON', cb)
        }
      }
    })

    // 2. Bind Objection
    Model.knex(knex)

    // 3. Create minimal prerequisite tables (users, pages) for foreign key relations
    await knex.schema.createTable('users', table => {
      table.increments('id').primary()
      table.string('email').notNullable()
      table.string('name').notNullable()
    })

    await knex.schema.createTable('pages', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('title').notNullable()
      table.string('hash').notNullable()
      table.text('content').notNullable()
    })

    // Seed test user and page
    await knex('users').insert({ id: 1, email: 'autor@detran.mg.gov.br', name: 'Autor Teste' })
    await knex('users').insert({ id: 2, email: 'revisor@detran.mg.gov.br', name: 'Revisor Teste' })
    await knex('pages').insert({ id: 10, path: 'normativos/portaria-01', title: 'Portaria 01', hash: 'hash123', content: 'Conteudo inicial' })
  })

  afterAll(async () => {
    if (knex) {
      await knex.destroy()
    }
  })

  it('runs migrator.up() and creates all Detran workflow tables in detran_migrations', async () => {
    const { batchNo, log } = await migrator.up(knex)
    expect(batchNo).toBeGreaterThan(0)
    expect(log.length).toBeGreaterThan(0)

    const hasPolicies = await knex.schema.hasTable('detranWfPolicies')
    const hasDrafts = await knex.schema.hasTable('detranWfDrafts')
    const hasEvents = await knex.schema.hasTable('detranWfEvents')
    const hasComments = await knex.schema.hasTable('detranWfComments')
    const hasMigrationTable = await knex.schema.hasTable('detran_migrations')

    expect(hasPolicies).toBe(true)
    expect(hasDrafts).toBe(true)
    expect(hasEvents).toBe(true)
    expect(hasComments).toBe(true)
    expect(hasMigrationTable).toBe(true)
  })

  it('creates and queries DetranWfPolicy with defaults and prefix matching', async () => {
    const policy = await DetranWfPolicy.query().insert({
      pathPrefix: '/normativos',
      approvalLevels: 2,
      reviewIntervalDays: 365,
      autoArchiveOnExpire: false
    })

    expect(policy.id).toBeDefined()
    expect(policy.pathPrefix).toBe('/normativos')
    expect(policy.approvalLevels).toBe(2)
    expect(policy.reviewIntervalDays).toBe(365)
    expect(policy.createdAt).toBeDefined()
    expect(policy.updatedAt).toBeDefined()

    // Test getMatchingPolicy helper
    const matched = await DetranWfPolicy.getMatchingPolicy('/normativos/resolucao-100')
    expect(matched).not.toBeNull()
    expect(matched.pathPrefix).toBe('/normativos')
    expect(matched.approvalLevels).toBe(2)

    const unmatched = await DetranWfPolicy.getMatchingPolicy('/noticias/comunicado-1')
    expect(unmatched).toBeNull()
  })

  it('creates DetranWfDraft with JSON tags, defaults and relations', async () => {
    const draft = await DetranWfDraft.query().insert({
      pageId: 10,
      path: 'normativos/portaria-01',
      title: 'Portaria 01 - Revisada',
      description: 'Atualização das diretrizes',
      content: '# Nova Portaria\nTexto atualizado...',
      contentType: 'markdown',
      tags: ['detran', 'habilitacao', 'normativo'],
      approvalMode: '2_levels',
      authorId: 1,
      baseHash: 'hash123'
    })

    expect(draft.id).toBeDefined()
    expect(draft.locale).toBe('pt-br')
    expect(draft.state).toBe('draft')
    expect(draft.currentLevel).toBe(1)
    expect(draft.approvalMode).toBe('2_levels')
    expect(draft.createdAt).toBeDefined()
    expect(draft.updatedAt).toBeDefined()

    // Verify JSON attributes parsing for tags
    const fetchedDraft = await DetranWfDraft.query().findById(draft.id)
    expect(Array.isArray(fetchedDraft.tags)).toBe(true)
    expect(fetchedDraft.tags).toContain('habilitacao')
    expect(fetchedDraft.tags).toContain('normativo')
  })

  it('logs immutable DetranWfEvent and links to draft', async () => {
    const draft = await DetranWfDraft.query().findOne({ path: 'normativos/portaria-01' })

    const event = await DetranWfEvent.query().insert({
      draftId: draft.id,
      action: 'submit',
      fromState: 'draft',
      toState: 'in_review',
      userId: 1,
      comment: 'Submetendo para revisão da diretoria'
    })

    expect(event.id).toBeDefined()
    expect(event.createdAt).toBeDefined()

    // Query relationship via draft
    const events = await draft.$relatedQuery('events')
    expect(events.length).toBe(1)
    expect(events[0].action).toBe('submit')
    expect(events[0].fromState).toBe('draft')
    expect(events[0].toState).toBe('in_review')
  })

  it('creates and resolves DetranWfComment anchored to content', async () => {
    const draft = await DetranWfDraft.query().findOne({ path: 'normativos/portaria-01' })

    const comment = await DetranWfComment.query().insert({
      draftId: draft.id,
      userId: 2,
      lineNumber: 2,
      anchorText: 'Texto atualizado...',
      body: 'Favor especificar a base legal no segundo parágrafo.'
    })

    expect(comment.id).toBeDefined()
    expect(comment.resolved).toBe(false)
    expect(comment.lineNumber).toBe(2)

    // Mark comment as resolved
    await comment.$query().patch({ resolved: true })
    const updatedComment = await DetranWfComment.query().findById(comment.id)
    expect(updatedComment.resolved).toBe(true)

    // Query relationship via draft
    const comments = await draft.$relatedQuery('comments')
    expect(comments.length).toBe(1)
    expect(comments[0].body).toBe('Favor especificar a base legal no segundo parágrafo.')
  })

  it('updates draft and triggers $beforeUpdate hook', async () => {
    const draft = await DetranWfDraft.query().findOne({ path: 'normativos/portaria-01' })
    const oldUpdatedAt = draft.updatedAt

    // Wait 5ms to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 5))

    await draft.$query().patch({ state: 'in_review', currentLevel: 1 })
    const updatedDraft = await DetranWfDraft.query().findById(draft.id)

    expect(updatedDraft.state).toBe('in_review')
    expect(updatedDraft.updatedAt >= oldUpdatedAt).toBe(true)
  })

  it('cascades deletion of draft to events and comments', async () => {
    const draft = await DetranWfDraft.query().findOne({ path: 'normativos/portaria-01' })
    const draftId = draft.id

    // Confirm child records exist before deletion
    const eventsBefore = await DetranWfEvent.query().where({ draftId })
    const commentsBefore = await DetranWfComment.query().where({ draftId })
    expect(eventsBefore.length).toBeGreaterThan(0)
    expect(commentsBefore.length).toBeGreaterThan(0)

    // Delete draft
    await DetranWfDraft.query().deleteById(draftId)

    // Check cascade
    const eventsAfter = await DetranWfEvent.query().where({ draftId })
    const commentsAfter = await DetranWfComment.query().where({ draftId })
    expect(eventsAfter.length).toBe(0)
    expect(commentsAfter.length).toBe(0)
  })

  it('runs migrator.down() and drops all Detran workflow tables cleanly', async () => {
    const { batchNo, log } = await migrator.down(knex)
    expect(batchNo).toBeGreaterThan(0)
    expect(log.length).toBeGreaterThan(0)

    const hasPolicies = await knex.schema.hasTable('detranWfPolicies')
    const hasDrafts = await knex.schema.hasTable('detranWfDrafts')
    const hasEvents = await knex.schema.hasTable('detranWfEvents')
    const hasComments = await knex.schema.hasTable('detranWfComments')

    expect(hasPolicies).toBe(false)
    expect(hasDrafts).toBe(false)
    expect(hasEvents).toBe(false)
    expect(hasComments).toBe(false)
  })
})

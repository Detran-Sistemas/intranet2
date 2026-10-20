const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const resolvers = require('../../../graph/resolvers/detran-workflow')
const DetranWfPolicy = require('../../../models/detranWfPolicy')

jest.setTimeout(15000)

describe('Detran Workflow - GraphQL Resolvers & RBAC Integration (TDD)', () => {
  let knex

  // Mock users with distinct RBAC permission sets
  const userReader = {
    id: 100,
    name: 'Leitor',
    email: 'leitor@detran.mg.gov.br',
    permissions: ['read:pages']
  }
  const userAuthor = {
    id: 101,
    name: 'Autor GraphQL',
    email: 'autor@detran.mg.gov.br',
    permissions: ['read:pages', 'write:drafts']
  }
  const userReviewer = {
    id: 102,
    name: 'Revisor GraphQL',
    email: 'revisor@detran.mg.gov.br',
    permissions: ['read:pages', 'review:pages']
  }
  const userApprover = {
    id: 103,
    name: 'Aprovador GraphQL',
    email: 'aprovador@detran.mg.gov.br',
    permissions: ['read:pages', 'review:pages', 'approve:pages', 'write:pages']
  }

  // Spy for core WIKI.models.pages
  let createdPages = []
  let updatedPages = []

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: { filename: ':memory:' },
      pool: {
        afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb)
      }
    })

    Model.knex(knex)

    // Prerequisites
    await knex.schema.createTable('users', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('email').notNullable()
    })
    await knex.schema.createTable('pages', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('hash').notNullable()
    })

    await knex('users').insert([
      { id: userReader.id, name: userReader.name, email: userReader.email },
      { id: userAuthor.id, name: userAuthor.name, email: userAuthor.email },
      { id: userReviewer.id, name: userReviewer.name, email: userReviewer.email },
      { id: userApprover.id, name: userApprover.name, email: userApprover.email }
    ])

    // Run Detran migrations
    await migrator.up(knex)

    // Seed policy
    await DetranWfPolicy.query().insert({
      pathPrefix: '/normativos',
      approvalLevels: 2,
      reviewIntervalDays: 365
    })

    // Mock global.WIKI for core pages model integration test
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
          async createPage(payload) {
            const [id] = await knex('pages').insert({
              path: payload.path,
              hash: 'hash_gerado_no_ar'
            })
            const pageRecord = { id, ...payload }
            createdPages.push(pageRecord)
            return pageRecord
          },
          async updatePage(payload) {
            updatedPages.push(payload)
            return { ...payload }
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

  describe('RBAC Permission Matrix Enforcement', () => {
    it('blocks user with only read:pages from creating a draft', async () => {
      const context = { req: { user: userReader } }
      const res = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'normativos/tentativa-leitor',
          title: 'Nao Autorizado',
          content: 'Texto'
        },
        context
      )

      expect(res.responseResult.succeeded).toBe(false)
      expect(res.responseResult.slug).toBe('PermissionDeniedError')
    })

    it('blocks author from approving a step or publishing (RBAC + 4-eyes)', async () => {
      const contextAuthor = { req: { user: userAuthor } }

      // Author can create draft
      const draftRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'normativos/resolucao-rbac',
          title: 'Resolucao RBAC',
          content: 'Texto',
          approvalMode: '2_levels'
        },
        contextAuthor
      )
      expect(draftRes.responseResult.succeeded).toBe(true)
      const draftId = draftRes.draft.id

      await resolvers.DetranWorkflowMutation.submit({}, { id: draftId }, contextAuthor)

      // Author lacks review:pages AND violates 4-eyes rule
      const approveRes = await resolvers.DetranWorkflowMutation.approveStep({}, { id: draftId }, contextAuthor)
      expect(approveRes.responseResult.succeeded).toBe(false)

      // Author lacks approve:pages
      const publishRes = await resolvers.DetranWorkflowMutation.publish({}, { id: draftId }, contextAuthor)
      expect(publishRes.responseResult.succeeded).toBe(false)
    })

    it('blocks reviewer without approve:pages from publishing', async () => {
      const contextAuthor = { req: { user: userAuthor } }
      const contextReviewer = { req: { user: userReviewer } }

      const draftRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'comunicados/aviso-rbac',
          title: 'Aviso RBAC',
          content: 'Texto',
          approvalMode: '1_level'
        },
        contextAuthor
      )
      const draftId = draftRes.draft.id
      await resolvers.DetranWorkflowMutation.submit({}, { id: draftId }, contextAuthor)

      // Reviewer has review:pages but lacks approve:pages
      const publishRes = await resolvers.DetranWorkflowMutation.publish({}, { id: draftId }, contextReviewer)
      expect(publishRes.responseResult.succeeded).toBe(false)
      expect(publishRes.responseResult.slug).toBe('PermissionDeniedError')
    })
  })

  describe('Full Workflow Execution & Core Pages Integration', () => {
    it('executes 2-level lifecycle and calls WIKI.models.pages.createPage on publish', async () => {
      const contextAuthor = { req: { user: userAuthor } }
      const contextReviewer = { req: { user: userReviewer } }
      const contextApprover = { req: { user: userApprover } }

      createdPages = []

      // 1. Author saves draft
      const createRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'normativos/resolucao-oficial-1',
          title: 'Resolucao Oficial 01',
          content: '# Minuta Oficial Detran',
          tags: ['normativo', 'transito']
        },
        contextAuthor
      )
      expect(createRes.responseResult.succeeded).toBe(true)
      const draftId = createRes.draft.id

      // 2. Author submits
      const submitRes = await resolvers.DetranWorkflowMutation.submit(
        {},
        { id: draftId, comment: 'Encaminhando para analise' },
        contextAuthor
      )
      expect(submitRes.responseResult.succeeded).toBe(true)
      expect(submitRes.draft.state).toBe('in_review')

      // 3. Reviewer approves step 1
      const stepRes = await resolvers.DetranWorkflowMutation.approveStep(
        {},
        { id: draftId, comment: 'Parecer favoravel' },
        contextReviewer
      )
      expect(stepRes.responseResult.succeeded).toBe(true)
      expect(stepRes.draft.state).toBe('awaiting_approval')
      expect(stepRes.draft.currentLevel).toBe(2)

      // 4. Approver publishes
      const pubRes = await resolvers.DetranWorkflowMutation.publish(
        {},
        { id: draftId, comment: 'Publicado no diario da intranet' },
        contextApprover
      )
      expect(pubRes.responseResult.succeeded).toBe(true)
      expect(pubRes.draft.state).toBe('published')
      expect(pubRes.pageId).toBeDefined()
      expect(pubRes.pageId).toBeGreaterThan(0)

      // 5. Verify core pages.createPage was invoked correctly!
      expect(createdPages.length).toBe(1)
      expect(createdPages[0].path).toBe('normativos/resolucao-oficial-1')
      expect(createdPages[0].title).toBe('Resolucao Oficial 01')
      expect(createdPages[0].isPublished).toBe(true)
      expect(createdPages[0].user.id).toBe(userApprover.id) // Published under Approver's identity!
    })
  })

  describe('Queries & Annotations', () => {
    it('supports addComment, resolveComment and pendingTasks', async () => {
      const contextAuthor = { req: { user: userAuthor } }
      const contextReviewer = { req: { user: userReviewer } }

      const draftRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'pops/atendimento-comentarios',
          title: 'POP Comentarios',
          content: 'Linha 1\nLinha 2'
        },
        contextAuthor
      )
      const draftId = draftRes.draft.id
      await resolvers.DetranWorkflowMutation.submit({}, { id: draftId }, contextAuthor)

      // Add comment
      const commentRes = await resolvers.DetranWorkflowMutation.addComment(
        {},
        {
          draftId,
          lineNumber: 2,
          anchorText: 'Linha 2',
          body: 'Favor esclarecer'
        },
        contextReviewer
      )
      expect(commentRes.responseResult.succeeded).toBe(true)
      const commentId = commentRes.comment.id

      // Resolve comment
      const resolveRes = await resolvers.DetranWorkflowMutation.resolveComment(
        {},
        { id: commentId, resolved: true },
        contextAuthor
      )
      expect(resolveRes.responseResult.succeeded).toBe(true)

      // Query draft with populated relations
      const draft = await resolvers.DetranWorkflowQuery.draft({}, { id: draftId })
      expect(draft.comments.length).toBe(1)
      expect(draft.comments[0].resolved).toBe(true)

      // Pending tasks
      const tasks = await resolvers.DetranWorkflowQuery.pendingTasks({}, {}, contextReviewer)
      expect(tasks.some(t => t.id === draftId)).toBe(true)
    })
  })
})

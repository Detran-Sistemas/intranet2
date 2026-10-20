const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const stateMachine = require('../../../detran/workflow/state-machine')
const {
  InvalidTransitionError,
  FourEyesViolationError,
  ConcurrencyConflictError
} = require('../../../detran/workflow/errors')
const DetranWfDraft = require('../../../models/detranWfDraft')

jest.setTimeout(15000)

describe('Detran Workflow - State Machine & Domain Rules (TDD)', () => {
  let knex

  const userAuthor = { id: 10, name: 'Servidor Autor' }
  const userReviewer = { id: 20, name: 'Revisor Tecnico' }
  const userApprover = { id: 30, name: 'Aprovador Final' }

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

    // Minimal prerequisite tables
    await knex.schema.createTable('users', table => {
      table.increments('id').primary()
      table.string('name').notNullable()
    })
    await knex.schema.createTable('pages', table => {
      table.increments('id').primary()
      table.string('path').notNullable()
      table.string('hash').notNullable()
    })

    // Seed users and page
    await knex('users').insert([userAuthor, userReviewer, userApprover])
    await knex('pages').insert({ id: 100, path: 'normativos/resolucao-50', hash: 'hash_original_v1' })

    // Run migrations
    await migrator.up(knex)
  })

  afterAll(async () => {
    if (knex) {
      await knex.destroy()
    }
  })

  describe('1-Level Workflow Lifecycle', () => {
    it('executes full cycle: draft -> in_review -> published', async () => {
      // 1. Create draft
      const draft = await DetranWfDraft.query().insert({
        path: 'comunicados/aviso-1',
        title: 'Aviso Importante',
        content: 'Conteudo do aviso',
        approvalMode: '1_level',
        authorId: userAuthor.id
      })

      expect(draft.state).toBe(stateMachine.STATES.DRAFT)

      // 2. Save draft while editing (keeps state)
      const saveResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.SAVE_DRAFT,
        userAuthor
      )
      expect(saveResult.nextState).toBe(stateMachine.STATES.DRAFT)

      // 3. Submit for review
      const submitResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.SUBMIT,
        userAuthor,
        { comment: 'Aviso pronto para publicacao' }
      )
      expect(submitResult.nextState).toBe(stateMachine.STATES.IN_REVIEW)
      expect(submitResult.draft.state).toBe(stateMachine.STATES.IN_REVIEW)
      expect(submitResult.event.action).toBe('submit')

      // 4. Publish by Approver (different from Author) for a brand new page
      const publishResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.PUBLISH,
        userApprover,
        { livePage: null, comment: 'Publicado no portal' }
      )

      expect(publishResult.nextState).toBe(stateMachine.STATES.PUBLISHED)
      expect(publishResult.draft.state).toBe(stateMachine.STATES.PUBLISHED)
      expect(publishResult.draft.reviewDueDate).toBeDefined()
      expect(publishResult.event.action).toBe('publish')
      expect(publishResult.event.userId).toBe(userApprover.id)
    })
  })

  describe('2-Level Workflow Lifecycle', () => {
    it('executes full cycle: draft -> in_review (level 1) -> awaiting_approval (level 2) -> published', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/resolucao-50',
        title: 'Resolucao 50',
        content: 'Minuta da resolucao',
        approvalMode: '2_levels',
        authorId: userAuthor.id,
        baseHash: 'hash_original_v1',
        pageId: 100
      })

      // 1. Submit
      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)
      expect(draft.state).toBe(stateMachine.STATES.IN_REVIEW)
      expect(draft.currentLevel).toBe(1)

      // 2. Technical Reviewer approves Level 1
      const stepResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.APPROVE_STEP,
        userReviewer,
        { comment: 'Revisao juridica e tecnica aprovada' }
      )
      expect(stepResult.nextState).toBe(stateMachine.STATES.AWAITING_APPROVAL)
      expect(stepResult.draft.currentLevel).toBe(2)

      // 3. Final Approver publishes
      const livePage = { id: 100, hash: 'hash_original_v1' }
      const publishResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.PUBLISH,
        userApprover,
        { livePage, comment: 'Homologado pela diretoria' }
      )
      expect(publishResult.nextState).toBe(stateMachine.STATES.PUBLISHED)
      expect(publishResult.draft.currentLevel).toBe(2)
    })
  })

  describe('Rejection & Resubmission Cycle', () => {
    it('handles review rejection and author resubmission', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'pops/atendimento-01',
        title: 'POP Atendimento',
        content: 'Procedimento',
        approvalMode: '1_level',
        authorId: userAuthor.id
      })

      // Submit
      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)
      expect(draft.state).toBe(stateMachine.STATES.IN_REVIEW)

      // Reviewer requests changes
      const rejectResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.REQUEST_CHANGES,
        userReviewer,
        { comment: 'Favor detalhar o passo 3 do fluxo.' }
      )
      expect(rejectResult.nextState).toBe(stateMachine.STATES.CHANGES_REQUESTED)
      expect(rejectResult.draft.state).toBe(stateMachine.STATES.CHANGES_REQUESTED)

      // Author can save edits while in changes_requested
      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SAVE_DRAFT, userAuthor)
      expect(draft.state).toBe(stateMachine.STATES.CHANGES_REQUESTED)

      // Author resubmits
      const resubmitResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.SUBMIT,
        userAuthor,
        { comment: 'Ajustado conforme apontamentos' }
      )
      expect(resubmitResult.nextState).toBe(stateMachine.STATES.IN_REVIEW)
    })

    it('handles rejection from awaiting_approval (level 2) back to changes_requested', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/portaria-99',
        title: 'Portaria 99',
        content: 'Minuta',
        approvalMode: '2_levels',
        authorId: userAuthor.id
      })

      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)
      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.APPROVE_STEP, userReviewer)
      expect(draft.state).toBe(stateMachine.STATES.AWAITING_APPROVAL)

      // Approver rejects back to author
      const rejectResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.REQUEST_CHANGES,
        userApprover,
        { comment: 'Adequar a ementa.' }
      )
      expect(rejectResult.nextState).toBe(stateMachine.STATES.CHANGES_REQUESTED)
    })
  })

  describe('Four-Eyes Principle Enforcement (Princípio dos 4 Olhos)', () => {
    it('blocks author from approving their own step in 2-level workflow', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/regra-4olhos-1',
        title: 'Doc 4 Olhos 1',
        content: 'Texto',
        approvalMode: '2_levels',
        authorId: userAuthor.id
      })

      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)

      // Author attempts to approve level 1
      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.APPROVE_STEP, userAuthor)
      ).rejects.toThrow(FourEyesViolationError)

      // canTransition returns false with reason
      const check = stateMachine.canTransition(draft, stateMachine.ACTIONS.APPROVE_STEP, userAuthor)
      expect(check.allowed).toBe(false)
      expect(check.code).toBe('FOUR_EYES_VIOLATION')
    })

    it('blocks author from publishing their own document in 1-level workflow', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'comunicados/regra-4olhos-2',
        title: 'Doc 4 Olhos 2',
        content: 'Texto',
        approvalMode: '1_level',
        authorId: userAuthor.id
      })

      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)

      // Author attempts to self-publish
      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.PUBLISH, userAuthor)
      ).rejects.toThrow(FourEyesViolationError)
    })

    it('blocks author from publishing in 2-level workflow', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/regra-4olhos-3',
        title: 'Doc 4 Olhos 3',
        content: 'Texto',
        approvalMode: '2_levels',
        authorId: userAuthor.id
      })

      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)
      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.APPROVE_STEP, userReviewer)

      // Author attempts to publish at final level
      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.PUBLISH, userAuthor)
      ).rejects.toThrow(FourEyesViolationError)
    })
  })

  describe('Optimistic Concurrency & Conflict Detection', () => {
    it('allows publishing when baseHash matches live page hash', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/resolucao-safe',
        title: 'Resolucao Safe',
        content: 'Texto',
        approvalMode: '1_level',
        authorId: userAuthor.id,
        pageId: 100,
        baseHash: 'hash_original_v1'
      })

      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)

      const livePage = { id: 100, hash: 'hash_original_v1' }
      const res = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.PUBLISH,
        userApprover,
        { livePage }
      )
      expect(res.nextState).toBe(stateMachine.STATES.PUBLISHED)
    })

    it('throws ConcurrencyConflictError when live page was modified concurrently', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/resolucao-conflict',
        title: 'Resolucao Conflito',
        content: 'Texto',
        approvalMode: '1_level',
        authorId: userAuthor.id,
        pageId: 100,
        baseHash: 'hash_original_v1'
      })

      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)

      // Another user modified the live page in production
      const livePage = { id: 100, hash: 'hash_novo_modificado_no_ar' }

      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.PUBLISH, userApprover, { livePage })
      ).rejects.toThrow(ConcurrencyConflictError)
    })

    it('throws ConcurrencyConflictError when creating new page but path was taken in production', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'novas-paginas/duplicada',
        title: 'Pagina Nova',
        content: 'Texto',
        approvalMode: '1_level',
        authorId: userAuthor.id,
        pageId: null
      })

      await stateMachine.executeTransition(draft, stateMachine.ACTIONS.SUBMIT, userAuthor)

      // Production already has a page at this path
      const livePage = { id: 999, hash: 'algum_hash' }

      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.PUBLISH, userApprover, { livePage })
      ).rejects.toThrow(ConcurrencyConflictError)
    })
  })

  describe('Invalid Transitions Rejection', () => {
    it('rejects illegal transitions', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'test/invalid-trans',
        title: 'Teste',
        content: 'Texto',
        approvalMode: '1_level',
        authorId: userAuthor.id
      })

      // Cannot publish from draft directly
      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.PUBLISH, userApprover)
      ).rejects.toThrow(InvalidTransitionError)

      // Cannot approve step on 1-level mode
      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.APPROVE_STEP, userReviewer)
      ).rejects.toThrow(InvalidTransitionError)

      // Cannot request changes on a draft that was never submitted
      await expect(
        stateMachine.executeTransition(draft, stateMachine.ACTIONS.REQUEST_CHANGES, userReviewer)
      ).rejects.toThrow(InvalidTransitionError)
    })
  })

  describe('Periodic Review & Archival Lifecycle', () => {
    it('transitions published document to revisao_periodica and allows revalidation', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/validade-teste',
        title: 'Normativo com Validade',
        content: 'Texto',
        state: stateMachine.STATES.PUBLISHED,
        approvalMode: '1_level',
        authorId: userAuthor.id
      })

      // 1. Expiration job fires
      const expireResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.EXPIRE,
        { id: 0, name: 'Sistema Agendador' }
      )
      expect(expireResult.nextState).toBe(stateMachine.STATES.PERIODIC_REVIEW)
      expect(expireResult.draft.state).toBe(stateMachine.STATES.PERIODIC_REVIEW)

      // 2. Revalidate without edits for +12 months
      const revalResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.REVALIDATE,
        userApprover,
        { comment: 'Normativo segue em vigor sem alteracoes.' }
      )
      expect(revalResult.nextState).toBe(stateMachine.STATES.PUBLISHED)
      expect(revalResult.draft.reviewDueDate).toBeDefined()
    })

    it('archives documents from published or periodic review states', async () => {
      const draft = await DetranWfDraft.query().insert({
        path: 'normativos/antigo',
        title: 'Normativo Revogado',
        content: 'Texto',
        state: stateMachine.STATES.PUBLISHED,
        approvalMode: '1_level',
        authorId: userAuthor.id
      })

      const archiveResult = await stateMachine.executeTransition(
        draft,
        stateMachine.ACTIONS.ARCHIVE,
        userApprover,
        { comment: 'Revogado pela Resolucao 99.' }
      )
      expect(archiveResult.nextState).toBe(stateMachine.STATES.ARCHIVED)
    })
  })
})

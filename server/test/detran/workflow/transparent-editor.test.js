const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const resolvers = require('../../../graph/resolvers/detran-workflow')
const DetranWfPolicy = require('../../../models/detranWfPolicy')
const DetranWfDraft = require('../../../models/detranWfDraft')
const DetranWfEvent = require('../../../models/detranWfEvent')
const {
  parseMarkdown,
  serializeBlocks,
  slugify
} = require('../../../../client/themes/default/components/transparent-editor/utils/markdown-blocks')
const {
  loadTransparentPageSource,
  saveTransparentDraft,
  computeSearchCollapseOnScroll
} = require('../../../../client/themes/default/components/transparent-editor/utils/editor-controller')

jest.setTimeout(15000)

describe('Detran Intranet - Edição Transparente & Workflow Integration', () => {
  let knex

  const userAuthor = {
    id: 301,
    name: 'Cézar Augusto (Detran-MG)',
    email: 'cezar.azevedo@detran.mg.gov.br',
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
          query () {
            return {
              findById (id) {
                return knex('users').where({ id }).first()
              }
            }
          }
        },
        pages: {
          query () {
            const q = knex('pages')
            q.findById = id => knex('pages').where({ id }).first()
            return q
          }
        }
      },
      events: {
        outbound: {
          emit: jest.fn()
        }
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    }
  })

  afterAll(async () => {
    await knex.destroy()
  })

  beforeEach(async () => {
    await knex('detranWfEvents').del()
    await knex('detranWfDrafts').del()
    await knex('detranWfPolicies').del()
    await knex('pages').del()
  })

  test('1. Parsers transparent editor blocks and generates reactive ToC slugs', () => {
    const rawMarkdown = [
      '# Home da Intranet Detran-MG',
      '> Bem-vindo(a) à Intranet do Detran-MG\n{.is-success}',
      'A Intranet é o ambiente oficial de gestão do conhecimento.',
      '> Nota institucional importante.\n{.is-info}',
      '## O que você encontrará aqui? {#sec-encontrara}',
      '- [Procedimentos operacionais *Manuais*](/procedimentos)\n- [Normativos internos](/normativos)\n{.links-list}'
    ].join('\n\n')

    const blocks = parseMarkdown(rawMarkdown)
    expect(blocks.length).toBe(6)

    // Check heading
    const h2 = blocks.find(b => b.type === 'heading' && b.level === 2)
    expect(h2).toBeDefined()
    expect(h2.text).toBe('O que você encontrará aqui?')
    expect(h2.anchor).toBe('sec-encontrara')

    // Check ToC slugification
    const generatedSlug = slugify(h2.text)
    expect(generatedSlug).toBe('o-que-voce-encontrara-aqui')

    // Check callouts
    const calloutSuccess = blocks.find(b => b.type === 'callout' && b.variant === 'success')
    expect(calloutSuccess).toBeDefined()
    expect(calloutSuccess.text).toContain('Bem-vindo(a)')

    const calloutInfo = blocks.find(b => b.type === 'callout' && b.variant === 'info')
    expect(calloutInfo).toBeDefined()
    expect(calloutInfo.text).toContain('Nota institucional')

    // Check links cards
    const linksBlock = blocks.find(b => b.type === 'links')
    expect(linksBlock).toBeDefined()
    expect(linksBlock.items.length).toBe(2)
    expect(linksBlock.items[0].title).toBe('Procedimentos operacionais')
  })

  test('2. Modifying blocks in transparent editor serializes cleanly back to Markdown', () => {
    const blocks = [
      { type: 'paragraph', text: 'Primeiro parágrafo editado inline.' },
      { type: 'heading', level: 2, text: 'Nova Seção Operacional', anchor: slugify('Nova Seção Operacional') },
      { type: 'callout', variant: 'success', text: 'Destaque institucional verde.' }
    ]

    const serialized = serializeBlocks(blocks)
    expect(serialized).toContain('Primeiro parágrafo editado inline.')
    expect(serialized).toContain('## Nova Seção Operacional {#nova-secao-operacional}')
    expect(serialized).toContain('> Destaque institucional verde.\n{.is-success}')
  })

  test('3. Saves transparent editor modifications automatically as draft in detranWfDrafts', async () => {
    // Setup policy requiring approval
    await DetranWfPolicy.query().insert({
      pathPrefix: 'normativos',
      approvalLevels: 1,
      reviewIntervalDays: 365
    })

    const editedMarkdown = [
      '# Manual de Vistoria Veicular',
      '> Procedimento revisado em tempo real.\n{.is-success}',
      'Texto editado diretamente no modo transparente.'
    ].join('\n\n')

    // Call saveDraft resolver
    const saveResult = await resolvers.Mutation.workflowSaveDraft(
      null,
      {
        path: 'normativos/vistoria-veicular',
        locale: 'pt-br',
        title: 'Manual de Vistoria Veicular',
        description: 'Orientações aos postos',
        content: editedMarkdown,
        contentType: 'markdown',
        editorKey: 'markdown',
        tags: ['VISTORIA', 'VEICULOS']
      },
      { req: { user: userAuthor } }
    )

    expect(saveResult.responseResult.succeeded).toBe(true)
    expect(saveResult.draft).toBeDefined()
    expect(saveResult.draft.id).toBeGreaterThan(0)
    expect(saveResult.draft.state).toBe('draft')
    expect(saveResult.draft.content).toBe(editedMarkdown)

    // Verify stored in DB
    const draftInDb = await DetranWfDraft.query().findById(saveResult.draft.id)
    expect(draftInDb).toBeDefined()
    expect(draftInDb.path).toBe('normativos/vistoria-veicular')
    expect(draftInDb.content).toContain('Procedimento revisado em tempo real.')
  })

  test('4. Submits draft from validation modal, updating state to in_review with comments', async () => {
    // Create existing draft
    const draft = await DetranWfDraft.query().insert({
      path: 'procedimentos/habilitacao-cnh',
      locale: 'pt-br',
      title: 'Procedimentos CNH',
      content: 'Conteúdo atualizado via Edição Transparente',
      contentType: 'markdown',
      editorKey: 'markdown',
      state: 'draft',
      authorId: userAuthor.id,
      approvalMode: '1_level',
      currentLevel: 1
    })

    // Submit for review with comment from modal
    const submitResult = await resolvers.Mutation.workflowSubmit(
      null,
      {
        id: draft.id,
        comment: 'Atualização rápida dos requisitos de exame médico na CNH'
      },
      { req: { user: userAuthor } }
    )

    expect(submitResult.responseResult.succeeded).toBe(true)
    expect(submitResult.draft.state).toBe('in_review')

    // Verify event recorded
    const events = await DetranWfEvent.query().where({ draftId: draft.id })
    expect(events.length).toBe(1)
    expect(events[0].action).toBe('submit')
    expect(events[0].comment).toBe('Atualização rápida dos requisitos de exame médico na CNH')
    expect(events[0].userId).toBe(userAuthor.id)
  })

  test('5. Supports nested DetranWorkflowMutation.saveDraft and DetranWorkflowMutation.submit GraphQL resolvers', async () => {
    const saved = await resolvers.DetranWorkflowMutation.saveDraft(
      {},
      {
        path: 'normativos/alias-test',
        locale: 'pt-br',
        title: 'Alias Test',
        content: 'Conteúdo via alias aninhado',
        contentType: 'markdown',
        editorKey: 'markdown'
      },
      { req: { user: userAuthor } }
    )
    expect(saved.responseResult.succeeded).toBe(true)

    const submitted = await resolvers.DetranWorkflowMutation.submit(
      {},
      {
        id: saved.draft.id,
        comment: 'Submetido via alias DetranWorkflowMutation.submit'
      },
      { req: { user: userAuthor } }
    )
    expect(submitted.responseResult.succeeded).toBe(true)
    expect(submitted.draft.state).toBe('in_review')
  })

  test('6. Blocks author inline mutation while in_review and supports retract -> edit -> resubmit', async () => {
    const draft = await DetranWfDraft.query().insert({
      path: 'guia/markdown-styles',
      locale: 'pt-br',
      title: 'Guia de Estilos Markdown',
      content: 'Conteúdo inicial em revisão',
      contentType: 'markdown',
      editorKey: 'markdown',
      state: 'in_review',
      authorId: userAuthor.id,
      approvalMode: '1_level',
      currentLevel: 1
    })

    // Author cannot save edits directly while submitted in_review
    const blockedSave = await resolvers.Mutation.workflowSaveDraft(
      null,
      {
        id: draft.id,
        path: draft.path,
        locale: draft.locale,
        title: draft.title,
        content: 'Tentativa sem retratar'
      },
      { req: { user: userAuthor } }
    )
    expect(blockedSave.responseResult.succeeded).toBe(false)
    expect(blockedSave.responseResult.slug).toBe('PermissionDeniedError')

    // Double submit while in_review is rejected
    const blockedSubmit = await resolvers.Mutation.workflowSubmit(
      null,
      {
        id: draft.id,
        comment: 'Reenvio direto bloqueado'
      },
      { req: { user: userAuthor } }
    )
    expect(blockedSubmit.responseResult.succeeded).toBe(false)
    expect(blockedSubmit.responseResult.slug).toBe('InvalidTransitionError')

    // Author retracts back to draft
    const retracted = await resolvers.Mutation.workflowRetract(
      null,
      {
        id: draft.id,
        comment: 'Puxando para ajuste antes da revisão'
      },
      { req: { user: userAuthor } }
    )
    expect(retracted.responseResult.succeeded).toBe(true)
    expect(retracted.draft.state).toBe('draft')

    // Now author can edit and resubmit
    const updated = await resolvers.Mutation.workflowSaveDraft(
      null,
      {
        id: draft.id,
        path: draft.path,
        locale: draft.locale,
        title: draft.title,
        content: 'Conteúdo atualizado após retratação'
      },
      { req: { user: userAuthor } }
    )
    expect(updated.responseResult.succeeded).toBe(true)
    expect(updated.draft.content).toBe('Conteúdo atualizado após retratação')

    const resubmitted = await resolvers.Mutation.workflowSubmit(
      null,
      {
        id: draft.id,
        comment: 'Reenvio após ajuste'
      },
      { req: { user: userAuthor } }
    )
    expect(resubmitted.responseResult.succeeded).toBe(true)
    expect(resubmitted.draft.state).toBe('in_review')
  })

  test('7. End-to-End 2-Level Flow: inline edit -> saveDraft -> submit -> review comments -> approveStep -> publish updates live page', async () => {
    const userReviewer = {
      id: 302,
      name: 'Marina Revisora (Detran-MG)',
      email: 'marina.revisora@detran.mg.gov.br',
      permissions: ['read:pages', 'review:pages', 'write:pages']
    }
    const userApprover = {
      id: 303,
      name: 'Carlos Homologador (Detran-MG)',
      email: 'carlos.homologador@detran.mg.gov.br',
      permissions: ['read:pages', 'approve:pages', 'manage:pages']
    }

    // 1. Seed existing live page in Wiki.js
    await knex('pages').insert({
      id: 500,
      path: 'markdown',
      locale: 'pt-br',
      title: 'Guia de Estilos Markdown',
      content: 'Conteúdo original antes da edição transparente.',
      hash: 'hash_markdown_v1',
      updatedAt: '2026-10-20T10:00:00.000Z'
    })

    // Configure 2-level policy for 'markdown'
    await DetranWfPolicy.query().insert({
      pathPrefix: 'markdown',
      approvalLevels: 2,
      reviewIntervalDays: 365
    })

    // 2. Author edits inline and saves draft (even without passing pageId explicitly, resolver resolves livePage by path)
    const saveRes = await resolvers.Mutation.workflowSaveDraft(
      null,
      {
        path: 'markdown',
        locale: 'pt-br',
        title: 'Guia de Estilos Markdown',
        description: 'Referência visual do Design System',
        content: '# Guia Atualizado\n\nEste documento foi editado de forma **transparente** no portal.',
        tags: ['DESIGN-SYSTEM', 'MARKDOWN']
      },
      { req: { user: userAuthor } }
    )
    expect(saveRes.responseResult.succeeded).toBe(true)
    const draftId = saveRes.draft.id
    expect(saveRes.draft.pageId).toBe(500)

    // 3. Author submits from Validation Modal
    const submitRes = await resolvers.Mutation.workflowSubmit(
      null,
      {
        id: draftId,
        comment: 'Revisão tipográfica e blocos institucionais'
      },
      { req: { user: userAuthor } }
    )
    expect(submitRes.responseResult.succeeded).toBe(true)
    expect(submitRes.draft.state).toBe('in_review')

    // 4. Reviewer checks pendingTasks queue
    const pendingForReviewer = await resolvers.DetranWorkflowQuery.pendingTasks(
      {},
      {},
      { req: { user: userReviewer } }
    )
    expect(pendingForReviewer.some(d => d.id === draftId)).toBe(true)

    // 5. Reviewer adds a line comment and resolves it
    const commentRes = await resolvers.DetranWorkflowMutation.addComment(
      {},
      {
        draftId,
        lineNumber: 3,
        anchorText: 'Este documento foi editado',
        body: 'Excelente aderência ao protótipo!'
      },
      { req: { user: userReviewer } }
    )
    expect(commentRes.responseResult.succeeded).toBe(true)

    const resolveCommentRes = await resolvers.DetranWorkflowMutation.resolveComment(
      {},
      {
        id: commentRes.comment.id,
        resolved: true
      },
      { req: { user: userReviewer } }
    )
    expect(resolveCommentRes.succeeded).toBe(true)

    // 6. Reviewer approves Level 1 (Technical Review)
    const step1Res = await resolvers.DetranWorkflowMutation.approveStep(
      {},
      {
        id: draftId,
        comment: 'Aprovado tecnicamente no Nível 1.'
      },
      { req: { user: userReviewer } }
    )
    expect(step1Res.responseResult.succeeded).toBe(true)
    expect(step1Res.draft.state).toBe('awaiting_approval')
    expect(step1Res.draft.currentLevel).toBe(2)

    // 7. Final Approver publishes (Level 2 Homologation)
    const pubRes = await resolvers.DetranWorkflowMutation.publish(
      {},
      {
        id: draftId,
        comment: 'Homologado e publicado oficialmente.'
      },
      { req: { user: userApprover } }
    )
    expect(pubRes.responseResult.succeeded).toBe(true)
    expect(pubRes.draft.state).toBe('published')
    expect(pubRes.pageId).toBe(500)

    // 8. Verify live page in Wiki.js database was updated with the new content
    const updatedLivePage = await knex('pages').where({ id: 500 }).first()
    expect(updatedLivePage.content).toContain('Este documento foi editado de forma **transparente** no portal.')

    // 9. Verify draftByPath now returns null so next inline edit starts fresh from the published page
    const activeDraftAfterPublish = await resolvers.DetranWorkflowQuery.draftByPath(
      {},
      { path: 'markdown', locale: 'pt-br' }
    )
    expect(activeDraftAfterPublish).toBeNull()
  })

  test('8. End-to-End Single-Admin Flow: System Administrator (id=1) can edit, submit, see in pendingTasks, and publish end-to-end', async () => {
    const adminUser = {
      id: 1,
      name: 'Administrator',
      email: 'admin@detran.mg.gov.br',
      permissions: ['manage:system', 'write:pages', 'approve:pages']
    }

    await knex('pages').insert({
      id: 501,
      path: 'home',
      locale: 'pt-br',
      title: 'Home Intranet',
      content: 'Conteúdo original da Home.',
      hash: 'hash_home_v1',
      updatedAt: '2026-10-20T10:00:00.000Z'
    })

    // 1. Admin edits inline without draftId
    const saved1 = await resolvers.Mutation.workflowSaveDraft(
      null,
      {
        pageId: 501,
        path: 'home',
        locale: 'pt-br',
        title: 'Home Intranet',
        content: 'Conteúdo editado pelo Admin v1'
      },
      { req: { user: adminUser } }
    )
    expect(saved1.responseResult.succeeded).toBe(true)

    // 2. Admin edits again without passing id — automatically reuses the active draft for 'home'
    const saved2 = await resolvers.Mutation.workflowSaveDraft(
      null,
      {
        pageId: 501,
        path: 'home',
        locale: 'pt-br',
        title: 'Home Intranet',
        content: 'Conteúdo editado pelo Admin v2 final'
      },
      { req: { user: adminUser } }
    )
    expect(saved2.responseResult.succeeded).toBe(true)
    expect(saved2.draft.id).toBe(saved1.draft.id)

    // 3. Admin submits for validation
    const submitted = await resolvers.Mutation.workflowSubmit(
      null,
      {
        id: saved2.draft.id,
        comment: 'Envio pelo Administrador'
      },
      { req: { user: adminUser } }
    )
    expect(submitted.responseResult.succeeded).toBe(true)
    expect(submitted.draft.state).toBe('in_review')

    // 4. Admin sees task in pendingTasks (bell dropdown & /w dashboard)
    const tasks = await resolvers.DetranWorkflowQuery.pendingTasks(
      {},
      {},
      { req: { user: adminUser } }
    )
    expect(tasks.some(t => t.id === saved2.draft.id)).toBe(true)

    // 5. Admin publishes directly in 1-level workflow
    const published = await resolvers.DetranWorkflowMutation.publish(
      {},
      {
        id: saved2.draft.id,
        comment: 'Homologação direta pelo Administrador'
      },
      { req: { user: adminUser } }
    )
    expect(published.responseResult.succeeded).toBe(true)
    expect(published.draft.state).toBe('published')

    // 6. Live page content in database is updated
    const liveHome = await knex('pages').where({ id: 501 }).first()
    expect(liveHome.content).toBe('Conteúdo editado pelo Admin v2 final')
  })

  test('11. saveTransparentDraft e loadTransparentPageSource propagam status real do rascunho e erro quando bloqueado', async () => {
    const mockApolloReview = {
      query: async () => ({
        data: {
          workflow: {
            draftByPath: {
              id: 888,
              content: 'Em revisão',
              state: 'in_review'
            }
          }
        }
      }),
      mutate: async () => ({
        data: {
          workflow: {
            saveDraft: {
              responseResult: {
                succeeded: false,
                message: 'Rascunho já está em revisão. Utilize Puxar de Volta antes de editar.'
              },
              draft: null
            }
          }
        }
      })
    }

    const loaded = await loadTransparentPageSource({
      apollo: mockApolloReview,
      queryDraftAndPolicy: {},
      pageSingleQuery: {},
      path: 'norma-teste',
      locale: 'pt-br',
      pageId: 501
    })
    expect(loaded.draftId).toBe(888)
    expect(loaded.draftState).toBe('in_review')

    const failedSave = await saveTransparentDraft({
      apollo: mockApolloReview,
      mutationSaveDraft: {},
      activeDraftId: 888,
      markdown: 'Alteração bloqueada'
    })
    expect(failedSave.succeeded).toBe(false)
    expect(failedSave.message).toContain('revisão')
  })

  test('12. computeSearchCollapseOnScroll recolhe barra de pesquisa mesmo com incrementos suaves (1-4px) ao rolar para baixo e expande ao subir', () => {
    let state = { isCollapsed: false, lastScrollY: 0, downDistance: 0, upDistance: 0 }

    // Simula scroll suave em pequenos incrementos (3px por frame até 90px)
    for (let y = 3; y <= 90; y += 3) {
      state = computeSearchCollapseOnScroll({
        currentY: y,
        lastScrollY: state.lastScrollY,
        downDistance: state.downDistance,
        upDistance: state.upDistance,
        isCollapsed: state.isCollapsed,
        isFocused: false,
        hasQuery: false
      })
    }
    expect(state.isCollapsed).toBe(true)

    // Não altera se estiver com foco ou texto pesquisado
    const lockedByFocus = computeSearchCollapseOnScroll({
      currentY: 200,
      lastScrollY: 0,
      downDistance: 0,
      upDistance: 0,
      isCollapsed: false,
      isFocused: true,
      hasQuery: false
    })
    expect(lockedByFocus.isCollapsed).toBe(false)

    // Sobe suavemente 24px -> expande
    for (let y = 87; y >= 60; y -= 3) {
      state = computeSearchCollapseOnScroll({
        currentY: y,
        lastScrollY: state.lastScrollY,
        downDistance: state.downDistance,
        upDistance: state.upDistance,
        isCollapsed: state.isCollapsed,
        isFocused: false,
        hasQuery: false
      })
    }
    expect(state.isCollapsed).toBe(false)
  })
})

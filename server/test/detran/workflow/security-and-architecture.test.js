const Knex = require('knex')
const { Model } = require('objection')
const migrator = require('../../../detran/workflow/migrator')
const resolvers = require('../../../graph/resolvers/detran-workflow')
const DetranWfDraft = require('../../../models/detranWfDraft')
const DetranWfPolicy = require('../../../models/detranWfPolicy')
const {
  inlineMarkdownToHtml,
  decodeDiagramBase64Svg: editorDecodeSvg
} = require('../../../../client/themes/default/components/transparent-editor/utils/markdown-blocks')
const {
  renderInlineMarkdownToHtml,
  decodeDiagramBase64Svg: reviewDecodeSvg,
  renderCleanBlockToHtml,
  buildVisualDiffDocument
} = require('../../../../client/store/detran-workflow-review')
const uploadRouter = require('../../../controllers/upload')

jest.setTimeout(20000)

function findPostHandler(router, routePath) {
  const layer = router.stack.find(
    l => l.route && l.route.path === routePath && l.route.methods && l.route.methods.post
  )
  if (!layer) return null
  const stack = layer.route.stack.map(s => s.handle)
  return stack[stack.length - 1]
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    }
  }
  return res
}

describe('Revisão Contextual: Segurança, Clean Architecture, State Machine Estrita e N+1 (TDD)', () => {
  describe('1. Sanitização XSS & Unificação Markdown/SVG (Editor + Revisão)', () => {
    it('bloqueia esquemas perigosos (javascript:, vbscript:, data:) em links e imagens no editor e na revisão', () => {
      const maliciousMd = [
        'Clique [aqui](javascript:alert(document.cookie))',
        'Ou [vb](vbscript:msgbox(1))',
        'Ou [data](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
        'Imagem ![xss](javascript:alert(2))',
        'Seguro [Portal](https://intranet.detran.mg.gov.br/normas) e [Interno](/pt-br/guia)'
      ].join(' ')

      const editorHtml = inlineMarkdownToHtml(maliciousMd)
      const reviewHtml = renderInlineMarkdownToHtml(maliciousMd)

      for (const html of [editorHtml, reviewHtml]) {
        expect(html).not.toMatch(/href\s*=\s*["']\s*javascript:/i)
        expect(html).not.toMatch(/href\s*=\s*["']\s*vbscript:/i)
        expect(html).not.toMatch(/href\s*=\s*["']\s*data:/i)
        expect(html).not.toMatch(/src\s*=\s*["']\s*javascript:/i)
        expect(html).toContain('href="https://intranet.detran.mg.gov.br/normas"')
        expect(html).toContain('href="/pt-br/guia"')
      }
    })

    it('higieniza SVGs Base64 contra <script>, on*, <foreignObject>, <iframe> e xlink:href="javascript:..."', () => {
      const rawMaliciousSvg = [
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" onerror="alert(2)">',
        '<script>alert("xss")</script>',
        '<foreignObject><iframe src="javascript:alert(3)"></iframe></foreignObject>',
        '<a xlink:href="javascript:alert(4)" href="javascript:alert(5)"><text x="10" y="20">Nó Seguro</text></a>',
        '</svg>'
      ].join('')
      const b64 = Buffer.from(rawMaliciousSvg, 'utf8').toString('base64')

      const cleanEditorSvg = editorDecodeSvg(b64)
      const cleanReviewSvg = reviewDecodeSvg(b64)

      for (const svg of [cleanEditorSvg, cleanReviewSvg]) {
        expect(svg).toContain('<svg')
        expect(svg).toContain('Nó Seguro')
        expect(svg).not.toMatch(/<script/i)
        expect(svg).not.toMatch(/onload\s*=/i)
        expect(svg).not.toMatch(/onerror\s*=/i)
        expect(svg).not.toMatch(/<foreignObject/i)
        expect(svg).not.toMatch(/<iframe/i)
        expect(svg).not.toMatch(/javascript:/i)
      }
    })

    it('preserva pipes escapados (\\|) em tabelas na visualização limpa e no diff visual', () => {
      const tableMd = [
        '| Coluna A \\| B | Valor |',
        '| --- | --- |',
        '| Item 1 \\| 2 | 100 |'
      ].join('\n')

      const html = renderCleanBlockToHtml(tableMd)
      expect(html).toContain('Coluna A | B')
      expect(html).toContain('Item 1 | 2')

      const diffDoc = buildVisualDiffDocument({
        originalContent: tableMd,
        draftContent: tableMd
      })
      expect(diffDoc.html).toContain('Coluna A | B')
      expect(diffDoc.html).toContain('Item 1 | 2')
    })

    it('renderiza diagramas SVG (```diagram / drawio, inclusive quando precedidos por callouts ou >) e Mermaid na página de revisão', () => {
      const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="100" height="50" fill="#16a34a"/><foreignObject x="10" y="10" width="80" height="30"><div>Fluxo Detran</div></foreignObject></svg>'
      const b64Svg = Buffer.from(validSvg, 'utf8').toString('base64')

      const originalMd = [
        '<div class="is-success">',
        '<strong>Bloco Success:</strong> Sistema operando normalmente.',
        '</div>',
        '',
        '```diagram',
        b64Svg,
        '```',
        '',
        '```mermaid',
        'flowchart LR',
        '  A[Autor] --> B[Revisor]',
        '```'
      ].join('\n')

      // Simula rascunho onde callout foi serializado com > e o diagrama até recebeu prefixo > acidental
      const draftMd = [
        '> > **Bloco Success:** Sistema operando normalmente.',
        '> {.is-success}',
        '>',
        '> ```diagram',
        `> ${b64Svg}`,
        '> ```',
        '> {.is-success}',
        '',
        '```mermaid',
        'flowchart LR',
        '  A[Autor] --> B[Revisor]',
        '```'
      ].join('\n')

      const diffDoc = buildVisualDiffDocument({
        originalContent: originalMd,
        draftContent: draftMd
      })

      expect(diffDoc.html).toContain('<div class="detran-doc-diagram"><div class="diagram"><svg')
      expect(diffDoc.html).toContain('Fluxo Detran')
      expect(diffDoc.html).toContain('<div class="detran-doc-diagram detran-doc-mermaid"><div class="mermaid">')
      expect(diffDoc.html).not.toContain(b64Svg.slice(0, 30))
      expect(diffDoc.suggestions).toHaveLength(0)
    })
  })

  describe('2. Hardening do Endpoint POST /upload (Fail-Closed & Allowlist Raster)', () => {
    const uploadHandler = findPostHandler(uploadRouter, '/upload')
    let originalWiki

    beforeEach(() => {
      originalWiki = global.WIKI
      global.WIKI = {
        ROOTPATH: process.cwd(),
        config: {
          dataPath: './data',
          uploads: { maxFileSize: 5 * 1024 * 1024 }
        },
        models: {
          assets: {
            upload: jest.fn().mockResolvedValue(true)
          }
        },
        logger: { warn: jest.fn() }
      }
    })

    afterEach(() => {
      global.WIKI = originalWiki
    })

    it('rejeita requisição sem req.user (sem fallback para id: 1) e usuário Guest (id: 2)', async () => {
      const resNoUser = createMockRes()
      await uploadHandler({ body: {} }, resNoUser)
      expect(resNoUser.statusCode).toBe(403)
      expect(resNoUser.body.ok).toBe(false)

      const resGuest = createMockRes()
      await uploadHandler({ user: { id: 2, permissions: ['write:assets'] }, body: {} }, resGuest)
      expect(resGuest.statusCode).toBe(403)
      expect(resGuest.body.ok).toBe(false)
    })

    it('bloqueia upload de SVG em base64 dataUrl e extensões não-raster (.svg, .html) no multipart', async () => {
      const authUser = { id: 10, permissions: ['write:assets'] }
      const svgBase64 = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')

      const resSvgData = createMockRes()
      await uploadHandler(
        {
          user: authUser,
          body: { dataUrl: `data:image/svg+xml;base64,${svgBase64}`, filename: 'vetor.svg' }
        },
        resSvgData
      )
      expect(resSvgData.statusCode).toBe(400)
      expect(resSvgData.body.ok).toBe(false)

      const resHtmlMultipart = createMockRes()
      await uploadHandler(
        {
          user: authUser,
          files: [{ originalname: 'exploit.html', mimetype: 'text/html', size: 128, path: __filename }]
        },
        resHtmlMultipart
      )
      expect(resHtmlMultipart.statusCode).toBe(400)
      expect(resHtmlMultipart.body.ok).toBe(false)

      const resSvgMultipart = createMockRes()
      await uploadHandler(
        {
          user: authUser,
          files: [{ originalname: 'diagrama.svg', mimetype: 'image/svg+xml', size: 128, path: __filename }]
        },
        resSvgMultipart
      )
      expect(resSvgMultipart.statusCode).toBe(400)
      expect(resSvgMultipart.body.ok).toBe(false)
    })
  })

  describe('3. State Machine Estrita, Atomicidade SQL e Batching N+1 em SQLite Real', () => {
    let knex
    let findUserSpy
    let lastCreatePagePayload = null
    let lastUpdatePagePayload = null

    const userAdmin = { id: 1, name: 'Superadmin', email: 'admin@detran.mg.gov.br', permissions: ['manage:system'] }
    const userAuthor = { id: 101, name: 'Autor Original', email: 'autor@detran.mg.gov.br', permissions: ['read:pages', 'write:drafts'] }
    const userCoEditor = { id: 104, name: 'Co-Editor', email: 'coeditor@detran.mg.gov.br', permissions: ['read:pages', 'write:drafts'] }
    const userReviewer = { id: 102, name: 'Revisor Técnico', email: 'revisor@detran.mg.gov.br', permissions: ['read:pages', 'review:pages'] }
    const userApprover = { id: 103, name: 'Homologador', email: 'aprovador@detran.mg.gov.br', permissions: ['read:pages', 'review:pages', 'approve:pages'] }

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
        { id: userAdmin.id, name: userAdmin.name, email: userAdmin.email },
        { id: userAuthor.id, name: userAuthor.name, email: userAuthor.email },
        { id: userCoEditor.id, name: userCoEditor.name, email: userCoEditor.email },
        { id: userReviewer.id, name: userReviewer.name, email: userReviewer.email },
        { id: userApprover.id, name: userApprover.name, email: userApprover.email }
      ])

      await migrator.up(knex)

      await DetranWfPolicy.query().insert({
        pathPrefix: '/normativos',
        approvalLevels: 2,
        reviewIntervalDays: 365
      })

      findUserSpy = jest.fn(id => knex('users').where({ id }).first())

      global.WIKI = {
        models: {
          knex,
          users: {
            query() {
              const qb = knex('users')
              qb.findById = id => findUserSpy(id)
              return qb
            }
          },
          pages: {
            query() {
              return knex('pages')
            },
            async createPage(payload) {
              lastCreatePagePayload = payload
              if (payload.title === 'FORCAR_FALHA_PUBLICACAO') {
                throw new Error('Falha simulada ao gravar na tabela pages')
              }
              const [id] = await knex('pages').insert({
                path: payload.path,
                hash: 'hash_real_1'
              })
              return { id, ...payload }
            },
            async updatePage(payload) {
              lastUpdatePagePayload = payload
              if (payload.title === 'FORCAR_FALHA_PUBLICACAO') {
                throw new Error('Falha simulada ao atualizar tabela pages')
              }
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

    it('preserva authorId original quando um co-editor submete o rascunho e mantém trava de 4-Olhos para o autor original', async () => {
      const saveRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'normativos/preservar-autor',
          title: 'Normativo Autoria Imutável',
          content: 'Texto base',
          approvalMode: '2_levels'
        },
        { req: { user: userAuthor } }
      )
      const draftId = saveRes.draft.id
      expect(saveRes.draft.authorId).toBe(userAuthor.id)

      // Co-editor submete o rascunho
      const submitRes = await resolvers.DetranWorkflowMutation.submit(
        {},
        { id: draftId, comment: 'Submetido pelo co-editor' },
        { req: { user: userCoEditor } }
      )
      expect(submitRes.responseResult.succeeded).toBe(true)
      expect(submitRes.draft.authorId).toBe(userAuthor.id)
    })

    it('bloqueia auto-avanço de rascunho não submetido por Revisor/Aprovador e exige Nível 1 antes de publish em 2_levels (exceto Superadmin)', async () => {
      const saveRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'normativos/rigor-etapas',
          title: 'Normativo Rigor Etapas',
          content: 'Conteúdo em elaboração',
          approvalMode: '2_levels'
        },
        { req: { user: userAuthor } }
      )
      const draftId = saveRes.draft.id

      // 1. Revisor não pode solicitar ajustes nem aprovar rascunho que ainda está em 'draft'
      const prematureReqChanges = await resolvers.DetranWorkflowMutation.requestChanges(
        {},
        { id: draftId, comment: 'Ajustar antes de submeter' },
        { req: { user: userReviewer } }
      )
      expect(prematureReqChanges.responseResult.succeeded).toBe(false)
      expect(prematureReqChanges.responseResult.slug).toBe('InvalidTransitionError')

      const prematureApprove = await resolvers.DetranWorkflowMutation.approveStep(
        {},
        { id: draftId, comment: 'Aprovar antes de submeter' },
        { req: { user: userReviewer } }
      )
      expect(prematureApprove.responseResult.succeeded).toBe(false)
      expect(prematureApprove.responseResult.slug).toBe('InvalidTransitionError')

      // 2. Autor submete para in_review
      await resolvers.DetranWorkflowMutation.submit(
        {},
        { id: draftId, comment: 'Submetido pelo autor' },
        { req: { user: userAuthor } }
      )

      // 3. Aprovador comum NÃO pode pular o Nível 1 em 2_levels
      const skipLevel1Publish = await resolvers.DetranWorkflowMutation.publish(
        {},
        { id: draftId, comment: 'Tentativa de pular nível 1' },
        { req: { user: userApprover } }
      )
      expect(skipLevel1Publish.responseResult.succeeded).toBe(false)
      expect(skipLevel1Publish.responseResult.slug).toBe('InvalidTransitionError')

      // 4. Superadmin PODE forçar publicação direta a partir de in_review em 2_levels (com reatribuição correta no Objection)
      const superAdminPublish = await resolvers.DetranWorkflowMutation.publish(
        {},
        { id: draftId, comment: 'Homologação extraordinária pelo Superadmin' },
        { req: { user: userAdmin } }
      )
      expect(superAdminPublish.responseResult.succeeded).toBe(true)
      expect(superAdminPublish.draft.state).toBe('published')
    })

    it('reverte estado do rascunho (rollback transacional) se createPage/updatePage falhar durante publish', async () => {
      const saveRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'comunicados/teste-rollback',
          title: 'FORCAR_FALHA_PUBLICACAO',
          content: 'Conteúdo teste transação',
          approvalMode: '1_level'
        },
        { req: { user: userAuthor } }
      )
      const draftId = saveRes.draft.id

      await resolvers.DetranWorkflowMutation.submit(
        {},
        { id: draftId },
        { req: { user: userAuthor } }
      )

      const failedPub = await resolvers.DetranWorkflowMutation.publish(
        {},
        { id: draftId, comment: 'Tentando publicar' },
        { req: { user: userApprover } }
      )
      expect(failedPub.responseResult.succeeded).toBe(false)

      // No banco SQLite real, o rascunho deve permanecer 'in_review' (não pode ficar preso como 'published' sem página!)
      const dbDraft = await DetranWfDraft.query().findById(draftId)
      expect(dbDraft.state).toBe('in_review')
    })

    it('elimina N+1 queries em listagens (drafts / pendingTasks) usando carregamento em lote', async () => {
      for (let i = 1; i <= 6; i++) {
        await resolvers.DetranWorkflowMutation.saveDraft(
          {},
          {
            path: `comunicados/lote-${i}`,
            title: `Comunicado Lote ${i}`,
            content: `Texto ${i}`,
            approvalMode: '1_level'
          },
          { req: { user: userAuthor } }
        )
      }

      findUserSpy.mockClear()
      const list = await resolvers.DetranWorkflowQuery.drafts({}, { state: 'draft' }, { req: { user: userApprover } })
      expect(list.length).toBeGreaterThanOrEqual(6)
      expect(list[0].authorName).toBeDefined()
      // Com batching via WHERE IN, findById individual por rascunho não deve ser chamado N vezes
      expect(findUserSpy.mock.calls.length).toBeLessThanOrEqual(1)
    })

    it('permite que revisor/aprovador consulte rascunho com regras de página padrão do Wiki.js e garante acesso do autor', async () => {
      // Cria rascunho pelo autor
      const saveRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'normativos/resolucao-maria-eduarda',
          title: 'Resolução para Teste de Acesso',
          content: 'Conteúdo normativo',
          approvalMode: '2_levels'
        },
        { req: { user: userAuthor } }
      )
      const draftId = saveRes.draft.id

      // Simula WIKI.auth integrado com grupo que possui 'read:pages' nas regras de página
      global.WIKI.auth = {
        checkAccess: jest.fn((user, permissions, page) => {
          // Wiki.js core checkAccess: rule.roles tipicamente possui ['read:pages']
          const ruleRoles = ['read:pages']
          return permissions.some(p => ruleRoles.includes(p))
        })
      }

      // 1. Revisor terceiro (Maria Eduarda) consulta rascunho: deve ter sucesso
      const draftReviewer = await resolvers.DetranWorkflowQuery.draft(
        {},
        { id: draftId },
        { req: { user: userReviewer } }
      )
      expect(draftReviewer).not.toBeNull()
      expect(draftReviewer.id).toBe(draftId)

      // 2. Aprovador terceiro consulta rascunho: deve ter sucesso
      const draftApprover = await resolvers.DetranWorkflowQuery.draft(
        {},
        { id: draftId },
        { req: { user: userApprover } }
      )
      expect(draftApprover).not.toBeNull()
      expect(draftApprover.id).toBe(draftId)

      // 3. Autor consulta o próprio rascunho: deve ter acesso garantido
      const draftSelf = await resolvers.DetranWorkflowQuery.draft(
        {},
        { id: draftId },
        { req: { user: userAuthor } }
      )
      expect(draftSelf).not.toBeNull()
      expect(draftSelf.id).toBe(draftId)

      // 4. Usuário leitor comum (sem write:drafts, review:pages ou approve:pages): deve ser bloqueado
      const userPlainViewer = { id: 999, name: 'Leitor Comum', email: 'leitor@detran.mg.gov.br', permissions: ['read:pages'] }
      await expect(
        resolvers.DetranWorkflowQuery.draft(
          {},
          { id: draftId },
          { req: { user: userPlainViewer } }
        )
      ).rejects.toThrow('Permissão insuficiente para consultar este rascunho.')
    })

    it('permite que usuário aprovador publique rascunho com sucesso repassando skipAccessCheck e preservando autoria', async () => {
      // 1. Autor cria rascunho em 1_level
      const saveRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          path: 'comunicados/publicar-aprovador-teste',
          title: 'Comunicado para Teste de Publicação',
          content: 'Conteúdo final aprovado pelo autor',
          approvalMode: '1_level'
        },
        { req: { user: userAuthor } }
      )
      const draftId = saveRes.draft.id

      // 2. Autor submete
      await resolvers.DetranWorkflowMutation.submit(
        {},
        { id: draftId, comment: 'Pronto para publicação' },
        { req: { user: userAuthor } }
      )

      // 3. Aprovador (que possui approve:pages mas NÃO write:pages) publica
      lastCreatePagePayload = null
      const pubRes = await resolvers.DetranWorkflowMutation.publish(
        {},
        { id: draftId, comment: 'Publicado oficialmente pelo Diretor' },
        { req: { user: userApprover } }
      )
      expect(pubRes.responseResult.succeeded).toBe(true)
      expect(pubRes.draft.state).toBe('published')
      expect(lastCreatePagePayload).not.toBeNull()
      expect(lastCreatePagePayload.skipAccessCheck).toBe(true)
      expect(lastCreatePagePayload.authorId).toBe(userAuthor.id)

      // 4. Teste de atualização de página existente (updatePage)
      lastUpdatePagePayload = null
      const livePageId = 99
      await knex('pages').insert({ id: livePageId, path: 'comunicados/atualizar-existente', hash: 'hash_99' })
      const editDraftRes = await resolvers.DetranWorkflowMutation.saveDraft(
        {},
        {
          pageId: livePageId,
          path: 'comunicados/atualizar-existente',
          title: 'Comunicado Atualizado',
          content: 'Nova versão aprovada',
          approvalMode: '1_level'
        },
        { req: { user: userAuthor } }
      )
      expect(editDraftRes.responseResult.succeeded).toBe(true)
      await resolvers.DetranWorkflowMutation.submit(
        {},
        { id: editDraftRes.draft.id, comment: 'Atualização para aprovação' },
        { req: { user: userAuthor } }
      )
      const pubEditRes = await resolvers.DetranWorkflowMutation.publish(
        {},
        { id: editDraftRes.draft.id, comment: 'Atualização homologada' },
        { req: { user: userApprover } }
      )
      expect(pubEditRes.responseResult.succeeded).toBe(true)
      expect(lastUpdatePagePayload).not.toBeNull()
      expect(lastUpdatePagePayload.skipAccessCheck).toBe(true)
      expect(lastUpdatePagePayload.authorId).toBe(userAuthor.id)
    })

    it('PagesModel.updatePage e createPage honram skipAccessCheck e aceitam approve:pages / manage:pages', async () => {
      const PagesModel = require('../../../models/pages')
      const WIKI_ERROR = require('../../../helpers/error')
      global.WIKI.Error = WIKI_ERROR

      // Usuário com apenas approve:pages (sem write:pages)
      const userOnlyApprover = {
        id: 103,
        name: 'Aprovador Puro',
        permissions: ['approve:pages', 'read:pages'],
        getGlobalPermissions() { return this.permissions }
      }

      // Usuário leitor sem permissões de escrita/aprovação
      const userViewerOnly = {
        id: 999,
        name: 'Leitor Puro',
        permissions: ['read:pages'],
        getGlobalPermissions() { return this.permissions }
      }

      // Simula checkAccess padrão do Wiki.js
      global.WIKI.auth = {
        checkAccess(user, perms) {
          const userPerms = user.permissions || []
          return perms.some(p => userPerms.includes(p))
        }
      }

      // Teste 1: createPage com userViewerOnly e sem skipAccessCheck deve lançar PageDeleteForbidden
      await expect(
        PagesModel.createPage({
          user: userViewerOnly,
          locale: 'pt-br',
          path: 'teste/sem-permissao',
          skipAccessCheck: false
        })
      ).rejects.toThrow()

      // Teste 2: createPage com userOnlyApprover (possui approve:pages) passa da checagem de permissão
      try {
        await PagesModel.createPage({
          user: userOnlyApprover,
          locale: 'pt-br',
          path: 'teste/com-aprovador',
          content: '',
          skipAccessCheck: false
        })
      } catch (err) {
        expect(err.name).not.toBe('PAGE_DELETE_FORBIDDEN')
        expect(err.name).not.toBe('PageDeleteForbidden')
      }

      // Teste 3: createPage com skipAccessCheck: true passa direto mesmo para userViewerOnly
      try {
        await PagesModel.createPage({
          user: userViewerOnly,
          locale: 'pt-br',
          path: 'teste/com-skip',
          content: '',
          skipAccessCheck: true
        })
      } catch (err) {
        expect(err.name).not.toBe('PAGE_DELETE_FORBIDDEN')
        expect(err.name).not.toBe('PageDeleteForbidden')
      }
    })
  })
})

import {
  SLASH_MENU_ITEMS,
  DEFAULT_LINK_ITEMS,
  initEditorBlocks,
  updateBlockAt,
  insertBlockBelow,
  deleteBlockAt,
  applySlashCommandToBlock,
  insertMediaBlock,
  updateLinkCardItem,
  buildReactiveToc,
  buildEditorChangePayload,
  detectSlashTrigger,
  computeSlashMenuPosition,
  computeFloatingToolbarPosition,
  canInsertMedia,
  resolveMediaUpload,
  buildValidationPayload,
  filterNotificationTasks,
  loadTransparentPageSource,
  saveTransparentDraft,
  submitTransparentValidation
} from './editor-controller'

describe('transparent-editor/editor-controller', () => {
  it('exports SLASH_MENU_ITEMS and DEFAULT_LINK_ITEMS constants', () => {
    expect(Array.isArray(SLASH_MENU_ITEMS)).toBe(true)
    expect(SLASH_MENU_ITEMS.length).toBe(6)
    expect(Array.isArray(DEFAULT_LINK_ITEMS)).toBe(true)
    expect(DEFAULT_LINK_ITEMS.length).toBe(3)
  })

  describe('initEditorBlocks', () => {
    it('initializes blocks with sequential IDs from markdown', () => {
      const blocks = initEditorBlocks('## Título\n\nTexto inicial', 'test')
      expect(blocks).toEqual([
        { id: 'test-0', type: 'heading', level: 2, text: 'Título', anchor: null },
        { id: 'test-1', type: 'paragraph', text: 'Texto inicial' }
      ])
    })

    it('creates a default empty paragraph when markdown is empty', () => {
      const blocks = initEditorBlocks('')
      expect(blocks).toEqual([
        { id: 'blk-0', type: 'paragraph', text: '' }
      ])
      expect(initEditorBlocks()).toEqual([
        { id: 'blk-0', type: 'paragraph', text: '' }
      ])
    })
  })

  describe('updateBlockAt', () => {
    it('updates block at valid index preserving existing id', () => {
      const initial = [
        { id: 'blk-0', type: 'paragraph', text: 'Antigo' },
        { type: 'paragraph', text: 'Sem ID' }
      ]
      const updated0 = updateBlockAt(initial, 0, { type: 'paragraph', text: 'Novo' })
      expect(updated0[0]).toEqual({ id: 'blk-0', type: 'paragraph', text: 'Novo' })

      const updated1 = updateBlockAt(initial, 1, { type: 'paragraph', text: 'Com ID gerado' })
      expect(updated1[1]).toEqual({ id: 'blk-1', type: 'paragraph', text: 'Com ID gerado' })
    })

    it('returns shallow copy unchanged when index is out of bounds or updatedBlock is null', () => {
      const initial = [{ id: 'blk-0', type: 'paragraph', text: 'A' }]
      expect(updateBlockAt(initial, -1, { text: 'B' })).toEqual(initial)
      expect(updateBlockAt(initial, 5, { text: 'B' })).toEqual(initial)
      expect(updateBlockAt(initial, 0, null)).toEqual(initial)
      expect(updateBlockAt(undefined, 0, { text: 'B' })).toEqual([])
    })
  })

  describe('insertBlockBelow', () => {
    it('inserts a new paragraph block right below the specified index', () => {
      const initial = [
        { id: 'blk-0', type: 'paragraph', text: 'Um' },
        { id: 'blk-1', type: 'paragraph', text: 'Dois' }
      ]
      const res = insertBlockBelow(initial, 0, 'blk-custom')
      expect(res.insertedIndex).toBe(1)
      expect(res.insertedBlock).toEqual({ id: 'blk-custom', type: 'paragraph', text: '' })
      expect(res.blocks.length).toBe(3)
      expect(res.blocks[1].id).toBe('blk-custom')

      const resDefault = insertBlockBelow()
      expect(resDefault.blocks.length).toBe(1)
      expect(resDefault.insertedBlock.id).toBe('blk-new')
    })
  })

  describe('deleteBlockAt', () => {
    it('prevents deleting when there is only 1 block or invalid index', () => {
      const single = [{ id: 'blk-0', type: 'paragraph', text: 'Único' }]
      expect(deleteBlockAt(single, 0)).toEqual({
        blocks: single,
        deleted: false,
        focusIndex: 0
      })
      expect(deleteBlockAt(undefined, 0).deleted).toBe(false)
      const two = [
        { id: 'blk-0', type: 'paragraph', text: '1' },
        { id: 'blk-1', type: 'paragraph', text: '2' }
      ]
      expect(deleteBlockAt(two, -1).deleted).toBe(false)
      expect(deleteBlockAt(two, 5).deleted).toBe(false)
    })

    it('deletes block when length > 1 and returns previous focusIndex', () => {
      const list = [
        { id: 'blk-0', type: 'paragraph', text: '1' },
        { id: 'blk-1', type: 'paragraph', text: '2' }
      ]
      const res = deleteBlockAt(list, 1)
      expect(res.deleted).toBe(true)
      expect(res.focusIndex).toBe(0)
      expect(res.blocks).toEqual([{ id: 'blk-0', type: 'paragraph', text: '1' }])
    })
  })

  describe('applySlashCommandToBlock', () => {
    it('transforms block to callout-info, callout-success, heading, links, and paragraph', () => {
      const base = { id: 'blk-1', type: 'paragraph', text: 'Meu Título /' }

      expect(applySlashCommandToBlock(base, 'callout-info')).toEqual({
        id: 'blk-1',
        type: 'callout',
        variant: 'info',
        text: 'Meu Título'
      })

      expect(applySlashCommandToBlock(base, 'callout-success')).toEqual({
        id: 'blk-1',
        type: 'callout',
        variant: 'success',
        text: 'Meu Título'
      })

      expect(applySlashCommandToBlock(base, 'heading')).toEqual({
        id: 'blk-1',
        type: 'heading',
        level: 2,
        anchor: 'meu-titulo',
        text: 'Meu Título'
      })

      const linksBlock = applySlashCommandToBlock(base, 'links')
      expect(linksBlock.type).toBe('links')
      expect(linksBlock.items.length).toBe(3)

      expect(applySlashCommandToBlock(base, 'paragraph')).toEqual({
        id: 'blk-1',
        type: 'paragraph',
        text: 'Meu Título'
      })

      expect(applySlashCommandToBlock()).toEqual({
        type: 'paragraph',
        text: ''
      })
    })
  })

  describe('insertMediaBlock & updateLinkCardItem', () => {
    it('inserts media block after target index or at the end', () => {
      const initial = [{ id: 'blk-0', type: 'paragraph', text: 'Texto' }]
      const res = insertMediaBlock(initial, 0, { src: ' /foto.png ', alt: ' Foto Oficial ' }, 'img-1')
      expect(res.insertedIndex).toBe(1)
      expect(res.imageBlock).toEqual({
        id: 'img-1',
        type: 'image',
        src: '/foto.png',
        alt: 'Foto Oficial',
        title: 'Foto Oficial'
      })

      const resEnd = insertMediaBlock(undefined, null, { src: '/a.png', alt: '' })
      expect(resEnd.insertedIndex).toBe(0)
      expect(resEnd.imageBlock.alt).toBe('Imagem')
    })

    it('updates link card item fields safely', () => {
      const block = {
        type: 'links',
        items: [{ title: 'Antigo', description: 'Desc', href: '/old' }]
      }
      const updated = updateLinkCardItem(block, 0, 'title', ' Novo Título ')
      expect(updated.items[0].title).toBe('Novo Título')

      // Invalid index or field leaves items untouched
      const unchanged = updateLinkCardItem(block, 3, 'title', 'X')
      expect(unchanged.items[0].title).toBe('Antigo')
      expect(updateLinkCardItem({}, 0, 'title', 'X').items).toEqual([])
    })
  })

  describe('buildReactiveToc & buildEditorChangePayload', () => {
    it('builds reactive ToC and full editor payload', () => {
      const blocks = [
        { type: 'heading', level: 2, text: 'Seção Um', anchor: '' },
        { type: 'heading', text: 'Seção Dois', anchor: 'custom-anchor' },
        { type: 'paragraph', text: 'Parágrafo normal' }
      ]
      const payload = buildEditorChangePayload(blocks)
      expect(payload.toc).toEqual([
        { title: 'Seção Um', anchor: '#secao-um', level: 2, children: [] },
        { title: 'Seção Dois', anchor: '#custom-anchor', level: 2, children: [] }
      ])
      expect(payload.markdown).toContain('## Seção Um')
      expect(buildReactiveToc()).toEqual([])
      expect(buildEditorChangePayload().toc).toEqual([])
    })
  })

  describe('UI helpers (slash trigger, menu & toolbar positions, validation & notifications)', () => {
    it('detects slash trigger at the end of text', () => {
      expect(detectSlashTrigger('texto /')).toBe(true)
      expect(detectSlashTrigger('/')).toBe(true)
      expect(detectSlashTrigger('texto normal')).toBe(false)
      expect(detectSlashTrigger()).toBe(false)
    })

    it('computes bounded positions for slash menu and floating toolbar', () => {
      expect(computeSlashMenuPosition({ top: 100, left: 120 }, { width: 1280, height: 800 })).toEqual({
        position: 'fixed',
        top: '128px',
        left: '120px',
        zIndex: 9999
      })
      expect(computeSlashMenuPosition()).toEqual({
        position: 'fixed',
        top: '28px',
        left: '0px',
        zIndex: 9999
      })
      expect(computeSlashMenuPosition({}, { width: 0, height: 0 })).toEqual({
        position: 'fixed',
        top: '28px',
        left: '0px',
        zIndex: 9999
      })

      expect(computeFloatingToolbarPosition({ top: 100, left: 200 })).toEqual({
        position: 'fixed',
        top: '54px',
        left: '200px',
        zIndex: 9999
      })
      expect(computeFloatingToolbarPosition()).toEqual({
        position: 'fixed',
        top: '12px',
        left: '16px',
        zIndex: 9999
      })
    })

    it('validates media insertion and resolves media uploads (direct URL, upload success, fallback)', async () => {
      expect(canInsertMedia({ activeTab: 0, imageUrl: 'https://detran.mg.gov.br/a.png' })).toBe(true)
      expect(canInsertMedia({ activeTab: 0, imageUrl: '   ' })).toBe(false)
      expect(canInsertMedia({ activeTab: 1, imageFile: { name: 'a.png' } })).toBe(true)
      expect(canInsertMedia({ activeTab: 2 })).toBe(false)
      expect(canInsertMedia()).toBe(false)

      // Direct URL
      const direct = await resolveMediaUpload({ activeTab: 0, imageUrl: ' /img/1.png ', imageAlt: ' Banner ' })
      expect(direct).toEqual({ src: '/img/1.png', alt: 'Banner' })

      // File upload success
      const mockFetchOk = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ path: '/_uploads/foto.png' })
      })
      const uploaded = await resolveMediaUpload({
        activeTab: 1,
        imageFile: { name: 'foto.png' },
        imageAlt: '',
        fetchImpl: mockFetchOk
      })
      expect(uploaded).toEqual({ src: '/_uploads/foto.png', alt: 'Imagem' })

      // File upload non-ok response falls back to createObjectURL
      const mockFetchFail = jest.fn().mockResolvedValue({ ok: false })
      const fallback1 = await resolveMediaUpload({
        activeTab: 1,
        imageFile: { name: 'foto.png' },
        fetchImpl: mockFetchFail,
        createObjectURL: () => 'blob:fallback-1'
      })
      expect(fallback1.src).toBe('blob:fallback-1')

      // File upload exception falls back to createObjectURL
      const mockFetchError = jest.fn().mockRejectedValue(new Error('Network error'))
      const fallback2 = await resolveMediaUpload({
        activeTab: 1,
        imageFile: { name: 'foto.png' },
        fetchImpl: mockFetchError,
        createObjectURL: () => 'blob:fallback-2'
      })
      expect(fallback2.src).toBe('blob:fallback-2')

      // Default call without fetcher
      const fallback3 = await resolveMediaUpload({
        activeTab: 1,
        imageFile: { name: 'foto.png' }
      })
      expect(fallback3.src).toBe('/_assets/img/uploaded-fallback.png')
      expect(await resolveMediaUpload()).toEqual({ src: '', alt: 'Imagem' })
    })

    it('builds validation payload and filters notification tasks', () => {
      expect(buildValidationPayload(' Revisão textual ')).toEqual({ comment: 'Revisão textual' })
      expect(buildValidationPayload('')).toEqual({ comment: 'Atualização editorial via Edição Transparente' })
      expect(buildValidationPayload()).toEqual({ comment: 'Atualização editorial via Edição Transparente' })

      const tasks = [
        { id: 1, state: 'in_review', title: 'Doc 1' },
        { id: 2, state: 'published', title: 'Doc 2' }
      ]
      expect(filterNotificationTasks(tasks, 0).length).toBe(2)
      expect(filterNotificationTasks(tasks, 1).length).toBe(2)
      expect(filterNotificationTasks(tasks, 2)).toEqual([{ id: 2, state: 'published', title: 'Doc 2' }])
      expect(filterNotificationTasks(null, 0)).toEqual([])
      expect(filterNotificationTasks()).toEqual([])
    })
  })

  describe('GraphQL integration helpers (loadTransparentPageSource, saveTransparentDraft, submitTransparentValidation)', () => {
    it('loads page source from active draft when available, otherwise falls back to pages.single', async () => {
      await expect(loadTransparentPageSource({})).rejects.toThrow('Apollo client não disponível')

      const apolloWithDraft = {
        query: jest.fn().mockResolvedValue({
          data: {
            workflow: {
              draftByPath: { id: 42, content: '# Rascunho Ativo' }
            }
          }
        })
      }
      const resDraft = await loadTransparentPageSource({
        apollo: apolloWithDraft,
        queryDraftAndPolicy: 'Q_DRAFT',
        pageSingleQuery: 'Q_PAGE',
        path: 'home',
        locale: 'pt-br',
        pageId: 1
      })
      expect(resDraft).toEqual({
        markdown: '# Rascunho Ativo',
        draftId: 42,
        source: 'draft'
      })

      const apolloWithPage = {
        query: jest.fn()
          .mockResolvedValueOnce({ data: { workflow: { draftByPath: null } } })
          .mockResolvedValueOnce({ data: { pages: { single: { content: '# Página Publicada' } } } })
      }
      const resPage = await loadTransparentPageSource({
        apollo: apolloWithPage,
        queryDraftAndPolicy: 'Q_DRAFT',
        pageSingleQuery: 'Q_PAGE',
        path: 'home',
        locale: 'pt-br',
        pageId: 1
      })
      expect(resPage).toEqual({
        markdown: '# Página Publicada',
        draftId: null,
        source: 'page'
      })
    })

    it('saves transparent draft normalizing string and object tags', async () => {
      await expect(saveTransparentDraft({})).rejects.toThrow('Apollo client não disponível')

      const apollo = {
        mutate: jest.fn().mockResolvedValue({
          data: {
            workflow: {
              saveDraft: {
                responseResult: { succeeded: true },
                draft: { id: 99, state: 'draft' }
              }
            }
          }
        })
      }
      const res = await saveTransparentDraft({
        apollo,
        mutationSaveDraft: 'M_SAVE',
        activeDraftId: null,
        pageId: 10,
        path: 'manuais/cnh',
        locale: 'pt-br',
        title: 'Manual CNH',
        description: 'Desc',
        markdown: 'Conteúdo',
        tags: ['TAG1', { tag: 'TAG2' }, { title: 'TAG3' }, null]
      })
      expect(res).toEqual({
        succeeded: true,
        draftId: 99,
        draft: { id: 99, state: 'draft' }
      })
    })

    it('submits transparent validation and handles missing draftId', async () => {
      await expect(submitTransparentValidation({})).rejects.toThrow('Apollo client não disponível')

      const noDraft = await submitTransparentValidation({
        apollo: {},
        mutationWorkflowSubmit: 'M_SUBMIT',
        activeDraftId: null
      })
      expect(noDraft.succeeded).toBe(false)

      const apollo = {
        mutate: jest.fn().mockResolvedValue({
          data: {
            workflowSubmit: {
              responseResult: { succeeded: true, message: 'Enviado' },
              draft: { id: 99, state: 'in_review' }
            }
          }
        })
      }
      const submitted = await submitTransparentValidation({
        apollo,
        mutationWorkflowSubmit: 'M_SUBMIT',
        activeDraftId: 99,
        comment: 'Revisado pelo setor'
      })
      expect(submitted).toEqual({
        succeeded: true,
        message: 'Enviado',
        draft: { id: 99, state: 'in_review' }
      })
    })
  })
})

import fs from 'fs'
import path from 'path'
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
  getCaretTriggerRect,
  computeSlashMenuPosition,
  computeFloatingToolbarPosition,
  canInsertMedia,
  resolveMediaUpload,
  buildValidationPayload,
  filterNotificationTasks,
  loadTransparentPageSource,
  saveTransparentDraft,
  submitTransparentValidation,
  transformBlockHeading,
  transformBlockParagraph,
  handleMarkdownPrefixTrigger,
  pushHistorySnapshot,
  undoHistory,
  redoHistory,
  clearOrDeleteBlockAt,
  reorderBlocks
} from './editor-controller'
import { inlineMarkdownToHtml, inlineHtmlToMarkdown } from './markdown-blocks'

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

      // When slash trigger is near viewport bottom, menu flips above caret instead of overlapping text
      const flippedSlash = computeSlashMenuPosition({ top: 680, left: 200 }, { width: 1280, height: 800 })
      expect(parseInt(flippedSlash.top, 10)).toBeLessThan(680 - 280)

      // When selection is near top edge, floating toolbar flips below selection instead of covering text
      const flippedToolbar = computeFloatingToolbarPosition({ top: 24, bottom: 44, left: 200 }, { width: 1280, height: 800 })
      expect(flippedToolbar.top).toBe('52px')

      // getCaretTriggerRect prefers caret rect over full multi-line block bounding rect
      const fakeEl = {
        getBoundingClientRect: () => ({ top: 100, left: 40, bottom: 220, width: 500, height: 120 }),
        contains: () => true
      }
      const fakeWin = {
        getSelection: () => ({
          rangeCount: 1,
          getRangeAt: () => ({
            anchorOffset: 0,
            startContainer: fakeEl,
            startOffset: 0,
            getBoundingClientRect: () => ({ top: 184, left: 210, bottom: 204, width: 8, height: 20 }),
            getClientRects: () => [{ top: 184, left: 210, bottom: 204, width: 8, height: 20 }]
          })
        })
      }
      expect(getCaretTriggerRect(fakeEl, fakeWin)).toEqual({
        top: 184,
        left: 210,
        bottom: 204,
        width: 8,
        height: 20
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
        draftState: 'draft',
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
        draftState: null,
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
        message: '',
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
  describe('Keyboard shortcuts and block transforms', () => {
    it('transforms block into heading with specified level', () => {
      const block = { id: 'blk-1', type: 'paragraph', text: 'Meu Título' }
      const h1 = transformBlockHeading(block, 1)
      expect(h1.type).toBe('heading')
      expect(h1.level).toBe(1)
      expect(h1.anchor).toBe('meu-titulo')

      const h3 = transformBlockHeading(block, 3)
      expect(h3.level).toBe(3)
    })

    it('transforms heading or callout back into paragraph', () => {
      const h2 = { id: 'blk-1', type: 'heading', level: 2, text: 'Texto', anchor: 'texto' }
      const p = transformBlockParagraph(h2)
      expect(p.type).toBe('paragraph')
      expect(p.level).toBeUndefined()
      expect(p.anchor).toBeUndefined()
    })

    it('handles markdown prefix triggers (#, ##, ###, -, *, 1., >)', () => {
      const blk = { id: 'b-0', type: 'paragraph', text: '' }

      const resH1 = handleMarkdownPrefixTrigger('# Introdução', blk)
      expect(resH1.triggered).toBe(true)
      expect(resH1.block.type).toBe('heading')
      expect(resH1.block.level).toBe(1)
      expect(resH1.block.text).toBe('Introdução')

      const resH2 = handleMarkdownPrefixTrigger('## Seção 2', blk)
      expect(resH2.triggered).toBe(true)
      expect(resH2.block.level).toBe(2)

      const resH3 = handleMarkdownPrefixTrigger('### Subseção', blk)
      expect(resH3.triggered).toBe(true)
      expect(resH3.block.level).toBe(3)

      const resList = handleMarkdownPrefixTrigger('- Item 1', blk)
      expect(resList.triggered).toBe(true)
      expect(resList.block.type).toBe('raw')
      expect(resList.block.text).toBe('- Item 1')

      const resNum = handleMarkdownPrefixTrigger('1. Primeiro item', blk)
      expect(resNum.triggered).toBe(true)
      expect(resNum.block.type).toBe('raw')

      const resCallout = handleMarkdownPrefixTrigger('> Nota importante', blk)
      expect(resCallout.triggered).toBe(true)
      expect(resCallout.block.type).toBe('callout')
      expect(resCallout.block.variant).toBe('info')
      expect(resCallout.block.text).toBe('Nota importante')

      const resCode = handleMarkdownPrefixTrigger('```js ', blk)
      expect(resCode.triggered).toBe(true)
      expect(resCode.block.type).toBe('raw')
      expect(resCode.block.text).toBe('```js\n\n```')

      const resTask = handleMarkdownPrefixTrigger('[ ] Conferir prazo', blk)
      expect(resTask.triggered).toBe(true)
      expect(resTask.block.type).toBe('raw')
      expect(resTask.block.text).toBe('- [ ] Conferir prazo')

      const resNone = handleMarkdownPrefixTrigger('Texto normal sem prefixo', blk)
      expect(resNone.triggered).toBe(false)
    })

    it('manages undo and redo history snapshots correctly', () => {
      let stack = []
      let idx = -1

      const state0 = [{ id: '1', text: 'Init' }]
      const snap0 = pushHistorySnapshot(stack, idx, state0)
      stack = snap0.historyStack
      idx = snap0.historyIndex
      expect(idx).toBe(0)
      expect(stack.length).toBe(1)

      const state1 = [{ id: '1', text: 'Modificado' }]
      const snap1 = pushHistorySnapshot(stack, idx, state1)
      stack = snap1.historyStack
      idx = snap1.historyIndex
      expect(idx).toBe(1)

      // Undo
      const undoRes = undoHistory(stack, idx)
      expect(undoRes.canUndo).toBe(true)
      expect(undoRes.blocks[0].text).toBe('Init')
      expect(undoRes.newIndex).toBe(0)
      idx = undoRes.newIndex

      // Cannot undo further
      expect(undoHistory(stack, idx).canUndo).toBe(false)

      // Redo
      const redoRes = redoHistory(stack, idx)
      expect(redoRes.canRedo).toBe(true)
      expect(redoRes.blocks[0].text).toBe('Modificado')
      expect(redoRes.newIndex).toBe(1)
      idx = redoRes.newIndex

      // Cannot redo beyond latest
      expect(redoHistory(stack, idx).canRedo).toBe(false)
    })
  })

  describe('Block reordering (drag & drop) and deletion', () => {
    it('reorders blocks correctly when moving up or down', () => {
      const list = [
        { id: 'b0', type: 'paragraph', text: 'Zero' },
        { id: 'b1', type: 'paragraph', text: 'Um' },
        { id: 'b2', type: 'paragraph', text: 'Dois' },
        { id: 'b3', type: 'paragraph', text: 'Três' }
      ]

      const downRes = reorderBlocks(list, 0, 2)
      expect(downRes.moved).toBe(true)
      expect(downRes.blocks.map(b => b.id)).toEqual(['b1', 'b2', 'b0', 'b3'])

      const upRes = reorderBlocks(list, 3, 1)
      expect(upRes.moved).toBe(true)
      expect(upRes.blocks.map(b => b.id)).toEqual(['b0', 'b3', 'b1', 'b2'])

      expect(reorderBlocks(list, 1, 1).moved).toBe(false)
      expect(reorderBlocks(list, -1, 2).moved).toBe(false)
      expect(reorderBlocks(list, 0, 10).moved).toBe(false)
    })

    it('clears single remaining block to empty paragraph and deletes any block when length > 1', () => {
      const single = [{ id: 'b0', type: 'heading', level: 2, text: 'Título' }]
      const cleared = clearOrDeleteBlockAt(single, 0)
      expect(cleared.deleted).toBe(true)
      expect(cleared.focusIndex).toBe(0)
      expect(cleared.blocks).toEqual([{ id: 'b0', type: 'paragraph', text: '' }])

      // Does nothing if already a single empty paragraph
      expect(clearOrDeleteBlockAt(cleared.blocks, 0).deleted).toBe(false)

      // Deletes block 0 when multiple blocks exist
      const multi = [
        { id: 'b0', type: 'paragraph', text: 'Primeiro' },
        { id: 'b1', type: 'paragraph', text: 'Segundo' }
      ]
      const delFirst = clearOrDeleteBlockAt(multi, 0)
      expect(delFirst.deleted).toBe(true)
      expect(delFirst.focusIndex).toBe(0)
      expect(delFirst.blocks).toEqual([{ id: 'b1', type: 'paragraph', text: 'Segundo' }])
    })
  })

  describe('Markdown inline underline and empty contenteditable cleanup', () => {
    it('preserves <u>text</u> roundtrip cleanly without losing text', () => {
      expect(inlineMarkdownToHtml('Texto <u>sublinhado</u> fim')).toBe('Texto <u>sublinhado</u> fim')
      expect(inlineHtmlToMarkdown('Texto <u>sublinhado</u> fim')).toBe('Texto <u>sublinhado</u> fim')
    })

    it('treats ghost <br> in empty contenteditable as empty string', () => {
      expect(inlineHtmlToMarkdown('<br>')).toBe('')
      expect(inlineHtmlToMarkdown('&nbsp;<br/>')).toBe('')
    })
  })

  describe('Callout variant switcher and block action layout without text overlap', () => {
    it('places .callout-variant-switcher after p.editable-field and avoids position: absolute over block text', () => {
      const blockItemSrc = fs.readFileSync(path.resolve(__dirname, '../block-item.vue'), 'utf8')
      const calloutSectionMatch = blockItemSrc.match(/blockquote\.detran-live-callout[\s\S]*?(?=\/\/- 3\.)/)
      expect(calloutSectionMatch).not.toBeNull()
      const calloutSection = calloutSectionMatch[0]

      const editableIdx = calloutSection.indexOf('p.editable-field')
      const switcherIdx = calloutSection.indexOf('.callout-variant-switcher')
      expect(editableIdx).toBeGreaterThan(-1)
      expect(switcherIdx).toBeGreaterThan(editableIdx)

      const switcherCssMatch = blockItemSrc.match(/\.callout-variant-switcher\s*\{[\s\S]*?\n\}/)
      expect(switcherCssMatch).not.toBeNull()
      expect(switcherCssMatch[0]).not.toMatch(/position:\s*absolute/)

      const deleteBtnCssMatch = blockItemSrc.match(/\.block-delete-btn\s*\{[\s\S]*?\n\}/)
      expect(deleteBtnCssMatch).not.toBeNull()
      expect(deleteBtnCssMatch[0]).not.toMatch(/position:\s*absolute/)
    })

    it('renders inline transparent editors directly for code, tables, lists, and quotes instead of raw textarea modal', () => {
      const blockItemSrc = fs.readFileSync(path.resolve(__dirname, '../block-item.vue'), 'utf8')
      expect(blockItemSrc).toContain('detran-live-code__textarea')
      expect(blockItemSrc).toContain('detran-live-table')
      expect(blockItemSrc).toContain('table-cell-editable')
      expect(blockItemSrc).toContain('detran-live-list')
      expect(blockItemSrc).toContain('list-item-editable')
      expect(blockItemSrc).toContain('detran-live-quote')
    })

    it('provides cohesive Detran-MG table row/column manipulation toolbar without generic alert class collisions', () => {
      const blockItemSrc = fs.readFileSync(path.resolve(__dirname, '../block-item.vue'), 'utf8')
      expect(blockItemSrc).toContain('detran-table-toolbar')
      expect(blockItemSrc).toContain('detran-table-toolbar__info')
      expect(blockItemSrc).toContain('detran-table-toolbar__dim')
      expect(blockItemSrc).toContain('detran-table-btn--add')
      expect(blockItemSrc).toContain('detran-table-btn--remove')
      expect(blockItemSrc).not.toMatch(/detran-table-btn[^\n]*\bis-danger\b/)
    })
  })
})

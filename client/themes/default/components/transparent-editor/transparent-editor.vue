<template lang="pug">
.transparent-editor-shell.detran-contents.contents
  //- Barra Flutuante de Seleção
  floating-toolbar(
    ref='floatingToolbar'
    :visible='toolbarVisible'
    :position='toolbarPosition'
    @transform='transformActiveBlock'
    @formatted='onInlineFormatted'
  )

  //- Menu Slash Command (/)
  slash-menu(
    :visible='slashMenuVisible'
    :position='slashMenuPosition'
    :query='slashQuery'
    @select='applySlashCommand'
    @close='closeSlashMenu'
  )

  //- Modal de Inserção de Mídia
  media-upload-modal(
    v-model='dialogMedia'
    @insert='onInsertMedia'
  )

  //- Banner de Upload Automático de Imagem no Smart Paste
  .smart-paste-upload-banner(v-if='uploadingImageStatus')
    v-progress-circular(indeterminate size='15' width='2' color='#15803d')
    span {{ uploadingImageStatus }}

  //- Lista de Blocos Editáveis (herda integralmente a tipografia .detran-contents / .contents)
  .editor-blocks-container
    block-item(
      v-for='(block, bIdx) in blocks'
      :key='block.id || bIdx'
      :block='block'
      :index='bIdx'
      :dragging-index='draggingBlockIndex'
      ref='blockItems'
      @update-block='onUpdateBlock'
      @insert-below='onInsertBelow'
      @delete-block='onDeleteBlock'
      @slash-command='onSlashTriggered'
      @smart-paste='onSmartPaste'
      @transform-block='onTransformBlock'
      @open-link-popover='onOpenLinkPopover'
      @drag-start='onBlockDragStart'
      @drop-block='onBlockDrop'
      @drag-end='onBlockDragEnd'
    )

  //- Linha para Adicionar Novo Bloco Rapidamente (Fiel ao Protótipo: linhas 488-491)
  .add-block-end(
    @click='appendNewParagraph'
  )
    v-icon.add-block-end__icon(size='15') mdi-plus
    span
      | Clique aqui para continuar escrevendo ou digite
      kbd.add-block-end__kbd /
      | para inserir um bloco (aviso, título, lista)...

  //- Feedback Não-Intrusivo Pós-Colagem (Toast com Desfazer / Colar sem formatação)
  .smart-paste-toast(v-if='smartPasteToast.visible')
    .smart-paste-toast__inner
      span.smart-paste-toast__text ✨ {{ smartPasteToast.message }}
      button.smart-paste-toast__revert(
        v-if='smartPasteToast.canRevertPlain'
        type='button'
        @click='revertToPlainPaste'
      ) [Colar sem formatação (Ctrl+Shift+V)]
      button.smart-paste-toast__close(
        type='button'
        title='Fechar aviso'
        @click='smartPasteToast.visible = false'
      )
        v-icon(size='14' color='#cbd5e1') mdi-close
</template>

<script>
import BlockItem from './block-item.vue'
import SlashMenu from './slash-menu.vue'
import FloatingToolbar from './floating-toolbar.vue'
import MediaUploadModal from './media-upload-modal.vue'
import {
  initEditorBlocks,
  updateBlockAt,
  insertBlockBelow,
  clearOrDeleteBlockAt,
  reorderBlocks,
  applySlashCommandToBlock,
  extractActiveSlashQuery,
  insertMediaBlock,
  buildEditorChangePayload,
  transformBlockHeading,
  transformBlockParagraph,
  pushHistorySnapshot,
  undoHistory,
  redoHistory
} from './utils/editor-controller'
import { processSmartPastePayload } from './utils/smart-paste'

export default {
  name: 'TransparentEditor',
  components: {
    BlockItem,
    SlashMenu,
    FloatingToolbar,
    MediaUploadModal
  },
  props: {
    initialMarkdown: {
      type: String,
      default: ''
    },
    pageId: {
      type: [Number, String],
      default: null
    },
    pagePath: {
      type: String,
      default: ''
    },
    pageTitle: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      blocks: [],
      historyStack: [],
      historyIndex: -1,
      isApplyingHistory: false,
      draggingBlockIndex: null,
      slashMenuVisible: false,
      slashMenuPosition: { top: 0, left: 0 },
      slashBlockIndex: null,
      slashQuery: '',
      toolbarVisible: false,
      toolbarPosition: { top: 0, left: 0 },
      activeBlockIndex: null,
      dialogMedia: false,
      mediaInsertIndex: null,
      debounceTimer: null,
      uploadingImageStatus: '',
      prePasteSnapshot: null,
      smartPasteToast: {
        visible: false,
        message: 'Texto formatado automaticamente para o padrão da Intranet.',
        canRevertPlain: false,
        timer: null
      }
    }
  },
  watch: {
    initialMarkdown: {
      immediate: true,
      handler (newMd) {
        if (!this.blocks.length || newMd !== this.lastEmittedMarkdown) {
          this.initBlocks(newMd)
        }
      }
    }
  },
  mounted () {
    document.addEventListener('selectionchange', this.onSelectionChange)
    window.addEventListener('keydown', this.onGlobalKeydown)
  },
  beforeDestroy () {
    document.removeEventListener('selectionchange', this.onSelectionChange)
    window.removeEventListener('keydown', this.onGlobalKeydown)
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.smartPasteToast.timer) clearTimeout(this.smartPasteToast.timer)
  },
  methods: {
    initBlocks (md) {
      this.lastEmittedMarkdown = md || ''
      this.blocks = initEditorBlocks(md || '', `${Date.now()}`)
      this.historyStack = [JSON.parse(JSON.stringify(this.blocks))]
      this.historyIndex = 0
    },
    getScrollContainer () {
      return this.$el && this.$el.closest ? this.$el.closest('.detran-content') : null
    },
    getBlockComponentByIndex (targetIndex) {
      const targetBlock = this.blocks[targetIndex]
      if (!Array.isArray(this.$refs.blockItems)) return null
      if (targetBlock && targetBlock.id) {
        const byId = this.$refs.blockItems.find(c => c && c.block && c.block.id === targetBlock.id)
        if (byId) return byId
      }
      return this.$refs.blockItems.find(c => c && c.index === targetIndex) || null
    },
    recordHistory () {
      if (this.isApplyingHistory) return
      const res = pushHistorySnapshot(this.historyStack, this.historyIndex, this.blocks)
      this.historyStack = res.historyStack
      this.historyIndex = res.historyIndex
    },
    onUpdateBlock ({ index, block }) {
      const scrollContainer = this.getScrollContainer()
      const savedTop = scrollContainer ? scrollContainer.scrollTop : null
      this.blocks = updateBlockAt(this.blocks, index, block)
      if (this.slashMenuVisible && index === this.slashBlockIndex) {
        const blockText = String((block && block.text) || '')
        const activeQuery = extractActiveSlashQuery(blockText)
        if (activeQuery !== null) {
          this.slashQuery = activeQuery
        } else if (!blockText.includes('/') || /\s$/.test(blockText)) {
          this.closeSlashMenu()
        }
      }
      this.recordHistory()
      this.triggerChange()
      if (scrollContainer !== null && savedTop !== null) {
        this.$nextTick(() => {
          if (Math.abs(scrollContainer.scrollTop - savedTop) > 20 && !this.isApplyingHistory) {
            scrollContainer.scrollTop = savedTop
          }
        })
      }
    },
    onInsertBelow (index) {
      const { blocks, insertedIndex } = insertBlockBelow(
        this.blocks,
        index,
        `${Date.now()}-${Math.random()}`
      )
      this.blocks = blocks
      this.recordHistory()
      this.triggerChange()

      this.$nextTick(() => {
        const item = this.getBlockComponentByIndex(insertedIndex)
        if (item) item.focus()
      })
    },
    onDeleteBlock (index) {
      const scrollContainer = this.getScrollContainer()
      const savedTop = scrollContainer ? scrollContainer.scrollTop : null
      const { blocks, deleted, focusIndex } = clearOrDeleteBlockAt(this.blocks, index)
      if (deleted) {
        this.blocks = blocks
        this.recordHistory()
        this.triggerChange()

        this.$nextTick(() => {
          const targetItem = this.getBlockComponentByIndex(focusIndex)
          if (targetItem) {
            if (typeof targetItem.syncEditableDom === 'function') {
              targetItem.syncEditableDom()
            }
            targetItem.focus({ caretAtEnd: true })
          }
          if (scrollContainer !== null && savedTop !== null) {
            const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
            scrollContainer.scrollTop = Math.min(savedTop, maxTop)
          }
        })
      }
    },
    onBlockDragStart (index) {
      this.draggingBlockIndex = index
    },
    onBlockDragEnd () {
      this.draggingBlockIndex = null
    },
    onBlockDrop ({ fromIndex, targetIndex, position }) {
      this.draggingBlockIndex = null
      let toIndex = targetIndex
      if (fromIndex < targetIndex) {
        toIndex = position === 'top' ? targetIndex - 1 : targetIndex
      } else if (fromIndex > targetIndex) {
        toIndex = position === 'top' ? targetIndex : targetIndex + 1
      }
      const { blocks, moved } = reorderBlocks(this.blocks, fromIndex, toIndex)
      if (!moved) return
      const scrollContainer = this.getScrollContainer()
      const savedTop = scrollContainer ? scrollContainer.scrollTop : null
      this.blocks = blocks
      this.recordHistory()
      this.triggerChange()
      this.$nextTick(() => {
        if (Array.isArray(this.$refs.blockItems)) {
          this.$refs.blockItems.forEach(item => {
            if (item && typeof item.syncEditableDom === 'function') {
              item.syncEditableDom()
            }
          })
        }
        if (scrollContainer !== null && savedTop !== null) {
          scrollContainer.scrollTop = savedTop
        }
      })
    },
    appendNewParagraph () {
      this.onInsertBelow(this.blocks.length - 1)
    },
    closeSlashMenu () {
      this.slashMenuVisible = false
      this.slashQuery = ''
    },
    onSlashTriggered ({ index, rect }) {
      this.slashBlockIndex = index
      this.slashQuery = ''
      this.slashMenuPosition = {
        top: rect.top,
        left: rect.left
      }
      this.slashMenuVisible = true
    },
    applySlashCommand (type) {
      const index = this.slashBlockIndex
      if (index === null || !this.blocks[index]) return

      let focusIndex = index
      if (type === 'image') {
        this.mediaInsertIndex = index
        this.dialogMedia = true
      } else {
        const transformed = applySlashCommandToBlock(this.blocks[index], type)
        this.blocks = updateBlockAt(this.blocks, index, transformed)
        if (type === 'hr') {
          const inserted = insertBlockBelow(this.blocks, index, `${Date.now()}-${Math.random()}`)
          this.blocks = inserted.blocks
          focusIndex = inserted.insertedIndex
        }
      }

      this.closeSlashMenu()
      this.recordHistory()
      this.triggerChange()

      this.$nextTick(() => {
        const item = this.getBlockComponentByIndex(focusIndex)
        if (item) {
          if (typeof item.syncEditableDom === 'function') {
            item.syncEditableDom(true)
          }
          item.focus({ caretAtEnd: true })
        }
      })
    },
    onInsertMedia ({ src, alt }) {
      const index = this.mediaInsertIndex !== null ? this.mediaInsertIndex : this.blocks.length
      const { blocks } = insertMediaBlock(
        this.blocks,
        index,
        { src, alt },
        `${Date.now()}-${Math.random()}`
      )
      this.blocks = blocks
      this.recordHistory()
      this.triggerChange()
    },
    async onSmartPaste ({ index, event }) {
      if (!event || !event.clipboardData) return

      const html = event.clipboardData.getData('text/html') || ''
      const plainText = event.clipboardData.getData('text/plain') || ''
      const files = event.clipboardData.files ? Array.from(event.clipboardData.files) : []
      const hasImageFiles = files.some(f => f && String(f.type || '').startsWith('image/'))

      if (!hasImageFiles && !html && !plainText) return

      event.preventDefault()

      // Salva estado anterior para opção [Colar sem formatação (Ctrl+Shift+V)]
      this.prePasteSnapshot = {
        blocks: JSON.parse(JSON.stringify(this.blocks)),
        index,
        plainText
      }

      try {
        const result = await processSmartPastePayload({
          html,
          plainText,
          files,
          onUploadStart: (msg) => {
            this.uploadingImageStatus = msg || 'Enviando imagem para o servidor...'
          },
          onUploadComplete: () => {
            this.uploadingImageStatus = ''
          }
        })
        this.uploadingImageStatus = ''

        if (result.blockedBlobUrls && result.blockedBlobUrls.length > 0 && (!result.uploadedImages || result.uploadedImages.length === 0)) {
          this.showSmartPasteToast('URL de imagem temporária (blob:) bloqueada. Cole a imagem diretamente.', false)
        }

        const pastedBlocks = result.blocks && result.blocks.length > 0 ?
          result.blocks :
          (plainText ? [{ id: `paste-${Date.now()}`, type: 'paragraph', text: plainText.trim() }] : [])

        if (pastedBlocks.length === 0) return

        const currentBlock = this.blocks[index]
        const currentText = currentBlock && currentBlock.text ? currentBlock.text.trim() : ''

        if (pastedBlocks.length === 1 && pastedBlocks[0].type === 'paragraph' && currentBlock && currentBlock.type !== 'image' && currentBlock.type !== 'links') {
          const mergedText = currentText ?
            `${currentText} ${pastedBlocks[0].text}` :
            pastedBlocks[0].text
          this.blocks = updateBlockAt(this.blocks, index, {
            ...currentBlock,
            text: mergedText
          })
          this.$nextTick(() => {
            const item = this.$refs.blockItems && this.$refs.blockItems[index]
            if (item && typeof item.syncEditableDom === 'function') {
              item.syncEditableDom()
            }
          })
        } else {
          const nextBlocks = [...this.blocks]
          if (!currentText && currentBlock && currentBlock.type === 'paragraph') {
            nextBlocks.splice(index, 1, ...pastedBlocks)
          } else {
            nextBlocks.splice(index + 1, 0, ...pastedBlocks)
          }
          this.blocks = nextBlocks
          this.$nextTick(() => {
            if (Array.isArray(this.$refs.blockItems)) {
              this.$refs.blockItems.forEach(item => {
                if (item && typeof item.syncEditableDom === 'function') {
                  item.syncEditableDom()
                }
              })
            }
          })
        }

        this.recordHistory()
        this.triggerChange()

        if (result.origin === 'image') {
          this.showSmartPasteToast('Imagem enviada ao servidor e inserida com URL permanente!', false)
        } else if (result.hadComplexFormatting || pastedBlocks.length > 1) {
          this.showSmartPasteToast('Texto formatado automaticamente para o padrão da Intranet.', Boolean(plainText))
        }
      } catch (err) {
        this.uploadingImageStatus = ''
        this.showSmartPasteToast(err.message || 'Erro ao processar conteúdo colado.', false)
      }
    },
    revertToPlainPaste () {
      if (!this.prePasteSnapshot) return
      const { blocks, index, plainText } = this.prePasteSnapshot
      const cleanPlain = String(plainText || '').trim()
      const restored = JSON.parse(JSON.stringify(blocks))

      if (cleanPlain) {
        const current = restored[index]
        if (current && !String(current.text || '').trim()) {
          restored[index] = {
            ...current,
            type: 'paragraph',
            text: cleanPlain
          }
        } else {
          restored.splice(index + 1, 0, {
            id: `plain-${Date.now()}`,
            type: 'paragraph',
            text: cleanPlain
          })
        }
      }

      this.blocks = restored
      this.prePasteSnapshot = null
      this.smartPasteToast.visible = false
      this.recordHistory()
      this.$nextTick(() => {
        if (Array.isArray(this.$refs.blockItems)) {
          this.$refs.blockItems.forEach(item => {
            if (item && typeof item.syncEditableDom === 'function') {
              item.syncEditableDom()
            }
          })
        }
      })
      this.triggerChange()
    },
    showSmartPasteToast (message, canRevertPlain = true) {
      if (this.smartPasteToast.timer) {
        clearTimeout(this.smartPasteToast.timer)
      }
      this.smartPasteToast.message = message
      this.smartPasteToast.canRevertPlain = canRevertPlain
      this.smartPasteToast.visible = true
      this.smartPasteToast.timer = setTimeout(() => {
        this.smartPasteToast.visible = false
      }, 6500)
    },
    onSelectionChange () {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        this.toolbarVisible = false
        return
      }
      const anchorNode = sel.anchorNode
      const parentEl = anchorNode && (anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement)
      const field = parentEl && parentEl.closest && parentEl.closest('.editable-field')
      if (!field) {
        this.toolbarVisible = false
        return
      }

      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      this.toolbarPosition = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left
      }
      this.toolbarVisible = true
    },
    transformActiveBlock (type) {
      const sel = window.getSelection()
      if (!sel || !sel.anchorNode) return
      const parentEl = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement
      const field = parentEl && parentEl.closest && parentEl.closest('.editable-field')
      if (!field) return

      const blockEl = field.closest('.notion-block')
      const blockEls = Array.from(this.$el.querySelectorAll('.notion-block'))
      const idx = blockEls.indexOf(blockEl)

      if (idx !== -1 && this.blocks[idx] && this.blocks[idx].type !== 'raw') {
        this.slashBlockIndex = idx
        this.applySlashCommand(type)
      }
    },
    onInlineFormatted () {
      const sel = window.getSelection()
      if (sel && sel.anchorNode) {
        const parentEl = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement
        const field = parentEl && parentEl.closest && parentEl.closest('.editable-field')
        if (field) {
          field.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
      this.triggerChange()
    },
    handleUndo () {
      const res = undoHistory(this.historyStack, this.historyIndex)
      if (!res.canUndo || !res.blocks) return
      const scrollContainer = this.getScrollContainer()
      const savedTop = scrollContainer ? scrollContainer.scrollTop : null
      this.historyIndex = res.newIndex
      this.isApplyingHistory = true
      this.blocks = res.blocks
      this.$nextTick(() => {
        if (Array.isArray(this.$refs.blockItems)) {
          this.$refs.blockItems.forEach(item => {
            if (item && typeof item.syncEditableDom === 'function') {
              item.syncEditableDom()
            }
          })
        }
        this.isApplyingHistory = false
        this.triggerChange()
        if (scrollContainer !== null && savedTop !== null) {
          scrollContainer.scrollTop = Math.min(savedTop, Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight))
        }
      })
    },
    handleRedo () {
      const res = redoHistory(this.historyStack, this.historyIndex)
      if (!res.canRedo || !res.blocks) return
      const scrollContainer = this.getScrollContainer()
      const savedTop = scrollContainer ? scrollContainer.scrollTop : null
      this.historyIndex = res.newIndex
      this.isApplyingHistory = true
      this.blocks = res.blocks
      this.$nextTick(() => {
        if (Array.isArray(this.$refs.blockItems)) {
          this.$refs.blockItems.forEach(item => {
            if (item && typeof item.syncEditableDom === 'function') {
              item.syncEditableDom()
            }
          })
        }
        this.isApplyingHistory = false
        this.triggerChange()
        if (scrollContainer !== null && savedTop !== null) {
          scrollContainer.scrollTop = Math.min(savedTop, Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight))
        }
      })
    },
    handleManualSave () {
      clearTimeout(this.debounceTimer)
      const payload = buildEditorChangePayload(this.blocks)
      this.lastEmittedMarkdown = payload.markdown
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('change', payload)
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('save-draft', payload)
    },
    onTransformBlock ({ index, type, level }) {
      if (index === null || !this.blocks[index]) return
      const targetBlock = this.blocks[index]
      let transformed = targetBlock
      if (type === 'heading') {
        transformed = transformBlockHeading(targetBlock, level || 2)
      } else if (type === 'paragraph') {
        transformed = transformBlockParagraph(targetBlock)
      }
      this.blocks = updateBlockAt(this.blocks, index, transformed)
      this.recordHistory()
      this.triggerChange()
      this.$nextTick(() => {
        const item = this.getBlockComponentByIndex(index)
        if (item) {
          if (typeof item.syncEditableDom === 'function') item.syncEditableDom()
          item.focus()
        }
      })
    },
    onOpenLinkPopover () {
      if (this.$refs.floatingToolbar && typeof this.$refs.floatingToolbar.openLinkInput === 'function') {
        this.toolbarVisible = true
        this.$refs.floatingToolbar.openLinkInput()
      }
    },
    onGlobalKeydown (e) {
      const isMod = Boolean(e.ctrlKey || e.metaKey)
      if (!isMod) return

      const key = (e.key || '').toLowerCase()

      // Ctrl+S / Cmd+S: Salvar Rascunho Manual Imediato
      if (key === 's' && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        this.handleManualSave()
        return
      }

      // Em inputs/textareas nativos (ex: popover de link ou editor raw), preserva o desfazer nativo
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea') return

      // Ctrl+Z / Cmd+Z (sem shift): Desfazer histórico
      if (key === 'z' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        this.handleUndo()
        return
      }

      // Ctrl+Y / Cmd+Y ou Ctrl+Shift+Z / Cmd+Shift+Z: Refazer histórico
      if ((key === 'y' && !e.shiftKey && !e.altKey) || (key === 'z' && e.shiftKey && !e.altKey)) {
        e.preventDefault()
        e.stopPropagation()
        this.handleRedo()
      }
    },
    clearPendingSave () {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
        this.debounceTimer = null
      }
    },
    triggerChange () {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null
        const payload = buildEditorChangePayload(this.blocks)
        this.lastEmittedMarkdown = payload.markdown
        this.$emit('change', payload)
      }, 500)
    }
  }
}
</script>

<style lang="scss">
@import '../../../detran/scss/variables';
@import '../../../detran/scss/typography';

.transparent-editor-shell {
  position: relative;
  width: 100%;
  overflow-anchor: none;

  .editor-blocks-container {
    margin-top: -6px;
  }

  ul.links-list.editable-links-list li a::after {
    display: none !important;
  }
}

.smart-paste-upload-banner {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  margin-bottom: 0.75rem;
  border-radius: 0.625rem;
  background-color: #f0fdf4;
  border: 1px dashed #22c55e;
  color: #166534;
  font-size: 0.75rem;
  font-weight: 600;
}

.smart-paste-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;

  &__inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1rem;
    border-radius: 0.75rem;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(8px);
    color: #f8fafc;
    font-size: 0.75rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  &__text {
    font-weight: 500;
  }

  &__revert {
    border: none;
    background: transparent;
    color: #4ade80;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;

    &:hover {
      color: #86efac;
    }
  }

  &__close {
    border: none;
    background: transparent;
    padding: 2px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }
}

.add-block-end {
  margin-top: 1.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px dashed #e2e8f0;
  color: #94a3b8;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: text;
  user-select: none;
  transition: all 0.15s ease;

  &__icon {
    color: inherit !important;
  }

  &__kbd {
    display: inline-block;
    margin: 0 4px;
    padding: 2px 6px;
    background-color: #f1f5f9;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    font-family: inherit;
  }

  &:hover {
    border-color: rgba(27, 101, 53, 0.4);
    background-color: rgba(236, 253, 245, 0.35);
    color: #1b6535;
  }
}
</style>

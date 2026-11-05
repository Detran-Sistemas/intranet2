<template lang="pug">
.transparent-editor-shell.detran-contents.contents
  //- Barra Flutuante de Seleção
  floating-toolbar(
    :visible='toolbarVisible'
    :position='toolbarPosition'
    @transform='transformActiveBlock'
    @formatted='onInlineFormatted'
  )

  //- Menu Slash Command (/)
  slash-menu(
    :visible='slashMenuVisible'
    :position='slashMenuPosition'
    @select='applySlashCommand'
    @close='slashMenuVisible = false'
  )

  //- Modal de Inserção de Mídia
  media-upload-modal(
    v-model='dialogMedia'
    @insert='onInsertMedia'
  )

  //- Lista de Blocos Editáveis (herda integralmente a tipografia .detran-contents / .contents)
  .editor-blocks-container
    block-item(
      v-for='(block, bIdx) in blocks'
      :key='block.id || bIdx'
      :block='block'
      :index='bIdx'
      ref='blockItems'
      @update-block='onUpdateBlock'
      @insert-below='onInsertBelow'
      @delete-block='onDeleteBlock'
      @slash-command='onSlashTriggered'
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
  deleteBlockAt,
  applySlashCommandToBlock,
  insertMediaBlock,
  buildEditorChangePayload
} from './utils/editor-controller'

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
      slashMenuVisible: false,
      slashMenuPosition: { top: 0, left: 0 },
      slashBlockIndex: null,
      toolbarVisible: false,
      toolbarPosition: { top: 0, left: 0 },
      activeBlockIndex: null,
      dialogMedia: false,
      mediaInsertIndex: null,
      debounceTimer: null
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
  },
  beforeDestroy () {
    document.removeEventListener('selectionchange', this.onSelectionChange)
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
  },
  methods: {
    initBlocks (md) {
      this.lastEmittedMarkdown = md || ''
      this.blocks = initEditorBlocks(md || '', `${Date.now()}`)
    },
    onUpdateBlock ({ index, block }) {
      this.blocks = updateBlockAt(this.blocks, index, block)
      this.triggerChange()
    },
    onInsertBelow (index) {
      const { blocks, insertedIndex } = insertBlockBelow(
        this.blocks,
        index,
        `${Date.now()}-${Math.random()}`
      )
      this.blocks = blocks
      this.triggerChange()

      this.$nextTick(() => {
        const item = this.$refs.blockItems && this.$refs.blockItems[insertedIndex]
        if (item) item.focus()
      })
    },
    onDeleteBlock (index) {
      const { blocks, deleted, focusIndex } = deleteBlockAt(this.blocks, index)
      if (deleted) {
        this.blocks = blocks
        this.triggerChange()

        this.$nextTick(() => {
          const prevItem = this.$refs.blockItems && this.$refs.blockItems[focusIndex]
          if (prevItem) prevItem.focus()
        })
      }
    },
    appendNewParagraph () {
      this.onInsertBelow(this.blocks.length - 1)
    },
    onSlashTriggered ({ index, rect }) {
      this.slashBlockIndex = index
      this.slashMenuPosition = {
        top: rect.top,
        left: rect.left
      }
      this.slashMenuVisible = true
    },
    applySlashCommand (type) {
      const index = this.slashBlockIndex
      if (index === null || !this.blocks[index]) return

      if (type === 'image') {
        this.mediaInsertIndex = index
        this.dialogMedia = true
      } else {
        const transformed = applySlashCommandToBlock(this.blocks[index], type)
        this.blocks = updateBlockAt(this.blocks, index, transformed)
      }

      this.slashMenuVisible = false
      this.triggerChange()

      this.$nextTick(() => {
        const item = this.$refs.blockItems && this.$refs.blockItems[index]
        if (item) item.focus()
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
      this.triggerChange()
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

      if (idx !== -1) {
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
    triggerChange () {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        const payload = buildEditorChangePayload(this.blocks)
        this.lastEmittedMarkdown = payload.markdown
        this.$emit('change', payload)
      }, 500)
    }
  }
}
</script>

<style lang="scss">
.transparent-editor-shell {
  position: relative;
  width: 100%;

  .editor-blocks-container {
    margin-top: -6px;
  }

  // Permite clicar nos campos editáveis dentro dos cards .links-list
  ul.links-list.editable-links-list li a::after {
    display: none !important;
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

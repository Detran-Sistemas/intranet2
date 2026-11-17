<template lang="pug">
.notion-block(
  :draggable='isDragArmed ? "true" : "false"'
  :class='[blockClass, { "is-focused": isFocused, "is-hovered": isHovered, "is-dragging": isDragging, "is-drag-over-top": dragOverPos === "top", "is-drag-over-bottom": dragOverPos === "bottom" }]'
  @mouseenter='isHovered = true'
  @mouseleave='onBlockMouseLeave'
  @dragstart='onDragStart'
  @dragover.prevent='onDragOver'
  @dragleave='onDragLeave'
  @drop.prevent='onDrop'
  @dragend='onDragEnd'
)
  //- Alça lateral interna ao bloco (+, arrastar 6 pontos)
  .block-handle.select-none
    button.handle-add-btn(
      type='button'
      title='Adicionar bloco abaixo'
      @click.stop='$emit("insert-below", index)'
    )
      v-icon(size='13') mdi-plus
    span.handle-grip(
      role='button'
      title='Arrastar para reordenar bloco'
      aria-label='Arrastar para reordenar bloco'
      @mousedown='armDrag'
      @mouseup='disarmDrag'
    )
      v-icon(size='15') mdi-drag-vertical

  //- Conteúdo do Bloco com as mesmas tags semânticas do pipeline Wiki.js (.detran-contents)
  .block-content

    //- 1. CABEÇALHOS (H1 a H6 — preserva nível exato, border-bottom e âncora)
    template(v-if='block.type === "heading"')
      component.editable-field(
        :is='headingTag'
        :id='headingAnchor'
        ref='editable'
        contenteditable='true'
        spellcheck='false'
        :data-placeholder='$t("common:editor.headingPlaceholder", "Título da seção...")'
        @input='onInputText'
        @keydown='onKeydown'
        @paste='onPaste'
        @focus='isFocused = true'
        @blur='onBlurText'
      )

    //- 2. CALLOUT NATIVO WIKI.JS / PROTÓTIPO DETRAN-MG (Estilizado em tempo real mantendo transparência)
    template(v-else-if='block.type === "callout"')
      blockquote.detran-live-callout(:class='calloutClass')
        p.editable-field(
          ref='editable'
          contenteditable='true'
          spellcheck='false'
          :data-placeholder='$t("common:editor.calloutPlaceholder", "Digite um destaque...")'
          @input='onInputText'
          @keydown='onKeydown'
          @paste='onPaste'
          @focus='isFocused = true'
          @blur='onBlurText'
        )
        .callout-variant-switcher.select-none(v-if='isHovered || isFocused')
          span.callout-variant-switcher__label Estilo:
          button.callout-variant-btn(
            v-for='item in calloutVariantOptions'
            :key='item.id'
            type='button'
            :class='[ "variant-btn--" + item.id, { "is-active": (block.variant || "info") === item.id } ]'
            :title='"Alterar estilo para " + item.label'
            @mousedown.prevent
            @click.stop='onChangeCalloutVariant(item.id)'
          )
            span.variant-dot(:class='"variant-dot--" + item.id')
            span.variant-label {{ item.label }}

    //- 3. CARDS DE LINKS (.links-list nativo do Design System Detran-MG)
    template(v-else-if='block.type === "links"')
      ul.links-list.editable-links-list(
        tabindex='0'
        @keydown='onNonTextBlockKeydown'
      )
        li(v-for='(item, itIdx) in block.items' :key='itIdx')
          a(:href='item.href' @click.prevent)
            span.editable-subfield(
              contenteditable='true'
              spellcheck='false'
              data-placeholder='Título do link'
              @focus='isFocused = true'
              @blur='onLinkTitleChange(itIdx, $event)'
            ) {{ item.title }}
            em.editable-subfield(
              contenteditable='true'
              spellcheck='false'
              data-placeholder='Descrição opcional'
              @focus='isFocused = true'
              @blur='onLinkDescChange(itIdx, $event)'
            ) {{ item.description }}

    //- 4. IMAGEM
    template(v-else-if='block.type === "image"')
      figure.detran-image-figure(
        tabindex='0'
        @keydown='onNonTextBlockKeydown'
      )
        img(:src='block.src', :alt='block.alt', :title='block.title || block.alt')
        figcaption.editable-field.caption.grey--text.text--darken-1.text-center(
          v-if='isHovered || isFocused || block.title'
          ref='editable'
          contenteditable='true'
          spellcheck='false'
          :data-placeholder='$t("common:editor.imageCaptionPlaceholder", "Adicionar legenda da imagem...")'
          @input='onImageCaptionInput'
          @focus='isFocused = true'
          @blur='isFocused = false'
        ) {{ block.title || block.alt }}

    //- 5. BLOCOS ESTRUTURAIS (Código, Tabelas, Listas, Citações, Diagramas, Divisores — Edição Transparente em Tempo Real!)
    template(v-else-if='block.type === "raw"')
      .detran-raw-wrapper
        //- 5a. Divisor horizontal
        .detran-live-hr(
          v-if='rawKind === "hr"'
          tabindex='0'
          title='Linha divisória (Delete para excluir)'
          @keydown='onNonTextBlockKeydown'
        )
          hr

        //- 5b. Bloco de código editável inline em tempo real
        .detran-live-code(v-else-if='rawKind === "code"')
          .detran-live-code__header.select-none
            span.detran-live-code__badge
              v-icon(size='13' color='#94a3b8') mdi-code-tags
              input.detran-live-code__lang-input(
                :value='rawCodeData.lang'
                placeholder='texto'
                aria-label='Linguagem do bloco de código'
                @focus='isFocused = true'
                @blur='onRawSubBlur'
                @input='onCodeLangInput($event.target.value)'
                @keydown.stop
              )
            span.detran-live-code__hint Tab = 2 espaços
          pre.detran-live-code__pre
            code
              textarea.detran-live-code__textarea(
                ref='codeTextarea'
                :value='rawCodeData.code'
                :rows='rawCodeRows'
                spellcheck='false'
                placeholder='Digite ou cole seu código aqui...'
                @focus='isFocused = true'
                @blur='onRawSubBlur'
                @input='onCodeBodyInput($event.target.value)'
                @keydown='onCodeKeydown'
              )

        //- 5c. Tabela Markdown com células editáveis inline
        .detran-live-table-wrapper(v-else-if='rawKind === "table"')
          .detran-live-table-scroll
            table.detran-live-table
              thead
                tr
                  th(v-for='(header, colIdx) in rawTableData.headers' :key='"th-" + colIdx')
                    .editable-field.table-cell-editable.is-header-cell(
                      contenteditable='true'
                      spellcheck='false'
                      data-placeholder='Coluna'
                      :data-table-cell='"r-1-c" + colIdx'
                      @focus='isFocused = true'
                      @blur='onRawSubBlur'
                      @input='onTableHeaderInput(colIdx, $event)'
                      @keydown='onTableCellKeydown($event, -1, colIdx)'
                      @paste.stop='onInlineCellPaste'
                    )
              tbody
                tr(v-for='(row, rowIdx) in rawTableData.rows' :key='"tr-" + rowIdx')
                  td(v-for='(cell, colIdx) in row' :key='"td-" + rowIdx + "-" + colIdx')
                    .editable-field.table-cell-editable(
                      contenteditable='true'
                      spellcheck='false'
                      data-placeholder='...'
                      :data-table-cell='"r" + rowIdx + "-c" + colIdx'
                      @focus='isFocused = true'
                      @blur='onRawSubBlur'
                      @input='onTableBodyInput(rowIdx, colIdx, $event)'
                      @keydown='onTableCellKeydown($event, rowIdx, colIdx)'
                      @paste.stop='onInlineCellPaste'
                    )
          .detran-table-toolbar.select-none(v-if='isHovered || isFocused')
            .detran-table-toolbar__info
              v-icon(size='13' color='#475569') mdi-table
              span.detran-table-toolbar__title Tabela
              span.detran-table-toolbar__dim {{ rawTableData.rows.length }}×{{ rawTableData.headers.length }}
            .detran-table-toolbar__divider
            .detran-table-btn-group
              button.detran-table-btn.detran-table-btn--add(
                type='button'
                title='Adicionar nova linha no final da tabela'
                aria-label='Adicionar linha'
                @mousedown.prevent
                @click.stop='addTableRow()'
              )
                v-icon(size='13' color='#16a34a') mdi-table-row-plus-after
                span + Linha
              button.detran-table-btn.detran-table-btn--add(
                type='button'
                title='Adicionar nova coluna à direita da tabela'
                aria-label='Adicionar coluna'
                @mousedown.prevent
                @click.stop='addTableCol()'
              )
                v-icon(size='13' color='#16a34a') mdi-table-column-plus-after
                span + Coluna
            .detran-table-toolbar__divider
            .detran-table-btn-group
              button.detran-table-btn.detran-table-btn--remove(
                type='button'
                :disabled='rawTableData.rows.length <= 1'
                :title='rawTableData.rows.length <= 1 ? "A tabela deve ter no mínimo uma linha de dados" : "Remover a última linha da tabela"'
                aria-label='Remover última linha'
                @mousedown.prevent
                @click.stop='removeLastTableRow()'
              )
                v-icon(size='13' :color='rawTableData.rows.length <= 1 ? "#94a3b8" : "#dc2626"') mdi-table-row-remove
                span - Linha
              button.detran-table-btn.detran-table-btn--remove(
                type='button'
                :disabled='rawTableData.headers.length <= 1'
                :title='rawTableData.headers.length <= 1 ? "A tabela deve ter no mínimo uma coluna de cabeçalho" : "Remover a última coluna da tabela"'
                aria-label='Remover última coluna'
                @mousedown.prevent
                @click.stop='removeLastTableCol()'
              )
                v-icon(size='13' :color='rawTableData.headers.length <= 1 ? "#94a3b8" : "#dc2626"') mdi-table-column-remove
                span - Coluna

        //- 5d. Listas (marcadores, numeradas e checklists interativas)
        .detran-live-list-wrapper(v-else-if='rawKind === "list"')
          component.detran-live-list(
            :is='rawListData.ordered ? "ol" : "ul"'
            :class='{ "contains-task-list": rawListHasTasks }'
          )
            li(
              v-for='(item, itemIdx) in rawListData.items'
              :key='"li-" + itemIdx'
              :class='{ "task-list-item": item.checked !== null }'
              :style='item.indent ? { marginLeft: (Math.min(item.indent.length, 8) * 10) + "px" } : null'
            )
              input(
                v-if='item.checked !== null'
                type='checkbox'
                :checked='Boolean(item.checked)'
                @change='onListTaskToggle(itemIdx, $event.target.checked)'
              )
              span.editable-field.list-item-editable(
                :data-list-idx='itemIdx'
                contenteditable='true'
                spellcheck='false'
                data-placeholder='Item da lista...'
                @focus='isFocused = true'
                @blur='onRawSubBlur'
                @input='onListItemInput(itemIdx, $event)'
                @keydown='onListItemKeydown(itemIdx, $event)'
                @paste.stop='onInlineCellPaste'
              )

        //- 5e. Citação simples editável inline
        blockquote.detran-live-quote(v-else-if='rawKind === "quote"')
          p.editable-field(
            ref='rawQuoteEditable'
            contenteditable='true'
            spellcheck='false'
            data-placeholder='Digite uma citação...'
            @focus='isFocused = true'
            @blur='onRawSubBlur'
            @input='onRawQuoteInput'
            @keydown='onRawQuoteKeydown'
            @paste.stop='onInlineCellPaste'
          )

        //- 5f. Diagrama Mermaid com prévia SVG ao vivo + editor inline colapsável
        .detran-live-mermaid(v-else-if='rawKind === "mermaid"')
          .detran-raw-preview(
            ref='rawPreview'
            tabindex='0'
            @click='toggleMermaidEditor'
            @keydown='onNonTextBlockKeydown'
            title='Clique para editar o diagrama Mermaid em tempo real'
          )
            .mermaid(ref='mermaidContainer') {{ rawCodeData.code }}
          .detran-mermaid-actions.select-none(v-if='isHovered || isFocused || isEditingMermaid')
            button.detran-inline-chip-btn(
              type='button'
              @mousedown.prevent
              @click.stop='toggleMermaidEditor'
            )
              v-icon(size='13') {{ isEditingMermaid ? "mdi-chevron-up" : "mdi-pencil-outline" }}
              span {{ isEditingMermaid ? "Ocultar código Mermaid" : "Editar diagrama ao vivo" }}
          .detran-live-code.mt-2(v-if='isEditingMermaid')
            .detran-live-code__header.select-none
              span.detran-live-code__badge
                v-icon(size='13' color='#94a3b8') mdi-sitemap
                span.caption.grey--text.text--lighten-1 mermaid (atualização em tempo real)
              span.detran-live-code__hint {{ mermaidError || "SVG atualizado ao vivo" }}
            pre.detran-live-code__pre
              code
                textarea.detran-live-code__textarea(
                  ref='codeTextarea'
                  :value='rawCodeData.code'
                  :rows='rawCodeRows'
                  spellcheck='false'
                  @focus='isFocused = true'
                  @blur='onRawSubBlur'
                  @input='onCodeBodyInput($event.target.value)'
                  @keydown='onCodeKeydown'
                )

        //- 5g. Draw.io SVG / Fallback estrutural
        template(v-else)
          .detran-raw-preview(
            ref='rawPreview'
            tabindex='0'
            @click='rawKind === "unknown" ? startRawEdit() : null'
            @keydown='onNonTextBlockKeydown'
            :title='rawKind === "unknown" ? "Clique para editar este bloco (ou Delete para excluir)" : "Diagrama (Delete para excluir)"'
            v-html='renderedRawHtml'
          )
          .detran-raw-editor.mt-2.pa-3.rounded-lg(v-if='isEditingRaw && rawKind === "unknown"')
            .d-flex.align-center.justify-space-between.mb-2
              span.caption.font-weight-bold.grey--text.text--darken-2 Edição em Tempo Real
              v-btn(
                x-small
                depressed
                color='#1b6535'
                dark
                class='text-none caption'
                @click='finishRawEdit'
              ) Concluir
            v-textarea(
              ref='rawInput'
              v-model='rawText'
              solo
              flat
              dense
              auto-grow
              hide-details
              background-color='rgba(248, 250, 252, 0.92)'
              class='caption font-monospace'
              @input='onRawChange'
              @keydown.esc='finishRawEdit'
            )

    //- 6. PARÁGRAFO PADRÃO (<p> semântico herdando .detran-contents p)
    template(v-else)
      p.editable-field(
        ref='editable'
        contenteditable='true'
        spellcheck='false'
        :data-placeholder='$t("common:editor.paragraphPlaceholder", "Digite \x27/\x27 para comandos ou apenas escreva...")'
        @input='onInputText'
        @keydown='onKeydown'
        @paste='onPaste'
        @focus='isFocused = true'
        @blur='onBlurText'
      )

  //- Ação rápida de exclusão do bloco (visível no hover/foco)
  button.block-delete-btn.select-none(
    type='button'
    title='Excluir bloco'
    aria-label='Excluir bloco'
    @mousedown.prevent
    @click.stop='$emit("delete-block", index)'
  )
    v-icon(size='14') mdi-trash-can-outline
</template>

<script>
import {
  detectSlashTrigger,
  getCaretTriggerRect,
  updateLinkCardItem,
  handleMarkdownPrefixTrigger
} from './utils/editor-controller'
import mermaid from 'mermaid'
import {
  inlineMarkdownToHtml,
  inlineHtmlToMarkdown,
  renderRawBlockHtml,
  detectRawBlockKind,
  parseRawCodeBlock,
  serializeRawCodeBlock,
  parseRawTable,
  serializeRawTable,
  insertTableRow,
  removeTableRow,
  insertTableColumn,
  removeTableColumn,
  parseRawList,
  serializeRawList,
  parseRawQuote,
  serializeRawQuote,
  slugify
} from './utils/markdown-blocks'

export default {
  name: 'BlockItem',
  props: {
    block: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    draggingIndex: {
      type: Number,
      default: null
    }
  },
  data () {
    return {
      isHovered: false,
      isFocused: false,
      isEditingRaw: false,
      isEditingMermaid: false,
      mermaidError: '',
      rawText: this.block.text || '',
      isDragArmed: false,
      isDragging: false,
      dragOverPos: null
    }
  },
  computed: {
    blockClass () {
      return `block-type-${this.block.type}`
    },
    headingTag () {
      const lvl = Number(this.block.level) || 2
      const clamped = Math.max(1, Math.min(6, lvl))
      return `h${clamped}`
    },
    headingAnchor () {
      return this.block.anchor || slugify(this.block.text || '')
    },
    calloutClass () {
      const variant = this.block.variant || 'info'
      return `is-${variant}`
    },
    calloutVariantOptions () {
      return [
        { id: 'info', label: 'Info' },
        { id: 'success', label: 'Sucesso' },
        { id: 'warning', label: 'Aviso' },
        { id: 'danger', label: 'Perigo' }
      ]
    },
    renderedHtml () {
      return inlineMarkdownToHtml(this.block.text || '')
    },
    renderedRawHtml () {
      const source = this.isEditingRaw ? this.rawText : (this.block.text || '')
      return renderRawBlockHtml(source)
    },
    rawKind () {
      if (this.block.type !== 'raw') return 'unknown'
      return detectRawBlockKind(this.block.text || '')
    },
    rawCodeData () {
      return parseRawCodeBlock(this.block.text || '')
    },
    rawCodeRows () {
      const lines = String((this.rawCodeData && this.rawCodeData.code) || '').split('\n').length
      return Math.max(2, lines)
    },
    rawTableData () {
      return parseRawTable(this.block.text || '')
    },
    rawListData () {
      return parseRawList(this.block.text || '')
    },
    rawListHasTasks () {
      return Array.isArray(this.rawListData.items) && this.rawListData.items.some(i => i.checked !== null)
    },
    rawQuoteText () {
      return parseRawQuote(this.block.text || '')
    }
  },
  watch: {
    'block.text' (newVal) {
      this.rawText = newVal || ''
      if (!this.isFocused) {
        this.syncEditableDom(false)
      }
      this.$nextTick(() => {
        this.autoSizeCodeTextarea()
        this.renderRawMermaidIfNeeded()
      })
    },
    'block.type' () {
      this.$nextTick(() => {
        this.syncEditableDom(true)
        this.autoSizeCodeTextarea()
        this.renderRawMermaidIfNeeded()
      })
    },
    renderedRawHtml () {
      this.$nextTick(() => {
        this.renderRawMermaidIfNeeded()
      })
    }
  },
  mounted () {
    this.syncEditableDom(true)
    this.$nextTick(() => {
      this.autoSizeCodeTextarea()
      this.renderRawMermaidIfNeeded()
    })
  },
  methods: {
    syncEditableDom (force = false) {
      const el = this.$refs.editable
      if (el && this.block.type !== 'image' && this.block.type !== 'links' && this.block.type !== 'raw') {
        const html = this.renderedHtml
        if (el.innerHTML !== html && (force || (typeof document === 'undefined' || document.activeElement !== el))) {
          el.innerHTML = html
        }
        return
      }
      if (this.block.type === 'raw') {
        this.syncRawInlineDom(force)
      }
    },
    syncRawInlineDom (force = false) {
      if (!this.$el || typeof this.$el.querySelectorAll !== 'function') return
      const active = typeof document !== 'undefined' ? document.activeElement : null

      if (this.rawKind === 'table') {
        const { headers, rows } = this.rawTableData
        headers.forEach((txt, colIdx) => {
          const cellEl = this.$el.querySelector(`[data-table-cell="r-1-c${colIdx}"]`)
          if (cellEl && (force || active !== cellEl)) {
            const html = inlineMarkdownToHtml(txt)
            if (cellEl.innerHTML !== html) cellEl.innerHTML = html
          }
        })
        rows.forEach((row, rowIdx) => {
          row.forEach((txt, colIdx) => {
            const cellEl = this.$el.querySelector(`[data-table-cell="r${rowIdx}-c${colIdx}"]`)
            if (cellEl && (force || active !== cellEl)) {
              const html = inlineMarkdownToHtml(txt)
              if (cellEl.innerHTML !== html) cellEl.innerHTML = html
            }
          })
        })
      } else if (this.rawKind === 'list') {
        const { items } = this.rawListData
        items.forEach((item, idx) => {
          const itemEl = this.$el.querySelector(`[data-list-idx="${idx}"]`)
          if (itemEl && (force || active !== itemEl)) {
            const html = inlineMarkdownToHtml(item.text || '')
            if (itemEl.innerHTML !== html) itemEl.innerHTML = html
          }
        })
      } else if (this.rawKind === 'quote') {
        const qEl = this.$refs.rawQuoteEditable
        if (qEl && (force || active !== qEl)) {
          const html = inlineMarkdownToHtml(this.rawQuoteText || '')
          if (qEl.innerHTML !== html) qEl.innerHTML = html
        }
      }
    },
    autoSizeCodeTextarea () {
      const ta = this.$refs.codeTextarea
      if (!ta || !ta.style) return
      ta.style.height = 'auto'
      if (ta.scrollHeight > 0) {
        ta.style.height = `${ta.scrollHeight}px`
      }
    },
    renderRawMermaidIfNeeded () {
      if (this.block.type !== 'raw') return
      if (this.rawKind === 'mermaid' && this.$refs.mermaidContainer) {
        const elm = this.$refs.mermaidContainer
        const code = (this.rawCodeData && this.rawCodeData.code ? this.rawCodeData.code : '').trim()
        if (!code || elm.dataset.mermaidCode === code) return
        try {
          if (typeof mermaid.parse === 'function') {
            mermaid.parse(code)
          }
          const diagramId = `block-mermaid-${this.index}-${Date.now()}`
          mermaid.render(diagramId, code, (svgCode) => {
            elm.innerHTML = svgCode
            elm.dataset.mermaidCode = code
            this.mermaidError = ''
          })
        } catch (err) {
          this.mermaidError = 'Sintaxe incompleta...'
        }
        return
      }

      if (!this.$refs.rawPreview) return
      const mermaidNodes = this.$refs.rawPreview.querySelectorAll('.mermaid')
      if (!mermaidNodes || !mermaidNodes.length) return
      mermaidNodes.forEach((elm, idx) => {
        if (elm.dataset.mermaidRendered === 'true') return
        const code = (elm.textContent || '').trim()
        if (!code) return
        try {
          const diagramId = `block-mermaid-${this.index}-${Date.now()}-${idx}`
          mermaid.render(diagramId, code, (svgCode) => {
            elm.innerHTML = svgCode
            elm.dataset.mermaidRendered = 'true'
          })
        } catch (err) {}
      })
    },
    onChangeCalloutVariant (variant) {
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('update-block', {
        index: this.index,
        block: {
          ...this.block,
          variant
        }
      })
    },
    placeCaretAtEnd (el) {
      if (!el || typeof window === 'undefined' || !window.getSelection) return
      try {
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      } catch (err) {}
    },
    onInputText (e) {
      const mdText = inlineHtmlToMarkdown(e.target.innerHTML)

      // Gatilho Markdown estrutural em tempo real (#, ##, ###, -, *, 1., >, ```lang , [ ] , [!info])
      if (this.block.type === 'paragraph' || this.block.type === 'callout') {
        const prefixRes = handleMarkdownPrefixTrigger(mdText, this.block)
        if (prefixRes && prefixRes.triggered) {
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('update-block', {
            index: this.index,
            block: prefixRes.block
          })
          this.$nextTick(() => {
            this.syncEditableDom(true)
            this.focus({ caretAtEnd: true })
          })
          return
        }
      }

      // Estilização inline em tempo real ao fechar padrões Markdown (**negrito**, *itálico*, `código`, ~~riscado~~, [link](url), <strong>...</strong>)
      const plainText = e.target.textContent || ''
      if (/(\*\*[^*\s][^*\n]*\*\*|\*[^*\s][^*\n]*\*|`[^`\n]+`|~~[^~\s][^~\n]*~~|\[[^\]]+\]\([^)]+\)|<(?:strong|b|em|i|u|code|s|mark|kbd)\b[^>]*>[\s\S]+?<\/(?:strong|b|em|i|u|code|s|mark|kbd)>)/i.test(plainText)) {
        const liveHtml = inlineMarkdownToHtml(mdText)
        if (liveHtml !== e.target.innerHTML) {
          e.target.innerHTML = liveHtml
          this.placeCaretAtEnd(e.target)
        }
      }

      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('update-block', {
        index: this.index,
        block: {
          ...this.block,
          text: mdText
        }
      })

      if (detectSlashTrigger(mdText)) {
        const rect = getCaretTriggerRect(e.target, typeof window !== 'undefined' ? window : null)
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('slash-command', {
          index: this.index,
          rect
        })
      }
    },
    onPaste (e) {
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('smart-paste', {
        index: this.index,
        event: e
      })
    },
    getScrollContainer () {
      return this.$el && this.$el.closest ? this.$el.closest('.detran-content') : null
    },
    armDrag () {
      this.isDragArmed = true
    },
    disarmDrag () {
      if (!this.isDragging) {
        this.isDragArmed = false
      }
    },
    onBlockMouseLeave () {
      this.isHovered = false
      if (!this.isDragging) {
        this.isDragArmed = false
      }
    },
    onDragStart (e) {
      if (!this.isDragArmed) {
        e.preventDefault()
        return
      }
      this.isDragging = true
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(this.index))
      }
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('drag-start', this.index)
    },
    onDragOver (e) {
      if (this.draggingIndex === null || this.draggingIndex === this.index) {
        this.dragOverPos = null
        return
      }
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      const rect = this.$el && this.$el.getBoundingClientRect ? this.$el.getBoundingClientRect() : null
      if (!rect) return
      const midY = rect.top + (rect.height / 2)
      this.dragOverPos = e.clientY < midY ? 'top' : 'bottom'
    },
    onDragLeave (e) {
      if (this.$el && e.relatedTarget && this.$el.contains(e.relatedTarget)) {
        return
      }
      this.dragOverPos = null
    },
    onDrop (e) {
      const pos = this.dragOverPos || 'bottom'
      this.dragOverPos = null
      let fromIdx = this.draggingIndex
      if ((fromIdx === null || fromIdx === undefined) && e.dataTransfer) {
        const parsed = parseInt(e.dataTransfer.getData('text/plain'), 10)
        if (!Number.isNaN(parsed)) fromIdx = parsed
      }
      if (fromIdx === null || fromIdx === undefined || fromIdx === this.index) return
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('drop-block', {
        fromIndex: fromIdx,
        targetIndex: this.index,
        position: pos
      })
    },
    onDragEnd () {
      this.isDragging = false
      this.isDragArmed = false
      this.dragOverPos = null
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('drag-end')
    },
    onNonTextBlockKeydown (e) {
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) {
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('delete-block', this.index)
      }
    },
    onBlurText () {
      const scrollContainer = this.getScrollContainer()
      const savedTop = scrollContainer ? scrollContainer.scrollTop : null
      this.isFocused = false
      this.syncEditableDom()
      if (scrollContainer !== null && savedTop !== null && Math.abs(scrollContainer.scrollTop - savedTop) > 2) {
        scrollContainer.scrollTop = savedTop
      }
    },
    onKeydown (e) {
      const isMod = e.ctrlKey || e.metaKey

      // Formatação inline rápida (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+K)
      if (this.handleInlineFormattingShortcut(e, () => {
        if (this.$refs.editable) this.onInputText({ target: this.$refs.editable })
      })) {
        return
      }

      // Transformação de cabeçalhos / parágrafo via atalho (Ctrl+Alt+1..3, Ctrl+Alt+0)
      if (isMod && e.altKey) {
        if (e.key === '1' || e.key === '2' || e.key === '3') {
          e.preventDefault()
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('transform-block', {
            index: this.index,
            type: 'heading',
            level: parseInt(e.key, 10)
          })
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('transform-block', {
            index: this.index,
            type: 'paragraph'
          })
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        if (this.block.type === 'paragraph' && this.$refs.editable) {
          const line = inlineHtmlToMarkdown(this.$refs.editable.innerHTML).trim()
          const fenceMatch = line.match(/^(```|~~~)([a-zA-Z0-9_-]*)$/)
          if (fenceMatch) {
            e.preventDefault()
            this.emitRawText(`${fenceMatch[1]}${fenceMatch[2] || ''}\n\n${fenceMatch[1]}`)
            this.$nextTick(() => {
              this.syncEditableDom(true)
              this.focus()
            })
            return
          }
          if (/^(?:[-]{3,}|[*]{3,}|[_]{3,})$/.test(line)) {
            e.preventDefault()
            this.emitRawText('---')
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$emit('insert-below', this.index)
            return
          }
          if (/^\|.+\|$/.test(line)) {
            const cols = line.slice(1, -1).split('|').map(c => c.trim() || 'Coluna')
            if (cols.length >= 1) {
              e.preventDefault()
              const sep = cols.map(() => '---')
              const empty = cols.map(() => '')
              const tblText = `| ${cols.join(' | ')} |\n| ${sep.join(' | ')} |\n| ${empty.join(' | ')} |`
              this.emitRawText(tblText)
              this.$nextTick(() => {
                this.syncEditableDom(true)
                this.focusTableCell(0, 0)
              })
              return
            }
          }
        }
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('insert-below', this.index)
      } else if (e.key === 'Backspace' && isMod && e.shiftKey) {
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('delete-block', this.index)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        const rawContent = e.target ? (e.target.textContent || '') : ''
        const cleanText = rawContent.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim()
        if (!cleanText) {
          e.preventDefault()
          if (e.key === 'Backspace' && (this.block.type === 'heading' || this.block.type === 'callout')) {
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$emit('transform-block', {
              index: this.index,
              type: 'paragraph'
            })
            return
          }
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('delete-block', this.index)
        }
      }
    },
    handleInlineFormattingShortcut (e, afterFormatCb) {
      const isMod = e.ctrlKey || e.metaKey
      if (!isMod || e.altKey) return false
      const key = (e.key || '').toLowerCase()
      if (key === 'b' || key === 'i' || key === 'u') {
        e.preventDefault()
        const cmd = key === 'b' ? 'bold' : (key === 'i' ? 'italic' : 'underline')
        document.execCommand(cmd, false, null)
        if (typeof afterFormatCb === 'function') afterFormatCb()
        return true
      }
      if (key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('open-link-popover')
        return true
      }
      return false
    },
    emitRawText (text) {
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('update-block', {
        index: this.index,
        block: {
          ...this.block,
          type: 'raw',
          text
        }
      })
    },
    onRawSubBlur () {
      this.isFocused = false
    },
    onInlineCellPaste (e) {
      if (!e || !e.clipboardData) return
      const plain = e.clipboardData.getData('text/plain')
      if (!plain) return
      e.preventDefault()
      document.execCommand('insertText', false, plain.replace(/\r?\n/g, ' '))
    },
    onCodeLangInput (lang) {
      const parsed = this.rawCodeData
      this.emitRawText(serializeRawCodeBlock({ ...parsed, lang }))
    },
    onCodeBodyInput (code) {
      const parsed = this.rawCodeData
      this.emitRawText(serializeRawCodeBlock({ ...parsed, code }))
      this.$nextTick(() => this.autoSizeCodeTextarea())
    },
    onCodeKeydown (e) {
      const isMod = e.ctrlKey || e.metaKey
      if (e.key === 'Backspace' && isMod && e.shiftKey) {
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('delete-block', this.index)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const ta = e.target
        const start = ta.selectionStart || 0
        const end = ta.selectionEnd || 0
        const val = ta.value || ''
        const nextVal = val.slice(0, start) + '  ' + val.slice(end)
        ta.value = nextVal
        if (typeof ta.setSelectionRange === 'function') {
          ta.setSelectionRange(start + 2, start + 2)
        }
        this.onCodeBodyInput(nextVal)
      }
    },
    onTableHeaderInput (colIdx, e) {
      const table = parseRawTable(this.block.text || '')
      table.headers[colIdx] = inlineHtmlToMarkdown(e.target.innerHTML)
      this.emitRawText(serializeRawTable(table))
    },
    onTableBodyInput (rowIdx, colIdx, e) {
      const table = parseRawTable(this.block.text || '')
      if (table.rows[rowIdx]) {
        table.rows[rowIdx][colIdx] = inlineHtmlToMarkdown(e.target.innerHTML)
        this.emitRawText(serializeRawTable(table))
      }
    },
    focusTableCell (rowIdx, colIdx, caretAtEnd = true) {
      if (!this.$el || typeof this.$el.querySelector !== 'function') return
      const el = this.$el.querySelector(`[data-table-cell="r${rowIdx}-c${colIdx}"]`)
      if (!el || typeof el.focus !== 'function') return
      try {
        el.focus({ preventScroll: true })
      } catch (err) {
        el.focus()
      }
      if (caretAtEnd) this.placeCaretAtEnd(el)
    },
    onTableCellKeydown (e, rowIdx, colIdx) {
      const isMod = e.ctrlKey || e.metaKey
      if (e.key === 'Backspace' && isMod && e.shiftKey) {
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('delete-block', this.index)
        return
      }
      if (this.handleInlineFormattingShortcut(e, () => {
        if (rowIdx === -1) this.onTableHeaderInput(colIdx, e)
        else this.onTableBodyInput(rowIdx, colIdx, e)
      })) {
        return
      }
      const { headers, rows } = this.rawTableData
      const colCount = headers.length
      if (e.key === 'Tab') {
        e.preventDefault()
        let nextRow = rowIdx
        let nextCol = colIdx + (e.shiftKey ? -1 : 1)
        if (nextCol >= colCount) {
          nextCol = 0
          nextRow++
        } else if (nextCol < 0) {
          nextCol = colCount - 1
          nextRow--
        }
        if (nextRow < -1) return
        if (nextRow >= rows.length) {
          this.addTableRow(nextRow, 0)
          return
        }
        this.focusTableCell(nextRow, nextCol)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const targetRow = rowIdx + 1
        if (targetRow >= rows.length) {
          this.addTableRow(targetRow, colIdx)
        } else {
          this.focusTableCell(targetRow, colIdx)
        }
      }
    },
    addTableRow (focusRowIdx = null, focusColIdx = 0) {
      const next = insertTableRow(this.rawTableData)
      this.emitRawText(serializeRawTable(next))
      this.$nextTick(() => {
        this.syncRawInlineDom(true)
        const targetRow = typeof focusRowIdx === 'number' ? focusRowIdx : next.rows.length - 1
        this.focusTableCell(targetRow, focusColIdx, false)
      })
    },
    removeLastTableRow () {
      const next = removeTableRow(this.rawTableData)
      this.emitRawText(serializeRawTable(next))
      this.$nextTick(() => this.syncRawInlineDom(true))
    },
    addTableCol () {
      const next = insertTableColumn(this.rawTableData)
      this.emitRawText(serializeRawTable(next))
      this.$nextTick(() => {
        this.syncRawInlineDom(true)
        this.focusTableCell(-1, next.headers.length - 1, true)
      })
    },
    removeLastTableCol () {
      const next = removeTableColumn(this.rawTableData)
      this.emitRawText(serializeRawTable(next))
      this.$nextTick(() => this.syncRawInlineDom(true))
    },
    onListTaskToggle (itemIdx, checked) {
      const list = parseRawList(this.block.text || '')
      if (list.items[itemIdx]) {
        list.items[itemIdx].checked = Boolean(checked)
        this.emitRawText(serializeRawList(list))
      }
    },
    onListItemInput (itemIdx, e) {
      const list = parseRawList(this.block.text || '')
      if (list.items[itemIdx]) {
        list.items[itemIdx].text = inlineHtmlToMarkdown(e.target.innerHTML)
        this.emitRawText(serializeRawList(list))
      }
    },
    focusListItem (itemIdx, caretAtEnd = true) {
      if (!this.$el || typeof this.$el.querySelector !== 'function') return
      const el = this.$el.querySelector(`[data-list-idx="${itemIdx}"]`)
      if (!el || typeof el.focus !== 'function') return
      try {
        el.focus({ preventScroll: true })
      } catch (err) {
        el.focus()
      }
      if (caretAtEnd) this.placeCaretAtEnd(el)
    },
    onListItemKeydown (itemIdx, e) {
      const isMod = e.ctrlKey || e.metaKey
      if (e.key === 'Backspace' && isMod && e.shiftKey) {
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('delete-block', this.index)
        return
      }
      if (this.handleInlineFormattingShortcut(e, () => this.onListItemInput(itemIdx, e))) {
        return
      }
      const list = parseRawList(this.block.text || '')
      const current = list.items[itemIdx]
      if (!current) return

      if (e.key === 'Tab') {
        e.preventDefault()
        current.indent = e.shiftKey ?
          (current.indent || '').slice(2) :
          `${current.indent || ''}  `.slice(0, 8)
        this.emitRawText(serializeRawList(list))
        this.$nextTick(() => {
          this.syncRawInlineDom(true)
          this.focusListItem(itemIdx, true)
        })
        return
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const clean = String(current.text || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim()
        if (!clean && list.items.length > 1) {
          list.items.splice(itemIdx, 1)
          this.emitRawText(serializeRawList(list))
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('insert-below', this.index)
          return
        }
        if (!clean && list.items.length === 1) {
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('transform-block', { index: this.index, type: 'paragraph' })
          return
        }
        list.items.splice(itemIdx + 1, 0, {
          indent: current.indent || '',
          marker: current.marker || '-',
          checked: current.checked !== null ? false : null,
          text: ''
        })
        this.emitRawText(serializeRawList(list))
        this.$nextTick(() => {
          this.syncRawInlineDom(true)
          this.focusListItem(itemIdx + 1, false)
        })
        return
      }

      if (e.key === 'Backspace') {
        const clean = String(e.target ? e.target.textContent : '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim()
        if (!clean) {
          e.preventDefault()
          if (list.items.length > 1) {
            list.items.splice(itemIdx, 1)
            this.emitRawText(serializeRawList(list))
            this.$nextTick(() => {
              this.syncRawInlineDom(true)
              this.focusListItem(Math.max(0, itemIdx - 1), true)
            })
          } else {
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$emit('transform-block', { index: this.index, type: 'paragraph' })
          }
        }
      }
    },
    onRawQuoteInput (e) {
      const md = inlineHtmlToMarkdown(e.target.innerHTML)
      this.emitRawText(serializeRawQuote(md))
    },
    onRawQuoteKeydown (e) {
      const isMod = e.ctrlKey || e.metaKey
      if (e.key === 'Backspace' && isMod && e.shiftKey) {
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('delete-block', this.index)
        return
      }
      if (this.handleInlineFormattingShortcut(e, () => {
        if (this.$refs.rawQuoteEditable) this.onRawQuoteInput({ target: this.$refs.rawQuoteEditable })
      })) {
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('insert-below', this.index)
        return
      }
      if (e.key === 'Backspace') {
        const clean = String(e.target ? e.target.textContent : '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim()
        if (!clean) {
          e.preventDefault()
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('transform-block', { index: this.index, type: 'paragraph' })
        }
      }
    },
    toggleMermaidEditor () {
      this.isEditingMermaid = !this.isEditingMermaid
      if (this.isEditingMermaid) {
        this.isFocused = true
        this.$nextTick(() => {
          this.autoSizeCodeTextarea()
          if (this.$refs.codeTextarea && typeof this.$refs.codeTextarea.focus === 'function') {
            this.$refs.codeTextarea.focus()
          }
        })
      }
    },
    onLinkTitleChange (idx, e) {
      this.isFocused = false
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('update-block', {
        index: this.index,
        block: updateLinkCardItem(this.block, idx, 'title', e.target.innerText)
      })
    },
    onLinkDescChange (idx, e) {
      this.isFocused = false
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('update-block', {
        index: this.index,
        block: updateLinkCardItem(this.block, idx, 'description', e.target.innerText)
      })
    },
    onImageCaptionInput (e) {
      const title = (e.target.innerText || '').trim()
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('update-block', {
        index: this.index,
        block: {
          ...this.block,
          title
        }
      })
    },
    startRawEdit () {
      this.rawText = this.block.text || ''
      this.isEditingRaw = true
      this.isFocused = true
      this.$nextTick(() => {
        if (this.$refs.rawInput && typeof this.$refs.rawInput.focus === 'function') {
          this.$refs.rawInput.focus()
        }
      })
    },
    finishRawEdit () {
      const scrollContainer = this.getScrollContainer()
      const savedTop = scrollContainer ? scrollContainer.scrollTop : null
      this.isEditingRaw = false
      this.isFocused = false
      this.onRawChange()
      this.$nextTick(() => {
        if (this.$refs.rawPreview && typeof this.$refs.rawPreview.focus === 'function') {
          try {
            this.$refs.rawPreview.focus({ preventScroll: true })
          } catch (err) {
            this.$refs.rawPreview.focus()
          }
        }
        if (scrollContainer !== null && savedTop !== null) {
          const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
          const targetTop = Math.min(savedTop, maxTop)
          const prevBehavior = scrollContainer.style.scrollBehavior
          scrollContainer.style.setProperty('scroll-behavior', 'auto', 'important')
          scrollContainer.scrollTop = targetTop
          this.$nextTick(() => {
            scrollContainer.scrollTop = Math.min(savedTop, Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight))
            if (prevBehavior) {
              scrollContainer.style.scrollBehavior = prevBehavior
            } else {
              scrollContainer.style.removeProperty('scroll-behavior')
            }
          })
        }
      })
    },
    onRawChange () {
      /* eslint-disable-next-line vue/custom-event-name-casing */
      this.$emit('update-block', {
        index: this.index,
        block: {
          ...this.block,
          text: this.rawText
        }
      })
    },
    focus (options = {}) {
      this.$nextTick(() => {
        let el = this.$refs.editable || this.$refs.codeTextarea || this.$refs.rawQuoteEditable || this.$refs.rawPreview || this.$el
        if (this.block.type === 'raw' && this.$el && typeof this.$el.querySelector === 'function') {
          if (this.rawKind === 'list') {
            el = this.$el.querySelector('[data-list-idx="0"]') || el
          } else if (this.rawKind === 'table') {
            el = this.$el.querySelector('[data-table-cell="r0-c0"]') || this.$el.querySelector('[data-table-cell="r-1-c0"]') || el
          }
        }
        if (!el || typeof el.focus !== 'function') return
        const scrollContainer = this.getScrollContainer()
        const savedTop = scrollContainer ? scrollContainer.scrollTop : null
        try {
          el.focus({ preventScroll: true })
        } catch (err) {
          el.focus()
        }
        if (options.caretAtEnd && el.isContentEditable && typeof window !== 'undefined' && window.getSelection) {
          this.placeCaretAtEnd(el)
        }
        if (scrollContainer && el.getBoundingClientRect) {
          const containerRect = scrollContainer.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          if (savedTop !== null && Math.abs(scrollContainer.scrollTop - savedTop) > 4) {
            scrollContainer.scrollTop = savedTop
          }
          if (elRect.bottom > containerRect.bottom - 24) {
            scrollContainer.scrollTop += (elRect.bottom - containerRect.bottom + 48)
          } else if (elRect.top < containerRect.top + 76) {
            scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - (containerRect.top + 84 - elRect.top))
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
// =============================================================================
// ESTILO DE EDIÇÃO TRANSPARENTE (NOTION-LIKE) — FIEL AO PROTÓTIPO DETRAN-MG
// Ref: prototipo_intranet_detran_mg_edicao_transparente.html (linhas 54-75 e 398-450)
// =============================================================================
.notion-block {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 4px 6px 6px;
  margin-left: -32px;
  margin-right: -28px;
  margin-bottom: 12px;
  border-radius: 0.5rem;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;

  background-color: transparent !important;

  @media (max-width: 767px) {
    margin-left: -12px;
    margin-right: 0;
    padding: 6px 2px;
  }

  &:hover,
  &.is-hovered {
    background-color: rgba(241, 245, 249, 0.28) !important;
  }

  &:focus-within,
  &.is-focused {
    background-color: transparent !important;
    box-shadow: inset 2px 0 0 rgba(46, 160, 88, 0.45) !important;
  }

  &.block-type-callout,
  &.block-type-links,
  &.block-type-image,
  &.block-type-raw {
    &:hover,
    &.is-hovered,
    &:focus-within,
    &.is-focused {
      background-color: transparent !important;
      box-shadow: none !important;
    }
  }

  &.is-dragging {
    opacity: 0.45;
    background-color: #f8fafc !important;
  }

  &.is-drag-over-top {
    box-shadow: inset 0 3px 0 #288b4a !important;
  }

  &.is-drag-over-bottom {
    box-shadow: inset 0 -3px 0 #288b4a !important;
  }

  &.block-type-heading {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;

    &:first-child {
      margin-top: 0;
    }

    .block-handle {
      padding-top: 8px;
    }

    .block-delete-btn {
      margin-top: 6px;
    }
  }

  &.block-type-callout {
    margin-top: 0.75rem;
    margin-bottom: 0.75rem;

    .block-handle {
      padding-top: 14px;
    }

    .block-delete-btn {
      margin-top: 10px;
    }
  }
}

.block-handle {
  width: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0px;
  padding-top: 4px;
  color: #cbd5e1;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
  cursor: grab;

  .notion-block:hover &,
  .notion-block.is-hovered &,
  .notion-block:focus-within &,
  .notion-block.is-focused & {
    opacity: 1;
  }

  &:hover {
    color: #64748b;
  }

  .handle-add-btn {
    width: 11px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;

    .v-icon {
      color: inherit !important;
    }

    &:hover {
      background-color: #e2e8f0;
      color: #475569;
    }
  }

  .handle-grip {
    width: 12px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: inherit !important;
    cursor: grab;

    .v-icon {
      color: inherit !important;
    }

    &:active {
      cursor: grabbing;
    }
  }
}

.block-delete-btn {
  width: 24px;
  height: 24px;
  margin-top: 2px;
  flex-shrink: 0;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  z-index: 2;

  .v-icon {
    color: inherit !important;
  }

  .notion-block:hover &,
  .notion-block.is-hovered &,
  .notion-block:focus-within &,
  .notion-block.is-focused & {
    opacity: 1;
    pointer-events: auto;
  }

  &:hover {
    color: #dc2626;
    background: #fef2f2;
  }
}

.block-content {
  flex: 1;
  min-width: 0;

  > p,
  > h1,
  > h2,
  > h3,
  > h4,
  > h5,
  > h6,
  > blockquote,
  > ul,
  > ol,
  > figure {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
  }
}

.editable-field {
  outline: none;
  min-height: 1.5em;
  word-break: break-word;
  cursor: text;

  &:empty::before {
    content: attr(data-placeholder);
    color: #94a3b8;
    pointer-events: none;
    display: block;
    font-weight: 400;
  }
}

.detran-live-callout {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;

  &::before {
    top: 1.125rem !important;
    transform: none !important;
  }
}

.callout-variant-switcher {
  align-self: flex-end;
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
  max-width: 100%;
  background: rgba(255, 255, 255, 0.95);
  padding: 3px 4px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  box-shadow: 0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
  user-select: none;

  &__label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    padding: 0 5px 0 4px;
  }

  // Garante isolamento total: nenhum pseudo-elemento de .is-info, etc. pode invadir o switcher
  &,
  * {
    box-sizing: border-box;

    &::before,
    &::after {
      content: none !important;
      display: none !important;
    }
  }
}

.callout-variant-btn {
  appearance: none;
  border: 1px solid transparent !important;
  background: transparent !important;
  padding: 3px 8px !important;
  margin: 0 !important;
  border-radius: 6px !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
  color: #64748b !important;
  cursor: pointer;
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  box-shadow: none !important;
  transform: none !important;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: #f1f5f9 !important;
    color: #1e293b !important;
    transform: none !important;
    box-shadow: none !important;
  }

  &.is-active {
    font-weight: 700 !important;

    &.variant-btn--info {
      background: #eff6ff !important;
      color: #1d4ed8 !important;
      border-color: #bfdbfe !important;
    }

    &.variant-btn--success {
      background: #f0fdf4 !important;
      color: #15803d !important;
      border-color: #bbf7d0 !important;
    }

    &.variant-btn--warning {
      background: #fffbeb !important;
      color: #b45309 !important;
      border-color: #fde68a !important;
    }

    &.variant-btn--danger {
      background: #fef2f2 !important;
      color: #b91c1c !important;
      border-color: #fecaca !important;
    }
  }
}

.variant-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  flex-shrink: 0;
  display: inline-block;

  &--info { background-color: #2563eb; }
  &--success { background-color: #16a34a; }
  &--warning { background-color: #d97706; }
  &--danger { background-color: #dc2626; }
}

.variant-label {
  font-size: 11px;
  line-height: 1;
}

.detran-live-hr {
  padding: 6px 0;
  cursor: pointer;

  &:focus {
    outline: 2px solid rgba(40, 139, 74, 0.35);
    border-radius: 6px;
  }

  hr {
    margin: 0 !important;
  }
}

.detran-live-code {
  background-color: #1e293b;
  color: #f1f5f9;
  border-radius: 0.75rem;
  box-shadow: 0 4px 14px -2px rgba(15, 23, 42, 0.14);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 14px;
    background: rgba(15, 23, 42, 0.55);
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__lang-input {
    background: rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    font-weight: 600;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    width: 96px;
    outline: none;

    &:focus {
      border-color: #4ade80;
      background: rgba(255, 255, 255, 0.14);
    }
  }

  &__hint {
    font-size: 11px;
    color: #94a3b8;
  }

  &__pre {
    margin: 0 !important;
    padding: 1rem 1.25rem !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
  }

  &__textarea {
    display: block;
    width: 100%;
    min-height: 48px;
    padding: 0;
    margin: 0;
    border: none;
    outline: none;
    resize: none;
    overflow: hidden;
    background: transparent;
    color: #f8fafc;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.875rem;
    line-height: 1.7;
    tab-size: 2;

    &::placeholder {
      color: #64748b;
    }
  }
}

.detran-live-table-wrapper {
  width: 100%;
}

.detran-live-table-scroll {
  overflow-x: auto;
  border-radius: 0.75rem;
}

.detran-live-table {
  margin: 0 !important;
  width: 100%;

  th,
  td {
    vertical-align: top !important;
  }

  th {
    white-space: normal !important;
  }
}

.table-cell-editable {
  min-width: 64px;
  min-height: 1.4em;
  outline: none;
  cursor: text;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
  transition: background-color 0.12s ease, box-shadow 0.12s ease;

  &:focus {
    background: rgba(240, 253, 244, 0.65);
    box-shadow: inset 0 0 0 1px rgba(40, 139, 74, 0.35);
  }
}

.detran-table-toolbar {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  padding: 4px 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 5;
}

.detran-table-toolbar__info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 11px;
  user-select: none;
}

.detran-table-toolbar__title {
  font-weight: 600;
  color: #475569;
}

.detran-table-toolbar__dim {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 0 4px;
  line-height: 1.4;
}

.detran-table-toolbar__divider {
  width: 1px;
  height: 18px;
  background: #e2e8f0;
  margin: 0 2px;
}

.detran-table-btn-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.detran-table-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  user-select: none;

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &--add {
    &:hover:not(:disabled) {
      background: #f0fdf4;
      border-color: #86efac;
      color: #15803d;
      box-shadow: 0 1px 3px rgba(22, 101, 52, 0.08);
    }
  }

  &--remove {
    &:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #b91c1c;
      box-shadow: 0 1px 3px rgba(185, 28, 28, 0.08);
    }
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #94a3b8;
    box-shadow: none;
  }
}

.detran-mermaid-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.detran-inline-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
  }

  &.is-delete:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
  }
}

.detran-live-list {
  margin: 0 !important;

  li {
    margin: 0.35rem 0 !important;
  }
}

.list-item-editable {
  display: block;
  min-width: 120px;
  width: 100%;
}

.detran-live-list.contains-task-list {
  .task-list-item {
    align-items: flex-start;

    input[type='checkbox'] {
      margin-top: 0.35rem;
    }
  }

  .list-item-editable {
    width: auto;
    flex: 1;
  }
}

.detran-live-quote {
  margin: 0 !important;
  padding: 0.5rem 1.25rem !important;

  p {
    margin-bottom: 0 !important;
  }
}

.detran-raw-editor {
  background: rgba(241, 245, 249, 0.65);
  backdrop-filter: blur(8px);
  border: 1px dashed #cbd5e1;
}

.detran-raw-preview {
  cursor: pointer;
  border-radius: 6px;

  ::v-deep > *:first-child {
    margin-top: 0 !important;
  }

  ::v-deep > *:last-child {
    margin-bottom: 0 !important;
  }
}

.detran-image-figure {
  margin: 0;
}

.editable-subfield {
  outline: none;
  cursor: text;
  &:empty::before {
    content: attr(data-placeholder);
    color: #94a3b8;
  }
}
</style>

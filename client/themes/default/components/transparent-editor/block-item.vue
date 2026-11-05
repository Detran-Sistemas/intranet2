<template lang="pug">
.notion-block(
  :class='[blockClass, { "is-focused": isFocused, "is-hovered": isHovered }]'
  @mouseenter='isHovered = true'
  @mouseleave='isHovered = false'
)
  //- Alça lateral interna ao bloco (fiel ao protótipo: + e 6 pontos dentro da borda arredondada verde)
  .block-handle.select-none
    button.handle-add-btn(
      type='button'
      title='Adicionar bloco abaixo'
      @click.stop='$emit("insert-below", index)'
    )
      v-icon(size='13') mdi-plus
    v-icon.handle-grip(size='15') mdi-drag-vertical

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
        @focus='isFocused = true'
        @blur='onBlurText'
      )

    //- 2. CALLOUT NATIVO WIKI.JS / PROTÓTIPO DETRAN-MG
    template(v-else-if='block.type === "callout"')
      blockquote(:class='calloutClass')
        p.editable-field(
          ref='editable'
          contenteditable='true'
          spellcheck='false'
          :data-placeholder='$t("common:editor.calloutPlaceholder", "Digite um destaque...")'
          @input='onInputText'
          @keydown='onKeydown'
          @focus='isFocused = true'
          @blur='onBlurText'
        )

    //- 3. CARDS DE LINKS (.links-list nativo do Design System Detran-MG)
    template(v-else-if='block.type === "links"')
      ul.links-list.editable-links-list
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
      figure.detran-image-figure
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

    //- 5. BLOCOS ESTRUTURAIS (Listas, Tabelas, Código, Citações, Divisores)
    template(v-else-if='block.type === "raw"')
      .detran-raw-wrapper
        template(v-if='isEditingRaw')
          .detran-raw-editor.pa-3.rounded-lg.grey.lighten-4
            .d-flex.align-center.justify-space-between.mb-2
              span.caption.font-weight-bold.grey--text.text--darken-2 Edição de Bloco Markdown (Lista / Tabela / Código)
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
              background-color='white'
              class='caption font-monospace'
              @input='onRawChange'
              @keydown.esc='finishRawEdit'
            )
        template(v-else)
          .detran-raw-preview(
            @click='startRawEdit'
            title='Clique para editar este bloco'
            v-html='renderedRawHtml'
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
        @focus='isFocused = true'
        @blur='onBlurText'
      )
</template>

<script>
import { detectSlashTrigger, updateLinkCardItem } from './utils/editor-controller'
import {
  inlineMarkdownToHtml,
  inlineHtmlToMarkdown,
  renderRawBlockHtml,
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
    }
  },
  data () {
    return {
      isHovered: false,
      isFocused: false,
      isEditingRaw: false,
      rawText: this.block.text || ''
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
    renderedHtml () {
      return inlineMarkdownToHtml(this.block.text || '')
    },
    renderedRawHtml () {
      return renderRawBlockHtml(this.block.text || '')
    }
  },
  watch: {
    'block.text' (newVal) {
      this.rawText = newVal || ''
      if (!this.isFocused) {
        this.syncEditableDom()
      }
    },
    'block.type' () {
      this.$nextTick(() => {
        this.syncEditableDom()
      })
    }
  },
  mounted () {
    this.syncEditableDom()
  },
  methods: {
    syncEditableDom () {
      const el = this.$refs.editable
      if (el && this.block.type !== 'image' && this.block.type !== 'links' && this.block.type !== 'raw') {
        const html = this.renderedHtml
        if (el.innerHTML !== html) {
          el.innerHTML = html
        }
      }
    },
    onInputText (e) {
      const mdText = inlineHtmlToMarkdown(e.target.innerHTML)
      this.$emit('update-block', {
        index: this.index,
        block: {
          ...this.block,
          text: mdText
        }
      })

      if (detectSlashTrigger(mdText)) {
        const rect = e.target.getBoundingClientRect()
        this.$emit('slash-command', {
          index: this.index,
          rect
        })
      }
    },
    onBlurText () {
      this.isFocused = false
      this.syncEditableDom()
    },
    onKeydown (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.$emit('insert-below', this.index)
      } else if (e.key === 'Backspace') {
        const text = (e.target.innerText || '').trim()
        if (!text && this.index > 0) {
          e.preventDefault()
          this.$emit('delete-block', this.index)
        }
      }
    },
    onLinkTitleChange (idx, e) {
      this.isFocused = false
      this.$emit('update-block', {
        index: this.index,
        block: updateLinkCardItem(this.block, idx, 'title', e.target.innerText)
      })
    },
    onLinkDescChange (idx, e) {
      this.isFocused = false
      this.$emit('update-block', {
        index: this.index,
        block: updateLinkCardItem(this.block, idx, 'description', e.target.innerText)
      })
    },
    onImageCaptionInput (e) {
      const title = (e.target.innerText || '').trim()
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
      this.isEditingRaw = false
      this.isFocused = false
      this.onRawChange()
    },
    onRawChange () {
      this.$emit('update-block', {
        index: this.index,
        block: {
          ...this.block,
          text: this.rawText
        }
      })
    },
    focus () {
      this.$nextTick(() => {
        if (this.$refs.editable) {
          this.$refs.editable.focus()
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
  // Compensação matemática exata:
  // -32px (margin-left) + 6px (padding-left) + 22px (handle) + 4px (gap) = 0px!
  // Garante 0px de deslocamento horizontal do texto entre Modo Leitura e Modo Edição,
  // mantendo 8px de margem branca interna em relação à borda do card (.detran-article)
  // e envolvendo a alça (+ e ⋮⋮) dentro da borda arredondada verde do protótipo.
  padding: 6px 12px 6px 6px;
  margin-left: -32px;
  margin-right: -12px;
  margin-bottom: 12px;
  border-radius: 0.5rem;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &.is-hovered {
    background-color: rgba(241, 245, 249, 0.7);
  }

  &:focus-within,
  &.is-focused {
    background-color: #ffffff !important;
    box-shadow: 0 0 0 2px rgba(46, 160, 88, 0.25) !important;
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
  }

  &.block-type-callout {
    margin-top: 0.75rem;
    margin-bottom: 0.75rem;

    .block-handle {
      padding-top: 14px;
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
    width: 11px;
    color: inherit !important;
    cursor: grab;
  }
}

.block-content {
  flex: 1;
  min-width: 0;

  // Remove margens verticais internas para que a borda verde do .notion-block
  // abrace o conteúdo de forma justa e simétrica como no protótipo
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

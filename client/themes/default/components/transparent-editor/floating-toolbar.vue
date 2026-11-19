<template lang="pug">
span.floating-toolbar-anchor(style='display: none;')
  .floating-toolbar-portal(ref='portalEl')
    .floating-toolbar(
      v-if='visible'
      :style='toolbarStyle'
      role='toolbar'
      aria-label='Formatação de texto'
      @mousedown.prevent
    )
      //- Modo 1: Popover Inline de Inserção de Link (Ctrl+K)
      .floating-toolbar__pill.floating-toolbar__link-form(v-if='showLinkInput')
        v-icon.floating-toolbar__link-icon(size='15' color='#86efac') mdi-link-variant
        input.floating-toolbar__link-input(
          ref='linkInput'
          v-model='linkUrl'
          type='url'
          placeholder='Cole ou digite a URL (https://...)'
          aria-label='URL do link'
          @keydown.enter.prevent='applyLink'
          @keydown.esc.prevent='cancelLink'
        )
        button.floating-toolbar__link-submit(
          type='button'
          @click='applyLink'
        ) Inserir
        button.floating-toolbar__icon-btn.is-close(
          type='button'
          title='Cancelar (Esc)'
          aria-label='Cancelar link'
          @click='cancelLink'
        )
          v-icon(size='14') mdi-close

      //- Modo 2: Floating Action Pill (Formatação | Títulos | Destaques)
      .floating-toolbar__pill(v-else)
        .floating-toolbar__group
          button.floating-toolbar__icon-btn(
            type='button'
            :class='{ "is-active": activeFormats.bold }'
            :aria-pressed='activeFormats.bold ? "true" : "false"'
            title='Negrito (Ctrl+B)'
            aria-label='Negrito'
            @click='format("bold")'
          )
            v-icon(size='15') mdi-format-bold

          button.floating-toolbar__icon-btn(
            type='button'
            :class='{ "is-active": activeFormats.italic }'
            :aria-pressed='activeFormats.italic ? "true" : "false"'
            title='Itálico (Ctrl+I)'
            aria-label='Itálico'
            @click='format("italic")'
          )
            v-icon(size='15') mdi-format-italic

          button.floating-toolbar__icon-btn(
            type='button'
            :class='{ "is-active": activeFormats.underline }'
            :aria-pressed='activeFormats.underline ? "true" : "false"'
            title='Sublinhado (Ctrl+U)'
            aria-label='Sublinhado'
            @click='format("underline")'
          )
            v-icon(size='15') mdi-format-underline

          button.floating-toolbar__icon-btn(
            type='button'
            title='Inserir Link (Ctrl+K)'
            aria-label='Inserir link'
            @click='openLinkInput'
          )
            v-icon(size='15') mdi-link-variant

        span.floating-toolbar__divider(aria-hidden='true')

        .floating-toolbar__group
          button.floating-toolbar__text-btn(
            type='button'
            title='Transformar em Cabeçalho H2'
            @click='$emit("transform", "heading")'
          ) H2

          button.floating-toolbar__text-btn(
            type='button'
            title='Transformar em Subtítulo H3'
            @click='$emit("transform", "heading-3")'
          ) H3

        span.floating-toolbar__divider(aria-hidden='true')

        .floating-toolbar__group
          button.floating-toolbar__chip-btn.is-info(
            type='button'
            title='Transformar em Nota Informativa'
            @click='$emit("transform", "callout-info")'
          )
            v-icon(size='13') mdi-information-outline
            span Nota

          button.floating-toolbar__chip-btn.is-success(
            type='button'
            title='Transformar em Aviso Institucional'
            @click='$emit("transform", "callout-success")'
          )
            v-icon(size='13') mdi-check-circle-outline
            span Aviso
</template>

<script>
import { computeFloatingToolbarPosition } from './utils/editor-controller'

export default {
  name: 'FloatingToolbar',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    position: {
      type: Object,
      default: () => ({ top: 0, left: 0 })
    }
  },
  data () {
    return {
      showLinkInput: false,
      linkUrl: '',
      savedRange: null,
      activeFormats: {
        bold: false,
        italic: false,
        underline: false
      }
    }
  },
  computed: {
    toolbarStyle () {
      return computeFloatingToolbarPosition(this.position)
    }
  },
  watch: {
    visible (newVal) {
      if (newVal) {
        this.mountPortal()
        this.refreshActiveFormats()
      } else {
        this.showLinkInput = false
        this.linkUrl = ''
      }
    },
    position: {
      deep: true,
      handler () {
        if (this.visible) {
          this.refreshActiveFormats()
        }
      }
    }
  },
  mounted () {
    this.mountPortal()
  },
  beforeDestroy () {
    this.unmountPortal()
  },
  methods: {
    mountPortal () {
      if (typeof document === 'undefined' || !this.$refs.portalEl) return
      const host = document.querySelector('[data-app]') || document.body
      if (host && this.$refs.portalEl.parentNode !== host) {
        host.appendChild(this.$refs.portalEl)
      }
    },
    unmountPortal () {
      const el = this.$refs.portalEl
      if (el && el.parentNode) {
        el.parentNode.removeChild(el)
      }
    },
    refreshActiveFormats () {
      if (typeof document === 'undefined' || typeof document.queryCommandState !== 'function') {
        return
      }
      try {
        this.activeFormats = {
          bold: Boolean(document.queryCommandState('bold')),
          italic: Boolean(document.queryCommandState('italic')),
          underline: Boolean(document.queryCommandState('underline'))
        }
      } catch (err) {
        this.activeFormats = { bold: false, italic: false, underline: false }
      }
    },
    format (command) {
      document.execCommand(command, false, null)
      this.refreshActiveFormats()
      this.$emit('formatted')
    },
    openLinkInput () {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        this.savedRange = sel.getRangeAt(0).cloneRange()
      }
      this.linkUrl = ''
      this.showLinkInput = true
      this.$nextTick(() => {
        if (this.$refs.linkInput) {
          this.$refs.linkInput.focus()
        }
      })
    },
    applyLink () {
      const url = (this.linkUrl || '').trim()
      if (url) {
        if (this.savedRange) {
          const sel = window.getSelection()
          sel.removeAllRanges()
          sel.addRange(this.savedRange)
        }
        document.execCommand('createLink', false, url)
        this.$emit('formatted')
      }
      this.cancelLink()
    },
    cancelLink () {
      this.showLinkInput = false
      this.linkUrl = ''
      this.savedRange = null
    }
  }
}
</script>

<style lang="scss" scoped>
.floating-toolbar {
  animation: toolbarPopIn 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  max-width: calc(100vw - 32px);
  overflow-x: auto;

  &__pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 5px;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow:
      0 12px 28px -6px rgba(15, 23, 42, 0.38),
      0 4px 10px -2px rgba(15, 23, 42, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    color: #f8fafc;
    user-select: none;
  }

  &__group {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  &__divider {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.14);
    margin: 0 3px;
    flex-shrink: 0;
  }

  &__icon-btn,
  &__text-btn,
  &__chip-btn {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: #e2e8f0;
    height: 28px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.14s ease, color 0.14s ease, border-color 0.14s ease, transform 0.1s ease;

    .v-icon {
      color: inherit !important;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.11);
      color: #ffffff;
    }

    &:active {
      transform: scale(0.94);
    }

    &.is-active {
      background: rgba(74, 222, 128, 0.18);
      border-color: rgba(74, 222, 128, 0.35);
      color: #86efac;
    }
  }

  &__icon-btn {
    width: 28px;
    padding: 0;

    &.is-close {
      width: 24px;
      height: 24px;
      color: #94a3b8;

      &:hover {
        color: #f8fafc;
      }
    }
  }

  &__text-btn {
    padding: 0 8px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  &__chip-btn {
    gap: 4px;
    padding: 0 8px;
    font-size: 11.5px;
    font-weight: 600;

    &.is-info {
      color: #93c5fd;

      &:hover {
        background: rgba(59, 130, 246, 0.18);
        color: #bfdbfe;
      }
    }

    &.is-success {
      color: #6ee7b7;

      &:hover {
        background: rgba(16, 185, 129, 0.18);
        color: #a7f3d0;
      }
    }
  }

  &__link-form {
    padding: 4px 6px 4px 10px;
    gap: 6px;
  }

  &__link-icon {
    flex-shrink: 0;
  }

  &__link-input {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    outline: none;
    color: #f8fafc;
    font-size: 12.5px;
    padding: 4px 8px;
    min-width: 220px;
    transition: border-color 0.15s ease, background-color 0.15s ease;

    &::placeholder {
      color: #94a3b8;
    }

    &:focus {
      border-color: rgba(74, 222, 128, 0.55);
      background: rgba(255, 255, 255, 0.1);
    }
  }

  &__link-submit {
    appearance: none;
    border: none;
    background: #16a34a;
    color: #ffffff;
    font-size: 11.5px;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: 7px;
    cursor: pointer;
    transition: background-color 0.14s ease, transform 0.1s ease;

    &:hover {
      background: #15803d;
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

@keyframes toolbarPopIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

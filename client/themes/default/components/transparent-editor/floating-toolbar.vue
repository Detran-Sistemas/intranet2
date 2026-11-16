<template lang="pug">
.floating-toolbar(
  v-if='visible'
  :style='toolbarStyle'
  @mousedown.prevent
)
  //- Modo 1: Popover de Inserção de Link (Ctrl+K)
  v-sheet.d-flex.align-center.elevation-8.rounded-xl.px-2.py-1.grey.darken-4.white--text(v-if='showLinkInput')
    v-icon(size="16" color="#a7f3d0" class="mr-1") mdi-link-variant
    input.floating-toolbar__link-input(
      ref='linkInput'
      v-model='linkUrl'
      type='url'
      placeholder='URL (https://...)'
      @keydown.enter.prevent='applyLink'
      @keydown.esc.prevent='cancelLink'
    )
    v-btn(x-small text color='#4ade80' class='px-1 font-weight-bold text-none' @click='applyLink') Inserir
    v-btn(icon x-small dark @click='cancelLink')
      v-icon(size="14") mdi-close

  //- Modo 2: Barra de Ações de Formatação e Estilos Rápidos
  v-sheet.d-flex.align-center.elevation-8.rounded-xl.px-1.py-1.grey.darken-4.white--text(v-else)
    v-btn(
      icon
      x-small
      dark
      title="Negrito (Ctrl+B)"
      @click='format("bold")'
    )
      v-icon(size="16") mdi-format-bold

    v-btn(
      icon
      x-small
      dark
      title="Itálico (Ctrl+I)"
      @click='format("italic")'
    )
      v-icon(size="16") mdi-format-italic

    v-btn(
      icon
      x-small
      dark
      title="Sublinhado (Ctrl+U)"
      @click='format("underline")'
    )
      v-icon(size="16") mdi-format-underline

    v-btn(
      icon
      x-small
      dark
      title="Inserir Link (Ctrl+K)"
      @click='openLinkInput'
    )
      v-icon(size="16") mdi-link-variant

    v-divider.mx-1(vertical, dark)

    v-btn(
      x-small
      text
      dark
      class="px-2 font-weight-bold"
      title="Transformar em Cabeçalho H2"
      @click='$emit("transform", "heading")'
    ) H2

    v-btn(
      x-small
      text
      dark
      class="px-2 blue--text text--lighten-2"
      title="Transformar em Nota Informativa"
      @click='$emit("transform", "callout-info")'
    )
      v-icon(x-small, left) mdi-information
      span Nota

    v-btn(
      x-small
      text
      dark
      class="px-2 green--text text--lighten-2"
      title="Transformar em Aviso Institucional"
      @click='$emit("transform", "callout-success")'
    )
      v-icon(x-small, left) mdi-check-circle
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
      savedRange: null
    }
  },
  computed: {
    toolbarStyle () {
      return computeFloatingToolbarPosition(this.position)
    }
  },
  watch: {
    visible (newVal) {
      if (!newVal) {
        this.showLinkInput = false
        this.linkUrl = ''
      }
    }
  },
  methods: {
    format (command) {
      document.execCommand(command, false, null)
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
  animation: toolbarFadeIn 0.12s ease-out;
  max-width: calc(100vw - 32px);
  overflow-x: auto;

  &__link-input {
    background: transparent;
    border: none;
    outline: none;
    color: #f8fafc;
    font-size: 0.8125rem;
    padding: 0.25rem 0.5rem;
    min-width: 220px;

    &::placeholder {
      color: #94a3b8;
    }
  }
}

@keyframes toolbarFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

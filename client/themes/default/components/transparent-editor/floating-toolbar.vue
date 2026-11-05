<template lang="pug">
.floating-toolbar(
  v-if='visible'
  :style='toolbarStyle'
  @mousedown.prevent
)
  v-sheet.d-flex.align-center.elevation-8.rounded-xl.px-1.py-1.grey.darken-4.white--text
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
  computed: {
    toolbarStyle () {
      return computeFloatingToolbarPosition(this.position)
    }
  },
  methods: {
    format (command) {
      document.execCommand(command, false, null)
      this.$emit('formatted')
    }
  }
}
</script>

<style lang="scss" scoped>
.floating-toolbar {
  animation: toolbarFadeIn 0.12s ease-out;
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

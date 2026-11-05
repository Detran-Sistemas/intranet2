<template lang="pug">
.slash-menu-wrapper(
  v-if='visible'
  :style='menuStyle'
  v-click-outside='onClose'
)
  v-card.slash-menu-card.elevation-8.rounded-xl(max-width='280')
    .px-3.py-2.grey.lighten-4.d-flex.align-center.justify-space-between
      span.text-caption.font-weight-bold.text-uppercase.grey--text Inserir Bloco
      v-icon(x-small, color='grey') mdi-keyboard-outline
    v-list.dense.py-1
      v-list-item(
        v-for='item in items'
        :key='item.type'
        @click='selectItem(item.type)'
        class='slash-item px-3'
      )
        v-list-item-avatar.mr-2(size='28', :color='item.avatarColor')
          v-icon(size='16', :color='item.iconColor') {{ item.icon }}
        v-list-item-content
          v-list-item-title.caption.font-weight-bold {{ item.title }}
          v-list-item-subtitle.text-caption.grey--text {{ item.subtitle }}
</template>

<script>
import { SLASH_MENU_ITEMS, computeSlashMenuPosition } from './utils/editor-controller'

export default {
  name: 'SlashMenu',
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
      items: SLASH_MENU_ITEMS
    }
  },
  computed: {
    menuStyle () {
      return computeSlashMenuPosition(this.position, {
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768
      })
    }
  },
  methods: {
    selectItem (type) {
      this.$emit('select', type)
    },
    onClose () {
      this.$emit('close')
    }
  }
}
</script>

<style lang="scss" scoped>
.slash-menu-wrapper {
  animation: slashFadeIn 0.12s ease-out;
}

.slash-menu-card {
  border: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.slash-item {
  min-height: 40px;
  cursor: pointer;
  transition: background-color 0.12s ease;

  &:hover {
    background-color: #f0fdf4 !important;
  }
}

@keyframes slashFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

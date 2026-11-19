<template lang="pug">
span.slash-menu-anchor(style='display: none;')
  .slash-menu-portal(ref='portalEl')
    .slash-menu-wrapper(
      v-if='visible'
      :style='menuStyle'
      @mousedown.prevent
    )
      .slash-cmd-panel(role='listbox' aria-label='Inserir bloco')
        .slash-cmd-header
          .slash-cmd-header__left
            v-icon(size='13' color='#16a34a') mdi-slash-forward-box
            span.slash-cmd-header__title Inserir bloco
            span.slash-cmd-header__query(v-if='query') /{{ query }}
          .slash-cmd-header__keys(aria-hidden='true')
            kbd.slash-cmd-hint-kbd ↑↓
            kbd.slash-cmd-hint-kbd ↵
            kbd.slash-cmd-hint-kbd Esc

        .slash-cmd-body(ref='menuBody')
          template(v-if='filteredItems.length > 0')
            .slash-cmd-group(
              v-for='group in groupedItems'
              :key='group.label'
            )
              .slash-cmd-group__label {{ group.label }}
              button.slash-cmd-item(
                v-for='item in group.items'
                :key='item.type'
                type='button'
                role='option'
                :aria-selected='selectedIndex === item.flatIndex ? "true" : "false"'
                :data-slash-index='item.flatIndex'
                :class='{ "is-selected": selectedIndex === item.flatIndex }'
                @mouseenter='selectedIndex = item.flatIndex'
                @click='selectItem(item.type)'
              )
                span.slash-cmd-item__icon(:style='{ backgroundColor: item.avatarColor }')
                  v-icon(size='15' :color='item.iconColor') {{ item.icon }}
                span.slash-cmd-item__content
                  span.slash-cmd-item__title {{ item.title }}
                  span.slash-cmd-item__subtitle {{ item.subtitle }}
                kbd.slash-cmd-item__kbd {{ item.shortcut }}
          .slash-cmd-empty(v-else)
            v-icon(size='16' color='#94a3b8') mdi-magnify-close
            span Nenhum bloco encontrado para "/{{ query }}"
</template>

<script>
import {
  SLASH_MENU_ITEMS,
  groupSlashMenuItems,
  filterSlashMenuItems,
  computeSlashMenuPosition
} from './utils/editor-controller'

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
    },
    query: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      items: SLASH_MENU_ITEMS,
      selectedIndex: 0
    }
  },
  computed: {
    filteredItems () {
      return filterSlashMenuItems(this.items, this.query)
    },
    groupedItems () {
      return groupSlashMenuItems(this.filteredItems)
    },
    menuStyle () {
      return computeSlashMenuPosition(this.position, {
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768
      })
    }
  },
  watch: {
    visible (isNowVisible) {
      if (isNowVisible) {
        this.mountPortal()
        this.selectedIndex = 0
        this.bindListeners()
      } else {
        this.unbindListeners()
      }
    },
    query () {
      this.selectedIndex = 0
    }
  },
  mounted () {
    this.mountPortal()
    if (this.visible) {
      this.bindListeners()
    }
  },
  beforeDestroy () {
    this.unbindListeners()
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
    bindListeners () {
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', this.onMenuKeydown, true)
      }
      if (typeof document !== 'undefined') {
        document.addEventListener('mousedown', this.onOutsideMousedown, true)
      }
    },
    unbindListeners () {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', this.onMenuKeydown, true)
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousedown', this.onOutsideMousedown, true)
      }
    },
    onOutsideMousedown (e) {
      if (!this.visible) return
      const el = this.$refs.portalEl
      if (el && e && e.target && el.contains(e.target)) return
      this.onClose()
    },
    scrollSelectedIntoView () {
      this.$nextTick(() => {
        const body = this.$refs.menuBody
        if (!body) return
        const activeEl = body.querySelector(`[data-slash-index="${this.selectedIndex}"]`)
        if (activeEl && typeof activeEl.scrollIntoView === 'function') {
          activeEl.scrollIntoView({ block: 'nearest' })
        }
      })
    },
    onMenuKeydown (e) {
      if (!this.visible) return

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this.onClose()
        return
      }

      const list = this.filteredItems
      if (!list.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        this.selectedIndex = (this.selectedIndex + 1) % list.length
        this.scrollSelectedIntoView()
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        this.selectedIndex = (this.selectedIndex - 1 + list.length) % list.length
        this.scrollSelectedIntoView()
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const target = list[this.selectedIndex] || list[0]
        if (target) {
          this.selectItem(target.type)
        }
      }
    },
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
  animation: slashFadeIn 0.14s cubic-bezier(0.16, 1, 0.3, 1);
}

.slash-cmd-panel {
  width: 304px;
  max-width: calc(100vw - 24px);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow:
    0 20px 38px -10px rgba(15, 23, 42, 0.18),
    0 4px 12px -2px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  user-select: none;
}

.slash-cmd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;

  &__left {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #475569;
  }

  &__query {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 10.5px;
    font-weight: 700;
    color: #15803d;
    background: #dcfce7;
    padding: 1px 6px;
    border-radius: 9999px;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__keys {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
}

.slash-cmd-hint-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 17px;
  padding: 0 4px;
  border-radius: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 0 #e2e8f0;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 9.5px;
  font-weight: 600;
  color: #64748b;
  line-height: 1;
}

.slash-cmd-body {
  max-height: 312px;
  overflow-y: auto;
  padding: 6px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 9999px;
  }
}

.slash-cmd-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 12px;
  font-size: 12px;
  color: #64748b;
}

.slash-cmd-group {
  & + & {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #f1f5f9;
  }

  &__label {
    padding: 3px 8px 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #94a3b8;
  }
}

.slash-cmd-item {
  appearance: none;
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 9px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease, box-shadow 0.12s ease;

  &__icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(15, 23, 42, 0.05);
  }

  &__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &__title {
    font-size: 12.5px;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.25;
  }

  &__subtitle {
    font-size: 11px;
    color: #64748b;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__kbd {
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: 5px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    line-height: 1.2;
    transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  }

  &.is-selected,
  &:hover {
    background: #f0fdf4;
    box-shadow: inset 3px 0 0 #16a34a;

    .slash-cmd-item__title {
      color: #14532d;
    }

    .slash-cmd-item__kbd {
      background: #ffffff;
      border-color: #86efac;
      color: #15803d;
    }
  }
}

@keyframes slashFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>

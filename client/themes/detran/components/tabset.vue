<template lang="pug">
  .tabset.detran-tabset
    ul.tabset-tabs(ref='tabs', role='tablist')
      slot(name='tabs')
    .tabset-content(ref='content')
      slot(name='content')
</template>

<script>
import { customAlphabet } from 'nanoid/non-secure'

const nanoid = customAlphabet('1234567890abcdef', 10)

export default {
  name: 'Tabset',

  data () {
    return {
      currentTab: 0
    }
  },

  watch: {
    currentTab (newValue, oldValue) {
      this.setActiveTab()
    }
  },

  mounted () {
    // Scroll para cabeçalho dentro de aba oculta ao carregar
    if (window.location.hash && window.location.hash.length > 1) {
      const headerId = decodeURIComponent(window.location.hash)
      let foundIdx = -1
      if (this.$refs.content && this.$refs.content.childNodes) {
        this.$refs.content.childNodes.forEach((node, idx) => {
          if (node.querySelector && node.querySelector(headerId)) {
            foundIdx = idx
          }
        })
      }
      if (foundIdx >= 0) {
        this.currentTab = foundIdx
      }
    }

    this.setActiveTab()

    const tabRefId = nanoid()

    if (this.$refs.tabs && this.$refs.tabs.childNodes) {
      this.$refs.tabs.childNodes.forEach((node, idx) => {
        if (node.setAttribute) {
          node.setAttribute('id', `${tabRefId}-${idx}`)
          node.setAttribute('role', 'tab')
          node.setAttribute('aria-controls', `${tabRefId}-${idx}-tab`)
          node.setAttribute('tabindex', '0')
          node.addEventListener('click', ev => {
            this.currentTab = [].indexOf.call(ev.currentTarget.parentNode.children, ev.currentTarget)
          })
          node.addEventListener('keydown', ev => {
            if (ev.key === 'ArrowLeft' && idx > 0) {
              this.currentTab = idx - 1
              this.$refs.tabs.childNodes[idx - 1].focus()
            } else if (ev.key === 'ArrowRight' && idx < this.$refs.tabs.childNodes.length - 1) {
              this.currentTab = idx + 1
              this.$refs.tabs.childNodes[idx + 1].focus()
            } else if (ev.key === 'Enter' || ev.key === ' ') {
              this.currentTab = idx
              node.focus()
            } else if (ev.key === 'Home') {
              this.currentTab = 0
              ev.preventDefault()
              ev.currentTarget.parentNode.children[0].focus()
            } else if (ev.key === 'End') {
              this.currentTab = this.$refs.tabs.childNodes.length - 1
              ev.preventDefault()
              ev.currentTarget.parentNode.children[this.$refs.tabs.childNodes.length - 1].focus()
            }
          })
        }
      })
    }

    if (this.$refs.content && this.$refs.content.childNodes) {
      this.$refs.content.childNodes.forEach((node, idx) => {
        if (node.setAttribute) {
          node.setAttribute('id', `${tabRefId}-${idx}-tab`)
          node.setAttribute('role', 'tabpanel')
          node.setAttribute('aria-labelledby', `${tabRefId}-${idx}`)
          node.setAttribute('tabindex', '0')
        }
      })
    }
  },

  methods: {
    setActiveTab () {
      if (this.$refs.tabs && this.$refs.tabs.childNodes) {
        this.$refs.tabs.childNodes.forEach((node, idx) => {
          if (node.classList) {
            if (idx === this.currentTab) {
              node.className = 'is-active'
              node.setAttribute('aria-selected', 'true')
            } else {
              node.className = ''
              node.setAttribute('aria-selected', 'false')
            }
          }
        })
      }
      if (this.$refs.content && this.$refs.content.childNodes) {
        this.$refs.content.childNodes.forEach((node, idx) => {
          if (node.classList) {
            if (idx === this.currentTab) {
              node.className = 'tabset-panel is-active'
              node.removeAttribute('hidden')
            } else {
              node.className = 'tabset-panel'
              node.setAttribute('hidden', '')
            }
          }
        })
      }
    }
  }
}
</script>

<style lang="scss">
@import '../scss/variables';

.detran-tabset {
  background-color: $color-white;
  border: 1px solid $slate-200;
  border-radius: $radius-lg;
  box-shadow: $shadow-soft;
  margin: 1.5rem 0;
  overflow: hidden;

  > .tabset-tabs {
    display: flex;
    align-items: stretch;
    background-color: $slate-50;
    border-bottom: 1px solid $slate-200;
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-x: auto;
    scrollbar-width: thin;

    > li {
      display: inline-flex;
      align-items: center;
      padding: 0.75rem 1.25rem;
      margin: 0;
      cursor: pointer;
      font-family: $font-family-base;
      font-size: 0.875rem;
      font-weight: 500;
      color: $slate-600;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      user-select: none;
      white-space: nowrap;
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;

      &:hover {
        color: $slate-800;
        background-color: rgba($color-white, 0.6);
      }

      &.is-active {
        color: $detran-600;
        font-weight: 600;
        background-color: $color-white;
        border-bottom: 2px solid $detran-600;
      }
    }
  }

  > .tabset-content {
    > .tabset-panel {
      padding: 1.25rem 1.5rem;
      color: $slate-700;
      font-size: 0.9375rem;
      line-height: 1.6;

      &[hidden] {
        display: none !important;
      }

      > *:first-child {
        margin-top: 0;
      }

      > *:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>

<template lang="pug">
.detran-tree-node
  //- 1. Item é DIRETÓRIO (Pasta expansível)
  .detran-tree__folder-row(
    v-if='item.isFolder'
    :class='{ "detran-tree__folder-row--expanded": isExpanded }'
    :style='{ paddingLeft: `${(depth * 14) + 8}px` }'
  )
    button.detran-tree__folder-btn.glass-hover(
      @click='toggleFolder'
      type='button'
      :title='isExpanded ? "Recolher " + item.title : "Expandir " + item.title'
      :aria-expanded='isExpanded'
    )
      //- Chevron indicador de expandir/recolher
      v-icon.detran-tree__chevron(
        size='16'
        :class='{ "detran-tree__chevron--expanded": isExpanded }'
        color='rgba(255,255,255,0.7)'
      ) mdi-chevron-right

      //- Ícone da Pasta (aberta/fechada)
      .detran-sidebar__link-icon
        v-icon(size='17' :color='isExpanded ? "#6ee7b7" : "#a7f3d0"')
          | {{ isExpanded ? "mdi-folder-open" : "mdi-folder" }}

      //- Título do Diretório
      span.detran-sidebar__link-text.detran-tree__folder-title {{ item.title }}

      //- Indicador de carregamento assíncrono
      v-progress-circular.detran-tree__spinner(
        v-if='isLoading'
        indeterminate
        size='12'
        width='2'
        color='white'
      )

    //- Se a pasta também possuir uma página real associada (pageId > 0), oferece link para a página
    a.detran-tree__open-page(
      v-if='item.pageId && item.pageId > 0'
      :href='`/${item.locale || locale}/${item.path}`'
      :class='{ "glass-active": currentPath === item.path }'
      :title='"Abrir página " + item.title'
    )
      v-icon(size='14' color='rgba(255,255,255,0.7)') mdi-open-in-new

  //- 2. Item é PÁGINA (Documento final)
  a.detran-sidebar__link.glass-hover.detran-tree__page(
    v-else
    :href='`/${item.locale || locale}/${item.path}`'
    :class='{ "glass-active": currentPath === item.path }'
    :style='{ paddingLeft: `${(depth * 14) + 26}px` }'
    :title='item.title'
    :aria-current='currentPath === item.path ? "page" : undefined'
  )
    .detran-sidebar__link-icon
      v-icon(
        size='15'
        :color='currentPath === item.path ? "#ffffff" : "#cce0d2"'
      ) {{ getPageIcon(item.path) }}
    span.detran-sidebar__link-text {{ item.title }}

  //- 3. Sub-itens (Filhos) quando a pasta está expandida
  transition(
    name='detran-tree-expand'
    @enter='accordionEnter'
    @after-enter='accordionAfterEnter'
    @leave='accordionLeave'
    @after-leave='accordionAfterLeave'
  )
    .detran-tree__children(v-if='item.isFolder && isExpanded')
      template(v-if='children && children.length > 0')
        nav-tree-item(
          v-for='child in children'
          :key='child.id'
          :item='child'
          :depth='depth + 1'
          :current-path='currentPath'
          :locale='locale'
        )
      p.detran-tree__empty(
        v-else-if='!isLoading'
        :style='{ paddingLeft: `${((depth + 1) * 14) + 26}px` }'
      ) (diretório vazio)
</template>

<script>
import gql from 'graphql-tag'

const treeChildrenQuery = gql`
  query($parent: Int, $locale: String!) {
    pages {
      tree(parent: $parent, mode: ALL, locale: $locale) {
        id
        path
        depth
        title
        isPrivate
        isFolder
        privateNS
        parent
        pageId
        locale
      }
    }
  }
`

export default {
  name: 'NavTreeItem',

  props: {
    item: {
      type: Object,
      required: true
    },
    depth: {
      type: Number,
      default: 0
    },
    currentPath: {
      type: String,
      default: ''
    },
    locale: {
      type: String,
      default: 'en'
    }
  },

  data () {
    return {
      isExpanded: false,
      isLoading: false,
      hasLoaded: false,
      children: []
    }
  },

  watch: {
    currentPath: {
      immediate: true,
      handler (newPath) {
        if (this.item.isFolder && newPath) {
          // Se a página ativa estiver dentro deste diretório, auto-expande
          if (newPath === this.item.path || newPath.startsWith(this.item.path + '/')) {
            this.expandFolder()
          }
        }
      }
    }
  },

  methods: {
    async toggleFolder () {
      if (this.isExpanded) {
        this.isExpanded = false
      } else {
        await this.expandFolder()
      }
    },

    async expandFolder () {
      this.isExpanded = true
      if (!this.hasLoaded) {
        await this.fetchChildren()
      }
    },

    async fetchChildren () {
      this.isLoading = true
      try {
        const resp = await this.$apollo.query({
          query: treeChildrenQuery,
          variables: {
            parent: this.item.id,
            locale: this.item.locale || this.locale
          },
          fetchPolicy: 'network-only'
        })
        this.children = (resp && resp.data && resp.data.pages && resp.data.pages.tree) || []
        this.hasLoaded = true
      } catch (err) {
        console.error('Falha ao carregar sub-itens do diretório:', err)
        this.children = []
      } finally {
        this.isLoading = false
      }
    },

    getPageIcon (path) {
      const p = (path || '').toLowerCase()
      if (p.includes('cnh') || p.includes('habilita')) return 'mdi-card-account-details-outline'
      if (p.includes('veiculo') || p.includes('carro') || p.includes('ipva')) return 'mdi-car-side'
      if (p.includes('exame') || p.includes('medico') || p.includes('psico')) return 'mdi-stethoscope'
      if (p.includes('vistoria')) return 'mdi-clipboard-check-outline'
      if (p.includes('sistema') || p.includes('intranet') || p.includes('software')) return 'mdi-monitor'
      if (p.includes('seguranca') || p.includes('acesso')) return 'mdi-shield-check-outline'
      if (p.includes('lei') || p.includes('normat') || p.includes('portaria')) return 'mdi-scale-balance'
      if (p.includes('organograma') || p.includes('institucional')) return 'mdi-sitemap'
      return 'mdi-file-document-outline'
    },

    // -------------------------------------------------------------------------
    // Animação de Acordeão Suave (Expand / Collapse de Subpastas)
    // -------------------------------------------------------------------------
    accordionEnter (el) {
      el.style.height = '0'
      el.style.opacity = '0'
      el.style.overflow = 'hidden'
      void el.offsetHeight
      el.style.transition = 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.24s ease'
      el.style.height = `${el.scrollHeight}px`
      el.style.opacity = '1'
    },
    accordionAfterEnter (el) {
      el.style.height = ''
      el.style.opacity = ''
      el.style.overflow = ''
      el.style.transition = ''
    },
    accordionLeave (el) {
      el.style.height = `${el.scrollHeight}px`
      el.style.opacity = '1'
      el.style.overflow = 'hidden'
      void el.offsetHeight
      el.style.transition = 'height 0.24s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.20s ease'
      el.style.height = '0'
      el.style.opacity = '0'
    },
    accordionAfterLeave (el) {
      el.style.height = ''
      el.style.opacity = ''
      el.style.overflow = ''
      el.style.transition = ''
    }
  }
}
</script>

<style lang="scss">
.detran-tree-node {
  display: block;
  width: 100%;
}

.detran-tree__folder-row {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  width: 100%;
  margin-bottom: 2px;
}

.detran-tree__folder-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #e2f0e7;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }
}

.detran-tree__folder-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detran-tree__chevron {
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1) !important;
  flex-shrink: 0;

  &--expanded {
    transform: rotate(90deg);
  }
}

.detran-tree__open-page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.2s ease, background 0.2s ease;

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.12);
  }
}

.detran-tree__spinner {
  margin-left: auto;
  flex-shrink: 0;
}

.detran-tree__page {
  margin-bottom: 2px;
  font-size: 0.8125rem;
}

.detran-tree__children {
  width: 100%;
  position: relative;
  will-change: height, opacity;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 4px;
    left: calc(var(--tree-indent, 16px));
    width: 1px;
    background: rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }
}

.detran-tree__empty {
  font-size: 0.75rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.45);
  margin: 4px 0 6px 0;
}
</style>

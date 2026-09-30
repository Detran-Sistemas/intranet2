<template lang="pug">
.detran-tree-node
  //- 1. Item é DIRETÓRIO (Pasta expansível)
  .detran-tree__folder-row(
    v-if='item.isFolder'
    :class='{ "is-expanded": isExpanded }'
  )
    button.detran-tree__folder-btn(
      @click='toggleFolder'
      type='button'
      :title='isExpanded ? "Recolher " + displayTitle : "Expandir " + displayTitle'
      :aria-expanded='isExpanded'
    )
      //- Chevron indicador de expandir/recolher
      v-icon.detran-tree__chevron(
        size='16'
        :class='{ "is-expanded": isExpanded }'
      ) mdi-chevron-right

      //- Ícone da Pasta (aberta/fechada em tom âmbar quente de alto contraste)
      v-icon.detran-tree__folder-icon(
        size='18'
        :color='isExpanded ? "#fde047" : "#fcd34d"'
      ) {{ isExpanded ? "mdi-folder-open" : "mdi-folder" }}

      //- Título do Diretório formatado e amigável
      span.detran-tree__folder-title {{ displayTitle }}

      //- Indicador de carregamento assíncrono
      v-progress-circular.detran-tree__spinner(
        v-if='isLoading'
        indeterminate
        size='12'
        width='2'
        color='white'
      )

    //- Se a pasta também possuir uma página real associada (pageId > 0), oferece link direto
    a.detran-tree__open-page(
      v-if='item.pageId && item.pageId > 0'
      :href='pageUrl(item)'
      :class='{ "is-active": isItemActive(item) }'
      :title='"Abrir página " + displayTitle'
    )
      v-icon(size='14') mdi-open-in-new

  //- 2. Item é PÁGINA (Documento final)
  a.detran-tree__page(
    v-else
    :href='pageUrl(item)'
    :class='{ "glass-active": isItemActive(item) }'
    :title='displayTitle'
    :aria-current='isItemActive(item) ? "page" : undefined'
  )
    //- Espaçador para alinhar perfeitamente com o ícone de pasta (onde fica o chevron)
    span.detran-tree__chevron-spacer(aria-hidden='true')

    //- Ícone contextual da página baseado em seu nome/caminho
    v-icon.detran-tree__page-icon(
      size='16'
      :color='isItemActive(item) ? "#ffffff" : "#cce0d2"'
    ) {{ getPageIcon(item.path, item.title) }}

    //- Título da página
    span.detran-tree__page-title {{ displayTitle }}

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
      p.detran-tree__empty(v-else-if='!isLoading')
        | (diretório vazio)
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
      default: 'pt'
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

  computed: {
    displayTitle () {
      const raw = this.item.title || ''
      if (!raw) return ''
      // Se não for pasta e já tiver letras maiúsculas/acentos, mantém como veio
      if (!this.item.isFolder && /[A-ZÀ-Ú]/.test(raw)) {
        return raw
      }
      return this.formatTitle(raw)
    }
  },

  watch: {
    currentPath: {
      immediate: true,
      handler (newPath) {
        if (this.item.isFolder && newPath) {
          const normNew = (newPath || '').toLowerCase().replace(/^\/+/, '')
          const normItem = (this.item.path || '').toLowerCase().replace(/^\/+/, '')
          const loc = (this.item.locale || this.locale || '').toLowerCase()
          const strippedNew = (loc && normNew.startsWith(loc + '/')) ? normNew.substring(loc.length + 1) : normNew
          if (strippedNew === normItem || strippedNew.startsWith(normItem + '/')) {
            this.expandFolder()
          }
        }
      }
    }
  },

  methods: {
    formatTitle (str) {
      if (!str) return ''
      const slug = str.toLowerCase().trim()
      const dictionary = {
        'habilitacao': 'Habilitação',
        'cnh': 'CNH',
        'institucional': 'Institucional',
        'veiculos': 'Veículos',
        'veiculo': 'Veículos',
        'sistemas': 'Sistemas',
        'sistema': 'Sistemas',
        'legislacao': 'Legislação',
        'legislacao-e-normas': 'Legislação e Normas',
        'estrutura-organizacional': 'Estrutura Organizacional',
        'organograma': 'Estrutura Organizacional',
        'atendimento': 'Atendimento ao Cidadão',
        'infraestrutura': 'Infraestrutura',
        'recursos-humanos': 'Recursos Humanos',
        'rh': 'Recursos Humanos',
        'educacao': 'Educação para o Trânsito',
        'fiscalizacao': 'Fiscalização',
        'seguranca': 'Segurança',
        'documentos': 'Documentos',
        'manuais': 'Manuais',
        'tutoriais': 'Tutoriais',
        'processos': 'Processos Internos',
        'protocolo': 'Protocolo',
        'ouvidoria': 'Ouvidoria',
        'estatisticas': 'Estatísticas',
        'projetos': 'Projetos',
        'portarias': 'Portarias',
        'resolucoes': 'Resoluções',
        'decretos': 'Decretos',
        'leis': 'Leis',
        'comunicacao': 'Comunicação',
        'ti': 'Tecnologia da Informação',
        'suporte': 'Suporte Técnico',
        'home': 'Início'
      }
      if (dictionary[slug]) {
        return dictionary[slug]
      }
      return slug
        .replace(/[-_]+/g, ' ')
        .replace(/(?:^|\s)\S/g, (match) => match.toUpperCase())
    },

    pageUrl (item) {
      if (!item || !item.path) return '#'
      const cleanPath = item.path.replace(/^\/+/, '')
      const loc = item.locale || this.locale || 'pt'
      return `/${loc}/${cleanPath}`
    },

    isItemActive (item) {
      if (!item || !item.path) return false
      const normalize = (p) => (p || '').toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '')
      const curr = normalize(this.currentPath)
      const target = normalize(item.path)
      if (curr === target) return true

      const loc = (item.locale || this.locale || '').toLowerCase()
      if (loc) {
        if (curr === `${loc}/${target}` || `${loc}/${curr}` === target) return true
        if (curr.startsWith(loc + '/')) {
          const stripped = curr.substring(loc.length + 1)
          if (stripped === target) return true
        }
      }
      return false
    },

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

    getPageIcon (path, title) {
      const leaf = (path || '').split('/').pop() || ''
      const p = `${leaf} ${title || ''}`.toLowerCase()

      if (p.includes('cnh') || p.includes('habilita') || p.includes('condutor') || p.includes('renach')) {
        return 'mdi-card-account-details-outline'
      }
      if (p.includes('veiculo') || p.includes('veículo') || p.includes('carro') || p.includes('frota') || p.includes('ipva') || p.includes('renavam') || p.includes('placa')) {
        return 'mdi-car-side'
      }
      if (p.includes('exame') || p.includes('medico') || p.includes('médico') || p.includes('psico') || p.includes('clinica')) {
        return 'mdi-stethoscope'
      }
      if (p.includes('vistoria') || p.includes('infrac') || p.includes('infraç') || p.includes('multa')) {
        return 'mdi-clipboard-check-outline'
      }
      if (p.includes('sistema') || p.includes('intranet') || p.includes('software') || p.includes('painel') || p.includes('portal')) {
        return 'mdi-monitor'
      }
      if (p.includes('seguranca') || p.includes('segurança') || p.includes('acesso') || p.includes('senha') || p.includes('lgpd')) {
        return 'mdi-shield-check-outline'
      }
      if (p.includes('legis') || p.includes('lei') || p.includes('normat') || p.includes('portaria') || p.includes('decreto') || p.includes('resolu')) {
        return 'mdi-scale-balance'
      }
      if (p.includes('organograma') || p.includes('estrutura') || p.includes('setor') || p.includes('departamento')) {
        return 'mdi-sitemap'
      }
      if (p.includes('guia') || p.includes('manual') || p.includes('tutorial') || p.includes('passo-a-passo') || p.includes('ajuda')) {
        return 'mdi-book-open-page-variant-outline'
      }
      if (p.includes('estilo') || p.includes('design') || p.includes('layout') || p.includes('tema')) {
        return 'mdi-palette-outline'
      }
      if (p.includes('atendimento') || p.includes('ouvidoria') || p.includes('fale') || p.includes('contato')) {
        return 'mdi-headset'
      }
      if (p.includes('relat') || p.includes('indicador') || p.includes('estatist')) {
        return 'mdi-chart-line'
      }
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
  position: relative;
  width: 100%;
  margin-bottom: 2px;
}

.detran-tree__folder-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #e2f0e7;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.09);
    color: #ffffff;

    .detran-tree__chevron {
      color: rgba(255, 255, 255, 0.95);
    }
  }
}

.detran-tree__chevron {
  width: 16px !important;
  height: 16px !important;
  color: rgba(255, 255, 255, 0.6) !important;
  transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s ease !important;
  flex-shrink: 0;

  &.is-expanded {
    transform: rotate(90deg) !important;
    color: rgba(255, 255, 255, 0.95) !important;
  }
}

.detran-tree__chevron-spacer {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-block;
}

.detran-tree__folder-icon {
  width: 18px !important;
  height: 18px !important;
  flex-shrink: 0;
  transition: transform 0.2s ease !important;
}

.detran-tree__folder-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.detran-tree__open-page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 4px;
  border-radius: 6px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.65) !important;
  transition: all 0.2s ease;

  .v-icon {
    color: rgba(255, 255, 255, 0.65) !important;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.14);
    .v-icon {
      color: #ffffff !important;
    }
  }

  &.is-active {
    background: rgba(255, 255, 255, 0.2);
    .v-icon {
      color: #6ee7b7 !important;
    }
  }
}

.detran-tree__spinner {
  margin-left: auto;
  flex-shrink: 0;
}

.detran-tree__page {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  text-decoration: none !important;
  color: #cce0d2 !important;
  font-size: 0.8125rem;
  font-weight: 450;
  margin-bottom: 2px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.09);
    color: #ffffff !important;
    transform: translateX(2px);

    .detran-tree__page-icon {
      color: #ffffff !important;
      transform: scale(1.08);
    }
  }

  &.glass-active {
    background: rgba(255, 255, 255, 0.16) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14) !important;
    color: #ffffff !important;
    font-weight: 600 !important;
    border-left: 3px solid #6ee7b7 !important;
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;

    .detran-tree__page-icon {
      color: #ffffff !important;
    }
  }
}

.detran-tree__page-icon {
  width: 18px !important;
  height: 18px !important;
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease !important;
}

.detran-tree__page-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detran-tree__children {
  position: relative;
  margin-left: 15px;
  padding-left: 8px;
  border-left: 1.5px solid rgba(255, 255, 255, 0.12);
  margin-top: 2px;
  margin-bottom: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  will-change: height, opacity;
  transition: border-color 0.2s ease;

  &:hover {
    border-left-color: rgba(255, 255, 255, 0.24);
  }
}

.detran-tree__empty {
  font-size: 0.75rem;
  font-style: italic;
  color: rgba(255, 255, 255, 0.45);
  margin: 4px 0 6px 8px;
}
</style>

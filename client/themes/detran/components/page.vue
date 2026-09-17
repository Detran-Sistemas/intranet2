<template lang="pug">
  v-app.detran-app(:dark='false')

    //- Overlay mobile (fecha sidebar ao clicar fora)
    transition(name='detran-fade')
      .detran-mobile-overlay(
        v-if='mobileSidebarOpen'
        @click='mobileSidebarOpen = false'
        aria-hidden='true'
      )

    //- Layout principal: sidebar + conteúdo
    .detran-layout

      //- ================================================================
      //- SIDEBAR
      //- ================================================================
      nav-sidebar(
        :items='sidebarDecoded'
        :nav-mode='navMode'
        :current-path='path'
        :locale='locale'
        :class='{ "is-mobile-open": mobileSidebarOpen }'
        ref='sidebar'
      )

      //- ================================================================
      //- ÁREA PRINCIPAL
      //- ================================================================
      .detran-main

        //- Header flutuante (barra de busca + ações)
        header.detran-header.anim-hidden.anim-fade-in-up.stagger-1(aria-label='Barra de pesquisa e ações')
          .detran-header__inner

            //- Botão hamburger (mobile)
            button.detran-header__hamburger(
              @click='mobileSidebarOpen = !mobileSidebarOpen'
              :aria-expanded='mobileSidebarOpen'
              aria-label='Abrir menu de navegação'
            )
              v-icon mdi-menu

            //- Barra de busca glassmorphism
            .detran-search(
              role='search'
              :class='{ "is-focused": searchFocused }'
            )
              v-icon.detran-search__icon(size='18' color='#94a3b8') mdi-magnify
              input.detran-search__input(
                v-model='searchQuery'
                type='search'
                :placeholder='$t("common:header.searchPlaceholder", "Pesquisar procedimentos, manuais, sistemas...")'
                @focus='searchFocused = true'
                @blur='searchFocused = false'
                @keyup.enter='doSearch'
                @keyup.esc='clearSearch'
                aria-label='Campo de pesquisa'
                autocomplete='off'
              )
              kbd.detran-search__kbd(aria-hidden='true') ⌘K

            //- Ações do header
            .detran-header__actions
              //- Botão Nova Página (visível apenas para quem pode criar)
              button.detran-header__new-page-btn(
                v-if='canCreate'
                @click='newPage'
                :title='$t("common:header.newPage", "Nova Página")'
              )
                v-icon(size='16') mdi-plus
                span Nova Página

        //- Resultados de busca (reutiliza componente existente do Wiki.js)
        search-results(
          v-if='searchActive'
          :search='searchQuery'
          :locale='locale'
          @close='clearSearch'
        )

        //- Conteúdo principal scrollável
        .detran-content
          .detran-content__inner

            //- ----------------------------------------------------------------
            //- Cabeçalho da página (breadcrumb + título + botão editar)
            //- ----------------------------------------------------------------
            .detran-page-header.anim-hidden.anim-fade-in-up.stagger-2

              //- Breadcrumb
              nav.detran-breadcrumb(aria-label='Breadcrumb')
                a.detran-breadcrumb__home(:href='`/${locale}/home`' :title='$t("common:header.home", "Início")')
                  v-icon(size='14' color='#94a3b8') mdi-home
                template(v-for='(crumb, idx) in breadcrumbs')
                  span.detran-breadcrumb__sep(aria-hidden='true') /
                  a.detran-breadcrumb__item(
                    :href='crumb.path'
                    :class='{ "is-current": idx === breadcrumbs.length - 1 }'
                    :aria-current='idx === breadcrumbs.length - 1 ? "page" : undefined'
                  ) {{ crumb.label }}

              .detran-page-header__row
                h2.detran-page-title {{ title }}

                //- Botão Editar (inline — aparece também no header, antes do FAB)
                button.detran-edit-inline-btn(
                  v-if='canEdit'
                  @click='editPage'
                  :title='$t("common:header.editPage", "Editar Página")'
                )
                  v-icon(size='14') mdi-pencil
                  span {{ $t('common:header.editPage', 'Editar Página') }}

            //- ----------------------------------------------------------------
            //- Wrapper flex: artigo + TOC
            //- ----------------------------------------------------------------
            .detran-page-body

              //- Artigo principal
              article.detran-article.anim-hidden.anim-fade-in-up.stagger-3

                //- Cabeçalho do artigo (metadados)
                header.detran-article__header
                  .detran-article__meta-left
                    .detran-article__icon(aria-hidden='true')
                      v-icon(color='#288b4a' size='20') mdi-file-document-outline
                    .detran-article__meta
                      p.detran-article__category {{ $t('common:page.category', 'Página') }}
                      .detran-article__meta-row
                        span.detran-article__meta-item(v-if='readTime')
                          v-icon(size='12' color='#94a3b8') mdi-clock-outline
                          | {{ readTime }} min de leitura
                        span.detran-article__meta-sep(v-if='readTime' aria-hidden='true') •
                        span.detran-article__meta-item
                          v-icon(size='12' color='#94a3b8') mdi-calendar-plus
                          | {{ $t('common:page.createdOn', 'Criado em') }} {{ formattedCreatedAt }}
                        span.detran-article__meta-sep(aria-hidden='true') •
                        span.detran-article__meta-item
                          v-icon(size='12' color='#94a3b8') mdi-account
                          | {{ authorName }}
                      //- Tags
                      .detran-article__tags(v-if='tagsArray.length')
                        span.detran-tag(
                          v-for='tag in tagsArray'
                          :key='tag'
                        ) #{{ tag }}

                //- Conteúdo renderizado (page.render — HTML do Wiki.js)
                .detran-contents
                  slot(name='contents')

              //- Comentários (slot nativo do Wiki.js)
              .detran-comments(v-if='commentsEnabled === "true" || commentsEnabled === true')
                slot(name='comments')

            //- ----------------------------------------------------------------
            //- TOC (Índice lateral)
            //- ----------------------------------------------------------------
            aside.detran-toc.anim-hidden.anim-fade-in-up.stagger-5(
              v-if='tocDecoded.length'
              aria-label='Índice da página'
            )
              .detran-toc__card
                h4.detran-toc__title {{ $t('common:page.toc', 'Índice') }}
                nav
                  ul.detran-toc__list
                    li.detran-toc__item(
                      v-for='item in tocDecoded'
                      :key='item.anchor'
                      :class='`detran-toc__item--h${item.level}`'
                    )
                      a.detran-toc__link(
                        :href='`#${item.anchor}`'
                        :class='{ "is-active": activeTocAnchor === item.anchor }'
                      )
                        .detran-toc__dot(aria-hidden='true')
                        | {{ item.title }}

        //- ==================================================================
        //- SPEED DIAL — Menu Flutuante de Ações
        //- Fiel ao protótipo design_system.html (linhas 604-647)
        //- Estrutura DOM e CSS sem v-speed-dial do Vuetify
        //- ==================================================================
        .detran-speed-dial(v-if='showSpeedDial' role='complementary' aria-label='Ações da página')

          //- Ações secundárias (cascata, aparecem no hover via CSS)
          .detran-speed-dial__actions
            button.detran-speed-dial__action.detran-speed-dial__action--danger(
              v-if='canDelete'
              @click='deletePage'
              title='Excluir página'
            )
              v-icon(size='15' color='white') mdi-delete

            button.detran-speed-dial__action(
              @click='exportPage'
              title='Exportar'
            )
              v-icon(size='15' color='#334155') mdi-file-export

            button.detran-speed-dial__action(
              @click='duplicatePage'
              title='Duplicar'
            )
              v-icon(size='15' color='#334155') mdi-content-copy

            button.detran-speed-dial__action(
              @click='viewSource'
              title='Código Fonte'
            )
              v-icon(size='15' color='#334155') mdi-code-tags

            button.detran-speed-dial__action(
              @click='viewHistory'
              title='Histórico'
            )
              v-icon(size='15' color='#334155') mdi-history

          //- Botão principal (Editar)
          button.detran-speed-dial__main(
            @click='editPage'
            :title='$t("common:header.editPage", "Editar Página")'
            :aria-label='$t("common:header.editPage", "Editar Página")'
          )
            v-icon.detran-speed-dial__main-icon(size='20' color='white') mdi-pencil
            span.detran-speed-dial__tooltip Editar página
</template>

<script>
import { get } from 'vuex-pathify'

export default {
  name: 'Page',

  components: {
    NavSidebar: () => import('./nav-sidebar.vue')
  },

  // ---------------------------------------------------------------------------
  // Props — Contrato com o servidor (server/views/page.pug)
  // Não alterar nomes ou tipos sem verificar o template Pug
  // ---------------------------------------------------------------------------
  props: {
    locale:               { type: String, default: 'pt' },
    path:                 { type: String, default: 'home' },
    title:                { type: String, default: '' },
    description:          { type: String, default: '' },
    tags:                 { type: Array, default: () => [] },
    createdAt:            { type: String, default: '' },
    updatedAt:            { type: String, default: '' },
    authorName:           { type: String, default: '' },
    authorId:             { type: Number, default: 0 },
    editor:               { type: String, default: '' },
    isPublished:          { type: String, default: 'true' },
    toc:                  { type: String, default: '' },           // base64 JSON
    pageId:               { type: Number, default: 0 },
    sidebar:              { type: String, default: '' },           // base64 JSON
    navMode:              { type: String, default: 'SIDEBAR' },
    commentsEnabled:      { type: String, default: 'false' },
    effectivePermissions: { type: String, default: '' },           // base64 JSON
    commentsExternal:     { type: String, default: '' },
    editShortcuts:        { type: String, default: '' },           // base64 JSON
    filename:             { type: String, default: '' }
  },

  data () {
    return {
      searchQuery: '',
      searchFocused: false,
      searchActive: false,
      mobileSidebarOpen: false,
      activeTocAnchor: ''
    }
  },

  computed: {
    // -------------------------------------------------------------------------
    // Decodificação de props base64 (passadas pelo servidor em Pug)
    // -------------------------------------------------------------------------
    sidebarDecoded () {
      try { return JSON.parse(atob(this.sidebar)) } catch (e) { return [] }
    },
    tocDecoded () {
      try { return JSON.parse(atob(this.toc)) } catch (e) { return [] }
    },
    effectivePermsObj () {
      try { return JSON.parse(atob(this.effectivePermissions)) } catch (e) { return {} }
    },
    editShortcutsObj () {
      try { return JSON.parse(atob(this.editShortcuts)) } catch (e) { return {} }
    },

    // -------------------------------------------------------------------------
    // Permissões efetivas (calculadas pelo servidor, apenas exibidas na UI)
    // -------------------------------------------------------------------------
    canEdit () {
      const p = this.effectivePermsObj
      return (p.pages && (p.pages.write || p.pages.manage)) || false
    },
    canCreate () {
      const p = this.effectivePermsObj
      return (p.pages && (p.pages.write || p.pages.manage)) || false
    },
    canDelete () {
      const p = this.effectivePermsObj
      return (p.pages && p.pages.delete) || false
    },
    showSpeedDial () {
      return this.canEdit || this.canDelete
    },

    // -------------------------------------------------------------------------
    // Tags
    // -------------------------------------------------------------------------
    tagsArray () {
      if (Array.isArray(this.tags)) return this.tags.map(t => (typeof t === 'object' ? t.tag : t))
      return []
    },

    // -------------------------------------------------------------------------
    // Breadcrumbs gerados a partir do path
    // -------------------------------------------------------------------------
    breadcrumbs () {
      if (!this.path) return []
      const parts = this.path.split('/').filter(Boolean)
      const crumbs = []
      let acc = ''
      parts.forEach((part, idx) => {
        acc += (idx === 0 ? '' : '/') + part
        crumbs.push({
          label: part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          path: `/${this.locale}/${acc}`
        })
      })
      return crumbs
    },

    // -------------------------------------------------------------------------
    // Formatação de data
    // -------------------------------------------------------------------------
    formattedCreatedAt () {
      if (!this.createdAt) return ''
      try {
        return new Date(this.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        })
      } catch (e) { return this.createdAt }
    },

    formattedUpdatedAt () {
      if (!this.updatedAt) return ''
      try {
        return new Date(this.updatedAt).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        })
      } catch (e) { return this.updatedAt }
    },

    // Estimativa de tempo de leitura (200 palavras/min)
    readTime () {
      const el = this.$el && this.$el.querySelector('.detran-contents')
      if (!el) return null
      const words = (el.textContent || '').trim().split(/\s+/).length
      const mins = Math.max(1, Math.ceil(words / 200))
      return mins
    }
  },

  watch: {
    searchQuery (val) {
      this.searchActive = val.length > 2
    }
  },

  mounted () {
    // Atualiza metadados do Vuex (mesma abordagem do tema default)
    this.$store.set('page/id', this.pageId)
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/title', this.title)
    this.$store.set('page/description', this.description)
    this.$store.set('page/tags', this.tagsArray)
    this.$store.set('page/isPublished', this.isPublished === 'true' || this.isPublished === true)

    // Inicializa TOC observer (destaca item ativo no scroll)
    this.$nextTick(() => {
      this.initTocObserver()
    })

    // Atalho de teclado ⌘K / Ctrl+K para focar na busca
    window.addEventListener('keydown', this.handleGlobalKeydown)
  },

  beforeDestroy () {
    window.removeEventListener('keydown', this.handleGlobalKeydown)
    if (this._tocObserver) this._tocObserver.disconnect()
  },

  methods: {
    // -------------------------------------------------------------------------
    // Busca
    // -------------------------------------------------------------------------
    doSearch () {
      if (this.searchQuery.trim()) {
        this.$store.set('site/searchQuery', this.searchQuery)
        this.searchActive = true
      }
    },

    clearSearch () {
      this.searchQuery = ''
      this.searchActive = false
    },

    handleGlobalKeydown (e) {
      // ⌘K ou Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const input = this.$el.querySelector('.detran-search__input')
        if (input) input.focus()
      }
    },

    // -------------------------------------------------------------------------
    // Ações de página (reutilizam as rotas existentes do Wiki.js)
    // -------------------------------------------------------------------------
    editPage () {
      window.location.href = `/e/${this.locale}/${this.path}`
    },

    newPage () {
      this.$store.set('editor/mode', 'create')
      window.location.href = `/e/${this.locale}/new`
    },

    deletePage () {
      this.$store.set('page/deleteDialogShown', true)
    },

    viewHistory () {
      window.location.href = `/h/${this.locale}/${this.path}`
    },

    viewSource () {
      window.location.href = `/s/${this.locale}/${this.path}`
    },

    exportPage () {
      window.location.href = `/d/${this.locale}/${this.path}`
    },

    duplicatePage () {
      this.$store.set('pageSelector/shown', true)
      this.$store.set('pageSelector/mode', 'copy')
      this.$store.set('pageSelector/sourceId', this.pageId)
    },

    // -------------------------------------------------------------------------
    // TOC: observer de scroll para destaque do item ativo
    // -------------------------------------------------------------------------
    initTocObserver () {
      if (!this.tocDecoded.length) return

      const options = { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
      this._tocObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.activeTocAnchor = entry.target.id
          }
        })
      }, options)

      // Observa todos os headings com id no conteúdo
      const content = this.$el.querySelector('.detran-contents')
      if (content) {
        content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
          .forEach(el => this._tocObserver.observe(el))
      }
    }
  }
}
</script>

<style lang="scss">
// =============================================================================
// PAGE — Tema Detran-MG
// Layout principal: sidebar glassmorphism + área de conteúdo branca
// =============================================================================

// Override do v-application para o layout Detran
.detran-app {
  &.v-application {
    background: $detran-900 !important;
    font-family: $font-family-base !important;

    .v-application--wrap {
      min-height: 100vh;
      display: block; // remove o flex padrão do Vuetify
    }
  }
}

// ---------------------------------------------------------------------------
// OVERLAY MOBILE
// ---------------------------------------------------------------------------
.detran-mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 29;
}

.detran-fade-enter-active, .detran-fade-leave-active { transition: opacity 0.3s ease; }
.detran-fade-enter, .detran-fade-leave-to { opacity: 0; }

// ---------------------------------------------------------------------------
// LAYOUT RAIZ (flex horizontal)
// ---------------------------------------------------------------------------
.detran-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

// ---------------------------------------------------------------------------
// ÁREA PRINCIPAL
// ---------------------------------------------------------------------------
.detran-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0; // previne overflow
  height: 100vh;
  background: $color-surface;
  z-index: 20;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.20);
  overflow: hidden;
}

// ---------------------------------------------------------------------------
// HEADER FLUTUANTE
// ---------------------------------------------------------------------------
.detran-header {
  position: absolute;
  top: 24px;
  left: 0;
  right: 0;
  z-index: 20;
  pointer-events: none;
  padding: 0 2rem;

  @include mobile { padding: 0 1rem; top: 16px; }

  &__inner {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    pointer-events: auto;
  }

  &__hamburger {
    display: none;
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: $radius-lg;
    align-items: center;
    justify-content: center;
    box-shadow: $shadow-float;
    flex-shrink: 0;
    transition: $transition-fast;

    &:hover { background: rgba(255, 255, 255, 0.95); }

    @include mobile { display: flex; }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
  }

  &__new-page-btn {
    @extend .glass-panel;
    padding: 0.75rem 1.25rem;
    border-radius: $radius-lg;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    color: $detran-700;
    box-shadow: $shadow-float;
    transition: $transition-base;

    .v-icon { transition: transform 0.3s ease; }

    &:hover {
      background: $detran-700;
      color: white;

      .v-icon { transform: rotate(90deg); }
    }
  }
}

// ---------------------------------------------------------------------------
// BUSCA (glassmorphism)
// ---------------------------------------------------------------------------
.detran-search {
  @extend .glass-panel;
  flex: 1;
  max-width: 640px;
  border-radius: 1rem;
  box-shadow: $shadow-float;
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  transition: $transition-base;
  border: 2px solid transparent;

  &.is-focused {
    border-color: $detran-500;
    background: rgba(255, 255, 255, 0.98);
  }

  &__icon {
    flex-shrink: 0;
    margin-right: 0.75rem;
  }

  &__input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: $font-family-base;
    font-size: 0.875rem;
    font-weight: 500;
    color: $slate-700;

    &::placeholder { color: $slate-400; }
  }

  &__kbd {
    display: none;
    padding: 0.125rem 0.5rem;
    background: $slate-100;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: $slate-500;
    border: 1px solid $slate-200;
    flex-shrink: 0;
    font-family: $font-family-base;

    @include tablet-up { display: inline-block; }
  }
}

// ---------------------------------------------------------------------------
// CONTEÚDO (área scrollável)
// ---------------------------------------------------------------------------
.detran-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: $header-height + 24px; // espaço para o header absoluto
  padding-bottom: 3rem;

  &__inner {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    flex-direction: column;
    gap: 0;

    @include mobile { padding: 0 1rem; }
  }
}

// ---------------------------------------------------------------------------
// CABEÇALHO DA PÁGINA (breadcrumb + título)
// ---------------------------------------------------------------------------
.detran-page-header {
  margin-bottom: 1.5rem;

  &__row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.5rem;

    @include mobile { flex-direction: column; align-items: flex-start; }
  }
}

.detran-page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: $slate-800;
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 0;

  @include mobile { font-size: 1.5rem; }
}

.detran-edit-inline-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: $detran-600;
  color: white;
  border-radius: $radius-md;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: $shadow-soft;
  transition: $transition-fast;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: $detran-700;
    box-shadow: 0 4px 12px rgba($detran-500, 0.3);
  }
}

// ---------------------------------------------------------------------------
// BREADCRUMB
// ---------------------------------------------------------------------------
.detran-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: $slate-500;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;

  &__home {
    display: flex;
    align-items: center;
    transition: $transition-fast;
    &:hover .v-icon { color: $detran-600 !important; }
  }

  &__sep { color: $slate-400; font-size: 0.75rem; }

  &__item {
    font-weight: 500;
    color: $slate-800;
    transition: $transition-fast;

    &:hover { color: $detran-700; }
    &.is-current { pointer-events: none; color: $slate-500; }
  }
}

// ---------------------------------------------------------------------------
// LAYOUT DO CORPO (artigo + TOC)
// ---------------------------------------------------------------------------
.detran-page-body {
  display: flex;
  gap: 2.5rem;
  align-items: flex-start;

  @include tablet { flex-direction: column; }
  @include mobile { flex-direction: column; }
}

// ---------------------------------------------------------------------------
// ARTIGO
// ---------------------------------------------------------------------------
.detran-article {
  flex: 1;
  min-width: 0;
  background: white;
  border-radius: $radius-xl;
  box-shadow: $shadow-soft;
  padding: 2rem 2.5rem 3rem;
  width: 100%;

  @include mobile { padding: 1.25rem 1rem; }

  &__header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid $slate-100;

    @include tablet-up {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  &__meta-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__icon {
    width: 48px;
    height: 48px;
    background: $detran-50;
    border-radius: $radius-lg;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__category {
    font-size: 0.875rem;
    font-weight: 500;
    color: $slate-800;
    margin: 0;
  }

  &__meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem 0.75rem;
  }

  &__meta-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: $slate-500;
  }

  &__meta-sep {
    color: $slate-300;
    font-size: 0.625rem;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 0.5rem;
  }
}

// ---------------------------------------------------------------------------
// TAG
// ---------------------------------------------------------------------------
.detran-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background: $detran-50;
  color: $detran-700;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: $radius-sm;
}

// ---------------------------------------------------------------------------
// COMENTÁRIOS
// ---------------------------------------------------------------------------
.detran-comments {
  margin-top: 2rem;
  background: white;
  border-radius: $radius-xl;
  padding: 2rem;
  box-shadow: $shadow-soft;
}

// ---------------------------------------------------------------------------
// TOC (Índice lateral)
// ---------------------------------------------------------------------------
.detran-toc {
  width: 280px;
  flex-shrink: 0;
  position: sticky;
  top: $header-height + 24px;

  @include tablet { width: 100%; position: static; }
  @include mobile { display: none; } // Oculto no mobile — acesso via heading links

  &__card {
    background: white;
    border-radius: $radius-xl;
    padding: 1.5rem;
    box-shadow: $shadow-soft;
  }

  &__title {
    font-size: 0.6875rem;
    font-weight: 700;
    color: $slate-400;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 1rem;
  }

  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__item {
    // Indentação por nível de heading
    &--h1 { padding-left: 0; }
    &--h2 { padding-left: 0; }
    &--h3 { padding-left: 1rem; }
    &--h4 { padding-left: 1.75rem; }
    &--h5 { padding-left: 2.5rem; }
    &--h6 { padding-left: 3.25rem; }
  }

  &__link {
    display: flex;
    align-items: center;
    font-size: 0.875rem;
    color: $slate-500;
    text-decoration: none;
    transition: $transition-fast;

    &:hover { color: $slate-800; }

    &.is-active {
      color: $detran-700;
      font-weight: 600;

      .detran-toc__dot { background: $detran-500; }
    }
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: $slate-300;
    flex-shrink: 0;
    margin-right: 0.5rem;
    transition: background 0.2s;
  }
}

// ---------------------------------------------------------------------------
// SPEED DIAL (Menu Flutuante de Ações)
// DOM fiel ao protótipo, sem v-speed-dial do Vuetify
// ---------------------------------------------------------------------------
.detran-speed-dial {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  // Quando hover no container, exibe as ações
  &:hover .detran-speed-dial__actions {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    opacity: 0;
    transform: translateY(16px);
    pointer-events: none;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  &__action {
    width: 44px;
    height: 44px;
    border-radius: $radius-full;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: $transition-fast;
    background: white;
    border: 1px solid $slate-100;

    &:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    &--danger {
      background: #ef4444;
      border-color: transparent;

      &:hover {
        background: #dc2626;
        box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
      }
    }
  }

  // Botão principal de edição
  &__main {
    position: relative;
    z-index: 10;
    width: 52px;
    height: 52px;
    background: $detran-500;
    border-radius: $radius-full;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: $shadow-fab;
    transition: background-color 0.2s ease;
    flex-shrink: 0;

    &:hover {
      background: $detran-600;

      .detran-speed-dial__tooltip {
        opacity: 1;
      }

      .detran-speed-dial__main-icon {
        transform: rotate(360deg);
      }
    }
  }

  &__main-icon {
    transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  }

  &__tooltip {
    position: absolute;
    right: 64px;
    background: $slate-600;
    color: white;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    border-radius: $radius-md;
    opacity: 0;
    transition: opacity 0.2s;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: $shadow-soft;
  }
}
</style>

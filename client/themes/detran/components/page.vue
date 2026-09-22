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

      //- Blobs decorativos (fundo abstrato z-0 independente para o glassmorphism da sidebar brilhar sem degradar rasterização de fontes)
      .detran-sidebar-blobs(aria-hidden='true')
        .blob.blob--top
        .blob.blob--mid
        .blob.blob--bottom

      //- ================================================================
      //- SIDEBAR
      //- ================================================================
      nav-sidebar(
        v-if='navMode !== "NONE"'
        :items='sidebarDecoded'
        :nav-mode='navMode'
        :current-path='path'
        :locale='locale'
        :can-manage-system='canManageSystem'
        :class='{ "is-mobile-open": mobileSidebarOpen }'
        @close-mobile='mobileSidebarOpen = false'
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
              v-if='navMode !== "NONE"'
              @click='mobileSidebarOpen = !mobileSidebarOpen'
              :aria-expanded='mobileSidebarOpen'
              aria-label='Abrir menu de navegação'
            )
              v-icon mdi-menu

            //- Barra de busca glassmorphism com previsão e busca em tempo real
            .detran-search(
              role='search'
              :class='{ "is-focused": searchIsFocused }'
            )
              v-icon.detran-search__icon(size='18' color='#94a3b8') mdi-magnify
              input.detran-search__input(
                v-model='search'
                type='search'
                :placeholder='searchPlaceholder'
                @focus='searchFocus'
                @blur='searchBlur'
                @keyup.enter='searchEnter'
                @keyup.esc='searchClose'
                @keyup.down.prevent='searchMove("down")'
                @keyup.up.prevent='searchMove("up")'
                aria-label='Campo de pesquisa'
                autocomplete='off'
              )
              v-progress-circular(
                v-if='searchIsLoading'
                indeterminate
                color='#288b4a'
                size='18'
                width='2'
              )
              button.detran-search__clear-btn(
                v-else-if='search && search.length > 0'
                type='button'
                @click='searchClose'
                aria-label='Limpar pesquisa'
              )
                v-icon(size='16' color='#94a3b8') mdi-close-circle

            //- Ações do header
            .detran-header__actions
              //- Seletor de Idiomas (quando há múltiplos idiomas configurados)
              v-menu(offset-y bottom transition='slide-y-transition' v-if='locales.length > 1')
                template(v-slot:activator='{ on }')
                  button.detran-header__action-btn(v-on='on' :title='$t("common:header.language", "Idioma")' type='button')
                    v-icon(size='16' color='#64748b') mdi-web
                    span {{ locale.toUpperCase() }}
                    v-icon(size='12' color='#94a3b8') mdi-chevron-down
                v-list(dense)
                  v-list-item(
                    v-for='lc in locales'
                    :key='lc.code'
                    @click='changeLocale(lc)'
                  )
                    v-list-item-action(style='min-width:auto; margin-right: 8px;')
                      v-chip(:color='lc.code === locale ? "#288b4a" : "grey"' small label dark) {{ lc.code.toUpperCase() }}
                    v-list-item-title {{ lc.name }}

              //- Botão Nova Página (apenas quando tem permissão)
              button.detran-header__new-page-btn(
                v-if='canCreate'
                @click='newPage'
                :title='$t("common:header.newPage", "Nova Página")'
                type='button'
              )
                v-icon(size='16') mdi-plus
                span Nova Página

              //- Botão Entrar (quando NÃO autenticado)
              a.detran-header__login-btn(
                v-if='!isAuthenticated'
                href='/login'
                :title='$t("common:header.login", "Entrar")'
              )
                v-icon(size='16') mdi-login
                span Entrar

              //- Botão Perfil / Usuário (quando AUTENTICADO)
              button.detran-header__user-btn(
                v-else
                @click='openUserModal'
                :title='userName'
                aria-label='Acessar menu do usuário'
                type='button'
              )
                img.detran-header__user-avatar(
                  v-if='hasUserAvatar || userAvatar'
                  :src='userAvatar'
                  :alt='userName'
                  @error='avatarFailed = true'
                  loading='lazy'
                )
                .detran-header__user-initials(v-else) {{ userInitials }}

        //- Resultados de busca e sugestões preditivas do Wiki.js
        search-results

        //- Conteúdo principal scrollável
        .detran-content
          .detran-content__inner

            //- ----------------------------------------------------------------
            //- Cabeçalho da página (breadcrumb + título + botão editar)
            //- ----------------------------------------------------------------
            .detran-page-header.anim-hidden.anim-fade-in-up.stagger-2

              //- Breadcrumb
              nav.detran-breadcrumb(aria-label='Trilha de navegação')
                a.detran-breadcrumb__home(
                  :href='`/${locale}/home`'
                  :title='$t("common:header.home", "Início")'
                  @click='onHomeCrumbClick'
                )
                  v-icon(size='14' color='#94a3b8') mdi-home
                template(v-for='(crumb, idx) in breadcrumbs')
                  span.detran-breadcrumb__sep(aria-hidden='true') /
                  a.detran-breadcrumb__item(
                    :href='crumb.path'
                    :class='{ "is-current": idx === breadcrumbs.length - 1 }'
                    :aria-current='idx === breadcrumbs.length - 1 ? "page" : undefined'
                    @click='onCrumbClick($event, crumb, idx === breadcrumbs.length - 1)'
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

                //- Alerta de página não publicada (rascunho)
                .detran-unpublished-alert(v-if='!isPagePublished' role='alert')
                  .detran-unpublished-alert__icon
                    v-icon(size='20' color='#dc2626') mdi-alert-circle-outline
                  .detran-unpublished-alert__text
                    strong {{ $t('common:page.unpublished', 'Página Não Publicada') }}:
                    span &nbsp;{{ $t('common:page.unpublishedWarning', 'Esta página está em modo de rascunho e não está visível para usuários sem permissão de edição.') }}

                //- Cabeçalho do artigo (metadados)
                header.detran-article__header
                  .detran-article__meta-left
                    .detran-article__icon(aria-hidden='true')
                      v-icon(color='#288b4a' size='22') {{ articleIcon }}
                    .detran-article__meta
                      p.detran-article__category {{ displayCategory }}
                      .detran-article__meta-row
                        span.detran-article__meta-item(v-if='displayReadTime')
                          v-icon(size='12' color='#94a3b8') mdi-clock-outline
                          | {{ displayReadTime }} min de leitura
                        span.detran-article__meta-sep(v-if='displayReadTime' aria-hidden='true') •
                        span.detran-article__meta-item(:title='fullUpdatedAt')
                          v-icon(size='12' color='#94a3b8') mdi-history
                          | {{ $t('common:page.lastEditedOn', 'Editado por último em') }} {{ formattedUpdatedAt }}
                        span.detran-article__meta-sep(aria-hidden='true') •
                        a.detran-article__meta-item.detran-article__meta-link(
                          :href='"/h/" + locale + "/" + path'
                          :title='$t("common:header.history", "Ver histórico de edições")'
                        )
                          v-icon(size='12' color='#94a3b8') mdi-account
                          | {{ authorName }}
                      //- Tags
                      .detran-article__tags(v-if='tagsArray.length')
                        a.detran-tag(
                          v-for='tag in tagsArray'
                          :key='tag'
                          :href='"/t/" + tag'
                          :title='"Filtrar páginas pela tag #" + tag'
                        ) {{ '#' + tag }}

                //- Conteúdo renderizado (page.render — HTML do Wiki.js)
                .detran-contents(ref='container')
                  slot(name='contents')

                //- Comentários (slot nativo do Wiki.js)
                .detran-comments(v-if='commentsEnabled === "true" || commentsEnabled === true')
                  slot(name='comments')

              //- ----------------------------------------------------------------
              //- TOC (Índice lateral)
              //- ----------------------------------------------------------------
              aside.detran-toc.anim-hidden.anim-fade-in-up.stagger-5(
                v-if='showTocCalculated'
                aria-label='Índice da página'
              )
                .detran-toc__card
                  h4.detran-toc__title {{ $t('common:page.tocTitle', 'Índice do Guia') }}
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
                          @click.prevent='scrollToAnchor(item.anchor)'
                        )
                          .detran-toc__dot(aria-hidden='true')
                          | {{ item.title }}

        //- Rodapé fixado na parte inferior da tela
        nav-footer

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
              @click='printPage'
              :title='$t("common:page.printFormat", "Imprimir")'
            )
              v-icon(size='15' color='#334155') mdi-printer

            button.detran-speed-dial__action(
              v-if='canEdit'
              @click='convertPage'
              :title='$t("common:header.convert", "Converter formato")'
            )
              v-icon(size='15' color='#334155') mdi-lightning-bolt

            button.detran-speed-dial__action(
              v-if='canEdit'
              @click='movePage'
              :title='$t("common:header.move", "Mover / Renomear página")'
            )
              v-icon(size='15' color='#334155') mdi-content-save-move-outline

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

    page-selector(
      mode='create'
      v-model='newPageModal'
      :open-handler='pageNewCreate'
      :path='path'
      :locale='locale'
    )
    page-selector(
      mode='move'
      v-model='movePageModal'
      :open-handler='pageMoveRename'
      :path='path'
      :locale='locale'
    )
    page-selector(
      mode='create'
      v-model='duplicateOpts.modal'
      :open-handler='pageDuplicateHandle'
      :path='duplicateOpts.path'
      :locale='duplicateOpts.locale'
    )
    page-convert(v-model='convertPageModal' v-if='path && path.length')
    page-delete(v-model='deletePageModal' v-if='path && path.length')
    notify
</template>

<script>
import Vue from 'vue'
import Tabset from './tabset.vue'
import NavSidebar from './nav-sidebar.vue'
import NavFooter from './nav-footer.vue'
import Prism from 'prismjs'
import mermaid from 'mermaid'
import ClipboardJS from 'clipboard'
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import movePageMutation from 'gql/common/common-pages-mutation-move.gql'

/* global siteLangs */

Vue.component('Tabset', Tabset)

Prism.plugins.autoloader.languages_path = '/_assets/js/prism/'
Prism.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true,
  'remove-initial-line-feed': true,
  'tabs-to-spaces': 2
})

try {
  if (Prism && Prism.plugins && Prism.plugins.toolbar && !Prism.plugins.toolbar.buttons['copy-to-clipboard']) {
    Prism.plugins.toolbar.registerButton('copy-to-clipboard', (env) => {
      const linkCopy = document.createElement('button')
      linkCopy.textContent = 'Copy'

      const clip = new ClipboardJS(linkCopy, {
        text: () => env.code
      })

      clip.on('success', () => {
        linkCopy.textContent = 'Copied!'
        setTimeout(() => { linkCopy.textContent = 'Copy' }, 5000)
      })
      clip.on('error', () => {
        linkCopy.textContent = 'Press Ctrl+C'
        setTimeout(() => { linkCopy.textContent = 'Copy' }, 5000)
      })

      return linkCopy
    })
  }
} catch (e) {}

export default {
  name: 'Page',

  components: {
    NavSidebar,
    NavFooter,
    PageDelete: () => import('@/components/common/page-delete.vue'),
    PageConvert: () => import('@/components/common/page-convert.vue')
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
      mobileSidebarOpen: false,
      activeTocAnchor: '',
      calculatedReadTime: 0,
      deletePageModal: false,
      newPageModal: false,
      movePageModal: false,
      convertPageModal: false,
      avatarFailed: false,
      duplicateOpts: {
        locale: 'pt',
        path: 'new-page',
        modal: false
      }
    }
  },

  computed: {
    // -------------------------------------------------------------------------
    // Usuário & Busca (sincronizados com Vuex store)
    // -------------------------------------------------------------------------
    userId: get('user/id'),
    isAuthenticated: get('user/authenticated'),
    rawUserName: get('user/name'),
    rawUserEmail: get('user/email'),
    rawJobTitle: get('user/jobTitle'),
    rawPictureUrl: get('user/pictureUrl'),

    searchPlaceholder () {
      return this.$t('common:header.searchPlaceholder', 'Pesquisar procedimentos, manuais, sistemas...')
    },
    userName () {
      if (this.rawUserName && this.rawUserName.trim().length > 0 && this.rawUserName !== 'Guest') {
        return this.rawUserName
      }
      return 'Danilo Santana'
    },
    userInitials () {
      const name = this.userName || ''
      const parts = name.trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) return 'D'
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    },
    hasUserAvatar () {
      if (this.avatarFailed) return false
      return !!(this.rawPictureUrl && this.rawPictureUrl.length > 1 && !this.rawPictureUrl.includes('pravatar.cc'))
    },
    userAvatar () {
      const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2333a65b'/><stop offset='100%' stop-color='%231b5830'/></linearGradient></defs><rect width='100' height='100' rx='50' fill='url(%23g)'/><circle cx='50' cy='38' r='18' fill='%23ffffff' opacity='0.95'/><path d='M22 86 C22 66 36 58 50 58 C64 58 78 66 78 86 Z' fill='%23ffffff' opacity='0.95'/></svg>"
      if (this.avatarFailed) return defaultAvatar
      if (this.rawPictureUrl && this.rawPictureUrl.length > 1 && !this.rawPictureUrl.includes('pravatar.cc')) {
        return (this.rawPictureUrl === 'internal') ? `/_userav/${this.userId}` : this.rawPictureUrl
      }
      return defaultAvatar
    },

    search: sync('site/search'),
    searchIsFocused: sync('site/searchIsFocused'),
    searchIsLoading: sync('site/searchIsLoading'),

    // -------------------------------------------------------------------------
    // Decodificação de props base64 (passadas pelo servidor em Pug)
    // -------------------------------------------------------------------------
    sidebarDecoded () {
      try { return JSON.parse(Buffer.from(this.sidebar, 'base64').toString('utf8')) } catch (e) {
        try { return JSON.parse(decodeURIComponent(escape(atob(this.sidebar)))) } catch (err) { return [] }
      }
    },
    tocDecoded () {
      try { return JSON.parse(Buffer.from(this.toc, 'base64').toString('utf8')) } catch (e) {
        try { return JSON.parse(decodeURIComponent(escape(atob(this.toc)))) } catch (err) { return [] }
      }
    },
    effectivePermsObj () {
      try { return JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString('utf8')) } catch (e) {
        try { return JSON.parse(atob(this.effectivePermissions)) } catch (err) { return {} }
      }
    },
    editShortcutsObj () {
      try { return JSON.parse(Buffer.from(this.editShortcuts, 'base64').toString('utf8')) } catch (e) {
        try { return JSON.parse(atob(this.editShortcuts)) } catch (err) { return {} }
      }
    },

    // -------------------------------------------------------------------------
    // Permissões efetivas (calculadas pelo servidor, apenas exibidas na UI)
    // -------------------------------------------------------------------------
    locales () {
      return typeof siteLangs !== 'undefined' ? siteLangs : []
    },
    tocPosition: get('site/tocPosition'),
    showTocCalculated () {
      return this.tocPosition !== 'off' && this.tocDecoded.length > 0
    },
    isPagePublished () {
      return this.isPublished === true || this.isPublished === 'true' || this.isPublished === 1 || this.isPublished === '1'
    },
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
    canReadSource () {
      const p = this.effectivePermsObj
      return (p.source && p.source.read) || false
    },
    canReadHistory () {
      const p = this.effectivePermsObj
      return (p.history && p.history.read) || false
    },
    canManageSystem () {
      const p = this.effectivePermsObj
      return !!(p.system && p.system.manage)
    },
    showSpeedDial () {
      return this.canEdit || this.canDelete || this.canReadSource || this.canReadHistory
    },

    // -------------------------------------------------------------------------
    // Tags
    // -------------------------------------------------------------------------
    rawTagsArray () {
      if (Array.isArray(this.tags)) {
        return this.tags.map(t => {
          if (typeof t === 'string') return t
          if (t && typeof t === 'object') return t.tag || t.title || ''
          return ''
        }).filter(Boolean)
      }
      return []
    },
    tagsArray () {
      return this.rawTagsArray.filter(t => !t.toLowerCase().startsWith('icon:'))
    },
    displayCategory () {
      if (this.description && this.description !== this.title) return this.description
      if (this.path === 'home') return 'Início'
      return this.$t('common:page.category', 'Página')
    },
    articleIcon () {
      // 1. Tag explícita de ícone definida na página (ex: "icon:mdi-car-side" ou "icon:cash")
      const iconTag = this.rawTagsArray.find(t => t.toLowerCase().startsWith('icon:'))
      if (iconTag) {
        const raw = iconTag.split(':')[1].trim()
        return raw.startsWith('mdi-') ? raw : `mdi-${raw}`
      }

      // 2. Se a página estiver vinculada a um item do menu lateral (Navegação), herda o ícone do menu
      if (this.sidebarDecoded && this.sidebarDecoded.length) {
        const currentClean = (this.path || '').toLowerCase()
        const navMatch = this.sidebarDecoded.find(item => {
          if (!item.t) return false
          const itemClean = item.t.replace(/^\//, '').replace(/^pt\//, '').replace(/^en\//, '').toLowerCase()
          return itemClean === currentClean
        })
        if (navMatch && navMatch.c && navMatch.c !== 'mdi-chevron-right') {
          return navMatch.c
        }
      }

      // 3. Mapeamento inteligente por caminho (path) e tags da página
      const p = (this.path || '').toLowerCase()
      const tagStr = this.rawTagsArray.join(' ').toLowerCase()
      const ctx = `${p} ${tagStr}`

      if (ctx.includes('habilita') || ctx.includes('cnh')) return 'mdi-card-account-details-outline'
      if (ctx.includes('veiculo') || ctx.includes('veículo') || ctx.includes('carro') || ctx.includes('frota')) return 'mdi-car-side'
      if (ctx.includes('sistema') || ctx.includes('software') || ctx.includes('computador') || ctx.includes('tecnologia')) return 'mdi-monitor'
      if (ctx.includes('normativo') || ctx.includes('lei') || ctx.includes('resoluc') || ctx.includes('portaria') || ctx.includes('manual')) return 'mdi-file-document-outline'
      if (ctx.includes('infrac') || ctx.includes('infraç') || ctx.includes('multa') || ctx.includes('fisc') || ctx.includes('penal')) return 'mdi-alert-octagon-outline'
      if (ctx.includes('atend') || ctx.includes('cidad') || ctx.includes('usuario')) return 'mdi-account-group'
      if (ctx.includes('relat') || ctx.includes('estat') || ctx.includes('grafic')) return 'mdi-chart-bar'
      if (ctx.includes('design') || ctx.includes('estilo') || ctx.includes('palette') || ctx.includes('ui') || ctx.includes('css')) return 'mdi-palette'
      if (p === 'home' || p === '') return 'mdi-home'

      return 'mdi-file-document-outline'
    },
    displayReadTime () {
      return this.calculatedReadTime || this.readTime || 5
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
      const dt = this.updatedAt || this.createdAt
      if (!dt) return ''
      try {
        return new Date(dt).toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        })
      } catch (e) { return dt }
    },

    fullUpdatedAt () {
      const dt = this.updatedAt || this.createdAt
      if (!dt) return ''
      try {
        return new Date(dt).toLocaleString('pt-BR')
      } catch (e) { return dt }
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

  mounted () {
    // Reseta estado de busca ao montar a página
    this.search = ''
    this.searchIsFocused = false

    // Atualiza metadados do Vuex (mesma abordagem do tema default)
    this.$store.set('page/id', this.pageId)
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/title', this.title)
    this.$store.set('page/description', this.description)
    this.$store.set('page/tags', this.tagsArray)
    this.$store.set('page/isPublished', this.isPagePublished)
    this.$store.set('page/effectivePermissions', this.effectivePermsObj)
    this.$store.set('page/createdAt', this.createdAt)
    this.$store.set('page/updatedAt', this.updatedAt)
    this.$store.set('page/mode', 'view')

    // -> Realce de sintaxe via PrismJS
    const contentEl = this.$refs.container || (this.$el && this.$el.querySelector('.detran-contents'))
    if (contentEl) {
      Prism.highlightAllUnder(contentEl)
    }

    // -> Inicialização de diagramas Mermaid
    try {
      mermaid.mermaidAPI.initialize({
        startOnLoad: true,
        theme: 'default'
      })
    } catch (e) {}

    // -> Scroll para âncora ao carregar a página
    if (window.location.hash && window.location.hash.length > 1) {
      const scrollTarget = () => {
        const target = document.querySelector(decodeURIComponent(window.location.hash))
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' })
        }
      }
      if (document.readyState === 'complete') {
        this.$nextTick(scrollTarget)
      } else {
        window.addEventListener('load', scrollTarget, { once: true })
      }
    }

    // -> Interceptação de links de âncoras internas e notificação de página pronta
    this.$nextTick(() => {
      if (contentEl) {
        contentEl.querySelectorAll(`a[href^="#"], a[href^="${window.location.href.replace(window.location.hash, '')}#"]`).forEach(el => {
          el.onclick = ev => {
            ev.preventDefault()
            ev.stopPropagation()
            const hash = ev.currentTarget.hash
            if (hash) {
              const target = document.querySelector(decodeURIComponent(hash))
              if (target) {
                target.scrollIntoView({ behavior: 'smooth' })
                history.pushState(null, '', hash)
              }
            }
          }
        })
      }

      if (window.boot && typeof window.boot.notify === 'function') {
        window.boot.notify('page-ready')
      }
    })

    // Inicializa TOC observer (destaca item ativo no scroll) e calcula leitura
    this.$nextTick(() => {
      this.initTocObserver()
      this.updateReadingTime()
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
    // Busca e Previsão de Texto (conecta com search-results do Wiki.js)
    // -------------------------------------------------------------------------
    searchFocus () {
      this.searchIsFocused = true
    },

    searchBlur () {
      _.delay(() => {
        this.searchIsFocused = false
      }, 200)
    },

    searchClose () {
      this.search = ''
      this.searchIsFocused = false
    },

    searchEnter () {
      this.$root.$emit('searchEnter', true)
    },

    searchMove (dir) {
      this.$root.$emit('searchMove', dir)
    },

    handleGlobalKeydown (e) {
      // ⌘K ou Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const input = this.$el.querySelector('.detran-search__input')
        if (input) {
          input.focus()
          this.searchFocus()
        }
      }
    },

    updateReadingTime () {
      const el = this.$el && this.$el.querySelector('.detran-contents')
      if (el) {
        const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length
        this.calculatedReadTime = Math.max(1, Math.ceil(words / 200))
      }
    },

    scrollToTop () {
      const content = this.$el.querySelector('.detran-content')
      if (content) {
        content.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },

    onCrumbClick (event, crumb, isCurrent) {
      if (isCurrent) {
        event.preventDefault()
        this.scrollToTop()
      }
    },

    onHomeCrumbClick (event) {
      if (this.path === 'home' || this.path === '') {
        event.preventDefault()
        this.scrollToTop()
      }
    },

    // -------------------------------------------------------------------------
    // Ações de página (reutilizam as rotas e modais do Wiki.js)
    // -------------------------------------------------------------------------
    editPage () {
      window.location.href = `/e/${this.locale}/${this.path}`
    },

    newPage () {
      this.newPageModal = true
    },

    pageNewCreate ({ path, locale }) {
      window.location.assign(`/e/${locale}/${path}`)
    },

    movePage () {
      this.movePageModal = true
    },

    convertPage () {
      this.convertPageModal = true
    },

    printPage () {
      window.print()
    },

    async pageMoveRename ({ path, locale }) {
      this.$store.commit('loadingStart', 'page-move')
      try {
        const resp = await this.$apollo.mutate({
          mutation: movePageMutation,
          variables: {
            id: this.pageId || this.$store.get('page/id'),
            destinationLocale: locale,
            destinationPath: path
          }
        })
        if (_.get(resp, 'data.pages.move.responseResult.succeeded', false)) {
          window.location.replace(`/${locale}/${path}`)
        } else {
          throw new Error(_.get(resp, 'data.pages.move.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
        this.$store.commit('loadingStop', 'page-move')
      }
    },

    async changeLocale (locale) {
      if (this.$i18n && this.$i18n.i18next) {
        await this.$i18n.i18next.changeLanguage(locale.code)
      }
      window.location.assign(`/${locale.code}/${this.path}`)
    },

    deletePage () {
      this.deletePageModal = true
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
      const pathParts = this.path.split('/')
      this.duplicateOpts = {
        locale: this.locale,
        path: (pathParts.length > 1) ? pathParts.slice(0, -1).join('/') + '/new-page' : 'new-page',
        modal: true
      }
    },

    pageDuplicateHandle ({ locale, path }) {
      window.location.assign(`/e/${locale}/${path}?from=${this.pageId}`)
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
    },

    scrollToAnchor (anchor) {
      if (!anchor) return
      const target = document.getElementById(anchor) || document.querySelector(`[id="${anchor}"]`) || document.querySelector(`a[name="${anchor}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (history && history.pushState) {
          history.pushState(null, '', `#${anchor}`)
        }
        this.activeTocAnchor = anchor
      }
    },

    openUserModal () {
      if (this.$refs.sidebar && typeof this.$refs.sidebar.openUserModal === 'function') {
        this.$refs.sidebar.openUserModal()
      }
    }
  }
}
</script>

<style lang="scss">
@import '../scss/variables';

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
  background: rgba(0, 0, 0, 0.55);
  z-index: 90; // Acima do header (45), abaixo da sidebar (100)
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
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

// Blobs decorativos no fundo da sidebar (isolados para manter texto 100% nítido)
.detran-sidebar-blobs {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 320px;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;

  .blob {
    position: absolute;
    border-radius: 50%;
    mix-blend-mode: screen;
    filter: blur(50px);

    &--top {
      width: 288px;
      height: 288px;
      background: rgba($detran-400, 0.40);
      top: -80px;
      left: -80px;
      opacity: 0.8;
    }

    &--mid {
      width: 256px;
      height: 256px;
      background: rgba($detran-300, 0.20);
      top: 50%;
      left: -40px;
      transform: translateY(-50%);
      opacity: 0.6;
      filter: blur(40px);
    }

    &--bottom {
      width: 320px;
      height: 320px;
      background: rgba($detran-500, 0.40);
      bottom: -80px;
      left: -80px;
      opacity: 0.8;
    }
  }
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
  z-index: 45;
  pointer-events: none;
  padding: 0 2rem;

  @include mobile {
    top: 0;
    left: 0;
    right: 0;
    padding: 0.625rem 0.875rem;
    background: rgba(248, 250, 252, 0.94) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border-bottom: 1px solid rgba(226, 232, 240, 0.9) !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04) !important;
    pointer-events: auto;
  }

  &__inner {
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: auto;

    @include mobile {
      gap: 0.5rem;
    }
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
    border: none;
    cursor: pointer;

    &:hover { background: rgba(255, 255, 255, 0.95); }

    @include mobile {
      display: flex;
      width: 38px;
      height: 38px;
      border-radius: 0.625rem;
      border: 1px solid rgba(226, 232, 240, 0.85);
      background: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      .v-icon {
        font-size: 20px !important;
        color: $slate-700 !important;
      }
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
    margin-left: 1rem;

    @include mobile {
      gap: 0.375rem;
      margin-left: 0;
    }
  }

  &__login-btn {
    @include glass-panel;
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
    text-decoration: none !important;

    .v-icon {
      color: $detran-700 !important;
      transition: transform 0.3s ease;
    }

    &:hover {
      background: $detran-700;
      color: white !important;

      .v-icon {
        color: white !important;
        transform: translateX(2px);
      }
    }

    @include mobile {
      padding: 0;
      width: 38px;
      height: 38px;
      justify-content: center;
      border-radius: 0.625rem;
      background: white;
      border: 1px solid rgba(226, 232, 240, 0.85);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      span { display: none !important; }
      .v-icon { margin: 0; font-size: 18px !important; }
    }
  }

  &__new-page-btn {
    @include glass-panel;
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
    border: none;
    cursor: pointer;

    .v-icon { transition: transform 0.3s ease; }

    &:hover {
      background: $detran-700;
      color: white;

      .v-icon { transform: rotate(90deg); }
    }

    @include mobile {
      padding: 0;
      width: 38px;
      height: 38px;
      justify-content: center;
      border-radius: 0.625rem;
      background: white;
      border: 1px solid rgba(226, 232, 240, 0.85);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      span { display: none !important; }
      .v-icon { margin: 0; font-size: 18px !important; }
    }
  }

  &__user-btn {
    display: none;
    width: 38px;
    height: 38px;
    border-radius: $radius-full !important;
    padding: 0;
    border: none !important;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    @include mobile {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  &__user-avatar {
    width: 100%;
    height: 100%;
    border-radius: $radius-full !important;
    object-fit: cover;
    display: block;
  }

  &__user-initials {
    width: 100%;
    height: 100%;
    border-radius: $radius-full !important;
    background: linear-gradient(135deg, $detran-500, $detran-700);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
  }
}

// ---------------------------------------------------------------------------
// BUSCA (glassmorphism)
// ---------------------------------------------------------------------------
.detran-search {
  @include glass-panel;
  flex: 1;
  max-width: 672px;
  min-width: 0; // Previne overflow em flex layout
  border-radius: 1rem;
  box-shadow: $shadow-float;
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  transition: $transition-base;
  border: 1px solid rgba(226, 232, 240, 0.8);
  position: relative;
  z-index: 51;

  @include mobile {
    padding: 0.4375rem 0.625rem;
    border-radius: 0.625rem;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(226, 232, 240, 0.9);
  }

  &.is-focused {
    border-color: $detran-500;
    box-shadow: 0 0 0 3px rgba(51, 166, 91, 0.2), $shadow-float;
    background: rgba(255, 255, 255, 0.98);
  }

  &__icon {
    flex-shrink: 0;
    margin-right: 0.75rem;

    @include mobile {
      margin-right: 0.375rem;
      font-size: 16px !important;
    }
  }

  &__input {
    flex: 1;
    min-width: 0;
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-family: $font-family-base;
    font-size: 0.875rem;
    font-weight: 500;
    color: $slate-700;
    text-overflow: ellipsis;

    @include mobile {
      font-size: 0.8125rem;
    }

    &::placeholder {
      color: $slate-400;
      text-overflow: ellipsis;
    }
  }

  &__clear-btn {
    background: transparent;
    border: none;
    outline: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    margin-left: 6px;
    border-radius: 50%;
    transition: transform 0.2s ease, opacity 0.2s ease;
    opacity: 0.7;

    &:hover {
      opacity: 1;
      transform: scale(1.1);
    }
  }
}

// ---------------------------------------------------------------------------
// CONTEÚDO (área scrollável)
// ---------------------------------------------------------------------------
.detran-content {
  flex: 1;
  min-height: 0; // Garante contenção no layout flex e rolagem interna
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: $header-height + 24px; // espaço para o header absoluto
  padding-bottom: 2.5rem;
  padding-left: 2rem;
  padding-right: 2rem;
  scroll-behavior: smooth !important;
  scroll-padding-top: calc(#{$header-height} + 36px);
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;

  @include mobile {
    padding-top: 66px; // exatamente abaixo do header mobile dockado (56px) + respiro
    padding-bottom: 3.5rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    scroll-padding-top: 72px;
  }

  &__inner {
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
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
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  padding: 0.5rem 1rem !important;
  background: $detran-600 !important;
  color: white !important;
  border-radius: $radius-md !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  box-shadow: $shadow-soft !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
  border: none !important;

  .v-icon {
    color: white !important;
  }

  &:hover {
    background: $detran-700 !important;
    box-shadow: 0 4px 12px rgba($detran-500, 0.3) !important;
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
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    text-decoration: none;
    transition: $transition-fast;

    .v-icon {
      transition: color 0.2s ease, transform 0.2s ease;
    }

    &:hover .v-icon {
      color: $detran-600 !important;
      transform: scale(1.18);
    }
  }

  &__sep {
    color: $slate-400;
    font-size: 0.75rem;
    user-select: none;
  }

  &__item {
    font-weight: 500;
    color: $slate-600;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
      color: $detran-700;
      text-decoration: underline;
    }

    &.is-current {
      font-weight: 600;
      color: $slate-800;
      cursor: pointer;

      &:hover {
        color: $detran-700;
        text-decoration: none;
      }
    }
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
  text-decoration: none;
  transition: $transition-fast;

  &:hover {
    background: $detran-100;
    color: $detran-800;
    text-decoration: none;
  }
}

.detran-article__meta-link {
  text-decoration: none;
  color: inherit;
  transition: $transition-fast;

  &:hover {
    color: $detran-600;
    text-decoration: underline;
  }
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
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      color: $slate-800;
      transform: translateX(4px);
    }

    &.is-active {
      color: $detran-700;
      font-weight: 600;
      transform: translateX(4px);

      .detran-toc__dot {
        background: $detran-500;
        transform: scale(1.3);
        box-shadow: 0 0 8px rgba(51, 166, 91, 0.45);
      }
    }
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: $radius-full;
    background: $slate-300;
    flex-shrink: 0;
    margin-right: 0.5rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

// ---------------------------------------------------------------------------
// SPEED DIAL (Menu Flutuante de Ações)
// DOM fiel ao protótipo, sem v-speed-dial do Vuetify
// ---------------------------------------------------------------------------
.detran-speed-dial {
  position: fixed;
  bottom: 3.5rem; // Espaçamento elegante acima do rodapé fixo
  right: 2rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  @include mobile {
    bottom: 3.25rem;
    right: 1rem;
  }

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
    position: relative !important;
    z-index: 10 !important;
    width: 52px !important;
    height: 52px !important;
    background: $detran-500 !important;
    border-radius: $radius-full !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: $shadow-fab !important;
    transition: background-color 0.2s ease, transform 0.2s ease !important;
    flex-shrink: 0 !important;
    border: none !important;
    cursor: pointer !important;

    .v-icon {
      color: white !important;
    }

    &:hover {
      background: $detran-600 !important;
      transform: scale(1.05);

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

// ---------------------------------------------------------------------------
// ALERTA DE PÁGINA NÃO PUBLICADA
// ---------------------------------------------------------------------------
.detran-unpublished-alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 4px solid #ef4444;
  border-radius: $radius-lg;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: #991b1b;
  box-shadow: $shadow-soft;

  &__icon {
    flex-shrink: 0;
  }

  &__text {
    line-height: 1.5;
  }
}

// ---------------------------------------------------------------------------
// BOTÃO DE IDIOMA NO CABEÇALHO
// ---------------------------------------------------------------------------
.detran-header__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: $radius-md;
  border: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #ffffff;
    border-color: #cbd5e1;
    color: #1e293b;
  }
}

// ---------------------------------------------------------------------------
// RESULTADOS DA BUSCA (search-results do Wiki.js com tema Detran)
// ---------------------------------------------------------------------------
.detran-app {
  .search-results {
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    padding-top: 104px !important;
    background: rgba(15, 23, 42, 0.88) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    z-index: 40 !important;
    animation: detranSearchReveal 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;

    @include mobile {
      padding-top: 64px !important;
    }

    &-container {
      max-width: 820px !important;
      margin: 0 auto !important;
      padding: 0 1rem !important;
    }

    &-help {
      padding: 40px 0 !important;
      color: #94a3b8 !important;
      font-weight: 500 !important;

      img {
        opacity: 0.7;
        width: 88px !important;
      }
    }

    &-items {
      border-radius: 1rem !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35) !important;
      background: rgba(30, 41, 59, 0.95) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      backdrop-filter: blur(12px) !important;

      .v-list-item {
        color: #f8fafc !important;
        border-left: 3px solid transparent;
        transition: all 0.2s ease !important;

        .v-list-item__title {
          color: #ffffff !important;
          font-weight: 600 !important;
        }

        .v-list-item__subtitle {
          color: #94a3b8 !important;
        }

        &.highlighted, &:hover {
          background: rgba(40, 139, 74, 0.22) !important;
          border-left: 3px solid #288b4a !important;
        }
      }

      .v-divider {
        border-color: rgba(255, 255, 255, 0.06) !important;
      }
    }

    &-suggestions {
      border-radius: 1rem !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35) !important;
      background: rgba(30, 41, 59, 0.95) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      backdrop-filter: blur(12px) !important;

      .v-list-item {
        color: #f8fafc !important;
        border-left: 3px solid transparent;
        transition: all 0.2s ease !important;

        .v-list-item__title {
          color: #e2e8f0 !important;
          font-weight: 500 !important;
        }

        .v-icon {
          color: #288b4a !important;
        }

        &.highlighted, &:hover {
          background: rgba(40, 139, 74, 0.25) !important;
          border-left: 3px solid #288b4a !important;
        }
      }

      .v-divider {
        border-color: rgba(255, 255, 255, 0.06) !important;
      }
    }
  }
}

@keyframes detranSearchReveal {
  from {
    opacity: 0;
    backdrop-filter: blur(0px);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(16px);
  }
}

// ---------------------------------------------------------------------------
// AJUSTES DE IMPRESSÃO (@media print)
// ---------------------------------------------------------------------------
@media print {
  .detran-sidebar,
  .detran-header,
  .detran-speed-dial,
  .detran-toc,
  .detran-edit-inline-btn,
  .detran-mobile-overlay,
  .detran-sidebar-blobs,
  .detran-footer {
    display: none !important;
  }

  .detran-layout {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
  }

  .detran-main {
    padding: 0 !important;
  }

  .detran-content {
    overflow: visible !important;
  }

  .detran-article {
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
  }
}
</style>

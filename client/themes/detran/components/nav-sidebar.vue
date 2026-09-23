<template lang="pug">
  aside.detran-sidebar(:class='{ "is-collapsed": collapsed }' role='navigation' :aria-label='$t("common:sidebar.label", "Navegação lateral")')

    //- Botão de colapso (<)
    button.detran-sidebar__toggle(
      @click='toggleCollapse'
      :title='collapsed ? "Expandir menu" : "Recolher menu"'
      :aria-expanded='!collapsed'
      aria-controls='detran-sidebar-nav'
      type='button'
    )
      v-icon.detran-sidebar__toggle-icon(:class='{ "is-rotated": collapsed }' size='12') mdi-chevron-left

    .detran-sidebar__header-row
      //- Logo / Branding
      a.detran-sidebar__logo.anim-hidden.anim-slide-in-right.stagger-1(
        :href='`/${locale}/home`'
        title='Ir para o Início'
      )
        img.detran-sidebar__logo-img(
          src='/_assets/img/detran-logo-white.png'
          alt='Detran-MG'
        )

      //- Botão fechar drawer no mobile
      button.detran-sidebar__close-mobile(
        @click='$emit("close-mobile")'
        aria-label='Fechar navegação'
        title='Fechar navegação'
        type='button'
      )
        v-icon(size='20' color='white') mdi-close

    //- Switcher Menu / Árvore (apenas exibido quando navMode é MIXED ou não fixado e sidebar não recolhida)
    .detran-sidebar__switcher.anim-hidden.anim-fade-in-up.stagger-1(v-if='(navMode === "MIXED" || !navMode || navMode === "SIDEBAR") && !collapsed')
      .detran-sidebar__switch-wrap(:class='{ "is-tab-browse": navTab === "browse" }')
        .detran-sidebar__switch-slider(aria-hidden='true')
        button.detran-sidebar__switch-btn(
          :class='{ "is-active": navTab === "menu" }'
          @click='switchNavTab("menu")'
          :title='$t("common:sidebar.quickMenu", "Menu Rápido")'
          :aria-pressed='navTab === "menu"'
          type='button'
        )
          v-icon(size='14') mdi-format-list-bulleted
          span.detran-sidebar__switch-label Menu
        button.detran-sidebar__switch-btn(
          :class='{ "is-active": navTab === "browse" }'
          @click='switchNavTab("browse")'
          :title='$t("common:sidebar.browseTree", "Árvore de Diretórios")'
          :aria-pressed='navTab === "browse"'
          type='button'
        )
          v-icon(size='14') mdi-sitemap
          span.detran-sidebar__switch-label Árvore

    //- Navegação: Menu Curado
    nav#detran-sidebar-nav.detran-sidebar__nav(v-if='navTab === "menu"')
      p.detran-sidebar__section-label Principal

      template(v-for='item in parsedNavTree')

        //- Cabeçalho de Seção (ex: ACESSO RÁPIDO)
        template(v-if='item.k === "header" && item.isSectionHeader')
          p.detran-sidebar__section-label(:key='item.i') {{ item.l }}

        //- Separador
        template(v-else-if='item.k === "divider"')
          hr.detran-sidebar__divider(:key='item.i')

        //- Item de Grupo com Subitens (Cabeçalho do Wiki.js)
        template(v-else-if='item.isGroup')
          .detran-sidebar__group(:key='item.i')
            button.detran-sidebar__group-btn.glass-hover(
              @click='toggleGroup(item)'
              :title='item.l'
              type='button'
            )
              .detran-sidebar__link-icon
                v-icon(size='18' color='#cce0d2') {{ resolveIcon(item.c || item.l) }}
              span.detran-sidebar__link-text {{ item.l }}
              v-icon.detran-sidebar__group-chevron(
                size='12'
                color='rgba(255,255,255,0.7)'
                :class='{ "is-rotated": !isGroupExpanded(item) }'
              ) mdi-chevron-down

            transition(
              name='detran-accordion'
              @enter='accordionEnter'
              @after-enter='accordionAfterEnter'
              @leave='accordionLeave'
              @after-leave='accordionAfterLeave'
            )
              .detran-sidebar__subitems(v-show='isGroupExpanded(item)')
                a.detran-sidebar__sublink.glass-hover(
                  v-for='sub in item.subitems'
                  :key='sub.i'
                  :href='resolveTarget(sub)'
                  :title='sub.l'
                  :class='{ "glass-active": isActive(sub) }'
                  :aria-current='isActive(sub) ? "page" : undefined'
                  :target='sub.y === "externalblank" ? "_blank" : undefined'
                  :rel='sub.y === "externalblank" ? "noopener noreferrer" : undefined'
                )
                  v-icon.detran-sidebar__sublink-icon(v-if='sub.c && sub.c !== "mdi-chevron-right" && sub.c !== "link"' size='14' color='rgba(255,255,255,0.7)') {{ resolveIcon(sub.c) }}
                  span.detran-sidebar__sublink-text {{ sub.l }}

        //- Link simples
        template(v-else-if='item.k === "link"')
          a.detran-sidebar__link.glass-hover(
            :key='item.i'
            :href='resolveTarget(item)'
            :title='item.l'
            :class='{ "glass-active": isActive(item) }'
            :aria-current='isActive(item) ? "page" : undefined'
            :target='item.y === "externalblank" ? "_blank" : undefined'
            :rel='item.y === "externalblank" ? "noopener noreferrer" : undefined'
          )
            .detran-sidebar__link-icon
              v-icon(size='18' :color='isActive(item) ? "white" : "#cce0d2"') {{ resolveIcon(item.c) }}
            span.detran-sidebar__link-text {{ item.l }}

    //- Navegação: Browse mode (árvore de páginas hierárquica dinâmica via GraphQL)
    nav.detran-sidebar__nav.detran-sidebar__tree(v-else-if='navTab === "browse"')
      .detran-sidebar__tree-header
        p.detran-sidebar__section-label Árvore de Diretórios
        .detran-sidebar__tree-actions
          button.detran-sidebar__tree-action-btn(
            @click='refreshTree'
            title='Recarregar árvore'
            type='button'
          )
            v-icon(size='14' color='rgba(255,255,255,0.7)') mdi-refresh
          button.detran-sidebar__tree-action-btn(
            @click='collapseAll'
            title='Recolher pastas'
            type='button'
          )
            v-icon(size='14' color='rgba(255,255,255,0.7)') mdi-collapse-all-outline

      .detran-sidebar__browse-loader(v-if='$apollo.queries.browseItems.loading && (!browseItems || browseItems.length === 0)')
        v-progress-circular(indeterminate size='20' color='rgba(255,255,255,0.7)' width='2')

      .detran-tree__root(v-else-if='browseItems && browseItems.length > 0')
        nav-tree-item(
          v-for='node in browseItems'
          :key='node.id + "-" + treeKey'
          :item='node'
          :depth='0'
          :current-path='currentPath'
          :locale='locale'
        )
      template(v-else)
        p.detran-sidebar__empty Nenhuma página encontrada

    //- Footer: Perfil do usuário + Configurações (Admin)
    .detran-sidebar__user-footer
      //- Quando NÃO autenticado: Botão de Login direto
      a.detran-sidebar__user-btn.detran-sidebar__login-card.glass-hover(
        v-if='!isAuthenticated'
        href='/login'
        title='Fazer Login'
      )
        .detran-sidebar__login-avatar
          v-icon(size='22') mdi-login
        .detran-sidebar__user-info
          p.detran-sidebar__user-name Fazer Login
          p.detran-sidebar__user-email Acessar sua conta

      //- Quando autenticado: Card do usuário real com modal
      button.detran-sidebar__user-btn.glass-hover(
        v-else
        @click='openUserModal'
        :title='$t("common:sidebar.profile", "Acessar Meu Perfil")'
        type='button'
      )
        img.detran-sidebar__avatar(
          v-if='hasUserAvatar || userAvatar'
          :src='userAvatar'
          :alt='userName'
          @error='onAvatarError'
          loading='lazy'
        )
        .detran-sidebar__avatar-initials(v-else) {{ userInitials }}
        .detran-sidebar__user-info
          p.detran-sidebar__user-name {{ userName }}
          p.detran-sidebar__user-email {{ userEmail }}

      a.detran-sidebar__settings-btn.glass-hover(
        v-if='canManageSystem'
        href='/a'
        @click.prevent='goToAdmin'
        :title='$t("common:sidebar.admin", "Configurações Gerais (Admin)")'
        aria-label='Configurações Gerais (Admin)'
      )
        v-icon(size='16' color='rgba(255,255,255,0.7)') mdi-cog

    //- Modal do Usuário (Perfil / Sair)
    v-dialog(
      v-model='userModalOpen'
      max-width='380'
      content-class='detran-user-modal-dialog'
    )
      .detran-user-modal
        .detran-user-modal__header
          .detran-user-modal__avatar-wrap
            img.detran-user-modal__avatar(
              v-if='hasUserAvatar || userAvatar'
              :src='userAvatar'
              :alt='userName'
            )
            .detran-user-modal__avatar-initials(v-else) {{ userInitials }}
          .detran-user-modal__info
            h3.detran-user-modal__name {{ userName }}
            p.detran-user-modal__email {{ userEmail }}
          button.detran-user-modal__close(
            @click='userModalOpen = false'
            aria-label='Fechar'
            type='button'
          )
            v-icon(size='18' color='#94a3b8') mdi-close

        .detran-user-modal__body
          a.detran-user-modal__item(
            href='/p'
            @click.prevent='goToProfile'
          )
            .detran-user-modal__item-icon
              v-icon(size='18' color='#288b4a') mdi-account-circle-outline
            .detran-user-modal__item-text
              span.detran-user-modal__item-title Perfil
              span.detran-user-modal__item-desc Acessar suas informações e preferências
            v-icon(size='16' color='#94a3b8') mdi-chevron-right

          //- Opção Sair quando autenticado
          button.detran-user-modal__item.detran-user-modal__item--logout(
            v-if='isAuthenticated'
            @click='doLogout'
            type='button'
          )
            .detran-user-modal__item-icon.detran-user-modal__item-icon--danger
              v-icon(size='18' color='#ef4444') mdi-logout
            .detran-user-modal__item-text
              span.detran-user-modal__item-title Sair
              span.detran-user-modal__item-desc Encerrar sessão com segurança
            v-icon(size='16' color='#ef4444') mdi-chevron-right

          //- Opção Entrar quando não autenticado
          a.detran-user-modal__item(
            v-else
            href='/login'
            @click='userModalOpen = false'
          )
            .detran-user-modal__item-icon
              v-icon(size='18' color='#288b4a') mdi-login
            .detran-user-modal__item-text
              span.detran-user-modal__item-title Entrar
              span.detran-user-modal__item-desc Fazer login no sistema
            v-icon(size='16' color='#94a3b8') mdi-chevron-right
</template>

<script>
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import NavTreeItem from './nav-tree-item.vue'

const browseQuery = gql`
  query($path: String, $parent: Int, $locale: String!, $mode: PageTreeMode!) {
    pages {
      tree(path: $path, parent: $parent, locale: $locale, mode: $mode, includeAncestors: true) {
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

const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2333a65b'/><stop offset='100%' stop-color='%231b5830'/></linearGradient></defs><rect width='100' height='100' rx='50' fill='url(%23g)'/><circle cx='50' cy='38' r='18' fill='%23ffffff' opacity='0.95'/><path d='M22 86 C22 66 36 58 50 58 C64 58 78 66 78 86 Z' fill='%23ffffff' opacity='0.95'/></svg>"

export default {
  name: 'NavSidebar',

  components: {
    NavTreeItem
  },

  props: {
    items: {
      type: Array,
      default: () => []
    },
    navMode: {
      type: String,
      default: 'SIDEBAR'
    },
    currentPath: {
      type: String,
      default: ''
    },
    locale: {
      type: String,
      default: 'pt'
    },
    canManageSystem: {
      type: Boolean,
      default: false
    }
  },

  data () {
    return {
      collapsed: false,
      navTab: 'menu',
      browseItems: [],
      collapsedGroups: {},
      avatarFailed: false,
      userModalOpen: false,
      treeKey: 0
    }
  },

  computed: {
    userId: get('user/id'),
    isAuthenticated: get('user/authenticated'),
    rawUserName: get('user/name'),
    rawUserEmail: get('user/email'),
    rawJobTitle: get('user/jobTitle'),
    rawPictureUrl: get('user/pictureUrl'),

    userName () {
      if (this.rawUserName && this.rawUserName.trim().length > 0 && this.rawUserName !== 'Guest') {
        return this.rawUserName
      }
      return 'Danilo Santana'
    },
    userEmail () {
      if (this.rawJobTitle && this.rawJobTitle.trim().length > 0) {
        return this.rawJobTitle
      }
      if (this.rawUserEmail && this.rawUserEmail.trim().length > 0 && !this.rawUserEmail.includes('guest')) {
        return this.rawUserEmail
      }
      return 'Analista de Sistemas'
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
      if (this.avatarFailed) return defaultAvatar
      if (this.rawPictureUrl && this.rawPictureUrl.length > 1 && !this.rawPictureUrl.includes('pravatar.cc')) {
        return (this.rawPictureUrl === 'internal') ? `/_userav/${this.userId}` : this.rawPictureUrl
      }
      return defaultAvatar
    },
    parsedNavTree () {
      const raw = this.items || []
      const result = []
      let currentGroup = null

      for (let i = 0; i < raw.length; i++) {
        const item = raw[i]

        // Divisor
        if (item.k === 'divider') {
          currentGroup = null
          result.push(item)
          continue
        }

        // Cabeçalho (Header das configurações do Wiki.js)
        if (item.k === 'header') {
          // Se for título de seção em caixa alta (ex: "PRINCIPAL", "ACESSO RÁPIDO")
          if (item.l && item.l === item.l.toUpperCase()) {
            currentGroup = null
            result.push({
              ...item,
              isSectionHeader: true
            })
          } else {
            // Cabeçalho com subitens (ex: "Habilitação")
            currentGroup = {
              ...item,
              isGroup: true,
              subitems: []
            }
            result.push(currentGroup)
          }
          continue
        }

        // Link
        if (item.k === 'link') {
          // Se o link for um subitem sob o Cabeçalho atual
          if (currentGroup) {
            currentGroup.subitems.push(item)
            continue
          }

          // Se for um link de primeiro nível (fora de grupo)
          result.push(item)
        }
      }
      return result
    }
  },

  apollo: {
    browseItems: {
      query: browseQuery,
      variables () {
        return {
          path: '',
          parent: 0,
          locale: this.locale,
          mode: 'ALL'
        }
      },
      update (data) {
        return data.pages.tree || []
      },
      skip () {
        return this.navTab !== 'browse'
      },
      watchLoading (isLoading) {
        this.$store.commit(isLoading ? 'startLoading' : 'stopLoading')
      }
    }
  },

  mounted () {
    if (this.navMode === 'STATIC') {
      this.navTab = 'menu'
    } else if (this.navMode === 'DYNAMIC') {
      this.navTab = 'browse'
    } else {
      try {
        const saved = window.localStorage.getItem('navPref')
        if (saved === 'browse' || saved === 'menu') {
          this.navTab = saved
        }
      } catch (e) {}
    }
  },

  methods: {
    switchNavTab (tab) {
      this.navTab = tab
      try { window.localStorage.setItem('navPref', tab) } catch (e) {}
    },

    refreshTree () {
      this.treeKey++
      this.$apollo.queries.browseItems.refetch()
    },

    collapseAll () {
      this.treeKey++
    },

    toggleCollapse () {
      if (typeof window !== 'undefined' && window.innerWidth <= 960) {
        return
      }
      this.collapsed = !this.collapsed
    },

    toggleGroup (item) {
      const id = item.i || item.l
      this.$set(this.collapsedGroups, id, !this.collapsedGroups[id])
    },

    isGroupExpanded (item) {
      const id = item.i || item.l
      return !this.collapsedGroups[id]
    },

    // -------------------------------------------------------------------------
    // Animação de Acordeão Suave (Expand / Collapse de Subitens)
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
    },

    onAvatarError () {
      this.avatarFailed = true
    },

    isActive (item) {
      if (!item) return false
      if (item.y === 'home') {
        const p = (this.currentPath || '').toLowerCase().replace(/^\/+/, '')
        return p === '' || p === 'home' || p === `${this.locale.toLowerCase()}/home` || p === this.locale.toLowerCase()
      }
      if (!item.t) return false

      const normalize = (val) => {
        let s = (val || '').toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '')
        const locPrefix = `${this.locale.toLowerCase()}/`
        while (s.startsWith(locPrefix)) {
          s = s.substring(locPrefix.length).replace(/^\/+/, '')
        }
        return s
      }

      const current = normalize(this.currentPath)
      const target = normalize(item.t)
      return current === target || (target !== '' && current.startsWith(target + '/'))
    },

    resolveTarget (item) {
      if (!item) return '#'
      if (item.y === 'home') return `/${this.locale}/home`
      if (item.y === 'external' || item.y === 'externalblank') return item.t || '#'

      const raw = (item.t || '').trim()
      if (!raw) return '#'

      // URLs externas completas (http, https, //, mailto, tel)
      if (/^(?:[a-z]+:)?\/\//i.test(raw) || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
        return raw
      }

      // Remove barras iniciais
      let clean = raw.replace(/^\/+/, '')

      // Remove repetições do locale atual se já presente (ex: pt-br/pt-br/...)
      const locPrefix = `${this.locale.toLowerCase()}/`
      while (clean.toLowerCase().startsWith(locPrefix)) {
        clean = clean.substring(locPrefix.length).replace(/^\/+/, '')
      }

      // Verifica se o caminho aponta para outro idioma conhecido (ex: en/...)
      const hasOtherLocale = (this.locales || []).some(lc => {
        const code = (typeof lc === 'string' ? lc : lc.code || '').toLowerCase()
        return code && code !== this.locale.toLowerCase() && clean.toLowerCase().startsWith(`${code}/`)
      })

      if (hasOtherLocale) {
        return `/${clean}`
      }

      // Previne duplicação prefixando com o idioma atual de forma canônica
      return `/${this.locale}/${clean}`
    },

    resolveIcon (icon) {
      if (!icon) return 'mdi-folder-outline'
      const iconMap = {
        'fa-home': 'mdi-home',
        'home': 'mdi-home',
        'mdi-home': 'mdi-home',
        'id-card': 'mdi-card-account-details-outline',
        'fa-id-card': 'mdi-card-account-details-outline',
        'car': 'mdi-car-side',
        'fa-car': 'mdi-car-side',
        'desktop': 'mdi-monitor',
        'fa-desktop': 'mdi-monitor',
        'file-text': 'mdi-file-document-outline',
        'fa-file-lines': 'mdi-file-document-outline',
        'gear': 'mdi-cog',
        'palette': 'mdi-palette',
        'book': 'mdi-book-open-page-variant',
        'folder': 'mdi-folder',
        'shield': 'mdi-shield-check',
        'users': 'mdi-account-group',
        'bell': 'mdi-bell',
        'search': 'mdi-magnify',
        'clock': 'mdi-clock-outline',
        'tag': 'mdi-tag',
        'link': 'mdi-link',
        'help': 'mdi-help-circle',
        'print': 'mdi-printer'
      }
      if (iconMap[icon]) return iconMap[icon]
      if (typeof icon === 'string' && (icon.startsWith('mdi-') || icon.startsWith('fa-') || icon.startsWith('fas ') || icon.startsWith('fab '))) {
        return icon
      }
      if (typeof icon === 'string') {
        const lower = icon.toLowerCase()
        if (lower.includes('habilita') || lower.includes('cnh')) return 'mdi-card-account-details-outline'
        if (lower.includes('veículo') || lower.includes('veiculo') || lower.includes('carro') || lower.includes('frota')) return 'mdi-car-side'
        if (lower.includes('sistema') || lower.includes('software') || lower.includes('ti') || lower.includes('computador')) return 'mdi-monitor'
        if (lower.includes('normativo') || lower.includes('lei') || lower.includes('resolu') || lower.includes('portaria') || lower.includes('document')) return 'mdi-file-document-outline'
        if (lower.includes('infraç') || lower.includes('infrac') || lower.includes('multa')) return 'mdi-alert-octagon-outline'
        if (lower.includes('atend') || lower.includes('cidad') || lower.includes('usuario')) return 'mdi-account-group'
        if (lower.includes('relat') || lower.includes('estat')) return 'mdi-chart-bar'
        if (lower.includes('seguran') || lower.includes('polici')) return 'mdi-shield-check'
      }
      return 'mdi-folder-outline'
    },

    openUserModal () {
      this.userModalOpen = true
    },

    goToProfile () {
      this.userModalOpen = false
      window.location.assign('/p')
    },

    doLogout () {
      this.userModalOpen = false
      window.location.assign('/logout')
    },

    goToAdmin () {
      if (this.canManageSystem) {
        window.location.assign('/a')
      }
    }
  }
}
</script>

<style lang="scss">
@import '../scss/variables';

// =============================================================================
// NAV-SIDEBAR — Tema Detran-MG
// Glassmorphism cristalino sobre fundo verde escuro
// =============================================================================

.detran-sidebar {
  position: relative;
  width: $sidebar-width;
  min-width: $sidebar-width;
  height: 100vh;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 30;
  color: white;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible;

  // Renderização e nitidez tipográfica
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
  text-rendering: optimizeLegibility !important;

  // Fundo com transparência sutil e desfoque suave
  background: rgba(255, 255, 255, 0.03) !important;
  backdrop-filter: blur(24px) !important;
  -webkit-backdrop-filter: blur(24px) !important;
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.05) !important;

  // Garante que links internos nunca herdem azul
  a {
    color: #cce0d2 !important;
    text-decoration: none !important;

    &:hover {
      color: #ffffff !important;
    }
  }

  // ---------------------------------------------------------------------------
  // Estado colapsado
  // ---------------------------------------------------------------------------
  &.is-collapsed {
    width: $sidebar-width-collapsed;
    min-width: $sidebar-width-collapsed;

    .detran-sidebar__switcher,
    .detran-sidebar__switch-label,
    .detran-sidebar__link-text,
    .detran-sidebar__section-label,
    .detran-sidebar__subitems,
    .detran-sidebar__group-chevron,
    .detran-sidebar__user-info,
    .detran-sidebar__settings-btn { display: none !important; }

    .detran-sidebar__logo {
      padding: 0 0.5rem;
      justify-content: center;
    }
    .detran-sidebar__logo-img {
      max-width: 48px;
      max-height: 38px;
    }
    .detran-sidebar__link, .detran-sidebar__group-btn { justify-content: center; padding: 0.625rem; }
    .detran-sidebar__link-icon { margin: 0; }
    .detran-sidebar__user-footer { justify-content: center; padding: 0.75rem; }
    .detran-sidebar__user-btn { padding: 0.25rem; justify-content: center; }
  }

  // ---------------------------------------------------------------------------
  // Botão toggle (colapso)
  // ---------------------------------------------------------------------------
  &__toggle {
    position: absolute !important;
    right: -12px !important;
    top: 36px !important;
    width: 24px !important;
    height: 24px !important;
    background: $detran-500 !important;
    border-radius: $radius-full !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 40 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
    transition: background-color 0.2s, transform 0.2s !important;
    cursor: pointer;
    border: none;
    padding: 0;

    .v-icon {
      color: white !important;
    }

    &:hover {
      background: $detran-600 !important;
      transform: scale(1.1);
    }

    @include mobile {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  }

  &__toggle-icon {
    transition: transform 0.3s ease;
    &.is-rotated { transform: rotate(180deg); }
  }

  // ---------------------------------------------------------------------------
  // Linha de Cabeçalho / Logo / Botão Fechar Mobile
  // ---------------------------------------------------------------------------
  &__header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.10);
    overflow: hidden;
  }

  &__close-mobile {
    display: none;
    width: 36px;
    height: 36px;
    border-radius: $radius-md;
    background: rgba(255, 255, 255, 0.10);
    border: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    margin-right: 1rem;
    transition: background 0.2s ease, transform 0.2s ease;
    flex-shrink: 0;

    &:hover {
      background: rgba(255, 255, 255, 0.20);
      transform: scale(1.05);
    }

    @include mobile {
      display: flex;
    }
  }

  // ---------------------------------------------------------------------------
  // Logo / Branding
  // ---------------------------------------------------------------------------
  &__logo {
    height: 96px; // h-24
    display: flex;
    align-items: center;
    padding: 0 1.25rem;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    flex: 1;

    &:hover &__logo-img {
      opacity: 0.95;
      transform: scale(1.02);
    }
  }

  &__logo-img {
    max-height: 48px;
    max-width: 205px;
    width: auto;
    height: auto;
    object-fit: contain;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: block;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25));
  }

  // ---------------------------------------------------------------------------
  // Switcher Menu / Árvore (Segmented Control com efeito suave de botão toggle)
  // ---------------------------------------------------------------------------
  &__switcher {
    padding: 1.5rem 1rem 0.5rem; // mt-6 mb-2 px-4
    transition: padding 0.3s ease;
  }

  &__switch-wrap {
    position: relative !important;
    background: rgba(0, 0, 0, 0.22) !important;
    padding: 4px !important;
    border-radius: 0.75rem !important; // rounded-xl
    display: flex !important;
    align-items: center !important;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.25) !important;
    border: 1px solid rgba(255, 255, 255, 0.06) !important;
    overflow: hidden !important;
    width: 100% !important;
  }

  &__switch-slider {
    position: absolute !important;
    top: 4px !important;
    bottom: 4px !important;
    left: 4px !important;
    width: calc(50% - 4px) !important;
    background: rgba(255, 255, 255, 0.16) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border-radius: 0.5rem !important; // rounded-lg
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.2) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1) !important;
    will-change: transform !important;
    pointer-events: none !important;
    z-index: 1 !important;

    .is-tab-browse & {
      transform: translateX(100%) !important;
    }
  }

  &__switch-btn {
    position: relative !important;
    z-index: 2 !important;
    flex: 1 1 0% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 0.5rem !important; // rounded-lg
    font-size: 0.75rem !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    border: none !important;
    background: transparent !important;
    color: rgba(255, 255, 255, 0.55) !important;
    transition: color 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
    outline: none !important;
    white-space: nowrap !important;
    box-shadow: none !important;

    .v-icon {
      color: currentColor !important;
      transition: color 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    &.is-active {
      color: #ffffff !important;

      .detran-sidebar__switch-label {
        color: #ffffff !important;
      }
    }

    &:not(.is-active):hover {
      color: rgba(255, 255, 255, 0.85) !important;

      .detran-sidebar__switch-label {
        color: rgba(255, 255, 255, 0.85) !important;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Navegação
  // ---------------------------------------------------------------------------
  &__nav {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.5rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scroll-behavior: smooth !important;
    -webkit-overflow-scrolling: touch;
  }

  &__tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-right: 0.5rem;
    margin: 0.75rem 0 0.5rem;

    .detran-sidebar__section-label {
      margin: 0;
      padding: 0 0.5rem 0 0.25rem;
    }
  }

  &__tree-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__tree-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    cursor: pointer;
    opacity: 0.75;
    transition: all 0.2s ease;

    &:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.16);
      transform: scale(1.05);
    }
  }

  &__section-label {
    padding: 0 1rem;
    font-size: 0.6875rem; // text-xs
    font-weight: 700;
    color: rgba(255, 255, 255, 0.60);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0.75rem 0 0.5rem;
    transition: color 0.25s ease;
  }

  &__divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.10);
    margin: 0.5rem 0;
  }

  // Link de navegação (Item simples)
  &__link {
    display: flex !important;
    align-items: center !important;
    padding: 0.625rem 0.75rem !important;
    border-radius: $radius-lg !important;
    color: #cce0d2 !important;
    font-size: 0.9375rem !important;
    font-weight: 500 !important;
    text-decoration: none !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    position: relative !important;

    .detran-sidebar__link-text {
      color: #cce0d2 !important;
      transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    .v-icon {
      color: #cce0d2 !important;
      transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.10) !important;
      color: #ffffff !important;
      transform: translateX(4px);

      .detran-sidebar__link-text {
        color: #ffffff !important;
      }

      .v-icon {
        color: #ffffff !important;
        transform: scale(1.1);
      }
    }

    &.glass-active {
      background: rgba(255, 255, 255, 0.15) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.10) !important;
      color: #ffffff !important;

      .detran-sidebar__link-text {
        color: #ffffff !important;
        font-weight: 600 !important;
      }

      .v-icon {
        color: #ffffff !important;
      }
    }
  }

  &__link-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  &__link-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 0.5rem;
  }

  // ---------------------------------------------------------------------------
  // Grupo com Subitens (ex: Habilitação)
  // ---------------------------------------------------------------------------
  &__group {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  &__group-btn {
    width: 100% !important;
    display: flex !important;
    align-items: center !important;
    padding: 0.625rem 0.75rem !important;
    border-radius: $radius-lg !important;
    color: #cce0d2 !important;
    font-size: 0.9375rem !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    border: none !important;
    background: transparent !important;
    text-align: left !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    position: relative !important;

    .detran-sidebar__link-text {
      color: #cce0d2 !important;
      transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    .v-icon {
      color: #cce0d2 !important;
      transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.10) !important;
      color: #ffffff !important;
      transform: translateX(4px);

      .detran-sidebar__link-text { color: #ffffff !important; }
      .v-icon { color: #ffffff !important; transform: scale(1.1); }
    }
  }

  &__group-chevron {
    margin-left: auto !important;
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
    color: rgba(255, 255, 255, 0.70) !important;

    &.is-rotated {
      transform: rotate(-90deg) !important;
    }
  }

  &__subitems {
    display: flex;
    flex-direction: column;
    padding-top: 2px;
    gap: 2px;
    will-change: height, opacity;
  }

  &__sublink {
    display: flex !important;
    align-items: center !important;
    margin-left: 28px !important; // ml-7
    padding: 0.5rem 1rem !important; // pl-4 py-2
    border-left: 1px solid rgba(255, 255, 255, 0.20) !important;
    font-size: 0.8125rem !important; // text-[13px]
    color: #cce0d2 !important;
    text-decoration: none !important;
    border-radius: 0 $radius-md $radius-md 0 !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

    .detran-sidebar__sublink-icon {
      margin-right: 0.5rem !important;
      flex-shrink: 0 !important;
    }

    .detran-sidebar__sublink-text {
      color: #cce0d2 !important;
      transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.10) !important;
      color: #ffffff !important;
      transform: translateX(4px);

      .detran-sidebar__sublink-text {
        color: #ffffff !important;
      }
    }

    &.glass-active {
      background: rgba(255, 255, 255, 0.15) !important;
      color: #ffffff !important;
      font-weight: 600 !important;

      .detran-sidebar__sublink-text {
        color: #ffffff !important;
      }
    }
  }

  &__sublink-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // ---------------------------------------------------------------------------
  // Browse Mode (Árvore)
  // ---------------------------------------------------------------------------
  &__browse-loader {
    display: flex;
    justify-content: center;
    padding: 1.5rem;
  }

  &__empty {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.50);
    padding: 1rem;
    text-align: center;
  }

  // ---------------------------------------------------------------------------
  // Footer de usuário (Perfil + Configurações)
  // ---------------------------------------------------------------------------
  &__user-footer {
    padding: 0.75rem 1rem !important; // p-3
    border-top: 1px solid rgba(255, 255, 255, 0.10) !important;
    background: rgba(255, 255, 255, 0.05) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 0.5rem !important;
    flex-shrink: 0 !important;
  }

  &__user-btn {
    flex: 1 !important;
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem !important;
    border-radius: 0.75rem !important;
    text-align: left !important;
    overflow: hidden !important;
    min-width: 0 !important;
    cursor: pointer !important;
    background: transparent !important;
    border: none !important;
    transition: all 0.2s ease !important;

    &:hover {
      background: rgba(255, 255, 255, 0.10) !important;
    }
  }

  &__avatar {
    width: 40px !important;
    height: 40px !important;
    border-radius: 9999px !important;
    border: 2px solid rgba(255, 255, 255, 0.20) !important;
    flex-shrink: 0 !important;
    object-fit: cover !important;
    display: block !important;
  }

  &__avatar-initials {
    width: 40px !important;
    height: 40px !important;
    border-radius: 9999px !important;
    border: 2px solid rgba(255, 255, 255, 0.20) !important;
    flex-shrink: 0 !important;
    background: linear-gradient(135deg, $detran-500, $detran-700) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 0.875rem !important;
    font-weight: 700 !important;
    color: white !important;
  }

  &__login-card {
    text-decoration: none !important;

    &:hover {
      .detran-sidebar__login-avatar .v-icon {
        color: #ffffff !important;
        transform: translateX(2px);
      }
    }
  }

  &__login-avatar {
    width: 40px !important;
    height: 40px !important;
    border-radius: 0 !important;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    flex-shrink: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    .v-icon {
      color: rgba(255, 255, 255, 0.85) !important;
      transition: color 0.2s ease, transform 0.2s ease !important;
    }
  }

  &__user-info {
    flex: 1 !important;
    overflow: hidden !important;
    margin-left: 0.75rem !important;
  }

  &__user-name {
    font-size: 0.875rem !important;
    font-weight: 600 !important;
    color: #ffffff !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    margin: 0 !important;
    line-height: 1.25 !important;
  }

  &__user-email {
    font-size: 0.75rem !important;
    color: rgba(255, 255, 255, 0.70) !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    margin: 0 !important;
    line-height: 1.25 !important;
  }

  &__settings-btn {
    width: 40px !important;
    height: 40px !important;
    border-radius: 0.75rem !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: rgba(255, 255, 255, 0.50) !important;
    text-decoration: none !important;
    flex-shrink: 0 !important;
    transition: all 0.2s ease !important;

    .v-icon {
      color: rgba(255, 255, 255, 0.50) !important;
      transition: all 0.3s ease !important;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.10) !important;
      color: #ffffff !important;

      .v-icon {
        color: #ffffff !important;
        transform: rotate(45deg);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Responsividade Mobile
  // ---------------------------------------------------------------------------
  @include mobile {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    bottom: 0 !important;
    height: 100vh !important;
    height: 100dvh !important;
    transform: translateX(-100%) !important;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    width: $sidebar-width !important;
    min-width: $sidebar-width !important;
    max-width: 85vw !important;
    z-index: 100 !important;
    background: linear-gradient(180deg, #1b5830 0%, #164828 100%) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none;

    &.is-mobile-open {
      transform: translateX(0) !important;
      box-shadow: 8px 0 36px rgba(0, 0, 0, 0.55) !important;
    }

    .detran-sidebar__toggle {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    &.is-collapsed {
      width: $sidebar-width !important;
      min-width: $sidebar-width !important;

      .detran-sidebar__switcher,
      .detran-sidebar__switch-label,
      .detran-sidebar__link-text,
      .detran-sidebar__section-label,
      .detran-sidebar__subitems,
      .detran-sidebar__group-chevron,
      .detran-sidebar__user-info,
      .detran-sidebar__settings-btn {
        display: flex !important;
      }
      .detran-sidebar__group-chevron {
        display: inline-flex !important;
      }
      .detran-sidebar__switcher {
        display: block !important;
      }
      .detran-sidebar__section-label {
        display: block !important;
      }
      .detran-sidebar__subitems {
        display: flex !important;
      }
      .detran-sidebar__user-info {
        display: block !important;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// MODAL DO USUÁRIO
// ---------------------------------------------------------------------------
.detran-user-modal-dialog {
  border-radius: 1.25rem !important;
  overflow: hidden !important;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.3) !important;
}

.detran-user-modal {
  background: white;
  border-radius: 1.25rem;
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  &__header {
    background: linear-gradient(135deg, $detran-800 0%, $detran-900 100%);
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    position: relative;
    color: white;
  }

  &__avatar-wrap {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
  }

  &__avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__avatar-initials {
    font-size: 1.125rem;
    font-weight: 700;
    color: white;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__email {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.75);
    margin: 0.25rem 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  &__body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    text-decoration: none !important;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
    cursor: pointer;
    text-align: left;
    width: 100%;

    &:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }

    &--logout:hover {
      background: #fef2f2;
      border-color: #fecaca;
    }
  }

  &__item-icon {
    width: 36px;
    height: 36px;
    border-radius: 0.5rem;
    background: rgba($detran-500, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &--danger {
      background: #fee2e2;
    }
  }

  &__item-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__item-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.2;
  }

  &__item-desc {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 2px;
  }
}
</style>

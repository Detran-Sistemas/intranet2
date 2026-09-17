<template lang="pug">
  aside.detran-sidebar(:class='{ "is-collapsed": collapsed }' role='navigation' :aria-label='$t("common:sidebar.label", "Navegação lateral")')

    //- Blobs decorativos (glassmorphism background)
    .detran-sidebar__blobs(aria-hidden='true')
      .blob.blob--top
      .blob.blob--mid
      .blob.blob--bottom

    //- Botão de colapso
    button.detran-sidebar__toggle(
      @click='toggleCollapse'
      :title='collapsed ? "Expandir menu" : "Recolher menu"'
      :aria-expanded='!collapsed'
      aria-controls='detran-sidebar-nav'
    )
      v-icon.detran-sidebar__toggle-icon(:class='{ "is-rotated": collapsed }' size='12') mdi-chevron-left

    //- Logo / Branding
    .detran-sidebar__logo.anim-hidden.anim-slide-in-right.stagger-1
      .detran-sidebar__logo-icon(aria-hidden='true')
        v-icon(color='white' size='20') mdi-car-side
      .detran-sidebar__logo-text
        h1.detran-sidebar__logo-title
          | Detran
          span.detran-sidebar__logo-sub MG
        p.detran-sidebar__logo-tagline Intranet Corporativa

    //- Switcher Menu / Árvore
    .detran-sidebar__switcher.anim-hidden.anim-fade-in-up.stagger-1
      button.detran-sidebar__switch-btn(
        :class='{ "is-active": navTab === "menu" }'
        @click='navTab = "menu"'
        :title='$t("common:sidebar.quickMenu", "Menu Rápido")'
        :aria-pressed='navTab === "menu"'
      )
        v-icon(size='14') mdi-format-list-bulleted
        span.detran-sidebar__switch-label Menu
      button.detran-sidebar__switch-btn(
        :class='{ "is-active": navTab === "browse" }'
        @click='navTab = "browse"'
        :title='$t("common:sidebar.browseTree", "Árvore de Diretórios")'
        :aria-pressed='navTab === "browse"'
      )
        v-icon(size='14') mdi-sitemap
        span.detran-sidebar__switch-label Árvore

    //- Navegação
    nav#detran-sidebar-nav.detran-sidebar__nav(v-if='navTab === "menu"')
      p.detran-sidebar__section-label Principal

      template(v-for='item in navItems')

        //- Divider / Section Header
        template(v-if='item.k === "header"')
          p.detran-sidebar__section-label(:key='item.i') {{ item.l }}

        template(v-else-if='item.k === "divider"')
          hr.detran-sidebar__divider(:key='item.i')

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

    //- Browse mode (árvore de páginas via GraphQL)
    nav.detran-sidebar__nav(v-else-if='navTab === "browse"')
      p.detran-sidebar__section-label Páginas
      .detran-sidebar__browse-loader(v-if='$apollo.queries.browseItems.loading')
        v-progress-circular(indeterminate size='20' color='rgba(255,255,255,0.5)' width='2')
      template(v-else)
        a.detran-sidebar__link.glass-hover(
          v-for='page in browseItems'
          :key='page.id'
          :href='`/${page.locale}/${page.path}`'
          :class='{ "glass-active": currentPath === page.path }'
          :style='{ paddingLeft: `${(page.depth * 12) + 12}px` }'
          :title='page.title'
          :aria-current='currentPath === page.path ? "page" : undefined'
        )
          v-icon.detran-sidebar__browse-icon(size='14' :color='page.isFolder ? "#94dbab" : "#cce0d2"')
            | {{ page.isFolder ? "mdi-folder" : "mdi-file-document-outline" }}
          span.detran-sidebar__link-text {{ page.title }}

    //- Footer: Perfil do usuário
    .detran-sidebar__user-footer
      button.detran-sidebar__user-btn.glass-hover(
        @click='goToProfile'
        :title='$t("common:sidebar.profile", "Acessar Meu Perfil")'
      )
        img.detran-sidebar__avatar(
          :src='userAvatar'
          :alt='userName'
        )
        .detran-sidebar__user-info
          p.detran-sidebar__user-name {{ userName }}
          p.detran-sidebar__user-email {{ userEmail }}

      a.detran-sidebar__settings-btn.glass-hover(
        v-if='canManageSystem'
        href='/a'
        :title='$t("common:sidebar.admin", "Administração")'
        aria-label='Configurações (Admin)'
      )
        v-icon(size='16' color='rgba(255,255,255,0.5)') mdi-cog
</template>

<script>
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'

// ---------------------------------------------------------------------------
// Query para modo Browse (mesma lógica do tema default)
// ---------------------------------------------------------------------------
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

export default {
  name: 'NavSidebar',

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
    }
  },

  data () {
    return {
      collapsed: false,
      navTab: 'menu',
      browseItems: []
    }
  },

  computed: {
    userId: get('user/id'),
    userName: get('user/name'),
    userEmail: get('user/email'),
    userAvatar () {
      return `/_userav/${this.userId}`
    },
    canManageSystem () {
      try {
        const perms = this.$store.get('page/effectivePermissions') || {}
        return perms.system && perms.system.manage
      } catch (e) {
        return false
      }
    },
    navItems () {
      return this.items || []
    }
  },

  apollo: {
    browseItems: {
      query: browseQuery,
      variables () {
        return {
          path: this.currentPath || '',
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

  methods: {
    toggleCollapse () {
      this.collapsed = !this.collapsed
    },

    isActive (item) {
      if (!item.t) return false
      const path = this.currentPath
      const target = item.t.replace(/^\//, '')
      return path === target || path.startsWith(target + '/')
    },

    resolveTarget (item) {
      if (item.y === 'home') return '/'
      if (item.y === 'external' || item.y === 'externalblank') return item.t
      if (item.y === 'page') return `/${this.locale}/${item.t}`
      return item.t || '#'
    },

    resolveIcon (icon) {
      if (!icon) return 'mdi-file-document-outline'
      // Ícones já prefixados com mdi-
      if (icon.startsWith('mdi-')) return icon
      // Ícones legados do Wiki.js (ex: "home", "file")
      const map = {
        'home': 'mdi-home',
        'file': 'mdi-file-document-outline',
        'folder': 'mdi-folder',
        'car': 'mdi-car',
        'person': 'mdi-account',
        'settings': 'mdi-cog',
        'search': 'mdi-magnify',
        'chevron-right': 'mdi-chevron-right',
        'globe': 'mdi-earth',
        'book': 'mdi-book-open',
        'news': 'mdi-newspaper',
        'chat': 'mdi-chat',
        'edit': 'mdi-pencil',
        'delete': 'mdi-delete',
        'link': 'mdi-link',
        'tag': 'mdi-tag',
        'clock': 'mdi-clock',
        'check': 'mdi-check',
        'alert': 'mdi-alert',
        'info': 'mdi-information',
        'question': 'mdi-help-circle',
        'download': 'mdi-download',
        'upload': 'mdi-upload',
        'print': 'mdi-printer',
        'share': 'mdi-share-variant',
        'star': 'mdi-star',
        'heart': 'mdi-heart',
        'image': 'mdi-image',
        'video': 'mdi-video',
        'map': 'mdi-map-marker',
        'phone': 'mdi-phone',
        'email': 'mdi-email',
        'lock': 'mdi-lock',
        'key': 'mdi-key'
      }
      return map[icon] || `mdi-${icon}`
    },

    goToProfile () {
      this.$router.push(`/p/${this.userId}`)
        .catch(() => { window.location.href = `/p/${this.userId}` })
    }
  }
}
</script>

<style lang="scss">
@import '../scss/variables';

// =============================================================================
// NAV-SIDEBAR — Tema Detran-MG
// Glassmorphism sobre fundo verde escuro ($detran-900)
// =============================================================================

.detran-sidebar {
  position: relative;
  width: $sidebar-width;
  height: 100vh;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 30;
  color: white;
  overflow: hidden;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  // Glassmorphism de fundo
  background: $sidebar-bg;
  backdrop-filter: blur($sidebar-backdrop-blur);
  -webkit-backdrop-filter: blur($sidebar-backdrop-blur);
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.05);

  // ---------------------------------------------------------------------------
  // Estado colapsado
  // ---------------------------------------------------------------------------
  &.is-collapsed {
    width: $sidebar-width-collapsed;

    .detran-sidebar__logo-text,
    .detran-sidebar__switch-label,
    .detran-sidebar__link-text,
    .detran-sidebar__section-label,
    .detran-sidebar__user-info,
    .detran-sidebar__settings-btn { display: none; }

    .detran-sidebar__logo { padding: 0; justify-content: center; }
    .detran-sidebar__switcher { padding: 0.5rem; }
    .detran-sidebar__switch-btn { padding: 0.625rem; }
    .detran-sidebar__link { justify-content: center; padding: 0.75rem; }
    .detran-sidebar__link-icon { margin: 0; }
    .detran-sidebar__user-footer { justify-content: center; padding: 0.75rem; }
    .detran-sidebar__user-btn { padding: 0.5rem; }
  }

  // ---------------------------------------------------------------------------
  // Blobs decorativos
  // ---------------------------------------------------------------------------
  &__blobs {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;

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

  // Garante que o conteúdo fique acima dos blobs
  & > *:not(.detran-sidebar__blobs) {
    position: relative;
    z-index: 1;
  }

  // ---------------------------------------------------------------------------
  // Botão toggle (colapso)
  // ---------------------------------------------------------------------------
  &__toggle {
    position: absolute;
    right: -12px;
    top: 36px;
    width: 24px;
    height: 24px;
    background: $detran-500;
    border-radius: $radius-full;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 40;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: background-color 0.2s;
    opacity: 0;
    animation: fadeInUp 0.6s 0.1s cubic-bezier(0.16, 1, 0.3, 1) forwards;

    &:hover { background: $detran-600; }
  }

  &__toggle-icon {
    transition: transform 0.3s ease;
    &.is-rotated { transform: rotate(180deg); }
  }

  // ---------------------------------------------------------------------------
  // Logo / Branding
  // ---------------------------------------------------------------------------
  &__logo {
    height: 96px; // h-24
    display: flex;
    align-items: center;
    padding: 0 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.10);
    gap: 12px;
    overflow: hidden;
    transition: padding 0.3s ease;
  }

  &__logo-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.20);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.30);
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  &__logo-text {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
  }

  &__logo-title {
    font-weight: 700;
    font-size: 1.125rem;
    line-height: 1.25;
    letter-spacing: -0.025em;
    margin: 0;
    color: white;
  }

  &__logo-sub {
    font-weight: 300;
  }

  &__logo-tagline {
    font-size: 0.625rem; // text-[10px]
    color: $detran-100;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.80;
    margin: 0;
  }

  // ---------------------------------------------------------------------------
  // Switcher Menu / Árvore
  // ---------------------------------------------------------------------------
  &__switcher {
    padding: 1rem 1rem 0.5rem;
    transition: padding 0.3s ease;
  }

  &__switch-wrap {
    background: rgba(0, 0, 0, 0.20);
    padding: 4px;
    border-radius: $radius-lg;
    display: flex;
    align-items: center;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  // O switch-wrap é o container; os botões são filhos diretos
  &__switcher {
    > div, > .detran-sidebar__switch-wrap {
      background: rgba(0, 0, 0, 0.20);
      padding: 4px;
      border-radius: $radius-lg;
      display: flex;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
  }

  &__switch-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.5rem;
    border-radius: $radius-md;
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.50);
    transition: $transition-base;
    overflow: hidden;

    &.is-active {
      @include glass-active;
    }

    &:not(.is-active):hover {
      color: white;
      background: $glass-hover-bg;
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
    gap: 2px;
  }

  &__section-label {
    padding: 0 1rem;
    font-size: 0.6875rem; // text-xs
    font-weight: 700;
    color: rgba(255, 255, 255, 0.60);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0.5rem 0 1rem;
  }

  &__divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.10);
    margin: 0.5rem 0;
  }

  // Link de navegação
  &__link {
    display: flex;
    align-items: center;
    padding: 0.625rem 0.75rem;
    border-radius: $radius-lg;
    color: #cce0d2;
    font-size: 0.9375rem;
    font-weight: 500;
    text-decoration: none;
    transition: $transition-base;
    position: relative;

    &.glass-active {
      color: white !important;
    }
  }

  &__link-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.2s ease;

    .detran-sidebar__link:hover & {
      transform: scale(1.1);
    }
  }

  &__link-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 0.5rem;
  }

  // Browse mode
  &__browse-loader {
    display: flex;
    justify-content: center;
    padding: 1.5rem;
  }

  &__browse-icon {
    flex-shrink: 0;
    margin-right: 0.5rem;
  }

  // ---------------------------------------------------------------------------
  // Footer de usuário
  // ---------------------------------------------------------------------------
  &__user-footer {
    padding: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.10);
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  &__user-btn {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0.5rem;
    border-radius: $radius-lg;
    text-align: left;
    overflow: hidden;
    min-width: 0;
    cursor: pointer;
  }

  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: $radius-full;
    border: 2px solid rgba(255, 255, 255, 0.20);
    flex-shrink: 0;
    object-fit: cover;
  }

  &__user-info {
    flex: 1;
    overflow: hidden;
    margin-left: 0.75rem;
  }

  &__user-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }

  &__user-email {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.70);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }

  &__settings-btn {
    width: 40px;
    height: 40px;
    border-radius: $radius-lg;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.50) !important;
    text-decoration: none;
  }

  // ---------------------------------------------------------------------------
  // Responsividade Mobile
  // ---------------------------------------------------------------------------
  @include mobile {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    width: $sidebar-width !important;

    &.is-mobile-open {
      transform: translateX(0);
      box-shadow: 4px 0 32px rgba(0, 0, 0, 0.3);
    }
  }
}
</style>

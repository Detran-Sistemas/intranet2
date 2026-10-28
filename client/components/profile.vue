<template lang='pug'>
  v-app.profile.admin(:dark='false')
    //- Fundo abstrato com Blobs vivos em movimento (fiel a design_system.html)
    .detran-sidebar-blobs(aria-hidden='true')
      .blob.blob--top
      .blob.blob--mid
      .blob.blob--bottom

    //- Sidebar estilo Detran-MG (ocupando 100% da altura da tela, padrão fiel a design_system.html)
    v-navigation-drawer.admin-sidebar(
      v-model='profileDrawerShown'
      app
      fixed
      :right='$vuetify.rtl'
      :permanent='$vuetify.breakpoint.mdAndUp'
      :mini-variant.sync='profileDrawerMini'
      mini-variant-width='72'
      width='288'
      )
      //- Botão de colapso (<) posicionado na borda externa
      button.admin-sidebar__toggle.d-none.d-md-flex(
        @click='profileDrawerMini = !profileDrawerMini'
        :title='profileDrawerMini ? "Expandir menu" : "Recolher menu"'
        type='button'
      )
        v-icon.admin-sidebar__toggle-icon(:class='{ "is-rotated": profileDrawerMini }' size='12') mdi-chevron-left

      //- Header do Sidebar: Logo Detran-MG oficial em branco (alinhada à esquerda)
      .admin-sidebar__header-row(:class='{ "is-mini": profileDrawerMini }')
        a.detran-sidebar__logo(
          href='/'
          title='Ir para a Intranet Detran-MG'
        )
          img.detran-sidebar__logo-img(
            v-if='!profileDrawerMini'
            src='/_assets/img/detran-logo-white.png'
            alt='Detran-MG'
          )
          .detran-mini-brand-box(v-else, title='Intranet Detran-MG')
            v-icon(size='22', color='white') mdi-car-estate

      //- Lista de Navegação com rolagem interna
      vue-scroll.admin-sidebar__scroll(:ops='scrollStyle')
        v-list.radius-0.detran-admin-nav-list(dense, nav)
          p.detran-sidebar__section-label(v-if='!profileDrawerMini') PRINCIPAL
          v-list-item(to='/profile', active-class='glass-active')
            v-list-item-avatar(size='24', tile): v-icon mdi-account-circle-outline
            v-list-item-title {{$t('profile:title')}}
          v-list-item(to='/pages', active-class='glass-active')
            v-list-item-avatar(size='24', tile): v-icon mdi-file-document-outline
            v-list-item-title {{$t('profile:pages.title')}}

      //- Perfil de Usuário no rodapé da Sidebar (fixado no rodapé)
      .admin-sidebar-footer
        .admin-user-profile-card
          a.d-flex.align-center.text-decoration-none(href='/p/profile', title='Acessar Meu Perfil', style='flex: 1; min-width: 0;')
            .admin-user-avatar-badge.mr-3(:class='{ "mr-0": profileDrawerMini }')
              v-icon(size='20' color='white') mdi-account
            .admin-user-info.overflow-hidden(v-if='!profileDrawerMini')
              .admin-user-name.text-truncate {{ userName || 'Administrator' }}
              .admin-user-email.text-truncate {{ userEmail || 'cezar.azevedo@detran.mg.gov.br' }}
          a.admin-user-action-btn(
            href='/'
            title='Voltar ao Portal'
            v-if='!profileDrawerMini'
          )
            v-icon(size='16' color='rgba(255,255,255,0.7)') mdi-cog

    //- Área Principal de Conteúdo
    v-main.admin-main
      //- Header Superior Flutuante
      header.detran-admin-topbar.d-flex.align-center.justify-space-between.px-8.py-4
        .detran-admin-topbar__left.d-flex.align-center
          v-btn.d-md-none.mr-3(icon, small, @click='profileDrawerShown = !profileDrawerShown', aria-label='Menu')
            v-icon(size='22', color='#206e3b') mdi-menu
          .detran-header-nav-badge.mr-3
            v-icon(size='18', color='#288b4a') mdi-account-cog-outline
          .detran-breadcrumbs-text
            span.detran-bc-parent PERFIL DE USUÁRIO
            span.detran-bc-sep /
            span.detran-bc-current {{ currentSectionTitle }}
        .detran-admin-topbar__right.d-flex.align-center
          a.detran-btn-portal-pill(href='/', title='Retornar ao Portal da Intranet')
            v-icon(size='16', color='#206e3b').mr-2 mdi-arrow-left
            span.d-none.d-sm-inline Voltar ao Portal

      .admin-content-area.px-8.pb-12
        transition(name='profile-router')
          router-view

    nav-footer
    notify
    search-results
</template>

<script>
import VueRouter from 'vue-router'
import { get } from 'vuex-pathify'

/* global WIKI */

const router = new VueRouter({
  mode: 'history',
  base: '/p',
  routes: [
    { path: '/', redirect: '/profile' },
    { path: '/profile', component: () => import(/* webpackChunkName: "profile" */ './profile/profile.vue') },
    { path: '/pages', component: () => import(/* webpackChunkName: "profile" */ './profile/pages.vue') },
    { path: '/comments', component: () => import(/* webpackChunkName: "profile" */ './profile/comments.vue') }
  ]
})

router.beforeEach((to, from, next) => {
  WIKI.$store.commit('loadingStart', 'profile')
  next()
})

router.afterEach((to, from) => {
  WIKI.$store.commit('loadingStop', 'profile')
})

export default {
  i18nOptions: { namespaces: 'profile' },
  data() {
    return {
      profileDrawerShown: true,
      profileDrawerMini: false,
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollY: 0,
          initialScrollX: 0,
          scrollingX: false,
          easing: 'easeOutQuad',
          speed: 1000,
          verticalNativeBarPos: this.$vuetify.rtl ? 'left' : 'right'
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#CCC',
          hoverStyle: {
            background: '#999'
          }
        }
      }
    }
  },
  router,
  computed: {
    userName: get('user/name'),
    userEmail: get('user/email'),
    currentSectionTitle () {
      const path = this.$route.path
      if (path.includes('/pages')) return 'Minhas Páginas'
      if (path.includes('/comments')) return 'Meus Comentários'
      return 'Meu Perfil'
    }
  },
  created() {
    this.$store.commit('page/SET_MODE', 'profile')
  }
}
</script>

<style lang='scss'>
@import '../themes/detran/scss/variables';
@import '../themes/detran/scss/animations';

.profile-router {
  &-enter-active, &-leave-active {
    transition: opacity .25s ease;
    opacity: 1;
  }
  &-enter-active {
    transition-delay: .25s;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }
}

.v-application.profile {
  background: $detran-900 !important;
  background-color: $detran-900 !important;
  position: relative;
  overflow-x: hidden;

  // Blobs de fundo orgânicos em movimento (design_system.html)
  .detran-sidebar-blobs {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: 320px;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;

    .blob {
      position: absolute;
      border-radius: 50%;
      mix-blend-mode: screen;
      filter: blur(50px);
      will-change: transform, opacity;

      &--top {
        width: 288px;
        height: 288px;
        background: rgba($detran-400, 0.45);
        top: -80px;
        left: -80px;
        opacity: 0.85;
        animation: detranLivingSidebarBlobTop 16s ease-in-out infinite alternate;
      }

      &--mid {
        width: 256px;
        height: 256px;
        background: rgba($detran-300, 0.28);
        top: 50%;
        left: -40px;
        transform: translateY(-50%);
        opacity: 0.65;
        filter: blur(40px);
        animation: detranLivingSidebarBlobMid 22s ease-in-out infinite alternate-reverse;
      }

      &--bottom {
        width: 320px;
        height: 320px;
        background: rgba($detran-500, 0.45);
        bottom: -80px;
        left: -80px;
        opacity: 0.85;
        animation: detranLivingSidebarBlobBottom 19s ease-in-out infinite alternate;
      }
    }
  }

  // Cards com superfície pura branca, bordas suaves e cantos 16px
  .v-card {
    background-color: #ffffff !important;
    border-radius: 16px !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
    overflow: hidden !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

    .v-toolbar {
      border-radius: 16px 16px 0 0 !important;
    }
  }

  // Cabeçalhos de card no profile
  .v-toolbar.blue-grey,
  .v-toolbar[color*="blue-grey"],
  .v-toolbar.primary,
  .v-toolbar[color*="primary"],
  .v-toolbar {
    background-color: #ffffff !important;
    background-image: none !important;
    border-bottom: 1px solid #f1f5f9 !important;
    box-shadow: none !important;
    color: #1e293b !important;

    .subtitle-1,
    .v-toolbar__title {
      color: #1e293b !important;
      font-weight: 600 !important;
      font-family: $font-family-base !important;
    }

    .v-icon {
      color: #288b4a !important;
    }
  }

  // Botões de Ação Primária
  .theme--light.v-btn.primary,
  .theme--light.v-btn.success,
  .v-btn--depressed.primary,
  .v-btn--contained.primary,
  .v-btn.primary,
  .v-btn.success {
    background: linear-gradient(135deg, #33a65b 0%, #288b4a 100%) !important;
    background-color: #33a65b !important;
    color: #ffffff !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 14px rgba(51, 166, 91, 0.35) !important;
    border: none !important;
    text-transform: none !important;

    &:hover {
      background: linear-gradient(135deg, #288b4a 0%, #206e3b 100%) !important;
      box-shadow: 0 6px 18px rgba(51, 166, 91, 0.45) !important;
      transform: translateY(-1px);
    }

    .v-icon {
      color: #ffffff !important;
    }
  }
}

// --- Sidebar Institucional do Detran-MG ---
.profile .admin-sidebar {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: none !important;
  border-right: none !important;
  box-shadow: none !important;
  height: 100vh !important;
  top: 0 !important;
  z-index: 20 !important;
  overflow: visible !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  -webkit-font-smoothing: antialiased !important;
  -moz-osx-font-smoothing: grayscale !important;
  text-rendering: optimizeLegibility !important;

  display: flex !important;
  flex-direction: column !important;
  height: 100vh !important;
  max-height: 100vh !important;

  .v-navigation-drawer__content {
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    height: 100vh !important;
    max-height: 100vh !important;
  }

  // Barra de rolagem suave
  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
    &:hover { background: rgba($detran-400, 0.5); }
  }

  .admin-sidebar__header-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0 1.5rem;
    height: 80px;
    position: relative;
    border-bottom: none !important;
    overflow: hidden;
    flex-shrink: 0;
  }

  .detran-sidebar__logo {
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0;
    overflow: hidden;
    transition: padding 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    width: auto;

    &:hover .detran-sidebar__logo-img {
      opacity: 0.95;
      transform: scale(1.02);
    }
  }

  .detran-sidebar__logo-img {
    max-height: 38px;
    max-width: 155px;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25));
    transition: max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.2s ease,
                opacity 0.2s ease;
  }

  .detran-mini-brand-box {
    width: 38px;
    height: 38px;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.28);
      transform: scale(1.05);
    }
  }

  &.v-navigation-drawer--mini-variant {
    .admin-sidebar__header-row {
      justify-content: center !important;
      padding: 0 0.5rem !important;
    }
    .detran-sidebar__logo {
      justify-content: center !important;
      width: 100% !important;
    }
    .admin-sidebar-footer {
      justify-content: center !important;
      padding: 0.75rem 0.5rem !important;
      .admin-user-profile-card {
        justify-content: center !important;
        padding: 0.25rem !important;
        a {
          flex: 0 0 auto !important;
          justify-content: center !important;
        }
      }
      .admin-user-avatar-badge {
        margin: 0 !important;
      }
    }
  }

  .admin-sidebar__toggle {
    position: absolute !important;
    right: -12px !important;
    top: 36px !important;
    width: 24px !important;
    height: 24px !important;
    background: $detran-500 !important;
    border-radius: 9999px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 40 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
    transition: background-color 0.2s, transform 0.2s !important;
    cursor: pointer;
    border: none !important;
    padding: 0;

    .v-icon {
      color: white !important;
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
      &.is-rotated {
        transform: rotate(180deg) !important;
      }
    }

    &:hover {
      background: $detran-600 !important;
      transform: scale(1.1);
    }
  }

  .admin-sidebar__scroll {
    flex: 1 1 0% !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: hidden !important;
  }

  .detran-sidebar__section-label {
    font-family: $font-family-base !important;
    font-size: 0.6875rem !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    color: rgba(255, 255, 255, 0.60) !important;
    padding: 0 1rem !important;
    margin: 0.75rem 0 0.5rem !important;
    max-height: 30px;
    overflow: hidden;
    white-space: nowrap;
  }

  .v-divider {
    border-color: rgba(255, 255, 255, 0.08) !important;
    margin: 4px 0 !important;
  }

  .v-list.detran-admin-nav-list {
    background: transparent !important;
    padding: 0.5rem 1rem !important;
  }

  .v-list-item {
    display: flex !important;
    align-items: center !important;
    border-radius: 12px !important;
    margin: 2px 0 !important;
    padding: 0.625rem 0.75rem !important;
    min-height: 42px !important;
    color: #cce0d2 !important;
    transition: background 0.2s ease,
                color 0.2s ease,
                transform 0.2s ease !important;

    .v-list-item__title {
      font-family: $font-family-base !important;
      font-size: 0.9375rem !important;
      font-weight: 500 !important;
      color: #cce0d2 !important;
      letter-spacing: normal !important;
      transition: color 0.25s ease !important;
    }

    .v-list-item__icon,
    .v-avatar.v-list-item__avatar {
      margin-right: 8px !important;
      min-width: 24px !important;
      .v-icon {
        color: #cce0d2 !important;
        font-size: 19px !important;
        transition: color 0.25s ease, transform 0.25s ease !important;
      }
    }

    &:hover {
      background-color: rgba(255, 255, 255, 0.10) !important;
      color: #ffffff !important;
      transform: translateX(4px);

      .v-list-item__title { color: #ffffff !important; }
      .v-icon { color: #ffffff !important; transform: scale(1.1); }
    }

    &.glass-active,
    &.v-list-item--active,
    &--active {
      background-color: rgba(255, 255, 255, 0.15) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.10) !important;
      color: #ffffff !important;

      .v-list-item__title {
        color: #ffffff !important;
        font-weight: 600 !important;
      }
      .v-icon { color: #ffffff !important; }
      &::before { display: none !important; }
    }
  }

  .admin-sidebar-footer {
    border-top: none !important;
    background: transparent !important;
    flex-shrink: 0 !important;
    padding: 0.75rem 1rem !important;
    display: flex !important;
    align-items: center !important;

    .admin-user-profile-card {
      display: flex !important;
      align-items: center !important;
      width: 100% !important;
      padding: 0.375rem 0.5rem !important;
      border-radius: 12px !important;
      transition: background 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.10) !important;
      }
    }

    .admin-user-avatar-badge {
      width: 40px !important;
      height: 40px !important;
      border-radius: 9999px !important;
      background: linear-gradient(135deg, $detran-500, $detran-700) !important;
      border: 2px solid rgba(255, 255, 255, 0.20) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0 !important;
    }

    .admin-user-name {
      color: #ffffff !important;
      font-weight: 600 !important;
      font-size: 0.875rem !important;
      line-height: 1.25 !important;
    }

    .admin-user-email {
      color: rgba(255, 255, 255, 0.70) !important;
      font-size: 0.75rem !important;
      line-height: 1.2 !important;
      margin-top: 1px !important;
    }

    .admin-user-action-btn {
      width: 36px;
      height: 36px;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.70) !important;
      background: rgba(255, 255, 255, 0.08);
      text-decoration: none !important;
      flex-shrink: 0;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.18);
        color: #ffffff !important;
        transform: rotate(45deg);
      }
    }
  }

  .v-list {
    background: transparent !important;
    padding: 0.5rem 1rem !important;
  }
}

// --- Área de Conteúdo Principal (curvatura elegante sobre o fundo institucional) ---
.profile .admin-main {
  background: transparent !important;
  position: relative;
  z-index: 10;
  transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  > .v-main__wrap {
    background-color: #f8fafc !important;
    min-height: 100vh;
    border-top-left-radius: 1.25rem !important;
    border-bottom-left-radius: 1.25rem !important;
    box-shadow: -14px 0 36px rgba(0, 0, 0, 0.25), -4px 0 10px rgba(0, 0, 0, 0.12) !important;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }
}

// --- Topbar Flutuante ---
.profile .detran-admin-topbar {
  position: sticky;
  top: 0;
  z-index: 15;
  background: rgba(248, 250, 252, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid #e2e8f0;
  border-top-left-radius: 1.25rem !important;

  .detran-header-nav-badge {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #e1f6e8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detran-bc-parent {
    font-size: 0.6875rem;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.08em;
  }

  .detran-bc-sep {
    margin: 0 8px;
    color: #cbd5e1;
  }

  .detran-bc-current {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .detran-btn-portal-pill {
    display: inline-flex;
    align-items: center;
    padding: 8px 18px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #c3ebce;
    border-radius: 12px;
    color: #206e3b;
    font-weight: 600;
    font-size: 13px;
    text-decoration: none;
    box-shadow: 0 4px 15px -3px rgba(0, 0, 0, 0.05);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: #33a65b;
      color: #ffffff;
      border-color: #33a65b;
      box-shadow: 0 6px 18px -2px rgba(51, 166, 91, 0.35);
      transform: translateY(-1px);

      .v-icon { color: #ffffff !important; }
    }
  }
}

@media (max-width: 959px) {
  .profile .admin-main {
    > .v-main__wrap {
      border-top-left-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      box-shadow: none !important;
    }
  }
  .profile .detran-admin-topbar {
    border-top-left-radius: 0 !important;
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
  .profile .admin-content-area {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
}

// --- Cabeçalho Padrão do Profile ---
.profile-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px !important;

  > img {
    display: inline-block !important;
    width: 52px !important;
    height: 52px !important;
    border-radius: 14px !important;
    padding: 10px !important;
    background: #e1f6e8 !important;
    border: 1px solid #c3ebce !important;
    margin-right: 18px !important;
    object-fit: contain !important;
    box-shadow: 0 4px 12px rgba(51, 166, 91, 0.12) !important;
    flex-shrink: 0 !important;
  }

  &-title {
    margin-left: 0 !important;

    .headline {
      font-family: $font-family-base !important;
      font-weight: 700 !important;
      font-size: 1.625rem !important;
      letter-spacing: -0.02em !important;
      color: #1e293b !important;
      line-height: 1.25 !important;

      &.primary--text {
        color: #1e293b !important;
      }
    }

    .subheading {
      font-family: $font-family-base !important;
      font-size: 0.9375rem !important;
      color: #64748b !important;
      margin-top: 2px !important;
    }
  }
}
</style>

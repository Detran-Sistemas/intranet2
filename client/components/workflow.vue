<template lang='pug'>
  v-app.detran-app.detran-workflow-app(:dark='false')

    //- Overlay mobile (fecha sidebar ao clicar fora)
    transition(name='detran-fade')
      .detran-mobile-overlay(
        v-if='mobileSidebarOpen'
        @click='mobileSidebarOpen = false'
        aria-hidden='true'
      )

    //- Layout principal Detran-MG: sidebar glassmorphism + área principal
    .detran-layout

      //- Blobs decorativos da sidebar
      .detran-sidebar-blobs(aria-hidden='true')
        .blob.blob--top
        .blob.blob--mid
        .blob.blob--bottom

      //- Sidebar Institucional Detran-MG
      nav-sidebar(
        v-if='navMode !== "NONE"'
        :items='sidebarDecoded'
        :nav-mode='navMode'
        current-path='w'
        :locale='locale'
        :can-manage-system='canManageSystem'
        :class='{ "is-mobile-open": mobileSidebarOpen }'
        @close-mobile='mobileSidebarOpen = false'
        ref='sidebar'
      )

      //- Área Principal
      .detran-main

        //- Header flutuante (barra de busca + ações institucionais)
        header.detran-header(aria-label='Barra de pesquisa e ações')
          .detran-header__inner

            button.detran-header__hamburger(
              v-if='navMode !== "NONE"'
              @click='mobileSidebarOpen = !mobileSidebarOpen'
              :aria-expanded='mobileSidebarOpen'
              aria-label='Abrir menu de navegação'
              type='button'
            )
              v-icon mdi-menu

            //- Barra de busca glassmorphism
            .detran-search(
              role='search'
              :class='{ "is-focused": searchIsFocused }'
            )
              v-icon.detran-search__icon(size='18' color='#94a3b8') mdi-magnify
              input.detran-search__input(
                v-model='search'
                type='search'
                placeholder='Pesquisar procedimentos, manuais, sistemas...'
                @focus='searchFocus'
                @blur='searchBlur'
                @keyup.enter='searchEnter'
                @keyup.esc='searchClose'
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

            //- Ações do Header
            .detran-header__actions
              //- Atalho Voltar ao Portal
              a.detran-header__portal-pill(
                :href='`/${locale}/home`'
                title='Voltar ao Portal da Intranet'
              )
                v-icon(size='15' color='#1b6535') mdi-home-outline
                span Portal Intranet

              //- Central de Notificações ("Novidades da Intranet")
              v-menu(
                v-if='isAuthenticated'
                offset-y
                bottom
                left
                transition='slide-y-transition'
                min-width='380'
                max-width='420'
                :close-on-content-click='true'
              )
                template(v-slot:activator='{ on }')
                  button.detran-header__action-btn(
                    v-on='on'
                    title='Novidades da Intranet e Validações'
                    type='button'
                    aria-label='Novidades da Intranet'
                  )
                    v-badge(
                      v-if='workflowPendingCount > 0'
                      color='#e11d48'
                      :content='workflowPendingCount'
                      overlap
                      offset-x='8'
                      offset-y='8'
                    )
                      v-icon(size='20' color='#d97706') mdi-bell-ring
                    v-icon(v-else size='20' color='#64748b') mdi-bell-outline
                v-card.rounded-xl.overflow-hidden.elevation-12
                  .pa-4.white--text.d-flex.align-center.justify-space-between(style='background: linear-gradient(135deg, #185a30 0%, #103d20 100%);')
                    .d-flex.align-center
                      v-icon.mr-2(color='#fcd34d', size='20') mdi-sparkles
                      div
                        .text-subtitle-2.font-weight-bold Novidades da Intranet
                        .caption(style='color: #a7f3d0;') Atualizações e tramitações de validação
                  v-card-text.pa-0(style='max-height: 320px; overflow-y: auto;')
                    template(v-if='workflowPendingTasks.length > 0')
                      v-list.py-0.dense
                        v-list-item(
                          v-for='task in workflowPendingTasks'
                          :key='task.id'
                          :to='`/review/${task.id}`'
                          class='py-2 px-3'
                        )
                          v-list-item-avatar.mr-3(size='32', color='#eff6ff')
                            v-icon(size='18', color='#2563eb') mdi-shield-check
                          v-list-item-content
                            .d-flex.align-center.justify-space-between
                              span.text-caption.font-weight-bold.blue--text.text--darken-3.text-uppercase Validação Pendente
                              span.text-caption.grey--text Pendente
                            .caption.font-weight-bold.text-truncate {{ task.title || task.path }}
                            .text-caption.grey--text.text--darken-1.text-truncate Autor: {{ task.authorName || 'Servidor' }}
                    template(v-else)
                      .pa-6.text-center.grey--text
                        v-icon.mb-2(size='36', color='grey lighten-2') mdi-bell-check-outline
                        .caption Nenhuma validação pendente no momento
                  v-divider
                  v-card-actions.pa-2.grey.lighten-4.d-flex.justify-center
                    v-btn(text, small, color='#1b6535', to='/', class='caption font-weight-bold text-none')
                      span Ver fila completa de governança
                      v-icon(x-small, right) mdi-arrow-right

              //- App Launcher / Sistemas Satélites Integrados (Entra ID Hub)
              v-menu(
                offset-y
                bottom
                transition='slide-y-transition'
                content-class='detran-apps-popover-menu'
                max-width='340'
              )
                template(v-slot:activator='{ on }')
                  button.detran-header__action-btn(
                    v-on='on'
                    title='Aplicações e Sistemas Satélites'
                    type='button'
                    aria-label='Sistemas Satélites'
                  )
                    v-icon(size='20' color='#288b4a') mdi-apps
                v-card.detran-apps-popover(flat)
                  .detran-apps-popover__header(style='padding: 14px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;')
                    .overline(style='font-size: 10px; font-weight: 700; color: #288b4a;') SISTEMAS INTEGRADOS
                    .font-weight-bold(style='font-size: 14px; color: #1e293b;') Aplicações Satélites (Entra ID)
                  v-list(dense style='padding: 6px 0;')
                    v-list-item(
                      v-for='app in (internalApps && internalApps.length ? internalApps : [{ id: "servicedesk", nome: "Service Desk", icone: "mdi-headset", descricao: "Suporte e Chamados", resolvedSsoUrl: "/apps/servicedesk" }])'
                      :key='app.id'
                      :href='app.resolvedSsoUrl || `/apps/${app.id}`'
                      style='border-radius: 8px; margin: 4px 8px;'
                    )
                      v-list-item-avatar(size='36' color='green lighten-5')
                        v-icon(color='primary' size='20') {{ app.icone || 'mdi-application' }}
                      v-list-item-content
                        v-list-item-title.font-weight-bold(style='font-size: 13px; color: #1e293b;') {{ app.nome }}
                        v-list-item-subtitle(style='font-size: 11px; color: #64748b;') {{ app.descricao || 'Single Sign-On' }}
                      v-list-item-action
                        v-icon(size='16' color='#94a3b8') mdi-chevron-right
                  v-divider
                  .pa-2.text-center
                    v-btn(text x-small color='primary' href='/apps')
                      | Abrir Hub de Aplicações

              //- Botão Perfil / Usuário
              button.detran-header__user-btn(
                v-if='isAuthenticated'
                @click='openUserModal'
                :title='userName'
                aria-label='Acessar menu do usuário'
                type='button'
              )
                .detran-header__user-initials {{ userInitials }}

        search-results

        //- Conteúdo Principal Scrollável (mesmo container .detran-content das demais telas)
        .detran-content
          .detran-content__inner
            transition(name='workflow-router' mode='out-in')
              router-view

        nav-footer

    notify
</template>

<script>
import VueRouter from 'vue-router'
import { get, sync } from 'vuex-pathify'
import gql from 'graphql-tag'
import { workflowRoutes } from '../routes/workflow'
import NavSidebar from '../themes/detran/components/nav-sidebar.vue'
import NavFooter from '../themes/detran/components/nav-footer.vue'

/* global WIKI */

const router = new VueRouter({
  mode: 'history',
  base: '/w',
  routes: workflowRoutes
})

router.beforeEach((to, from, next) => {
  if (WIKI && WIKI.$store) {
    WIKI.$store.commit('loadingStart', 'workflow')
  }
  next()
})

router.afterEach(() => {
  if (WIKI && WIKI.$store) {
    WIKI.$store.commit('loadingStop', 'workflow')
  }
})

export default {
  name: 'Workflow',
  router,
  components: {
    NavSidebar,
    NavFooter
  },
  props: {
    locale: { type: String, default: 'pt-br' },
    sidebar: { type: String, default: '' },
    navMode: { type: String, default: 'SIDEBAR' }
  },
  data () {
    return {
      mobileSidebarOpen: false,
      internalApps: [],
      workflowPendingCount: 0,
      workflowPendingTasks: []
    }
  },
  computed: {
    userId: get('user/id'),
    isAuthenticated: get('user/authenticated'),
    rawUserName: get('user/name'),
    search: sync('site/search'),
    searchIsFocused: sync('site/searchIsFocused'),
    searchIsLoading: sync('site/searchIsLoading'),

    userName () {
      if (this.rawUserName && this.rawUserName.trim().length > 0 && this.rawUserName !== 'Guest') {
        return this.rawUserName
      }
      return 'Administrador'
    },
    userInitials () {
      const name = this.userName || ''
      const parts = name.trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) return 'A'
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    },
    canManageSystem () {
      return Number(this.userId) === 1
    },
    sidebarDecoded () {
      if (!this.sidebar) return []
      try {
        return JSON.parse(Buffer.from(this.sidebar, 'base64').toString('utf8'))
      } catch (e) {
        try {
          return JSON.parse(decodeURIComponent(escape(atob(this.sidebar))))
        } catch (err) {
          return []
        }
      }
    }
  },
  created () {
    this.$store.set('page/mode', 'workflow')
  },
  mounted () {
    fetch('/api/detran/apps')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.apps)) {
          this.internalApps = data.apps
        }
      })
      .catch(() => {})

    this.fetchWorkflowPendingCount()
    this.$root.$on('workflowRefreshTasks', () => {
      this.fetchWorkflowPendingCount()
    })
  },
  methods: {
    async fetchWorkflowPendingCount () {
      try {
        const result = await this.$apollo.query({
          query: gql`
            query {
              workflow {
                pendingTasks {
                  id
                  title
                  path
                  authorName
                  createdAt
                }
              }
            }
          `,
          fetchPolicy: 'network-only'
        })
        const tasks = (result && result.data && result.data.workflow && result.data.workflow.pendingTasks) || []
        this.workflowPendingCount = tasks.length
        this.workflowPendingTasks = tasks
      } catch (e) {}
    },
    searchFocus () {
      this.searchIsFocused = true
    },
    searchBlur () {
      this.searchIsFocused = false
    },
    /* eslint-disable vue/custom-event-name-casing */
    searchEnter () {
      this.$root.$emit('searchEnter')
    },
    searchClose () {
      this.search = ''
      this.searchIsFocused = false
      this.$root.$emit('searchClose')
    },
    /* eslint-enable vue/custom-event-name-casing */
    openUserModal () {
      if (this.$refs.sidebar && typeof this.$refs.sidebar.openUserModal === 'function') {
        this.$refs.sidebar.openUserModal()
      }
    }
  }
}
</script>

<style lang='scss'>
@import '../themes/detran/scss/variables';

.detran-workflow-app {
  &.v-application {
    background: $detran-900 !important;
    font-family: $font-family-base !important;

    .v-application--wrap {
      min-height: 100vh;
      display: block;
    }
  }
}

.detran-header__action-btn {
  @include glass-panel;
  width: 42px;
  height: 42px;
  border-radius: $radius-lg;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-float;
  border: 1px solid rgba(226, 232, 240, 0.85);
  cursor: pointer;
  transition: $transition-base;

  &:hover {
    background: rgba(255, 255, 255, 0.98);
    transform: translateY(-1px);
  }
}

.detran-header__portal-pill {
  @include glass-panel;
  padding: 0.55rem 1rem;
  border-radius: $radius-lg;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: $detran-700 !important;
  text-decoration: none !important;
  box-shadow: $shadow-float;
  border: 1px solid rgba(226, 232, 240, 0.85);
  transition: $transition-base;

  &:hover {
    background: $detran-50;
    border-color: $detran-200;
    color: $detran-800 !important;
  }
}

.workflow-router {
  &-enter-active, &-leave-active {
    transition: opacity .2s ease;
    opacity: 1;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }
}
</style>

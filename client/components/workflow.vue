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

            //- Barra de busca glassmorphism (recolhível no scroll)
            .detran-search(
              role='search'
              :class='{ "is-focused": searchIsFocused, "is-collapsed": searchIsCollapsed }'
              :title='searchIsCollapsed ? "Pesquisar (clique para expandir)" : null'
              @click='onSearchClick'
            )
              v-icon.detran-search__icon(size='18' color='#94a3b8') mdi-magnify
              input.detran-search__input(
                ref='searchInput'
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
                @click.stop='searchClose'
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
                          :to='"/review/" + task.id + (task.state === "changes_requested" ? "?edit=1" : "")'
                          class='py-2 px-3'
                        )
                          v-list-item-avatar.mr-3(size='32', :color='task.state === "changes_requested" ? "#fff7ed" : "#eff6ff"')
                            v-icon(size='18', :color='task.state === "changes_requested" ? "#d97706" : "#2563eb"') {{ task.state === "changes_requested" ? "mdi-undo-variant" : "mdi-shield-check" }}
                          v-list-item-content
                            .d-flex.align-center.justify-space-between
                              span.text-caption.font-weight-bold.text-uppercase(:class='task.state === "changes_requested" ? "amber--text text--darken-4" : "blue--text text--darken-3"') {{ task.state === "changes_requested" ? "Devolvido para Ajustes" : "Validação Pendente" }}
                              span.text-caption(:class='task.state === "changes_requested" ? "amber--text text--darken-4 font-weight-bold" : "grey--text"') {{ task.state === "changes_requested" ? "Ajustar" : "Pendente" }}
                            .caption.font-weight-bold.text-truncate {{ task.title || task.path }}
                            .text-caption.grey--text.text--darken-1.text-truncate {{ task.state === "changes_requested" ? (task.lastComment ? "Motivo: " + task.lastComment : "Revisor solicitou ajustes") : ("Autor: " + (task.authorName || "Servidor")) }}
                    template(v-else)
                      .pa-6.text-center.grey--text
                        v-icon.mb-2(size='36', color='grey lighten-2') mdi-bell-check-outline
                        .caption Nenhuma validação pendente no momento
                  v-divider
                  v-card-actions.pa-2.grey.lighten-4.d-flex.justify-center
                    v-btn(text, small, color='#1b6535', to='/', class='caption font-weight-bold text-none')
                      span Ver fila completa de governança
                      v-icon(x-small, right) mdi-arrow-right

              //- App Launcher / Sistemas Satélites Integrados (anterior ao botão de usuário)
              v-menu(
                offset-y
                bottom
                left
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

              //- Botão de Usuário (somente Avatar com Dropdown estilizado)
              a.detran-header__avatar-btn.is-login(
                v-if='!isAuthenticated'
                href='/login'
                title='Fazer Login'
                aria-label='Fazer Login'
              )
                v-icon(size='20' color='#288b4a') mdi-login

              v-menu(
                v-else
                offset-y
                bottom
                left
                transition='slide-y-transition'
                content-class='detran-user-dropdown-menu'
                min-width='300'
                max-width='330'
                :close-on-content-click='true'
              )
                template(v-slot:activator='{ on }')
                  button.detran-header__avatar-btn(
                    v-on='on'
                    :title='userName'
                    aria-label='Abrir menu do usuário'
                    type='button'
                  )
                    img.detran-header__user-avatar(
                      v-if='hasUserAvatar'
                      :src='userAvatar'
                      :alt='userName'
                      @error='avatarFailed = true'
                      loading='lazy'
                    )
                    .detran-header__user-initials(v-else) {{ userInitials }}

                v-card.detran-user-dropdown(flat)
                  .detran-user-dropdown__header
                    .detran-user-dropdown__avatar-wrap
                      img.detran-user-dropdown__avatar(
                        v-if='hasUserAvatar'
                        :src='userAvatar'
                        :alt='userName'
                      )
                      .detran-user-dropdown__avatar-initials(v-else) {{ userInitials }}
                    .detran-user-dropdown__info
                      h3.detran-user-dropdown__name {{ userName }}
                      p.detran-user-dropdown__email {{ userEmail }}

                  .detran-user-dropdown__body
                    a.detran-user-dropdown__item(
                      href='/p'
                      @click.prevent='goToProfile'
                    )
                      .detran-user-dropdown__item-icon
                        v-icon(size='18' color='#288b4a') mdi-account-circle-outline
                      .detran-user-dropdown__item-text
                        span.detran-user-dropdown__item-title Meu Perfil
                        span.detran-user-dropdown__item-desc Informações e preferências
                      v-icon(size='16' color='#94a3b8') mdi-chevron-right

                    a.detran-user-dropdown__item(
                      href='/w'
                    )
                      .detran-user-dropdown__item-icon
                        v-icon(size='18' color='#288b4a') mdi-clipboard-check-outline
                      .detran-user-dropdown__item-text
                        span.detran-user-dropdown__item-title Governança &amp; Revisões
                        span.detran-user-dropdown__item-desc Rascunhos e aprovações
                      v-icon(size='16' color='#94a3b8') mdi-chevron-right

                    a.detran-user-dropdown__item(
                      href='/a'
                      @click.prevent='goToAdmin'
                    )
                      .detran-user-dropdown__item-icon
                        v-icon(size='18' color='#288b4a') mdi-cog-outline
                      .detran-user-dropdown__item-text
                        span.detran-user-dropdown__item-title Configurações
                        span.detran-user-dropdown__item-desc Administração e ajustes do sistema
                      v-icon(size='16' color='#94a3b8') mdi-chevron-right

                    hr.detran-user-dropdown__divider

                    button.detran-user-dropdown__item.detran-user-dropdown__item--logout(
                      type='button'
                      @click='doLogout'
                    )
                      .detran-user-dropdown__item-icon.detran-user-dropdown__item-icon--danger
                        v-icon(size='18' color='#ef4444') mdi-logout
                      .detran-user-dropdown__item-text
                        span.detran-user-dropdown__item-title Sair
                        span.detran-user-dropdown__item-desc Encerrar sessão com segurança
                      v-icon(size='16' color='#ef4444') mdi-chevron-right

        search-results

        //- Conteúdo Principal Scrollável (mesmo container .detran-content das demais telas)
        .detran-content
          .detran-content__inner
            transition(name='workflow-router' mode='out-in')
              router-view
            //- Rodapé institucional posicionado ao final do documento
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
      avatarFailed: false,
      internalApps: [],
      workflowPendingCount: 0,
      workflowPendingTasks: [],
      searchIsCollapsed: false,
      lastScrollY: 0
    }
  },
  computed: {
    userId: get('user/id'),
    isAuthenticated: get('user/authenticated'),
    rawUserName: get('user/name'),
    rawUserEmail: get('user/email'),
    rawJobTitle: get('user/jobTitle'),
    rawPictureUrl: get('user/pictureUrl'),
    search: sync('site/search'),
    searchIsFocused: sync('site/searchIsFocused'),
    searchIsLoading: sync('site/searchIsLoading'),

    userName () {
      if (this.rawUserName && this.rawUserName.trim().length > 0 && this.rawUserName !== 'Guest') {
        return this.rawUserName
      }
      return 'Administrador'
    },
    userEmail () {
      if (this.rawJobTitle && this.rawJobTitle.trim().length > 0) {
        return this.rawJobTitle
      }
      if (this.rawUserEmail && this.rawUserEmail.trim().length > 0 && !this.rawUserEmail.includes('guest')) {
        return this.rawUserEmail
      }
      return 'Servidor Detran-MG'
    },
    userInitials () {
      const name = this.userName || ''
      const parts = name.trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) return 'A'
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    },
    hasUserAvatar () {
      if (this.avatarFailed) return false
      return !!(this.rawPictureUrl && this.rawPictureUrl.length > 1 && !this.rawPictureUrl.includes('pravatar.cc'))
    },
    userAvatar () {
      if (this.rawPictureUrl && this.rawPictureUrl.length > 1 && !this.rawPictureUrl.includes('pravatar.cc')) {
        return (this.rawPictureUrl === 'internal') ? `/_userav/${this.userId}` : this.rawPictureUrl
      }
      return ''
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

    // Recolhimento automático da barra de pesquisa ao scrollar
    this.$nextTick(() => {
      this.scrollContainer = this.$el && this.$el.querySelector('.detran-content')
      if (this.scrollContainer) {
        this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true })
      }
      window.addEventListener('scroll', this.handleScroll, { passive: true, capture: true })
    })
  },
  beforeDestroy () {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll)
    }
    window.removeEventListener('scroll', this.handleScroll, { capture: true })
  },
  methods: {
    onSearchClick () {
      if (this.searchIsCollapsed) {
        this.searchIsCollapsed = false
        this.$nextTick(() => {
          const input = this.$refs.searchInput || (this.$el && this.$el.querySelector('.detran-search__input'))
          if (input && typeof input.focus === 'function') {
            input.focus()
            this.searchFocus()
          }
        })
      }
    },
    handleScroll (event) {
      const target = (event && event.target && event.target.scrollTop !== undefined && event.target !== document && event.target !== document.body) ?
        event.target :
        (this.scrollContainer || null)
      const currentY = target ? target.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0)

      // Se o campo de busca estiver focado ou contiver texto digitado, não recolhe
      if (this.searchIsFocused || (this.search && this.search.trim().length > 0)) {
        this.lastScrollY = currentY
        return
      }

      // Ao rolar para baixo além de 40px: recolhe a barra de pesquisa
      if (currentY > 40 && currentY > this.lastScrollY + 5) {
        if (!this.searchIsCollapsed) {
          this.searchIsCollapsed = true
        }
      } else if (currentY < this.lastScrollY - 10 || currentY <= 25) {
        // Ao rolar para cima ou retornar próximo ao topo: expande a barra
        if (this.searchIsCollapsed) {
          this.searchIsCollapsed = false
        }
      }
      this.lastScrollY = currentY
    },
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
                  state
                  authorName
                  lastComment
                  createdAt
                  updatedAt
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
    },
    goToProfile () {
      window.location.assign('/p')
    },
    goToAdmin () {
      window.location.assign('/a')
    },
    doLogout () {
      if (this.$refs.sidebar && typeof this.$refs.sidebar.doLogout === 'function') {
        this.$refs.sidebar.doLogout()
        return
      }
      window.location.assign('/logout')
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

  .detran-content {
    min-height: calc(100vh - #{$header-height});
    display: flex;
    flex-direction: column;

    &__inner {
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 100%;
    }

    @include medium-screens {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
      padding-top: 5rem;
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

.detran-header__avatar-btn {
  @include glass-panel;
  width: 42px;
  height: 42px;
  padding: 3px;
  border-radius: $radius-full !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-float;
  border: 1px solid rgba(226, 232, 240, 0.9);
  cursor: pointer;
  text-decoration: none !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: $detran-400;
    box-shadow: 0 4px 12px rgba(40, 139, 74, 0.18);
    transform: translateY(-1px);
  }

  &.is-login {
    background: rgba(255, 255, 255, 0.95);
  }

  .detran-header__user-avatar {
    width: 100%;
    height: 100%;
    border-radius: $radius-full !important;
    object-fit: cover;
    display: block;
    flex-shrink: 0;
  }

  .detran-header__user-initials {
    width: 100%;
    height: 100%;
    border-radius: $radius-full !important;
    background: linear-gradient(135deg, $detran-500, $detran-700);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8125rem;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
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

.detran-search {
  @include glass-panel;
  flex: 1;
  max-width: 672px;
  min-width: 0;
  border-radius: 1rem;
  box-shadow: $shadow-float;
  display: flex;
  align-items: center;
  height: 46px;
  box-sizing: border-box;
  padding: 0 1rem;
  transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              padding 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.25s ease,
              border-color 0.25s ease,
              box-shadow 0.25s ease;
  border: 1px solid rgba(226, 232, 240, 0.8);
  position: relative;
  z-index: 51;

  &.is-collapsed {
    max-width: 46px;
    width: 46px;
    padding: 0;
    justify-content: center;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 0.75rem;

    .detran-search__icon {
      margin-right: 0 !important;
      color: $slate-600 !important;
      font-size: 20px !important;
    }

    .detran-search__input {
      display: none !important;
    }

    .detran-search__clear-btn {
      display: none !important;
    }

    &:hover {
      background: #ffffff;
      border-color: $detran-400;
      box-shadow: 0 4px 12px rgba(40, 139, 74, 0.15);

      .detran-search__icon {
        color: $detran-700 !important;
        transform: scale(1.1);
      }
    }
  }

  @include mobile {
    height: 38px;
    padding: 0 0.625rem;
    border-radius: 0.625rem;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(226, 232, 240, 0.9);

    &.is-collapsed {
      max-width: 38px;
      width: 38px;
      height: 38px;
      padding: 0;
    }
  }
}

.detran-user-dropdown-menu {
  border-radius: 1rem !important;
  box-shadow: 0 18px 40px -10px rgba(15, 23, 42, 0.22), 0 4px 14px rgba(15, 23, 42, 0.08) !important;
  border: 1px solid rgba(226, 232, 240, 0.9);
  overflow: hidden !important;
  margin-top: 8px;
}

.detran-user-dropdown {
  background: #ffffff !important;
  border-radius: 1rem !important;
  overflow: hidden;
  font-family: $font-family-base;

  &__header {
    background: linear-gradient(135deg, $detran-600 0%, $detran-800 100%);
    padding: 1rem 1.125rem;
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  &__avatar-wrap {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.14);
  }

  &__avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__avatar-initials {
    font-size: 1rem;
    font-weight: 700;
    color: #ffffff;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__email {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0.2rem 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__body {
    padding: 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__divider {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 0.25rem 0.375rem;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.625rem;
    text-decoration: none !important;
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.18s ease;
    cursor: pointer;
    text-align: left;
    width: 100%;

    &:hover {
      background: #f8fafc;
      border-color: #e2e8f0;
    }

    &--logout:hover {
      background: #fef2f2;
      border-color: #fecaca;
    }
  }

  &__item-icon {
    width: 34px;
    height: 34px;
    border-radius: 0.5rem;
    background: rgba($detran-500, 0.1);
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
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.2;
  }

  &__item-desc {
    font-size: 0.6875rem;
    color: #64748b;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>

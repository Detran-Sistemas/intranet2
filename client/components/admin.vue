<template lang='pug'>
  v-app.admin
    //- Fundo abstrato com Blobs vivos em movimento (design_system.html)
    .detran-sidebar-blobs(aria-hidden='true')
      .blob.blob--top
      .blob.blob--mid
      .blob.blob--bottom

    //- Sidebar estilo Detran-MG (ocupando 100% da altura da tela, padrão fiel a design_system.html)
    v-navigation-drawer.admin-sidebar(
      v-model='adminDrawerShown'
      app
      fixed
      :right='$vuetify.rtl'
      :permanent='$vuetify.breakpoint.mdAndUp'
      :mini-variant.sync='adminDrawerMini'
      mini-variant-width='72'
      width='288'
      )
      //- Botão de colapso (<) posicionado na borda externa
      button.admin-sidebar__toggle.d-none.d-md-flex(
        @click='adminDrawerMini = !adminDrawerMini'
        :title='adminDrawerMini ? "Expandir menu" : "Recolher menu"'
        type='button'
      )
        v-icon.admin-sidebar__toggle-icon(:class='{ "is-rotated": adminDrawerMini }' size='12') mdi-chevron-left

      //- Header do Sidebar: Logo Detran-MG oficial em branco (alinhada à esquerda)
      .admin-sidebar__header-row(:class='{ "is-mini": adminDrawerMini }')
        a.detran-sidebar__logo(
          href='/'
          title='Ir para a Intranet Detran-MG'
        )
          img.detran-sidebar__logo-img(
            v-if='!adminDrawerMini'
            src='/_assets/img/detran-logo-white.png'
            alt='Detran-MG'
          )
          .detran-mini-brand-box(v-else, title='Intranet Detran-MG')
            v-icon(size='22', color='white') mdi-car-estate

      //- Lista de Navegação com rolagem interna
      vue-scroll.admin-sidebar__scroll(:ops='scrollStyle')
        v-list.radius-0.detran-admin-nav-list(dense, nav)
          p.detran-sidebar__section-label(v-if='!adminDrawerMini') PRINCIPAL
          v-list-item(to='/dashboard', active-class='glass-active')
            v-list-item-avatar(size='24', tile): v-icon mdi-view-dashboard-variant
            v-list-item-title {{ $t('admin:dashboard.title') }}

          template(v-if='hasPermission([`manage:system`, `manage:navigation`, `write:pages`, `manage:pages`, `delete:pages`])')
            p.detran-sidebar__section-label.mt-4(v-if='!adminDrawerMini') {{ $t('admin:nav.site') }}
            v-list-item(to='/general', active-class='glass-active', v-if='hasPermission(`manage:system`)')
              v-list-item-avatar(size='24', tile): v-icon mdi-widgets
              v-list-item-title {{ $t('admin:general.title') }}
            v-list-item(to='/locale', active-class='glass-active', v-if='hasPermission(`manage:system`)')
              v-list-item-avatar(size='24', tile): v-icon mdi-web
              v-list-item-title {{ $t('admin:locale.title') }}
            v-list-item(to='/navigation', active-class='glass-active', v-if='hasPermission([`manage:system`, `manage:navigation`])')
              v-list-item-avatar(size='24', tile): v-icon mdi-near-me
              v-list-item-title {{ $t('admin:navigation.title') }}
            v-list-item(to='/pages', active-class='glass-active', v-if='hasPermission([`manage:system`, `write:pages`, `manage:pages`, `delete:pages`])')
              v-list-item-avatar(size='24', tile): v-icon mdi-file-document-outline
              v-list-item-title {{ $t('admin:pages.title') }}
              v-list-item-action(style='min-width:auto;', v-if='!adminDrawerMini')
                v-chip.detran-chip-count(x-small) {{ info.pagesTotal }}
            v-list-item(to='/tags', active-class='glass-active', v-if='hasPermission([`manage:system`])')
              v-list-item-avatar(size='24', tile): v-icon mdi-tag-multiple
              v-list-item-title {{ $t('admin:tags.title') }}
              v-list-item-action(style='min-width:auto;', v-if='!adminDrawerMini')
                v-chip.detran-chip-count(x-small) {{ info.tagsTotal }}
            v-list-item(to='/theme', active-class='glass-active', v-if='hasPermission([`manage:system`, `manage:theme`])')
              v-list-item-avatar(size='24', tile): v-icon mdi-palette-outline
              v-list-item-title {{ $t('admin:theme.title') }}

          template(v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`, `manage:users`, `write:users`])')
            p.detran-sidebar__section-label.mt-4(v-if='!adminDrawerMini') {{ $t('admin:nav.users') }}
            v-list-item(to='/groups', active-class='glass-active', v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`])')
              v-list-item-avatar(size='24', tile): v-icon mdi-account-group
              v-list-item-title {{ $t('admin:groups.title') }}
              v-list-item-action(style='min-width:auto;', v-if='!adminDrawerMini')
                v-chip.detran-chip-count(x-small) {{ info.groupsTotal }}
            v-list-item(to='/users', active-class='glass-active', v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`, `manage:users`, `write:users`])')
              v-list-item-avatar(size='24', tile): v-icon mdi-account-box
              v-list-item-title {{ $t('admin:users.title') }}
              v-list-item-action(style='min-width:auto;', v-if='!adminDrawerMini')
                v-chip.detran-chip-count(x-small) {{ info.usersTotal }}

          template(v-if='hasPermission(`manage:system`)')
            p.detran-sidebar__section-label.mt-4(v-if='!adminDrawerMini') {{ $t('admin:nav.modules') }}
            v-list-item(to='/analytics', active-class='glass-active')
              v-list-item-avatar(size='24', tile): v-icon mdi-chart-timeline-variant
              v-list-item-title {{ $t('admin:analytics.title') }}
            v-list-item(to='/auth', active-class='glass-active')
              v-list-item-avatar(size='24', tile): v-icon mdi-lock-outline
              v-list-item-title {{ $t('admin:auth.title') }}
            v-list-item(to='/comments', active-class='glass-active')
              v-list-item-avatar(size='24', tile): v-icon mdi-comment-text-outline
              v-list-item-title {{ $t('admin:comments.title') }}
            v-list-item(to='/rendering', active-class='glass-active')
              v-list-item-avatar(size='24', tile): v-icon mdi-cogs
              v-list-item-title {{ $t('admin:rendering.title') }}
            v-list-item(to='/search', active-class='glass-active')
              v-list-item-avatar(size='24', tile): v-icon mdi-cloud-search-outline
              v-list-item-title {{ $t('admin:search.title') }}
            v-list-item(to='/storage', active-class='glass-active')
              v-list-item-avatar(size='24', tile): v-icon mdi-harddisk
              v-list-item-title {{ $t('admin:storage.title') }}
            v-list-item(to='/workflow-policies', active-class='glass-active')
              v-list-item-avatar(size='24', tile): v-icon(color='#288b4a') mdi-source-branch
              v-list-item-title Workflow Detran-MG
          template(v-if='hasPermission([`manage:system`, `manage:api`])')
            p.detran-sidebar__section-label.mt-4(v-if='!adminDrawerMini') {{ $t('admin:nav.system') }}
            v-list-item(to='/api', active-class='glass-active', v-if='hasPermission([`manage:system`, `manage:api`])')
              v-list-item-avatar(size='24', tile): v-icon mdi-call-split
              v-list-item-title {{ $t('admin:api.title') }}
            v-list-item(to='/mail', active-class='glass-active', v-if='hasPermission(`manage:system`)')
              v-list-item-avatar(size='24', tile): v-icon mdi-email-multiple-outline
              v-list-item-title {{ $t('admin:mail.title') }}
            v-list-item(to='/security', active-class='glass-active', v-if='hasPermission(`manage:system`)')
              v-list-item-avatar(size='24', tile): v-icon mdi-lock-check
              v-list-item-title {{ $t('admin:security.title') }}
            v-list-item(to='/ssl', active-class='glass-active', v-if='hasPermission(`manage:system`)')
              v-list-item-avatar(size='24', tile): v-icon mdi-cloud-lock-outline
              v-list-item-title {{ $t('admin:ssl.title') }}
            v-list-item(to='/system', active-class='glass-active', v-if='hasPermission(`manage:system`)')
              v-list-item-avatar(size='24', tile): v-icon mdi-tune
              v-list-item-title {{ $t('admin:system.title') }}
            v-list-item(to='/utilities', active-class='glass-active', v-if='hasPermission(`manage:system`)')
              v-list-item-avatar(size='24', tile): v-icon mdi-wrench-outline
              v-list-item-title {{ $t('admin:utilities.title') }}
            v-list-group(
              to='/dev'
              no-action
              v-if='hasPermission([`manage:system`, `manage:api`])'
              )
              v-list-item(slot='activator')
                v-list-item-avatar(size='24', tile): v-icon mdi-dev-to
                v-list-item-title {{ $t('admin:dev.title') }}

              v-list-item(to='/dev-flags', active-class='glass-active')
                v-list-item-title {{ $t('admin:dev.flags.title') }}
              v-list-item(href='/graphql', target='_blank')
                v-list-item-title GraphQL

    //- Área Principal de Conteúdo
    v-main.admin-main
      //- Header Superior Flutuante do Admin (mesmo padrão glassmorphic do portal)
      header.detran-admin-topbar.d-flex.align-center.justify-space-between.px-8.py-4
        .detran-admin-topbar__left.d-flex.align-center
          v-btn.d-md-none.mr-3(icon, small, @click='adminDrawerShown = !adminDrawerShown', aria-label='Menu')
            v-icon(size='22', color='#206e3b') mdi-menu
          .detran-header-nav-badge.mr-3
            v-icon(size='18', color='#288b4a') mdi-shield-crown-outline
          .detran-breadcrumbs-text
            span.detran-bc-parent PAINEL ADMINISTRATIVO
            span.detran-bc-sep /
            span.detran-bc-current {{ currentSectionTitle }}
        .detran-admin-topbar__right.d-flex.align-center(style='gap: 10px;')
          a.detran-btn-portal-pill(href='/', title='Retornar ao Portal da Intranet')
            v-icon(size='16', color='#206e3b').mr-2 mdi-arrow-left
            span.d-none.d-sm-inline Voltar ao Portal

          //- Central de Notificações ("Novidades da Intranet")
          v-menu(
            v-if='isAuthenticated'
            offset-y
            bottom
            left
            transition='slide-y-transition'
            min-width='380'
            max-width='420'
            :close-on-content-click='false'
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
                v-btn(x-small, text, dark, class='caption text-none', @click='markAllNotificationsRead') Marcar lidas
              v-tabs(v-model='notifTab', grow, height='36', color='#1b6535')
                v-tab.caption Todas ({{ workflowPendingCount }})
                v-tab.caption Validações
                v-tab.caption Publicações
              v-card-text.pa-0(style='max-height: 320px; overflow-y: auto;')
                template(v-if='filteredNotificationTasks.length > 0')
                  v-list.py-0.dense
                    v-list-item(
                      v-for='task in filteredNotificationTasks'
                      :key='task.id'
                      :href='"/w/review/" + task.id + (task.state === "changes_requested" ? "?mode=edit&edit=1" : (task.state === "awaiting_approval" ? "?mode=clean" : "?mode=suggest"))'
                      @click='markNotificationRead(task)'
                      class='py-2 px-3'
                      :style='isNotificationRead(task) ? "opacity: 0.72; background: #f8fafc;" : "background: #ffffff;"'
                    )
                      v-list-item-avatar.mr-3(size='32', :color='task.state === "changes_requested" ? "#fff7ed" : (task.state === "published" ? "#f0fdf4" : "#eff6ff")')
                        v-icon(size='18', :color='task.state === "changes_requested" ? "#d97706" : (task.state === "published" ? "#16a34a" : "#2563eb")')
                          | {{ task.state === "changes_requested" ? "mdi-undo-variant" : (task.state === "published" ? "mdi-check-decagram" : "mdi-shield-check") }}
                      v-list-item-content
                        .d-flex.align-center.justify-space-between
                          span.text-caption.font-weight-bold.text-uppercase(:class='task.state === "changes_requested" ? "amber--text text--darken-4" : (task.state === "published" ? "green--text text--darken-3" : "blue--text text--darken-3")')
                            | {{ task.state === "changes_requested" ? "Devolvido para Ajustes" : (task.state === "published" ? "Publicação Homologada" : "Validação Pendente") }}
                          span.text-caption(:class='!isNotificationRead(task) ? (task.state === "changes_requested" ? "amber--text text--darken-4 font-weight-bold" : "blue--text text--darken-3 font-weight-bold") : "grey--text"')
                            | {{ !isNotificationRead(task) ? (task.state === "changes_requested" ? "Ajustar" : (task.state === "published" ? "Nova" : "Pendente")) : "Lida" }}
                        .caption.font-weight-bold.text-truncate {{ task.title || task.path }}
                        .text-caption.grey--text.text--darken-1.text-truncate
                          | {{ task.state === "changes_requested" ? (task.lastComment ? "Motivo: " + task.lastComment : "Revisor solicitou ajustes") : (task.state === "published" ? "Documento publicado e ativo no portal" : ("Autor: " + (task.authorName || "Servidor"))) }}
                template(v-else)
                  .pa-6.text-center.grey--text
                    v-icon.mb-2(size='36', color='grey lighten-2') mdi-bell-check-outline
                    .caption Nenhuma validação pendente no momento
              v-divider
              v-card-actions.pa-2.grey.lighten-4.d-flex.justify-center
                v-btn(text, small, color='#1b6535', href='/w', class='caption font-weight-bold text-none')
                  span Ver painel completo de governança
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

      .admin-content-area.px-8.pb-6
        transition(name='admin-router')
          router-view

      nav-footer

    notify
    search-results
</template>

<script>
import _ from 'lodash'
import VueRouter from 'vue-router'
import { get, sync } from 'vuex-pathify'
import gql from 'graphql-tag'

import statsQuery from 'gql/admin/dashboard/dashboard-query-stats.gql'
import adminStore from '../store/admin'
import { broadcastLogout } from '../modules/auth-sync'

/* global WIKI */

WIKI.$store.registerModule('admin', adminStore)

const router = new VueRouter({
  mode: 'history',
  base: '/a',
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-dashboard.vue') },
    { path: '/general', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-general.vue') },
    { path: '/locale', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-locale.vue') },
    { path: '/navigation', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-navigation.vue') },
    { path: '/pages', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-pages.vue') },
    { path: '/pages/:id(\\d+)', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-pages-edit.vue') },
    { path: '/pages/visualize', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-pages-visualize.vue') },
    { path: '/tags', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-tags.vue') },
    { path: '/theme', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-theme.vue') },
    { path: '/groups', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups.vue') },
    { path: '/groups/:id(\\d+)', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups-edit.vue') },
    { path: '/users', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-users.vue') },
    { path: '/users/:id(\\d+)', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-users-edit.vue') },
    { path: '/analytics', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-analytics.vue') },
    { path: '/auth', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-auth.vue') },
    { path: '/comments', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-comments.vue') },
    { path: '/rendering', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-rendering.vue') },
    { path: '/editor', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-editor.vue') },
    { path: '/extensions', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-extensions.vue') },
    { path: '/logging', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-logging.vue') },
    { path: '/search', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-search.vue') },
    { path: '/storage', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-storage.vue') },
    { path: '/api', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-api.vue') },
    { path: '/mail', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-mail.vue') },
    { path: '/security', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-security.vue') },
    { path: '/ssl', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-ssl.vue') },
    { path: '/system', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-system.vue') },
    { path: '/utilities', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-utilities.vue') },
    { path: '/webhooks', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-webhooks.vue') },
    { path: '/workflow-policies', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-workflow-policies.vue') },
    { path: '/dev-flags', component: () => import(/* webpackChunkName: "admin-dev" */ './admin/admin-dev-flags.vue') },
    { path: '/contribute', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-contribute.vue') }
  ]
})

export default {
  i18nOptions: { namespaces: 'admin' },
  data() {
    return {
      adminDrawerShown: true,
      adminDrawerMini: false,
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollY: 0,
          initialScrollX: 0,
          scrollingX: false,
          easing: 'easeOutQuad',
          speed: 1000,
          verticalNativeBarPos: this.$vuetify.rtl ? `left` : `right`
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
      },
      avatarFailed: false,
      internalApps: [],
      workflowPendingTasks: [],
      workflowRecentTasks: [],
      workflowPendingCount: 0,
      notifTab: 0
    }
  },
  computed: {
    info: sync('admin/info'),
    permissions: get('user/permissions'),
    userName: get('user/name'),
    userEmail: get('user/email'),
    pictureUrl: get('user/pictureUrl'),
    isAuthenticated: get('user/authenticated'),
    hasUserAvatar () {
      return Boolean(this.pictureUrl && this.pictureUrl.length > 0 && !this.avatarFailed)
    },
    userAvatar () {
      return this.pictureUrl || ''
    },
    userInitials () {
      if (!this.userName) return 'AD'
      const parts = this.userName.trim().split(' ')
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    },
    readStorageKey () {
      const uid = (this.$store && this.$store.state && this.$store.state.user && this.$store.state.user.id) || 0
      return `detran_wf_read_notifs_${uid}`
    },
    allNotificationTasks () {
      const map = new Map()
      for (const t of (this.workflowPendingTasks || [])) {
        if (t && t.id) map.set(t.id, { ...t, isPending: true })
      }
      for (const t of (this.workflowRecentTasks || [])) {
        if (t && t.id && !map.has(t.id)) map.set(t.id, { ...t, isPending: false })
      }
      const merged = Array.from(map.values())
      merged.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      return merged
    },
    filteredNotificationTasks () {
      const list = this.allNotificationTasks
      if (this.notifTab === 1) {
        return list.filter(t => t.state !== 'published')
      }
      if (this.notifTab === 2) {
        return list.filter(t => t.state === 'published' || t.type === 'news')
      }
      return list
    },
    currentSectionTitle () {
      const path = this.$route.path
      const titles = {
        '/dashboard': 'Dashboard',
        '/general': 'Configurações Gerais',
        '/locale': 'Localização e Idiomas',
        '/navigation': 'Navegação e Menus',
        '/pages': 'Gestão de Páginas',
        '/tags': 'Etiquetas (Tags)',
        '/theme': 'Personalização do Tema',
        '/groups': 'Grupos e Permissões',
        '/users': 'Contas de Usuários',
        '/analytics': 'Métricas e Analytics',
        '/auth': 'Autenticação e Acesso',
        '/comments': 'Moderação de Comentários',
        '/rendering': 'Mecanismos de Renderização',
        '/search': 'Mecanismo de Busca',
        '/storage': 'Armazenamento de Arquivos',
        '/api': 'Acesso à API GraphQL',
        '/mail': 'Configuração de E-mail',
        '/security': 'Políticas de Segurança',
        '/ssl': 'Certificados SSL / TLS',
        '/system': 'Informações do Sistema',
        '/utilities': 'Utilitários e Manutenção'
      }
      return titles[path] || 'Painel de Controle'
    }
  },
  router,
  created() {
    this.$store.commit('page/SET_MODE', 'admin')
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
    hasPermission(prm) {
      if (_.isArray(prm)) {
        return _.some(prm, p => {
          return _.includes(this.permissions, p)
        })
      } else {
        return _.includes(this.permissions, prm)
      }
    },
    getReadNotificationsMap () {
      try {
        return JSON.parse(localStorage.getItem(this.readStorageKey) || '{}')
      } catch (e) {
        return {}
      }
    },
    isNotificationRead (task) {
      if (!task || !task.id) return true
      const readMap = this.getReadNotificationsMap()
      const readTimestamp = readMap[task.id]
      if (!readTimestamp) return false
      if (task.updatedAt) {
        return new Date(readTimestamp).getTime() >= new Date(task.updatedAt).getTime()
      }
      return true
    },
    markNotificationRead (task) {
      if (!task || !task.id) return
      const readMap = this.getReadNotificationsMap()
      readMap[task.id] = task.updatedAt || new Date().toISOString()
      try {
        localStorage.setItem(this.readStorageKey, JSON.stringify(readMap))
      } catch (e) {}
      this.updateUnreadCount()
    },
    markAllNotificationsRead () {
      const readMap = this.getReadNotificationsMap()
      const allTasks = this.allNotificationTasks
      for (const t of allTasks) {
        if (t && t.id) {
          readMap[t.id] = t.updatedAt || new Date().toISOString()
        }
      }
      try {
        localStorage.setItem(this.readStorageKey, JSON.stringify(readMap))
      } catch (e) {}
      this.workflowPendingCount = 0
    },
    updateUnreadCount () {
      const unreadPending = (this.workflowPendingTasks || []).filter(t => !this.isNotificationRead(t))
      this.workflowPendingCount = unreadPending.length
    },
    goToProfile () {
      window.location.assign('/p')
    },
    goToAdmin () {
      this.$router.push('/dashboard').catch(() => {})
    },
    doLogout () {
      const uid = (this.$store && this.$store.state && this.$store.state.user) ? this.$store.state.user.id : 0
      broadcastLogout(uid)
      if (this.$store) {
        this.$store.commit('user/CLEAR_AUTH')
      }
      window.location.assign('/logout')
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
                drafts(limit: 15) {
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
        const recent = (result && result.data && result.data.workflow && result.data.workflow.drafts) || []
        this.workflowPendingTasks = tasks
        this.workflowRecentTasks = recent
        this.updateUnreadCount()
      } catch (e) {}
    }
  },
  apollo: {
    info: {
      query: statsQuery,
      fetchPolicy: 'network-only',
      manual: true,
      result({ data, loading, networkStatus }) {
        this.info = data.system.info
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-stats-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
@import '../themes/detran/scss/variables';

// =============================================================================
// DETRAN-MG — Layout Administrativo Integral
// Alinhado rigorosamente a design_system.html
// =============================================================================

// --- Transição de Rotas ---
.admin-router {
  &-enter-active, &-leave-active {
    transition: opacity .2s ease;
    opacity: 1;
  }
  &-enter-active {
    transition-delay: .15s;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }
}

// --- Sidebar Institucional do Detran-MG ---
.admin-sidebar {
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

  // Header do Sidebar com Logo centralizada
  .admin-sidebar__header-row {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 1rem;
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
    justify-content: center;
    padding: 0;
    overflow: hidden;
    transition: padding 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    width: 100%;
    margin: 0 auto;
    text-align: center;

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
    margin: 0 auto;
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

  // Estilos adaptados para o modo mini-variant recolhido
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

  // Botão Toggle posicionado na borda externa (idêntico ao portal)
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

  // Seções da Sidebar
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

  // Itens de navegação — padronizados com o Portal
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

      .v-list-item__title {
        color: #ffffff !important;
      }
      .v-icon {
        color: #ffffff !important;
        transform: scale(1.1);
      }
    }

    // Item ativo — Glassmorphism idêntico ao portal
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

      .v-icon {
        color: #ffffff !important;
      }

      &::before {
        display: none !important;
      }
    }
  }

  // Chips de contagem
  .detran-chip-count {
    background-color: rgba(255, 255, 255, 0.15) !important;
    color: #ffffff !important;
    font-size: 0.6875rem !important;
    font-weight: 600 !important;
    height: 18px !important;
    padding: 0 6px !important;
    border-radius: 9999px !important;
  }

  // Grupos expansíveis
  .v-list-group {
    margin: 2px 0 !important;

    .v-list-group__header {
      border-radius: 12px !important;
      padding: 0.625rem 0.75rem !important;
      min-height: 42px !important;
      color: #cce0d2 !important;

      &:hover {
        background-color: rgba(255, 255, 255, 0.10) !important;
      }
    }
    .v-list-group__header__append-icon .v-icon {
      color: rgba(255, 255, 255, 0.40) !important;
      font-size: 16px !important;
    }
    .v-list-group__items .v-list-item {
      padding-left: 1.5rem !important;
    }
  }

  .v-list {
    background: transparent !important;
    padding: 0.5rem 1rem !important;
  }
}

// --- Área de Conteúdo Principal (curvatura elegante reduzida pela metade: 1.25rem = 20px) ---
.admin-main {
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

  // Rodapé perfeitamente integrado no canvas branco, idêntico à visão geral
  .detran-footer {
    width: 100%;
    margin-top: auto;
    background: transparent !important;
    border-top: 1px solid rgba(226, 232, 240, 0.85) !important;
    padding: 1.5rem 2rem 1.25rem;
    z-index: 25;
    box-shadow: none !important;

    &__content {
      color: $slate-500 !important;
      font-size: 0.8125rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    &__sep {
      color: $slate-300 !important;
    }

    &__innovation {
      color: $detran-700 !important;
      font-weight: 600;
    }

    &__link, a {
      color: $detran-600 !important;
      font-weight: 500;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.admin-content-area {
  flex: 1 0 auto;
}

// --- Topbar Flutuante do Admin ---
.detran-admin-topbar {
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

      .v-icon {
        color: #ffffff !important;
      }
    }
  }
}

// Botões de ação do topo (notificações e apps)
.detran-header__action-btn {
  @include glass-panel;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: $radius-lg;
  border: 1px solid rgba(226, 232, 240, 0.85);
  box-shadow: $shadow-float;
  color: #475569;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.95);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;

  &:hover {
    border-color: $detran-400;
    box-shadow: 0 4px 12px rgba(40, 139, 74, 0.18);
    transform: translateY(-1px);
    color: #1e293b;
  }
}

// Botão de avatar do usuário no topo
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

.detran-apps-popover-menu {
  border-radius: 1rem !important;
  box-shadow: 0 18px 40px -10px rgba(15, 23, 42, 0.22), 0 4px 14px rgba(15, 23, 42, 0.08) !important;
  border: 1px solid rgba(226, 232, 240, 0.9);
  overflow: hidden !important;
  margin-top: 8px;
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
    margin: 2px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__body {
    padding: 0.5rem;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.625rem;
    text-decoration: none !important;
    transition: background 0.15s ease, border-color 0.15s ease;
    border: 1px solid transparent;
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;

    &:hover {
      background: #f1f5f9;
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

  &__divider {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 0.375rem 0;
  }
}

@media (max-width: 959px) {
  .admin-main {
    > .v-main__wrap {
      border-top-left-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      box-shadow: none !important;
    }
  }
  .detran-admin-topbar {
    border-top-left-radius: 0 !important;
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
  .admin-content-area {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
}

// =============================================================================
// REGRAS GLOBAIS DE ESTILIZAÇÃO DO PAINEL ADMIN (Detran Corporate DS)
// Garante que TODOS os 22 itens de menu obedeçam ao novo padrão visual
// =============================================================================

.v-application.admin {
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

  * {
    font-family: $font-family-base;
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

  // Cabeçalhos de card no admin — limpos, brancos, sem cores sólidas berrantes
  .v-toolbar.teal,
  .v-toolbar[color*="teal"],
  .v-toolbar.primary,
  .v-toolbar[color*="primary"],
  .v-toolbar.blue,
  .v-toolbar[color*="blue"],
  .theme--dark.v-toolbar,
  .v-toolbar.theme--dark,
  .v-toolbar {
    background-color: #ffffff !important;
    background-image: none !important;
    border-bottom: 1px solid #f1f5f9 !important;
    box-shadow: none !important;
    color: #1e293b !important;

    .subtitle-1,
    .v-toolbar__title,
    .overline,
    .headline {
      color: #1e293b !important;
      font-weight: 600 !important;
      font-family: $font-family-base !important;
    }

    .v-icon {
      color: #288b4a !important;
    }

    .v-btn {
      color: #334155 !important;
      border-color: #cbd5e1 !important;
    }
  }

  // Títulos de cabeçalho unificados
  .admin-header-title {
    .headline,
    .headline.primary--text,
    .headline.blue--text,
    .headline.teal--text {
      color: #1e293b !important;
      font-weight: 700 !important;
    }
  }

  // Barra de filtros em tabelas (usuários, páginas, grupos)
  .detran-filter-bar,
  .v-card > .d-flex.align-center:first-child {
    background-color: #f8fafc !important;
    border-bottom: 1px solid #f1f5f9;

    .v-input__slot {
      background-color: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 10px !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
    }
  }

  // Botões de Ação Primária Detran
  .theme--light.v-btn.primary,
  .theme--light.v-btn.success,
  .v-btn--depressed.primary,
  .v-btn--contained.primary,
  .v-btn.primary {
    background: linear-gradient(135deg, #33a65b 0%, #288b4a 100%) !important;
    background-color: #33a65b !important;
    color: #ffffff !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 14px rgba(51, 166, 91, 0.35) !important;
    border: none !important;
    text-transform: none !important;
    letter-spacing: 0.01em !important;

    &:hover {
      background: linear-gradient(135deg, #288b4a 0%, #206e3b 100%) !important;
      box-shadow: 0 6px 18px rgba(51, 166, 91, 0.45) !important;
      transform: translateY(-1px);
    }

    .v-icon {
      color: #ffffff !important;
    }
  }

  // Switches Detran
  .v-input--switch.v-input--is-label-active,
  .v-input--switch.theme--light.v-input--is-label-active {
    .v-input--switch__track {
      background-color: rgba(51, 166, 91, 0.45) !important;
    }
    .v-input--switch__thumb {
      background-color: #33a65b !important;
    }
  }

  // Inputs e Textareas
  .v-text-field--outlined,
  .v-select--outlined,
  .v-textarea--outlined {
    fieldset {
      border-color: #e2e8f0 !important;
      border-radius: 10px !important;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    &.v-input--is-focused fieldset {
      border-color: #33a65b !important;
      box-shadow: 0 0 0 3px rgba(51, 166, 91, 0.15) !important;
    }
    .v-label--active {
      color: #33a65b !important;
    }
  }

  // Tabelas de Dados
  .v-data-table {
    background-color: transparent !important;

    th {
      background-color: #f8fafc !important;
      color: #64748b !important;
      font-weight: 700 !important;
      font-size: 0.75rem !important;
      text-transform: uppercase !important;
      letter-spacing: 0.06em !important;
      border-bottom: 1px solid #e2e8f0 !important;
    }

    td {
      border-bottom: 1px solid #f1f5f9 !important;
      color: #1e293b !important;
      font-size: 0.875rem !important;
    }

    tr.is-clickable,
    tr:hover:not(.v-data-table__expanded__content) {
      cursor: pointer;
      transition: background-color 0.15s ease;
      &:hover {
        background-color: rgba(51, 166, 91, 0.04) !important;
      }
    }
  }

  // Banners e Callouts
  .v-card-info,
  .v-card-info.blue,
  .v-card-info[color*="blue"] {
    background-color: #f2fbf5 !important;
    border-left: 4px solid #33a65b !important;
    color: #206e3b !important;
    border-radius: 10px !important;
    padding: 14px 18px !important;

    a {
      color: #206e3b !important;
      font-weight: 600 !important;
      text-decoration: underline !important;
    }
  }

  // Paginação
  .v-pagination {
    .v-pagination__item--active {
      background-color: #33a65b !important;
      border-color: #33a65b !important;
      color: #ffffff !important;
      box-shadow: 0 2px 6px rgba(51, 166, 91, 0.3) !important;
    }
  }
}

// --- Cabeçalho Padrão das Telas Administrativas ---
.admin-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px !important;

  // Transforma os ícones SVG legados em elegantes badges squircle esmeralda do Detran-MG
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
    .headline {
      font-family: $font-family-base !important;
      font-weight: 700 !important;
      font-size: 1.625rem !important;
      letter-spacing: -0.02em !important;
      color: #1e293b !important;
      line-height: 1.25 !important;

      &.primary--text,
      &.blue--text,
      &.teal--text {
        color: #1e293b !important;
      }
    }

    .subtitle-1 {
      font-family: $font-family-base !important;
      font-size: 0.9375rem !important;
      color: #64748b !important;
      margin-top: 2px !important;
    }
  }
}
</style>

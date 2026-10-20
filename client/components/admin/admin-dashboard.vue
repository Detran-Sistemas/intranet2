<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header.pb-2
          .detran-icon-badge.mr-4
            v-icon(size='32', color='white') mdi-view-dashboard-outline
          .admin-header-title
            .headline.animated.fadeInLeft {{ $t('admin:dashboard.title') }}
            .subtitle-1.animated.fadeInLeft.wait-p2s {{ $t('admin:dashboard.subtitle') }}

      //- KPI Cards em estilo Detran (cartões brancos com badges coloridos suaves)
      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.detran-stat-card.animated.fadeInUp
          v-card-text.d-flex.align-center.pa-5
            .detran-stat-badge.detran-stat-green.mr-4
              v-icon(size='28', color='#288b4a') mdi-file-document-outline
            div
              .detran-stat-label {{$t('admin:dashboard.pages')}}
              animated-number.detran-stat-number(
                :value='info.pagesTotal'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )

      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.detran-stat-card.animated.fadeInUp.wait-p2s
          v-card-text.d-flex.align-center.pa-5
            .detran-stat-badge.detran-stat-blue.mr-4
              v-icon(size='28', color='#2563eb') mdi-account-outline
            div
              .detran-stat-label {{$t('admin:dashboard.users')}}
              animated-number.detran-stat-number(
                :value='info.usersTotal'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )

      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.detran-stat-card.animated.fadeInUp.wait-p4s
          v-card-text.d-flex.align-center.pa-5
            .detran-stat-badge.detran-stat-amber.mr-4
              v-icon(size='28', color='#d97706') mdi-account-group-outline
            div
              .detran-stat-label {{$t('admin:dashboard.groups')}}
              animated-number.detran-stat-number(
                :value='info.groupsTotal'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )

      v-flex(xs12 md6 lg12 xl3 d-flex)
        v-card.detran-stat-card.animated.fadeInUp.wait-p6s
          v-card-text.d-flex.align-center.pa-5
            .detran-stat-badge.detran-stat-emerald.mr-4
              v-icon(size='28', color='#059669') mdi-shield-check-outline
            div
              .detran-stat-label STATUS DO SISTEMA
              .detran-stat-status Operacional
              .caption.text-muted(v-if='isLatestVersion') Versão {{info.currentVersion}} (Estável)
              .caption.text-muted(v-else) Atualização: {{info.latestVersion}}

      //- Tabela: Páginas Recentes
      v-flex(xs12, xl6)
        v-card.animated.fadeInUp.wait-p2s.detran-card
          .detran-card-header.d-flex.align-center.px-5.py-4
            .detran-card-header-icon.mr-3
              v-icon(size='18', color='#288b4a') mdi-clock-outline
            .detran-card-header-title {{$t('admin:dashboard.recentPages')}}
          v-data-table.pb-2(
            :items='recentPages'
            :headers='recentPagesHeaders'
            :loading='recentPagesLoading'
            hide-default-footer
            hide-default-header
            )
            template(slot='item', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push(`/pages/` + props.item.id)')
                td
                  .body-2: strong {{ props.item.title }}
                td.admin-pages-path
                  v-chip.detran-locale-chip(label, small) {{ props.item.locale }}
                  span.ml-2.caption.text-muted / {{ props.item.path }}
                td.text-right.caption.text-muted(width='250') {{ props.item.updatedAt | moment('calendar') }}

      //- Tabela: Últimos Logins
      v-flex(xs12, xl6)
        v-card.animated.fadeInUp.wait-p4s.detran-card
          .detran-card-header.d-flex.align-center.px-5.py-4
            .detran-card-header-icon.mr-3
              v-icon(size='18', color='#288b4a') mdi-account-clock-outline
            .detran-card-header-title {{$t('admin:dashboard.lastLogins')}}
          v-data-table.pb-2(
            :items='lastLogins'
            :headers='lastLoginsHeaders'
            :loading='lastLoginsLoading'
            hide-default-footer
            hide-default-header
            )
            template(slot='item', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push(`/users/` + props.item.id)')
                td
                  .body-2: strong {{ props.item.name }}
                td.text-right.caption.text-muted(width='250') {{ props.item.lastLoginAt | moment('calendar') }}

      //- Banner Institucional do Detran-MG (substitui o card legado de contribuição do Wiki.js)
      v-flex(xs12)
        v-card.detran-system-banner.animated.fadeInUp.wait-p4s.pa-6
          .d-flex.align-center
            .detran-system-banner-icon.mr-4
              v-icon(size='32', color='#206e3b') mdi-shield-account
            div
              .detran-system-banner-title Detran-MG • Intranet Corporativa
              .caption.detran-system-banner-desc Ambiente oficial de gestão do conhecimento, documentação técnica e procedimentos operacionais padronizados.
            v-spacer
            a.detran-btn-portal-pill(href='/')
              v-icon(size='16', color='#206e3b').mr-2 mdi-arrow-left
              span Acessar Portal
</template>

<script>
import _ from 'lodash'
import AnimatedNumber from 'animated-number-vue'
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import semverLte from 'semver/functions/lte'

/* global moment */

export default {
  components: {
    AnimatedNumber
  },
  data() {
    return {
      recentPages: [],
      recentPagesLoading: false,
      recentPagesHeaders: [
        { text: 'Title', value: 'title' },
        { text: 'Path', value: 'path' },
        { text: 'Last Updated', value: 'updatedAt', width: 250 }
      ],
      lastLogins: [],
      lastLoginsLoading: false,
      lastLoginsHeaders: [
        { text: 'User', value: 'displayName' },
        { text: 'Last Login', value: 'lastLoginAt', width: 250 }
      ]
    }
  },
  computed: {
    isLatestVersion() {
      if (this.info.latestVersion === 'n/a' || this.info.currentVersion === 'n/a') {
        return true
      } else {
        return semverLte(this.info.latestVersion, this.info.currentVersion)
      }
    },
    info: get('admin/info'),
    permissions: get('user/permissions')
  },
  methods: {
    round(val) { return Math.round(val) },
    hasPermission(prm) {
      if (_.isArray(prm)) {
        return _.some(prm, p => {
          return _.includes(this.permissions, p)
        })
      } else {
        return _.includes(this.permissions, prm)
      }
    }
  },
  apollo: {
    recentPages: {
      query: gql`
        query {
          pages {
            list(limit: 10, orderBy: UPDATED, orderByDirection: DESC) {
              id
              locale
              path
              title
              description
              contentType
              isPublished
              isPrivate
              privateNS
              createdAt
              updatedAt
            }
          }
        }
      `,
      update: (data) => data.pages.list,
      watchLoading (isLoading) {
        this.recentPagesLoading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-dashboard-recentpages')
      }
    },
    lastLogins: {
      query: gql`
        query {
          users {
            lastLogins {
              id
              name
              lastLoginAt
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => data.users.lastLogins,
      watchLoading (isLoading) {
        this.lastLoginsLoading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-dashboard-lastlogins')
      }
    }
  }
}
</script>

<style lang='scss'>
@import '../../themes/detran/scss/variables';

// =============================================================================
// DETRAN-MG — Admin Dashboard Styles
// =============================================================================

.detran-icon-badge {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, $detran-500 0%, $detran-700 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px -4px rgba($detran-500, 0.4);
}

.detran-stat-card {
  width: 100%;
  background-color: #ffffff !important;
  border-radius: 16px !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 24px -8px rgba(51, 166, 91, 0.15) !important;
  }
}

.detran-stat-badge {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.detran-stat-green {
    background-color: #f2fbf5;
    border: 1px solid #c3ebce;
  }
  &.detran-stat-blue {
    background-color: #eff6ff;
    border: 1px solid #bfdbfe;
  }
  &.detran-stat-amber {
    background-color: #fffbeb;
    border: 1px solid #fde68a;
  }
  &.detran-stat-emerald {
    background-color: #ecfdf5;
    border: 1px solid #a7f3d0;
  }
}

.detran-stat-label {
  font-family: $font-family-base;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 2px;
}

.detran-stat-number {
  font-family: $font-family-base;
  font-size: 1.875rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.detran-stat-status {
  font-family: $font-family-base;
  font-size: 1.125rem;
  font-weight: 700;
  color: #059669;
}

.detran-card {
  background: #ffffff !important;
  border-radius: 16px !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
}

.detran-card-header {
  border-bottom: 1px solid #f1f5f9;
  background-color: #ffffff;

  &-icon {
    width: 32px;
    height: 32px;
    background-color: #f2fbf5;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &-title {
    color: #1e293b;
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: $font-family-base;
  }
}

.detran-locale-chip {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  font-size: 11px !important;
  font-weight: 600 !important;
}

.detran-system-banner {
  background: linear-gradient(135deg, #f2fbf5 0%, #ffffff 100%) !important;
  border: 1px solid #c3ebce !important;
  border-left: 5px solid #33a65b !important;
  border-radius: 16px !important;

  &-icon {
    width: 52px;
    height: 52px;
    background-color: #e1f6e8;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &-title {
    color: #1e293b;
    font-size: 1.05rem;
    font-weight: 700;
  }

  &-desc {
    color: #475569;
    font-size: 0.875rem;
    margin-top: 2px;
  }
}

.detran-btn-portal-pill {
  display: inline-flex;
  align-items: center;
  padding: 8px 18px;
  background: #ffffff;
  border: 1px solid #c3ebce;
  border-radius: 12px;
  color: #206e3b;
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;

  &:hover {
    background: #33a65b;
    color: #ffffff;
    border-color: #33a65b;
    transform: translateY(-1px);

    .v-icon {
      color: #ffffff !important;
    }
  }
}
</style>

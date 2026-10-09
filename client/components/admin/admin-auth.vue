<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header.pb-2
          .detran-icon-badge.mr-4
            v-icon(size='36', color='white') mdi-shield-lock-outline
          .admin-header-title
            .headline.animated.fadeInLeft {{ $t('admin:auth.title') }}
            .subtitle-1.animated.fadeInLeft.wait-p4s {{ $t('admin:auth.subtitle') }}
          v-spacer
          v-tooltip(bottom)
            template(v-slot:activator='{ on }')
              v-btn.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/auth', target='_blank', v-on='on')
                v-icon mdi-help-circle-outline
            span Documentação
          v-tooltip(bottom)
            template(v-slot:activator='{ on }')
              v-btn.animated.fadeInDown.wait-p2s.mx-3(icon, outlined, color='grey', @click='refresh', v-on='on')
                v-icon mdi-refresh
            span Atualizar
          v-btn.animated.fadeInDown.detran-btn-apply(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp.detran-card
          .detran-card-header.d-flex.align-center.px-4.py-3
            .detran-card-header-icon.mr-2
              v-icon(size='18') mdi-shield-key-outline
            .detran-card-header-title {{$t('admin:auth.activeStrategies')}}
          v-list(two-line, dense).py-2.detran-strategy-list
            draggable(
              v-model='activeStrategies'
              handle='.is-handle'
              direction='vertical'
              )
              transition-group
                v-list-item(
                  v-for='(str, idx) in activeStrategies'
                  :key='str.key'
                  @click='selectedStrategy = str.key'
                  :class='selectedStrategy === str.key ? "detran-strategy-active" : "detran-strategy-inactive"'
                  )
                  v-list-item-avatar.is-handle(size='24')
                    v-icon(:color='selectedStrategy === str.key ? `success` : `grey`') mdi-drag-horizontal
                  v-list-item-content
                    v-list-item-title.body-2(:class='selectedStrategy === str.key ? `detran-strategy-title-active` : ``') {{ str.displayName }}
                    v-list-item-subtitle: .caption(:class='selectedStrategy === str.key ? `detran-strategy-sub-active` : ``') {{ str.strategy.title }}
                  v-list-item-avatar(v-if='selectedStrategy === str.key', size='24')
                    v-icon.animated.fadeInLeft(color='success', large) mdi-chevron-right
          v-card-chin.pa-3
            v-menu(offset-y, bottom, min-width='250px', max-width='550px', max-height='50vh', style='flex: 1 1;', center)
              template(v-slot:activator='{ on }')
                v-btn.detran-btn-primary(v-on='on', depressed, block, large)
                  v-icon(left) mdi-plus
                  span {{$t('admin:auth.addStrategy')}}
              v-list(dense)
                template(v-for='(str, idx) of strategies')
                  v-list-item(
                    :key='str.key'
                    :disabled='str.isDisabled'
                    @click='addStrategy(str)'
                    )
                    v-list-item-avatar(height='24', width='48', tile)
                      v-img(:src='str.logo', width='48px', height='24px', contain, :style='str.isDisabled ? `opacity: .25;` : ``')
                    v-list-item-content
                      v-list-item-title {{str.title}}
                      v-list-item-subtitle: .caption(:style='str.isDisabled ? `opacity: .4;` : ``') {{str.description}}
                  v-divider(v-if='idx < strategies.length - 1')

      v-flex(xs12, lg9)
        v-card.animated.fadeInUp.wait-p2s.detran-card
          .detran-card-header.d-flex.align-center.px-5.py-4
            .detran-card-header-icon.mr-3
              v-icon(size='20') {{ strategy.key === 'local' ? 'mdi-database-lock' : 'mdi-shield-account' }}
            .detran-card-header-title {{strategy.displayName}} #[span.detran-card-subtitle.ml-1 ({{strategy.strategy.title}})]
            v-spacer
            v-btn.detran-btn-delete(small, outlined, color='error', :disabled='strategy.key === `local`', @click='deleteStrategy()', v-if='strategy.key !== `local`')
              v-icon(left, size='16') mdi-delete-outline
              span {{$t('common:actions.delete')}}
          .detran-info-banner.mx-5.my-4.pa-4
            .d-flex.align-center
              .detran-info-badge.mr-3
                v-icon(size='22') {{ strategy.key === 'local' ? 'mdi-shield-check' : 'mdi-information-outline' }}
              div
                .detran-info-title.font-weight-bold {{ strategy.key === 'local' ? 'Autenticação Interna Detran-MG' : strategy.strategy.title }}
                .caption.detran-info-text {{ strategy.key === 'local' ? 'Autenticação nativa utilizando a base de dados corporativa do Detran-MG. As credenciais são criptografadas e protegidas segundo as normas de segurança institucional.' : strategy.strategy.description }}
                .caption.mt-1(v-if='strategy.key !== `local` && strategy.strategy.website'): a.detran-link(:href='strategy.strategy.website', target='_blank') {{strategy.strategy.website}}
              v-spacer
              .admin-providerlogo(v-if='strategy.key !== `local`')
                img(:src='strategy.strategy.logo', :alt='strategy.strategy.title')
          v-card-text.px-5
            .row
              .col-8
                v-text-field(
                  outlined
                  :label='$t(`admin:auth.displayName`)'
                  v-model='strategy.displayName'
                  prepend-icon='mdi-format-title'
                  :hint='$t(`admin:auth.displayNameHint`)'
                  persistent-hint
                  )
              .col-4
                v-switch.mt-1(
                  :label='$t(`admin:auth.strategyIsEnabled`)'
                  v-model='strategy.isEnabled'
                  color='success'
                  prepend-icon='mdi-power'
                  :hint='$t(`admin:auth.strategyIsEnabledHint`)'
                  persistent-hint
                  inset
                  :disabled='strategy.key === `local`'
                  )
            template(v-if='strategy.config && Object.keys(strategy.config).length > 0')
              v-divider.my-4
              .overline.my-4 {{$t('admin:auth.strategyConfiguration')}}
              .pr-3
                template(v-for='cfg in strategy.config')
                  v-select.mb-3(
                    v-if='cfg.value.type === "string" && cfg.value.enum'
                    outlined
                    :items='cfg.value.enum'
                    :key='cfg.key'
                    :label='cfg.value.title'
                    v-model='cfg.value.value'
                    prepend-icon='mdi-cog-box'
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    :class='cfg.value.hint ? "mb-2" : ""'
                    :style='cfg.value.maxWidth > 0 ? `max-width:` + cfg.value.maxWidth + `px;` : ``'
                  )
                  v-switch.mb-6(
                    v-else-if='cfg.value.type === "boolean"'
                    :key='cfg.key'
                    :label='cfg.value.title'
                    v-model='cfg.value.value'
                    color='success'
                    prepend-icon='mdi-cog-box'
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    inset
                    )
                  v-textarea.mb-3(
                    v-else-if='cfg.value.type === "string" && cfg.value.multiline'
                    outlined
                    :key='cfg.key'
                    :label='cfg.value.title'
                    v-model='cfg.value.value'
                    prepend-icon='mdi-cog-box'
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    :class='cfg.value.hint ? "mb-2" : ""'
                    )
                  v-text-field.mb-3(
                    v-else
                    outlined
                    :key='cfg.key'
                    :label='cfg.value.title'
                    v-model='cfg.value.value'
                    prepend-icon='mdi-cog-box'
                    :hint='cfg.value.hint ? cfg.value.hint : ""'
                    persistent-hint
                    :class='cfg.value.hint ? "mb-2" : ""'
                    :style='cfg.value.maxWidth > 0 ? `max-width:` + cfg.value.maxWidth + `px;` : ``'
                    )
            v-divider.my-4
            .overline.my-4 {{$t('admin:auth.registration')}}
            .pr-3
              v-switch.ml-3(
                v-model='strategy.selfRegistration'
                :label='$t(`admin:auth.selfRegistration`)'
                color='success'
                :hint='$t(`admin:auth.selfRegistrationHint`)'
                persistent-hint
                inset
              )
              v-combobox.ml-3.mt-5(
                :label='$t(`admin:auth.domainsWhitelist`)'
                v-model='strategy.domainWhitelist'
                prepend-icon='mdi-email-check-outline'
                outlined
                :disabled='!strategy.selfRegistration'
                :hint='$t(`admin:auth.domainsWhitelistHint`)'
                persistent-hint
                small-chips
                deletable-chips
                clearable
                multiple
                chips
                )
              v-autocomplete.mt-3.ml-3(
                outlined
                :disabled='!strategy.selfRegistration'
                :items='groups'
                item-text='name'
                item-value='id'
                :label='$t(`admin:auth.autoEnrollGroups`)'
                v-model='strategy.autoEnrollGroups'
                prepend-icon='mdi-account-group'
                :hint='$t(`admin:auth.autoEnrollGroupsHint`)'
                small-chips
                persistent-hint
                deletable-chips
                clearable
                multiple
                chips
                )

        v-card.mt-4.wiki-form.animated.fadeInUp.wait-p4s.detran-card(v-if='selectedStrategy !== `local`')
          .detran-card-header.d-flex.align-center.px-5.py-4
            .detran-card-header-icon.mr-3
              v-icon(size='20') mdi-link-variant
            .detran-card-header-title {{$t('admin:auth.configReference')}}
          v-card-text.px-5
            .body-2.text-muted {{$t('admin:auth.configReferenceSubtitle')}}
            v-alert.mt-3.radius-7(v-if='host.length < 8', color='red', outlined, :value='true', icon='mdi-alert')
              i18next(path='admin:auth.siteUrlNotSetup', tag='span')
                strong(place='siteUrl') {{$t('admin:general.siteUrl')}}
                strong(place='general') {{$t('admin:general.title')}}
            .pa-3.mt-3.radius-7.grey(v-else, :class='$vuetify.theme.dark ? `darken-3-d5` : `lighten-3`')
              .body-2: strong {{$t('admin:auth.allowedWebOrigins')}}
              .body-2 {{host}}
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.callbackUrl')}}
              .body-2 {{host}}/login/{{strategy.key}}/callback
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.loginUrl')}}
              .body-2 {{host}}/login
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.logoutUrl')}}
              .body-2 {{host}}
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.tokenEndpointAuthMethod')}}
              .body-2 HTTP-POST
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { v4 as uuid } from 'uuid'

import groupsQuery from 'gql/admin/auth/auth-query-groups.gql'
import hostQuery from 'gql/admin/auth/auth-query-host.gql'

import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  filters: {
    startCase(val) { return _.startCase(val) }
  },
  data() {
    return {
      groups: [],
      strategies: [],
      activeStrategies: [],
      selectedStrategy: '',
      host: '',
      strategy: {
        strategy: {}
      }
    }
  },
  watch: {
    selectedStrategy(newValue, oldValue) {
      this.strategy = _.find(this.activeStrategies, ['key', newValue]) || {}
    },
    activeStrategies(newValue, oldValue) {
      this.selectedStrategy = 'local'
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.strategies.refetch()
      await this.$apollo.queries.activeStrategies.refetch()
      this.$store.commit('showNotification', {
        message: this.$t('admin:auth.refreshSuccess'),
        style: 'success',
        icon: 'cached'
      })
    },
    addStrategy (str) {
      const newStr = {
        key: uuid(),
        strategy: str,
        config: str.props.map(c => ({
          key: c.key,
          value: {
            ...c,
            value: c.default
          }
        })),
        order: this.activeStrategies.length,
        isEnabled: true,
        displayName: str.title,
        selfRegistration: false,
        domainWhitelist: [],
        autoEnrollGroups: []
      }
      this.activeStrategies = [...this.activeStrategies, newStr]
      this.$nextTick(() => {
        this.selectedStrategy = newStr.key
      })
    },
    deleteStrategy () {
      this.activeStrategies = _.reject(this.activeStrategies, ['key', this.strategy.key])
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-auth-savestrategies')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation($strategies: [AuthenticationStrategyInput]!) {
              authentication {
                updateStrategies(strategies: $strategies) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            strategies: this.activeStrategies.map((str, idx) => ({
              key: str.key,
              strategyKey: str.strategy.key,
              displayName: str.displayName,
              order: idx,
              isEnabled: str.isEnabled,
              config: str.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })})),
              selfRegistration: str.selfRegistration,
              domainWhitelist: str.domainWhitelist,
              autoEnrollGroups: str.autoEnrollGroups
            }))
          }
        })
        if (_.get(resp, 'data.authentication.updateStrategies.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: this.$t('admin:auth.saveSuccess'),
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.authentication.updateStrategies.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-auth-savestrategies')
    }
  },
  apollo: {
    strategies: {
      query: gql`
        query {
          authentication {
            strategies {
              key
              title
              description
              isAvailable
              useForm
              logo
              website
              props {
                key
                value
              }
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.get(data, 'authentication.strategies', []).map(str => ({
        ...str,
        isDisabled: !str.isAvailable || str.key === `local`,
        props: _.sortBy(str.props.map(cfg => ({
          key: cfg.key,
          ...JSON.parse(cfg.value)
        })), [t => t.order])
      })),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-strategies-refresh')
      }
    },
    activeStrategies: {
      query: gql`
        query {
          authentication {
            activeStrategies {
              key
              strategy {
                key
                title
                description
                useForm
                logo
                website
              }
              config {
                key
                value
              }
              order
              isEnabled
              displayName
              selfRegistration
              domainWhitelist
              autoEnrollGroups
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.sortBy(_.get(data, 'authentication.activeStrategies', []).map(str => ({
        ...str,
        config: _.sortBy(str.config.map(cfg => ({
          ...cfg,
          value: JSON.parse(cfg.value)
        })), [t => t.value.order])
      })), ['order']),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-activestrategies-refresh')
      }
    },
    groups: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.groups.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-groups-refresh')
      }
    },
    host: {
      query: hostQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.site.config.host),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-host-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
@import '../../themes/detran/scss/variables';

// =============================================================================
// DETRAN-MG — Admin Authentication Page Styling
// =============================================================================

.detran-icon-badge {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, $detran-500 0%, $detran-700 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px -4px rgba($detran-500, 0.4);
}

.admin-header-title {
  .headline {
    color: $slate-800 !important;
    font-weight: 700 !important;
    font-family: $font-family-base !important;
    letter-spacing: -0.02em !important;
  }
  .subtitle-1 {
    color: $slate-500 !important;
    font-size: 0.9375rem !important;
  }
}

.detran-btn-apply {
  background: linear-gradient(135deg, $detran-500 0%, $detran-600 100%) !important;
  color: #ffffff !important;
  font-weight: 600 !important;
  border-radius: $radius-md !important;
  box-shadow: 0 4px 14px rgba($detran-500, 0.35) !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    background: linear-gradient(135deg, $detran-600 0%, $detran-700 100%) !important;
    box-shadow: 0 6px 18px rgba($detran-500, 0.45) !important;
    transform: translateY(-1px);
  }
}

.detran-card {
  background: #ffffff !important;
  border-radius: $radius-xl !important;
  border: 1px solid $slate-200 !important;
  box-shadow: $shadow-soft !important;
  overflow: hidden;
}

.detran-card-header {
  border-bottom: 1px solid $slate-200;
  background-color: #ffffff;

  &-icon {
    width: 32px;
    height: 32px;
    background-color: $detran-50;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;

    .v-icon {
      color: $detran-600 !important;
    }
  }

  &-title {
    color: $slate-800;
    font-size: 1rem;
    font-weight: 600;
    font-family: $font-family-base;
  }

  .detran-card-subtitle {
    color: $slate-500;
    font-size: 0.8125rem;
    font-weight: 400;
  }
}

.detran-strategy-list {
  background-color: transparent !important;
}

.detran-strategy-item,
.detran-strategy-inactive {
  border-radius: 8px !important;
  margin: 2px 8px !important;
  transition: all 0.15s ease !important;

  &:hover {
    background-color: $slate-100 !important;
  }
}

.detran-strategy-active {
  background-color: $detran-50 !important;
  border: 1px solid $detran-200 !important;
  border-left: 4px solid $detran-500 !important;
  border-radius: 8px !important;
  margin: 2px 8px !important;

  .detran-strategy-title-active {
    color: $detran-700 !important;
    font-weight: 600 !important;
  }

  .detran-strategy-sub-active {
    color: $detran-600 !important;
  }

  .v-icon {
    color: $detran-600 !important;
  }
}

.detran-btn-primary {
  background: linear-gradient(135deg, $detran-500 0%, $detran-600 100%) !important;
  color: #ffffff !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  box-shadow: 0 3px 10px rgba($detran-500, 0.3) !important;
  text-transform: none !important;

  &:hover {
    background: linear-gradient(135deg, $detran-600 0%, $detran-700 100%) !important;
    box-shadow: 0 4px 14px rgba($detran-500, 0.4) !important;
  }
}

.detran-info-banner {
  background-color: $detran-50;
  border: 1px solid $detran-200;
  border-left: 4px solid $detran-500;
  border-radius: 10px;

  .detran-info-badge {
    width: 38px;
    height: 38px;
    background-color: $detran-100;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .v-icon {
      color: $detran-700 !important;
    }
  }

  .detran-info-title {
    color: $detran-800;
    font-size: 0.9375rem;
  }

  .detran-info-text {
    color: $slate-600;
    line-height: 1.4;
  }

  .detran-link {
    color: $detran-700;
    font-weight: 600;
    text-decoration: underline;
  }
}

.admin-providerlogo {
  width: 140px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-end;

  img {
    max-width: 100%;
    max-height: 36px;
    object-fit: contain;
  }
}
</style>

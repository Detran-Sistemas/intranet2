<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').source
    nav-header
    v-content
      v-toolbar(color='primary', dark)
        i18next.subheading(v-if='versionId > 0', path='common:page.viewingSourceVersion', tag='div')
          strong(place='date', :title='$options.filters.moment(versionDate, `LLL`)') {{versionDate | moment('lll')}}
          strong(place='path') /{{path}}
        i18next.subheading(v-else, path='common:page.viewingSource', tag='div')
          strong(place='path') /{{path}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          .caption.blue--text.text--lighten-3 {{$t('common:page.id', { id: pageId })}}
          .caption.blue--text.text--lighten-3.ml-4(v-if='versionId > 0') {{$t('common:page.versionId', { id: versionId })}}
          v-btn.ml-4(v-if='versionId > 0', depressed, color='blue darken-1', @click='goHistory')
            v-icon mdi-history
          v-btn.ml-4(depressed, color='blue darken-1', @click='goLive') {{$t('common:page.returnNormalView')}}
      v-card(tile)
        v-card-text
          v-card.grey.radius-7(flat, :class='$vuetify.theme.dark ? `darken-4` : `lighten-4`')
            v-card-text
              pre
                slot

    nav-footer
    notify
    search-results
</template>

<script>
export default {
  props: {
    pageId: {
      type: Number,
      default: 0
    },
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    },
    versionId: {
      type: Number,
      default: 0
    },
    versionDate: {
      type: String,
      default: ''
    },
    effectivePermissions: {
      type: String,
      default: ''
    }
  },
  data() {
    return {}
  },
  created () {
    this.$store.commit('page/SET_ID', this.id)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)

    this.$store.commit('page/SET_MODE', 'source')

    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
  },
  methods: {
    goLive() {
      window.location.assign(`/${this.locale}/${this.path}`)
    },
    goHistory () {
      window.location.assign(`/h/${this.locale}/${this.path}`)
    }
  }
}
</script>

<style lang='scss'>
@import '../themes/detran/scss/variables';

// =============================================================================
// DETRAN-MG — Source Code View Page
// Overrides sobre a estrutura Vuetify existente. Template PUG preservado.
// =============================================================================

.source {
  font-family: $font-family-base;

  // Toolbar primária no topo com gradiente Detran
  .v-toolbar.primary,
  .v-toolbar[color="primary"] {
    background-color: $detran-700 !important;
    background-image: linear-gradient(135deg, $detran-600 0%, $detran-800 100%) !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !important;
    color: #ffffff !important;

    .subheading {
      font-weight: 600;
      letter-spacing: -0.01em;
    }
  }

  // Subtextos e metadados no header
  .blue--text.text--lighten-3 {
    color: #cce0d2 !important;
    font-weight: 500;
  }

  // Botões na toolbar
  .v-btn.blue.darken-1,
  .v-btn.ml-4 {
    background-color: rgba(255, 255, 255, 0.15) !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
    color: #ffffff !important;
    border-radius: $radius-md !important;
    font-weight: 600;
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(255, 255, 255, 0.25) !important;
      transform: translateY(-1px);
    }
  }

  // Card do container de código
  .v-card.grey.radius-7 {
    border-radius: $radius-xl !important;
    border: 1px solid $slate-200 !important;
    box-shadow: $shadow-soft !important;
    background-color: #f8fafc !important;
  }

  pre {
    margin: 0;
    padding: 0.5rem;
    overflow-x: auto;
  }

  pre > code {
    box-shadow: none;
    background-color: transparent !important;
    color: $slate-800;
    font-family: 'Fira Code', 'Roboto Mono', 'SFMono-Regular', Consolas, monospace;
    font-weight: 400;
    font-size: 0.9375rem;
    line-height: 1.6;

    @at-root .theme--dark.source pre > code {
      background-color: transparent;
      color: $slate-200;
    }

    &::before {
      display: none;
    }
  }
}
</style>

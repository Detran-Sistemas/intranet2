<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').tags
    nav-header
    v-navigation-drawer.pb-0.elevation-1(app, fixed, clipped, :right='$vuetify.rtl', permanent, width='300')
      vue-scroll(:ops='scrollStyle')
        v-list(dense, nav)
          v-list-item(href='/')
            v-list-item-icon: v-icon mdi-home
            v-list-item-title {{$t('common:header.home')}}
          template(v-for='(tags, groupName) in tagsGrouped')
            v-divider.my-2
            v-subheader.pl-4(:key='`tagGroup-` + groupName') {{groupName}}
            v-list-item(v-for='tag of tags', @click='toggleTag(tag.tag)', :key='`tag-` + tag.tag')
              v-list-item-icon
                v-icon(v-if='isSelected(tag.tag)', color='primary') mdi-checkbox-intermediate
                v-icon(v-else) mdi-checkbox-blank-outline
              v-list-item-title {{tag.title}}
    v-main.grey(:class='$vuetify.theme.dark ? `darken-4-d5` : `lighten-3`')
      v-toolbar(color='primary', dark, flat, height='58')
        template(v-if='selection.length > 0')
          .overline.mr-3.animated.fadeInLeft {{$t('tags:currentSelection')}}
          v-chip.mr-3.primary--text(
            v-for='tag of tagsSelected'
            :key='`tagSelected-` + tag.tag'
            color='white'
            close
            @click:close='toggleTag(tag.tag)'
            ) {{tag.title}}
          v-spacer
          v-btn.animated.fadeIn(
            small
            outlined
            color='blue lighten-4'
            rounded
            @click='selection = []'
            )
            v-icon(left) mdi-close
            span {{$t('tags:clearSelection')}}
        template(v-else)
          v-icon.mr-3.animated.fadeInRight mdi-arrow-left
          .overline.animated.fadeInRight {{$t('tags:selectOneMoreTags')}}
      v-toolbar(:color='$vuetify.theme.dark ? `grey darken-4-l5` : `grey lighten-4`', flat, height='58')
        v-text-field.tags-search(
          v-model='innerSearch'
          :label='$t(`tags:searchWithinResultsPlaceholder`)'
          solo
          hide-details
          flat
          rounded
          single-line
          height='40'
          prepend-icon='mdi-text-box-search-outline'
          append-icon='mdi-arrow-right'
          clearable
        )
        template(v-if='locales.length > 1')
          v-divider.mx-3(vertical)
          .overline {{$t('tags:locale')}}
          v-select.ml-2(
            :items='locales'
            v-model='locale'
            :background-color='$vuetify.theme.dark ? `grey darken-3` : `white`'
            hide-details
            :label='$t(`tags:locale`)'
            item-text='name'
            item-value='code'
            rounded
            single-line
            dense
            height='40'
            style='max-width: 170px;'
          )
        v-divider.mx-3(vertical)
        .overline {{$t('tags:orderBy')}}
        v-select.ml-2(
          :items='orderByItems'
          v-model='orderBy'
          :background-color='$vuetify.theme.dark ? `grey darken-3` : `white`'
          hide-details
          :label='$t(`tags:orderBy`)'
          rounded
          single-line
          dense
          height='40'
          style='max-width: 250px;'
        )
        v-btn-toggle.ml-2(v-model='orderByDirection', rounded, mandatory)
          v-btn(text, height='40'): v-icon(size='20') mdi-chevron-double-up
          v-btn(text, height='40'): v-icon(size='20') mdi-chevron-double-down
      v-divider
      .text-center.pt-10(v-if='selection.length < 1')
        img(src='/_assets/svg/icon-price-tag.svg')
        .subtitle-2.grey--text {{$t('tags:selectOneMoreTagsHint')}}
      .px-5.py-2(v-else)
        v-data-iterator(
          :items='pages'
          :items-per-page='4'
          :search='innerSearch'
          :loading='isLoading'
          :options.sync='pagination'
          @page-count='pageTotal = $event'
          hide-default-footer
          ref='dude'
          )
          template(v-slot:loading)
            .text-center.pt-10
              v-progress-circular(
                indeterminate
                color='primary'
                size='96'
                width='2'
                )
              .subtitle-2.grey--text.mt-5 {{$t('tags:retrievingResultsLoading')}}
          template(v-slot:no-data)
            .text-center.pt-10
              img(src='/_assets/svg/icon-info.svg')
              .subtitle-2.grey--text {{$t('tags:noResults')}}
          template(v-slot:no-results)
            .text-center.pt-10
              img(src='/_assets/svg/icon-info.svg')
              .subtitle-2.grey--text {{$t('tags:noResultsWithFilter')}}
          template(v-slot:default='props')
            v-row(align='stretch')
              v-col(
                v-for='item of props.items'
                :key='`page-` + item.id'
                cols='12'
                lg='6'
                )
                v-card.radius-7(
                  @click='goTo(item)'
                  style='height:100%;'
                  :class='$vuetify.theme.dark ? `grey darken-4` : ``'
                  )
                  v-card-text
                    .d-flex.flex-row.align-center
                      .body-1: strong.primary--text {{item.title}}
                      v-spacer
                      i18next.caption(tag='div', path='tags:pageLastUpdated')
                        span(place='date') {{item.updatedAt | moment('from')}}
                    .body-2.grey--text {{item.description || '---'}}
                    v-divider.my-2
                    .d-flex.flex-row.align-center
                      v-chip(small, label, :color='$vuetify.theme.dark ? `grey darken-3-l5` : `grey lighten-4`').overline {{item.locale}}
                      .caption.ml-1 / {{item.path}}
        .text-center.py-2.animated.fadeInDown(v-if='this.pageTotal > 1')
          v-pagination(v-model='pagination.page', :length='pageTotal')

    nav-footer
    notify
    search-results
</template>

<script>
import VueRouter from 'vue-router'
import _ from 'lodash'

import tagsQuery from 'gql/common/common-pages-query-tags.gql'
import pagesQuery from 'gql/common/common-pages-query-list.gql'

/* global siteLangs */

const router = new VueRouter({
  mode: 'history',
  base: '/t'
})

export default {
  i18nOptions: { namespaces: 'tags' },
  data() {
    return {
      tags: [],
      selection: [],
      innerSearch: '',
      locale: 'any',
      locales: [],
      orderBy: 'title',
      orderByDirection: 0,
      pagination: {
        page: 1,
        itemsPerPage: 12,
        mustSort: true,
        sortBy: ['title'],
        sortDesc: [false]
      },
      pages: [],
      pageTotal: 0,
      isLoading: true,
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
      }
    }
  },
  computed: {
    tagsGrouped () {
      return _.groupBy(this.tags, t => t.title.charAt(0).toUpperCase())
    },
    tagsSelected () {
      return _.filter(this.tags, t => _.includes(this.selection, t.tag))
    },
    orderByItems () {
      return [
        { text: this.$t('tags:orderByField.creationDate'), value: 'createdAt' },
        { text: this.$t('tags:orderByField.ID'), value: 'id' },
        { text: this.$t('tags:orderByField.lastModified'), value: 'updatedAt' },
        { text: this.$t('tags:orderByField.path'), value: 'path' },
        { text: this.$t('tags:orderByField.title'), value: 'title' }
      ]
    }
  },
  watch: {
    locale (newValue, oldValue) {
      this.rebuildURL()
    },
    orderBy (newValue, oldValue) {
      this.rebuildURL()
      this.pagination.sortBy = [newValue]
    },
    orderByDirection (newValue, oldValue) {
      this.rebuildURL()
      this.pagination.sortDesc = [newValue === 1]
    }
  },
  router,
  created () {
    this.$store.commit('page/SET_MODE', 'tags')
    this.selection = _.compact(decodeURI(this.$route.path).split('/'))
  },
  mounted () {
    this.locales = _.concat(
      [{name: this.$t('tags:localeAny'), code: 'any'}],
      (siteLangs.length > 0 ? siteLangs : [])
    )
    if (this.$route.query.lang) {
      this.locale = this.$route.query.lang
    }
    if (this.$route.query.sort) {
      this.orderBy = this.$route.query.sort.toLowerCase()
      switch (this.orderBy) {
        case 'updatedat':
          this.orderBy = 'updatedAt'
          break
      }
      this.pagination.sortBy = [this.orderBy]
    }
    if (this.$route.query.dir) {
      this.orderByDirection = this.$route.query.dir === 'asc' ? 0 : 1
      this.pagination.sortDesc = [this.orderByDirection === 1]
    }
  },
  methods: {
    toggleTag (tag) {
      if (_.includes(this.selection, tag)) {
        this.selection = _.without(this.selection, tag)
      } else {
        this.selection.push(tag)
      }
      this.rebuildURL()
    },
    isSelected (tag) {
      return _.includes(this.selection, tag)
    },
    rebuildURL () {
      let urlObj = {
        path: '/' + this.selection.join('/')
      }
      if (this.locale !== `any`) {
        _.set(urlObj, 'query.lang', this.locale)
      }
      if (this.orderBy !== `TITLE`) {
        _.set(urlObj, 'query.sort', this.orderBy.toLowerCase())
      }
      if (this.orderByDirection !== 0) {
        _.set(urlObj, 'query.dir', this.orderByDirection === 0 ? `asc` : `desc`)
      }
      this.$router.push(urlObj)
    },
    goTo (page) {
      window.location.assign(`/${page.locale}/${page.path}`)
    }
  },
  apollo: {
    tags: {
      query: tagsQuery,
      fetchPolicy: 'cache-and-network',
      update: (data) => _.cloneDeep(data.pages.tags),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'tags-refresh')
      }
    },
    pages: {
      query: pagesQuery,
      fetchPolicy: 'cache-and-network',
      update: (data) => _.cloneDeep(data.pages.list),
      watchLoading (isLoading) {
        this.isLoading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'pages-refresh')
      },
      variables () {
        return {
          locale: this.locale === 'any' ? null : this.locale,
          tags: this.selection
        }
      },
      skip () {
        return this.selection.length < 1
      }
    }
  }
}
</script>

<style lang='scss'>
@import '../themes/detran/scss/variables';

// =============================================================================
// DETRAN-MG — Tags Page
// Overrides sobre a estrutura Vuetify existente.
// =============================================================================

.tags {

  // Toolbar principal de seleção de tags
  .v-toolbar.primary {
    background-color: $detran-700 !important;
    background-image: linear-gradient(135deg, $detran-600 0%, $detran-800 100%) !important;
    box-shadow: 0 2px 12px rgba($detran-900, 0.25) !important;
  }

  // Toolbar secundária de busca
  .v-toolbar {
    font-family: $font-family-base !important;
  }

  // Campo de busca de tags
  .tags-search {
    .v-input__control {
      min-height: initial !important;
    }
    .v-input__prepend-outer {
      margin-top: 8px !important;
    }
    .v-input__slot {
      border-radius: $radius-lg !important;
      background: $color-white !important;
      box-shadow: $shadow-soft !important;
    }
  }

  // Chips de tags selecionadas na toolbar
  .v-chip.primary--text {
    background-color: rgba(255, 255, 255, 0.15) !important;
    color: #ffffff !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    font-family: $font-family-base !important;
    font-weight: 600 !important;
    border-radius: $radius-full !important;

    .v-icon {
      color: rgba(255, 255, 255, 0.70) !important;
    }
  }

  // Botão "Limpar seleção"
  .v-btn.blue.lighten-4 {
    background-color: rgba(255, 255, 255, 0.12) !important;
    border-color: rgba(255, 255, 255, 0.40) !important;
    color: #ffffff !important;
    border-radius: $radius-lg !important;
    text-transform: none !important;
    font-family: $font-family-base !important;
    font-weight: 500 !important;
  }

  // Tabela de resultados
  .v-data-table {
    border-radius: $radius-xl !important;
    box-shadow: $shadow-soft !important;
    font-family: $font-family-base !important;
    overflow: hidden;

    thead > tr > th {
      background-color: $detran-50 !important;
      color: $detran-700 !important;
      font-weight: 700 !important;
      font-size: 0.75rem !important;
      text-transform: uppercase !important;
      letter-spacing: 0.07em !important;
      border-bottom: 2px solid $detran-100 !important;
    }

    tbody > tr:hover td {
      background-color: rgba($detran-500, 0.04) !important;
    }
  }

  // Sidebar de seleção de tags
  .v-navigation-drawer {
    background: linear-gradient(175deg, $detran-800 0%, $detran-900 100%) !important;
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.20) !important;

    .v-subheader {
      color: rgba(255, 255, 255, 0.45) !important;
      font-size: 0.625rem !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.12em !important;
    }

    .v-divider {
      border-color: rgba(255, 255, 255, 0.08) !important;
    }

    .v-list {
      background: transparent !important;
    }

    .v-list-item {
      border-radius: 10px !important;
      margin: 2px 8px !important;
      color: rgba(255, 255, 255, 0.70) !important;
      transition: background-color 0.18s ease !important;

      &:hover {
        background-color: rgba(255, 255, 255, 0.08) !important;
        color: #ffffff !important;
      }

      .v-list-item__title {
        font-family: $font-family-base !important;
        font-size: 0.8125rem !important;
        color: inherit !important;
      }

      .v-icon {
        color: rgba(255, 255, 255, 0.55) !important;
      }

      .v-icon.primary--text {
        color: $detran-400 !important;
      }
    }
  }
}
</style>

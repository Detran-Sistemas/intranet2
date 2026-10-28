<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-triangle-arrow.svg', alt='Navigation', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('navigation.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{$t('navigation.subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/navigation', target='_blank')
            v-icon mdi-help-circle
          v-btn.mx-3.animated.fadeInDown.wait-p2s.mr-3(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
          v-btn.detran-btn-primary.animated.fadeInDown(depressed, @click='save', large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-container.pa-0.mt-3(fluid, grid-list-lg)
          v-row(dense)
            v-col(cols='3')
              v-card.animated.fadeInUp.detran-card
                .detran-card-header.d-flex.align-center.px-4.py-3
                  .detran-card-header-icon.mr-2
                    v-icon(size='18') mdi-compass-outline
                  .detran-card-header-title {{$t('admin:navigation.mode')}}
                v-list(nav, two-line)
                  v-list-item-group(v-model='config.mode', mandatory, :color='$vuetify.theme.dark ? `primary lighten-3` : `primary`')
                    v-list-item(value='TREE')
                      v-list-item-avatar
                        img(src='/_assets/svg/icon-tree-structure-dotted.svg', alt='Site Tree')
                      v-list-item-content
                        v-list-item-title {{$t('admin:navigation.modeSiteTree.title')}}
                        v-list-item-subtitle {{$t('admin:navigation.modeSiteTree.description')}}
                      v-list-item-avatar
                        v-icon(:color='config.mode === `TREE` ? `primary` : `grey lighten-2`') mdi-check-circle
                    v-list-item(value='STATIC')
                      v-list-item-avatar
                        img(src='/_assets/svg/icon-features-list.svg', alt='Static Navigation')
                      v-list-item-content
                        v-list-item-title {{$t('admin:navigation.modeStatic.title')}}
                        v-list-item-subtitle {{$t('admin:navigation.modeStatic.description')}}
                      v-list-item-avatar
                        v-icon(:color='config.mode === `STATIC` ? `primary` : `grey lighten-2`') mdi-check-circle
                    v-list-item(value='MIXED')
                      v-list-item-avatar
                        img(src='/_assets/svg/icon-user-menu-male-dotted.svg', alt='Custom Navigation')
                      v-list-item-content
                        v-list-item-title {{$t('admin:navigation.modeCustom.title')}}
                        v-list-item-subtitle {{$t('admin:navigation.modeCustom.description')}}
                      v-list-item-avatar
                        v-icon(:color='config.mode === `MIXED` ? `primary` : `grey lighten-2`') mdi-check-circle
                    v-list-item(value='NONE')
                      v-list-item-avatar
                        img(src='/_assets/svg/icon-cancel-dotted.svg', alt='None')
                      v-list-item-content
                        v-list-item-title {{$t('admin:navigation.modeNone.title')}}
                        v-list-item-subtitle {{$t('admin:navigation.modeNone.description')}}
                      v-list-item-avatar
                        v-icon(:color='config.mode === `NONE` ? `primary` : `grey lighten-2`') mdi-check-circle

            v-col(cols='9', v-if='config.mode === `MIXED` || config.mode === `STATIC`')
              v-card.animated.fadeInUp.wait-p2s.detran-nav-container
                v-row(no-gutters, align='stretch', style='min-height: 640px;')
                  //- Coluna Esquerda: Pré-visualização do Menu do Portal Detran-MG
                  v-col(style='flex: 0 0 350px; max-width: 350px;')
                    .detran-nav-panel
                      //- 1. Topbar do Menu: Título e Seletor de Idioma Integrado
                      .detran-nav-topbar.d-flex.align-center.justify-space-between.px-3
                        .d-flex.align-center
                          v-icon.mr-2(size='16', color='#5fc381') mdi-menu
                          span.caption.font-weight-bold(style='color: #ffffff; letter-spacing: 0.05em;') Menu do Portal
                        .d-flex.align-center(v-if='locales && locales.length > 1')
                          v-select.detran-nav-lang-select(
                            hide-details
                            dense
                            solo
                            flat
                            v-model='currentLang'
                            :items='locales'
                            item-text='nativeName'
                            item-value='code'
                          )
                          v-tooltip(top)
                            template(v-slot:activator='{ on }')
                              v-btn.ml-1(icon, x-small, color='#cce0d2', v-on='on', @click='copyFromLocaleDialogIsShown = true')
                                v-icon(size='16') mdi-arrange-send-backward
                            span {{$t('admin:navigation.copyFromLocale')}}
                        .d-flex.align-center(v-else)
                          span.detran-lang-pill {{ currentLangName }}

                      //- 2. Lista da Árvore de Navegação
                      .detran-nav-list-wrapper
                        .detran-nav-empty(v-if='currentTree.length < 1')
                          v-icon(color='rgba(255,255,255,0.4)', size='36') mdi-alert-circle-outline
                          p.caption.mt-2.mb-0(style='color: rgba(255,255,255,0.7);') {{$t('navigation.emptyList')}}
                        draggable(
                          v-model='currentTree'
                          handle='.drag-handle'
                          ghost-class='detran-nav-drag-ghost'
                          :animation='180'
                          class='detran-nav-draggable'
                        )
                          .detran-nav-item(
                            v-for='(navItem, index) in currentTree'
                            :key='navItem.id'
                            :class='[getItemClasses(navItem, index), { "is-selected": navItem === current }]'
                            @click='selectItem(navItem)'
                          )
                            //- Rótulo de Seção
                            template(v-if='getNavItemMeta(navItem, index).type === "section"')
                              v-icon.drag-handle(size='14', title='Arrastar para reposicionar') mdi-drag-vertical
                              span.detran-nav-item__section-title {{ navItem.label || "SEÇÃO" }}
                              v-spacer
                              span.detran-nav-badge.is-section-badge SEÇÃO

                            //- Grupo com Subitens
                            template(v-else-if='getNavItemMeta(navItem, index).type === "group"')
                              v-icon.drag-handle(size='14', title='Arrastar para reposicionar') mdi-drag-vertical
                              .detran-nav-item__icon-box
                                v-icon(size='18', color='#cce0d2') {{ resolveIcon(navItem.icon || navItem.label) }}
                              span.detran-nav-item__label {{ navItem.label || "Grupo" }}
                              v-spacer
                              span.detran-nav-count-badge(
                                v-if='getNavItemMeta(navItem, index).subitemCount > 0'
                                title='Quantidade de subitens vinculados a este grupo'
                              ) {{ getNavItemMeta(navItem, index).subitemCount }}
                              span.detran-nav-badge.is-group-badge(v-else) GRUPO
                              v-icon.detran-nav-item__chevron(size='14', color='rgba(255,255,255,0.7)') mdi-chevron-down

                            //- Subitem
                            template(v-else-if='getNavItemMeta(navItem, index).type === "sublink"')
                              .detran-nav-item__branch-line(aria-hidden='true')
                              v-icon.drag-handle(size='14', title='Arrastar para reposicionar') mdi-drag-vertical
                              .detran-nav-item__subicon-box
                                v-icon(v-if='navItem.icon && navItem.icon !== "mdi-chevron-right" && navItem.icon !== "link"', size='14', color='#cce0d2') {{ resolveIcon(navItem.icon) }}
                                v-icon(v-else, size='12', color='rgba(255,255,255,0.6)') mdi-circle-medium
                              span.detran-nav-item__sublabel {{ navItem.label || "Subitem" }}
                              v-spacer
                              span.detran-nav-badge.is-target-badge(v-if='navItem.targetType === "page"') Página
                              span.detran-nav-badge.is-target-badge(v-else-if='navItem.targetType === "external" || navItem.targetType === "externalblank"') Link
                              span.detran-nav-badge.is-target-badge(v-else-if='navItem.targetType === "home"') Início

                            //- Link Principal
                            template(v-else-if='getNavItemMeta(navItem, index).type === "toplink"')
                              v-icon.drag-handle(size='14', title='Arrastar para reposicionar') mdi-drag-vertical
                              .detran-nav-item__icon-box
                                v-icon(size='18', color='#cce0d2') {{ resolveIcon(navItem.icon) }}
                              span.detran-nav-item__label {{ navItem.label || "Link" }}
                              v-spacer
                              span.detran-nav-badge.is-target-badge(v-if='navItem.targetType === "page"') Página
                              span.detran-nav-badge.is-target-badge(v-else-if='navItem.targetType === "external" || navItem.targetType === "externalblank"') Link
                              span.detran-nav-badge.is-target-badge(v-else-if='navItem.targetType === "home"') Início

                            //- Separador
                            template(v-else-if='getNavItemMeta(navItem, index).type === "divider"')
                              v-icon.drag-handle(size='14', title='Arrastar para reposicionar') mdi-drag-vertical
                              .detran-nav-item__divider-line
                              span.detran-nav-item__divider-label SEPARADOR
                              .detran-nav-item__divider-line

                      //- 3. Rodapé com Botão de Adição
                      .detran-nav-bottombar.pa-3
                        v-menu(offset-y, top, min-width='240px')
                          template(v-slot:activator='{ on }')
                            v-btn.detran-btn-primary(v-on='on', depressed, block, large)
                              v-icon(left, size='18') mdi-plus
                              span.font-weight-bold {{$t('common:actions.add')}}
                          v-list(dense)
                            v-list-item(@click='addItem("link")')
                              v-list-item-avatar(size='24'): v-icon(color='primary') mdi-link
                              v-list-item-content
                                v-list-item-title Link de Navegação
                                v-list-item-subtitle.caption Página interna ou URL externa
                            v-list-item(@click='addItem("group")')
                              v-list-item-avatar(size='24'): v-icon(color='primary') mdi-folder-outline
                              v-list-item-content
                                v-list-item-title Grupo com Subitens
                                v-list-item-subtitle.caption Menu sanfona / acordeão (ex: Habilitação)
                            v-list-item(@click='addItem("section")')
                              v-list-item-avatar(size='24'): v-icon(color='info') mdi-format-header-pound
                              v-list-item-content
                                v-list-item-title Rótulo de Seção
                                v-list-item-subtitle.caption Divisor em caixa alta (ex: ACESSO RÁPIDO)
                            v-list-item(@click='addItem("divider")')
                              v-list-item-avatar(size='24'): v-icon(color='grey darken-1') mdi-minus
                              v-list-item-content
                                v-list-item-title Linha Separadora
                                v-list-item-subtitle.caption Encerra grupos e divide seções

                  //- Coluna Direita: Editor do Item Selecionado
                  v-col.detran-editor-col
                    .detran-editor-panel
                      //- Cabeçalho Padrão Detran
                      .detran-card-header.d-flex.align-center.px-5.py-3
                        .detran-card-header-icon.mr-3
                          v-icon(size='20') {{ editorHeaderIcon }}
                        .detran-card-header-title {{ editorHeaderTitle }}
                        v-spacer
                        v-btn.detran-btn-delete(
                          v-if='current && current.kind'
                          small
                          outlined
                          @click='deleteItem(current)'
                        )
                          v-icon(left, size='16') mdi-delete-outline
                          span {{$t('common:actions.delete')}}

                      //- Editor: Link (Principal ou Subitem)
                      template(v-if='current.kind === "link"')
                        .detran-info-banner.mx-5.my-4.pa-3
                          .d-flex.align-center
                            .detran-info-badge.mr-3
                              v-icon(size='20') {{ isItemSublink(current) ? "mdi-file-tree" : "mdi-link-variant" }}
                            div
                              .detran-info-title.font-weight-bold {{ isItemSublink(current) ? "Hierarquia: Subitem Aninhado" : "Hierarquia: Link Principal (1º Nível)" }}
                              .caption.detran-info-text {{ isItemSublink(current) ? "Pertence ao grupo \"" + getParentGroupName(current) + "\". No portal, é exibido recolhível dentro do acordeão." : "Exibido no menu raiz como item independente de nível superior." }}
                            v-spacer
                            v-btn.detran-btn-outline-action(
                              v-if='isItemSublink(current)'
                              small
                              outlined
                              @click='detachFromGroup(current)'
                            )
                              v-icon(left, size='14') mdi-format-horizontal-align-left
                              span Tirar do Grupo
                        .d-flex.align-center.px-5.mb-3(style='gap: 8px;')
                          v-btn.detran-btn-outline-action(small, outlined, @click='moveItemUp(current)')
                            v-icon(left, size='14') mdi-arrow-up
                            span Mover para Cima
                          v-btn.detran-btn-outline-action(small, outlined, @click='moveItemDown(current)')
                            v-icon(left, size='14') mdi-arrow-down
                            span Mover para Baixo
                          v-btn.detran-btn-outline-action(small, outlined, @click='addDividerAfter(current)')
                            v-icon(left, size='14') mdi-minus
                            span Inserir Separador Abaixo
                        v-card-text.px-5.py-0
                          v-text-field(
                            outlined
                            :label='$t("navigation.label")'
                            prepend-inner-icon='mdi-format-title'
                            v-model='current.label'
                            counter='255'
                          )
                          v-text-field.mt-1(
                            outlined
                            :label='$t("navigation.icon")'
                            prepend-inner-icon='mdi-dice-5'
                            v-model='current.icon'
                            hide-details
                          )
                          .mt-2.mb-3
                            .caption.text--secondary Ícones sugeridos para links:
                            .d-flex.flex-wrap.mt-1(style='gap: 6px;')
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-chevron-right"')
                                v-icon(left, size='12') mdi-chevron-right
                                span Seta (Padrão)
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-circle-medium"')
                                v-icon(left, size='12') mdi-circle-medium
                                span Ponto
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-file-document-outline"')
                                v-icon(left, size='12') mdi-file-document-outline
                                span Documento
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-open-in-new"')
                                v-icon(left, size='12') mdi-open-in-new
                                span Externo
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-home"')
                                v-icon(left, size='12') mdi-home
                                span Início
                          v-select.mt-3(
                            outlined
                            :label='$t("navigation.targetType")'
                            prepend-inner-icon='mdi-near-me'
                            :items='navTypes'
                            v-model='current.targetType'
                            hide-details
                          )
                          v-text-field.mt-3(
                            v-if='current.targetType === `external` || current.targetType === `externalblank`'
                            outlined
                            :label='$t("navigation.target")'
                            prepend-inner-icon='mdi-link-variant'
                            v-model='current.target'
                            hide-details
                          )
                          .detran-target-page-box.mt-3.d-flex.align-center.px-3.py-2(v-else-if='current.targetType === "page"')
                            v-icon.mr-2(size='18', color='#64748b') mdi-file-document-outline
                            .detran-target-path.flex-grow-1.text-truncate
                              span.caption.text--secondary.mr-2 Destino:
                              code.detran-target-code {{ current.target || 'Nenhuma página selecionada' }}
                            v-btn.detran-btn-primary.ml-2(small, depressed, @click='selectPage')
                              v-icon(left, size='14') mdi-magnify
                              span {{$t('admin:navigation.selectPageButton')}}
                          v-text-field.mt-3(
                            v-else-if='current.targetType === `search`'
                            outlined
                            :label='$t("navigation.navType.searchQuery")'
                            prepend-inner-icon='mdi-magnify'
                            v-model='current.target'
                            hide-details
                          )

                      //- Editor: Cabeçalho (Grupo ou Seção)
                      template(v-else-if='current.kind === "header"')
                        .detran-info-banner.mx-5.my-4.pa-3
                          .d-flex.align-center
                            .detran-info-badge.mr-3
                              v-icon(size='20') {{ isHeaderSection(current) ? "mdi-format-header-pound" : "mdi-folder-outline" }}
                            div
                              .detran-info-title.font-weight-bold {{ isHeaderSection(current) ? "Comportamento: Rótulo de Seção" : "Comportamento: Grupo com Subitens (Acordeão)" }}
                              .caption.detran-info-text {{ isHeaderSection(current) ? "Exibido em caixa alta (ex: ACESSO RÁPIDO). Não agrupa subitens, funciona como título de bloco." : "Agrupa automaticamente os links posicionados abaixo dele como subitens recolhíveis do menu sanfona." }}
                            v-spacer
                            v-btn.detran-btn-outline-action(
                              small
                              outlined
                              @click='toggleHeaderType(current)'
                            )
                              v-icon(left, size='14') mdi-swap-horizontal
                              span {{ isHeaderSection(current) ? "Tornar Grupo" : "Tornar Seção" }}
                        .d-flex.align-center.px-5.mb-3(style='gap: 8px;')
                          v-btn.detran-btn-outline-action(small, outlined, @click='moveItemUp(current)')
                            v-icon(left, size='14') mdi-arrow-up
                            span Mover para Cima
                          v-btn.detran-btn-outline-action(small, outlined, @click='moveItemDown(current)')
                            v-icon(left, size='14') mdi-arrow-down
                            span Mover para Baixo
                          v-btn.detran-btn-outline-action(small, outlined, @click='addDividerAfter(current)')
                            v-icon(left, size='14') mdi-minus
                            span Inserir Separador Abaixo
                        v-card-text.px-5.py-0
                          v-text-field(
                            outlined
                            :label='$t("navigation.label")'
                            prepend-inner-icon='mdi-format-title'
                            v-model='current.label'
                            counter='255'
                          )
                          v-text-field.mt-1(
                            v-if='!isHeaderSection(current)'
                            outlined
                            :label='$t("navigation.icon")'
                            prepend-inner-icon='mdi-dice-5'
                            v-model='current.icon'
                            hide-details
                          )
                          .mt-2.mb-3(v-if='!isHeaderSection(current)')
                            .caption.text--secondary Ícones sugeridos para grupos:
                            .d-flex.flex-wrap.mt-1(style='gap: 6px;')
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-card-account-details-outline"')
                                v-icon(left, size='12') mdi-card-account-details-outline
                                span Habilitação
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-car-side"')
                                v-icon(left, size='12') mdi-car-side
                                span Veículos
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-monitor"')
                                v-icon(left, size='12') mdi-monitor
                                span Sistemas
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-file-document-outline"')
                                v-icon(left, size='12') mdi-file-document-outline
                                span Normativos
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-shield-check"')
                                v-icon(left, size='12') mdi-shield-check
                                span Segurança
                              v-chip.detran-suggested-chip(x-small, outlined, @click='current.icon = "mdi-folder-outline"')
                                v-icon(left, size='12') mdi-folder-outline
                                span Geral

                      //- Editor: Separador
                      template(v-else-if='current.kind === "divider"')
                        .detran-info-banner.mx-5.my-4.pa-3
                          .d-flex.align-center
                            .detran-info-badge.mr-3
                              v-icon(size='20') mdi-minus
                            div
                              .detran-info-title.font-weight-bold Separador / Fim de Grupo
                              .caption.detran-info-text O separador encerra qualquer grupo ativo anterior. Os links posicionados após este separador serão considerados links principais de primeiro nível até o início de um novo grupo.
                        .d-flex.align-center.px-5.mb-3(style='gap: 8px;')
                          v-btn.detran-btn-outline-action(small, outlined, @click='moveItemUp(current)')
                            v-icon(left, size='14') mdi-arrow-up
                            span Mover para Cima
                          v-btn.detran-btn-outline-action(small, outlined, @click='moveItemDown(current)')
                            v-icon(left, size='14') mdi-arrow-down
                            span Mover para Baixo

                      //- Configuração de Visibilidade (Compartilhada entre todos os tipos de itens)
                      v-card-text.px-5.pb-5(v-if='current && current.kind')
                        v-divider.my-4
                        .overline.font-weight-bold.mb-2(style='color: #64748b; letter-spacing: 0.08em;') Visibilidade do Item
                        v-radio-group.mt-1.pt-0(v-model='current.visibilityMode', mandatory, hide-details)
                          v-radio.mb-1(:label='$t("admin:navigation.visibilityMode.all")', value='all', color='primary')
                          v-radio(:label='$t("admin:navigation.visibilityMode.restricted")', value='restricted', color='primary')
                        v-select.mt-3(
                          v-if='current.visibilityMode === "restricted"'
                          item-text='name'
                          item-value='id'
                          outlined
                          prepend-inner-icon='mdi-account-group'
                          :label='$t("admin:navigation.groups")'
                          v-model='current.visibilityGroups'
                          :items='groups'
                          persistent-hint
                          clearable
                          multiple
                        )

                      //- Estado Vazio (Nenhum item selecionado)
                      template(v-else)
                        .detran-empty-editor.d-flex.flex-column.align-center.justify-center.pa-8(style='min-height: 400px;')
                          .detran-empty-icon.mb-3
                            v-icon(size='48', color='#64748b') mdi-cursor-default-click-outline
                          .subtitle-1.font-weight-bold(style='color: #334155;') {{$t('navigation.selectItem')}}
                          .caption.text-center.mt-1(style='color: #64748b; max-width: 320px;') Selecione um item da árvore de navegação à esquerda para editar seu título, destino, ícone ou regras de visibilidade.

    v-dialog(v-model='copyFromLocaleDialogIsShown', max-width='650', persistent)
      v-card
        .dialog-header.is-short
          v-icon.mr-3(color='white') mdi-arrange-send-backward
          span {{$t('admin:navigation.copyFromLocale')}}
        v-card-text.pt-5
          .body-2 {{$t('admin:navigation.copyFromLocaleInfoText')}}
          v-select.mt-3(
            :items='locales'
            item-text='nativeName'
            item-value='code'
            outlined
            prepend-inner-icon='mdi-web'
            v-model='copyFromLocaleCode'
            :label='$t(`admin:navigation.sourceLocale`)'
            :hint='$t(`admin:navigation.sourceLocaleHint`)'
            persistent-hint
            )
        v-card-chin
          v-spacer
          v-btn(text, @click='copyFromLocaleDialogIsShown = false') {{$t('common:actions.cancel')}}
          v-btn.px-3.detran-btn-primary(depressed, @click='copyFromLocale')
            v-icon(left) mdi-chevron-right
            span {{$t('common:actions.copy')}}

    page-selector(mode='select', v-model='selectPageModal', :open-handler='selectPageHandle', path='home', :locale='currentLang')
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { v4 as uuid } from 'uuid'

import groupsQuery from 'gql/admin/users/users-query-groups.gql'

import draggable from 'vuedraggable'

/* global siteConfig, siteLangs */

export default {
  components: {
    draggable
  },
  data() {
    return {
      selectPageModal: false,
      trees: [],
      current: {},
      currentLang: siteConfig.lang,
      groups: [],
      copyFromLocaleDialogIsShown: false,
      config: {
        mode: 'NONE'
      },
      allLocales: [],
      copyFromLocaleCode: 'en'
    }
  },
  computed: {
    navTypes () {
      return [
        { text: this.$t('navigation.navType.external'), value: 'external' },
        { text: this.$t('navigation.navType.externalblank'), value: 'externalblank' },
        { text: this.$t('navigation.navType.home'), value: 'home' },
        { text: this.$t('navigation.navType.page'), value: 'page' }
        // { text: this.$t('navigation.navType.searchQuery'), value: 'search' }
      ]
    },
    locales () {
      return _.intersectionBy(this.allLocales, _.unionBy(siteLangs, [{ code: 'en' }, { code: siteConfig.lang }], 'code'), 'code')
    },
    currentLangName () {
      const loc = _.find(this.locales, ['code', this.currentLang])
      return loc ? (loc.nativeName || loc.name) : (this.currentLang ? this.currentLang.toUpperCase() : 'Padrão')
    },
    currentTree: {
      get () {
        return _.get(_.find(this.trees, ['locale', this.currentLang]), 'items', null) || []
      },
      set (val) {
        const tree = _.find(this.trees, ['locale', this.currentLang])
        if (tree) {
          tree.items = val
        } else {
          this.trees = [...this.trees, {
            locale: this.currentLang,
            items: val
          }]
        }
      }
    },
    navTreeMeta () {
      const raw = this.currentTree || []
      const meta = {}
      let currentGroup = null
      let currentGroupCount = 0

      for (let i = 0; i < raw.length; i++) {
        const item = raw[i]

        if (item.kind === 'divider') {
          currentGroup = null
          currentGroupCount = 0
          meta[item.id] = {
            type: 'divider',
            level: 0,
            parentGroup: null
          }
          continue
        }

        if (item.kind === 'header') {
          // É considerado Rótulo de Seção se for tudo em maiúsculas E não possuir ícone específico de grupo
          const isSection = (item.label && item.label.trim() === item.label.trim().toUpperCase()) &&
                            (!item.icon || item.icon === 'mdi-format-title')
          if (isSection) {
            currentGroup = null
            currentGroupCount = 0
            meta[item.id] = {
              type: 'section',
              level: 0,
              parentGroup: null
            }
          } else {
            currentGroup = item
            currentGroupCount = 0
            meta[item.id] = {
              type: 'group',
              level: 0,
              parentGroup: null,
              subitemCount: 0
            }
          }
          continue
        }

        if (item.kind === 'link') {
          if (currentGroup) {
            currentGroupCount++
            meta[currentGroup.id].subitemCount = currentGroupCount

            // Verifica se o próximo item ainda é link do mesmo grupo
            let isLast = true
            for (let j = i + 1; j < raw.length; j++) {
              if (raw[j].kind === 'link') {
                isLast = false
                break
              } else if (raw[j].kind === 'header' || raw[j].kind === 'divider') {
                isLast = true
                break
              }
            }

            meta[item.id] = {
              type: 'sublink',
              level: 1,
              parentGroup: currentGroup,
              isLastInGroup: isLast,
              indexInGroup: currentGroupCount
            }
            continue
          }

          meta[item.id] = {
            type: 'toplink',
            level: 0,
            parentGroup: null
          }
        }
      }
      return meta
    },
    editorHeaderTitle () {
      if (!this.current || !this.current.kind) return 'Configuração do Item'
      if (this.current.kind === 'link') {
        return this.isItemSublink(this.current) ? 'Editar Subitem de Grupo' : 'Editar Link de Navegação'
      }
      if (this.current.kind === 'header') {
        return this.isHeaderSection(this.current) ? 'Editar Rótulo de Seção' : 'Editar Grupo com Subitens'
      }
      if (this.current.kind === 'divider') {
        return 'Editar Separador de Linha'
      }
      return 'Configuração do Item'
    },
    editorHeaderIcon () {
      if (!this.current || !this.current.kind) return 'mdi-cog-outline'
      if (this.current.kind === 'link') {
        return this.isItemSublink(this.current) ? 'mdi-file-tree' : 'mdi-link'
      }
      if (this.current.kind === 'header') {
        return this.isHeaderSection(this.current) ? 'mdi-format-header-pound' : 'mdi-folder-outline'
      }
      if (this.current.kind === 'divider') {
        return 'mdi-minus'
      }
      return 'mdi-cog-outline'
    }
  },
  watch: {
    currentLang (newValue, oldValue) {
      this.$nextTick(() => {
        if (this.currentTree.length > 0) {
          this.current = this.currentTree[0]
        } else {
          this.current = {}
        }
      })
    },
    trees: {
      immediate: true,
      handler (val) {
        if (val && (!this.current || !this.current.id) && this.currentTree.length > 0) {
          this.current = this.currentTree[0]
        }
      }
    }
  },
  mounted () {
    this.$nextTick(() => {
      if (this.currentTree && this.currentTree.length > 0 && (!this.current || !this.current.id)) {
        this.current = this.currentTree[0]
      }
    })
  },
  methods: {
    getItemClasses (item, index) {
      const meta = this.getNavItemMeta(item, index)
      return {
        'is-section': meta.type === 'section',
        'is-group': meta.type === 'group',
        'is-sublink': meta.type === 'sublink',
        'is-toplink': meta.type === 'toplink',
        'is-divider': meta.type === 'divider',
        'is-last-subitem': !!meta.isLastInGroup
      }
    },
    getNavItemMeta (item, index) {
      if (item && item.id && this.navTreeMeta[item.id]) {
        return this.navTreeMeta[item.id]
      }
      return { type: item.kind === 'header' ? 'group' : (item.kind || 'link'), level: 0 }
    },
    isHeaderSection (item) {
      if (!item || item.kind !== 'header') return false
      return (item.label && item.label.trim() === item.label.trim().toUpperCase()) &&
             (!item.icon || item.icon === 'mdi-format-title')
    },
    setHeaderType (item, type) {
      if (!item || item.kind !== 'header') return
      if (type === 'section') {
        item.label = (item.label || 'SEÇÃO').toUpperCase()
        item.icon = ''
      } else {
        item.label = _.startCase(_.toLower(item.label || 'Novo Grupo'))
        if (!item.icon || item.icon === 'mdi-format-title') {
          item.icon = 'mdi-folder-outline'
        }
      }
    },
    toggleHeaderType (item) {
      if (this.isHeaderSection(item)) {
        this.setHeaderType(item, 'group')
      } else {
        this.setHeaderType(item, 'section')
      }
    },
    isItemSublink (item) {
      if (!item || item.kind !== 'link') return false
      const meta = this.navTreeMeta[item.id]
      return !!(meta && meta.type === 'sublink')
    },
    getParentGroupName (item) {
      if (!item) return ''
      const meta = this.navTreeMeta[item.id]
      if (meta && meta.parentGroup) {
        return meta.parentGroup.label || 'Grupo'
      }
      return ''
    },
    moveItemUp (item) {
      const idx = this.currentTree.indexOf(item)
      if (idx > 0) {
        const newTree = [...this.currentTree]
        const temp = newTree[idx - 1]
        newTree[idx - 1] = item
        newTree[idx] = temp
        this.currentTree = newTree
      }
    },
    moveItemDown (item) {
      const idx = this.currentTree.indexOf(item)
      if (idx !== -1 && idx < this.currentTree.length - 1) {
        const newTree = [...this.currentTree]
        const temp = newTree[idx + 1]
        newTree[idx + 1] = item
        newTree[idx] = temp
        this.currentTree = newTree
      }
    },
    detachFromGroup (item) {
      const idx = this.currentTree.indexOf(item)
      if (idx !== -1) {
        const divider = {
          id: uuid(),
          kind: 'divider',
          visibilityMode: 'all',
          visibilityGroups: []
        }
        const newTree = [...this.currentTree]
        newTree.splice(idx, 0, divider)
        this.currentTree = newTree
      }
    },
    addDividerAfter (item) {
      const idx = this.currentTree.indexOf(item)
      if (idx !== -1) {
        const divider = {
          id: uuid(),
          kind: 'divider',
          visibilityMode: 'all',
          visibilityGroups: []
        }
        const newTree = [...this.currentTree]
        newTree.splice(idx + 1, 0, divider)
        this.currentTree = newTree
      }
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
    addItem(type) {
      let newItem = {
        id: uuid(),
        kind: 'link',
        visibilityMode: 'all',
        visibilityGroups: []
      }
      switch (type) {
        case 'link':
          newItem = {
            ...newItem,
            kind: 'link',
            label: 'Novo Link',
            icon: 'mdi-chevron-right',
            targetType: 'page',
            target: ''
          }
          break
        case 'group':
          newItem = {
            ...newItem,
            kind: 'header',
            label: 'Novo Grupo',
            icon: 'mdi-folder-outline'
          }
          break
        case 'section':
          newItem = {
            ...newItem,
            kind: 'header',
            label: 'NOVA SEÇÃO',
            icon: ''
          }
          break
        case 'header':
          newItem = {
            ...newItem,
            kind: 'header',
            label: 'Novo Grupo',
            icon: 'mdi-folder-outline'
          }
          break
        case 'divider':
          newItem = {
            ...newItem,
            kind: 'divider'
          }
          break
      }
      this.currentTree = [...this.currentTree, newItem]
      this.current = newItem
    },
    deleteItem(item) {
      this.currentTree = _.pull(this.currentTree, item)
      this.current = {}
    },
    selectItem(item) {
      this.current = item
    },
    selectPage() {
      this.selectPageModal = true
    },
    selectPageHandle ({ path, locale }) {
      this.current.target = `/${locale}/${path}`
    },
    copyFromLocale () {
      this.copyFromLocaleDialogIsShown = false
      this.currentTree = [...this.currentTree, ..._.get(_.find(this.trees, ['locale', this.copyFromLocaleCode]), 'items', null) || []]
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-navigation-save')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($tree: [NavigationTreeInput]!, $mode: NavigationMode!) {
              navigation{
                updateTree(tree: $tree) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                },
                updateConfig(mode: $mode) {
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
            tree: this.trees,
            mode: this.config.mode
          }
        })
        if (_.get(resp, 'data.navigation.updateTree.responseResult.succeeded', false) && _.get(resp, 'data.navigation.updateConfig.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: this.$t('navigation.saveSuccess'),
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.navigation.updateTree.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-navigation-save')
    },
    async refresh() {
      await this.$apollo.queries.trees.refetch()
      this.current = {}
      this.$store.commit('showNotification', {
        message: 'Navigation has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    }
  },
  apollo: {
    config: {
      query: gql`
        {
          navigation {
            config {
              mode
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.navigation.config),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-navigation-config')
      }
    },
    trees: {
      query: gql`
        {
          navigation {
            tree {
              locale
              items {
                id
                kind
                label
                icon
                targetType
                target
                visibilityMode
                visibilityGroups
              }
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.navigation.tree),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-navigation-tree')
      }
    },
    groups: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.groups.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-navigation-groups')
      }
    },
    allLocales: {
      query: gql`
        {
          localization {
            locales {
              code
              name
              nativeName
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => data.localization.locales,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-navigation-locales')
      }
    }
  }
}
</script>

<style lang='scss'>
@import '../../themes/detran/scss/variables';

// =============================================================================
// DETRAN-MG — Admin Navigation Editor
// =============================================================================

.admin-header-title {
  .headline {
    color: $detran-800 !important;
    font-weight: 700 !important;
  }
}

// -----------------------------------------------------------------------------
// Cards e Cabeçalhos Padrão Detran
// -----------------------------------------------------------------------------
.detran-card {
  border-radius: $radius-xl !important;
  border: 1px solid $slate-200 !important;
  box-shadow: $shadow-soft !important;
  overflow: hidden;
  background: #ffffff !important;

  .v-list-item {
    border-radius: 8px !important;
    margin: 4px 8px !important;
    transition: all 0.15s ease !important;

    &:hover {
      background-color: $slate-50 !important;
    }

    &--active {
      background-color: rgba($detran-500, 0.08) !important;
      border: 1px solid rgba($detran-500, 0.25) !important;

      .v-list-item__title {
        color: $detran-800 !important;
        font-weight: 600 !important;
      }
    }
  }
}

.detran-card-header {
  border-bottom: 1px solid $slate-200;
  background-color: #ffffff;
  height: 56px;

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
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: $font-family-base;
  }
}

// Container Geral da Seção de Navegação (Menu + Editor)
.detran-nav-container {
  border-radius: $radius-xl !important;
  border: 1px solid $slate-200 !important;
  box-shadow: $shadow-soft !important;
  overflow: hidden !important;
  background: #ffffff !important;
}

// -----------------------------------------------------------------------------
// Coluna Esquerda: Painel de Pré-visualização do Menu do Portal
// -----------------------------------------------------------------------------
.detran-nav-panel {
  background: linear-gradient(180deg, #134e2c 0%, #0c381e 50%, #0a2e18 100%) !important;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid $slate-200;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.detran-nav-topbar {
  height: 56px;
  background-color: #0c381e !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;

  .detran-lang-pill {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #a7f3d0;
    background: rgba(95, 195, 129, 0.15);
    border: 1px solid rgba(95, 195, 129, 0.3);
    padding: 3px 10px;
    border-radius: 12px;
    letter-spacing: 0.03em;
  }

  .detran-nav-lang-select {
    max-width: 160px;

    .v-input__control,
    .v-input__slot {
      background-color: rgba(255, 255, 255, 0.14) !important;
      border: 1px solid rgba(255, 255, 255, 0.22) !important;
      border-radius: 8px !important;
      height: 34px !important;
      min-height: 34px !important;
      box-shadow: none !important;
      padding: 0 8px !important;
    }

    .v-select__selection {
      color: #ffffff !important;
      font-size: 0.8125rem !important;
      font-weight: 500 !important;
    }

    .v-icon {
      color: rgba(255, 255, 255, 0.7) !important;
    }
  }
}

.detran-nav-list-wrapper {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;

  &::-webkit-scrollbar {
    width: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
}

.detran-nav-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
}

// Itens da Árvore de Navegação
.detran-nav-item {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  margin: 2px 4px;
  border-radius: 10px;
  color: #cce0d2;
  cursor: pointer;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;

  .drag-handle {
    color: rgba(255, 255, 255, 0.25);
    cursor: grab;
    transition: color 0.15s ease;
    margin-right: 4px;
    flex-shrink: 0;

    &:hover {
      color: rgba(255, 255, 255, 0.9);
    }
  }

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    transform: translateX(3px);

    .drag-handle {
      color: rgba(255, 255, 255, 0.7);
    }

    .detran-nav-item__label,
    .detran-nav-item__sublabel {
      color: #ffffff !important;
    }

    .v-icon {
      color: #ffffff !important;
    }
  }

  // Estado Ativo / Selecionado
  &.is-selected {
    background: rgba(255, 255, 255, 0.18) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    border-left: 3px solid #5fc381 !important;
    color: #ffffff !important;
    font-weight: 600;
    transform: translateX(3px);

    .detran-nav-item__label,
    .detran-nav-item__sublabel {
      color: #ffffff !important;
      font-weight: 600;
    }

    .v-icon {
      color: #ffffff !important;
    }
  }

  // 1. Rótulo de Seção (ACESSO RÁPIDO)
  &.is-section {
    padding: 10px 8px 4px 8px;
    margin-top: 12px;
    margin-bottom: 2px;
    border-radius: 6px;
    background: transparent;

    .detran-nav-item__section-title {
      font-size: 0.6875rem; // 11px
      font-weight: 700;
      color: rgba(255, 255, 255, 0.60);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    &.is-selected {
      background: rgba(255, 255, 255, 0.12) !important;
      border-left: 3px solid #38bdf8 !important;

      .detran-nav-item__section-title {
        color: #ffffff !important;
      }
    }
  }

  // 2. Grupo com Subitens (Habilitação)
  &.is-group {
    font-size: 0.9375rem;
    font-weight: 500;
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 4px;
    margin-bottom: 2px;

    .detran-nav-item__icon-box {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 6px;
      flex-shrink: 0;
    }

    .detran-nav-item__label {
      font-size: 0.9375rem;
      color: #cce0d2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .detran-nav-item__chevron {
      margin-left: 4px;
      flex-shrink: 0;
    }
  }

  // 3. Subitem (Renovação de CNH)
  &.is-sublink {
    margin-left: 26px !important;
    margin-right: 4px;
    padding: 5px 8px;
    font-size: 0.8125rem; // 13px

    .detran-nav-item__branch-line {
      position: absolute;
      left: -13px;
      top: 0;
      bottom: 0;
      width: 13px;
      border-left: 2px solid rgba(255, 255, 255, 0.22);
      pointer-events: none;

      &::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        width: 9px;
        height: 2px;
        background: rgba(255, 255, 255, 0.22);
      }
    }

    &.is-last-subitem .detran-nav-item__branch-line {
      bottom: 50%;
      border-bottom-left-radius: 4px;
    }

    .detran-nav-item__subicon-box {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 4px;
      flex-shrink: 0;
    }

    .detran-nav-item__sublabel {
      font-size: 0.8125rem;
      color: #cce0d2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  // 4. Link Principal (1º Nível)
  &.is-toplink {
    font-size: 0.9375rem;
    font-weight: 500;

    .detran-nav-item__icon-box {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 6px;
      flex-shrink: 0;
    }

    .detran-nav-item__label {
      font-size: 0.9375rem;
      color: #cce0d2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  // 5. Separador
  &.is-divider {
    padding: 6px 8px;
    margin: 8px 4px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 6px;

    .detran-nav-item__divider-line {
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.18);
    }

    .detran-nav-item__divider-label {
      font-size: 0.5625rem; // 9px
      font-weight: 700;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.5);
      padding: 0 8px;
      text-transform: uppercase;
    }

    &.is-selected {
      background: rgba(255, 255, 255, 0.15) !important;
      border-left: 3px solid #f59e0b !important;
    }
  }
}

// Chips e Tags
.detran-nav-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;

  &.is-section-badge {
    background: rgba(56, 189, 248, 0.2);
    color: #7dd3fc;
  }

  &.is-group-badge {
    background: rgba(95, 195, 129, 0.2);
    color: #a7f3d0;
  }

  &.is-target-badge {
    font-weight: 600;
    background: rgba(0, 0, 0, 0.25);
    color: rgba(255, 255, 255, 0.55);
  }
}

.detran-nav-count-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(95, 195, 129, 0.25);
  color: #a7f3d0;
  margin-right: 4px;
  flex-shrink: 0;
}

// Drag Ghost
.detran-nav-drag-ghost {
  opacity: 0.45;
  background: rgba(95, 195, 129, 0.25) !important;
  border: 2px dashed #5fc381 !important;
  border-radius: 8px;
}

// Rodapé do Menu (Botão Adicionar)
.detran-nav-bottombar {
  background-color: #0a2e18 !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
  flex-shrink: 0;
}

// Botão Primário Detran
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

// -----------------------------------------------------------------------------
// Coluna Direita: Editor do Item
// -----------------------------------------------------------------------------
.detran-editor-col {
  background-color: #ffffff !important;
}

.detran-editor-panel {
  height: 100%;
  display: flex;
  flex-direction: column;

  .v-text-field--outlined,
  .v-select--outlined {
    .v-input__control .v-input__slot {
      border-radius: 8px !important;
    }
  }
}

// Botão de Excluir Padrão Detran
.detran-btn-delete {
  border-radius: 8px !important;
  text-transform: none !important;
  font-weight: 600 !important;
  border-color: #fecaca !important;
  color: #dc2626 !important;
  background-color: #fff5f5 !important;

  &:hover {
    background-color: #fee2e2 !important;
    border-color: #f87171 !important;
  }

  .v-icon {
    color: #dc2626 !important;
  }
}

// Banner Informativo de Hierarquia
.detran-info-banner {
  background-color: $detran-50;
  border: 1px solid $detran-200;
  border-left: 4px solid $detran-500;
  border-radius: 10px;

  .detran-info-badge {
    width: 36px;
    height: 36px;
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
    font-size: 0.875rem;
  }

  .detran-info-text {
    color: $slate-600;
    font-size: 0.75rem;
    line-height: 1.4;
  }
}

// Botões Secundários de Ação
.detran-btn-outline-action {
  border-radius: 8px !important;
  text-transform: none !important;
  font-weight: 500 !important;
  font-size: 0.8125rem !important;
  letter-spacing: normal !important;
  height: 32px !important;
  border-color: $slate-300 !important;
  color: $slate-700 !important;
  background-color: #ffffff !important;

  &:hover {
    background-color: $slate-50 !important;
    border-color: $slate-400 !important;
    color: $slate-900 !important;
  }

  &.primary--text {
    border-color: rgba($detran-500, 0.4) !important;
    color: $detran-700 !important;

    &:hover {
      background-color: $detran-50 !important;
      border-color: $detran-500 !important;
    }
  }
}

// Chips Sugeridos de Ícones
.detran-suggested-chip {
  border-radius: 6px !important;
  font-size: 0.75rem !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  border-color: $slate-200 !important;
  background-color: $slate-50 !important;
  color: $slate-700 !important;
  transition: all 0.15s ease !important;
  height: 24px !important;

  &:hover {
    background-color: $detran-50 !important;
    border-color: $detran-400 !important;
    color: $detran-700 !important;
  }
}

// Caixa de Destino de Página
.detran-target-page-box {
  background-color: $slate-50;
  border: 1px solid $slate-200;
  border-radius: 8px;
  min-height: 48px;
  box-sizing: border-box;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: $slate-300;
  }

  .detran-target-code {
    background: #e2e8f0;
    color: #1e293b;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: monospace;
  }
}

// Estado Vazio do Editor
.detran-empty-editor {
  .detran-empty-icon {
    width: 64px;
    height: 64px;
    background-color: $slate-100;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

// Grupo de seleção de modo
.v-list-item-group {
  .v-list-item--active {
    background-color: rgba($detran-500, 0.08) !important;
  }
}

.clickable {
  cursor: pointer;

  &:hover {
    background-color: rgba($detran-500, 0.15);
  }
}
</style>

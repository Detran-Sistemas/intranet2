<template lang='pug'>
  .detran-workflow-review-page

    //- Barra de Carregamento Superior Suave
    v-progress-linear.mb-4.rounded(
      v-if='loading'
      indeterminate
      color='#288b4a'
      height='3'
    )

    //- ========================================================================
    //- CABEÇALHO DA PÁGINA (Breadcrumb + Título + Pill de Status + Ações)
    //- Segue exatamente o padrão .detran-page-header de page.vue
    //- ========================================================================
    .detran-page-header
      nav.detran-breadcrumb(aria-label='Trilha de navegação')
        a.detran-breadcrumb__home(href='/' title='Início')
          v-icon(size='14' color='#94a3b8') mdi-home
        span.detran-breadcrumb__sep(aria-hidden='true') /
        router-link.detran-breadcrumb__item(to='/') Governança &amp; Workflow
        span.detran-breadcrumb__sep(aria-hidden='true') /
        span.detran-breadcrumb__item.is-current {{ 'Revisão #' + (draft.id || draftId) }}

      .detran-page-header__row
        .detran-page-header__title-group
          h2.detran-page-title {{ draft.title || 'Revisão de Documento' }}
          span.detran-review-status-pill(:class='stateBadge.pillClass')
            v-icon(size='13' :color='stateBadge.iconColor') {{ stateBadge.icon }}
            span {{ stateBadge.label }}

        .detran-review-header-btns
          button.detran-back-btn(
            type='button'
            @click='goBack'
            title='Voltar para a Central de Tarefas'
          )
            v-icon(size='16') mdi-arrow-left
            span Voltar
          a.detran-edit-inline-btn(
            v-if='draft.path'
            :href='"/" + (draft.locale || "pt-br") + "/" + draft.path'
            title='Abrir página no portal'
          )
            v-icon(size='14') mdi-open-in-new
            span Ver Página no Portal

    //- ========================================================================
    //- CORPO EM 2 COLUNAS (.detran-page-body): Artigo Principal + Coluna Lateral
    //- ========================================================================
    .detran-page-body

      //- COLUNA PRINCIPAL: Card .detran-article
      article.detran-article.detran-review-article

        //- Cabeçalho de Metadados do Artigo (padrão idêntico ao page.vue)
        header.detran-article__header
          .detran-article__meta-left
            .detran-article__icon(aria-hidden='true')
              v-icon(color='#288b4a' size='22') mdi-file-compare
            .detran-article__meta
              p.detran-article__category
                | Homologação Editorial • {{ draft.approvalMode === '2_levels' ? 'Fluxo em 2 Níveis (Revisão Técnica + Homologação)' : 'Fluxo de Revisão Direta (1 Nível)' }}
              .detran-article__meta-row
                span.detran-article__meta-item
                  v-icon(size='12' color='#94a3b8') mdi-folder-outline
                  | /{{ draft.locale }}/{{ draft.path }}
                span.detran-article__meta-sep(aria-hidden='true') •
                span.detran-article__meta-item
                  v-icon(size='12' color='#94a3b8') mdi-account-outline
                  | Autor: {{ draft.authorName || 'Servidor' }}
                span.detran-article__meta-sep(aria-hidden='true') •
                span.detran-article__meta-item
                  v-icon(size='12' color='#94a3b8') mdi-history
                  | Submetido em {{ draft.updatedAt | moment('DD/MM/YYYY [às] HH:mm') }}
              .detran-article__tags
                span.detran-tag {{ draft.pageId ? '#DOCUMENTO-' + draft.pageId : '#NOVA-PÁGINA' }}
                span.detran-tag(
                  v-for='tag in (draft.tags || [])'
                  :key='tag'
                ) {{ '#' + tag }}

          //- Seletor de Modo de Visualização (Lado a Lado / Linha a Linha)
          .detran-article__actions
            .detran-diff-switcher(role='group' aria-label='Modo de comparação')
              button.detran-diff-switcher__btn(
                type='button'
                :class='{ "is-active": viewMode === "side-by-side" }'
                @click='viewMode = "side-by-side"'
              )
                v-icon(size='14') mdi-view-column-outline
                span Lado a Lado
              button.detran-diff-switcher__btn(
                type='button'
                :class='{ "is-active": viewMode === "line-by-line" }'
                @click='viewMode = "line-by-line"'
              )
                v-icon(size='14') mdi-view-sequential-outline
                span Linha a Linha

        //- Callout com o Resumo de Alterações enviado pelo Autor (se houver)
        .detran-author-summary-callout(v-if='latestSubmitComment')
          .detran-author-summary-callout__icon
            v-icon(size='18' color='#d97706') mdi-file-document-edit-outline
          .detran-author-summary-callout__body
            .detran-author-summary-callout__title Resumo das alterações informado pelo autor
            .detran-author-summary-callout__text "{{ latestSubmitComment }}"

        //- Card do Comparativo de Alterações (Diff)
        .detran-diff-box
          .detran-diff-box__bar
            .detran-diff-box__legend
              span.detran-diff-box__pill.is-removed
                v-icon(size='12' color='#dc2626') mdi-minus-circle-outline
                span Versão no Ar
              v-icon(size='14' color='#94a3b8') mdi-arrow-right
              span.detran-diff-box__pill.is-added
                v-icon(size='12' color='#16a34a') mdi-plus-circle-outline
                span Rascunho Proposto
            .detran-diff-box__hint
              v-icon(size='13' color='#64748b') mdi-cursor-default-click-outline
              span Clique no número de uma linha para registrar uma anotação

          //- Sem diferenças
          .detran-diff-empty(v-if='!loading && !hasDifferences')
            .detran-diff-empty__icon
              v-icon(size='32' color='#288b4a') mdi-check-decagram-outline
            h4.detran-diff-empty__title Conteúdo idêntico à versão publicada
            p.detran-diff-empty__subtitle Não foram detectadas diferenças textuais entre o rascunho atual e a página no ar.

          //- Tabela Diff2Html
          .detran-diff-html-wrapper(
            v-else
            v-html='diffHTML'
            @click='handleDiffClick'
          )

        //- Barra Institucional de Decisão e Homologação (Rodapé do Card)
        .detran-review-decision-bar
          .detran-review-decision-bar__status
            .detran-review-decision-bar__icon(:class='unresolvedCommentsCount > 0 ? "is-amber" : "is-emerald"')
              v-icon(
                size='18'
                :color='unresolvedCommentsCount > 0 ? "#d97706" : "#1b6535"'
              ) {{ unresolvedCommentsCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-shield-check-outline' }}
            .detran-review-decision-bar__info
              .detran-review-decision-bar__headline
                template(v-if='draft.state === "published"') Documento Homologado e Publicado Oficialmente
                template(v-else-if='unresolvedCommentsCount > 0') {{ unresolvedCommentsCount }} anotação(ões) pendente(s) de resolução
                template(v-else) Nenhuma pendência em aberto — Documento apto para homologação
              .detran-review-decision-bar__sub {{ actionsHelper.statusDescription }}

          .detran-review-decision-bar__actions
            //- Solicitar Ajustes
            button.detran-wf-btn.detran-wf-btn--warning(
              v-if='actionsHelper.canRequestChanges'
              type='button'
              :disabled='submittingAction'
              @click='openActionDialog("requestChanges")'
            )
              v-icon(size='15') mdi-undo-variant
              span Solicitar Ajustes

            //- Aprovar Nível 1 (Revisão Técnica)
            button.detran-wf-btn.detran-wf-btn--primary(
              v-if='actionsHelper.canApproveStep'
              type='button'
              :disabled='submittingAction'
              @click='openActionDialog("approveStep")'
            )
              v-icon(size='15') mdi-check-all
              span {{ actionsHelper.labelApproveStep }}

            //- Homologar e Publicar
            button.detran-wf-btn.detran-wf-btn--publish(
              v-if='actionsHelper.canPublish'
              type='button'
              :disabled='submittingAction'
              @click='openActionDialog("publish")'
            )
              v-icon(size='15') mdi-cloud-upload-outline
              span {{ actionsHelper.labelPublish }}

            //- Revalidar Vigência (+12m)
            button.detran-wf-btn.detran-wf-btn--teal(
              v-if='actionsHelper.canRevalidate'
              type='button'
              :disabled='submittingAction'
              @click='openActionDialog("revalidate")'
            )
              v-icon(size='15') mdi-autorenew
              span {{ actionsHelper.labelRevalidate || 'Revalidar Vigência (+12m)' }}

            //- Ver Página Publicada (quando já publicado)
            a.detran-wf-btn.detran-wf-btn--publish(
              v-if='draft.state === "published" && draft.path'
              :href='"/" + (draft.locale || "pt-br") + "/" + draft.path'
            )
              v-icon(size='15') mdi-check-circle-outline
              span Abrir Página Publicada

      //- COLUNA LATERAL DIREITA (.detran-review-aside): Anotações + Histórico
      aside.detran-review-aside(aria-label='Anotações e histórico da revisão')
        .detran-review-side-card
          review-comments(
            :draft-id='draftId'
            :comments='draft.comments || []'
            :selected-line='selectedLine'
            :selected-text='selectedText'
            @select-line='onSelectLine'
            @clear-line='selectedLine = 0; selectedText = ""'
            @comment-added='onCommentAdded'
            @comment-resolved='onCommentResolved'
          )

        //- Card de Histórico de Tramitação
        .detran-review-side-card.mt-4(v-if='draft.events && draft.events.length > 0')
          .detran-side-history__header
            v-icon(size='16' color='#288b4a') mdi-timeline-clock-outline
            h4.detran-side-history__title Histórico de Tramitação
          .detran-side-history__list
            .detran-side-history__item(
              v-for='evt in draft.events'
              :key='evt.id'
            )
              .detran-side-history__dot(:class='getEventDotClass(evt.action)')
              .detran-side-history__content
                .detran-side-history__row
                  span.detran-side-history__action {{ formatEventAction(evt.action) }}
                  span.detran-side-history__date {{ evt.createdAt | moment('DD/MM HH:mm') }}
                .detran-side-history__comment(v-if='evt.comment') "{{ evt.comment }}"

    //- ========================================================================
    //- MODAL INSTITUCIONAL DE CONFIRMAÇÃO (Padrão idêntico ao validation-modal)
    //- ========================================================================
    v-dialog(
      v-model='actionDialog.visible'
      max-width='520'
      content-class='detran-validation-dialog'
      persistent
    )
      .detran-action-modal
        .detran-action-modal__header(:class='actionDialog.headerClass')
          .detran-action-modal__header-left
            .detran-action-modal__header-icon
              v-icon(color='#a7f3d0' size='20') {{ actionDialog.icon }}
            div
              h3.detran-action-modal__title {{ actionDialog.title }}
              p.detran-action-modal__subtitle Trâmite oficial de governança Detran-MG
          button.detran-action-modal__close(
            type='button'
            :disabled='submittingAction'
            @click='actionDialog.visible = false'
          )
            v-icon(color='#a7f3d0' size='20') mdi-close

        .detran-action-modal__body
          .detran-action-modal__callout(:class='actionDialog.type === "requestChanges" ? "is-amber" : "is-emerald"')
            v-icon.mt-0.mr-2(
              size='18'
              :color='actionDialog.type === "requestChanges" ? "#d97706" : "#1b6535"'
            ) {{ actionDialog.type === 'requestChanges' ? 'mdi-alert-circle-outline' : 'mdi-check-decagram-outline' }}
            div
              p.detran-action-modal__callout-text {{ actionDialog.description }}
              p.detran-action-modal__callout-warn(
                v-if='actionDialog.type === "publish" && unresolvedCommentsCount > 0'
              ) Atenção: existem {{ unresolvedCommentsCount }} anotação(ões) ainda pendente(s) neste documento.

          div
            label.detran-action-modal__label {{ actionDialog.commentLabel }}
            textarea.detran-action-modal__textarea(
              v-model='actionDialog.comment'
              rows='3'
              :placeholder='actionDialog.commentPlaceholder'
              @input='actionDialog.error = ""'
            )
            p.detran-action-modal__error(v-if='actionDialog.error') {{ actionDialog.error }}

          .detran-action-modal__meta
            span Documento: #[strong {{ draft.title || draft.path }}]
            span Trâmite institucional Detran-MG

        .detran-action-modal__footer
          button.detran-action-modal__cancel(
            type='button'
            :disabled='submittingAction'
            @click='actionDialog.visible = false'
          ) Cancelar
          button.detran-action-modal__submit(
            type='button'
            :class='actionDialog.type === "requestChanges" ? "is-warning" : ""'
            :disabled='submittingAction'
            @click='executeAction'
          )
            v-progress-circular(
              v-if='submittingAction'
              indeterminate
              size='15'
              width='2'
              color='#ffffff'
            )
            v-icon(v-else size='15' color='#ffffff') mdi-check
            span Confirmar e Prosseguir
</template>

<script>
/* unused diff2html */
/* unused diff */
/* unused lodash */
import gql from 'graphql-tag'
import ReviewComments from './review-comments.vue'
import {
  generateDiffPatch,
  renderDiffHtml,
  getAvailableReviewActions,
  extractLineFromDiffElement
} from '../../store/detran-workflow-review'

export default {
  name: 'DetranWorkflowReview',
  components: {
    ReviewComments
  },
  props: {
    id: {
      type: [Number, String],
      default: null
    }
  },
  data () {
    return {
      loading: true,
      submittingAction: false,
      viewMode: 'side-by-side',
      drawerComments: true,
      selectedLine: 0,
      selectedText: '',
      draft: {
        id: 0,
        pageId: null,
        path: '',
        locale: 'pt-br',
        title: '',
        description: '',
        content: '',
        tags: [],
        state: 'in_review',
        approvalMode: '1_level',
        currentLevel: 1,
        authorName: '',
        comments: [],
        events: []
      },
      livePage: {
        content: '',
        title: '',
        description: ''
      },
      actionDialog: {
        visible: false,
        type: '',
        title: '',
        description: '',
        commentLabel: 'Parecer / Observações',
        commentPlaceholder: '',
        comment: '',
        icon: 'mdi-check',
        headerClass: 'detran-header-success',
        confirmColor: 'success',
        error: ''
      }
    }
  },
  computed: {
    draftId () {
      const paramId = this.$route && this.$route.params && this.$route.params.id
      return parseInt(this.id || paramId, 10) || 0
    },

    unresolvedCommentsCount () {
      return (this.draft.comments || []).filter(c => !c.resolved).length
    },

    latestSubmitComment () {
      const evts = this.draft.events || []
      const sub = evts.find(e => e && e.action === 'submit' && e.comment)
      return sub ? sub.comment : ''
    },

    diffPatch () {
      return generateDiffPatch({
        path: this.draft.path || 'documento',
        originalContent: this.livePage.content || '',
        draftContent: this.draft.content || ''
      })
    },

    diffHTML () {
      return renderDiffHtml({
        patch: this.diffPatch,
        viewMode: this.viewMode
      })
    },

    hasDifferences () {
      const orig = (this.livePage.content || '').trim()
      const draft = (this.draft.content || '').trim()
      return orig !== draft
    },

    actionsHelper () {
      return getAvailableReviewActions(this.draft)
    },

    stateBadge () {
      switch (this.draft.state) {
        case 'in_review':
          return {
            label: 'Em Revisão Técnica',
            pillClass: 'is-blue',
            iconColor: '#1d4ed8',
            icon: 'mdi-file-find-outline'
          }
        case 'awaiting_approval':
        case 'in_approval_step2':
          return {
            label: 'Aguardando Homologação Final',
            pillClass: 'is-emerald',
            iconColor: '#1b6535',
            icon: 'mdi-stamper'
          }
        case 'changes_requested':
          return {
            label: 'Ajustes Solicitados',
            pillClass: 'is-amber',
            iconColor: '#b45309',
            icon: 'mdi-alert-circle-outline'
          }
        case 'published':
          return {
            label: 'Publicado Oficialmente',
            pillClass: 'is-emerald',
            iconColor: '#1b6535',
            icon: 'mdi-check-decagram'
          }
        case 'periodic_review':
        case 'revisao_periodica':
          return {
            label: 'Revisão Periódica Anual',
            pillClass: 'is-amber',
            iconColor: '#c2410c',
            icon: 'mdi-calendar-clock'
          }
        default:
          return {
            label: 'Rascunho',
            pillClass: 'is-slate',
            iconColor: '#475569',
            icon: 'mdi-pencil-outline'
          }
      }
    }
  },
  watch: {
    draftId: {
      immediate: true,
      handler (newId) {
        if (newId > 0) {
          this.loadReviewData(newId)
        }
      }
    }
  },
  methods: {
    goBack () {
      if (window.history.length > 1) {
        this.$router.go(-1)
      } else {
        this.$router.push('/')
      }
    },

    formatEventAction (action) {
      switch (action) {
        case 'submit':
          return 'Submetido para validação'
        case 'approve_step':
          return 'Nível 1 aprovado'
        case 'publish':
          return 'Homologado e publicado'
        case 'request_changes':
          return 'Ajustes solicitados'
        case 'revalidate':
          return 'Vigência revalidada (+12m)'
        default:
          return action
      }
    },

    getEventDotClass (action) {
      if (action === 'publish' || action === 'approve_step' || action === 'revalidate') return 'is-emerald'
      if (action === 'request_changes') return 'is-amber'
      return 'is-blue'
    },

    async loadReviewData (id) {
      this.loading = true
      try {
        const result = await this.$apollo.query({
          query: gql`
            query ($id: Int!) {
              workflow {
                draft(id: $id) {
                  id
                  pageId
                  path
                  locale
                  title
                  description
                  content
                  contentType
                  editorKey
                  tags
                  state
                  approvalMode
                  currentLevel
                  authorId
                  authorName
                  authorEmail
                  baseHash
                  reviewDueDate
                  createdAt
                  updatedAt
                  events {
                    id
                    action
                    fromState
                    toState
                    userId
                    userName
                    comment
                    createdAt
                  }
                  comments {
                    id
                    draftId
                    userId
                    userName
                    lineNumber
                    anchorText
                    body
                    resolved
                    createdAt
                    updatedAt
                  }
                }
              }
            }
          `,
          variables: { id },
          fetchPolicy: 'network-only'
        })

        const draftData = result && result.data && result.data.workflow && result.data.workflow.draft
        if (!draftData) {
          this.$store.commit('showNotification', {
            style: 'red',
            icon: 'alert',
            message: 'Rascunho de revisão não encontrado.'
          })
          return
        }

        this.draft = draftData

        if (draftData.pageId) {
          await this.loadLivePageContent(draftData.pageId)
        } else if (draftData.path) {
          await this.loadLivePageByPath(draftData.path, draftData.locale || 'pt-br')
        } else {
          this.livePage = {
            content: '',
            title: '',
            description: ''
          }
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: err.message || 'Erro ao carregar dados de revisão.'
        })
      } finally {
        this.loading = false
      }
    },

    async loadLivePageByPath (path, locale) {
      try {
        const result = await this.$apollo.query({
          query: gql`
            query ($path: String!, $locale: String!) {
              pages {
                singleByPath(path: $path, locale: $locale) {
                  id
                  path
                  locale
                  title
                  description
                  content
                  isPublished
                  updatedAt
                }
              }
            }
          `,
          variables: { path, locale },
          fetchPolicy: 'network-only'
        })
        const page = result && result.data && result.data.pages && result.data.pages.singleByPath
        if (page) {
          this.livePage = page
          if (!this.draft.pageId && page.id) {
            this.draft.pageId = page.id
          }
        }
      } catch (err) {
        console.warn('Não foi possível obter versão no ar por path:', err)
      }
    },

    async loadLivePageContent (pageId) {
      try {
        const result = await this.$apollo.query({
          query: gql`
            query ($id: Int!) {
              pages {
                single(id: $id) {
                  id
                  path
                  locale
                  title
                  description
                  content
                  isPublished
                  updatedAt
                }
              }
            }
          `,
          variables: { id: pageId },
          fetchPolicy: 'network-only'
        })

        const page = result && result.data && result.data.pages && result.data.pages.single
        if (page) {
          this.livePage = page
        }
      } catch (err) {
        console.warn('Não foi possível obter versão no ar:', err)
      }
    },

    handleDiffClick (event) {
      const line = extractLineFromDiffElement(event.target)
      if (line && line > 0) {
        this.selectedLine = line

        const row = event.target.closest('tr') || event.target.closest('.d2h-code-line')
        if (row) {
          const textEl = row.querySelector('.d2h-code-line-ctn') || row
          const text = (textEl.innerText || textEl.textContent || '').trim()
          this.selectedText = text.substring(0, 80)
        }
      }
    },

    onSelectLine (line) {
      this.selectedLine = line
    },

    onCommentAdded (newComment) {
      this.draft.comments = [...this.draft.comments, newComment]
      this.$store.commit('showNotification', {
        style: 'success',
        icon: 'check',
        message: 'Anotação registrada com sucesso.'
      })
    },

    onCommentResolved ({ id, resolved }) {
      this.draft.comments = this.draft.comments.map(c => {
        if (c.id === id) {
          return { ...c, resolved }
        }
        return c
      })
      this.$store.commit('showNotification', {
        style: 'success',
        icon: 'check',
        message: resolved ? 'Anotação marcada como resolvida.' : 'Anotação reaberta.'
      })
    },

    openActionDialog (type) {
      this.actionDialog.type = type
      this.actionDialog.comment = ''
      this.actionDialog.error = ''

      if (type === 'requestChanges') {
        this.actionDialog.title = 'Solicitar Ajustes ao Autor'
        this.actionDialog.description =
          'O documento retornará para a fila do autor com o status "Ajustes Solicitados". Informe os apontamentos necessários:'
        this.actionDialog.commentLabel = 'Justificativa / Parecer de Ajustes (Obrigatório):'
        this.actionDialog.commentPlaceholder = 'Descreva os motivos da devolução e os ajustes que devem ser realizados...'
        this.actionDialog.icon = 'mdi-undo-variant'
        this.actionDialog.headerClass = 'is-warning'
        this.actionDialog.confirmColor = 'orange darken-3'
      } else if (type === 'approveStep') {
        this.actionDialog.title = 'Aprovar Nível 1 (Revisão Técnica)'
        this.actionDialog.description =
          'O parecer técnico será registrado e o documento avançará para o Nível 2 (Homologação Final).'
        this.actionDialog.commentLabel = 'Parecer Técnico (Opcional):'
        this.actionDialog.commentPlaceholder = 'Observações sobre a conformidade técnica do documento...'
        this.actionDialog.icon = 'mdi-check-all'
        this.actionDialog.headerClass = 'is-emerald'
        this.actionDialog.confirmColor = 'primary'
      } else if (type === 'publish') {
        this.actionDialog.title = 'Homologar e Publicar na Intranet'
        this.actionDialog.description =
          'Esta ação é a homologação final. O conteúdo revisado será publicado oficialmente na Intranet Detran-MG.'
        this.actionDialog.commentLabel = 'Despacho de Homologação (Opcional):'
        this.actionDialog.commentPlaceholder = 'Ex: Revisado e homologado conforme diretrizes da diretoria...'
        this.actionDialog.icon = 'mdi-shield-check'
        this.actionDialog.headerClass = 'is-emerald'
        this.actionDialog.confirmColor = 'success'
      } else if (type === 'revalidate') {
        this.actionDialog.title = 'Revalidar Vigência (+12 Meses)'
        this.actionDialog.description =
          'Confirma a renovação da vigência deste ato normativo por mais 12 meses sem necessidade de alteração textual?'
        this.actionDialog.commentLabel = 'Despacho de Revalidação (Opcional):'
        this.actionDialog.commentPlaceholder = 'Ex: Normativo verificado e mantido em vigor conforme legislação atual...'
        this.actionDialog.icon = 'mdi-autorenew'
        this.actionDialog.headerClass = 'is-emerald'
        this.actionDialog.confirmColor = 'teal darken-1'
      }

      this.actionDialog.visible = true
    },

    async executeAction () {
      const { type, comment } = this.actionDialog

      if (type === 'requestChanges' && !comment.trim()) {
        this.actionDialog.error = 'A justificativa é obrigatória para solicitar ajustes.'
        return
      }

      this.submittingAction = true
      this.actionDialog.error = ''

      try {
        if (type === 'requestChanges') {
          const res = await this.$apollo.mutate({
            mutation: gql`
              mutation ($id: Int!, $comment: String!) {
                workflow {
                  requestChanges(id: $id, comment: $comment) {
                    responseResult {
                      succeeded
                      message
                    }
                    draft {
                      id
                      state
                    }
                  }
                }
              }
            `,
            variables: { id: this.draft.id, comment: comment.trim() }
          })
          const data = res && res.data && res.data.workflow && res.data.workflow.requestChanges
          if (data && data.responseResult && data.responseResult.succeeded) {
            this.draft.state = 'changes_requested'
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Ajustes solicitados ao autor com sucesso.'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao solicitar ajustes.'
          }
        } else if (type === 'approveStep') {
          const res = await this.$apollo.mutate({
            mutation: gql`
              mutation ($id: Int!, $comment: String) {
                workflow {
                  approveStep(id: $id, comment: $comment) {
                    responseResult {
                      succeeded
                      message
                    }
                    draft {
                      id
                      state
                      currentLevel
                    }
                  }
                }
              }
            `,
            variables: { id: this.draft.id, comment: comment.trim() || null }
          })
          const data = res && res.data && res.data.workflow && res.data.workflow.approveStep
          if (data && data.responseResult && data.responseResult.succeeded) {
            this.draft.state = (data.draft && data.draft.state) || 'awaiting_approval'
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Revisão técnica aprovada. Documento encaminhado para Homologação Final.'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao aprovar etapa.'
          }
        } else if (type === 'publish') {
          const res = await this.$apollo.mutate({
            mutation: gql`
              mutation ($id: Int!, $comment: String) {
                workflow {
                  publish(id: $id, comment: $comment) {
                    responseResult {
                      succeeded
                      message
                    }
                    draft {
                      id
                      state
                    }
                    pageId
                  }
                }
              }
            `,
            variables: { id: this.draft.id, comment: comment.trim() || null }
          })
          const data = res && res.data && res.data.workflow && res.data.workflow.publish
          if (data && data.responseResult && data.responseResult.succeeded) {
            this.draft.state = 'published'
            this.draft.pageId = data.pageId || this.draft.pageId
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Documento homologado e publicado oficialmente na Intranet Detran-MG!'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao homologar e publicar.'
          }
        } else if (type === 'revalidate') {
          const res = await this.$apollo.mutate({
            mutation: gql`
              mutation ($id: Int!, $comment: String) {
                workflow {
                  revalidate(id: $id, comment: $comment) {
                    responseResult {
                      succeeded
                      message
                    }
                    draft {
                      id
                      state
                      reviewDueDate
                    }
                  }
                }
              }
            `,
            variables: { id: this.draft.id, comment: comment.trim() || null }
          })
          const data = res && res.data && res.data.workflow && res.data.workflow.revalidate
          if (data && data.responseResult && data.responseResult.succeeded) {
            this.draft.state = (data.draft && data.draft.state) || 'published'
            this.draft.reviewDueDate = data.draft && data.draft.reviewDueDate
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Vigência revalidada por mais 12 meses com sucesso.'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao revalidar vigência.'
          }
        }
      } catch (err) {
        this.actionDialog.error = err.message || 'Erro inesperado ao processar ação.'
      } finally {
        this.submittingAction = false
      }
    }
  }
}
</script>

<style lang='scss'>
@import '~diff2html/bundles/css/diff2html.min.css';
@import '../../themes/detran/scss/variables';

.detran-workflow-review-page {
  width: 100%;
  font-family: $font-family-base;
}

.detran-review-header-btns {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}

.detran-review-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25;

  &.is-blue {
    background-color: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  &.is-emerald {
    background-color: rgba(209, 250, 229, 0.85);
    color: #1b6535;
    border: 1px solid #a7f3d0;
  }

  &.is-amber {
    background-color: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  &.is-slate {
    background-color: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
  }
}

.detran-review-article {
  border: 1px solid $slate-200;
  padding: 2rem 2.25rem 2.25rem !important;
}

// Switcher Lado a Lado / Linha a Linha
.detran-diff-switcher {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  background-color: $slate-100;
  border: 1px solid $slate-200;
  border-radius: 0.625rem;
  gap: 2px;

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    border: none;
    background: transparent;
    color: $slate-600;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    .v-icon {
      color: $slate-500 !important;
    }

    &:hover {
      color: $slate-800;
    }

    &.is-active {
      background: #ffffff;
      color: $detran-700;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);

      .v-icon {
        color: $detran-600 !important;
      }
    }
  }
}

// Callout com resumo do autor
.detran-author-summary-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1.125rem;
  margin-bottom: 1.5rem;
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.75rem;

  &__icon {
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__title {
    font-size: 0.75rem;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 2px;
  }

  &__text {
    font-size: 0.8125rem;
    color: #78350f;
    font-style: italic;
    line-height: 1.45;
  }
}

// Caixa do Diff
.detran-diff-box {
  border: 1px solid $slate-200;
  border-radius: 0.875rem;
  overflow: hidden;
  background: #ffffff;

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.75rem 1.125rem;
    background-color: $slate-50;
    border-bottom: 1px solid $slate-200;
  }

  &__legend {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;

    &.is-removed {
      background-color: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    &.is-added {
      background-color: #ecfdf5;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
  }

  &__hint {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: $slate-500;
  }
}

.detran-diff-empty {
  padding: 3.5rem 1.5rem;
  text-align: center;

  &__icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 0.875rem;
    border-radius: 9999px;
    background-color: $detran-50;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__title {
    font-size: 1rem;
    font-weight: 700;
    color: $slate-800;
    margin: 0 0 0.25rem;
  }

  &__subtitle {
    font-size: 0.8125rem;
    color: $slate-500;
    margin: 0;
  }
}

// Customização do diff2html para o Design System Detran-MG
.detran-diff-html-wrapper {
  overflow-x: auto;

  .d2h-file-header {
    display: none;
  }

  .d2h-file-wrapper {
    border: none;
    border-radius: 0;
    margin-bottom: 0;
  }

  .d2h-diff-table {
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 12.5px;
  }

  .d2h-code-linenumber,
  .d2h-code-side-linenumber {
    cursor: pointer !important;
    user-select: none;
    background-color: $slate-50;
    border-color: $slate-200;
    color: $slate-400;
    transition: all 0.15s ease;

    &:hover {
      background-color: $detran-50 !important;
      color: $detran-700 !important;
      font-weight: 700;
    }
  }

  .d2h-ins {
    background-color: #f0fdf4;
    border-color: #bbf7d0;
  }

  .d2h-del {
    background-color: #fef2f2;
    border-color: #fecaca;
  }

  .d2h-code-line del,
  .d2h-code-side-line del {
    background-color: #fecaca;
    border-radius: 3px;
  }

  .d2h-code-line ins,
  .d2h-code-side-line ins {
    background-color: #bbf7d0;
    border-radius: 3px;
  }
}

// Barra Institucional de Decisão (Rodapé do Artigo)
.detran-review-decision-bar {
  margin-top: 1.75rem;
  padding: 1.125rem 1.25rem;
  background-color: $slate-50;
  border: 1px solid $slate-200;
  border-radius: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;

  &__status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__icon {
    width: 38px;
    height: 38px;
    border-radius: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.is-emerald {
      background-color: rgba(209, 250, 229, 0.85);
      border: 1px solid #a7f3d0;
    }

    &.is-amber {
      background-color: #fef3c7;
      border: 1px solid #fde68a;
    }
  }

  &__headline {
    font-size: 0.8125rem;
    font-weight: 700;
    color: $slate-800;
  }

  &__sub {
    font-size: 0.75rem;
    color: $slate-500;
  }

  &__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.625rem;
  }
}

.detran-wf-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  border-radius: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  text-decoration: none !important;
  border: 1px solid transparent;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--warning {
    background-color: #ffffff;
    color: #c2410c;
    border-color: #fdba74;

    .v-icon { color: #c2410c !important; }

    &:hover:not(:disabled) {
      background-color: #fff7ed;
      border-color: #f97316;
    }
  }

  &--primary {
    background-color: $detran-600;
    color: #ffffff !important;
    box-shadow: 0 2px 6px rgba($detran-600, 0.22);

    .v-icon { color: #ffffff !important; }

    &:hover:not(:disabled) {
      background-color: $detran-700;
    }
  }

  &--publish {
    background-color: #1b6535;
    color: #ffffff !important;
    box-shadow: 0 4px 12px rgba(27, 101, 53, 0.25);

    .v-icon { color: #ffffff !important; }

    &:hover:not(:disabled) {
      background-color: #144d28;
    }
  }

  &--teal {
    background-color: #0d9488;
    color: #ffffff !important;

    .v-icon { color: #ffffff !important; }

    &:hover:not(:disabled) {
      background-color: #0f766e;
    }
  }
}

// Coluna Lateral Direita (Sticky, mesmo estilo do .detran-toc)
.detran-review-aside {
  width: 340px;
  flex-shrink: 0;
  position: sticky;
  top: 1rem;

  @include tablet {
    width: 100%;
    position: static;
  }
  @include mobile {
    width: 100%;
    position: static;
  }
}

.detran-review-side-card {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: $radius-xl;
  box-shadow: $shadow-soft;
  overflow: hidden;
}

.detran-side-history {
  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.125rem;
    border-bottom: 1px solid $slate-100;
    background: $slate-50;
  }

  &__title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $slate-700;
    margin: 0;
  }

  &__list {
    padding: 0.875rem 1.125rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__item {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    margin-top: 5px;
    flex-shrink: 0;

    &.is-emerald { background-color: #10b981; }
    &.is-amber { background-color: #f59e0b; }
    &.is-blue { background-color: #3b82f6; }
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__action {
    font-size: 0.75rem;
    font-weight: 600;
    color: $slate-800;
  }

  &__date {
    font-size: 0.6875rem;
    color: $slate-400;
  }

  &__comment {
    font-size: 0.75rem;
    color: $slate-500;
    font-style: italic;
    margin-top: 2px;
  }
}

// Modal Institucional de Confirmação
.detran-action-modal {
  background: #ffffff;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  &__header {
    padding: 1.25rem 1.5rem;
    background-color: #185a30;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;

    &.is-warning {
      background-color: #9a3412;
    }
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__header-icon {
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    background-color: rgba(255, 255, 255, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__title {
    font-size: 1rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  &__subtitle {
    font-size: 0.75rem;
    color: #a7f3d0;
    margin: 2px 0 0;
  }

  &__close {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__callout {
    display: flex;
    align-items: flex-start;
    padding: 0.875rem;
    border-radius: 0.75rem;

    &.is-emerald {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }

    &.is-amber {
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
  }

  &__callout-text {
    font-size: 0.75rem;
    line-height: 1.5;
    margin: 0;
  }

  &__callout-warn {
    font-size: 0.75rem;
    font-weight: 700;
    color: #b45309;
    margin: 6px 0 0;
  }

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: #334155;
    margin-bottom: 0.375rem;
  }

  &__textarea {
    width: 100%;
    border-radius: 0.75rem;
    border: 1px solid #cbd5e1;
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #1e293b;
    outline: none;
    resize: vertical;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
      border-color: #2ea058;
      box-shadow: 0 0 0 3px rgba(46, 160, 88, 0.15);
    }
  }

  &__error {
    font-size: 0.75rem;
    color: #dc2626;
    font-weight: 600;
    margin: 4px 0 0;
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #64748b;
    padding-top: 0.5rem;
    border-top: 1px solid #f1f5f9;
  }

  &__footer {
    padding: 1rem 1.5rem;
    background-color: #f8fafc;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  &__cancel {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: none;
    background: transparent;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    cursor: pointer;

    &:hover {
      background-color: #e2e8f0;
    }
  }

  &__submit {
    padding: 0.55rem 1.25rem;
    border-radius: 0.5rem;
    border: none;
    background-color: #1b6535;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(27, 101, 53, 0.25);

    &.is-warning {
      background-color: #c2410c;
      box-shadow: 0 4px 12px rgba(194, 65, 12, 0.25);
    }

    &:hover:not(:disabled) {
      filter: brightness(0.95);
    }
  }
}
</style>

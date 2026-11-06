<template lang='pug'>
  .detran-workflow-review-page

    //- Barra de Carregamento Superior Suave
    v-progress-linear.mb-4.rounded(
      v-if='loading'
      indeterminate
      color='#15803d'
      height='3'
    )

    //- ========================================================================
    //- 2.1 HEADER SUPERIOR + TOOLBAR ESTILO GOOGLE DOCS
    //- ========================================================================
    header.detran-gdocs-header
      .detran-gdocs-header__top
        nav.detran-breadcrumb(aria-label='Trilha de navegação')
          a.detran-breadcrumb__home(href='/' title='Início')
            v-icon(size='14' color='#94a3b8') mdi-home
          span.detran-breadcrumb__sep(aria-hidden='true') /
          router-link.detran-breadcrumb__item(to='/') Governança &amp; Workflow
          span.detran-breadcrumb__sep(aria-hidden='true') /
          span.detran-breadcrumb__item.is-current {{ 'Revisão #' + (draft.id || draftId) }}

        .detran-gdocs-header__row
          .detran-gdocs-header__title-group
            h1.detran-page-title {{ draft.title || 'Revisão de Documento' }}
            span.detran-review-status-pill(:class='stateBadge.pillClass')
              v-icon(size='14' :color='stateBadge.iconColor') {{ stateBadge.icon }}
              span {{ stateBadge.label }}

          .detran-review-header-btns
            button.detran-back-btn(
              type='button'
              title='Voltar para a Central de Tarefas'
              @click='goBack'
            )
              v-icon(size='16') mdi-arrow-left
              span Voltar
            a.detran-portal-link-btn(
              v-if='draft.path'
              :href='"/" + (draft.locale || "pt-br") + "/" + draft.path'
              title='Abrir página no portal'
            )
              v-icon(size='15') mdi-open-in-new
              span Ver Página no Portal

      //- Barra de Ferramentas e Metadados Compactos (Estilo Google Docs)
      .detran-gdocs-toolbar
        .detran-gdocs-toolbar__meta
          .detran-gdocs-toolbar__author
            .detran-gdocs-toolbar__avatar {{ authorInitials }}
            span
              | Enviado por #[strong {{ draft.authorName || 'Servidor' }}]
              template(v-if='draft.updatedAt')  em {{ draft.updatedAt | moment('DD/MM/YYYY [às] HH:mm') }}
          span.detran-gdocs-toolbar__divider |
          span.detran-gdocs-toolbar__path
            v-icon(size='13' color='#64748b') mdi-folder-outline
            span /{{ draft.locale || 'pt-br' }}/{{ draft.path }}
          template(v-if='latestSubmitComment')
            span.detran-gdocs-toolbar__divider |
            .detran-gdocs-toolbar__author-note
              v-icon(size='14' color='#d97706') mdi-message-alert-outline
              span Resumo das alterações informado pelo autor: #[em "{{ latestSubmitComment }}"]

        .detran-gdocs-toolbar__controls
          span.detran-gdocs-toolbar__hint
            v-icon(size='14' color='#64748b') mdi-cursor-text
            span Selecione qualquer trecho do texto com o mouse para adicionar um comentário ou sugerir alteração

          .detran-mode-switcher(role='group' aria-label='Modo de visualização da folha')
            button.detran-mode-switcher__btn(
              type='button'
              :class='{ "is-active": docMode === "suggest" }'
              @click='setDocMode("suggest")'
            )
              v-icon(size='14' :color='docMode === "suggest" ? "#16a34a" : "#64748b"') mdi-pencil-outline
              span Modo Sugestões (Diff Visual)
            button.detran-mode-switcher__btn(
              type='button'
              :class='{ "is-active": docMode === "clean" }'
              @click='setDocMode("clean")'
            )
              v-icon(size='14' :color='docMode === "clean" ? "#16a34a" : "#64748b"') mdi-eye-outline
              span Prévia Final Limpa

    //- ========================================================================
    //- BANNER EXPLICATIVO RÁPIDO PARA REVISOR LEIGO (Descartável)
    //- ========================================================================
    .detran-onboarding-banner(v-if='showOnboarding')
      .detran-onboarding-banner__left
        span.detran-onboarding-banner__title
          v-icon(size='16' color='#16a34a') mdi-sparkles
          span Como revisar:
        span.detran-onboarding-banner__legend
          span.detran-onboarding-banner__swatch.is-add
          span Texto novo sugerido
        span.detran-onboarding-banner__legend
          span.detran-onboarding-banner__swatch.is-del
          span.is-strike Texto removido
        span.detran-onboarding-banner__legend
          span.detran-onboarding-banner__swatch.is-com
          span Trecho com comentário
        span.detran-onboarding-banner__tip — Use os cartões à direita para aceitar, recusar ou comentar!
      button.detran-onboarding-banner__close(
        type='button'
        title='Fechar dica'
        @click='showOnboarding = false'
      )
        v-icon(size='16' color='#94a3b8') mdi-close

    //- Alerta de bloqueio de URLs blob: locais (Seção 2.2 e 3.3.4)
    .detran-blob-banner(v-if='blobInspection.hasBlobUrls')
      .detran-blob-banner__left
        v-icon(size='18' color='#b91c1c') mdi-image-broken-variant
        div
          strong Atenção: Imagem com URL local temporária (blob:) detectada no rascunho!
          p URLs iniciadas por "blob:http://..." expiram quando o navegador do autor é fechado. Remova ou substitua a imagem antes de homologar.
      button.detran-blob-banner__btn(
        type='button'
        @click='sanitizeDraftBlobUrls'
      ) Higienizar URLs blob:

    //- ========================================================================
    //- 2.1 LAYOUT GERAL EM 2 COLUNAS (70% Folha A4 Esquerda + 30% Lateral Sticky)
    //- ========================================================================
    .detran-gdocs-workspace

      //- COLUNA PRINCIPAL (ESQUERDA - 70%): Canvas do Documento (Folha A4)
      .detran-gdocs-main

        //- 2.3 POPOVER FLUTUANTE DE SELEÇÃO COM O MOUSE (Comentar trecho / Sugerir redação)
        .detran-selection-popover(
          v-if='selectionPopover.visible'
          :style='{ top: selectionPopover.top + "px", left: selectionPopover.left + "px" }'
          @mousedown.stop
        )
          button.detran-selection-popover__btn(
            type='button'
            @click='triggerSelectionAction("comment")'
          )
            span 💬 Comentar trecho
          span.detran-selection-popover__sep |
          button.detran-selection-popover__btn.is-suggest(
            type='button'
            @click='triggerSelectionAction("redaction")'
          )
            span ✏️ Sugerir redação

        //- Folha de Papel A4 (Container de Leitura WYSIWYG — Zero Markdown cru!)
        article#documentPaper.doc-paper(
          :class='{ "clean-mode": docMode === "clean" }'
        )
          //- Tags de Categoria da Página no Topo da Folha
          .detran-doc-tags.select-none
            span.detran-doc-tag {{ draft.pageId ? '#DOCUMENTO-' + draft.pageId : '#NOVA-PÁGINA' }}
            span.detran-doc-tag(
              v-for='tag in (draft.tags || [])'
              :key='tag'
            ) {{ '#' + String(tag).toUpperCase() }}

          //- Conteúdo Editorial Formatado (HTML rico + marcações visuais de diff)
          #docContent.detran-doc-content(
            ref='docContent'
            v-html='visualDiff.html'
            @mouseup='onDocMouseUp'
            @click='onDocContentClick'
          )

      //- COLUNA LATERAL (DIREITA - 30%, STICKY): Painel de Anotações e Sugestões
      aside.detran-gdocs-aside(aria-label='Painel de anotações e sugestões')
        review-comments(
          ref='reviewCommentsPanel'
          :draft-id='draftId'
          :comments='draft.comments || []'
          :suggestions='visualDiff.suggestions || []'
          :suggestion-decisions='suggestionDecisions'
          :active-item-id='activeItemId'
          :selection-payload='activeSelectionPayload'
          @focus-item='onFocusItem'
          @clear-selection='activeSelectionPayload = null'
          @suggestion-decision='onSuggestionDecision'
          @redaction-decision='onRedactionDecision'
          @comment-added='onCommentAdded'
          @comment-resolved='onCommentResolved'
        )

        //- Card de Histórico de Tramitação
        .detran-review-side-card.mt-4(v-if='draft.events && draft.events.length > 0')
          .detran-side-history__header
            v-icon(size='16' color='#15803d') mdi-timeline-clock-outline
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
    //- 2.4 BARRA DE DECISÃO FLUTUANTE INFERIOR (FLOATING ACTION BAR)
    //- ========================================================================
    .detran-floating-action-bar
      .detran-floating-action-bar__card
        //- Indicador de Progresso em Tempo Real
        .detran-floating-action-bar__status
          .detran-floating-action-bar__icon(:class='pendingReviewCount > 0 ? "is-amber" : "is-emerald"')
            v-icon(
              size='20'
              :color='pendingReviewCount > 0 ? "#d97706" : "#15803d"'
            ) {{ pendingReviewCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-decagram' }}
          .detran-floating-action-bar__text
            .detran-floating-action-bar__title
              template(v-if='draft.state === "published"') ✓ Documento Homologado e Publicado no Portal
              template(v-else-if='pendingReviewCount > 0') Faltam {{ pendingReviewCount }} {{ pendingReviewCount === 1 ? 'revisão pendente' : 'revisões pendentes' }}
              template(v-else) ✓ Todas as alterações revisadas
            .detran-floating-action-bar__sub
              template(v-if='draft.state === "published"') {{ actionsHelper.statusDescription }}
              template(v-else-if='pendingReviewCount > 0') {{ pendingReviewCount }} {{ pendingReviewCount === 1 ? 'item aguardando' : 'itens aguardando' }} análise ou decisão nos cartões laterais
              template(v-else) Nenhuma pendência restante — pronto para publicar no portal

        //- Botões de Decisão (Devolver com Ajustes / Aprovar e Publicar)
        .detran-floating-action-bar__actions
          template(v-if='draft.state !== "published"')
            button.detran-fab-btn.detran-fab-btn--secondary(
              type='button'
              :disabled='submittingAction'
              @click='openActionDialog("requestChanges")'
            )
              v-icon(size='16' color='#92400e') mdi-undo-variant
              span Devolver com Ajustes

            button.detran-fab-btn.detran-fab-btn--primary(
              v-if='actionsHelper.canApproveStep && !actionsHelper.canPublish'
              type='button'
              :disabled='submittingAction'
              @click='openActionDialog("approveStep")'
            )
              v-icon(size='16' color='#ffffff') mdi-check-all
              span Aprovar Revisão Técnica

            button.detran-fab-btn.detran-fab-btn--primary(
              v-else
              type='button'
              :disabled='submittingAction'
              @click='openActionDialog("publish")'
            )
              v-icon(size='17' color='#ffffff') mdi-check-circle-outline
              span Aprovar e Publicar

          a.detran-fab-btn.detran-fab-btn--primary(
            v-else-if='draft.path'
            :href='"/" + (draft.locale || "pt-br") + "/" + draft.path'
          )
            v-icon(size='16' color='#ffffff') mdi-open-in-new
            span Abrir Página Publicada

    //- ========================================================================
    //- MODAL INSTITUCIONAL DE CONFIRMAÇÃO DE DECISÃO
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
              :color='actionDialog.type === "requestChanges" ? "#d97706" : "#15803d"'
            ) {{ actionDialog.type === 'requestChanges' ? 'mdi-alert-circle-outline' : 'mdi-check-decagram-outline' }}
            div
              p.detran-action-modal__callout-text {{ actionDialog.description }}
              p.detran-action-modal__callout-warn(
                v-if='actionDialog.type === "publish" && pendingReviewCount > 0'
              ) Nota: {{ pendingReviewCount }} sugestão(ões)/anotação(ões) ainda não marcadas serão consolidadas automaticamente.

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
            span {{ actionDialog.type === 'requestChanges' ? 'Enviar para Ajustes' : 'Confirmar e Publicar' }}
</template>

<script>
import gql from 'graphql-tag'
import moment from 'moment'
import ReviewComments from './review-comments.vue'
import {
  getAvailableReviewActions,
  buildVisualDiffDocument,
  createTextQuoteSelectorFromText,
  applySuggestionDecisionToMarkdown
} from '../../store/detran-workflow-review'
import { inspectMarkdownForBlobUrls } from '../../themes/default/components/transparent-editor/utils/smart-paste'

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
      docMode: 'suggest',
      showOnboarding: true,
      activeItemId: null,
      suggestionDecisions: {},
      draftModifiedByReview: false,
      selectionPopover: {
        visible: false,
        top: 0,
        left: 0,
        exact: '',
        prefix: '',
        suffix: ''
      },
      activeSelectionPayload: null,
      draft: {
        id: 0,
        pageId: null,
        path: '',
        locale: 'pt-br',
        title: '',
        description: '',
        content: '',
        contentType: 'markdown',
        editorKey: 'markdown',
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
        headerClass: 'is-emerald',
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

    authorInitials () {
      const name = String(this.draft.authorName || 'Autor').trim()
      const parts = name.split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    },

    latestSubmitComment () {
      const evts = this.draft.events || []
      const sub = evts.find(e => e && e.action === 'submit' && e.comment)
      return sub ? sub.comment : ''
    },

    blobInspection () {
      return inspectMarkdownForBlobUrls(this.draft.content || '')
    },

    visualDiff () {
      const formattedTime = this.draft.updatedAt ?
        moment(this.draft.updatedAt).format('DD/MM [às] HH:mm') :
        'Recente'
      return buildVisualDiffDocument({
        originalContent: this.livePage.content || '',
        draftContent: this.draft.content || '',
        comments: this.draft.comments || [],
        authorName: this.draft.authorName || 'Autor',
        updatedAt: formattedTime,
        decisions: this.suggestionDecisions
      })
    },

    pendingSuggestionsCount () {
      return (this.visualDiff.suggestions || []).filter(s => {
        const dec = this.suggestionDecisions[s.id] || s.status || 'pending'
        return dec === 'pending'
      }).length
    },

    unresolvedCommentsCount () {
      return (this.draft.comments || []).filter(c => !c.resolved).length
    },

    pendingReviewCount () {
      return this.pendingSuggestionsCount + this.unresolvedCommentsCount
    },

    actionsHelper () {
      const defaultPerms = {
        'review:pages': true,
        'approve:pages': true
      }
      return getAvailableReviewActions(this.draft, this.draft.permissions || defaultPerms)
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
            iconColor: '#15803d',
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
            iconColor: '#15803d',
            icon: 'mdi-check-decagram'
          }
        default:
          return {
            label: 'Em Revisão Editorial',
            pillClass: 'is-blue',
            iconColor: '#1d4ed8',
            icon: 'mdi-file-find-outline'
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
  mounted () {
    document.addEventListener('mousedown', this.onGlobalMouseDown)
  },
  beforeDestroy () {
    document.removeEventListener('mousedown', this.onGlobalMouseDown)
  },
  methods: {
    goBack () {
      if (window.history.length > 1) {
        this.$router.go(-1)
      } else {
        this.$router.push('/')
      }
    },

    setDocMode (mode) {
      this.docMode = mode
      if (mode === 'clean') {
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'eye',
          message: 'Exibindo prévia final limpa (como a página ficará publicada no portal).'
        })
      }
    },

    onGlobalMouseDown (e) {
      if (this.selectionPopover.visible && !e.target.closest('.detran-selection-popover')) {
        this.selectionPopover.visible = false
      }
    },

    onDocMouseUp () {
      if (typeof window === 'undefined' || !window.getSelection) return
      const selection = window.getSelection()
      const selectedText = selection ? selection.toString().trim() : ''
      const docEl = this.$refs.docContent

      if (selectedText.length > 2 && docEl && selection.anchorNode && docEl.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const fullText = docEl.innerText || docEl.textContent || ''
        const selector = createTextQuoteSelectorFromText(fullText, selectedText)

        this.selectionPopover = {
          visible: true,
          top: Math.max(72, rect.top - 46),
          left: Math.min(window.innerWidth - 280, Math.max(16, rect.left)),
          exact: selector.exact,
          prefix: selector.prefix,
          suffix: selector.suffix
        }
      }
    },

    triggerSelectionAction (mode) {
      const { exact, prefix, suffix } = this.selectionPopover
      this.selectionPopover.visible = false
      if (!exact) return
      this.activeSelectionPayload = {
        exact,
        prefix,
        suffix,
        mode,
        timestamp: Date.now()
      }
    },

    onDocContentClick (event) {
      const target = event.target && event.target.closest ? event.target.closest('[data-item-id]') : null
      if (!target) return
      const itemId = target.getAttribute('data-item-id')
      if (itemId) {
        this.activeItemId = itemId
        this.highlightDocumentElement(itemId)
        if (this.$refs.reviewCommentsPanel && typeof this.$refs.reviewCommentsPanel.scrollToCard === 'function') {
          this.$refs.reviewCommentsPanel.scrollToCard(itemId)
        }
      }
    },

    onFocusItem (itemId) {
      this.activeItemId = itemId
      this.highlightDocumentElement(itemId)
      const docEl = this.$el && (
        this.$el.querySelector(`#item-${itemId}`) ||
        this.$el.querySelector(`#item-${itemId}-add`) ||
        this.$el.querySelector(`[data-item-id="${itemId}"]`)
      )
      if (docEl && typeof docEl.scrollIntoView === 'function') {
        docEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    },

    highlightDocumentElement (itemId) {
      if (!this.$el) return
      Array.from(this.$el.querySelectorAll('.active-item')).forEach(el => el.classList.remove('active-item'))
      Array.from(this.$el.querySelectorAll(`[data-item-id="${itemId}"]`)).forEach(el => el.classList.add('active-item'))
    },

    onSuggestionDecision ({ item, decision }) {
      this.$set(this.suggestionDecisions, item.id, decision)

      if (decision === 'rejected') {
        this.draft.content = applySuggestionDecisionToMarkdown({
          draftContent: this.draft.content,
          suggestion: item,
          decision: 'reject'
        })
        this.draftModifiedByReview = true
        this.$store.commit('showNotification', {
          style: 'orange',
          icon: 'undo',
          message: 'Sugestão recusada e trecho revertido para a versão original.'
        })
      } else {
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Sugestão aceita e incorporada ao documento!'
        })
      }
    },

    onRedactionDecision ({ item, decision }) {
      if (decision === 'accepted' && item.newText && item.quote) {
        this.draft.content = applySuggestionDecisionToMarkdown({
          draftContent: this.draft.content,
          suggestion: {
            quote: item.quote,
            suggestedReplacement: item.newText
          },
          decision: 'accept'
        })
        this.draftModifiedByReview = true
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Nova redação sugerida foi aplicada ao texto do documento!'
        })
      }
    },

    sanitizeDraftBlobUrls () {
      const res = inspectMarkdownForBlobUrls(this.draft.content || '')
      if (res.hasBlobUrls) {
        this.draft.content = res.sanitizedMarkdown
        this.draftModifiedByReview = true
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Links temporários (blob:) foram removidos do rascunho.'
        })
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
        this.suggestionDecisions = {}
        this.draftModifiedByReview = false

        if (draftData.pageId) {
          await this.loadLivePageContent(draftData.pageId)
        } else if (draftData.path) {
          await this.loadLivePageByPath(draftData.path, draftData.locale || 'pt-br')
        } else {
          this.livePage = { content: '', title: '', description: '' }
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

    onCommentAdded (newComment) {
      this.draft.comments = [...(this.draft.comments || []), newComment]
      this.activeItemId = `com-${newComment.id}`
      this.$store.commit('showNotification', {
        style: 'success',
        icon: 'check',
        message: 'Comentário adicionado ao documento!'
      })
    },

    onCommentResolved ({ id, resolved }) {
      this.draft.comments = (this.draft.comments || []).map(c => {
        if (c.id === id) {
          return { ...c, resolved }
        }
        return c
      })
      this.$store.commit('showNotification', {
        style: 'success',
        icon: 'check',
        message: resolved ? 'Item marcado como resolvido!' : 'Item reaberto.'
      })
    },

    openActionDialog (type) {
      this.actionDialog.type = type
      this.actionDialog.comment = ''
      this.actionDialog.error = ''

      if (type === 'requestChanges') {
        this.actionDialog.title = 'Devolver para o Autor com Ajustes'
        this.actionDialog.description =
          'O autor receberá seus comentários e sugestões marcados no texto para realizar os ajustes necessários.'
        this.actionDialog.commentLabel = 'Resumo para o autor (Obrigatório):'
        this.actionDialog.commentPlaceholder = 'Ex: Favor revisar as observações marcadas nos parágrafos indicados...'
        this.actionDialog.icon = 'mdi-undo-variant'
        this.actionDialog.headerClass = 'is-warning'
      } else if (type === 'approveStep') {
        this.actionDialog.title = 'Aprovar Nível 1 (Revisão Técnica)'
        this.actionDialog.description =
          'O parecer técnico será registrado e o documento avançará para a Homologação Final.'
        this.actionDialog.commentLabel = 'Parecer Técnico (Opcional):'
        this.actionDialog.commentPlaceholder = 'Observações sobre a conformidade técnica do documento...'
        this.actionDialog.icon = 'mdi-check-all'
        this.actionDialog.headerClass = 'is-emerald'
      } else if (type === 'publish') {
        this.actionDialog.title = 'Aprovar e Publicar no Portal da Intranet'
        this.actionDialog.description =
          'As sugestões aceitas serão consolidadas e a versão homologada será publicada oficialmente no Portal da Intranet.'
        this.actionDialog.commentLabel = 'Despacho de Homologação (Opcional):'
        this.actionDialog.commentPlaceholder = 'Ex: Revisado e homologado conforme diretrizes editoriais...'
        this.actionDialog.icon = 'mdi-shield-check'
        this.actionDialog.headerClass = 'is-emerald'
      }

      this.actionDialog.visible = true
    },

    async persistReviewedDraftContentIfNeeded () {
      if (!this.draftModifiedByReview) return
      await this.$apollo.mutate({
        mutation: gql`
          mutation (
            $pageId: Int
            $path: String!
            $locale: String!
            $title: String!
            $description: String
            $content: String!
            $contentType: String
            $editorKey: String
            $tags: [String]
          ) {
            workflow {
              saveDraft(
                pageId: $pageId
                path: $path
                locale: $locale
                title: $title
                description: $description
                content: $content
                contentType: $contentType
                editorKey: $editorKey
                tags: $tags
              ) {
                responseResult {
                  succeeded
                  message
                }
              }
            }
          }
        `,
        variables: {
          pageId: this.draft.pageId || null,
          path: this.draft.path,
          locale: this.draft.locale || 'pt-br',
          title: this.draft.title || 'Documento',
          description: this.draft.description || '',
          content: this.draft.content,
          contentType: this.draft.contentType || 'markdown',
          editorKey: this.draft.editorKey || 'markdown',
          tags: this.draft.tags || []
        }
      })
      this.draftModifiedByReview = false
    },

    async executeAction () {
      const { type, comment } = this.actionDialog

      if (type === 'requestChanges' && !comment.trim()) {
        this.actionDialog.error = 'Informe um resumo das alterações solicitadas ao autor.'
        return
      }

      this.submittingAction = true
      this.actionDialog.error = ''

      try {
        // Se havia URLs blob: quebradas, limpa antes de publicar
        if (type === 'publish' && this.blobInspection.hasBlobUrls) {
          this.sanitizeDraftBlobUrls()
        }

        await this.persistReviewedDraftContentIfNeeded()

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
              message: 'Documento devolvido ao autor com suas anotações!'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao devolver para ajustes.'
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
              message: 'Revisão técnica aprovada. Encaminhado para homologação final!'
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
            this.docMode = 'clean'
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Documento aprovado e publicado no Portal da Intranet!'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao aprovar e publicar.'
          }
        }
      } catch (err) {
        this.actionDialog.error = err.message || 'Erro inesperado ao processar decisão.'
      } finally {
        this.submittingAction = false
      }
    }
  }
}
</script>

<style lang='scss'>
@import '../../themes/detran/scss/variables';

.detran-workflow-review-page {
  width: 100%;
  font-family: $font-family-base;
  padding-bottom: 6.5rem;
}

// =============================================================================
// HEADER SUPERIOR + TOOLBAR ESTILO GOOGLE DOCS (Seção 2.1)
// =============================================================================
.detran-gdocs-header {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: 0.875rem;
  overflow: hidden;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  &__top {
    padding: 1rem 1.5rem;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.375rem;
  }

  &__title-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}

.detran-review-header-btns {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.detran-portal-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.45rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #15803d !important;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  text-decoration: none !important;
  transition: all 0.15s ease;

  .v-icon { color: #15803d !important; }

  &:hover {
    background: #dcfce7;
  }
}

.detran-review-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;

  &.is-blue {
    background-color: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  &.is-emerald {
    background-color: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  &.is-amber {
    background-color: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }
}

.detran-gdocs-toolbar {
  background: $slate-50;
  border-top: 1px solid $slate-200;
  padding: 0.625rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;

  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.625rem;
    font-size: 0.75rem;
    color: $slate-600;
  }

  &__author {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  &__avatar {
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    background: #dcfce7;
    color: #166534;
    font-size: 0.6875rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__divider {
    color: $slate-300;
  }

  &__path {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-family: monospace;
    color: $slate-600;
  }

  &__author-note {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #fffbeb;
    color: #78350f;
    border: 1px solid #fde68a;
    padding: 0.2rem 0.625rem;
    border-radius: 0.375rem;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  &__hint {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: $slate-500;

    @media (max-width: 960px) {
      display: none;
    }
  }
}

.detran-mode-switcher {
  display: inline-flex;
  align-items: center;
  background: rgba(226, 232, 240, 0.85);
  padding: 3px;
  border-radius: 0.5rem;
  gap: 2px;

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    border-radius: 0.375rem;
    border: none;
    background: transparent;
    font-size: 0.75rem;
    font-weight: 600;
    color: $slate-600;
    cursor: pointer;
    transition: all 0.15s ease;

    &.is-active {
      background: #ffffff;
      color: $slate-900;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }
  }
}

// =============================================================================
// BANNER EXPLICATIVO (COMO REVISAR) E ALERTA BLOB
// =============================================================================
.detran-onboarding-banner {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: 0.75rem;
  padding: 0.75rem 1.125rem;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);

  &__left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.875rem;
    font-size: 0.75rem;
    color: $slate-600;
  }

  &__title {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: 700;
    color: $slate-800;
  }

  &__legend {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;

    .is-strike {
      text-decoration: line-through;
      color: #b91c1c;
    }
  }

  &__swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    display: inline-block;

    &.is-add {
      background: #dcfce7;
      border-bottom: 2px solid #22c55e;
    }

    &.is-del {
      background: #fee2e2;
    }

    &.is-com {
      background: #fef08a;
      border-bottom: 2px solid #eab308;
    }
  }

  &__tip {
    color: $slate-500;
  }

  &__close {
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 4px;
  }
}

.detran-blob-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.75rem;
  padding: 0.875rem 1.125rem;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: #991b1b;
  font-size: 0.75rem;

  &__left {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;

    p {
      margin: 2px 0 0;
      color: #b91c1c;
    }
  }

  &__btn {
    padding: 0.4rem 0.85rem;
    border-radius: 0.5rem;
    border: 1px solid #f87171;
    background: #ffffff;
    color: #b91c1c;
    font-weight: 700;
    font-size: 0.75rem;
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
      background: #fee2e2;
    }
  }
}

// =============================================================================
// LAYOUT 2 COLUNAS (70% FOLHA A4 ESQUERDA + 30% PAINEL LATERAL STICKY)
// =============================================================================
.detran-gdocs-workspace {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(300px, 3fr);
  gap: 1.75rem;
  align-items: start;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.detran-gdocs-main {
  position: relative;
  min-width: 0;
}

.detran-gdocs-aside {
  position: sticky;
  top: 1rem;

  @media (max-width: 1024px) {
    position: static;
  }
}

// =============================================================================
// POPOVER FLUTUANTE DE SELEÇÃO DE TEXTO (Seção 2.3)
// =============================================================================
.detran-selection-popover {
  position: fixed;
  z-index: 60;
  background: #0f172a;
  color: #ffffff;
  border-radius: 9999px;
  padding: 0.35rem 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);

  &__btn {
    border: none;
    background: transparent;
    color: #f8fafc;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.55rem;
    border-radius: 9999px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background: #15803d;
      color: #ffffff;
    }

    &.is-suggest {
      color: #86efac;

      &:hover {
        color: #ffffff;
      }
    }
  }

  &__sep {
    color: #475569;
    font-size: 0.75rem;
  }
}

// =============================================================================
// CANVAS DO DOCUMENTO (FOLHA DE PAPEL A4 + MARCAÇÕES VISUAIS DE DIFF - Seção 2.2)
// =============================================================================
.doc-paper {
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 0.875rem;
  padding: 2.5rem 3rem;
  min-height: 680px;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 0 3px 0 rgba(0, 0, 0, 0.04);
  user-select: text;

  @media (max-width: 640px) {
    padding: 1.5rem 1.25rem;
  }
}

.detran-doc-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.detran-doc-tag {
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.detran-doc-content {
  color: #1e293b;
  font-size: 1rem;
  line-height: 1.75;

  > * + * {
    margin-top: 1.25rem;
  }

  .detran-doc-h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 0.625rem;
    margin-top: 1.75rem;
  }

  .detran-doc-h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #0f172a;
    padding-top: 0.5rem;
  }

  .detran-doc-p {
    margin: 0;
  }

  .detran-doc-callout {
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    border-left: 4px solid #3b82f6;
    background: #eff6ff;
    color: #1e3a8a;

    &.is-warning {
      border-left-color: #f59e0b;
      background: #fffbeb;
      color: #78350f;
    }

    &.is-success {
      border-left-color: #22c55e;
      background: #f0fdf4;
      color: #14532d;
    }

    &.is-danger {
      border-left-color: #ef4444;
      background: #fef2f2;
      color: #7f1d1d;
    }
  }

  .detran-doc-table-wrap {
    overflow-x: auto;
  }

  .detran-doc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;

    th, td {
      border: 1px solid #e2e8f0;
      padding: 0.625rem 0.875rem;
      text-align: left;
    }

    th {
      background: #f8fafc;
      font-weight: 700;
      color: #0f172a;
    }
  }

  .detran-doc-list,
  .detran-doc-links-list {
    padding-left: 1.5rem;

    li + li {
      margin-top: 0.375rem;
    }
  }

  .detran-doc-figure {
    border-radius: 0.5rem;
    overflow: hidden;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    margin: 0;
  }

  .detran-doc-img {
    width: 100%;
    max-height: 360px;
    object-fit: cover;
    display: block;
  }

  .detran-doc-figcaption {
    font-size: 0.75rem;
    color: #64748b;
    padding: 0.625rem;
    background: #ffffff;
    text-align: center;
    font-style: italic;
  }

  // Marcações Visuais de Diff Estilo Google Docs (Seção 2.2)
  .suggestion-add {
    background-color: #dcfce7;
    color: #166534;
    border-bottom: 2px solid #22c55e;
    padding: 1px 4px;
    border-radius: 3px;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover,
    &.active-item {
      background-color: #bbf7d0;
      box-shadow: 0 0 0 2px #16a34a;
    }
  }

  .suggestion-del {
    background-color: #fee2e2;
    color: #991b1b;
    text-decoration: line-through;
    padding: 1px 4px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover,
    &.active-item {
      background-color: #fecaca;
      box-shadow: 0 0 0 2px #dc2626;
    }
  }

  .comment-highlight {
    background-color: #fef08a;
    border-bottom: 2px solid #eab308;
    padding: 1px 2px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover,
    &.active-item {
      background-color: #fde047;
      box-shadow: 0 0 0 2px #ca8a04;
    }
  }

  .img-suggestion-box {
    margin: 1.5rem 0;
    padding: 0.75rem;
    border-radius: 0.75rem;
    border: 2px dashed #22c55e;
    background-color: rgba(240, 253, 244, 0.45);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover,
    &.active-item {
      background-color: rgba(240, 253, 244, 0.85);
      box-shadow: 0 0 0 2px #16a34a;
    }
  }

  .img-suggestion-badge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 700;
    color: #166534;
    margin-bottom: 0.5rem;
    padding: 0 0.25rem;

    &__pill {
      background: rgba(187, 247, 208, 0.85);
      color: #14532d;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.6875rem;
    }
  }

  .detran-blob-alert {
    background: #fef2f2;
    color: #b91c1c;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.375rem 0.625rem;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
  }
}

// Modo Visualização Limpa (Prévia Final - Seção 2.1 / Protótipo linhas 77-99)
.clean-mode {
  .suggestion-del,
  .suggestion-del-block {
    display: none !important;
  }

  .suggestion-add,
  .suggestion-add-block {
    background-color: transparent !important;
    color: inherit !important;
    border-bottom: none !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  .comment-highlight {
    background-color: transparent !important;
    border-bottom: none !important;
    box-shadow: none !important;
  }

  .img-suggestion-badge {
    display: none !important;
  }

  .img-suggestion-box {
    border-color: transparent !important;
    background-color: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
}

// =============================================================================
// 2.4 BARRA DE DECISÃO FLUTUANTE INFERIOR (FLOATING ACTION BAR)
// =============================================================================
.detran-floating-action-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  width: 94%;
  max-width: 720px;

  &__card {
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 1rem;
    padding: 0.75rem 1.25rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.875rem;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__icon {
    width: 38px;
    height: 38px;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.is-emerald {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }

    &.is-amber {
      background: #fffbeb;
      border: 1px solid #fde68a;
    }
  }

  &__title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #0f172a;
  }

  &__sub {
    font-size: 0.6875rem;
    color: #64748b;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-left: auto;
  }
}

.detran-fab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.6rem 1.15rem;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
  text-decoration: none !important;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--secondary {
    background: #fffbeb;
    color: #92400e !important;
    border: 1px solid #fde68a;

    &:hover:not(:disabled) {
      background: #fef3c7;
    }
  }

  &--primary {
    background: #15803d;
    color: #ffffff !important;
    border: 1px solid #15803d;
    box-shadow: 0 4px 14px rgba(21, 128, 61, 0.28);

    &:hover:not(:disabled) {
      background: #166534;
      transform: translateY(-1px);
    }
  }
}

// =============================================================================
// HISTÓRICO LATERAL E MODAL DE CONFIRMAÇÃO
// =============================================================================
.detran-review-side-card {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.detran-side-history {
  &__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1rem;
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
    padding: 0.875rem 1rem;
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

.detran-action-modal {
  background: #ffffff;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  &__header {
    padding: 1.25rem 1.5rem;
    background-color: #15803d;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;

    &.is-warning {
      background-color: #b45309;
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
    color: #dcfce7;
    margin: 2px 0 0;
  }

  &__close {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
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

    &:focus {
      border-color: #16a34a;
      box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
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
    background-color: #15803d;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(21, 128, 61, 0.25);

    &.is-warning {
      background-color: #d97706;
      box-shadow: 0 4px 12px rgba(217, 119, 6, 0.25);
    }
  }
}
</style>

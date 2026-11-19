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
      //- 1. TOPO DA DIV: BOTÕES DE NAVEGAÇÃO E CONTROLES DE MODO
      .detran-gdocs-header__top-bar
        .detran-gdocs-header__top-left
          button.detran-back-btn(
            type='button'
            title='Voltar para a Central de Tarefas'
            @click='goBack'
          )
            v-icon(size='16') mdi-arrow-left
            span Voltar
          span.detran-gdocs-top-sep |
          nav.detran-breadcrumb(aria-label='Trilha de navegação')
            a.detran-breadcrumb__home(href='/' title='Início')
              v-icon(size='14' color='#94a3b8') mdi-home
            span.detran-breadcrumb__sep(aria-hidden='true') /
            router-link.detran-breadcrumb__item(to='/') Governança &amp; Workflow
            span.detran-breadcrumb__sep(aria-hidden='true') /
            span.detran-breadcrumb__item.is-current {{ 'Revisão #' + (draft.id || draftId) }}

        .detran-gdocs-header__top-right
          .detran-mode-switcher(role='group' aria-label='Modo de visualização da folha')
            button.detran-mode-switcher__btn(
              type='button'
              :class='{ "is-active": docMode === "suggest" }'
              @click='setDocMode("suggest")'
            )
              v-icon(size='14' :color='docMode === "suggest" ? "#16a34a" : "#64748b"') mdi-compare-horizontal
              span Modo Sugestões (Diff Visual)
            button.detran-mode-switcher__btn(
              v-if='canEditDraftText'
              type='button'
              :class='{ "is-active": docMode === "edit" }'
              @click='setDocMode("edit")'
            )
              v-icon(size='14' :color='docMode === "edit" ? "#16a34a" : "#64748b"') mdi-pencil-outline
              span Editar Texto
            button.detran-mode-switcher__btn(
              type='button'
              :class='{ "is-active": docMode === "clean" }'
              @click='setDocMode("clean")'
            )
              v-icon(size='14' :color='docMode === "clean" ? "#16a34a" : "#64748b"') mdi-eye-outline
              span Prévia Final Limpa

          a.detran-portal-link-btn(
            v-if='draft.path'
            :href='"/" + (draft.locale || "pt-br") + "/" + draft.path'
            title='Abrir página no portal'
          )
            v-icon(size='15') mdi-open-in-new
            span Ver Página no Portal

      //- 2. SEÇÃO SEPARADA EXCLUSIVA DO TÍTULO DO TEXTO
      .detran-gdocs-header__title-section
        .detran-gdocs-header__title-group
          template(v-if='canEditDraftText')
            .detran-page-title-editor
              input.detran-page-title-input(
                v-model='editableTitle'
                type='text'
                placeholder='Título do documento...'
                @input='onTitleChange'
                title='Clique para editar o título do documento'
                aria-label='Título do documento'
              )
              v-icon.detran-page-title-editor__icon(size='16' aria-hidden='true') mdi-pencil-outline
          template(v-else)
            h1.detran-page-title {{ draft.title || 'Revisão de Documento' }}
          span.detran-review-status-pill(:class='stateBadge.pillClass')
            v-icon(size='14' :color='stateBadge.iconColor') {{ stateBadge.icon }}
            span {{ stateBadge.label }}
          button.detran-autosave-pill(
            v-if='canEditDraftText && draftSaveStatus !== "idle"'
            type='button'
            :class='"is-" + draftSaveStatus'
            :title='draftSaveStatus === "error" ? (draftSaveError || "Clique para tentar salvar novamente") : "Status do salvamento automático"'
            :disabled='draftSaveStatus !== "error"'
            @click='retrySaveDraft'
          )
            v-progress-circular(
              v-if='draftSaveStatus === "saving"'
              indeterminate
              size='11'
              width='2'
              color='#475569'
            )
            span.detran-autosave-pill__dot(v-else-if='draftSaveStatus === "pending"')
            v-icon(
              v-else-if='draftSaveStatus === "saved"'
              size='13'
              color='#15803d'
            ) mdi-cloud-check-outline
            v-icon(
              v-else-if='draftSaveStatus === "error"'
              size='13'
              color='#dc2626'
            ) mdi-cloud-alert
            span {{ autosaveStatusLabel }}

      //- 3. BARRA DE FERRAMENTAS E METADADOS
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
            v-icon(size='14' color='#64748b') {{ docMode === 'edit' ? 'mdi-pencil-outline' : 'mdi-cursor-text' }}
            span {{ toolbarHintText }}

    //- ========================================================================
    //- BANNER EXPLICATIVO RÁPIDO PARA REVISOR LEIGO (Descartável)
    //- ========================================================================
    .detran-onboarding-banner(v-if='showOnboarding && docMode === "suggest"')
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
          template(v-if='canDecideSuggestions')
            span.detran-selection-popover__sep |
            button.detran-selection-popover__btn.is-suggest(
              type='button'
              @click='triggerSelectionAction("redaction")'
            )
              span ✏️ Sugerir redação

        //- Alerta Destacado de Devolução para Ajustes
        .detran-changes-requested-banner(v-if='draft.state === "changes_requested"')
          .detran-changes-requested-banner__icon
            v-icon(size='24' color='#d97706') mdi-alert-circle-outline
          .detran-changes-requested-banner__content
            .detran-changes-requested-banner__header
              strong.detran-changes-requested-banner__title Documento devolvido para ajustes por {{ returnReviewerName }}
            .detran-changes-requested-banner__body(v-if='returnReasonComment')
              strong Motivo apontado:
              span &nbsp;"{{ returnReasonComment }}"
            .detran-changes-requested-banner__hint
              | Você está em modo de edição. Faça as correções solicitadas no texto, tags ou título e submeta novamente para revisão.

        //- Folha de Papel A4 (Container de Leitura WYSIWYG ou Edição Transparente in-place!)
        article#documentPaper.doc-paper(
          :class='{ "clean-mode": docMode === "clean", "edit-mode": docMode === "edit" }'
        )
          //- Tags de Categoria da Página no Topo da Folha
          .detran-doc-tags(:class='{ "select-none": !canEditDraftText }')
            span.detran-doc-tag.is-system {{ draft.pageId ? '#DOCUMENTO-' + draft.pageId : '#NOVA-PÁGINA' }}
            span.detran-doc-tag.is-editable(
              v-for='(tag, tIdx) in editableTags'
              :key='tIdx'
            )
              span {{ '#' + String(tag).toUpperCase() }}
              button.detran-doc-tag__remove(
                v-if='canEditDraftText'
                type='button'
                title='Remover tag'
                aria-label='Remover tag'
                @click.stop='removeTag(tIdx)'
              )
                v-icon(size='11') mdi-close
            .detran-doc-tag-add(v-if='canEditDraftText')
              input.detran-doc-tag-input(
                v-model='newTagInput'
                type='text'
                placeholder='+ Nova tag'
                aria-label='Adicionar tag ao documento'
                @keydown.enter.prevent='addTag'
                @keydown.space.prevent='addTag'
                @keydown.188.prevent='addTag'
              )
              button.detran-doc-tag-add-btn(
                v-if='newTagInput && newTagInput.trim()'
                type='button'
                title='Adicionar tag'
                aria-label='Confirmar nova tag'
                @click='addTag'
              )
                v-icon(size='13' color='#15803d') mdi-plus
            span.detran-doc-edit-badge(v-if='docMode === "edit"')
              span.detran-doc-edit-badge__dot
              span Modo Edição — Clique em qualquer bloco ou digite / para comandos

          //- Editor Transparente Integrado na Página de Revisão
          transparent-editor(
            v-if='docMode === "edit"'
            :initial-markdown='draft.content || ""'
            :page-id='draft.pageId'
            :page-path='draft.path'
            :page-title='draft.title'
            @change='onReviewEditorChange'
            @save-draft='onReviewEditorSaveDraft'
          )

          //- Conteúdo Editorial Formatado (HTML rico + marcações visuais de diff)
          #docContent.detran-doc-content(
            v-else
            ref='docContent'
            v-html='visualDiff.html'
            @mouseup='onDocMouseUp'
            @click='onDocContentClick'
          )

      //- COLUNA LATERAL (DIREITA - 30%, STICKY): Anotações e Sugestões + Decisão Editorial
      aside.detran-gdocs-aside(aria-label='Painel de decisão, anotações e sugestões')

        //- 1. LISTA DE MODIFICAÇÕES, ANOTAÇÕES E SUGESTÕES (Em evidência no topo!)
        review-comments(
          ref='reviewCommentsPanel'
          :draft-id='draftId'
          :comments='draft.comments || []'
          :suggestions='visualDiff.suggestions || []'
          :suggestion-decisions='suggestionDecisions'
          :active-item-id='activeItemId'
          :selection-payload='activeSelectionPayload'
          :is-author='isAuthor'
          :can-review-or-approve='canReviewOrApprove'
          :draft-state='draft.state'
          :draft-updated-at='draft.updatedAt'
          @focus-item='onFocusItem'
          @clear-selection='activeSelectionPayload = null'
          @suggestion-decision='onSuggestionDecision'
          @redaction-decision='onRedactionDecision'
          @comment-added='onCommentAdded'
          @comment-resolved='onCommentResolved'
        )

        //- 2. Card de Histórico de Tramitação
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

        //- 3. SEÇÃO DE DECISÃO EDITORIAL / SUBMIT DA EDIÇÃO (Último item da div)
        section.detran-decision-side-card.mt-4(aria-label='Decisão editorial e submissão')
          .detran-decision-side-card__header
            .detran-decision-side-card__icon(:class='decisionCardIconClass')
              v-icon(
                size='18'
                :color='decisionCardIconColor'
              ) {{ decisionCardIcon }}
            .detran-decision-side-card__text
              .detran-decision-side-card__title {{ decisionCardTitle }}
              .detran-decision-side-card__sub {{ decisionCardSubtitle }}

          .detran-decision-side-card__actions
            template(v-if='draft.state === "published"')
              a.detran-fab-btn.detran-fab-btn--primary(
                v-if='draft.path'
                :href='"/" + (draft.locale || "pt-br") + "/" + draft.path'
              )
                v-icon(size='15' color='#ffffff') mdi-open-in-new
                span Abrir Página Publicada

            template(v-else-if='draft.state === "changes_requested" || draft.state === "draft"')
              button.detran-fab-btn.detran-fab-btn--secondary(
                v-if='canEditDraftText'
                type='button'
                @click='setDocMode(docMode === "edit" ? "suggest" : "edit")'
              )
                v-icon(size='15' color='#92400e') {{ docMode === 'edit' ? 'mdi-compare-horizontal' : 'mdi-pencil-outline' }}
                span {{ docMode === 'edit' ? 'Ver Diff e Sugestões' : (draft.state === 'changes_requested' ? 'Editar e Corrigir' : 'Continuar Edição') }}
              button.detran-fab-btn.detran-fab-btn--primary(
                v-if='canEditDraftText'
                type='button'
                :disabled='submittingAction'
                @click='openActionDialog("submit")'
              )
                v-icon(size='15' color='#ffffff') mdi-send-check-outline
                span Submeter à Aprovação

            template(v-else-if='isAuthor || !canReviewOrApprove')
              button.detran-fab-btn.detran-fab-btn--secondary(
                v-if='actionsHelper.canRetract'
                type='button'
                :disabled='submittingAction'
                @click='openActionDialog("retract")'
              )
                v-icon(size='15' color='#92400e') mdi-undo-variant
                span Puxar de Volta para Edição

            template(v-else)
              button.detran-fab-btn.detran-fab-btn--secondary(
                v-if='docMode === "edit"'
                type='button'
                @click='setDocMode("suggest")'
              )
                v-icon(size='15' color='#92400e') mdi-compare-horizontal
                span Ver Diff e Sugestões

              button.detran-fab-btn.detran-fab-btn--secondary(
                v-if='actionsHelper.canRequestChanges'
                type='button'
                :disabled='submittingAction'
                @click='openActionDialog("requestChanges")'
              )
                v-icon(size='15' color='#92400e') mdi-undo-variant
                span Devolver com Ajustes

              button.detran-fab-btn.detran-fab-btn--primary(
                v-if='actionsHelper.canApproveStep && !actionsHelper.canPublish'
                type='button'
                :disabled='submittingAction || actionsHelper.isApprovalBlockedByPendingItems'
                :title='actionsHelper.isApprovalBlockedByPendingItems ? "Analise todas as sugestões e comentários pendentes antes de enviar ao aprovador" : "Enviar texto para o aprovador"'
                @click='openActionDialog("approveStep")'
              )
                v-icon(size='15' color='#ffffff') mdi-send-check-outline
                span {{ actionsHelper.labelApproveStep || 'Enviar para o Aprovador' }}

              button.detran-fab-btn.detran-fab-btn--primary(
                v-else-if='actionsHelper.canPublish'
                type='button'
                :disabled='submittingAction || actionsHelper.isApprovalBlockedByPendingItems'
                :title='actionsHelper.isApprovalBlockedByPendingItems ? "Analise todas as sugestões e comentários pendentes antes de publicar" : "Homologar e publicar página"'
                @click='openActionDialog("publish")'
              )
                v-icon(size='16' color='#ffffff') mdi-check-circle-outline
                span Aprovar e Publicar

              p.detran-decision-side-card__lock-hint(
                v-if='actionsHelper.isApprovalBlockedByPendingItems'
              ) Aceite ou recuse todos os {{ pendingReviewCount }} {{ pendingReviewCount === 1 ? 'item pendente' : 'itens pendentes' }} para liberar o envio ao aprovador (ou devolva com ajustes).

              p.detran-decision-side-card__lock-hint(
                v-else-if='actionsHelper.requiresApproverToPublish && !actionsHelper.canApproveStep && !actionsHelper.canPublish'
              ) {{ actionsHelper.awaitingFinalApprovalOnly ? 'Revisão técnica já concluída (Nível 1). Aguardando homologação final por usuário com perfil Aprovador.' : 'Aguardando homologação final por usuário com perfil Aprovador.' }}

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
          .detran-action-modal__callout(:class='(actionDialog.type === "requestChanges" || actionDialog.type === "retract") ? "is-amber" : "is-emerald"')
            v-icon.mt-0.mr-2(
              size='18'
              :color='(actionDialog.type === "requestChanges" || actionDialog.type === "retract") ? "#d97706" : "#15803d"'
            ) {{ (actionDialog.type === 'requestChanges' || actionDialog.type === 'retract') ? 'mdi-alert-circle-outline' : 'mdi-check-decagram-outline' }}
            div
              p.detran-action-modal__callout-text {{ actionDialog.description }}
              p.detran-action-modal__callout-warn(
                v-if='actionDialog.type === "requestChanges" && pendingReviewCount > 0'
              ) Nota: As decisões já registradas e os {{ pendingReviewCount }} item(ns) ainda pendente(s) serão mantidos para orientação do autor.
              p.detran-action-modal__callout-warn(
                v-else-if='actionDialog.type === "retract"'
              ) Ao confirmar, o documento sairá da fila de revisão e voltará ao estado Rascunho para sua edição.

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
            :class='(actionDialog.type === "requestChanges" || actionDialog.type === "retract") ? "is-warning" : ""'
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
            span {{ actionDialog.type === 'requestChanges' ? 'Enviar para Ajustes' : (actionDialog.type === 'retract' ? 'Puxar para Edição' : (actionDialog.type === 'submit' ? 'Submeter à Aprovação' : (actionDialog.type === 'approveStep' ? 'Enviar para o Aprovador' : 'Confirmar e Publicar'))) }}
</template>

<script>
import gql from 'graphql-tag'
import moment from 'moment'
import mermaid from 'mermaid'
import ReviewComments from './review-comments.vue'
import TransparentEditor from '../../themes/default/components/transparent-editor/transparent-editor.vue'
import {
  getAvailableReviewActions,
  canEditDraftContentInReview,
  canDecideReviewSuggestion,
  buildVisualDiffDocument,
  createTextQuoteSelectorFromText,
  applySuggestionDecisionToMarkdown,
  decodeTextQuoteSelector
} from '../../store/detran-workflow-review'
import { inspectMarkdownForBlobUrls } from '../../themes/default/components/transparent-editor/utils/smart-paste'

export default {
  name: 'DetranWorkflowReview',
  components: {
    ReviewComments,
    TransparentEditor
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
      editableTitle: '',
      editableTags: [],
      newTagInput: '',
      activeItemId: null,
      suggestionDecisions: {},
      draftModifiedByReview: false,
      reviewSaveTimer: null,
      draftSaveStatus: 'idle',
      lastSavedTime: '',
      draftSaveError: '',
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

    toolbarHintText () {
      if (this.docMode === 'edit') {
        return 'Modo Edição Ativo: altere o texto diretamente na folha e salve suas modificações'
      }
      if (this.docMode === 'clean') {
        return 'Exibindo prévia final limpa de como a página ficará publicada no portal'
      }
      return 'Selecione qualquer trecho do texto com o mouse para adicionar um comentário ou sugerir alteração'
    },

    autosaveStatusLabel () {
      if (this.draftSaveStatus === 'saving') {
        return 'Salvando alterações...'
      }
      if (this.draftSaveStatus === 'pending') {
        return 'Alterações pendentes...'
      }
      if (this.draftSaveStatus === 'saved') {
        return this.lastSavedTime ? `Salvo às ${this.lastSavedTime}` : 'Salvo no servidor'
      }
      if (this.draftSaveStatus === 'error') {
        return 'Erro ao salvar · Tentar novamente'
      }
      return ''
    },

    blobInspection () {
      return inspectMarkdownForBlobUrls(this.draft.content || '')
    },

    userId () {
      if (this.$store && this.$store.state && this.$store.state.user && this.$store.state.user.id) {
        return Number(this.$store.state.user.id)
      }
      if (this.$store && typeof this.$store.get === 'function') {
        const val = this.$store.get('user/id')
        if (val) return Number(val)
      }
      return 0
    },

    userEmail () {
      if (this.$store && this.$store.state && this.$store.state.user && this.$store.state.user.email) {
        return String(this.$store.state.user.email).trim().toLowerCase()
      }
      if (this.$store && typeof this.$store.get === 'function') {
        const val = this.$store.get('user/email')
        if (val) return String(val).trim().toLowerCase()
      }
      return ''
    },

    userPermissions () {
      let perms = []
      if (this.$store && this.$store.state && this.$store.state.user && this.$store.state.user.permissions) {
        perms = this.$store.state.user.permissions
      } else if (this.$store && typeof this.$store.get === 'function') {
        perms = this.$store.get('user/permissions') || []
      }
      if (Array.isArray(perms)) {
        return perms.reduce((acc, p) => { acc[p] = true; return acc }, {})
      }
      return perms || {}
    },

    canReviewOrApprove () {
      const perms = this.userPermissions
      return Boolean(perms['review:pages'] || perms['approve:pages'] || perms['manage:pages'] || perms['manage:system'])
    },

    canReview () {
      const perms = this.userPermissions
      return Boolean(perms['review:pages'] || perms['manage:pages'] || perms['manage:system'])
    },

    canApprove () {
      const perms = this.userPermissions
      return Boolean(perms['approve:pages'] || perms['manage:pages'] || perms['manage:system'])
    },

    returnReasonComment () {
      if (!this.draft || !Array.isArray(this.draft.events)) return ''
      const evt = this.draft.events.find(e => e.action === 'request_changes' && e.comment && e.comment.trim())
      if (evt) return evt.comment
      return this.draft.lastComment || ''
    },

    returnReviewerName () {
      if (!this.draft || !Array.isArray(this.draft.events)) return 'Revisor'
      const evt = this.draft.events.find(e => e.action === 'request_changes')
      return evt ? (evt.userName || 'Revisor') : 'Revisor'
    },

    isAuthor () {
      if (!this.draft) return false
      const uid = this.userId
      if (uid && this.draft.authorId && Number(this.draft.authorId) === uid) {
        return true
      }
      const uemail = this.userEmail
      if (uemail && this.draft.authorEmail && String(this.draft.authorEmail).trim().toLowerCase() === uemail) {
        return true
      }
      return false
    },

    visualDiff () {
      const formattedTime = this.draft.updatedAt ?
        moment(this.draft.updatedAt).format('DD/MM [às] HH:mm') :
        'Recente'
      const baseline = (this.draft && typeof this.draft.baseContent === 'string' && this.draft.baseContent.length > 0) ?
        this.draft.baseContent :
        (this.livePage && this.livePage.content ? this.livePage.content : '')
      return buildVisualDiffDocument({
        originalContent: baseline,
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
      return (this.draft.comments || []).filter(c => {
        if (c.resolved) return false
        const selector = decodeTextQuoteSelector(c)
        // Replies to suggestions or other comments do not count as root pending items
        if (selector.targetId || selector.parentCommentId) return false
        return true
      }).length
    },

    pendingReviewCount () {
      return this.pendingSuggestionsCount + this.unresolvedCommentsCount
    },

    canEditDraftText () {
      return canEditDraftContentInReview({
        state: this.draft && this.draft.state,
        isAuthor: this.isAuthor,
        canReviewOrApprove: this.canReviewOrApprove
      })
    },

    canDecideSuggestions () {
      return canDecideReviewSuggestion({
        isAuthor: this.isAuthor,
        canReviewOrApprove: this.canReviewOrApprove,
        state: this.draft && this.draft.state
      })
    },

    actionsHelper () {
      return getAvailableReviewActions(
        {
          ...(this.draft || {}),
          isAuthor: this.isAuthor,
          pendingReviewCount: this.pendingReviewCount
        },
        this.userPermissions
      )
    },

    decisionCardIconClass () {
      if (this.draft.state === 'published') return 'is-emerald'
      if (this.draft.state === 'changes_requested' || this.draft.state === 'draft') return 'is-amber'
      if (this.isAuthor || !this.canReviewOrApprove) return 'is-amber'
      if (this.actionsHelper.awaitingFinalApprovalOnly) return 'is-emerald'
      if (this.actionsHelper.requiresApproverToPublish && !this.actionsHelper.canApproveStep && !this.actionsHelper.canPublish) return 'is-amber'
      return this.pendingReviewCount > 0 ? 'is-amber' : 'is-emerald'
    },

    decisionCardIconColor () {
      if (this.draft.state === 'published') return '#15803d'
      if (this.draft.state === 'changes_requested' || this.draft.state === 'draft') return '#d97706'
      if (this.isAuthor || !this.canReviewOrApprove) return '#d97706'
      if (this.actionsHelper.awaitingFinalApprovalOnly) return '#15803d'
      if (this.actionsHelper.requiresApproverToPublish && !this.actionsHelper.canApproveStep && !this.actionsHelper.canPublish) return '#d97706'
      return this.pendingReviewCount > 0 ? '#d97706' : '#15803d'
    },

    decisionCardIcon () {
      if (this.draft.state === 'published') return 'mdi-check-decagram'
      if (this.draft.state === 'changes_requested') return 'mdi-undo-variant'
      if (this.draft.state === 'draft') return 'mdi-file-document-edit-outline'
      if (this.isAuthor || !this.canReviewOrApprove) return 'mdi-clock-outline'
      if (this.actionsHelper.awaitingFinalApprovalOnly) return 'mdi-stamper'
      if (this.actionsHelper.requiresApproverToPublish && !this.actionsHelper.canApproveStep && !this.actionsHelper.canPublish) return 'mdi-shield-account-outline'
      return this.pendingReviewCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-decagram'
    },

    decisionCardTitle () {
      if (this.draft.state === 'published') return '✓ Documento Homologado'
      if (this.draft.state === 'changes_requested') return 'Devolvido para Ajustes'
      if (this.draft.state === 'draft') return 'Rascunho em Elaboração'
      if (this.isAuthor) {
        return 'Modo Acompanhamento (Em Revisão)'
      }
      if (!this.canReviewOrApprove) {
        return 'Visualização do Documento'
      }
      if (this.actionsHelper.awaitingFinalApprovalOnly) {
        return 'Revisão Técnica Concluída'
      }
      if (this.pendingReviewCount > 0) {
        return `Faltam ${this.pendingReviewCount} ${this.pendingReviewCount === 1 ? 'revisão pendente' : 'revisões pendentes'}`
      }
      if (this.actionsHelper.requiresApproverToPublish && !this.actionsHelper.canApproveStep && !this.actionsHelper.canPublish) {
        return 'Alterações Revisadas (Aguardando Aprovador)'
      }
      return '✓ Todas as alterações revisadas'
    },

    decisionCardSubtitle () {
      if (this.draft.state === 'published') return this.actionsHelper.statusDescription
      if (this.draft.state === 'changes_requested') return 'Ajustes solicitados ao autor. Aguardando reedição e nova submissão.'
      if (this.draft.state === 'draft') return 'Rascunho ainda não submetido para validação editorial.'
      if (this.isAuthor) {
        return 'Documento na fila de análise. Acompanhe comentários abaixo ou puxe de volta para edição se precisar alterar o texto.'
      }
      if (!this.canReviewOrApprove) {
        return 'Acompanhamento de tramitação editorial.'
      }
      if (this.actionsHelper.awaitingFinalApprovalOnly) {
        return 'Documento encaminhado ao Nível 2 e aguardando homologação final por um Aprovador.'
      }
      if (this.pendingReviewCount > 0) {
        return `${this.pendingReviewCount} ${this.pendingReviewCount === 1 ? 'item aguardando' : 'itens aguardando'} análise nos cartões abaixo`
      }
      if (this.actionsHelper.requiresApproverToPublish && !this.actionsHelper.canApproveStep && !this.actionsHelper.canPublish) {
        return 'Rascunho em fluxo de 1 nível — publicação oficial restrita ao perfil Aprovador'
      }
      if (this.actionsHelper.canApproveStep && !this.actionsHelper.canPublish) {
        return 'Nenhuma pendência restante — pronto para aprovar a revisão técnica e encaminhar ao Aprovador'
      }
      return 'Nenhuma pendência restante — pronto para aprovar e publicar'
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
    },
    'visualDiff.html' () {
      this.$nextTick(() => {
        this.renderMermaidDiagrams()
      })
    },
    docMode () {
      this.$nextTick(() => {
        this.renderMermaidDiagrams()
      })
    }
  },
  mounted () {
    document.addEventListener('mousedown', this.onGlobalMouseDown)
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default'
      })
    } catch (e) {}
    this.$nextTick(() => {
      this.renderMermaidDiagrams()
    })
  },
  beforeDestroy () {
    document.removeEventListener('mousedown', this.onGlobalMouseDown)
    if (this.reviewSaveTimer) clearTimeout(this.reviewSaveTimer)
  },
  methods: {
    goBack () {
      if (window.history.length > 1) {
        this.$router.go(-1)
      } else {
        this.$router.push('/')
      }
    },

    onTitleChange () {
      this.draft.title = this.editableTitle
      this.draftModifiedByReview = true
      this.debouncedSaveDraft()
    },

    addTag () {
      const val = String(this.newTagInput || '').trim().replace(/^#/, '').toLowerCase()
      if (!val) return
      if (!this.editableTags.includes(val)) {
        this.editableTags.push(val)
        this.draft.tags = [...this.editableTags]
        this.draftModifiedByReview = true
        this.debouncedSaveDraft()
      }
      this.newTagInput = ''
    },

    removeTag (index) {
      this.editableTags.splice(index, 1)
      this.draft.tags = [...this.editableTags]
      this.draftModifiedByReview = true
      this.debouncedSaveDraft()
    },

    debouncedSaveDraft () {
      this.draftSaveStatus = 'pending'
      clearTimeout(this.reviewSaveTimer)
      this.reviewSaveTimer = setTimeout(() => {
        this.persistReviewedDraftContentIfNeeded().catch(() => {})
      }, 1000)
    },

    retrySaveDraft () {
      if (this.draftSaveStatus !== 'error') return
      this.draftModifiedByReview = true
      this.persistReviewedDraftContentIfNeeded().catch(() => {})
    },

    renderMermaidDiagrams () {
      const root = this.$refs.docContent
      if (!root) return
      const mermaidNodes = root.querySelectorAll('.mermaid')
      if (!mermaidNodes || !mermaidNodes.length) return
      mermaidNodes.forEach((elm, idx) => {
        if (elm.dataset.mermaidRendered === 'true') return
        const code = (elm.textContent || '').trim()
        if (!code) return
        try {
          const diagramId = `review-mermaid-${Date.now()}-${idx}`
          mermaid.render(diagramId, code, (svgCode) => {
            elm.innerHTML = svgCode
            elm.dataset.mermaidRendered = 'true'
          })
        } catch (err) {
          // Mantém fallback textual em caso de sintaxe incompleta
        }
      })
    },

    setDocMode (mode) {
      if (mode === 'edit' && !this.canEditDraftText) {
        this.$store.commit('showNotification', {
          style: 'amber',
          icon: 'alert',
          message: this.isAuthor ?
            'Documento em revisão: clique em "Puxar de Volta para Edição" antes de alterar o texto.' :
            'Você não possui permissão para editar este documento.'
        })
        return
      }
      this.docMode = mode
      if (mode === 'clean') {
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'eye',
          message: 'Exibindo prévia final limpa (como a página ficará publicada no portal).'
        })
      } else if (mode === 'edit') {
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'pencil',
          message: 'Modo de edição ativo: edite o texto à esquerda e aceite ou recuse sugestões à direita.'
        })
      }
    },

    onReviewEditorChange ({ markdown }) {
      this.draft.content = markdown
      this.draftModifiedByReview = true
      this.draftSaveStatus = 'pending'
      if (this.reviewSaveTimer) clearTimeout(this.reviewSaveTimer)
      this.reviewSaveTimer = setTimeout(() => {
        this.persistReviewedDraftContentIfNeeded().catch(() => {})
      }, 900)
    },

    async onReviewEditorSaveDraft (payload) {
      if (payload && typeof payload.markdown === 'string') {
        this.draft.content = payload.markdown
      }
      this.draftModifiedByReview = true
      if (this.reviewSaveTimer) clearTimeout(this.reviewSaveTimer)
      try {
        await this.persistReviewedDraftContentIfNeeded()
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Rascunho salvo com sucesso!'
        })
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: 'Erro ao salvar rascunho.'
        })
      }
    },

    onGlobalMouseDown (e) {
      if (this.selectionPopover.visible && !e.target.closest('.detran-selection-popover')) {
        this.selectionPopover.visible = false
      }
    },

    onDocMouseUp () {
      if (this.docMode === 'edit' || !this.draft || this.draft.state === 'published' || this.draft.state === 'archived') {
        return
      }
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

    async onSuggestionDecision ({ item, decision }) {
      if (this.isAuthor || !this.canReviewOrApprove) {
        this.$store.commit('showNotification', {
          style: 'amber',
          icon: 'alert',
          message: 'O autor não pode aceitar ou recusar as próprias alterações.'
        })
        return
      }
      const prevDecision = this.suggestionDecisions[item.id] || 'pending'
      this.$set(this.suggestionDecisions, item.id, decision)

      if (decision === 'rejected') {
        this.draft.content = applySuggestionDecisionToMarkdown({
          draftContent: this.draft.content,
          suggestion: item,
          decision: 'reject'
        })
        this.draftModifiedByReview = true
      } else if (decision === 'pending' && prevDecision === 'rejected') {
        this.draft.content = applySuggestionDecisionToMarkdown({
          draftContent: this.draft.content,
          suggestion: item,
          decision: 'restore'
        })
        this.draftModifiedByReview = true
      }

      try {
        const result = await this.$apollo.mutate({
          mutation: gql`
            mutation ($draftId: Int!, $suggestionId: String!, $decision: String!, $content: String) {
              workflow {
                setSuggestionDecision(
                  draftId: $draftId
                  suggestionId: $suggestionId
                  decision: $decision
                  content: $content
                ) {
                  responseResult {
                    succeeded
                    message
                  }
                  draft {
                    id
                    decisions
                    content
                  }
                }
              }
            }
          `,
          variables: {
            draftId: this.draft.id,
            suggestionId: item.id,
            decision,
            content: this.draft.content
          }
        })
        const res = result && result.data && result.data.workflow && result.data.workflow.setSuggestionDecision
        if (res && res.responseResult && res.responseResult.succeeded) {
          if (res.draft && res.draft.decisions) {
            try {
              this.suggestionDecisions = typeof res.draft.decisions === 'string' ? JSON.parse(res.draft.decisions) : res.draft.decisions
            } catch (e) {}
          }
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: err.message || 'Erro ao persistir decisão da sugestão.'
        })
      }

      if (decision === 'rejected') {
        this.$store.commit('showNotification', {
          style: 'orange',
          icon: 'undo',
          message: 'Sugestão recusada e trecho revertido para a versão original.'
        })
      } else if (decision === 'accepted') {
        this.$store.commit('showNotification', {
          style: 'success',
          icon: 'check',
          message: 'Sugestão aceita e incorporada ao documento!'
        })
      } else {
        this.$store.commit('showNotification', {
          style: 'blue',
          icon: 'undo',
          message: 'Item reaberto como pendente.'
        })
      }
    },

    async onRedactionDecision ({ item, decision }) {
      if (this.isAuthor || !this.canReviewOrApprove) {
        this.$store.commit('showNotification', {
          style: 'amber',
          icon: 'alert',
          message: 'Apenas revisores e aprovadores podem decidir sobre sugestões de redação.'
        })
        return
      }
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
        await this.persistReviewedDraftContentIfNeeded().catch(() => {})
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
                  baseContent
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
                  decisions
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
        this.editableTitle = draftData.title || ''
        this.editableTags = Array.isArray(draftData.tags) ? [...draftData.tags] : []
        if (draftData.decisions) {
          try {
            this.suggestionDecisions = typeof draftData.decisions === 'string' ? JSON.parse(draftData.decisions) : draftData.decisions
          } catch (e) {
            this.suggestionDecisions = {}
          }
        } else {
          this.suggestionDecisions = {}
        }
        this.draftModifiedByReview = false

        if (draftData.baseContent !== undefined && draftData.baseContent !== null) {
          this.livePage = {
            content: draftData.baseContent,
            title: draftData.title || '',
            description: draftData.description || ''
          }
        }

        const routeQuery = (this.$route && this.$route.query) || {}
        const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : new URLSearchParams()
        const explicitMode = routeQuery.mode || urlParams.get('mode')
        const wantsEdit = explicitMode === 'edit' || routeQuery.edit === '1' || routeQuery.edit === 'true' || urlParams.get('edit') === '1' || urlParams.get('edit') === 'true'

        if (wantsEdit && this.canEditDraftText) {
          this.docMode = 'edit'
        } else if (explicitMode === 'clean') {
          this.docMode = 'clean'
        } else if (explicitMode === 'suggest') {
          this.docMode = 'suggest'
        } else {
          // Dynamic default based on user profile and document state:
          // 1. Editor opening returned draft (devolução) -> Editar Texto por default
          if ((draftData.state === 'changes_requested' || draftData.state === 'draft') && this.canEditDraftText) {
            this.docMode = 'edit'
          // 2. Aprovador na etapa de aprovação -> Prévia Final Limpa por default
          } else if (draftData.state === 'awaiting_approval' || draftData.state === 'in_approval_step2' || (this.canApprove && !this.canReview)) {
            this.docMode = 'clean'
          // 3. Revisor na etapa de revisão -> Modo Sugestões (Diff Visual) por default
          } else {
            this.docMode = 'suggest'
          }
        }

        if (!this.livePage || !this.livePage.content) {
          if (draftData.pageId) {
            await this.loadLivePageContent(draftData.pageId)
          } else if (draftData.path) {
            await this.loadLivePageByPath(draftData.path, draftData.locale || 'pt-br')
          } else {
            this.livePage = { content: '', title: '', description: '' }
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

    onCommentAdded (newComment) {
      this.draft.comments = [...(this.draft.comments || []), newComment]
      this.activeItemId = `com-${newComment.id}`
      this.$store.commit('showNotification', {
        style: 'success',
        icon: 'check',
        message: 'Comentário adicionado ao documento!'
      })
    },

    onCommentResolved ({ id, resolved, decision }) {
      const nowIso = new Date().toISOString()
      this.draft.comments = (this.draft.comments || []).map(c => {
        if (c.id === id) {
          let updatedAnchor = c.anchorText
          if (updatedAnchor) {
            try {
              const parsed = JSON.parse(updatedAnchor)
              parsed.status = decision || (resolved ? 'accepted' : 'pending')
              if (resolved) {
                parsed.reviewedAt = nowIso
              } else {
                delete parsed.reviewedAt
              }
              updatedAnchor = JSON.stringify(parsed)
            } catch (e) {}
          }
          return { ...c, resolved, updatedAt: nowIso, anchorText: updatedAnchor }
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
      if ((type === 'approveStep' || type === 'publish') && this.pendingReviewCount > 0) {
        this.$store.commit('showNotification', {
          style: 'amber',
          icon: 'alert',
          message: `Analise (aceite ou recuse) todos os ${this.pendingReviewCount} item(ns) pendente(s) antes de aprovar ou publicar.`
        })
        return
      }

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
        this.actionDialog.title = 'Enviar Texto para o Aprovador'
        this.actionDialog.description =
          'Todas as alterações do editor foram revisadas. O documento avançará para a homologação final do Aprovador.'
        this.actionDialog.commentLabel = 'Parecer da Revisão (Opcional):'
        this.actionDialog.commentPlaceholder = 'Ex: Modificações editoriais aceitas e texto revisado com sucesso...'
        this.actionDialog.icon = 'mdi-send-check-outline'
        this.actionDialog.headerClass = 'is-emerald'
      } else if (type === 'publish') {
        this.actionDialog.title = 'Aprovar e Publicar no Portal da Intranet'
        this.actionDialog.description =
          'As sugestões aceitas serão consolidadas e a versão homologada será publicada oficialmente no Portal da Intranet.'
        this.actionDialog.commentLabel = 'Despacho de Homologação (Opcional):'
        this.actionDialog.commentPlaceholder = 'Ex: Revisado e homologado conforme diretrizes editoriais...'
        this.actionDialog.icon = 'mdi-shield-check'
        this.actionDialog.headerClass = 'is-emerald'
      } else if (type === 'submit') {
        this.actionDialog.title = 'Submeter Documento para Aprovação'
        this.actionDialog.description =
          'Suas edições no texto e decisões sobre as sugestões serão salvas e enviadas novamente para revisão e aprovação.'
        this.actionDialog.commentLabel = 'Resumo dos ajustes realizados (Opcional):'
        this.actionDialog.commentPlaceholder = 'Ex: Ajustes aplicados nos trechos apontados pela revisão...'
        this.actionDialog.icon = 'mdi-send-check-outline'
        this.actionDialog.headerClass = 'is-emerald'
      } else if (type === 'retract') {
        this.actionDialog.title = 'Puxar de Volta para Edição'
        this.actionDialog.description =
          'Você retomará o documento como rascunho para realizar alterações no texto antes da revisão.'
        this.actionDialog.commentLabel = 'Motivo da retirada (Opcional):'
        this.actionDialog.commentPlaceholder = 'Ex: Necessário complementar anexo ou ajustar redação...'
        this.actionDialog.icon = 'mdi-undo-variant'
        this.actionDialog.headerClass = 'is-warning'
      }

      this.actionDialog.visible = true
    },

    async persistReviewedDraftContentIfNeeded () {
      if (!this.draftModifiedByReview) return
      this.draftSaveStatus = 'saving'
      this.draftSaveError = ''
      try {
        const res = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $id: Int
              $pageId: Int
              $path: String!
              $locale: String!
              $title: String!
              $description: String
              $content: String!
              $contentType: String
              $editorKey: String
              $tags: [String]
              $decisions: String
            ) {
              workflow {
                saveDraft(
                  id: $id
                  pageId: $pageId
                  path: $path
                  locale: $locale
                  title: $title
                  description: $description
                  content: $content
                  contentType: $contentType
                  editorKey: $editorKey
                  tags: $tags
                  decisions: $decisions
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
            id: this.draft.id || null,
            pageId: this.draft.pageId || null,
            path: this.draft.path,
            locale: this.draft.locale || 'pt-br',
            title: this.draft.title || 'Documento',
            description: this.draft.description || '',
            content: this.draft.content,
            contentType: this.draft.contentType || 'markdown',
            editorKey: this.draft.editorKey || 'markdown',
            tags: this.draft.tags || [],
            decisions: JSON.stringify(this.suggestionDecisions || {})
          }
        })
        const saveResult = res &&
          res.data &&
          res.data.workflow &&
          res.data.workflow.saveDraft &&
          res.data.workflow.saveDraft.responseResult
        if (saveResult && saveResult.succeeded === false) {
          throw new Error(saveResult.message || 'Falha ao salvar rascunho.')
        }
        this.draftModifiedByReview = false
        this.draftSaveStatus = 'saved'
        this.lastSavedTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      } catch (err) {
        this.draftSaveStatus = 'error'
        this.draftSaveError = (err && err.message) || 'Erro ao salvar rascunho.'
        throw err
      }
    },

    async executeAction () {
      const { type, comment } = this.actionDialog

      if (type === 'requestChanges' && !comment.trim()) {
        this.actionDialog.error = 'Informe um resumo das alterações solicitadas ao autor.'
        return
      }

      if ((type === 'approveStep' || type === 'publish') && this.pendingReviewCount > 0) {
        this.actionDialog.error = `Analise todos os ${this.pendingReviewCount} item(ns) pendente(s) antes de aprovar ou publicar.`
        return
      }

      this.submittingAction = true
      this.actionDialog.error = ''

      try {
        // Se havia URLs blob: quebradas, limpa antes de publicar
        if (type === 'publish' && this.blobInspection.hasBlobUrls) {
          this.sanitizeDraftBlobUrls()
        }

        if (type !== 'retract') {
          await this.persistReviewedDraftContentIfNeeded()
        }

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
            this.draft.events = [
              { id: Date.now(), action: 'request_changes', comment: comment.trim(), createdAt: new Date().toISOString() },
              ...(this.draft.events || [])
            ]
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
            this.draft.events = [
              { id: Date.now(), action: 'approve_step', comment: comment.trim() || null, createdAt: new Date().toISOString() },
              ...(this.draft.events || [])
            ]
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Texto revisado e enviado para o Aprovador com sucesso!'
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
            this.draft.events = [
              { id: Date.now(), action: 'publish', comment: comment.trim() || null, createdAt: new Date().toISOString() },
              ...(this.draft.events || [])
            ]
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
        } else if (type === 'submit') {
          const submitComment = comment.trim() || 'Ajustes realizados e submetidos novamente para aprovação'
          const res = await this.$apollo.mutate({
            mutation: gql`
              mutation ($id: Int!, $comment: String) {
                workflow {
                  submit(id: $id, comment: $comment) {
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
            variables: { id: this.draft.id, comment: submitComment }
          })
          const data = res && res.data && res.data.workflow && res.data.workflow.submit
          if (data && data.responseResult && data.responseResult.succeeded) {
            this.draft.state = (data.draft && data.draft.state) || 'in_review'
            this.draft.events = [
              { id: Date.now(), action: 'submit', comment: submitComment, createdAt: new Date().toISOString() },
              ...(this.draft.events || [])
            ]
            this.docMode = 'suggest'
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Documento reenviado para aprovação com sucesso!'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao submeter para aprovação.'
          }
        } else if (type === 'retract') {
          const res = await this.$apollo.mutate({
            mutation: gql`
              mutation ($id: Int!, $comment: String) {
                workflow {
                  retract(id: $id, comment: $comment) {
                    responseResult {
                      succeeded
                      message
                    }
                    draft {
                      id
                      state
                      currentLevel
                      decisions
                    }
                  }
                }
              }
            `,
            variables: { id: this.draft.id, comment: comment.trim() || null }
          })
          const data = res && res.data && res.data.workflow && res.data.workflow.retract
          if (data && data.responseResult && data.responseResult.succeeded) {
            this.draft.state = (data.draft && data.draft.state) || 'draft'
            this.suggestionDecisions = {}
            this.draft.events = [
              { id: Date.now(), action: 'retract', comment: comment.trim() || 'Retirado pelo autor para edição', createdAt: new Date().toISOString() },
              ...(this.draft.events || [])
            ]
            this.docMode = 'edit'
            this.$store.commit('showNotification', {
              style: 'success',
              icon: 'check',
              message: 'Documento retornado para rascunho. Modo de edição liberado!'
            })
            /* eslint-disable-next-line vue/custom-event-name-casing */
            this.$root.$emit('workflowRefreshTasks')
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = (data && data.responseResult && data.responseResult.message) || 'Falha ao puxar documento de volta para edição.'
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
  padding-bottom: 2rem;
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

  &__top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.625rem 1.25rem;
    background: #f8fafc;
    border-bottom: 1px solid $slate-200;
  }

  &__top-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__top-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__title-section {
    padding: 1.125rem 1.25rem 0.875rem;
  }

  &__title-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}

.detran-page-title-editor {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 1 1 280px;
  max-width: 580px;

  &__icon {
    position: absolute;
    right: 10px;
    color: #94a3b8 !important;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease, color 0.15s ease;
  }

  &:hover &__icon {
    opacity: 0.85;
  }

  &:focus-within &__icon {
    opacity: 1;
    color: #16a34a !important;
  }
}

.detran-page-title-input {
  font-family: inherit;
  font-size: 1.625rem;
  font-weight: 800;
  color: $slate-900;
  line-height: 1.25;
  letter-spacing: -0.02em;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 0.625rem;
  padding: 0.2rem 2rem 0.2rem 0.55rem;
  margin-left: -0.55rem;
  background: transparent;
  width: 100%;
  outline: none;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;

  &::placeholder {
    color: #94a3b8;
    font-weight: 600;
  }

  &:hover {
    background: #f8fafc;
    border-color: #e2e8f0;
  }

  &:focus {
    background: #ffffff;
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
  }
}

.detran-autosave-pill {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
  animation: autosavePillIn 0.18s ease-out;

  &:disabled {
    cursor: default;
  }

  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 9999px;
    background: #f59e0b;
    animation: autosavePulse 1.4s ease-in-out infinite;
  }

  &.is-pending {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  &.is-saving {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #e2e8f0;
  }

  &.is-saved {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }

  &.is-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    cursor: pointer;

    &:hover {
      background: #fee2e2;
      border-color: #fca5a5;
    }
  }
}

@keyframes autosavePillIn {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes autosavePulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.85);
  }
}

.detran-changes-requested-banner {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #d97706;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  box-shadow: 0 2px 6px rgba(217, 119, 6, 0.08);

  &__icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #92400e;
    display: block;
    margin-bottom: 0.25rem;
  }

  &__body {
    font-size: 0.875rem;
    color: #78350f;
    margin-bottom: 0.35rem;
    line-height: 1.4;
  }

  &__hint {
    font-size: 0.75rem;
    color: #b45309;
    font-weight: 500;
  }
}

.detran-gdocs-top-sep {
  color: $slate-300;
  font-weight: 300;
}

.detran-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: $slate-700;
  background: #ffffff;
  border: 1px solid $slate-300;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: $slate-100;
    color: $slate-900;
    border-color: $slate-400;
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

  @media (max-width: 1024px) {
    padding: 0.5rem 1rem;

    &__meta {
      width: 100%;
      justify-content: space-between;
    }

    &__controls {
      width: 100%;
      justify-content: space-between;
      margin-left: 0;
    }
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
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 3px;
  border-radius: 10px;
  gap: 2px;

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    font-size: 0.75rem;
    font-weight: 600;
    color: $slate-600;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

    &:hover:not(.is-active) {
      color: $slate-900;
      background: rgba(255, 255, 255, 0.55);
    }

    &.is-active {
      background: #ffffff;
      color: $slate-900;
      border-color: rgba(226, 232, 240, 0.9);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
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

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

.detran-gdocs-main {
  position: relative;
  min-width: 0;
}

.detran-gdocs-aside {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;

  @media (max-width: 1200px) {
    position: static;
    margin-top: 1rem;
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
  overflow-x: hidden;

  @media (max-width: 1200px) {
    padding: 1.75rem 1.5rem;
  }

  @media (max-width: 640px) {
    padding: 1.25rem 1rem;
  }
}

.detran-doc-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f1f5f9;
}

.detran-doc-tag {
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.015em;
  background: #ecfdf5;
  color: #15803d;
  border: 1px solid #a7f3d0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  transition: background-color 0.14s ease, border-color 0.14s ease;

  &.is-system {
    background: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.675rem;
  }

  &.is-editable:hover {
    background: #dcfce7;
    border-color: #86efac;
  }

  &__remove {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    background: transparent;
    border: none;
    color: #15803d;
    cursor: pointer;
    padding: 0;
    margin-left: 1px;
    margin-right: -3px;
    border-radius: 9999px;
    transition: background-color 0.14s ease, color 0.14s ease, transform 0.12s ease;

    .v-icon {
      color: inherit !important;
    }

    &:hover {
      background: rgba(22, 163, 74, 0.18);
      color: #14532d;
      transform: scale(1.08);
    }

    &:active {
      transform: scale(0.92);
    }
  }
}

.detran-doc-tag-add {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.detran-doc-tag-input {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  width: 84px;
  border: 1px dashed #cbd5e1;
  border-radius: 9999px;
  background: #f8fafc;
  outline: none;
  color: #334155;
  transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;

  &::placeholder {
    color: #94a3b8;
  }

  &:hover {
    background: #ffffff;
    border-color: #94a3b8;
  }

  &:focus {
    width: 132px;
    background: #ffffff;
    border-color: #22c55e;
    border-style: solid;
    box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
  }
}

.detran-doc-tag-add-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 9999px;
  padding: 0;
  cursor: pointer;
  transition: background-color 0.14s ease, transform 0.1s ease;

  &:hover {
    background: #dcfce7;
  }

  &:active {
    transform: scale(0.92);
  }
}

.detran-doc-edit-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #16a34a;
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
  }
}

.detran-doc-content {
  color: #1e293b;
  font-size: 1rem;
  line-height: 1.75;
  overflow-wrap: break-word;

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

  .detran-doc-diagram {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);

    .diagram,
    .mermaid {
      display: block;
      width: 100%;
      text-align: center;

      svg {
        max-width: 100% !important;
        height: auto !important;
        display: block !important;
        margin: 0 auto !important;
        color-scheme: light !important;
        direction: ltr !important;

        foreignObject {
          overflow: visible !important;

          p {
            margin: 0 !important;
          }
        }
      }
    }
  }

  .detran-doc-code {
    max-width: 100%;
    overflow-x: auto;
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 0.8125rem;
    line-height: 1.6;
    font-family: 'Fira Code', 'JetBrains Mono', Consolas, monospace;

    code {
      background: transparent !important;
      color: inherit !important;
      padding: 0 !important;
    }
  }

  .detran-doc-hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 1.5rem 0;
  }

  .diagram-suggestion-box {
    margin: 1.5rem 0;
    padding: 0.75rem;
    border-radius: 0.75rem;
    border: 2px dashed #22c55e;
    background-color: rgba(240, 253, 244, 0.45);

    &.is-del {
      border-color: #ef4444;
      background-color: rgba(254, 242, 242, 0.55);

      .img-suggestion-badge {
        color: #991b1b;
      }

      .img-suggestion-badge__pill {
        background: #fecaca;
        color: #7f1d1d;
      }
    }
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
  .suggestion-del-block,
  .diagram-suggestion-box.is-del {
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

  .img-suggestion-box,
  .diagram-suggestion-box {
    border-color: transparent !important;
    background-color: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
}

// =============================================================================
// 2.4 SEÇÃO DE DECISÃO EDITORIAL NA LATERAL (ANTES DE REVISÃO & COMENTÁRIOS)
// =============================================================================
.detran-decision-side-card {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);

  &__header {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  &__icon {
    width: 34px;
    height: 34px;
    border-radius: 0.625rem;
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

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.25;
  }

  &__sub {
    font-size: 0.6875rem;
    color: #64748b;
    line-height: 1.3;
    margin-top: 2px;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;

    .detran-fab-btn {
      flex: 1 1 135px;
      padding: 0.55rem 0.75rem;
      font-size: 0.78125rem;
      border-radius: 0.625rem;
      white-space: nowrap;
    }
  }

  &__lock-hint {
    width: 100%;
    margin: 0.35rem 0 0;
    padding: 0.5rem 0.65rem;
    border-radius: 0.5rem;
    background-color: #fffbeb;
    border: 1px solid #fde68a;
    color: #92400e;
    font-size: 0.71875rem;
    line-height: 1.4;
    text-align: left;
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

  &--neutral {
    background: #ffffff;
    color: #334155 !important;
    border: 1px solid #cbd5e1;

    &:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #94a3b8;
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

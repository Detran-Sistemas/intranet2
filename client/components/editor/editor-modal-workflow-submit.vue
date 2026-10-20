<template lang='pug'>
v-dialog(
  v-model='isOpen'
  max-width='640'
  persistent
)
  v-card.detran-wf-submit-modal
    //- Header do Modal
    .detran-wf-submit-modal__header.px-6.py-4.d-flex.align-center
      .detran-wf-submit-modal__header-icon.mr-3
        v-icon(size='22', color='#16a34a') mdi-send-check-outline
      .d-flex.flex-column
        .subtitle-1.font-weight-bold.detran-wf-submit-modal__header-title Submeter para Revisão Institucional
        .caption.text-muted Fluxo de Governança e Homologação Detran-MG
      v-spacer
      v-btn(icon, small, :disabled='isSubmitting', @click='close')
        v-icon mdi-close

    v-divider

    //- Corpo do Modal
    v-card-text.px-6.py-4
      //- Alerta de Erro ou Conflito de Concorrência
      v-alert.mb-4(
        v-if='errorMessage'
        dense
        prominent
        type='error'
        text
        icon='mdi-alert-octagon-outline'
      )
        .font-weight-bold(v-if='isConflict') Conflito de Concorrência Detectado
        .body-2 {{ errorMessage }}
        .caption.mt-1(v-if='isConflict') A versão em produção foi modificada por outro servidor enquanto este rascunho era editado. Atualize ou compare as versões antes de submeter.

      //- 1. REVISÃO DE METADADOS DO DOCUMENTO
      .detran-wf-section.mb-4
        .caption.font-weight-bold.text-uppercase.detran-wf-section__label.mb-2
          v-icon(size='14', left, color='#475569') mdi-file-document-outline
          span 1. Conferência de Metadados

        .detran-wf-metadata-box.pa-3
          //- Título
          .d-flex.align-center.justify-space-between.mb-1
            .body-2.font-weight-bold.text-truncate(:class='{"red--text text--darken-2": !isTitleValid}')
              | {{ displayTitle || '(Sem título definido)' }}
            v-chip(x-small, :color='isTitleValid ? "#dcfce7" : "#fee2e2"', :text-color='isTitleValid ? "#15803d" : "#b91c1c"')
              | {{ isTitleValid ? "Título OK" : "Título Inválido" }}

          .caption.text-muted.mb-2(v-if='!isTitleValid')
            | * Defina um título institucional válido antes de encaminhar para a revisão.

          //- Rota / Caminho e Locale
          .d-flex.align-center.flex-wrap.caption.text-muted.mb-2
            span.font-weight-medium.mr-1 Caminho:
            code.detran-wf-path-pill {{ locale }}/{{ path }}

          //- Descrição / Sumário Executivo
          .caption.text-muted.mb-2(v-if='displayDescription')
            span.font-weight-medium Descrição: 
            span {{ displayDescription }}

          //- Tags / Palavras-chave
          .d-flex.align-center.flex-wrap(v-if='displayTags.length > 0')
            span.caption.text-muted.mr-2 Tags:
            v-chip.mr-1.mb-1(
              v-for='(tag, idx) in displayTags'
              :key='idx'
              x-small
              outlined
              color='#2563eb'
            ) {{ tag }}

      //- 2. SELEÇÃO DE NÍVEIS DE HOMOLOGAÇÃO
      .detran-wf-section.mb-4
        .caption.font-weight-bold.text-uppercase.detran-wf-section__label.mb-2
          v-icon(size='14', left, color='#475569') mdi-shield-account-outline
          span 2. Níveis de Homologação

        v-select(
          outlined
          dense
          label='Fluxo de Parecer e Aprovação'
          :items='approvalOptions'
          v-model='selectedApprovalMode'
          :disabled='isPolicyEnforced2Levels'
          prepend-inner-icon='mdi-shield-check'
          hide-details
        )

        //- Aviso quando 2 níveis são mandatórios por política institucional
        .detran-wf-policy-notice.mt-2.pa-2.d-flex.align-center(v-if='isPolicyEnforced2Levels')
          v-icon(size='16', color='#1d4ed8', left).mr-2 mdi-information-outline
          .caption.blue--text.text--darken-4
            | A política institucional para rotas sob 
            strong {{ effectivePolicy.pathPrefix || path }}
            |  exige obrigatoriamente 2 níveis de homologação.

      //- 3. JUSTIFICATIVA E APONTAMENTOS PARA OS REVISORES
      .detran-wf-section.mb-2
        .caption.font-weight-bold.text-uppercase.detran-wf-section__label.mb-2
          v-icon(size='14', left, color='#475569') mdi-comment-text-outline
          span 3. Justificativa / Sumário para a Revisão

        v-textarea(
          outlined
          dense
          rows='3'
          counter='500'
          label='Mensagem para a Equipe de Revisores'
          placeholder='Ex: Atualização dos procedimentos de atendimento conforme Portaria DETRAN-MG 2026/01.'
          v-model='comment'
          hide-details='auto'
        )

      //- Nota sobre o bloqueio temporário de edição
      .detran-wf-lock-notice.mt-3.pa-3.d-flex.align-center
        v-icon(size='16', color='#64748b', left).mr-2 mdi-lock-clock
        .caption.text-muted
          | Ao confirmar o envio, o documento entrará em 
          strong Em Revisão
          |  e a edição direta será bloqueada até a conclusão do parecer ou solicitação de ajustes pela área competente.

    v-divider

    //- Ações do Modal
    v-card-actions.px-6.py-3
      v-spacer
      v-btn(
        text
        :disabled='isSubmitting'
        @click='close'
      ) Cancelar
      v-btn(
        color='#288b4a'
        dark
        depressed
        :loading='isSubmitting'
        :disabled='!canSubmit'
        @click='handleSubmit'
      )
        v-icon(left, size='18') mdi-send
        span Confirmar Envio
</template>

<script>
import gql from 'graphql-tag'
import _ from 'lodash'

export const MUTATION_WORKFLOW_SUBMIT = gql`
  mutation ($id: Int!, $approvalMode: String, $comment: String) {
    workflowSubmit(id: $id, approvalMode: $approvalMode, comment: $comment) {
      responseResult {
        succeeded
        message
        errorCode
        slug
      }
      draft {
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
      }
    }
  }
`

export default {
  name: 'EditorModalWorkflowSubmit',
  props: {
    value: {
      type: Boolean,
      default: false
    },
    draft: {
      type: Object,
      default: () => null
    },
    effectivePolicy: {
      type: Object,
      default: () => ({ approvalLevels: 1, reviewIntervalDays: 365 })
    },
    pageId: {
      type: Number,
      default: 0
    },
    path: {
      type: String,
      required: true
    },
    locale: {
      type: String,
      default: 'pt-br'
    }
  },
  data() {
    return {
      selectedApprovalMode: '1_level',
      comment: '',
      isSubmitting: false,
      errorMessage: '',
      isConflict: false,
      conflictDetails: null,
      approvalOptions: [
        { text: '1 Nível (Revisão Direta e Publicação)', value: '1_level' },
        { text: '2 Níveis (Revisão Técnica + Homologação Final)', value: '2_levels' }
      ]
    }
  },
  computed: {
    isOpen: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    isPolicyEnforced2Levels() {
      return Boolean(this.effectivePolicy && this.effectivePolicy.approvalLevels === 2)
    },
    displayTitle() {
      return this.$store.get('page/title') || (this.draft && this.draft.title) || ''
    },
    displayDescription() {
      return this.$store.get('page/description') || (this.draft && this.draft.description) || ''
    },
    displayTags() {
      const tags = this.$store.get('page/tags') || (this.draft && this.draft.tags) || []
      return Array.isArray(tags) ? tags : []
    },
    isTitleValid() {
      const t = (this.displayTitle || '').trim()
      return t.length > 0 && t !== 'Untitled' && t !== 'Untitled Page'
    },
    canSubmit() {
      return this.isTitleValid && !this.isSubmitting
    }
  },
  watch: {
    isOpen(val) {
      if (val) {
        this.initForm()
      } else {
        this.resetForm()
      }
    },
    effectivePolicy: {
      immediate: true,
      handler(policy) {
        if (policy && policy.approvalLevels === 2) {
          this.selectedApprovalMode = '2_levels'
        }
      }
    }
  },
  methods: {
    initForm() {
      this.errorMessage = ''
      this.isConflict = false
      this.conflictDetails = null
      if (this.isPolicyEnforced2Levels) {
        this.selectedApprovalMode = '2_levels'
      } else if (this.draft && this.draft.approvalMode) {
        this.selectedApprovalMode = this.draft.approvalMode
      } else {
        this.selectedApprovalMode = '1_level'
      }
    },
    resetForm() {
      this.comment = ''
      this.errorMessage = ''
      this.isConflict = false
      this.conflictDetails = null
      this.isSubmitting = false
    },
    close() {
      this.resetForm()
      this.isOpen = false
    },
    async handleSubmit() {
      if (!this.canSubmit) return

      this.isSubmitting = true
      this.errorMessage = ''
      this.isConflict = false
      this.conflictDetails = null

      try {
        // 1. Garantir que alterações recentes estejam salvas em detranWfDrafts antes de submeter
        let targetDraft = this.draft
        if (!targetDraft || !targetDraft.id) {
          targetDraft = await this.$store.dispatch('detranWorkflow/saveDraft', {
            apollo: this.$apollo,
            pageId: this.pageId || null,
            path: this.path,
            locale: this.locale,
            title: this.displayTitle,
            description: this.displayDescription,
            content: this.$store.get('editor/content') || '',
            contentType: this.$store.get('page/contentType') || 'markdown',
            editorKey: this.$store.get('editor/editor') || 'markdown',
            tags: this.displayTags,
            approvalMode: this.selectedApprovalMode
          })
        }

        if (!targetDraft || !targetDraft.id) {
          throw new Error('Não foi possível identificar o rascunho para submissão.')
        }

        // 2. Executar a mutation de submissão
        const { data } = await this.$apollo.mutate({
          mutation: MUTATION_WORKFLOW_SUBMIT,
          variables: {
            id: Number(targetDraft.id),
            approvalMode: this.selectedApprovalMode,
            comment: this.comment.trim() || null
          }
        })

        const result = data && data.workflowSubmit

        if (result && result.responseResult && result.responseResult.succeeded) {
          const updatedDraft = result.draft

          // Atualizar store e emitir eventos
          this.$store.commit('detranWorkflow/SET_DRAFT', updatedDraft)
          this.$emit('submitted', updatedDraft)
          this.$root.$emit('workflowDraftSubmitted', updatedDraft)

          this.$store.commit('showNotification', {
            style: 'green',
            message: 'Documento submetido para revisão com sucesso!',
            icon: 'check-circle'
          })

          this.close()
        } else {
          const message = (result && result.responseResult && result.responseResult.message) || 'Erro ao submeter documento.'
          this.handleSubmissionError(message, result && result.responseResult)
        }
      } catch (err) {
        this.handleSubmissionError(err.message, err)
      } finally {
        this.isSubmitting = false
      }
    },
    handleSubmissionError(message, details) {
      this.errorMessage = message

      // Detecção de Conflito de Concorrência
      const isConcurrency = /conflict|concorrência|modificado em produção|versão anterior/i.test(message) ||
        (details && (details.errorCode === 409 || details.slug === 'ConcurrencyConflictError'))

      if (isConcurrency) {
        this.isConflict = true
        this.conflictDetails = details
        this.$emit('conflict', details)
      }

      this.$store.commit('showNotification', {
        style: 'red',
        message: this.isConflict ? 'Conflito de concorrência detectado ao submeter.' : message,
        icon: 'alert'
      })
    }
  }
}
</script>

<style lang='scss'>
// =============================================================================
// MODAL DE SUBMISSÃO DETRAN-MG
// =============================================================================
.detran-wf-submit-modal {
  border-radius: 12px !important;
  overflow: hidden;

  &__header {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;

    &-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #dcfce7;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &-title {
      color: #0f172a;
      font-size: 1.1rem;
      line-height: 1.2;
    }
  }

  .detran-wf-section {
    &__label {
      color: #475569;
      font-size: 11px;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
    }
  }

  .detran-wf-metadata-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .detran-wf-path-pill {
    background: #e2e8f0;
    color: #1e293b;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }

  .detran-wf-policy-notice {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
  }

  .detran-wf-lock-notice {
    background: #f1f5f9;
    border-left: 3px solid #64748b;
    border-radius: 4px;
  }
}
</style>

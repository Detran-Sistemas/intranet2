<template lang='pug'>
.detran-wf-bar.d-flex.align-center.justify-space-between.px-4.py-2
  //- LADO ESQUERDO: Indicador de Estado e Sincronização
  .d-flex.align-center.flex-wrap
    //- Badge de Estado do Workflow
    .detran-wf-badge.d-flex.align-center.mr-3(:class='badgeConfig.themeClass')
      span.detran-wf-badge__dot(v-if='badgeConfig.hasPulse')
      v-icon(:size='16', :color='badgeConfig.iconColor', left).mr-1 {{ badgeConfig.icon }}
      span.detran-wf-badge__label {{ badgeConfig.label }}
      span.detran-wf-badge__level.ml-1(v-if='badgeConfig.levelText') {{ badgeConfig.levelText }}

    //- Selo: Versão no Ar Preservada (Forward Revision)
    v-tooltip(bottom, color='#1e293b', v-if='isPublishedRevision')
      template(v-slot:activator='{ on }')
        .detran-wf-preserved-pill.d-none.d-sm-flex.align-center.mr-3(v-on='on')
          v-icon(size='14', color='#288b4a', left).mr-1 mdi-shield-check-outline
          span Versão no ar preservada
      span O conteúdo publicado no portal continua intacto até a homologação final deste rascunho.

    //- Indicador de Autosave / Sincronização em Tempo Real
    .detran-wf-sync-status.d-flex.align-center
      template(v-if='saveStatus === "saving" || isSavingDraft')
        v-progress-circular(indeterminate, size='12', width='2', color='#33a65b').mr-2
        span.caption.font-weight-medium.green--text.text--darken-3 Salvando rascunho...
      template(v-else-if='saveStatus === "pending"')
        v-icon(size='14', color='#d97706').mr-1 mdi-clock-outline
        span.caption.amber--text.text--darken-3 Alterações pendentes (autosave em 30s)...
      template(v-else-if='saveStatus === "error"')
        v-icon(size='14', color='#dc2626').mr-1 mdi-cloud-alert-outline
        span.caption.red--text.text--darken-2 Erro ao salvar rascunho
      template(v-else-if='lastSavedText')
        v-icon(size='14', color='#33a65b').mr-1 mdi-cloud-check-outline
        span.caption.text-muted {{ lastSavedText }}

      //- Chip de Rascunho Recuperado
      v-tooltip(bottom, color='#1e293b', v-if='isRecovered')
        template(v-slot:activator='{ on }')
          .detran-wf-recovered-pill.d-none.d-sm-flex.align-center.ml-2(v-on='on')
            v-icon(size='12', color='#2563eb', left).mr-1 mdi-history
            span Rascunho recuperado
        span As alterações deste documento em tramitação foram recuperadas automaticamente no editor.

  //- LADO DIREITO: Ações Contextuais por Papel e Estado
  .d-flex.align-center
    //- Botão: Salvar Rascunho Manual
    v-btn.detran-wf-btn.detran-wf-btn--secondary.mr-2(
      v-if='canEdit'
      small
      depressed
      :loading='isSavingDraft'
      @click='handleSaveDraft'
      )
      v-icon(size='16', left) mdi-content-save-outline
      span Salvar Rascunho

    //- Botão: Enviar para Revisão (Autor)
    v-btn.detran-wf-btn.detran-wf-btn--primary.mr-2(
      v-if='canSubmit'
      small
      depressed
      color='#33a65b'
      dark
      @click='dialogSubmit = true'
      )
      v-icon(size='16', left) mdi-send-check-outline
      span Enviar p/ Revisão

    //- Botão: Solicitar Ajustes (Revisor / Aprovador)
    v-btn.detran-wf-btn.detran-wf-btn--warning.mr-2(
      v-if='canReviewOrApprove'
      small
      depressed
      outlined
      color='#d97706'
      @click='dialogReject = true'
      )
      v-icon(size='16', left) mdi-comment-alert-outline
      span Pedir Ajustes

    //- Botão: Aprovar Nível 1 (Revisor Técnico em 2 níveis)
    v-btn.detran-wf-btn.detran-wf-btn--step.mr-2(
      v-if='canApproveStep'
      small
      depressed
      color='#2563eb'
      dark
      :loading='isActionLoading'
      @click='handleApproveStep'
      )
      v-icon(size='16', left) mdi-check-circle-outline
      span Aprovar Nível 1

    //- Botão: Homologar e Publicar (Aprovador Final)
    v-btn.detran-wf-btn.detran-wf-btn--publish.mr-2(
      v-if='canPublish'
      small
      depressed
      color='#288b4a'
      dark
      :loading='isActionLoading'
      @click='handlePublish'
      )
      v-icon(size='16', left) mdi-rocket-launch-outline
      span Homologar e Publicar

    //- Botão: Trilha de Auditoria / Linha do Tempo
    v-tooltip(bottom, color='#1e293b')
      template(v-slot:activator='{ on }')
        v-btn.detran-wf-btn--icon(
          icon
          small
          v-on='on'
          @click='dialogTimeline = true'
          )
          v-icon(size='18', color='#64748b') mdi-history
      span Histórico e Trilha de Auditoria

  //- =========================================================================
  //- MODAL: Submeter para Revisão (Componente Dedicado Detran-MG)
  //- =========================================================================
  editor-modal-workflow-submit(
    v-model='dialogSubmit'
    :draft='draft'
    :effective-policy='effectivePolicy'
    :page-id='pageId'
    :path='path'
    :locale='locale'
    @submitted='onWorkflowSubmitted'
  )

  //- =========================================================================
  //- MODAL: Solicitar Ajustes (Devolução)
  //- =========================================================================
  v-dialog(v-model='dialogReject', max-width='540', persistent)
    v-card.detran-wf-modal
      .detran-wf-modal__header.px-6.py-4.d-flex.align-center
        .detran-wf-modal__header-icon.detran-wf-modal__header-icon--warning.mr-3
          v-icon(size='20', color='#d97706') mdi-comment-alert-outline
        .subtitle-1.font-weight-bold.detran-wf-modal__header-title Solicitar Ajustes ao Autor
        v-spacer
        v-btn(icon, small, @click='dialogReject = false')
          v-icon mdi-close

      v-card-text.px-6.py-4
        p.body-2.text-muted Indique os pontos que necessitam de correção ou adequação. O autor receberá os apontamentos e poderá reenviar o documento.

        v-textarea(
          outlined
          dense
          rows='4'
          label='Apontamentos de Revisão (Obrigatório)'
          placeholder='Descreva detalhadamente o que deve ser corrigido...'
          v-model='rejectComment'
          :rules='[v => !!v || "Justificativa obrigatória"]'
        )

      v-divider
      v-card-actions.px-6.py-3
        v-spacer
        v-btn(text, @click='dialogReject = false') Cancelar
        v-btn(
          color='#d97706'
          dark
          depressed
          :disabled='!rejectComment.trim()'
          :loading='isActionLoading'
          @click='confirmReject'
        )
          v-icon(left, size='18') mdi-check
          span Devolver com Apontamentos

  //- =========================================================================
  //- MODAL: Linha do Tempo / Trilha de Auditoria
  //- =========================================================================
  v-dialog(v-model='dialogTimeline', max-width='640')
    v-card.detran-wf-modal
      .detran-wf-modal__header.px-6.py-4.d-flex.align-center
        .detran-wf-modal__header-icon.mr-3
          v-icon(size='20', color='#33a65b') mdi-history
        .subtitle-1.font-weight-bold.detran-wf-modal__header-title Histórico e Trilha de Auditoria
        v-spacer
        v-btn(icon, small, @click='dialogTimeline = false')
          v-icon mdi-close

      v-card-text.px-6.py-4
        template(v-if='eventsList.length === 0')
          .text-center.py-6.text-muted
            v-icon(size='36', color='#cbd5e1') mdi-timeline-clock-outline
            p.mt-2.caption Nenhuma movimentação registrada para este documento até o momento.
        template(v-else)
          v-timeline(dense).detran-wf-timeline
            v-timeline-item(
              v-for='evt in eventsList'
              :key='evt.id'
              small
              :color='getEventColor(evt.action)'
            )
              .caption.font-weight-bold {{ formatEventTitle(evt) }}
              .caption.text-muted {{ evt.createdAt | moment("calendar") }} • {{ evt.userName || "Usuário" }}
              .body-2.mt-1(v-if='evt.comment') "{{ evt.comment }}"
      v-divider
      v-card-actions.px-6.py-3
        v-spacer
        v-btn(text, @click='dialogTimeline = false') Fechar
</template>

<script>
import gql from 'graphql-tag'
import moment from 'moment'

export default {
  name: 'EditorWorkflowBar',
  components: {
    editorModalWorkflowSubmit: () => import(/* webpackChunkName: "editor-workflow-submit", webpackMode: "eager" */ './editor-modal-workflow-submit.vue')
  },
  props: {
    path: { type: String, required: true },
    locale: { type: String, default: 'pt-br' },
    title: { type: String, default: '' },
    isDirty: { type: Boolean, default: false },
    pageId: { type: Number, default: 0 },
    mode: { type: String, default: 'create' }
  },
  data() {
    return {
      localDraft: null,
      localEffectivePolicy: { approvalLevels: 1, reviewIntervalDays: 365 },
      localLastSavedTime: null,
      isActionLoading: false,
      dialogSubmit: false,
      dialogReject: false,
      dialogTimeline: false,
      submitComment: '',
      rejectComment: '',
      selectedApprovalMode: '1_level',
      approvalModeOptions: [
        { text: '1 Nível (Revisão Direta)', value: '1_level' },
        { text: '2 Níveis (Técnico + Homologação Final)', value: '2_levels' }
      ]
    }
  },
  computed: {
    draft() {
      return (this.$store.state.detranWorkflow && this.$store.state.detranWorkflow.draft)
        ? this.$store.state.detranWorkflow.draft
        : this.localDraft
    },
    saveStatus() {
      return this.$store.state.detranWorkflow ? this.$store.state.detranWorkflow.saveStatus : 'idle'
    },
    isSavingDraft() {
      return this.$store.state.detranWorkflow ? this.$store.state.detranWorkflow.isSaving : false
    },
    isRecovered() {
      return this.$store.state.detranWorkflow ? this.$store.state.detranWorkflow.isRecovered : false
    },
    lastSavedTime() {
      if (this.$store.state.detranWorkflow && this.$store.state.detranWorkflow.lastSavedTime) {
        return this.$store.state.detranWorkflow.lastSavedTime
      }
      return this.localLastSavedTime
    },
    effectivePolicy() {
      return (this.$store.state.detranWorkflow && this.$store.state.detranWorkflow.effectivePolicy)
        ? this.$store.state.detranWorkflow.effectivePolicy
        : this.localEffectivePolicy
    },
    currentState() {
      return this.draft ? this.draft.state : 'draft'
    },
    isPublishedRevision() {
      return Boolean(this.pageId && this.pageId > 0)
    },
    isPolicyEnforced2Levels() {
      return this.effectivePolicy && this.effectivePolicy.approvalLevels === 2
    },
    currentUser() {
      return this.$store.get('user/profile') || this.$store.get('user') || {}
    },
    isAuthor() {
      if (!this.draft || !this.draft.authorId || !this.currentUser.id) return true
      return Number(this.draft.authorId) === Number(this.currentUser.id)
    },
    badgeConfig() {
      switch (this.currentState) {
        case 'in_review':
          return {
            label: 'Em Revisão',
            levelText: this.draft && this.draft.approvalMode === '2_levels' ? '(Nível 1)' : '',
            icon: 'mdi-clock-time-four-outline',
            iconColor: '#b45309',
            themeClass: 'detran-wf-badge--warning',
            hasPulse: true
          }
        case 'awaiting_approval':
          return {
            label: 'Aguardando Homologação',
            levelText: '(Nível 2)',
            icon: 'mdi-shield-check-outline',
            iconColor: '#1d4ed8',
            themeClass: 'detran-wf-badge--info',
            hasPulse: true
          }
        case 'changes_requested':
          return {
            label: 'Ajustes Solicitados',
            levelText: '',
            icon: 'mdi-alert-circle-outline',
            iconColor: '#b91c1c',
            themeClass: 'detran-wf-badge--danger',
            hasPulse: false
          }
        case 'published':
          return {
            label: 'Publicado',
            levelText: '',
            icon: 'mdi-check-decagram-outline',
            iconColor: '#15803d',
            themeClass: 'detran-wf-badge--success',
            hasPulse: false
          }
        case 'revisao_periodica':
          return {
            label: 'Revisão Periódica',
            levelText: '',
            icon: 'mdi-calendar-clock',
            iconColor: '#c2410c',
            themeClass: 'detran-wf-badge--warning',
            hasPulse: true
          }
        default:
          return {
            label: 'Rascunho Preliminar',
            levelText: '',
            icon: 'mdi-pencil-ruler',
            iconColor: '#475569',
            themeClass: 'detran-wf-badge--neutral',
            hasPulse: false
          }
      }
    },
    lastSavedText() {
      if (!this.lastSavedTime) return ''
      return `Rascunho salvo às ${moment(this.lastSavedTime).format('HH:mm')}`
    },
    eventsList() {
      return (this.draft && this.draft.events) ? this.draft.events : []
    },
    canEdit() {
      return this.currentState === 'draft' || this.currentState === 'changes_requested'
    },
    canSubmit() {
      return this.canEdit
    },
    canReviewOrApprove() {
      // Reviewer or Approver can request changes while under review/approval (and author cannot self-review)
      const isUnderReview = this.currentState === 'in_review' || this.currentState === 'awaiting_approval'
      return isUnderReview && !this.isAuthor
    },
    canApproveStep() {
      // Step 1 approval applies only to 2-level workflows under in_review
      return this.currentState === 'in_review' &&
             this.draft &&
             this.draft.approvalMode === '2_levels' &&
             !this.isAuthor
    },
    canPublish() {
      // In 1-level: publish directly from in_review
      // In 2-levels: publish from awaiting_approval
      if (this.isAuthor) return false
      if (this.draft && this.draft.approvalMode === '2_levels') {
        return this.currentState === 'awaiting_approval'
      }
      return this.currentState === 'in_review'
    }
  },
  watch: {
    path: {
      immediate: true,
      handler() {
        this.loadDraftAndPolicy()
      }
    },
    isDirty(newVal) {
      if (newVal && this.canEdit) {
        this.queueAutosave()
      }
    }
  },
  methods: {
    queueAutosave() {
      if (!this.canEdit) return
      this.$store.dispatch('detranWorkflow/triggerAutosave', {
        delay: 30000,
        apollo: this.$apollo,
        getPayload: () => ({
          id: this.draft ? this.draft.id : null,
          pageId: this.pageId || null,
          path: this.path,
          locale: this.locale,
          title: this.title || this.$store.get('page/title') || 'Untitled',
          description: this.$store.get('page/description') || '',
          content: this.$store.get('editor/content') || '',
          contentType: this.$store.get('page/contentType') || 'markdown',
          editorKey: this.$store.get('editor/editor') || 'markdown',
          tags: this.$store.get('page/tags') || [],
          approvalMode: this.selectedApprovalMode
        })
      })
    },
    async loadDraftAndPolicy() {
      if (!this.path) return
      try {
        await this.$store.dispatch('detranWorkflow/loadDraftAndPolicy', {
          apollo: this.$apollo,
          path: this.path,
          locale: this.locale,
          autoRecover: true,
          rootStore: this.$store,
          rootEmit: this.$root
        })
        if (this.effectivePolicy && this.effectivePolicy.approvalLevels === 2) {
          this.selectedApprovalMode = '2_levels'
        }
        if (this.draft && this.draft.approvalMode) {
          this.selectedApprovalMode = this.draft.approvalMode
        }
      } catch (err) {
        // Fallback silently if workflow query is unavailable
      }
    },
    async handleSaveDraft() {
      this.$store.dispatch('detranWorkflow/cancelAutosave')
      try {
        const content = this.$store.get('editor/content') || ''
        const description = this.$store.get('page/description') || ''
        const tags = this.$store.get('page/tags') || []
        const contentType = this.$store.get('page/contentType') || 'markdown'
        const editorKey = this.$store.get('editor/editor') || 'markdown'

        const savedDraft = await this.$store.dispatch('detranWorkflow/saveDraft', {
          apollo: this.$apollo,
          id: this.draft ? this.draft.id : null,
          pageId: this.pageId || null,
          path: this.path,
          locale: this.locale,
          title: this.title || this.$store.get('page/title') || 'Untitled',
          description,
          content,
          contentType,
          editorKey,
          tags,
          approvalMode: this.selectedApprovalMode
        })

        if (savedDraft) {
          this.$emit('draft-saved', savedDraft)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Erro ao salvar rascunho de workflow.',
          icon: 'alert'
        })
      }
    },
    onWorkflowSubmitted(updatedDraft) {
      if (updatedDraft) {
        this.selectedApprovalMode = updatedDraft.approvalMode || this.selectedApprovalMode
      }
      this.$emit('workflow-submitted', updatedDraft)
      this.loadDraftAndPolicy()
    },
    async confirmReject() {
      if (!this.draft || !this.draft.id) return
      this.isActionLoading = true
      try {
        const { data } = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $comment: String!) {
              workflow {
                requestChanges(id: $id, comment: $comment) {
                  responseResult { succeeded message }
                  draft { id state currentLevel updatedAt }
                }
              }
            }
          `,
          variables: { id: this.draft.id, comment: this.rejectComment }
        })

        if (data && data.workflow && data.workflow.requestChanges.responseResult.succeeded) {
          this.draft = { ...this.draft, ...data.workflow.requestChanges.draft }
          this.dialogReject = false
          this.$store.commit('pushNotification', {
            type: 'warning',
            message: 'Ajustes solicitados ao autor com sucesso.'
          })
          await this.loadDraftAndPolicy()
        }
      } catch (err) {
        this.$store.commit('pushNotification', { type: 'error', message: err.message })
      } finally {
        this.isActionLoading = false
      }
    },
    async handleApproveStep() {
      if (!this.draft || !this.draft.id) return
      this.isActionLoading = true
      try {
        const { data } = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              workflow {
                approveStep(id: $id) {
                  responseResult { succeeded message }
                  draft { id state currentLevel updatedAt }
                }
              }
            }
          `,
          variables: { id: this.draft.id }
        })

        if (data && data.workflow && data.workflow.approveStep.responseResult.succeeded) {
          this.draft = { ...this.draft, ...data.workflow.approveStep.draft }
          this.$store.commit('pushNotification', {
            type: 'success',
            message: 'Nível 1 aprovado. Encaminhado para homologação final.'
          })
          await this.loadDraftAndPolicy()
        }
      } catch (err) {
        this.$store.commit('pushNotification', { type: 'error', message: err.message })
      } finally {
        this.isActionLoading = false
      }
    },
    async handlePublish() {
      if (!this.draft || !this.draft.id) return
      this.isActionLoading = true
      try {
        const { data } = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              workflow {
                publish(id: $id) {
                  responseResult { succeeded message }
                  draft { id state updatedAt }
                  pageId
                }
              }
            }
          `,
          variables: { id: this.draft.id }
        })

        if (data && data.workflow && data.workflow.publish.responseResult.succeeded) {
          this.draft = { ...this.draft, ...data.workflow.publish.draft }
          this.$store.commit('pushNotification', {
            type: 'success',
            message: 'Documento homologado e publicado oficialmente!'
          })
          await this.loadDraftAndPolicy()
        }
      } catch (err) {
        this.$store.commit('pushNotification', { type: 'error', message: err.message })
      } finally {
        this.isActionLoading = false
      }
    },
    getEventColor(action) {
      switch (action) {
        case 'submit': return '#33a65b'
        case 'approve_step': return '#2563eb'
        case 'publish': return '#16a34a'
        case 'request_changes': return '#d97706'
        default: return '#64748b'
      }
    },
    formatEventTitle(evt) {
      switch (evt.action) {
        case 'submit': return 'Documento submetido para revisão'
        case 'approve_step': return 'Nível 1 aprovado pelo revisor'
        case 'publish': return 'Homologado e publicado no portal'
        case 'request_changes': return 'Ajustes solicitados'
        default: return evt.action
      }
    }
  },
  beforeDestroy() {
    if (this.$store) {
      this.$store.dispatch('detranWorkflow/cancelAutosave')
    }
  }
}
</script>

<style lang='scss'>
// =============================================================================
// DETRAN WORKFLOW BAR — ESTILIZAÇÃO DETRAN DESIGN SYSTEM
// =============================================================================

.detran-wf-bar {
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  position: relative;
  z-index: 4;
  min-height: 52px;
}

// --- Badges de Estado ---
.detran-wf-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
    margin-right: 6px;
    animation: detranPulse 2s infinite;
  }

  &--neutral {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    color: #475569;
  }

  &--warning {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    color: #b45309;
  }

  &--info {
    background: #dbeafe;
    border: 1px solid #93c5fd;
    color: #1d4ed8;
  }

  &--danger {
    background: #fee2e2;
    border: 1px solid #fca5a5;
    color: #b91c1c;
  }

  &--success {
    background: #dcfce7;
    border: 1px solid #86efac;
    color: #15803d;
  }
}

@keyframes detranPulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

// --- Pill de Versão Preservada ---
.detran-wf-preserved-pill {
  padding: 3px 10px;
  background: #f2fbf5;
  border: 1px solid #c3ebce;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: #206e3b;
}

// --- Pill de Rascunho Recuperado ---
.detran-wf-recovered-pill {
  padding: 3px 10px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
}

// --- Botões Contextuais ---
.detran-wf-btn {
  text-transform: none !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  letter-spacing: 0 !important;
  transition: all 0.2s ease !important;

  &--secondary {
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    color: #334155 !important;

    &:hover {
      background: #f8fafc !important;
      border-color: #33a65b !important;
      color: #33a65b !important;
    }
  }

  &--primary {
    box-shadow: 0 2px 6px rgba(51, 166, 91, 0.25) !important;
    &:hover {
      background: #288b4a !important;
      transform: translateY(-1px);
    }
  }

  &--publish {
    box-shadow: 0 2px 8px rgba(40, 139, 74, 0.3) !important;
    &:hover {
      background: #206e3b !important;
      transform: translateY(-1px);
    }
  }

  &--icon {
    &:hover {
      background: #f1f5f9 !important;
    }
  }
}

// --- Modal Detran Workflow ---
.detran-wf-modal {
  border-radius: 16px !important;
  overflow: hidden;

  &__header {
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;

    &-icon {
      width: 36px;
      height: 36px;
      background: #f2fbf5;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;

      &--warning {
        background: #fef3c7;
      }
    }

    &-title {
      color: #1e293b;
    }
  }
}

.detran-wf-timeline {
  .v-timeline-item__dot {
    box-shadow: none !important;
  }
}
</style>

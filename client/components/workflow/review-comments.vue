<template lang='pug'>
  .detran-review-comments
    //- Cabeçalho do Painel Lateral (Estilo Google Docs)
    .detran-rc-header
      .detran-rc-header__top
        .detran-rc-header__left
          v-icon(size='18' color='#15803d') mdi-message-text-outline
          h2.detran-rc-header__title Revisão &amp; Comentários
        span.detran-rc-badge(
          :class='totalPendingCount > 0 ? "is-amber" : "is-emerald"'
        )
          template(v-if='totalPendingCount > 0')
            span.detran-rc-badge__count {{ totalPendingCount }}
            span.detran-rc-badge__label {{ totalPendingCount === 1 ? 'pendente' : 'pendentes' }}
          template(v-else)
            span.detran-rc-badge__done ✓ Tudo revisado

      //- Abas de Filtro (Seção 2.1: Todas | Pendentes | Resolvidas)
      .detran-rc-tabs(role='tablist' aria-label='Filtro de anotações e sugestões')
        button.detran-rc-tab(
          type='button'
          :class='{ "is-active": filterMode === "all" }'
          @click='filterMode = "all"'
        ) Todas ({{ allItems.length }})
        button.detran-rc-tab(
          type='button'
          :class='{ "is-active": filterMode === "pending" }'
          @click='filterMode = "pending"'
        ) Pendentes ({{ totalPendingCount }})
        button.detran-rc-tab(
          type='button'
          :class='{ "is-active": filterMode === "resolved" }'
          @click='filterMode = "resolved"'
        ) Resolvidas ({{ totalResolvedCount }})

    //- Box de Nova Observação ou Sugestão de Redação (com Smart Paste ativo e SEM campo de Linha)
    .detran-rc-composer(v-if='composerOpen')
      .detran-rc-composer__head
        span.detran-rc-composer__title
          v-icon(size='15' color='#15803d') {{ composeMode === 'redaction' ? 'mdi-pencil-plus-outline' : 'mdi-comment-plus-outline' }}
          span {{ composeMode === 'redaction' ? 'Sugerir Nova Redação no Trecho' : 'Nova Observação no Texto' }}
        button.detran-rc-composer__close(
          type='button'
          title='Cancelar'
          @click='closeComposer'
        )
          v-icon(size='15' color='#94a3b8') mdi-close

      //- Trecho ancorado via TextQuoteSelector
      .detran-rc-composer__quote(v-if='newComment.exact')
        span.detran-rc-composer__quote-label Trecho selecionado:
        span.detran-rc-composer__quote-text "{{ newComment.exact }}"

      //- Campo de Sugestão de Substituição (Modo "✏️ Sugerir redação")
      .detran-rc-composer__field(v-if='composeMode === "redaction"')
        label.detran-rc-input-label Sugestão de substituição (Smart Paste ativo):
        textarea.detran-rc-textarea.is-replacement(
          ref='replacementInput'
          v-model='newComment.suggestedReplacement'
          rows='2'
          placeholder='Digite ou cole o novo texto que deve substituir o trecho selecionado...'
          @paste='onSmartPasteField($event, "suggestedReplacement")'
          @input='formError = ""'
        )

      //- Campo de Comentário / Justificativa
      .detran-rc-composer__field
        label.detran-rc-input-label {{ composeMode === 'redaction' ? 'Justificativa / Observação (opcional):' : 'Comentário ou orientação para o autor:' }}
        textarea.detran-rc-textarea(
          ref='commentInput'
          v-model='newComment.body'
          rows='3'
          placeholder='Escreva sua observação ou cole conteúdo formatado...'
          @paste='onSmartPasteField($event, "body")'
          @input='formError = ""'
        )

      //- Aviso de Smart Paste no Composer
      .detran-rc-smart-paste-hint(v-if='pasteNotice')
        span ✨ {{ pasteNotice }}

      p.detran-rc-error(v-if='formError') {{ formError }}

      .detran-rc-composer__actions
        button.detran-rc-cancel-btn(
          type='button'
          @click='closeComposer'
        ) Cancelar
        button.detran-rc-submit-btn(
          type='button'
          :disabled='submitting || (!newComment.body.trim() && !newComment.suggestedReplacement.trim())'
          @click='submitComment'
        )
          v-icon(size='13' color='#ffffff') mdi-send
          span {{ submitting ? 'Salvando...' : (composeMode === 'redaction' ? 'Salvar Sugestão' : 'Salvar Comentário') }}

    //- Botão rápido para adicionar observação geral
    button.detran-rc-quick-add(
      v-else
      type='button'
      @click='openGeneralComposer'
    )
      v-icon(size='15' color='#15803d') mdi-plus-circle-outline
      span Adicionar observação ou selecione um trecho na folha

    //- Lista de Cartões de Decisão Estilo Google Docs (Sugestões de Diff + Comentários)
    .detran-rc-list(ref='cardsContainer')
      .detran-rc-empty(v-if='filteredItems.length === 0')
        .detran-rc-empty__icon
          v-icon(size='26' :color='filterMode === "resolved" ? "#64748b" : "#16a34a"') {{ emptyStateIcon }}
        p.detran-rc-empty__title {{ emptyStateTitle }}
        p.detran-rc-empty__sub {{ emptyStateSubtitle }}

      template(v-else v-for='(item, itemIdx) in filteredItems')
        .detran-rc-section-divider(
          v-if='filterMode === "all" && item.status !== "pending" && (itemIdx === 0 || filteredItems[itemIdx - 1].status === "pending")'
          :key='"div-" + item.id'
        )
          v-icon(size='13' color='#64748b') mdi-check-circle-outline
          span Já revisados ({{ totalResolvedCount }}) • do mais novo ao mais antigo

        .detran-rc-card.review-card(
          :key='item.id'
          :id='"card-" + item.id'
          :class='[{ "active-card": activeItemId === item.id, "is-resolved": item.status !== "pending" }]'
          @click='$emit("focus-item", item.id)'
        )
          //- Cabeçalho do Card (Autor + Horário + Botões Diretos ✓ Aceitar / ✕ Recusar)
          .detran-rc-card__head
            .detran-rc-card__author-wrap
              .detran-rc-card__avatar(:class='item.type === "suggestion" || item.type === "redaction" ? "is-green" : "is-amber"')
                v-icon(
                  size='14'
                  :color='item.type === "suggestion" || item.type === "redaction" ? "#166534" : "#92400e"'
                ) {{ item.type === 'suggestion' || item.type === 'redaction' ? 'mdi-pencil' : 'mdi-message-reply-text' }}
              div
                .detran-rc-card__author {{ item.author }}
                .detran-rc-card__meta
                  span(v-if='item.actionLabel') {{ item.actionLabel }} •
                  span {{ item.timeLabel }}

            //- Ações Diretas no Card (✓ Aceitar / ✕ Recusar para revisor, ou Chip Aguardando Revisor para autor)
            .detran-rc-card__actions(v-if='item.status === "pending"' @click.stop)
              template(v-if='canDecideItem(item)')
                button.detran-rc-decision-btn.is-accept(
                  type='button'
                  title='Aceitar sugestão / resolver anotação'
                  :disabled='resolvingId === item.rawCommentId'
                  @click='onAcceptItem(item)'
                )
                  v-icon(size='14' color='currentColor') mdi-check
                  span Aceitar
                button.detran-rc-decision-btn.is-reject(
                  type='button'
                  title='Recusar alteração / manter original'
                  :disabled='resolvingId === item.rawCommentId'
                  @click='onRejectItem(item)'
                )
                  v-icon(size='14' color='currentColor') mdi-close
                  span Recusar
              template(v-else)
                span.detran-rc-status-chip.is-amber(:title='isAuthor ? "Documento em análise — autor não avalia as próprias alterações" : "Alteração submetida pelo autor — aguardando parecer do revisor"')
                  v-icon(size='12' color='#92400e') mdi-clock-outline
                  span {{ draftState === 'published' ? 'Concluído' : 'Aguardando Revisor' }}

            .detran-rc-card__status-wrap(v-else @click.stop)
              span.detran-rc-status-chip(:class='item.status === "rejected" ? "is-red" : "is-emerald"')
                | {{ item.status === 'rejected' ? 'Recusada' : (item.status === 'accepted' ? 'Aceita' : 'Resolvida') }}
              button.detran-rc-reopen-btn(
                v-if='canDecideItem(item)'
                type='button'
                title='Reabrir item'
                @click='onReopenItem(item)'
              ) Reabrir

          //- Corpo de Sugestão (Diff do Autor ou Sugestão de Redação do Revisor)
          template(v-if='item.type === "suggestion" || item.type === "redaction"')
            .detran-rc-diff-preview
              .detran-rc-diff-preview__old(v-if='item.oldText')
                span.detran-rc-diff-preview__tag.is-old Antes:
                span "{{ item.oldText }}"
              .detran-rc-diff-preview__new(v-if='item.newText')
                span.detran-rc-diff-preview__tag.is-new {{ item.isImage ? 'Nova Mídia:' : 'Novo:' }}
                span "{{ item.newText }}"
              .detran-rc-blob-warn(v-if='item.hasBlobWarning')
                v-icon(size='13' color='#b91c1c') mdi-alert-outline
                span URL blob: local detectada (expira ao fechar a aba do autor).
            p.detran-rc-card__body(v-if='item.commentText') {{ item.commentText }}

          //- Corpo de Comentário de Revisão
          template(v-else)
            .detran-rc-card__quote(v-if='item.quote') "{{ item.quote }}"
            p.detran-rc-card__body {{ item.commentText }}

          //- Thread de Respostas
          .detran-rc-replies(v-if='item.replies && item.replies.length > 0')
            .detran-rc-reply(
              v-for='(rep, rIdx) in item.replies'
              :key='rIdx'
            )
              strong.detran-rc-reply__author {{ rep.author }}:
              span.detran-rc-reply__text  {{ rep.text }}

          //- Input de Resposta Rápida
          .detran-rc-reply-box(@click.stop)
            input.detran-rc-reply-input(
              v-model='replyInputs[item.id]'
              type='text'
              placeholder='Responder...'
              @keydown.enter='submitReply(item)'
            )
            button.detran-rc-reply-send(
              type='button'
              title='Enviar resposta'
              @click='submitReply(item)'
            )
              v-icon(size='14' color='#15803d') mdi-send
</template>

<script>
import gql from 'graphql-tag'
import moment from 'moment'
import {
  encodeTextQuoteSelector,
  decodeTextQuoteSelector,
  canDecideReviewSuggestion,
  sortReviewItems
} from '../../store/detran-workflow-review'
import { processSmartPastePayload } from '../../themes/default/components/transparent-editor/utils/smart-paste'

export default {
  name: 'ReviewComments',
  props: {
    draftId: {
      type: Number,
      required: true
    },
    comments: {
      type: Array,
      default: () => []
    },
    suggestions: {
      type: Array,
      default: () => []
    },
    suggestionDecisions: {
      type: Object,
      default: () => ({})
    },
    activeItemId: {
      type: String,
      default: null
    },
    selectionPayload: {
      type: Object,
      default: null
    },
    isAuthor: {
      type: Boolean,
      default: false
    },
    canReviewOrApprove: {
      type: Boolean,
      default: false
    },
    draftState: {
      type: String,
      default: 'in_review'
    },
    draftUpdatedAt: {
      type: String,
      default: null
    }
  },
  data () {
    return {
      filterMode: 'all',
      composerOpen: false,
      composeMode: 'comment',
      submitting: false,
      resolvingId: null,
      formError: '',
      pasteNotice: '',
      replyInputs: {},
      localSuggestionReplies: {},
      localReviewedTimestamps: {},
      newComment: {
        exact: '',
        prefix: '',
        suffix: '',
        suggestedReplacement: '',
        body: ''
      }
    }
  },
  computed: {
    mergedReviewedTimestamps () {
      const serverTs = (this.suggestionDecisions && this.suggestionDecisions._timestamps && typeof this.suggestionDecisions._timestamps === 'object') ?
        this.suggestionDecisions._timestamps :
        {}
      return {
        ...serverTs,
        ...this.localReviewedTimestamps
      }
    },
    persistedRepliesByTargetId () {
      const map = {}
      for (const c of (this.comments || [])) {
        const selector = decodeTextQuoteSelector(c)
        const targetId = selector.targetId || (selector.parentCommentId ? `com-${selector.parentCommentId}` : null)
        if (targetId) {
          if (!map[targetId]) map[targetId] = []
          map[targetId].push({
            id: c.id,
            author: c.userName || 'Servidor',
            text: c.body,
            createdAt: c.createdAt
          })
        }
      }
      return map
    },
    normalizedSuggestionItems () {
      return (this.suggestions || []).map(sug => {
        const decision = this.suggestionDecisions[sug.id] || sug.status || 'pending'
        const status = decision === 'accepted' ? 'accepted' : (decision === 'rejected' ? 'rejected' : 'pending')
        const reviewedAt = status !== 'pending' ? (this.mergedReviewedTimestamps[sug.id] || sug.reviewedAt || null) : null

        const persisted = this.persistedRepliesByTargetId[sug.id] || []
        const local = this.localSuggestionReplies[sug.id] || sug.replies || []
        const mergedReplies = [...persisted]
        for (const loc of local) {
          if (!mergedReplies.some(p => p.text === loc.text)) {
            mergedReplies.push(loc)
          }
        }

        return {
          ...sug,
          status,
          createdAt: sug.createdAt || this.draftUpdatedAt || null,
          reviewedAt,
          timeLabel: reviewedAt ? `Revisado às ${moment(reviewedAt).format('HH:mm')}` : (sug.time || 'Nesta submissão'),
          replies: mergedReplies
        }
      })
    },
    normalizedCommentItems () {
      return (this.comments || [])
        .filter(c => {
          const selector = decodeTextQuoteSelector(c)
          return !selector.targetId && !selector.parentCommentId
        })
        .map(c => {
          const selector = decodeTextQuoteSelector(c)
          const isRedaction = Boolean(selector.suggestedReplacement)
          const status = c.resolved ? (selector.status === 'rejected' ? 'rejected' : 'accepted') : 'pending'
          const itemId = `com-${c.id}`
          const reviewedAt = status !== 'pending' ?
            (this.mergedReviewedTimestamps[itemId] || selector.reviewedAt || c.updatedAt || c.createdAt || null) :
            null

          const persisted = this.persistedRepliesByTargetId[itemId] || []
          const local = this.localSuggestionReplies[itemId] || selector.replies || []
          const mergedReplies = [...persisted]
          for (const loc of local) {
            if (!mergedReplies.some(p => p.text === loc.text)) {
              mergedReplies.push(loc)
            }
          }

          return {
            id: itemId,
            rawCommentId: c.id,
            type: isRedaction ? 'redaction' : 'comment',
            author: c.userName || 'Revisor',
            actionLabel: isRedaction ? 'Sugeriu nova redação' : 'Comentou no trecho',
            createdAt: c.createdAt || null,
            updatedAt: c.updatedAt || null,
            reviewedAt,
            timeLabel: c.createdAt ? moment(c.createdAt).format('DD/MM HH:mm') : 'Agora mesmo',
            quote: selector.exact || '',
            prefix: selector.prefix || '',
            suffix: selector.suffix || '',
            oldText: isRedaction ? selector.exact : '',
            newText: selector.suggestedReplacement || '',
            commentText: c.body || '',
            status,
            replies: mergedReplies
          }
        })
    },
    allItems () {
      return sortReviewItems(
        [...this.normalizedSuggestionItems, ...this.normalizedCommentItems],
        {
          reviewedTimestamps: this.mergedReviewedTimestamps,
          fallbackCreatedAt: this.draftUpdatedAt
        }
      )
    },
    totalPendingCount () {
      return this.allItems.filter(i => i.status === 'pending').length
    },
    totalResolvedCount () {
      return this.allItems.filter(i => i.status !== 'pending').length
    },
    filteredItems () {
      if (this.filterMode === 'pending') {
        return this.allItems.filter(i => i.status === 'pending')
      }
      if (this.filterMode === 'resolved') {
        return this.allItems.filter(i => i.status !== 'pending')
      }
      return this.allItems
    },
    emptyStateIcon () {
      if (this.filterMode === 'resolved') return 'mdi-tray-arrow-down'
      return 'mdi-check-decagram-outline'
    },
    emptyStateTitle () {
      if (this.filterMode === 'resolved') return 'Nenhuma alteração resolvida'
      if (this.filterMode === 'pending') {
        return this.allItems.length > 0 ? 'Nenhuma pendência neste momento!' : 'Tudo revisado por aqui!'
      }
      return 'Nenhuma anotação registrada'
    },
    emptyStateSubtitle () {
      if (this.filterMode === 'resolved') {
        return 'As alterações aceitas ou recusadas pelo revisor aparecerão aqui.'
      }
      if (this.filterMode === 'pending' && this.allItems.length > 0) {
        return `Todas as ${this.totalResolvedCount} alterações deste documento já foram analisadas.`
      }
      return 'Nenhuma alteração ou comentário neste filtro. Selecione qualquer trecho na folha ao lado para comentar ou sugerir redação.'
    }
  },
  watch: {
    selectionPayload: {
      deep: true,
      handler (payload) {
        if (payload && payload.exact) {
          this.openFromSelection(payload)
        }
      }
    }
  },
  methods: {
    openFromSelection ({ exact = '', prefix = '', suffix = '', mode = 'comment' } = {}) {
      this.composeMode = mode === 'redaction' ? 'redaction' : 'comment'
      this.newComment = {
        exact,
        prefix,
        suffix,
        suggestedReplacement: mode === 'redaction' ? exact : '',
        body: ''
      }
      this.formError = ''
      this.composerOpen = true
      this.$nextTick(() => {
        const target = mode === 'redaction' ? this.$refs.replacementInput : this.$refs.commentInput
        if (target && typeof target.focus === 'function') {
          target.focus()
        }
      })
    },
    openGeneralComposer () {
      this.composeMode = 'comment'
      this.newComment = {
        exact: '',
        prefix: '',
        suffix: '',
        suggestedReplacement: '',
        body: ''
      }
      this.formError = ''
      this.composerOpen = true
      this.$nextTick(() => {
        if (this.$refs.commentInput) {
          this.$refs.commentInput.focus()
        }
      })
    },
    closeComposer () {
      this.composerOpen = false
      this.formError = ''
      this.pasteNotice = ''
      this.$emit('clear-selection')
    },
    async onSmartPasteField (event, fieldName) {
      if (!event || !event.clipboardData) return
      const html = event.clipboardData.getData('text/html') || ''
      const plainText = event.clipboardData.getData('text/plain') || ''
      const files = event.clipboardData.files ? Array.from(event.clipboardData.files) : []
      if (!html && files.length === 0) return

      event.preventDefault()
      try {
        const res = await processSmartPastePayload({
          html,
          plainText,
          files
        })
        const cleaned = (res.markdown || res.plainText || '').trim()
        if (cleaned) {
          const current = this.newComment[fieldName] || ''
          this.newComment[fieldName] = current ? `${current}\n${cleaned}` : cleaned
          if (res.hadComplexFormatting) {
            this.pasteNotice = 'Texto colado foi higienizado para o padrão da Intranet.'
            setTimeout(() => { this.pasteNotice = '' }, 4000)
          }
        }
      } catch (err) {
        this.formError = err.message || 'Erro ao colar conteúdo.'
      }
    },
    async submitComment () {
      const bodyText = this.newComment.body.trim()
      const replacementText = this.newComment.suggestedReplacement.trim()

      if (this.composeMode === 'redaction' && !replacementText) {
        this.formError = 'Informe a nova redação sugerida para o trecho.'
        return
      }
      if (this.composeMode === 'comment' && !bodyText) {
        this.formError = 'Informe o comentário ou observação.'
        return
      }

      this.submitting = true
      this.formError = ''

      const finalBody = bodyText || (this.composeMode === 'redaction' ? `Sugestão de redação: "${replacementText}"` : '')
      const encodedAnchor = (this.newComment.exact || replacementText) ?
        encodeTextQuoteSelector({
          exact: this.newComment.exact,
          prefix: this.newComment.prefix,
          suffix: this.newComment.suffix,
          suggestedReplacement: this.composeMode === 'redaction' ? replacementText : '',
          status: 'pending',
          replies: []
        }) :
        null

      try {
        const result = await this.$apollo.mutate({
          mutation: gql`
            mutation ($draftId: Int!, $lineNumber: Int, $anchorText: String, $body: String!) {
              workflow {
                addComment(draftId: $draftId, lineNumber: $lineNumber, anchorText: $anchorText, body: $body) {
                  responseResult {
                    succeeded
                    message
                  }
                  comment {
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
          variables: {
            draftId: this.draftId,
            lineNumber: null,
            anchorText: encodedAnchor,
            body: finalBody
          }
        })

        const payload = result && result.data && result.data.workflow && result.data.workflow.addComment
        if (payload && payload.responseResult && payload.responseResult.succeeded && payload.comment) {
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('comment-added', payload.comment)
          this.closeComposer()
        } else {
          this.formError = (payload && payload.responseResult && payload.responseResult.message) || 'Erro ao registrar anotação.'
        }
      } catch (err) {
        this.formError = err.message || 'Falha de comunicação ao salvar anotação.'
      } finally {
        this.submitting = false
      }
    },
    canDecideItem (item) {
      if (!item) return false
      return canDecideReviewSuggestion({
        isAuthor: this.isAuthor,
        canReviewOrApprove: this.canReviewOrApprove,
        state: this.draftState || 'in_review',
        itemType: item.type
      })
    },
    async onAcceptItem (item) {
      if (!this.canDecideItem(item)) return
      this.$set(this.localReviewedTimestamps, item.id, new Date().toISOString())
      if (item.type === 'suggestion') {
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('suggestion-decision', { item, decision: 'accepted' })
        return
      }
      if (item.type === 'redaction') {
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('redaction-decision', { item, decision: 'accepted' })
      }
      await this.setCommentResolved(item.rawCommentId, true, 'accepted')
    },
    async onRejectItem (item) {
      if (!this.canDecideItem(item)) return
      this.$set(this.localReviewedTimestamps, item.id, new Date().toISOString())
      if (item.type === 'suggestion') {
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('suggestion-decision', { item, decision: 'rejected' })
        return
      }
      if (item.type === 'redaction') {
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('redaction-decision', { item, decision: 'rejected' })
      }
      await this.setCommentResolved(item.rawCommentId, true, 'rejected')
    },
    async onReopenItem (item) {
      if (!this.canDecideItem(item)) return
      this.$delete(this.localReviewedTimestamps, item.id)
      if (item.rawCommentId) {
        await this.setCommentResolved(item.rawCommentId, false, 'pending')
      } else {
        /* eslint-disable-next-line vue/custom-event-name-casing */
        this.$emit('suggestion-decision', { item, decision: 'pending' })
      }
    },
    async reopenCommentItem (item) {
      await this.onReopenItem(item)
    },
    async setCommentResolved (commentId, resolved, decision = 'accepted') {
      if (!commentId) return
      this.resolvingId = commentId
      try {
        const result = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $resolved: Boolean!, $decision: String) {
              workflow {
                resolveComment(id: $id, resolved: $resolved, decision: $decision) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: commentId,
            resolved,
            decision
          }
        })
        const res = result && result.data && result.data.workflow && result.data.workflow.resolveComment
        if (res && res.responseResult && res.responseResult.succeeded) {
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('comment-resolved', { id: commentId, resolved, decision })
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: err.message || 'Erro ao atualizar status da anotação.'
        })
      } finally {
        this.resolvingId = null
      }
    },
    async submitReply (item) {
      const text = String(this.replyInputs[item.id] || '').trim()
      if (!text) return

      const myName = (this.$store && this.$store.state && this.$store.state.user && this.$store.state.user.name) || 'Você'
      const existing = this.localSuggestionReplies[item.id] || item.replies || []
      const optimisticReply = { author: myName, text, createdAt: new Date().toISOString() }

      this.$set(this.localSuggestionReplies, item.id, [
        ...existing,
        optimisticReply
      ])
      this.$set(this.replyInputs, item.id, '')

      try {
        const encodedAnchor = encodeTextQuoteSelector({
          id: item.id,
          targetId: item.id,
          parentCommentId: item.rawCommentId || null,
          exact: item.oldText || item.newText || item.quote || '',
          prefix: item.prefix || '',
          suffix: item.suffix || '',
          suggestedReplacement: item.newText || '',
          status: item.status || 'pending',
          replies: []
        })

        const result = await this.$apollo.mutate({
          mutation: gql`
            mutation ($draftId: Int!, $lineNumber: Int, $anchorText: String, $body: String!) {
              workflow {
                addComment(draftId: $draftId, lineNumber: $lineNumber, anchorText: $anchorText, body: $body) {
                  responseResult {
                    succeeded
                    message
                  }
                  comment {
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
          variables: {
            draftId: this.draftId,
            lineNumber: item.lineNumber || null,
            anchorText: encodedAnchor,
            body: text
          }
        })

        const payload = result && result.data && result.data.workflow && result.data.workflow.addComment
        if (payload && payload.responseResult && payload.responseResult.succeeded && payload.comment) {
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('comment-added', payload.comment)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: err.message || 'Erro ao persistir comentário.'
        })
      }
    },
    scrollToCard (itemId) {
      this.$nextTick(() => {
        const el = this.$el && this.$el.querySelector(`#card-${itemId}`)
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })
    }
  }
}
</script>

<style lang='scss' scoped>
@import '../../themes/detran/scss/variables';

.detran-review-comments {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detran-rc-header {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__title {
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: $slate-800;
    margin: 0;
  }
}

.detran-rc-badge {
  padding: 4px 12px;
  border-radius: 9999px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.15;
  min-width: 76px;

  &__count {
    font-size: 0.8125rem;
    font-weight: 800;
    line-height: 1;
    text-align: center;
    display: block;
    width: 100%;
  }

  &__label {
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1;
    text-align: center;
    margin-top: 1px;
    display: block;
    width: 100%;
  }

  &__done {
    font-size: 0.75rem;
    font-weight: 700;
    text-align: center;
  }

  &.is-amber {
    background-color: #dcfce7;
    color: #166534;
  }

  &.is-emerald {
    background-color: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }
}

.detran-rc-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background-color: $slate-100;
  padding: 4px;
  border-radius: 0.5rem;
}

.detran-rc-tab {
  padding: 0.375rem 0.4rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  color: $slate-600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;

  &:hover {
    color: $slate-900;
  }

  &.is-active {
    background: #ffffff;
    color: $slate-800;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
}

.detran-rc-composer {
  background: #ffffff;
  border: 2px solid #16a34a;
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.1);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  &__title {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #166534;
  }

  &__close {
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 2px;
  }

  &__quote {
    background: #fefce8;
    border-left: 3px solid #facc15;
    padding: 0.375rem 0.625rem;
    border-radius: 0 0.375rem 0.375rem 0;
    margin-bottom: 0.625rem;
    font-size: 0.75rem;
  }

  &__quote-label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #854d0e;
  }

  &__quote-text {
    font-style: italic;
    color: $slate-600;
  }

  &__field {
    margin-bottom: 0.5rem;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
}

.detran-rc-input-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  color: $slate-600;
  margin-bottom: 3px;
}

.detran-rc-textarea {
  width: 100%;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  color: $slate-800;
  background: #ffffff;
  border: 1px solid $slate-300;
  border-radius: 0.5rem;
  outline: none;
  resize: vertical;

  &.is-replacement {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
    font-weight: 500;
  }

  &:focus {
    border-color: #16a34a;
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
  }
}

.detran-rc-smart-paste-hint {
  font-size: 0.6875rem;
  color: #15803d;
  background: #f0fdf4;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.detran-rc-error {
  font-size: 0.6875rem;
  color: #dc2626;
  margin: 4px 0 0;
}

.detran-rc-cancel-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  color: $slate-600;
  cursor: pointer;

  &:hover {
    background: $slate-100;
  }
}

.detran-rc-submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.375rem 0.85rem;
  border-radius: 0.5rem;
  border: none;
  background-color: #15803d;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: #166534;
  }
}

.detran-rc-quick-add {
  width: 100%;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  border: 1px dashed $slate-300;
  background: rgba(255, 255, 255, 0.7);
  color: $slate-600;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #ffffff;
    border-color: #16a34a;
    color: #15803d;
  }
}

.detran-rc-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 540px;
  overflow-y: auto;
  padding-right: 4px;
}

.detran-rc-empty {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;

  &__icon {
    width: 48px;
    height: 48px;
    border-radius: 9999px;
    background: #f0fdf4;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 0.75rem;
  }

  &__title {
    font-size: 0.875rem;
    font-weight: 700;
    color: $slate-800;
    margin: 0 0 0.25rem;
  }

  &__sub {
    font-size: 0.75rem;
    color: $slate-500;
    margin: 0;
    line-height: 1.4;
  }
}

.detran-rc-card {
  background: #ffffff;
  border: 1px solid $slate-200;
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    border-color: $slate-300;
  }

  &.active-card {
    transform: translateX(-4px);
    border-color: #16a34a;
    box-shadow: 0 10px 25px -5px rgba(22, 163, 74, 0.15), 0 0 0 2px rgba(22, 163, 74, 0.15);
  }

  &.is-resolved {
    opacity: 0.75;
    background: $slate-50;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
  }

  &__author-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__avatar {
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.is-green {
      background: #dcfce7;
    }

    &.is-amber {
      background: #fef3c7;
    }
  }

  &__author {
    font-size: 0.75rem;
    font-weight: 700;
    color: $slate-800;
    line-height: 1.2;
  }

  &__meta {
    font-size: 0.6875rem;
    color: $slate-400;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  &__status-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__quote {
    font-size: 0.6875rem;
    font-style: italic;
    color: $slate-600;
    border-left: 2px solid #facc15;
    background: #fefce8;
    padding: 4px 8px;
    border-radius: 0 4px 4px 0;
    margin-bottom: 0.5rem;
  }

  &__body {
    font-size: 0.75rem;
    color: $slate-700;
    line-height: 1.5;
    margin: 0 0 0.5rem;
    white-space: pre-wrap;
  }
}

.detran-rc-decision-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  font-size: 0.6875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;

  &.is-accept {
    background: #f0fdf4;
    color: #15803d;
    border-color: #bbf7d0;

    &:hover:not(:disabled) {
      background: #16a34a;
      color: #ffffff;
    }
  }

  &.is-reject {
    background: #fef2f2;
    color: #b91c1c;
    border-color: #fecaca;

    &:hover:not(:disabled) {
      background: #dc2626;
      color: #ffffff;
    }
  }
}

.detran-rc-diff-preview {
  background: $slate-50;
  border: 1px solid $slate-100;
  border-radius: 0.5rem;
  padding: 0.625rem;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.5rem;

  &__old {
    color: #b91c1c;
    text-decoration: line-through;
    line-height: 1.4;
  }

  &__new {
    color: #166534;
    font-weight: 500;
    line-height: 1.4;
  }

  &__tag {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-right: 4px;
    display: inline-block;

    &.is-old { color: #991b1b; }
    &.is-new { color: #15803d; }
  }
}

.detran-rc-blob-warn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #b91c1c;
  background: #fef2f2;
  padding: 4px 6px;
  border-radius: 4px;
}

.detran-rc-section-divider {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin-top: 4px;
  border-radius: 0.5rem;
  background: $slate-100;
  color: $slate-600;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.detran-rc-status-chip {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;

  &.is-emerald {
    background: #dcfce7;
    color: #166534;
  }

  &.is-red {
    background: #fee2e2;
    color: #991b1b;
  }

  &.is-amber {
    background: #fef3c7;
    color: #92400e;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
}

.detran-rc-reopen-btn {
  border: none;
  background: transparent;
  font-size: 0.6875rem;
  color: $slate-500;
  cursor: pointer;
  text-decoration: underline;
}

.detran-rc-replies {
  border-top: 1px solid $slate-100;
  padding-top: 0.5rem;
  margin-top: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detran-rc-reply {
  font-size: 0.75rem;
  line-height: 1.4;

  &__author {
    color: $slate-800;
  }

  &__text {
    color: $slate-600;
  }
}

.detran-rc-reply-box {
  margin-top: 0.625rem;
  padding-top: 0.5rem;
  border-top: 1px solid $slate-100;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.detran-rc-reply-input {
  flex: 1;
  font-size: 0.75rem;
  background: $slate-50;
  border: 1px solid $slate-200;
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  outline: none;

  &:focus {
    background: #ffffff;
    border-color: #16a34a;
  }
}

.detran-rc-reply-send {
  border: none;
  background: transparent;
  padding: 0.375rem;
  border-radius: 0.5rem;
  cursor: pointer;

  &:hover {
    background: #f0fdf4;
  }
}
</style>

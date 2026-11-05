<template lang='pug'>
  .detran-review-comments
    //- Cabeçalho do Card Lateral
    .detran-rc-header
      .detran-rc-header__left
        v-icon(size='16' color='#288b4a') mdi-comment-multiple-outline
        h4.detran-rc-header__title Anotações ({{ comments.length }})
      span.detran-rc-badge(
        v-if='unresolvedCount > 0'
        class='is-amber'
      ) {{ unresolvedCount }} pendente(s)
      span.detran-rc-badge(
        v-else-if='comments.length > 0'
        class='is-emerald'
      ) Resolvidas

    //- Abas de Filtro
    .detran-rc-tabs
      button.detran-rc-tab(
        type='button'
        :class='{ "is-active": filterMode === "all" }'
        @click='filterMode = "all"'
      ) Todas ({{ comments.length }})
      button.detran-rc-tab(
        type='button'
        :class='{ "is-active": filterMode === "pending" }'
        @click='filterMode = "pending"'
      ) Pendentes ({{ unresolvedCount }})
      button.detran-rc-tab(
        v-if='selectedLine > 0'
        type='button'
        :class='{ "is-active": filterMode === "line" }'
        @click='filterMode = "line"'
      ) Linha {{ selectedLine }} ({{ lineCommentsCount }})

    //- Formulário de Nova Anotação
    .detran-rc-form
      .detran-rc-form__top
        span.detran-rc-form__label
          v-icon(size='14' color='#288b4a') mdi-comment-plus-outline
          span(v-if='newComment.lineNumber > 0') Anotação na Linha {{ newComment.lineNumber }}
          span(v-else) Nova Anotação Geral
        button.detran-rc-form__clear(
          v-if='newComment.lineNumber > 0'
          type='button'
          @click='newComment.lineNumber = 0; $emit("clear-line")'
          title='Converter para anotação geral'
        )
          v-icon(size='13' color='#64748b') mdi-close
          span Geral

      .detran-rc-form__row
        .detran-rc-form__col-line
          label.detran-rc-input-label Linha
          input.detran-rc-input(
            v-model.number='newComment.lineNumber'
            type='number'
            min='0'
            placeholder='0'
          )
        .detran-rc-form__col-anchor
          label.detran-rc-input-label Trecho (opcional)
          input.detran-rc-input(
            v-model='newComment.anchorText'
            type='text'
            placeholder='Ex: "Art. 2º..."'
          )

      textarea.detran-rc-textarea(
        v-model='newComment.body'
        rows='3'
        placeholder='Descreva o ajuste ou observação técnica...'
        @input='formError = ""'
      )
      p.detran-rc-error(v-if='formError') {{ formError }}

      .detran-rc-form__actions
        button.detran-rc-submit-btn(
          type='button'
          :disabled='submitting || !newComment.body.trim()'
          @click='submitComment'
        )
          v-icon(size='13' color='#ffffff') mdi-send
          span {{ submitting ? 'Enviando...' : 'Inserir Anotação' }}

    //- Lista de Anotações
    .detran-rc-list
      .detran-rc-empty(v-if='filteredComments.length === 0')
        v-icon(size='32' color='#cbd5e1') mdi-comment-check-outline
        p.detran-rc-empty__title
          template(v-if='filterMode === "pending"') Nenhuma anotação pendente.
          template(v-else-if='filterMode === "line"') Sem anotações na linha {{ selectedLine }}.
          template(v-else) Nenhuma anotação registrada.
        p.detran-rc-empty__sub Clique em qualquer linha do comparativo ao lado para ancorar uma observação.

      .detran-rc-item(
        v-else
        v-for='item in filteredComments'
        :key='item.id'
        :class='{ "is-resolved": item.resolved }'
      )
        .detran-rc-item__head
          .detran-rc-item__author
            .detran-rc-item__avatar {{ (item.userName || 'R').charAt(0).toUpperCase() }}
            div
              .detran-rc-item__name {{ item.userName || 'Revisor' }}
              .detran-rc-item__date {{ item.createdAt | moment('DD/MM/YYYY HH:mm') }}
          .detran-rc-item__badges
            button.detran-rc-line-chip(
              v-if='item.lineNumber > 0'
              type='button'
              @click='$emit("select-line", item.lineNumber)'
            ) L{{ item.lineNumber }}
            span.detran-rc-status-chip(:class='item.resolved ? "is-emerald" : "is-amber"')
              | {{ item.resolved ? 'Resolvido' : 'Pendente' }}

        .detran-rc-item__quote(v-if='item.anchorText') "{{ item.anchorText }}"
        p.detran-rc-item__body {{ item.body }}

        .detran-rc-item__foot
          button.detran-rc-resolve-btn(
            type='button'
            :disabled='resolvingId === item.id'
            @click='toggleResolve(item)'
          )
            v-icon(size='13' :color='item.resolved ? "#64748b" : "#1b6535"') {{ item.resolved ? 'mdi-undo' : 'mdi-check-circle-outline' }}
            span {{ item.resolved ? 'Reabrir anotação' : 'Marcar como resolvido' }}
</template>

<script>
import gql from 'graphql-tag'

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
    selectedLine: {
      type: Number,
      default: 0
    },
    selectedText: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      filterMode: 'all',
      submitting: false,
      resolvingId: null,
      formError: '',
      newComment: {
        lineNumber: 0,
        anchorText: '',
        body: ''
      }
    }
  },
  computed: {
    unresolvedCount () {
      return this.comments.filter(c => !c.resolved).length
    },
    lineCommentsCount () {
      if (!this.selectedLine) return 0
      return this.comments.filter(c => c.lineNumber === this.selectedLine).length
    },
    filteredComments () {
      if (this.filterMode === 'pending') {
        return this.comments.filter(c => !c.resolved)
      }
      if (this.filterMode === 'line' && this.selectedLine > 0) {
        return this.comments.filter(c => c.lineNumber === this.selectedLine)
      }
      return this.comments
    }
  },
  watch: {
    selectedLine: {
      immediate: true,
      handler (newVal) {
        if (newVal > 0) {
          this.newComment.lineNumber = newVal
          if (this.selectedText) {
            this.newComment.anchorText = this.selectedText
          }
          if (this.lineCommentsCount > 0) {
            this.filterMode = 'line'
          }
        }
      }
    },
    selectedText (newVal) {
      if (newVal && this.selectedLine > 0) {
        this.newComment.anchorText = newVal
      }
    }
  },
  methods: {
    async submitComment () {
      if (!this.newComment.body.trim()) {
        this.formError = 'Por favor, informe o conteúdo da anotação.'
        return
      }

      this.submitting = true
      this.formError = ''

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
            lineNumber: this.newComment.lineNumber > 0 ? this.newComment.lineNumber : null,
            anchorText: this.newComment.anchorText || null,
            body: this.newComment.body.trim()
          }
        })

        const payload = result && result.data && result.data.workflow && result.data.workflow.addComment
        if (payload && payload.responseResult && payload.responseResult.succeeded && payload.comment) {
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('comment-added', payload.comment)
          this.newComment.body = ''
          this.newComment.anchorText = ''
        } else {
          this.formError = (payload && payload.responseResult && payload.responseResult.message) || 'Erro ao registrar anotação.'
        }
      } catch (err) {
        this.formError = err.message || 'Falha de comunicação ao adicionar anotação.'
      } finally {
        this.submitting = false
      }
    },

    async toggleResolve (comment) {
      this.resolvingId = comment.id
      const nextResolved = !comment.resolved

      try {
        const result = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $resolved: Boolean!) {
              workflow {
                resolveComment(id: $id, resolved: $resolved) {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            id: comment.id,
            resolved: nextResolved
          }
        })

        const res = result && result.data && result.data.workflow && result.data.workflow.resolveComment
        if (res && res.succeeded) {
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$emit('comment-resolved', { id: comment.id, resolved: nextResolved })
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            icon: 'alert',
            message: (res && res.message) || 'Não foi possível alterar o status do comentário.'
          })
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: err.message || 'Erro ao resolver anotação.'
        })
      } finally {
        this.resolvingId = null
      }
    }
  }
}
</script>

<style lang='scss' scoped>
@import '../../themes/detran/scss/variables';

.detran-review-comments {
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.detran-rc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.125rem;
  background-color: $slate-50;
  border-bottom: 1px solid $slate-100;

  &__left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $slate-700;
    margin: 0;
  }
}

.detran-rc-badge {
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;

  &.is-amber {
    background-color: #fef3c7;
    color: #b45309;
  }

  &.is-emerald {
    background-color: #d1fae5;
    color: #1b6535;
  }
}

.detran-rc-tabs {
  display: flex;
  gap: 4px;
  padding: 0.5rem 0.875rem;
  border-bottom: 1px solid $slate-100;
}

.detran-rc-tab {
  flex: 1;
  padding: 0.3rem 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  font-size: 0.6875rem;
  font-weight: 600;
  color: $slate-500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: $slate-800;
    background: $slate-50;
  }

  &.is-active {
    background: $detran-50;
    color: $detran-700;
  }
}

.detran-rc-form {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid $slate-100;
  background-color: #ffffff;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.625rem;
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: $slate-800;
  }

  &__clear {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: none;
    background: $slate-100;
    color: $slate-600;
    font-size: 0.6875rem;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
  }

  &__row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  &__col-line {
    width: 68px;
    flex-shrink: 0;
  }

  &__col-anchor {
    flex: 1;
    min-width: 0;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }
}

.detran-rc-input-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  color: $slate-500;
  margin-bottom: 2px;
}

.detran-rc-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  color: $slate-800;
  background: $slate-50;
  border: 1px solid $slate-200;
  border-radius: 0.5rem;
  outline: none;

  &:focus {
    background: #ffffff;
    border-color: #2ea058;
  }
}

.detran-rc-textarea {
  width: 100%;
  padding: 0.5rem 0.625rem;
  font-size: 0.75rem;
  color: $slate-800;
  background: $slate-50;
  border: 1px solid $slate-200;
  border-radius: 0.5rem;
  outline: none;
  resize: vertical;

  &:focus {
    background: #ffffff;
    border-color: #2ea058;
  }
}

.detran-rc-error {
  font-size: 0.6875rem;
  color: #dc2626;
  margin: 4px 0 0;
}

.detran-rc-submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  border: none;
  background-color: #1b6535;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: #144d28;
  }
}

.detran-rc-list {
  padding: 0.75rem 1rem;
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.detran-rc-empty {
  text-align: center;
  padding: 1.5rem 0.5rem;

  &__title {
    font-size: 0.75rem;
    font-weight: 600;
    color: $slate-600;
    margin: 0.5rem 0 0.25rem;
  }

  &__sub {
    font-size: 0.6875rem;
    color: $slate-400;
    margin: 0;
    line-height: 1.4;
  }
}

.detran-rc-item {
  border: 1px solid $slate-200;
  border-radius: 0.625rem;
  padding: 0.65rem 0.75rem;
  background: #ffffff;

  &.is-resolved {
    opacity: 0.72;
    background: $slate-50;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  &__author {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  &__avatar {
    width: 22px;
    height: 22px;
    border-radius: 9999px;
    background: $detran-100;
    color: $detran-800;
    font-size: 0.6875rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__name {
    font-size: 0.75rem;
    font-weight: 700;
    color: $slate-800;
    line-height: 1.1;
  }

  &__date {
    font-size: 0.625rem;
    color: $slate-400;
  }

  &__badges {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__quote {
    font-size: 0.6875rem;
    color: $slate-600;
    font-style: italic;
    background: $slate-50;
    border-left: 2px solid $detran-500;
    padding: 3px 6px;
    border-radius: 0 4px 4px 0;
    margin-bottom: 0.375rem;
  }

  &__body {
    font-size: 0.75rem;
    color: $slate-700;
    line-height: 1.45;
    margin: 0 0 0.45rem;
    white-space: pre-wrap;
  }

  &__foot {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.35rem;
    border-top: 1px solid $slate-100;
  }
}

.detran-rc-line-chip {
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid $slate-200;
  background: $slate-50;
  font-size: 0.625rem;
  font-weight: 700;
  color: $slate-700;
  cursor: pointer;
}

.detran-rc-status-chip {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;

  &.is-amber {
    background: #fef3c7;
    color: #b45309;
  }

  &.is-emerald {
    background: #d1fae5;
    color: #1b6535;
  }
}

.detran-rc-resolve-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #1b6535;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
</style>

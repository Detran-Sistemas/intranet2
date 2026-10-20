<template lang='pug'>
  .detran-review-comments
    //- Header com filtros e contador
    v-toolbar(flat, dense, color='transparent')
      v-toolbar-title.subtitle-1.font-weight-bold.detran-title
        v-icon.mr-2(color='primary') mdi-comment-multiple-outline
        | Anotações e Apontamentos ({{ comments.length }})
      v-spacer
      v-chip(
        v-if='unresolvedCount > 0'
        small
        color='amber lighten-4'
        text-color='amber darken-4'
        class='font-weight-medium'
      )
        v-icon(left, small) mdi-alert-circle-outline
        | {{ unresolvedCount }} pendente(s)
      v-chip(
        v-else-if='comments.length > 0'
        small
        color='green lighten-4'
        text-color='green darken-4'
        class='font-weight-medium'
      )
        v-icon(left, small) mdi-check-circle-outline
        | Todas resolvidas

    //- Filtro de exibição
    v-toolbar(flat, dense, color='transparent', class='px-2')
      v-btn-toggle(v-model='filterMode', mandatory, dense)
        v-btn(value='all', small, text)
          | Todas ({{ comments.length }})
        v-btn(value='pending', small, text)
          | Pendentes ({{ unresolvedCount }})
        v-btn(v-if='selectedLine > 0', value='line', small, text)
          | Linha {{ selectedLine }} ({{ lineCommentsCount }})

      v-spacer
      v-btn(
        v-if='selectedLine > 0'
        small
        text
        color='grey darken-1'
        @click='$emit("clear-selected-line")'
      )
        v-icon(small, left) mdi-close
        | Limpar Linha

    v-divider.my-2

    //- Formulário de Nova Anotação
    v-card.mx-2.mb-4(outlined, class='detran-comment-form-card')
      v-card-title.subtitle-2.py-2.detran-form-header
        v-icon(small, color='primary', class='mr-2') mdi-comment-plus-outline
        span(v-if='newComment.lineNumber > 0') Anotação na Linha {{ newComment.lineNumber }}
        span(v-else) Nova Anotação Geral
        v-spacer
        v-btn(
          v-if='newComment.lineNumber > 0'
          icon
          x-small
          @click='newComment.lineNumber = 0'
          title='Converter para comentário geral'
        )
          v-icon mdi-close

      v-card-text.pt-2.pb-1
        v-row(dense)
          v-col(cols='4')
            v-text-field(
              v-model.number='newComment.lineNumber'
              label='Nº Linha'
              type='number'
              min='0'
              dense
              outlined
              hint='0 para geral'
              persistent-hint
            )
          v-col(cols='8')
            v-text-field(
              v-model='newComment.anchorText'
              label='Trecho Referenciado (opcional)'
              dense
              outlined
              placeholder='Ex: "Art. 2º..."'
            )
        v-textarea(
          v-model='newComment.body'
          label='Observação / Ajuste solicitado'
          rows='3'
          dense
          outlined
          placeholder='Descreva detalhadamente o que deve ser corrigido ou ajustado...'
          :error-messages='formError'
          @input='formError = ""'
        )

      v-card-actions.pt-0.px-4.pb-3
        v-spacer
        v-btn(
          color='primary'
          depressed
          small
          :loading='submitting'
          :disabled='!newComment.body.trim()'
          @click='submitComment'
          class='detran-btn-primary'
        )
          v-icon(left, small) mdi-send
          | Inserir Anotação

    //- Lista de Comentários
    .detran-comments-list.px-2
      template(v-if='filteredComments.length === 0')
        v-card.pa-6.text-center(flat, color='transparent')
          v-icon(size='48', color='grey lighten-1') mdi-comment-check-outline
          .body-2.grey--text.text--darken-1.mt-2
            span(v-if='filterMode === "pending"') Nenhuma anotação pendente neste documento.
            span(v-else-if='filterMode === "line"') Nenhuma anotação para a linha {{ selectedLine }}.
            span(v-else) Nenhuma anotação registrada até o momento.
          .caption.grey--text Clique em qualquer linha do diff para criar uma anotação ancorada.

      template(v-else)
        v-card.mb-3(
          v-for='item in filteredComments'
          :key='item.id'
          outlined
          :class='["detran-comment-card", { "is-resolved": item.resolved }]'
        )
          v-card-title.py-2.px-3.d-flex.align-center
            v-avatar(size='24', color='grey lighten-2', class='mr-2')
              v-icon(x-small, color='grey darken-2') mdi-account
            .caption.font-weight-bold.grey--text.text--darken-3
              | {{ item.userName || "Revisor" }}
            .caption.grey--text.ml-2
              | {{ item.createdAt | moment("DD/MM/YYYY HH:mm") }}
            v-spacer

            //- Badge da linha
            v-chip(
              v-if='item.lineNumber > 0'
              x-small
              label
              color='blue-grey lighten-5'
              text-color='blue-grey darken-3'
              class='font-weight-bold mr-2'
              @click='$emit("select-line", item.lineNumber)'
            )
              v-icon(left, x-small) mdi-format-line-spacing
              | Linha {{ item.lineNumber }}
            v-chip(
              v-else
              x-small
              label
              color='grey lighten-3'
              text-color='grey darken-2'
              class='mr-2'
            )
              | Geral

            //- Status resolvido/pendente
            v-chip(
              x-small
              :color='item.resolved ? "green lighten-5" : "amber lighten-5"'
              :text-color='item.resolved ? "green darken-3" : "amber darken-4"'
              class='font-weight-medium'
            )
              v-icon(left, x-small) {{ item.resolved ? 'mdi-check' : 'mdi-clock-outline' }}
              | {{ item.resolved ? 'Resolvido' : 'Pendente' }}

          //- Trecho ancorado se houver
          v-card-text.pt-1.pb-2.px-3
            .detran-anchor-snippet.mb-2(v-if='item.anchorText')
              v-icon(x-small, color='grey') mdi-format-quote-open
              span.caption.font-italic {{ item.anchorText }}

            .body-2.detran-comment-body {{ item.body }}

          //- Ações do comentário
          v-card-actions.py-1.px-3.detran-comment-actions
            v-spacer
            v-btn(
              text
              x-small
              :color='item.resolved ? "grey darken-1" : "green darken-2"'
              :loading='resolvingId === item.id'
              @click='toggleResolve(item)'
            )
              v-icon(left, x-small) {{ item.resolved ? 'mdi-undo' : 'mdi-check-circle' }}
              | {{ item.resolved ? 'Reabrir Anotação' : 'Marcar como Resolvido' }}

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
  data() {
    return {
      filterMode: 'all', // 'all', 'pending', 'line'
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
    unresolvedCount() {
      return this.comments.filter(c => !c.resolved).length
    },
    lineCommentsCount() {
      if (!this.selectedLine) return 0
      return this.comments.filter(c => c.lineNumber === this.selectedLine).length
    },
    filteredComments() {
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
      handler(newVal) {
        if (newVal > 0) {
          this.newComment.lineNumber = newVal
          if (this.selectedText) {
            this.newComment.anchorText = this.selectedText
          }
          // Se houver comentários nessa linha, sugere filtro da linha
          if (this.lineCommentsCount > 0) {
            this.filterMode = 'line'
          }
        }
      }
    },
    selectedText(newVal) {
      if (newVal && this.selectedLine > 0) {
        this.newComment.anchorText = newVal
      }
    }
  },
  methods: {
    async submitComment() {
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

        const payload = result?.data?.workflow?.addComment
        if (payload?.responseResult?.succeeded && payload.comment) {
          this.$emit('comment-added', payload.comment)
          this.newComment.body = ''
          this.newComment.anchorText = ''
        } else {
          this.formError = payload?.responseResult?.message || 'Erro ao registrar anotação.'
        }
      } catch (err) {
        this.formError = err.message || 'Falha de comunicação ao adicionar anotação.'
      } finally {
        this.submitting = false
      }
    },

    async toggleResolve(comment) {
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

        const res = result?.data?.workflow?.resolveComment
        if (res?.succeeded) {
          this.$emit('comment-resolved', { id: comment.id, resolved: nextResolved })
        } else {
          this.$store.commit('pushNotification', {
            type: 'error',
            message: res?.message || 'Não foi possível alterar o status do comentário.'
          })
        }
      } catch (err) {
        this.$store.commit('pushNotification', {
          type: 'error',
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
.detran-review-comments {
  background-color: #fafbfc;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detran-title {
  color: #1a472a;
}

.detran-form-header {
  background-color: #f1f8f4;
  border-bottom: 1px solid #e1e9e4;
  color: #1a472a;
}

.detran-comment-form-card {
  border-color: #cde4d6;
  border-radius: 6px;
  background-color: #ffffff;
}

.detran-comments-list {
  overflow-y: auto;
  flex: 1;
}

.detran-comment-card {
  border-radius: 6px;
  background-color: #ffffff;
  transition: all 0.2s ease;

  &.is-resolved {
    opacity: 0.75;
    background-color: #fcfcfc;
  }

  &:hover {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }
}

.detran-anchor-snippet {
  background-color: #f4f6f8;
  border-left: 3px solid #288b4a;
  padding: 4px 8px;
  border-radius: 0 4px 4px 0;
  color: #37474f;
}

.detran-comment-body {
  white-space: pre-wrap;
  color: #263238;
}

.detran-comment-actions {
  border-top: 1px solid #f0f0f0;
}

.detran-btn-primary {
  background-color: #288b4a !important;
  color: #ffffff !important;
}
</style>

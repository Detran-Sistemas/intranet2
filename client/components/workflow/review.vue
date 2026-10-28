<template lang='pug'>
  .detran-workflow-review
    //- Barra de Carregamento Superior
    v-progress-linear(
      v-if='loading'
      indeterminate
      color='primary'
      height='3'
    )

    //- Cabeçalho de Navegação e Metadados do Documento
    v-card.detran-review-header(flat, tile)
      v-toolbar(flat, color='transparent', class='px-2')
        v-btn(icon, @click='goBack', title='Voltar')
          v-icon mdi-arrow-left
        v-toolbar-title.detran-header-title
          span.overline.font-weight-bold.detran-overline REVISÃO DE WORKFLOW INSTITUCIONAL
          .title.font-weight-bold.detran-doc-title {{ draft.title || 'Carregando documento...' }}
        v-spacer

        //- Chip de Estado do Workflow
        v-chip.mr-2(
          label
          small
          :color='stateBadge.color'
          :text-color='stateBadge.textColor'
          class='font-weight-bold text-uppercase'
        )
          v-icon(left, small) {{ stateBadge.icon }}
          | {{ stateBadge.label }}

        //- Chip do Nível de Aprovação
        v-chip.mr-3(
          outlined
          small
          color='grey darken-2'
          class='font-weight-medium'
        )
          v-icon(left, small) mdi-layers-outline
          span(v-if='draft.approvalMode === "2_levels"') 2 Níveis (Técnico + Homologação)
          span(v-else) 1 Nível (Revisão Direta)

        //- Botão para alternar drawer de anotações
        v-btn(
          depressed
          small
          :color='drawerComments ? "primary" : "grey lighten-2"'
          :class='drawerComments ? "white--text" : "grey--text text--darken-3"'
          @click='drawerComments = !drawerComments'
        )
          v-badge(
            v-if='unresolvedCommentsCount > 0'
            color='amber darken-3'
            :content='unresolvedCommentsCount'
            overlap
          )
            v-icon(left, small) mdi-comment-multiple-outline
          v-icon(v-else, left, small) mdi-comment-multiple-outline
          | Anotações

      //- Subbarra com metadados do documento
      .px-4.pb-3.pt-0.d-flex.align-center.flex-wrap.caption.grey--text.text--darken-2
        span.mr-4
          v-icon(x-small, class='mr-1') mdi-file-document-outline
          strong Caminho:
          span.ml-1 /{{ draft.locale }}/{{ draft.path }}
        span.mr-4
          v-icon(x-small, class='mr-1') mdi-account-edit-outline
          strong Autor:
          span.ml-1 {{ draft.authorName || 'Servidor' }}
        span.mr-4
          v-icon(x-small, class='mr-1') mdi-calendar-clock
          strong Submetido em:
          span.ml-1 {{ draft.updatedAt | moment("DD/MM/YYYY [às] HH:mm") }}
        span.mr-4(v-if='draft.pageId')
          v-icon(x-small, class='mr-1') mdi-check-decagram-outline
          strong Documento Existente (ID: {{ draft.pageId }})
        span.mr-4(v-else)
          v-icon(x-small, class='mr-1') mdi-plus-circle-outline
          strong Criação de Nova Página
        v-spacer
        .caption.primary--text.font-weight-medium
          | {{ actionsHelper.statusDescription }}

    //- Toolbar de Controles do Diff
    v-toolbar(flat, dense, color='grey lighten-4', class='detran-diff-toolbar px-3')
      .caption.font-weight-bold.grey--text.text--darken-3.mr-4
        v-icon(small, left, color='grey darken-2') mdi-compare
        | Comparação: Versão no Ar vs Rascunho Proposto

      //- Alternador de visualização
      v-btn-toggle(v-model='viewMode', mandatory, dense)
        v-btn(value='side-by-side', small, depressed)
          v-icon(left, x-small) mdi-view-column-outline
          | Lado a Lado
        v-btn(value='line-by-line', small, depressed)
          v-icon(left, x-small) mdi-view-sequential-outline
          | Linha a Linha

      v-spacer

      .caption.grey--text.text--darken-1.mr-2
        v-icon(x-small, left) mdi-cursor-default-click
        | Clique em uma linha para ancorar uma anotação

    //- Área Central: Conteúdo do Diff e Painel Lateral de Comentários
    .detran-review-workspace
      //- Container do Diff2Html
      .detran-diff-container(ref='diffContainer', @click='handleDiffClick')
        template(v-if='loading')
          v-container.fill-height.justify-center
            v-progress-circular(indeterminate, color='primary', size='48')
            .subtitle-2.grey--text.mt-3 Carregando análise de alterações...

        template(v-else-if='!hasDifferences')
          v-card.ma-6.pa-8.text-center(outlined)
            v-icon(size='64', color='blue-grey lighten-2') mdi-file-check-outline
            .title.grey--text.text--darken-2.mt-3 Nenhuma diferença textual detectada
            .body-2.grey--text O rascunho proposto possui o mesmo conteúdo exato da versão publicada no ar.

        template(v-else)
          .d2h-wrapper(v-html='diffHTML')

      //- Painel Lateral de Anotações (gaveta colapsável)
      .detran-comments-sidebar(v-show='drawerComments')
        review-comments(
          :draft-id='draft.id || 0'
          :comments='draft.comments || []'
          :selected-line='selectedLine'
          :selected-text='selectedText'
          @comment-added='onCommentAdded'
          @comment-resolved='onCommentResolved'
          @clear-selected-line='selectedLine = 0; selectedText = ""'
          @select-line='onSelectLine'
        )

    //- Barra de Rodapé com Ações do Revisor / Aprovador
    v-card.detran-actions-bar(flat, tile)
      v-divider
      .px-4.py-3.d-flex.align-center
        //- Resumo de pendências
        .caption.d-flex.align-center
          v-icon(
            small
            :color='unresolvedCommentsCount > 0 ? "amber darken-3" : "green darken-2"'
            class='mr-2'
          ) {{ unresolvedCommentsCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline' }}
          span(v-if='unresolvedCommentsCount > 0')
            strong {{ unresolvedCommentsCount }} anotação(ões) pendente(s)
            | &nbsp;no documento.
          span(v-else)
            strong Nenhuma pendência em aberto.
            | &nbsp;Documento apto para aprovação.

        v-spacer

        //- Ação: Solicitar Ajustes (Devolver ao Autor)
        v-btn.mr-3(
          v-if='actionsHelper.canRequestChanges'
          outlined
          color='orange darken-3'
          :loading='submittingAction'
          @click='openActionDialog("requestChanges")'
        )
          v-icon(left) mdi-undo-variant
          | Solicitar Ajustes

        //- Ação: Aprovar Nível 1 (Técnico)
        v-btn.mr-3(
          v-if='actionsHelper.canApproveStep'
          depressed
          color='primary'
          class='white--text detran-btn-primary'
          :loading='submittingAction'
          @click='openActionDialog("approveStep")'
        )
          v-icon(left) mdi-check-all
          | {{ actionsHelper.labelApproveStep }}

        //- Ação: Homologar e Publicar (Oficializar)
        v-btn(
          v-if='actionsHelper.canPublish'
          depressed
          color='success'
          class='white--text detran-btn-success'
          :loading='submittingAction'
          @click='openActionDialog("publish")'
        )
          v-icon(left) mdi-cloud-upload-outline
          | {{ actionsHelper.labelPublish }}

        //- Ação: Revalidar Vigência (+12 Meses)
        v-btn.ml-2(
          v-if='actionsHelper.canRevalidate'
          depressed
          color='teal darken-1'
          class='white--text detran-btn-teal font-weight-bold'
          :loading='submittingAction'
          @click='openActionDialog("revalidate")'
        )
          v-icon(left) mdi-refresh
          | {{ actionsHelper.labelRevalidate || 'Revalidar Vigência (+12m)' }}

    //- Modal de Parecer / Confirmação de Ações
    v-dialog(v-model='actionDialog.visible', max-width='600', persistent)
      v-card
        v-card-title.headline.font-weight-bold.detran-dialog-title(:class='actionDialog.headerClass')
          v-icon(left, color='white') {{ actionDialog.icon }}
          | {{ actionDialog.title }}

        v-card-text.pt-4
          p.body-2.grey--text.text--darken-3 {{ actionDialog.description }}

          v-alert(
            v-if='actionDialog.type === "publish" && unresolvedCommentsCount > 0'
            type='warning'
            dense
            outlined
            class='mb-3'
          )
            | Atenção: existem {{ unresolvedCommentsCount }} anotação(ões) ainda pendente(s). Deseja homologar mesmo assim?

          v-textarea(
            v-model='actionDialog.comment'
            :label='actionDialog.commentLabel'
            rows='4'
            outlined
            dense
            :placeholder='actionDialog.commentPlaceholder'
            :error-messages='actionDialog.error'
            @input='actionDialog.error = ""'
          )

        v-card-actions.px-4.pb-4.pt-0
          v-spacer
          v-btn(
            text
            color='grey darken-2'
            :disabled='submittingAction'
            @click='actionDialog.visible = false'
          ) Cancelar
          v-btn(
            depressed
            :color='actionDialog.confirmColor'
            class='white--text'
            :loading='submittingAction'
            @click='executeAction'
          )
            v-icon(left, small) mdi-check
            | Confirmar e Prosseguir

</template>

<script>
import * as Diff2Html from 'diff2html'
import { createPatch } from 'diff'
import _ from 'lodash'
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
  data() {
    return {
      loading: true,
      submittingAction: false,
      viewMode: 'side-by-side', // 'side-by-side' ou 'line-by-line'
      drawerComments: true,
      selectedLine: 0,
      selectedText: '',
      draft: {
        id: 0,
        pageId: null,
        path: '',
        locale: 'pt-BR',
        title: '',
        description: '',
        content: '',
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
        type: '', // 'requestChanges', 'approveStep', 'publish'
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
    draftId() {
      const paramId = this.$route?.params?.id
      return parseInt(this.id || paramId, 10) || 0
    },

    unresolvedCommentsCount() {
      return (this.draft.comments || []).filter(c => !c.resolved).length
    },

    diffPatch() {
      return generateDiffPatch({
        path: this.draft.path || 'documento',
        originalContent: this.livePage.content || '',
        draftContent: this.draft.content || ''
      })
    },

    diffHTML() {
      return renderDiffHtml({
        patch: this.diffPatch,
        viewMode: this.viewMode
      })
    },

    hasDifferences() {
      const orig = (this.livePage.content || '').trim()
      const draft = (this.draft.content || '').trim()
      return orig !== draft
    },

    actionsHelper() {
      const userPermissions = this.$store?.getters?.['user/permissions'] || {
        'review:pages': true,
        'approve:pages': true
      }
      return getAvailableReviewActions({
        state: this.draft.state,
        approvalMode: this.draft.approvalMode,
        permissions: userPermissions
      })
    },

    stateBadge() {
      switch (this.draft.state) {
        case 'in_review':
          return {
            label: 'Em Revisão',
            color: 'blue lighten-5',
            textColor: 'blue darken-3',
            icon: 'mdi-file-find-outline'
          }
        case 'awaiting_approval':
        case 'in_approval_step2':
          return {
            label: 'Aguardando Homologação',
            color: 'teal lighten-5',
            textColor: 'teal darken-3',
            icon: 'mdi-certificate-outline'
          }
        case 'changes_requested':
          return {
            label: 'Ajustes Solicitados',
            color: 'amber lighten-5',
            textColor: 'amber darken-4',
            icon: 'mdi-alert-circle-outline'
          }
        case 'published':
          return {
            label: 'Publicado Oficialmente',
            color: 'green lighten-5',
            textColor: 'green darken-4',
            icon: 'mdi-check-decagram'
          }
        default:
          return {
            label: this.draft.state || 'Rascunho',
            color: 'grey lighten-3',
            textColor: 'grey darken-3',
            icon: 'mdi-pencil-outline'
          }
      }
    }
  },
  watch: {
    draftId: {
      immediate: true,
      handler(newId) {
        if (newId > 0) {
          this.loadReviewData(newId)
        }
      }
    }
  },
  methods: {
    goBack() {
      if (window.history.length > 1) {
        this.$router.go(-1)
      } else {
        this.$router.push('/w')
      }
    },

    async loadReviewData(id) {
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

        const draftData = result?.data?.workflow?.draft
        if (!draftData) {
          this.$store.commit('pushNotification', {
            type: 'error',
            message: 'Rascunho de revisão não encontrado.'
          })
          return
        }

        this.draft = draftData

        // Se o rascunho é sobre uma página já publicada, busca o conteúdo oficial
        if (draftData.pageId) {
          await this.loadLivePageContent(draftData.pageId)
        } else {
          this.livePage = {
            content: '',
            title: '',
            description: ''
          }
        }
      } catch (err) {
        this.$store.commit('pushNotification', {
          type: 'error',
          message: err.message || 'Erro ao carregar dados de revisão.'
        })
      } finally {
        this.loading = false
      }
    },

    async loadLivePageContent(pageId) {
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

        const page = result?.data?.pages?.single
        if (page) {
          this.livePage = page
        }
      } catch (err) {
        // Não impede a revisão caso a página core não seja recuperada
        console.warn('Não foi possível obter versão no ar:', err)
      }
    },

    handleDiffClick(event) {
      const line = extractLineFromDiffElement(event.target)
      if (line && line > 0) {
        this.selectedLine = line

        // Tenta capturar o texto da linha selecionada
        const row = event.target.closest('tr') || event.target.closest('.d2h-code-line')
        if (row) {
          const textEl = row.querySelector('.d2h-code-line-ctn') || row
          const text = (textEl.innerText || textEl.textContent || '').trim()
          this.selectedText = text.substring(0, 80)
        }

        // Garante gaveta de anotações aberta
        this.drawerComments = true
      }
    },

    onSelectLine(line) {
      this.selectedLine = line
      this.drawerComments = true
    },

    onCommentAdded(newComment) {
      this.draft.comments = [...this.draft.comments, newComment]
      this.$store.commit('pushNotification', {
        type: 'success',
        message: 'Anotação registrada com sucesso.'
      })
    },

    onCommentResolved({ id, resolved }) {
      this.draft.comments = this.draft.comments.map(c => {
        if (c.id === id) {
          return { ...c, resolved }
        }
        return c
      })
      this.$store.commit('pushNotification', {
        type: 'success',
        message: resolved ? 'Anotação marcada como resolvida.' : 'Anotação reaberta.'
      })
    },

    openActionDialog(type) {
      this.actionDialog.type = type
      this.actionDialog.comment = ''
      this.actionDialog.error = ''

      if (type === 'requestChanges') {
        this.actionDialog.title = 'Solicitar Ajustes ao Autor'
        this.actionDialog.description =
          'O documento retornará para a caixa do autor com o status "Ajustes Solicitados". Informe os apontamentos necessários:'
        this.actionDialog.commentLabel = 'Justificativa / Parecer de Ajustes (Obrigatório)'
        this.actionDialog.commentPlaceholder = 'Descreva os motivos da devolução e os ajustes que devem ser realizados...'
        this.actionDialog.icon = 'mdi-undo-variant'
        this.actionDialog.headerClass = 'detran-header-warning'
        this.actionDialog.confirmColor = 'orange darken-3'
      } else if (type === 'approveStep') {
        this.actionDialog.title = 'Aprovar Nível 1 (Revisão Técnica)'
        this.actionDialog.description =
          'O parecer técnico será registrado e o documento avançará para o Nível 2 (Homologação Final).'
        this.actionDialog.commentLabel = 'Parecer Técnico (Opcional)'
        this.actionDialog.commentPlaceholder = 'Observações sobre a conformidade técnica do documento...'
        this.actionDialog.icon = 'mdi-check-all'
        this.actionDialog.headerClass = 'detran-header-primary'
        this.actionDialog.confirmColor = 'primary'
      } else if (type === 'publish') {
        this.actionDialog.title = 'Homologar e Publicar na Intranet'
        this.actionDialog.description =
          'Esta ação é a homologação final. O conteúdo do rascunho será publicado oficialmente na base da Intranet Detran-MG.'
        this.actionDialog.commentLabel = 'Despacho de Homologação (Opcional)'
        this.actionDialog.commentPlaceholder = 'Nota de publicação / homologação institucional...'
        this.actionDialog.icon = 'mdi-cloud-upload-outline'
        this.actionDialog.headerClass = 'detran-header-success'
        this.actionDialog.confirmColor = 'success'
      } else if (type === 'revalidate') {
        this.actionDialog.title = 'Revalidar Vigência (+12 Meses)'
        this.actionDialog.description =
          'Confirma a renovação da vigência legal deste ato normativo por mais 12 meses sem necessidade de alteração textual?'
        this.actionDialog.commentLabel = 'Despacho de Revalidação (Opcional)'
        this.actionDialog.commentPlaceholder = 'Ex: Normativo verificado e mantido em vigor conforme legislação atual...'
        this.actionDialog.icon = 'mdi-refresh'
        this.actionDialog.headerClass = 'detran-header-teal'
        this.actionDialog.confirmColor = 'teal darken-1'
      }

      this.actionDialog.visible = true
    },

    async executeAction() {
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
          const data = res?.data?.workflow?.requestChanges
          if (data?.responseResult?.succeeded) {
            this.draft.state = 'changes_requested'
            this.$store.commit('pushNotification', {
              type: 'success',
              message: 'Ajustes solicitados ao autor com sucesso.'
            })
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = data?.responseResult?.message || 'Falha ao solicitar ajustes.'
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
          const data = res?.data?.workflow?.approveStep
          if (data?.responseResult?.succeeded) {
            this.draft.state = data?.draft?.state || 'awaiting_approval'
            this.$store.commit('pushNotification', {
              type: 'success',
              message: 'Revisão técnica aprovada. Documento encaminhado para Homologação Final.'
            })
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = data?.responseResult?.message || 'Falha ao aprovar etapa.'
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
          const data = res?.data?.workflow?.publish
          if (data?.responseResult?.succeeded) {
            this.draft.state = 'published'
            this.draft.pageId = data.pageId || this.draft.pageId
            this.$store.commit('pushNotification', {
              type: 'success',
              message: 'Documento homologado e publicado oficialmente na Intranet Detran-MG!'
            })
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = data?.responseResult?.message || 'Falha ao homologar e publicar.'
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
          const data = res?.data?.workflow?.revalidate
          if (data?.responseResult?.succeeded) {
            this.draft.state = data.draft?.state || 'published'
            this.draft.reviewDueDate = data.draft?.reviewDueDate
            this.$store.commit('pushNotification', {
              type: 'success',
              message: 'Vigência revalidada por mais 12 meses com sucesso.'
            })
            this.actionDialog.visible = false
          } else {
            this.actionDialog.error = data?.responseResult?.message || 'Falha ao revalidar vigência.'
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
.detran-workflow-review {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f7f9fa;
}

.detran-review-header {
  border-bottom: 1px solid #e0e0e0;
  background-color: #ffffff;
}

.detran-header-title {
  display: flex;
  flex-direction: column;
}

.detran-overline {
  color: #288b4a;
  letter-spacing: 1px;
}

.detran-doc-title {
  color: #1a472a;
  line-height: 1.2;
}

.detran-diff-toolbar {
  border-bottom: 1px solid #e4e7eb;
}

.detran-review-workspace {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.detran-diff-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #f8fafc;

  .d2h-wrapper {
    background-color: #ffffff;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .d2h-file-header {
    background-color: #f1f8f4;
    border-bottom: 1px solid #d4e7db;
  }

  .d2h-code-linenumber {
    cursor: pointer;
    user-select: none;

    &:hover {
      background-color: #cbe7d6 !important;
      color: #1a472a !important;
      font-weight: bold;
    }
  }
}

.detran-comments-sidebar {
  width: 380px;
  border-left: 1px solid #e0e0e0;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.04);
}

.detran-actions-bar {
  background-color: #ffffff;
  z-index: 10;
}

.detran-btn-primary {
  background-color: #288b4a !important;
}

.detran-btn-success {
  background-color: #1e6b37 !important;
}

.detran-dialog-title {
  color: #ffffff;

  &.detran-header-primary {
    background-color: #288b4a;
  }

  &.detran-header-success {
    background-color: #1e6b37;
  }

  &.detran-header-warning {
    background-color: #d97706;
  }

  &.detran-header-teal {
    background-color: #0d9488;
  }
}

.detran-btn-teal {
  background-color: #0d9488 !important;
}
</style>

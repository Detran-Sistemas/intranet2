<template lang='pug'>
  .detran-workflow-dashboard
    //- Banner Institucional Detran-MG
    v-sheet.detran-dashboard-hero(color='white', flat)
      v-container.py-6
        v-row(align='center')
          v-col(cols='12', md='8')
            .d-flex.align-center
              v-avatar(size='48', color='green lighten-5', class='mr-4 detran-hero-avatar')
                v-icon(color='primary', size='32') mdi-clipboard-flow-outline
              div
                .overline.detran-green-text GOVERNANÇA & FLUXO DE APROVAÇÃO
                .headline.font-weight-bold.detran-hero-title Central de Tarefas Institucional
                .caption.grey--text.text--darken-1
                  | Gestão de rascunhos, revisões técnicas e homologações oficiais da Intranet Detran-MG
          v-col.text-md-right(cols='12', md='4')
            v-btn(
              outlined
              color='grey darken-2'
              class='mr-2'
              :loading='loading'
              @click='loadDashboardData'
            )
              v-icon(left, small) mdi-refresh
              | Atualizar Fila
            v-btn(
              depressed
              color='primary'
              class='white--text detran-btn-primary'
              to='/e'
            )
              v-icon(left, small) mdi-plus
              | Novo Documento

    //- Cards de Indicadores (KPIs)
    v-container.pt-4.pb-2
      v-row(dense)
        //- KPI 1: Pendências
        v-col(cols='12', sm='4')
          v-card.detran-kpi-card(outlined, :class='{ "has-pending": stats.pendingCount > 0 }', @click='activeTab = 0')
            v-card-text.d-flex.align-center.pa-4
              v-avatar(size='48', :color='stats.pendingCount > 0 ? "amber lighten-4" : "grey lighten-3"', class='mr-3')
                v-icon(:color='stats.pendingCount > 0 ? "amber darken-4" : "grey darken-1"') mdi-bell-ring-outline
              div
                .display-1.font-weight-bold(:class='stats.pendingCount > 0 ? "amber--text text--darken-4" : "grey--text text--darken-2"')
                  | {{ stats.pendingCount }}
                .caption.font-weight-medium.grey--text.text--darken-2 Minhas Pendências de Revisão
              v-spacer
              v-icon(small, color='grey') mdi-chevron-right

        //- KPI 2: Meus Rascunhos
        v-col(cols='12', sm='4')
          v-card.detran-kpi-card(outlined, @click='activeTab = 1')
            v-card-text.d-flex.align-center.pa-4
              v-avatar(size='48', color='blue lighten-5', class='mr-3')
                v-icon(color='blue darken-3') mdi-file-document-edit-outline
              div
                .display-1.font-weight-bold.blue--text.text--darken-3
                  | {{ stats.myDraftsCount }}
                .caption.font-weight-medium.grey--text.text--darken-2 Meus Documentos em Tramitação
              v-spacer
              v-icon(small, color='grey') mdi-chevron-right

        //- KPI 3: Normativos a Vencer
        v-col(cols='12', sm='4')
          v-card.detran-kpi-card(outlined, :class='{ "has-expiring": stats.expiringCount > 0 }', @click='activeTab = 2')
            v-card-text.d-flex.align-center.pa-4
              v-avatar(size='48', :color='stats.expiringCount > 0 ? "deep-orange lighten-5" : "grey lighten-3"', class='mr-3')
                v-icon(:color='stats.expiringCount > 0 ? "deep-orange darken-3" : "grey darken-1"') mdi-clock-alert-outline
              div
                .display-1.font-weight-bold(:class='stats.expiringCount > 0 ? "deep-orange--text text--darken-3" : "grey--text text--darken-2"')
                  | {{ stats.expiringCount }}
                .caption.font-weight-medium.grey--text.text--darken-2 Normativos a Vencer (Revisão Periódica)
              v-spacer
              v-icon(small, color='grey') mdi-chevron-right

    //- Painel Principal com Abas
    v-container.pt-2.pb-8
      v-card(outlined, class='detran-main-card')
        //- Toolbar com Abas e Busca
        v-toolbar(flat, color='white', class='px-2')
          v-tabs(v-model='activeTab', color='primary', slider-color='primary')
            v-tab
              v-icon(left, small) mdi-tray-full
              | Minhas Pendências
              v-chip.ml-2(
                x-small
                :color='stats.pendingCount > 0 ? "amber lighten-4" : "grey lighten-3"'
                :text-color='stats.pendingCount > 0 ? "amber darken-4" : "grey darken-2"'
              ) {{ stats.pendingCount }}

            v-tab
              v-icon(left, small) mdi-file-document-multiple-outline
              | Meus Rascunhos / Enviados
              v-chip.ml-2(x-small, color='grey lighten-3', text-color='grey darken-2') {{ stats.myDraftsCount }}

            v-tab
              v-icon(left, small) mdi-shield-refresh-outline
              | Normativos a Vencer
              v-chip.ml-2(
                x-small
                :color='stats.expiringCount > 0 ? "deep-orange lighten-5" : "grey lighten-3"'
                :text-color='stats.expiringCount > 0 ? "deep-orange darken-3" : "grey darken-2"'
              ) {{ stats.expiringCount }}

          v-spacer

          //- Busca rápida na aba
          v-text-field.ml-4(
            v-model='searchFilter'
            label='Filtrar documentos...'
            dense
            outlined
            single-line
            hide-details
            prepend-inner-icon='mdi-magnify'
            clearable
            style='max-width: 280px;'
          )

        v-divider

        //- Carregando
        v-progress-linear(v-if='loading', indeterminate, color='primary')

        //- Conteúdo das Abas
        v-tabs-items(v-model='activeTab')
          //- =====================================
          //- ABA 1: MINHAS PENDÊNCIAS
          //- =====================================
          v-tab-item
            .pa-4
              template(v-if='filteredPendingTasks.length === 0')
                v-card.pa-8.text-center(flat, color='transparent')
                  v-icon(size='64', color='green lighten-2') mdi-check-circle-outline
                  .headline.font-weight-bold.detran-green-text.mt-3 Nenhuma Pendência Atribuída
                  .body-2.grey--text.mt-1
                    | Você está em dia! Não há documentos aguardando sua revisão técnica ou homologação.
                  .mt-4
                    v-btn(outlined, color='primary', small, @click='loadDashboardData')
                      v-icon(left, small) mdi-refresh
                      | Verificar Novamente

              template(v-else)
                v-card.mb-3(
                  v-for='draft in filteredPendingTasks'
                  :key='draft.id'
                  outlined
                  class='detran-task-item-card'
                )
                  v-card-text.pa-4
                    v-row(align='center')
                      v-col(cols='12', md='8')
                        .d-flex.align-center.mb-1
                          v-chip(
                            label
                            x-small
                            :color='getStateBadge(draft.state).color'
                            :text-color='getStateBadge(draft.state).textColor'
                            class='font-weight-bold mr-2 text-uppercase'
                          )
                            | {{ getStateBadge(draft.state).label }}

                          v-chip(
                            x-small
                            outlined
                            color='grey darken-1'
                            class='mr-2'
                          )
                            span(v-if='draft.approvalMode === "2_levels"') Nível {{ draft.currentLevel }} de 2
                            span(v-else) Nível Único

                          span.caption.grey--text /{{ draft.locale }}/{{ draft.path }}

                        .title.font-weight-bold.detran-title.mb-1
                          | {{ draft.title }}

                        .body-2.grey--text.text--darken-2.text-truncate(v-if='draft.description')
                          | {{ draft.description }}

                        .caption.grey--text.mt-2
                          v-icon(x-small, class='mr-1') mdi-account-circle-outline
                          | Autor: #[strong {{ draft.authorName || 'Servidor' }}]
                          span.mx-2 •
                          v-icon(x-small, class='mr-1') mdi-calendar-clock
                          | Submetido em: {{ draft.updatedAt | moment('DD/MM/YYYY [às] HH:mm') }}
                          span.mx-2(v-if='draft.comments && draft.comments.length') •
                          span(v-if='draft.comments && draft.comments.length')
                            v-icon(x-small, class='mr-1', color='amber darken-3') mdi-comment-multiple-outline
                            | {{ draft.comments.length }} anotação(ões)

                      v-col.text-md-right(cols='12', md='4')
                        v-btn(
                          depressed
                          color='primary'
                          class='white--text detran-btn-primary'
                          :to='`/w/review/${draft.id}`'
                        )
                          v-icon(left, small) mdi-file-find-outline
                          | Analisar e Revisar

          //- =====================================
          //- ABA 2: MEUS RASCUNHOS / ENVIADOS
          //- =====================================
          v-tab-item
            .pa-4
              template(v-if='filteredMyDrafts.length === 0')
                v-card.pa-8.text-center(flat, color='transparent')
                  v-icon(size='64', color='grey lighten-1') mdi-file-document-outline
                  .headline.grey--text.text--darken-2.mt-3 Nenhum Rascunho Registrado
                  .body-2.grey--text.mt-1
                    | Você ainda não possui documentos em tramitação. Comece criando um novo rascunho institucional!
                  .mt-4
                    v-btn(depressed, color='primary', to='/e', class='white--text detran-btn-primary')
                      v-icon(left, small) mdi-plus
                      | Iniciar Novo Documento

              template(v-else)
                v-card.mb-3(
                  v-for='draft in filteredMyDrafts'
                  :key='draft.id'
                  outlined
                  :class='["detran-task-item-card", { "is-alert": draft.state === "changes_requested" }]'
                )
                  v-card-text.pa-4
                    v-row(align='center')
                      v-col(cols='12', md='8')
                        .d-flex.align-center.mb-1
                          v-chip(
                            label
                            x-small
                            :color='getStateBadge(draft.state).color'
                            :text-color='getStateBadge(draft.state).textColor'
                            class='font-weight-bold mr-2 text-uppercase'
                          )
                            | {{ getStateBadge(draft.state).label }}

                          span.caption.grey--text /{{ draft.locale }}/{{ draft.path }}

                        .title.font-weight-bold.detran-title.mb-1
                          | {{ draft.title }}

                        //- Alerta em caso de ajustes solicitados
                        v-alert(
                          v-if='draft.state === "changes_requested"'
                          type='warning'
                          dense
                          outlined
                          class='my-2 py-1 caption'
                        )
                          | O revisor solicitou correções neste documento. Clique abaixo para editar e reenviar.

                        .caption.grey--text.mt-1
                          v-icon(x-small, class='mr-1') mdi-calendar-clock
                          | Última alteração: {{ draft.updatedAt | moment('DD/MM/YYYY [às] HH:mm') }}
                          span.mx-2 •
                          span(v-if='draft.approvalMode === "2_levels"') Fluxo: 2 Níveis
                          span(v-else) Fluxo: 1 Nível

                      v-col.text-md-right(cols='12', md='4')
                        //- Se estiver em ajustes ou rascunho: ação no editor
                        v-btn(
                          v-if='draft.state === "changes_requested"'
                          depressed
                          color='orange darken-3'
                          class='white--text mr-2'
                          :href='`/e/${draft.locale}/${draft.path}`'
                        )
                          v-icon(left, small) mdi-pencil
                          | Editar e Corrigir

                        v-btn(
                          v-else-if='draft.state === "draft"'
                          outlined
                          color='primary'
                          class='mr-2'
                          :href='`/e/${draft.locale}/${draft.path}`'
                        )
                          v-icon(left, small) mdi-pencil-outline
                          | Continuar Edição

                        //- Botão para acompanhar revisão
                        v-btn(
                          v-if='draft.state !== "draft"'
                          outlined
                          color='grey darken-2'
                          :to='`/w/review/${draft.id}`'
                        )
                          v-icon(left, small) mdi-eye-outline
                          | Acompanhar

          //- =====================================
          //- ABA 3: NORMATIVOS A VENCER
          //- =====================================
          v-tab-item
            .pa-4
              v-alert(color='green lighten-5', dense, outlined, class='mb-4')
                .d-flex.align-center
                  v-icon(color='primary', class='mr-2') mdi-shield-check-outline
                  .caption.detran-green-text
                    strong Política de Governança Detran-MG:
                    | &nbsp;Instruções e portarias exigem revisão anual de vigência (ciclo de 12 meses) para garantir alinhamento com a legislação vigente.

              template(v-if='filteredExpiringNorms.length === 0')
                v-card.pa-8.text-center(flat, color='transparent')
                  v-icon(size='64', color='green lighten-2') mdi-shield-check
                  .headline.font-weight-bold.detran-green-text.mt-3 Todos os Normativos Vigentes
                  .body-2.grey--text.mt-1
                    | Não há atos normativos ou resoluções com revisão periódica pendente ou vencendo nos próximos 60 dias.

              template(v-else)
                v-card.mb-3(
                  v-for='norm in filteredExpiringNorms'
                  :key='norm.id'
                  outlined
                  class='detran-task-item-card'
                )
                  v-card-text.pa-4
                    v-row(align='center')
                      v-col(cols='12', md='8')
                        .d-flex.align-center.mb-1
                          v-chip(
                            small
                            label
                            :color='getNormUrgency(norm.reviewDueDate).color'
                            text-color='white'
                            class='font-weight-bold mr-2'
                          )
                            v-icon(left, x-small) mdi-clock-outline
                            | {{ getNormUrgency(norm.reviewDueDate).label }}

                          span.caption.grey--text /{{ norm.locale }}/{{ norm.path }}

                        .title.font-weight-bold.detran-title.mb-1
                          | {{ norm.title }}

                        .caption.grey--text.mt-1
                          v-icon(x-small, class='mr-1') mdi-calendar-range
                          | Vencimento do ciclo: {{ norm.reviewDueDate | moment('DD/MM/YYYY') }}
                          span.mx-2 •
                          v-icon(x-small, class='mr-1') mdi-account-circle-outline
                          | Responsável: {{ norm.authorName || 'Área Técnica' }}

                      v-col.text-md-right(cols='12', md='4')
                        v-btn.mr-2(
                          depressed
                          color='primary'
                          class='white--text detran-btn-primary'
                          :to='`/w/review/${norm.id}`'
                        )
                          v-icon(left, small) mdi-file-find-outline
                          | Revisar

                        v-btn(
                          outlined
                          color='green darken-2'
                          @click='openRevalidateDialog(norm)'
                        )
                          v-icon(left, small) mdi-autorenew
                          | Revalidar +12m

    //- Modal de Revalidação de Normativo
    v-dialog(v-model='revalidateDialog.visible', max-width='550', persistent)
      v-card
        v-card-title.headline.font-weight-bold.detran-revalidate-header
          v-icon(left, color='white') mdi-autorenew
          | Revalidação de Vigência Normativa

        v-card-text.pt-4
          p.body-2.grey--text.text--darken-3
            | Confirma a renovação da vigência do documento #[strong {{ revalidateDialog.norm ? revalidateDialog.norm.title : '' }}] por mais 12 meses?
          v-textarea(
            v-model='revalidateDialog.comment'
            label='Despacho / Parecer de Revalidação'
            outlined
            dense
            rows='3'
            placeholder='Ex: Normativo verificado em conformidade técnica sem necessidade de alterações textuais.'
          )

        v-card-actions.px-4.pb-4.pt-0
          v-spacer
          v-btn(text, color='grey darken-2', @click='revalidateDialog.visible = false', :disabled='revalidating') Cancelar
          v-btn(
            depressed
            color='success'
            class='white--text detran-btn-success'
            :loading='revalidating'
            @click='executeRevalidate'
          )
            v-icon(left, small) mdi-check
            | Confirmar Renovação

</template>

<script>
import gql from 'graphql-tag'
import {
  getUrgencyLevel,
  getDraftActionRoute,
  calculateDashboardStats
} from '../../store/detran-workflow-dashboard'

export default {
  name: 'WorkflowDashboard',
  data() {
    return {
      loading: false,
      activeTab: 0,
      searchFilter: '',
      revalidating: false,
      revalidateDialog: {
        visible: false,
        norm: null,
        comment: ''
      },
      pendingTasks: [],
      myDrafts: [],
      expiringNorms: []
    }
  },
  computed: {
    stats() {
      return calculateDashboardStats({
        pendingTasks: this.pendingTasks,
        myDrafts: this.myDrafts,
        expiringNorms: this.expiringNorms
      })
    },

    filteredPendingTasks() {
      return this.filterBySearch(this.pendingTasks)
    },

    filteredMyDrafts() {
      return this.filterBySearch(this.myDrafts)
    },

    filteredExpiringNorms() {
      return this.filterBySearch(this.expiringNorms)
    }
  },
  mounted() {
    this.loadDashboardData()
  },
  methods: {
    filterBySearch(list) {
      if (!this.searchFilter || !this.searchFilter.trim()) {
        return list
      }
      const q = this.searchFilter.toLowerCase().trim()
      return list.filter(
        item =>
          (item.title && item.title.toLowerCase().includes(q)) ||
          (item.path && item.path.toLowerCase().includes(q)) ||
          (item.authorName && item.authorName.toLowerCase().includes(q))
      )
    },

    getNormUrgency(dueDate) {
      return getUrgencyLevel(dueDate)
    },

    getStateBadge(state) {
      switch (state) {
        case 'in_review':
          return { label: 'Em Revisão', color: 'blue lighten-5', textColor: 'blue darken-3' }
        case 'awaiting_approval':
        case 'in_approval_step2':
          return { label: 'Aguardando Homologação', color: 'teal lighten-5', textColor: 'teal darken-3' }
        case 'changes_requested':
          return { label: 'Ajustes Solicitados', color: 'amber lighten-5', textColor: 'amber darken-4' }
        case 'published':
          return { label: 'Publicado', color: 'green lighten-5', textColor: 'green darken-4' }
        case 'periodic_review':
          return { label: 'Revisão Periódica', color: 'deep-orange lighten-5', textColor: 'deep-orange darken-3' }
        default:
          return { label: state || 'Rascunho', color: 'grey lighten-3', textColor: 'grey darken-3' }
      }
    },

    async loadDashboardData() {
      this.loading = true
      const currentUserId = this.$store?.get('user/id') || null

      try {
        const result = await this.$apollo.query({
          query: gql`
            query ($authorId: Int) {
              workflow {
                pendingTasks {
                  id
                  pageId
                  path
                  locale
                  title
                  description
                  state
                  approvalMode
                  currentLevel
                  authorId
                  authorName
                  reviewDueDate
                  updatedAt
                  comments {
                    id
                    resolved
                  }
                }
                drafts(authorId: $authorId) {
                  id
                  pageId
                  path
                  locale
                  title
                  description
                  state
                  approvalMode
                  currentLevel
                  authorId
                  authorName
                  reviewDueDate
                  updatedAt
                  comments {
                    id
                    resolved
                  }
                }
                expiring: drafts(state: "periodic_review") {
                  id
                  pageId
                  path
                  locale
                  title
                  description
                  state
                  approvalMode
                  currentLevel
                  authorId
                  authorName
                  reviewDueDate
                  updatedAt
                }
              }
            }
          `,
          variables: {
            authorId: currentUserId
          },
          fetchPolicy: 'network-only'
        })

        const data = result?.data?.workflow
        if (data) {
          this.pendingTasks = data.pendingTasks || []
          this.myDrafts = data.drafts || []
          this.expiringNorms = data.expiring || []

          // Notifica o nav-header para atualizar badge do sininho
          this.$root.$emit('workflowRefreshTasks')
        }
      } catch (err) {
        this.$store.commit('pushNotification', {
          type: 'error',
          message: err.message || 'Erro ao carregar dados da Central de Tarefas.'
        })
      } finally {
        this.loading = false
      }
    },

    openRevalidateDialog(norm) {
      this.revalidateDialog.norm = norm
      this.revalidateDialog.comment = ''
      this.revalidateDialog.visible = true
    },

    async executeRevalidate() {
      if (!this.revalidateDialog.norm) return

      this.revalidating = true
      try {
        const result = await this.$apollo.mutate({
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
          variables: {
            id: this.revalidateDialog.norm.id,
            comment: this.revalidateDialog.comment.trim() || null
          }
        })

        const res = result?.data?.workflow?.revalidate
        if (res?.responseResult?.succeeded) {
          this.$store.commit('pushNotification', {
            type: 'success',
            message: 'Vigência do normativo renovada por mais 12 meses com sucesso!'
          })
          this.revalidateDialog.visible = false
          await this.loadDashboardData()
        } else {
          this.$store.commit('pushNotification', {
            type: 'error',
            message: res?.responseResult?.message || 'Falha ao revalidar normativo.'
          })
        }
      } catch (err) {
        this.$store.commit('pushNotification', {
          type: 'error',
          message: err.message || 'Erro inesperado na revalidação.'
        })
      } finally {
        this.revalidating = false
      }
    }
  }
}
</script>

<style lang='scss' scoped>
.detran-workflow-dashboard {
  background-color: #f7f9fa;
  min-height: 100vh;
}

.detran-dashboard-hero {
  border-bottom: 1px solid #e2e8f0;
}

.detran-green-text {
  color: #1a472a;
  letter-spacing: 0.5px;
}

.detran-hero-title {
  color: #1a472a;
}

.detran-hero-avatar {
  border: 1px solid #cde4d6;
}

.detran-kpi-card {
  border-radius: 8px;
  background-color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    border-color: #288b4a;
  }

  &.has-pending {
    border-left: 4px solid #f59e0b;
  }

  &.has-expiring {
    border-left: 4px solid #ea580c;
  }
}

.detran-main-card {
  border-radius: 8px;
  background-color: #ffffff;
}

.detran-task-item-card {
  border-radius: 6px;
  background-color: #ffffff;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    border-color: #cbd5e1;
  }

  &.is-alert {
    border-left: 4px solid #f59e0b;
    background-color: #fffdfa;
  }
}

.detran-title {
  color: #1e293b;
}

.detran-btn-primary {
  background-color: #288b4a !important;
}

.detran-btn-success {
  background-color: #1e6b37 !important;
}

.detran-revalidate-header {
  background-color: #288b4a;
  color: #ffffff;
}
</style>

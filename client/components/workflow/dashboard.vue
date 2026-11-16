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
              href='/'
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
                .caption.font-weight-medium.grey--text.text--darken-2 Aguardando Minha Ação
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
          v-tabs(v-model='activeTab', color='primary', slider-color='primary', show-arrows)
            v-tab
              v-icon(left, small) mdi-tray-full
              | Aguardando Minha Ação
              v-chip.ml-2(
                x-small
                :color='stats.pendingCount > 0 ? "amber lighten-4" : "grey lighten-3"'
                :text-color='stats.pendingCount > 0 ? "amber darken-4" : "grey darken-2"'
              ) {{ stats.pendingCount }}

            v-tab
              v-icon(left, small) mdi-file-document-multiple-outline
              | Meus Documentos Enviados
              v-chip.ml-2(x-small, color='grey lighten-3', text-color='grey darken-2') {{ stats.myDraftsCount }}

            v-tab
              v-icon(left, small) mdi-shield-refresh-outline
              | Histórico / Publicados &amp; Normativos
              v-chip.ml-2(
                x-small
                :color='stats.expiringCount > 0 ? "deep-orange lighten-5" : "grey lighten-3"'
                :text-color='stats.expiringCount > 0 ? "deep-orange darken-3" : "grey darken-2"'
              ) {{ stats.expiringCount + historyDrafts.length }}

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
                          :to='`/review/${draft.id}`'
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
                    v-btn(depressed, color='primary', href='/', class='white--text detran-btn-primary')
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
                      v-col(cols='12', md='7')
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

                      v-col(cols='12', md='5')
                        .detran-task-actions
                          //- Rascunho ou devolvido com ajustes: permite edição direta
                          v-btn(
                            v-if='tab2Actions(draft).canEdit'
                            :class='["detran-wf-btn", draft.state === "changes_requested" ? "detran-wf-btn--warn" : "detran-wf-btn--edit"]'
                            depressed
                            :to='tab2Actions(draft).editRoute'
                          )
                            v-icon(left, size='16') mdi-pencil-outline
                            span {{ tab2Actions(draft).editLabel }}

                          //- Em revisão / homologação: autor acompanha ou puxa de volta para editar
                          v-btn.detran-wf-btn.detran-wf-btn--warn(
                            v-if='tab2Actions(draft).canRetract'
                            depressed
                            @click='openRetractDialog(draft)'
                          )
                            v-icon(left, size='16') mdi-undo-variant
                            span {{ tab2Actions(draft).retractLabel }}

                          //- Acompanhar revisão / documento
                          v-btn.detran-wf-btn.detran-wf-btn--track(
                            v-if='tab2Actions(draft).canTrack'
                            depressed
                            :to='tab2Actions(draft).trackRoute'
                          )
                            v-icon(left, size='16') mdi-eye-outline
                            span {{ tab2Actions(draft).trackLabel }}

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
                          :to='`/review/${norm.id}`'
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

              v-divider.my-6

              //- Seção de Histórico do Autor (Publicados & Arquivados)
              .d-flex.align-center.mb-3
                v-icon(color='primary', class='mr-2') mdi-history
                .subtitle-1.font-weight-bold.detran-green-text Histórico de Meus Documentos Publicados e Arquivados

              template(v-if='filteredHistoryDrafts.length === 0')
                v-card.pa-6.text-center(flat, color='grey lighten-5')
                  .body-2.grey--text.text--darken-1
                    | Nenhum documento publicado ou arquivado encontrado no seu histórico.

              template(v-else)
                v-card.mb-3(
                  v-for='item in filteredHistoryDrafts'
                  :key='"hist-" + item.id'
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
                            :color='getStateBadge(item.state).color'
                            :text-color='getStateBadge(item.state).textColor'
                            class='font-weight-bold mr-2 text-uppercase'
                          )
                            | {{ getStateBadge(item.state).label }}

                          span.caption.grey--text /{{ item.locale }}/{{ item.path }}

                        .title.font-weight-bold.detran-title.mb-1
                          | {{ item.title }}

                        .caption.grey--text.mt-1
                          v-icon(x-small, class='mr-1') mdi-calendar-check
                          | Atualizado em: {{ item.updatedAt | moment('DD/MM/YYYY [às] HH:mm') }}

                      v-col.text-md-right(cols='12', md='4')
                        v-btn.detran-wf-btn.detran-wf-btn--edit.mr-2(
                          v-if='item.state === "published" && item.path'
                          depressed
                          :href='`/${item.locale || "pt-br"}/${item.path}`'
                        )
                          v-icon(left, size='16') mdi-open-in-new
                          span Ver Página

                        v-btn.detran-wf-btn.detran-wf-btn--track(
                          depressed
                          :to='`/review/${item.id}`'
                        )
                          v-icon(left, size='16') mdi-history
                          span Histórico

    //- Modal para Puxar Documento de Volta para Edição (Retração)
    v-dialog(v-model='retractDialog.visible', max-width='520', persistent)
      v-card
        v-card-title.headline.font-weight-bold.detran-revalidate-header
          v-icon(left, color='white') mdi-undo-variant
          | Puxar de Volta para Edição

        v-card-text.pt-4
          p.body-2.grey--text.text--darken-3
            | Ao puxar #[strong {{ retractDialog.draft ? retractDialog.draft.title : '' }}] de volta, o documento sairá da fila de revisão e retornará para Rascunho para sua edição.
          v-textarea(
            v-model='retractDialog.comment'
            label='Motivo da Retirada (Opcional)'
            outlined
            dense
            rows='2'
            placeholder='Ex: Complementar item normativo antes da revisão...'
          )

        v-card-actions.px-4.pb-4.pt-0
          v-spacer
          v-btn(text, color='grey darken-2', @click='retractDialog.visible = false', :disabled='retracting') Cancelar
          v-btn(
            depressed
            color='amber darken-3'
            class='white--text'
            :loading='retracting'
            @click='executeRetract'
          )
            v-icon(left, small) mdi-undo-variant
            span Confirmar Retirada

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
  calculateDashboardStats,
  partitionDashboardDrafts,
  getTab2DraftActions
} from '../../store/detran-workflow-dashboard'
/*
  getUrgencyLevel,
  calculateDashboardStats
  calculateDashboardStats
*/

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
      historyDrafts: [],
      expiringNorms: [],
      retracting: false,
      retractDialog: {
        visible: false,
        draft: null,
        comment: ''
      }
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
    },

    filteredHistoryDrafts() {
      return this.filterBySearch(this.historyDrafts)
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
        case 'archived':
          return { label: 'Arquivado', color: 'grey lighten-3', textColor: 'grey darken-3' }
        case 'periodic_review':
          return { label: 'Revisão Periódica', color: 'deep-orange lighten-5', textColor: 'deep-orange darken-3' }
        default:
          return { label: state || 'Rascunho', color: 'grey lighten-3', textColor: 'grey darken-3' }
      }
    },

    async loadDashboardData() {
      this.loading = true
      const rawId = this.$store?.get('user/id') || null
      const currentUserId = rawId ? parseInt(rawId, 10) : null

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
          const partitioned = partitionDashboardDrafts({
            pendingTasks: data.pendingTasks || [],
            myDrafts: data.drafts || [],
            expiringNorms: data.expiring || [],
            currentUserId
          })
          this.pendingTasks = partitioned.pendingTasks
          this.myDrafts = partitioned.activeDrafts
          this.historyDrafts = partitioned.historyDrafts
          this.expiringNorms = partitioned.expiringNorms

          // Se o usuário não tiver pendências de ação a fazer,
          // mas tiver documentos enviados/rascunhos ativos, abre diretamente a aba "Meus Documentos Enviados"
          if (this.pendingTasks.length === 0 && this.myDrafts.length > 0 && this.activeTab === 0) {
            this.activeTab = 1
          }

          // Notifica o nav-header para atualizar badge do sininho
          /* eslint-disable-next-line vue/custom-event-name-casing */
          this.$root.$emit('workflowRefreshTasks')
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
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
          this.$store.commit('showNotification', {
            style: 'success',
            icon: 'check',
            message: 'Vigência do normativo renovada por mais 12 meses com sucesso!'
          })
          this.revalidateDialog.visible = false
          await this.loadDashboardData()
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            icon: 'alert',
            message: res?.responseResult?.message || 'Falha ao revalidar normativo.'
          })
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: err.message || 'Erro inesperado na revalidação.'
        })
      } finally {
        this.revalidating = false
      }
    },

    tab2Actions(draft) {
      return getTab2DraftActions(draft, { routePrefix: '/review' })
    },

    openRetractDialog(draft) {
      this.retractDialog.draft = draft
      this.retractDialog.comment = ''
      this.retractDialog.visible = true
    },

    async executeRetract() {
      if (!this.retractDialog.draft) return

      this.retracting = true
      try {
        const result = await this.$apollo.mutate({
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
          variables: {
            id: this.retractDialog.draft.id,
            comment: this.retractDialog.comment.trim() || null
          }
        })

        const res = result?.data?.workflow?.retract
        if (res?.responseResult?.succeeded) {
          this.$store.commit('showNotification', {
            style: 'success',
            icon: 'check',
            message: 'Documento retornado para rascunho. Modo de edição liberado!'
          })
          this.retractDialog.visible = false
          await this.loadDashboardData()
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            icon: 'alert',
            message: res?.responseResult?.message || 'Falha ao puxar documento de volta para edição.'
          })
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          icon: 'alert',
          message: err.message || 'Erro inesperado ao retirar documento.'
        })
      } finally {
        this.retracting = false
      }
    }
  }
}
</script>

<style lang='scss' scoped>
.detran-workflow-dashboard {
  background-color: transparent;
  width: 100%;
  min-height: 100vh;
}

.detran-dashboard-hero {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
  margin-bottom: 12px;
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
  border-radius: 16px !important;
  border-color: #e2e8f0 !important;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
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
  border-radius: 16px !important;
  border-color: #e2e8f0 !important;
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
  background-color: #ffffff;

  .v-toolbar {
    height: auto !important;
    min-height: 56px;

    .v-toolbar__content {
      flex-wrap: wrap !important;
      height: auto !important;
      min-height: 56px !important;
      gap: 8px;
      padding-top: 6px;
      padding-bottom: 6px;
    }
  }

  @media (max-width: 1050px) {
    .v-text-field {
      max-width: 100% !important;
      width: 100% !important;
      margin-left: 0 !important;
      margin-top: 8px !important;
    }
  }
}

.detran-task-item-card {
  border-radius: 12px !important;
  border-color: #e2e8f0 !important;
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

.detran-task-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;

  @media (max-width: 959px) {
    justify-content: flex-start;
  }
}

.detran-wf-btn {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 16px !important;
  border-radius: 10px !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  text-transform: none !important;
  letter-spacing: -0.01em !important;
  box-shadow: none !important;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;

  ::v-deep .v-icon {
    color: inherit !important;
    transition: transform 0.18s ease !important;
  }

  &--warn {
    background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%) !important;
    color: #ffffff !important;
    border: 1px solid rgba(194, 65, 12, 0.9) !important;
    box-shadow: 0 2px 8px rgba(234, 88, 12, 0.24) !important;

    &:hover {
      background: linear-gradient(135deg, #c2410c 0%, #9a3412 100%) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.34) !important;
    }
  }

  &--edit {
    background: #f0fdf4 !important;
    color: #1b6535 !important;
    border: 1px solid #bbf7d0 !important;
    box-shadow: 0 1px 2px rgba(27, 101, 53, 0.06) !important;

    &:hover {
      background: #1b6535 !important;
      color: #ffffff !important;
      border-color: #1b6535 !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(27, 101, 53, 0.22) !important;
    }
  }

  &--track {
    background: #ffffff !important;
    color: #334155 !important;
    border: 1px solid #cbd5e1 !important;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05) !important;

    &:hover {
      background: #f8fafc !important;
      color: #1b6535 !important;
      border-color: #86efac !important;
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08) !important;
    }
  }
}

.detran-revalidate-header {
  background-color: #288b4a;
  color: #ffffff;
}
</style>

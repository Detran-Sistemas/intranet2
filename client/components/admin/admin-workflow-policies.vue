<template lang='pug'>
v-container.detran-admin-workflow-policies(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      //- CABEÇALHO DA TELA
      .admin-header.d-flex.align-center.justify-space-between.mb-4
        .d-flex.align-center
          v-avatar(size='52', color='#e8f5e9').mr-3
            v-icon(color='#288b4a', size='32') mdi-source-branch
          .admin-header-title
            .headline.font-weight-bold.detran-text-primary Workflow & Governança • Detran-MG
            .subtitle-2.grey--text.text--darken-1 Parametrização de Políticas por Rota e Feature Flag de Contingência
        v-spacer
        v-btn(
          color='#288b4a'
          depressed
          dark
          large
          class='font-weight-bold'
          @click='openPolicyDialog(null)'
        )
          v-icon(left) mdi-plus
          | Nova Regra por Rota

      //- 1. CARD: CONTROLE DE CONTINGÊNCIA & FEATURE FLAG
      v-card.mb-4.elevation-1.detran-card-bordered(:class='$vuetify.theme.dark ? "grey darken-3" : "white"')
        v-card-title.subtitle-1.font-weight-bold.detran-section-title.d-flex.align-center.justify-space-between
          .d-flex.align-center
            v-icon(left, color='#288b4a') mdi-shield-airplane-outline
            span Controle de Contingência Operacional (Feature Flag)
          v-chip(
            small
            label
            :color='config.enabled ? "#288b4a" : "#dc2626"'
            text-color='white'
            class='font-weight-bold'
          )
            v-icon(left, small) {{ config.enabled ? 'mdi-check-decagram' : 'mdi-alert-octagon' }}
            | {{ config.enabled ? 'WORKFLOW ATIVO' : 'MODO CONTINGÊNCIA' }}

        v-divider

        v-card-text.pt-4
          v-alert(
            dense
            outlined
            :type='config.enabled ? "info" : "warning"'
            class='mb-4'
          )
            span(v-if='config.enabled')
              strong Operação Normal: 
              | O controle institucional de rascunhos, revisões em 1 ou 2 níveis e travas de publicação estão ativos.
            span(v-else)
              strong Atenção (Modo Contingência): 
              | O fluxo de governança está desativado temporariamente. As edições no portal são salvas diretamente sem exigência de revisão prévia.

          v-row
            v-col(cols='12', md='6')
              v-switch(
                v-model='config.enabled'
                color='#288b4a'
                inset
                :loading='loadingConfig'
                label='Ativar Módulo de Workflow Institucional (detranWorkflow.enabled)'
                messages='Permite desativação instantânea em caso de incidente ou contingência sem reiniciar o serviço.'
              )

            v-col(cols='12', md='6')
              v-text-field(
                v-model='config.teamsWebhookUrl'
                outlined
                dense
                label='Webhook do Microsoft Teams (Opcional)'
                placeholder='https://detranmg.webhook.office.com/webhookb2/...'
                prepend-inner-icon='mdi-microsoft-teams'
                hint='Canal institucional para recebimento automático dos cards de submissão e publicação'
                persistent-hint
              )

        v-card-actions.px-4.pb-4.pt-0
          v-spacer
          v-btn(
            depressed
            color='#288b4a'
            dark
            :loading='savingConfig'
            @click='saveConfig'
          )
            v-icon(left, small) mdi-content-save-check
            | Salvar Parâmetros Globais

      //- 2. CARD: MATRIZ DE POLÍTICAS POR PREFIXO DE CAMINHO
      v-card.elevation-1.detran-card-bordered(:class='$vuetify.theme.dark ? "grey darken-3" : "white"')
        v-card-title.subtitle-1.font-weight-bold.detran-section-title.d-flex.align-center.justify-space-between
          .d-flex.align-center
            v-icon(left, color='#288b4a') mdi-format-list-checks
            span Matriz de Políticas por Rota (Prefix Matching)
          v-text-field(
            v-model='search'
            append-icon='mdi-magnify'
            label='Filtrar rotas...'
            single-line
            hide-details
            dense
            outlined
            style='max-width: 280px;'
          )

        v-divider

        v-data-table(
          :headers='headers'
          :items='policies'
          :search='search'
          :loading='loadingPolicies'
          no-data-text='Nenhuma política customizada cadastrada. O sistema está aplicando a regra padrão (/).'
          class='elevation-0'
        )
          //- Coluna: Prefixo
          template(v-slot:item.pathPrefix='{ item }')
            .d-flex.align-center
              v-icon(small, color='#288b4a', class='mr-2') mdi-folder-network-outline
              code.font-weight-bold.detran-code-prefix {{ item.pathPrefix }}
              v-chip.ml-2(x-small, v-if='item.pathPrefix === "/"', color='grey lighten-2', text-color='grey darken-3') Padrão Global

          //- Coluna: Níveis de Homologação
          template(v-slot:item.approvalLevels='{ item }')
            v-chip(
              small
              label
              :color='item.approvalLevels === 2 ? "purple darken-1" : "blue darken-2"'
              text-color='white'
              class='font-weight-medium'
            )
              v-icon(left, x-small) {{ item.approvalLevels === 2 ? 'mdi-numeric-2-box-multiple' : 'mdi-numeric-1-box' }}
              | {{ item.approvalLevels === 2 ? '2 Níveis (Técnico + Final)' : '1 Nível (Revisão Direta)' }}

          //- Coluna: Ciclo de Vigência
          template(v-slot:item.reviewIntervalDays='{ item }')
            span.body-2(v-if='item.reviewIntervalDays > 0')
              strong {{ item.reviewIntervalDays }} dias 
              span.grey--text ({{ formatDaysToMonths(item.reviewIntervalDays) }})
            span.grey--text(v-else) Sem vencimento periódico

          //- Coluna: Ação ao Expirar
          template(v-slot:item.autoArchiveOnExpire='{ item }')
            v-chip(
              x-small
              outlined
              :color='item.autoArchiveOnExpire ? "deep-orange darken-2" : "teal darken-2"'
            )
              | {{ item.autoArchiveOnExpire ? 'Arquivamento Automático' : 'Revisão Periódica (+12m)' }}

          //- Coluna: Ações
          template(v-slot:item.actions='{ item }')
            .d-flex.align-center
              v-btn(icon, small, color='primary', @click='openPolicyDialog(item)', title='Editar Política')
                v-icon(small) mdi-pencil-outline
              v-btn(
                icon
                small
                color='red'
                :disabled='item.pathPrefix === "/"'
                @click='openDeleteDialog(item)'
                title='Excluir Política'
              )
                v-icon(small) mdi-trash-can-outline

  //- DIALOG: CRIAR / EDITAR POLÍTICA
  v-dialog(v-model='policyDialog.visible', max-width='560', persistent)
    v-card
      v-card-title.headline.font-weight-bold.white--text.detran-dialog-header
        v-icon(left, color='white') {{ policyDialog.isEditing ? 'mdi-pencil' : 'mdi-plus-box' }}
        | {{ policyDialog.isEditing ? 'Editar Política de Workflow' : 'Nova Política de Workflow' }}

      v-card-text.pt-5
        v-form(ref='policyForm', v-model='policyDialog.valid')
          v-text-field(
            v-model='policyDialog.form.pathPrefix'
            outlined
            dense
            label='Prefixo da Rota (Caminho)'
            placeholder='Ex: normativos, resolucoes/2026, comunicados'
            prefix='/'
            hint='A política será herdada por todos os documentos sob este prefixo.'
            persistent-hint
            :rules='[v => !!v || "O prefixo é obrigatório"]'
          )

          v-select.mt-4(
            v-model='policyDialog.form.approvalLevels'
            outlined
            dense
            label='Níveis de Homologação Obrigatórios'
            :items='approvalLevelOptions'
            item-text='text'
            item-value='value'
            hint='Define se a rota requer parecer técnico preliminar antes da homologação.'
            persistent-hint
          )

          v-text-field.mt-4(
            v-model.number='policyDialog.form.reviewIntervalDays'
            outlined
            dense
            type='number'
            label='Ciclo de Vigência Periódica (em dias)'
            hint='Informe o prazo para revalidação institucional (365 dias = 12 meses padrão).'
            persistent-hint
            suffix='dias'
            :messages='[formatDaysPreview(policyDialog.form.reviewIntervalDays)]'
            :rules='[v => v >= 0 || "O prazo deve ser maior ou igual a zero"]'
          )

          v-switch.mt-4(
            v-model='policyDialog.form.autoArchiveOnExpire'
            color='deep-orange darken-2'
            inset
            label='Arquivar automaticamente ao término da vigência'
            messages='Se desativado, o documento vai para Revisão Periódica permitindo revalidação por mais 12 meses.'
          )

      v-card-actions.px-4.pb-4.pt-0
        v-spacer
        v-btn(text, color='grey darken-2', @click='policyDialog.visible = false', :disabled='savingPolicy') Cancelar
        v-btn(
          depressed
          color='#288b4a'
          dark
          :loading='savingPolicy'
          @click='savePolicy'
        )
          v-icon(left, small) mdi-check
          | Salvar Política

  //- DIALOG: CONFIRMAÇÃO DE EXCLUSÃO
  v-dialog(v-model='deleteDialog.visible', max-width='420', persistent)
    v-card
      v-card-title.headline.font-weight-bold.red.white--text
        v-icon(left, color='white') mdi-alert-circle-outline
        | Remover Política
      v-card-text.pt-4
        | Tem certeza que deseja remover a política para o prefixo #[strong {{ deleteDialog.item ? deleteDialog.item.pathPrefix : '' }}]?
        .caption.grey--text.mt-2 Documentos desta rota passarão a adotar as diretrizes da rota pai ou a política padrão global.
      v-card-actions.px-4.pb-4.pt-0
        v-spacer
        v-btn(text, @click='deleteDialog.visible = false', :disabled='deletingPolicy') Cancelar
        v-btn(depressed, color='red', dark, :loading='deletingPolicy', @click='confirmDeletePolicy')
          v-icon(left, small) mdi-delete
          | Confirmar Exclusão
</template>

<script>
import gql from 'graphql-tag'
import _ from 'lodash'

export default {
  name: 'AdminWorkflowPolicies',
  data() {
    return {
      search: '',
      loadingConfig: false,
      savingConfig: false,
      loadingPolicies: false,
      savingPolicy: false,
      deletingPolicy: false,

      config: {
        enabled: true,
        teamsWebhookUrl: ''
      },

      policies: [],

      headers: [
        { text: 'Prefixo de Caminho', value: 'pathPrefix', sortable: true },
        { text: 'Níveis de Homologação', value: 'approvalLevels', sortable: true },
        { text: 'Vigência Periódica', value: 'reviewIntervalDays', sortable: true },
        { text: 'Ação ao Expirar', value: 'autoArchiveOnExpire', sortable: false },
        { text: 'Ações', value: 'actions', sortable: false, align: 'right' }
      ],

      approvalLevelOptions: [
        { text: '1 Nível (Revisão Direta pelo Aprovador)', value: 1 },
        { text: '2 Níveis (Revisão Técnica + Homologação Final)', value: 2 }
      ],

      policyDialog: {
        visible: false,
        isEditing: false,
        valid: true,
        form: {
          id: null,
          pathPrefix: '',
          approvalLevels: 1,
          reviewIntervalDays: 365,
          autoArchiveOnExpire: false
        }
      },

      deleteDialog: {
        visible: false,
        item: null
      }
    }
  },

  mounted() {
    this.fetchData()
  },

  methods: {
    formatDaysToMonths(days) {
      if (!days) return 'Sem validade'
      const months = Math.round(days / 30)
      if (months === 12) return '12 meses'
      return `aprox. ${months} meses`
    },

    formatDaysPreview(days) {
      const num = Number(days) || 0
      if (num === 0) return 'Vigência indeterminada (sem expiração periódica).'
      if (num === 365) return 'Vigência padrão de 12 meses (1 ano).'
      return `Documentos vencerão após ${num} dias (${this.formatDaysToMonths(num)}).`
    },

    async fetchData() {
      this.loadingConfig = true
      this.loadingPolicies = true

      try {
        const res = await this.$apollo.query({
          query: gql`
            query {
              workflow {
                config {
                  enabled
                  teamsWebhookUrl
                }
                policies {
                  id
                  pathPrefix
                  approvalLevels
                  reviewIntervalDays
                  autoArchiveOnExpire
                }
              }
            }
          `,
          fetchPolicy: 'network-only'
        })

        const data = res?.data?.workflow
        if (data?.config) {
          this.config = {
            enabled: Boolean(data.config.enabled),
            teamsWebhookUrl: data.config.teamsWebhookUrl || ''
          }
        }
        if (Array.isArray(data?.policies)) {
          this.policies = data.policies
        }
      } catch (err) {
        this.notifyError('Falha ao carregar políticas de workflow: ' + err.message)
      } finally {
        this.loadingConfig = false
        this.loadingPolicies = false
      }
    },

    async saveConfig() {
      this.savingConfig = true
      try {
        const res = await this.$apollo.mutate({
          mutation: gql`
            mutation ($enabled: Boolean!, $teamsWebhookUrl: String) {
              workflow {
                setConfig(enabled: $enabled, teamsWebhookUrl: $teamsWebhookUrl) {
                  responseResult {
                    succeeded
                    message
                  }
                  config {
                    enabled
                    teamsWebhookUrl
                  }
                }
              }
            }
          `,
          variables: {
            enabled: this.config.enabled,
            teamsWebhookUrl: this.config.teamsWebhookUrl.trim() || null
          }
        })

        const result = res?.data?.workflow?.setConfig
        if (result?.responseResult?.succeeded) {
          this.notifySuccess('Parâmetros e contingência atualizados com sucesso.')
        } else {
          this.notifyError(result?.responseResult?.message || 'Falha ao salvar configurações.')
        }
      } catch (err) {
        this.notifyError(err.message)
      } finally {
        this.savingConfig = false
      }
    },

    openPolicyDialog(item) {
      if (item) {
        this.policyDialog.isEditing = true
        this.policyDialog.form = {
          id: item.id,
          pathPrefix: item.pathPrefix.replace(/^\//, ''),
          approvalLevels: item.approvalLevels || 1,
          reviewIntervalDays: item.reviewIntervalDays !== undefined ? item.reviewIntervalDays : 365,
          autoArchiveOnExpire: Boolean(item.autoArchiveOnExpire)
        }
      } else {
        this.policyDialog.isEditing = false
        this.policyDialog.form = {
          id: null,
          pathPrefix: '',
          approvalLevels: 1,
          reviewIntervalDays: 365,
          autoArchiveOnExpire: false
        }
      }
      this.policyDialog.visible = true
    },

    async savePolicy() {
      if (this.$refs.policyForm && !this.$refs.policyForm.validate()) {
        return
      }

      this.savingPolicy = true
      try {
        const payload = {
          id: this.policyDialog.form.id || null,
          pathPrefix: this.policyDialog.form.pathPrefix.trim(),
          approvalLevels: Number(this.policyDialog.form.approvalLevels),
          reviewIntervalDays: Number(this.policyDialog.form.reviewIntervalDays),
          autoArchiveOnExpire: Boolean(this.policyDialog.form.autoArchiveOnExpire)
        }

        const res = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int, $pathPrefix: String!, $approvalLevels: Int!, $reviewIntervalDays: Int, $autoArchiveOnExpire: Boolean) {
              workflow {
                setPolicy(
                  id: $id
                  pathPrefix: $pathPrefix
                  approvalLevels: $approvalLevels
                  reviewIntervalDays: $reviewIntervalDays
                  autoArchiveOnExpire: $autoArchiveOnExpire
                ) {
                  responseResult {
                    succeeded
                    message
                  }
                  policy {
                    id
                    pathPrefix
                    approvalLevels
                    reviewIntervalDays
                    autoArchiveOnExpire
                  }
                }
              }
            }
          `,
          variables: payload
        })

        const result = res?.data?.workflow?.setPolicy
        if (result?.responseResult?.succeeded) {
          this.notifySuccess('Política de rota registrada com sucesso.')
          this.policyDialog.visible = false
          await this.fetchData()
        } else {
          this.notifyError(result?.responseResult?.message || 'Falha ao salvar política.')
        }
      } catch (err) {
        this.notifyError(err.message)
      } finally {
        this.savingPolicy = false
      }
    },

    openDeleteDialog(item) {
      this.deleteDialog.item = item
      this.deleteDialog.visible = true
    },

    async confirmDeletePolicy() {
      if (!this.deleteDialog.item || !this.deleteDialog.item.id) return

      this.deletingPolicy = true
      try {
        const res = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              workflow {
                deletePolicy(id: $id) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: this.deleteDialog.item.id }
        })

        const result = res?.data?.workflow?.deletePolicy
        if (result?.responseResult?.succeeded) {
          this.notifySuccess('Política removida com sucesso.')
          this.deleteDialog.visible = false
          await this.fetchData()
        } else {
          this.notifyError(result?.responseResult?.message || 'Falha ao excluir política.')
        }
      } catch (err) {
        this.notifyError(err.message)
      } finally {
        this.deletingPolicy = false
      }
    },

    notifySuccess(msg) {
      this.$store.commit('pushNotification', {
        type: 'success',
        message: msg
      })
    },

    notifyError(msg) {
      this.$store.commit('pushNotification', {
        type: 'error',
        message: msg
      })
    }
  }
}
</script>

<style lang='scss'>
.detran-admin-workflow-policies {
  .detran-text-primary {
    color: #1e6b37;
  }

  .detran-card-bordered {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }

  .detran-section-title {
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  .detran-code-prefix {
    background-color: #f1f5f9;
    padding: 3px 8px;
    border-radius: 4px;
    color: #0f172a;
    font-size: 13px;
  }

  .detran-dialog-header {
    background-color: #288b4a;
  }
}
</style>

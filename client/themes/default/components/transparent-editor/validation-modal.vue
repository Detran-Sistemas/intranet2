<template lang="pug">
v-dialog(
  :value='value'
  @input='$emit("input", $event)'
  max-width='512'
  persistent
  content-class='detran-validation-dialog'
)
  .detran-validation-card
    //- Header com Gradiente Institucional Detran-MG (Fiel ao Protótipo: linhas 634-643)
    .detran-validation-card__header
      .detran-validation-card__header-left
        v-icon.detran-validation-card__shield(size='26' color='#6ee7b7') mdi-shield-check
        .detran-validation-card__titles
          h3.detran-validation-card__title Submeter Alterações para Validação
          p.detran-validation-card__subtitle Suas edições em tempo real foram salvas como rascunho
      button.detran-validation-card__close(
        type='button'
        title='Fechar'
        @click='$emit("input", false)'
      )
        v-icon(size='18' color='#ffffff') mdi-close

    //- Corpo do Modal (Fiel ao Protótipo: linhas 645-663)
    .detran-validation-card__body
      //- Box Âmbar de Edição Transparente Detectada
      .detran-validation-card__callout
        v-icon.detran-validation-card__callout-icon(size='19' color='#d97706') mdi-source-branch-sync
        .detran-validation-card__callout-text
          p.detran-validation-card__callout-title Edição Transparente Detectada
          p.detran-validation-card__callout-desc
            | Você realizou <strong>{{ Math.max(changeCount, 1) }} {{ changeCount > 1 ? 'alterações' : 'alteração' }}</strong> diretamente no texto da página <strong>{{ pageTitle }}</strong>. Para que todos os servidores visualizem, confirme o envio para o validador do setor.

      //- Campo de Resumo Rápido
      .detran-validation-card__field
        label.detran-validation-card__label(for='detran-validation-comment') Resumo rápido da atualização (Opcional):
        input#detran-validation-comment.detran-validation-card__input(
          v-model='comment'
          type='text'
          placeholder='Ex: Atualização de texto institucional na página...'
          @keydown.enter.prevent='onSubmit'
        )

      //- Metadados de Rodapé
      .detran-validation-card__meta
        span
          | Responsável pela aprovação: <strong>{{ reviewerLabel }}</strong>
        span Trâmite institucional Detran-MG

    //- Barra de Ações (Fiel ao Protótipo: linhas 665-671)
    .detran-validation-card__actions
      button.detran-validation-card__btn-cancel(
        type='button'
        :disabled='loading'
        @click='$emit("input", false)'
      ) Continuar Editando

      button.detran-validation-card__btn-submit(
        type='button'
        :disabled='loading'
        @click='onSubmit'
      )
        v-progress-circular(
          v-if='loading'
          indeterminate
          size='14'
          width='2'
          color='#ffffff'
        )
        v-icon(v-else size='15' color='#ffffff') mdi-send
        span {{ loading ? 'Enviando...' : 'Confirmar e Enviar para Validação' }}
</template>

<script>
import { buildValidationPayload } from './utils/editor-controller'

export default {
  name: 'ValidationModal',
  props: {
    value: {
      type: Boolean,
      default: false
    },
    changeCount: {
      type: Number,
      default: 1
    },
    pageTitle: {
      type: String,
      default: 'Página'
    },
    loading: {
      type: Boolean,
      default: false
    },
    reviewerLabel: {
      type: String,
      default: 'Comitê Gestor / TI'
    }
  },
  data () {
    return {
      comment: ''
    }
  },
  watch: {
    value (isOpen) {
      if (!isOpen) {
        this.comment = ''
      }
    }
  },
  methods: {
    onSubmit () {
      if (this.loading) return
      this.$emit('submit', buildValidationPayload(this.comment))
    }
  }
}
</script>

<style lang="scss" scoped>
.detran-validation-card {
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  &__header {
    padding: 1.25rem 1.5rem;
    background: linear-gradient(90deg, #144d29 0%, #1b6535 100%);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  &__shield {
    flex-shrink: 0;
  }

  &__titles {
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.3;
    color: #ffffff;
  }

  &__subtitle {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: rgba(209, 250, 229, 0.85);
    line-height: 1.3;
  }

  &__close {
    width: 30px;
    height: 30px;
    border-radius: 0.5rem;
    border: none;
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.12);
    }
  }

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-size: 0.75rem;
    color: #475569;
  }

  &__callout {
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    background-color: #fffbeb;
    border: 1px solid #fde68a;
    color: #78350f;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  &__callout-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }

  &__callout-text {
    flex: 1;
    min-width: 0;
  }

  &__callout-title {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: #78350f;
  }

  &__callout-desc {
    margin: 4px 0 0;
    font-size: 0.75rem;
    line-height: 1.55;
    color: #92400e;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  &__label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #334155;
  }

  &__input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    font-size: 0.75rem;
    color: #334155;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder {
      color: #94a3b8;
    }

    &:focus {
      border-color: #2ea058;
      box-shadow: 0 0 0 3px rgba(46, 160, 88, 0.2);
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.625rem;
    border-top: 1px solid #f1f5f9;
    font-size: 0.6875rem;
    color: #94a3b8;

    strong {
      color: #64748b;
      font-weight: 600;
    }
  }

  &__actions {
    padding: 1rem 1.5rem;
    background-color: #f8fafc;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.625rem;
  }

  &__btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
    background-color: #ffffff;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover:not(:disabled) {
      background-color: #f1f5f9;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__btn-submit {
    padding: 0.5rem 1rem;
    border-radius: 0.75rem;
    border: none;
    background-color: #1b6535;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    transition: background-color 0.15s ease;

    &:hover:not(:disabled) {
      background-color: #144d29;
    }

    &:disabled {
      opacity: 0.75;
      cursor: wait;
    }
  }
}
</style>

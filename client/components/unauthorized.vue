<template lang="pug">
  v-app.detran-feedback-app
    .detran-feedback
      //- Blobs luminosos de fundo (Detran Design System)
      .detran-feedback-blobs(aria-hidden='true')
        .detran-feedback-blob.detran-feedback-blob--top
        .detran-feedback-blob.detran-feedback-blob--mid
        .detran-feedback-blob.detran-feedback-blob--bottom

      .detran-feedback-container
        //- Identidade Institucional Superior
        .detran-feedback-header
          a.detran-feedback-brand(href='/' title='Ir para a página inicial da Intranet')
            img.detran-feedback-brand__img(src='/_assets/img/detran-logo-white.png' alt='Detran-MG')
            span.detran-feedback-brand__badge Intranet Corporativa

        //- Card Central Glassmorphism
        .detran-feedback-card
          //- Badge de Status
          .detran-feedback-card__badge.detran-feedback-card__badge--warning
            v-icon(size='14' color='#b45309') mdi-shield-lock-outline
            span 403 • Acesso Restrito

          //- Ícone Visual Central
          .detran-feedback-visual.detran-feedback-visual--warning
            .detran-feedback-visual__ring
            .detran-feedback-visual__icon
              v-icon(size='40' color='#d97706') mdi-lock-outline

          //- Título e Mensagem Human-Centric
          h1.detran-feedback-card__title Conteúdo Restrito
          p.detran-feedback-card__subtitle
            | Você não possui permissão para visualizar este conteúdo ou realizar esta operação com seu perfil atual. Caso necessite de liberação, autentique-se com sua conta corporativa ou solicite autorização ao gestor da área.

          //- Ações de Navegação e Autenticação
          .detran-feedback-actions
            a.detran-btn-primary(href='/login')
              v-icon(left size='18') mdi-login
              span Entrar com Outra Conta
            button.detran-btn-secondary(type='button' @click='goBack')
              v-icon(left size='18') mdi-arrow-left
              span Voltar à Página Anterior
            a.detran-link-subtle(href='/')
              v-icon(left size='14') mdi-home-outline
              span Ir para a Página Inicial

        //- Rodapé Institucional
        .detran-feedback-footer
          span Governo do Estado de Minas Gerais • Departamento de Trânsito
</template>

<script>
export default {
  props: {
    action: {
      type: String,
      default: 'view'
    }
  },
  methods: {
    goBack () {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back()
      } else {
        window.location.href = '/'
      }
    }
  }
}
</script>

<style lang="scss">
@import '../themes/detran/scss/variables';
@import '../themes/detran/scss/animations';

.detran-feedback-app {
  font-family: $font-family-base !important;
  background: transparent !important;
}

.detran-feedback {
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  background: radial-gradient(ellipse at 25% 20%, #1f6437 0%, #164828 40%, #0e301a 80%, #092011 100%) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.25rem;
}

.detran-feedback-blobs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;

  .detran-feedback-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    opacity: 0.45;
    will-change: transform;

    &--top {
      width: 480px;
      height: 480px;
      top: -120px;
      right: -80px;
      background: radial-gradient(circle, #33a65b 0%, rgba(51, 166, 91, 0) 70%);
      animation: detranLivingOrb1 16s ease-in-out infinite alternate;
    }

    &--mid {
      width: 520px;
      height: 520px;
      bottom: -150px;
      left: 6%;
      background: radial-gradient(circle, #288b4a 0%, rgba(40, 139, 74, 0) 70%);
      animation: detranLivingOrb2 22s ease-in-out infinite alternate-reverse;
    }

    &--bottom {
      width: 400px;
      height: 400px;
      top: 35%;
      right: 20%;
      background: radial-gradient(circle, #5fc381 0%, rgba(95, 195, 129, 0) 70%);
      opacity: 0.35;
      animation: detranLivingOrb3 18s ease-in-out infinite alternate;
    }
  }
}

.detran-feedback-container {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 580px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.detran-feedback-header {
  display: flex;
  justify-content: center;
  width: 100%;
}

.detran-feedback-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;

  &__img {
    height: 38px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  &__badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: #a7f3d0;
    background: rgba(51, 166, 91, 0.2);
    border: 1px solid rgba(51, 166, 91, 0.35);
    padding: 3px 10px;
    border-radius: 9999px;
    letter-spacing: 0.04em;
  }
}

.detran-feedback-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 24px;
  padding: 2.25rem 2rem;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: detranCardLivingGlow 9s ease-in-out infinite;

  @media (max-width: 599px) {
    padding: 1.75rem 1.25rem;
    border-radius: 20px;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 9999px;
    background: #fef3c7;
    color: #b45309;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    margin-bottom: 1.25rem;
  }

  &__title {
    font-size: 1.625rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.25;
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;

    @media (max-width: 599px) {
      font-size: 1.375rem;
    }
  }

  &__subtitle {
    font-size: 0.9375rem;
    color: #475569;
    line-height: 1.55;
    margin: 0 0 1.5rem;
    max-width: 460px;

    @media (max-width: 599px) {
      font-size: 0.875rem;
    }
  }
}

.detran-feedback-visual {
  position: relative;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;

  &__ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    animation: detranRingPulse 3s ease-in-out infinite;
    border: 1.5px solid rgba(245, 158, 11, 0.35);
    background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.02) 70%);
  }

  &__icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    box-shadow: 0 6px 16px rgba(245, 158, 11, 0.18);
  }
}

@keyframes detranRingPulse {
  0% { transform: scale(0.96); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(0.96); opacity: 0.8; }
}

.detran-feedback-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: stretch;
}

.detran-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: #33a65b;
  color: #ffffff !important;
  font-size: 0.9375rem;
  font-weight: 700;
  border-radius: 12px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(51, 166, 91, 0.25);

  &:hover {
    background: #288b4a;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(51, 166, 91, 0.35);
  }
}

.detran-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: #f1f5f9;
  color: #334155;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    color: #0f172a;
  }
}

.detran-link-subtle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.8125rem;
  color: #64748b;
  text-decoration: none;
  margin-top: 0.25rem;
  transition: color 0.2s;

  &:hover {
    color: #288b4a;
    text-decoration: underline;
  }
}

.detran-feedback-footer {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 0.02em;
}
</style>

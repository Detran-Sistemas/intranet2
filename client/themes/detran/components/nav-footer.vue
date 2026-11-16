<template lang="pug">
  footer.detran-footer
    .detran-footer__content
      template(v-if='footerOverride')
        span.detran-footer__override(v-html='footerOverrideRender')
        span.detran-footer__sep(aria-hidden='true') •
        span.detran-footer__innovation Coordenadoria de Inovação
        span.detran-footer__sep(aria-hidden='true') |
      template(v-else-if='company && company.length > 0 && contentLicense')
        span.detran-footer__copy(v-if='contentLicense === "alr"') {{ $t('common:footer.copyright', { company: company, year: currentYear, interpolation: { escapeValue: false } }) }}
        span.detran-footer__copy(v-else) {{ $t('common:footer.license', { company: company, license: $t('common:license.' + contentLicense), interpolation: { escapeValue: false } }) }}
        span.detran-footer__sep(aria-hidden='true') •
        span.detran-footer__innovation Coordenadoria de Inovação
        span.detran-footer__sep(aria-hidden='true') |
      template(v-else)
        span.detran-footer__copy © {{ currentYear }} Detran-MG. Todos os direitos reservados.
        span.detran-footer__sep(aria-hidden='true') •
        span.detran-footer__innovation Coordenadoria de Inovação
        span.detran-footer__sep(aria-hidden='true') |
      span.detran-footer__powered {{ $t('common:footer.poweredBy', 'Desenvolvido com') }} #[a.detran-footer__link(href='https://wiki.js.org' rel='nofollow noopener' target='_blank') Wiki.js]
</template>

<script>
import { get } from 'vuex-pathify'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true
})

export default {
  name: 'NavFooter',

  data () {
    return {
      currentYear: new Date().getFullYear()
    }
  },

  computed: {
    company: get('site/company'),
    contentLicense: get('site/contentLicense'),
    footerOverride: get('site/footerOverride'),

    footerOverrideRender () {
      if (!this.footerOverride) return ''
      return md.renderInline(this.footerOverride)
    }
  }
}
</script>

<style lang="scss">
@import '../scss/variables';

.detran-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 100%;
  padding: 1.5rem 1.5rem 0.5rem;
  background: transparent;
  border-top: 1px solid rgba(226, 232, 240, 0.85);
  margin-top: auto;
  z-index: 25;
  font-family: $font-family-base;
  box-shadow: none;

  &__content {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: $slate-500;
    line-height: 1.5;
    text-align: center;
  }

  &__sep {
    color: $slate-300;
  }

  &__copy, &__override, &__powered, &__innovation {
    color: $slate-500;
  }

  &__innovation {
    font-weight: 600;
    color: $detran-700;
  }

  &__link, a {
    color: $detran-600;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s ease;

    &:hover {
      color: $detran-700;
      text-decoration: underline;
    }
  }

  @include mobile {
    padding: 0.5rem 1rem;

    &__content {
      font-size: 0.75rem;
      gap: 0.25rem 0.5rem;
    }
  }
}
</style>

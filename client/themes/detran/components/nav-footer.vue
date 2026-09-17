<template lang="pug">
  footer.detran-footer
    span.detran-footer__copy © {{ currentYear }} Detran-MG. Todos os direitos reservados.
</template>

<script>
export default {
  name: 'NavFooter',
  computed: {
    currentYear () { return new Date().getFullYear() }
  }
}
</script>

<style lang="scss">
.detran-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;

  &__copy {
    font-size: 0.75rem;
    color: #94a3b8;
    font-family: 'Inter', sans-serif;
  }
}
</style>

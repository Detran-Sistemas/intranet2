<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').detran-workflow-app
    nav-header
    v-content(:class='$vuetify.theme.dark ? "grey darken-4" : "grey lighten-5"')
      transition(name='workflow-router')
        router-view
    nav-footer
    notify
    search-results
</template>

<script>
import VueRouter from 'vue-router'
import { workflowRoutes } from '../routes/workflow'

/* global WIKI */

const router = new VueRouter({
  mode: 'history',
  base: '/w',
  routes: workflowRoutes
})

router.beforeEach((to, from, next) => {
  if (WIKI && WIKI.$store) {
    WIKI.$store.commit('loadingStart', 'workflow')
  }
  next()
})

router.afterEach((to, from) => {
  if (WIKI && WIKI.$store) {
    WIKI.$store.commit('loadingStop', 'workflow')
  }
})

export default {
  name: 'Workflow',
  router,
  created() {
    this.$store.set('page/mode', 'workflow')
  }
}
</script>

<style lang='scss'>
.workflow-router {
  &-enter-active, &-leave-active {
    transition: opacity .25s ease;
    opacity: 1;
  }
  &-enter-active {
    transition-delay: .25s;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }
}
</style>

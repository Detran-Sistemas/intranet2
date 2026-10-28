/**
 * Detran-MG Workflow Client Routes Definition
 * Maps routes for the /w sub-application (Dashboard & Review screens).
 */
export const workflowRoutes = [
  {
    path: '/',
    name: 'workflow-dashboard',
    component: () => import(/* webpackChunkName: "workflow" */ '../components/workflow/dashboard.vue'),
    meta: {
      title: 'Central de Tarefas • Workflow Detran-MG',
      requiresAuth: true
    }
  },
  {
    path: '/review/:id',
    name: 'workflow-review',
    component: () => import(/* webpackChunkName: "workflow" */ '../components/workflow/review.vue'),
    meta: {
      title: 'Revisão de Documento • Workflow Detran-MG',
      requiresAuth: true
    }
  }
]

export default workflowRoutes

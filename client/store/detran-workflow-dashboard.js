/**
 * Detran Workflow Dashboard Logic Helper
 * Pure JS helper to manage dashboard metrics, urgency calculation, and navigation routes.
 */

/**
 * Calculate urgency level based on due date.
 *
 * @param {string|Date} dueDate
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ level: ('expired'|'urgent'|'warning'|'normal'), daysRemaining: number, label: string, color: string }}
 */
function getUrgencyLevel(dueDate, referenceDate = new Date()) {
  if (!dueDate) {
    return {
      level: 'normal',
      daysRemaining: Infinity,
      label: 'Vigência Indeterminada',
      color: 'grey'
    }
  }

  const due = new Date(dueDate)
  const ref = new Date(referenceDate)
  const diffTime = due.getTime() - ref.getTime()
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) {
    return {
      level: 'expired',
      daysRemaining,
      label: `Expirado há ${Math.abs(daysRemaining)} dia(s)`,
      color: 'red darken-3'
    }
  }

  if (daysRemaining <= 15) {
    return {
      level: 'urgent',
      daysRemaining,
      label: `Vence em ${daysRemaining} dia(s)`,
      color: 'deep-orange darken-2'
    }
  }

  if (daysRemaining <= 60) {
    return {
      level: 'warning',
      daysRemaining,
      label: `Vence em ${daysRemaining} dia(s)`,
      color: 'amber darken-3'
    }
  }

  return {
    level: 'normal',
    daysRemaining,
    label: `Válido por ${daysRemaining} dias`,
    color: 'green darken-2'
  }
}

/**
 * Determine primary action and route for a given draft item.
 *
 * @param {object} draft
 * @returns {{ label: string, route: string, icon: string, color: string }}
 */
function getDraftActionRoute(draft) {
  if (!draft) {
    return { label: 'Visualizar', route: '/w', icon: 'mdi-eye', color: 'grey' }
  }

  const locale = draft.locale || 'pt-br'
  const path = draft.path || ''

  switch (draft.state) {
    case 'changes_requested':
      return {
        label: 'Editar e Corrigir',
        route: `/w/review/${draft.id}?edit=1`,
        icon: 'mdi-pencil',
        color: 'orange darken-3'
      }
    case 'draft':
      return {
        label: 'Continuar Edição',
        route: `/w/review/${draft.id}?edit=1`,
        icon: 'mdi-pencil-outline',
        color: 'blue darken-2'
      }
    case 'in_review':
    case 'awaiting_approval':
      return {
        label: 'Analisar e Revisar',
        route: `/w/review/${draft.id}`,
        icon: 'mdi-file-find-outline',
        color: 'primary'
      }
    case 'periodic_review':
      return {
        label: 'Revisar Normativo',
        route: `/w/review/${draft.id}`,
        icon: 'mdi-clock-alert-outline',
        color: 'deep-orange darken-2'
      }
    case 'published':
      return {
        label: 'Ver Página no Ar',
        route: `/${locale}/${path}`,
        icon: 'mdi-file-check-outline',
        color: 'green darken-2'
      }
    default:
      return {
        label: 'Abrir',
        route: `/w/review/${draft.id}`,
        icon: 'mdi-open-in-new',
        color: 'primary'
      }
  }
}

/**
 * Calculate KPI statistics for the dashboard cards.
 *
 * @param {object} params
 * @param {Array<object>} [params.pendingTasks=[]]
 * @param {Array<object>} [params.myDrafts=[]]
 * @param {Array<object>} [params.expiringNorms=[]]
 * @returns {{ pendingCount: number, myDraftsCount: number, changesRequestedCount: number, expiringCount: number }}
 */
function calculateDashboardStats({ pendingTasks = [], myDrafts = [], expiringNorms = [] } = {}) {
  const pending = Array.isArray(pendingTasks) ? pendingTasks : []
  const drafts = Array.isArray(myDrafts) ? myDrafts : []
  const expiring = Array.isArray(expiringNorms) ? expiringNorms : []

  const changesRequested = drafts.filter((d) => d.state === 'changes_requested').length

  return {
    pendingCount: pending.length,
    myDraftsCount: drafts.length,
    changesRequestedCount: changesRequested,
    expiringCount: expiring.length
  }
}

const DASHBOARD_ACTIVE_STATES = new Set([
  'draft',
  'in_review',
  'awaiting_approval',
  'in_approval_step2',
  'changes_requested',
  'periodic_review',
  'revisao_periodica'
])

const DASHBOARD_HISTORY_STATES = new Set([
  'published',
  'archived'
])

/**
 * Partition dashboard lists into:
 * - Tab 1: pendingTasks (actionable items awaiting current user; excludes own in_review/awaiting_approval)
 * - Tab 2: activeDrafts (author's active in-flight drafts; excludes published/archived)
 * - Tab 3: historyDrafts (author's published/archived history) + expiringNorms
 *
 * @param {object} params
 * @returns {{ pendingTasks: Array, activeDrafts: Array, historyDrafts: Array, expiringNorms: Array }}
 */
function partitionDashboardDrafts ({ pendingTasks = [], myDrafts = [], expiringNorms = [], currentUserId = null } = {}) {
  const normalizedPending = (Array.isArray(pendingTasks) ? pendingTasks : []).filter((d) => {
    if (!d) return false
    if (
      currentUserId != null &&
      Number(d.authorId) === Number(currentUserId) &&
      (d.state === 'in_review' || d.state === 'awaiting_approval' || d.state === 'in_approval_step2')
    ) {
      return false
    }
    return true
  })

  const draftsList = Array.isArray(myDrafts) ? myDrafts : []
  const activeDrafts = draftsList.filter((d) => d && DASHBOARD_ACTIVE_STATES.has(d.state))
  const historyDrafts = draftsList
    .filter((d) => d && DASHBOARD_HISTORY_STATES.has(d.state))
    .slice()
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.publishedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.publishedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    })

  return {
    pendingTasks: normalizedPending,
    activeDrafts,
    historyDrafts,
    expiringNorms: Array.isArray(expiringNorms) ? expiringNorms : []
  }
}

/**
 * Determine Tab 2 ("Meus Documentos Enviados") button actions for an author's draft.
 * While in_review / awaiting_approval, editing directly via ?edit=1 is disallowed;
 * the author gets Acompanhar Revisão + Puxar de Volta para Edição (retract).
 *
 * @param {object} draft
 * @param {object} [options]
 * @param {string} [options.routePrefix='/review']
 * @returns {object}
 */
function getTab2DraftActions (draft, { routePrefix = '/review' } = {}) {
  if (!draft) {
    return {
      canEdit: false,
      editRoute: null,
      editLabel: null,
      canRetract: false,
      retractLabel: null,
      canTrack: false,
      trackRoute: '/w',
      trackLabel: 'Visualizar'
    }
  }

  if (draft.state === 'in_review' || draft.state === 'awaiting_approval' || draft.state === 'in_approval_step2') {
    return {
      canEdit: false,
      editRoute: null,
      editLabel: null,
      canRetract: true,
      retractLabel: 'Puxar de Volta para Edição',
      canTrack: true,
      trackRoute: `${routePrefix}/${draft.id}`,
      trackLabel: 'Acompanhar Revisão'
    }
  }

  if (draft.state === 'draft' || draft.state === 'changes_requested') {
    return {
      canEdit: true,
      editRoute: `${routePrefix}/${draft.id}?edit=1`,
      editLabel: draft.state === 'changes_requested' ? 'Editar e Corrigir' : 'Continuar Edição',
      canRetract: false,
      retractLabel: null,
      canTrack: draft.state !== 'draft',
      trackRoute: `${routePrefix}/${draft.id}`,
      trackLabel: 'Acompanhar'
    }
  }

  return {
    canEdit: false,
    editRoute: null,
    editLabel: null,
    canRetract: false,
    retractLabel: null,
    canTrack: true,
    trackRoute: `${routePrefix}/${draft.id}`,
    trackLabel: 'Visualizar'
  }
}

module.exports = {
  getUrgencyLevel,
  getDraftActionRoute,
  calculateDashboardStats,
  partitionDashboardDrafts,
  getTab2DraftActions
}

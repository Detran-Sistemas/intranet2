const _ = require('lodash')

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
        label: 'Ajustar no Editor',
        route: `/e/${locale}/${path}`,
        icon: 'mdi-pencil',
        color: 'orange darken-3'
      }
    case 'draft':
      return {
        label: 'Continuar Edição',
        route: `/e/${locale}/${path}`,
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

module.exports = {
  getUrgencyLevel,
  getDraftActionRoute,
  calculateDashboardStats
}

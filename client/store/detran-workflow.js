import { make } from 'vuex-pathify'
import gql from 'graphql-tag'
import _ from 'lodash'

export const QUERY_DRAFT_AND_POLICY = gql`
  query ($path: String!, $locale: String) {
    workflow {
      policy(path: $path) {
        pathPrefix
        approvalLevels
        reviewIntervalDays
        autoArchiveOnExpire
      }
      draftByPath(path: $path, locale: $locale) {
        id
        pageId
        path
        locale
        title
        description
        content
        contentType
        editorKey
        tags
        state
        approvalMode
        currentLevel
        authorId
        authorName
        reviewDueDate
        createdAt
        updatedAt
        events {
          id
          action
          fromState
          toState
          userId
          userName
          comment
          createdAt
        }
      }
    }
  }
`

export const MUTATION_SAVE_DRAFT = gql`
  mutation (
    $id: Int
    $pageId: Int
    $path: String!
    $locale: String
    $title: String!
    $description: String
    $content: String!
    $contentType: String
    $editorKey: String
    $tags: [String]
    $approvalMode: String
    $baseHash: String
  ) {
    workflow {
      saveDraft(
        id: $id
        pageId: $pageId
        path: $path
        locale: $locale
        title: $title
        description: $description
        content: $content
        contentType: $contentType
        editorKey: $editorKey
        tags: $tags
        approvalMode: $approvalMode
        baseHash: $baseHash
      ) {
        responseResult {
          succeeded
          message
          errorCode
          slug
        }
        draft {
          id
          pageId
          path
          locale
          title
          description
          content
          contentType
          editorKey
          tags
          state
          approvalMode
          currentLevel
          authorId
          authorName
          reviewDueDate
          createdAt
          updatedAt
        }
      }
    }
  }
`

export const MUTATION_WORKFLOW_SUBMIT = gql`
  mutation ($id: Int!, $approvalMode: String, $comment: String) {
    workflowSubmit(id: $id, approvalMode: $approvalMode, comment: $comment) {
      responseResult {
        succeeded
        message
        errorCode
        slug
      }
      draft {
        id
        pageId
        path
        locale
        title
        description
        content
        contentType
        editorKey
        tags
        state
        approvalMode
        currentLevel
        authorId
        authorName
        reviewDueDate
        createdAt
        updatedAt
        events {
          id
          action
          fromState
          toState
          userId
          userName
          comment
          createdAt
        }
      }
    }
  }
`

export const getDefaultState = () => ({
  draft: null,
  effectivePolicy: {
    pathPrefix: '/',
    approvalLevels: 1,
    reviewIntervalDays: 365,
    autoArchiveOnExpire: false
  },
  isSaving: false,
  saveStatus: 'idle', // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  lastSavedTime: null,
  errorMessage: null,
  isRecovered: false,
  recoveredDraftId: null,
  autosaveIntervalMs: 30000
})

const state = getDefaultState()

// Shared debounce timer handle for autosave
let autosaveTimeoutHandle = null

export const _getAutosaveTimeoutHandle = () => autosaveTimeoutHandle
export const _clearAutosaveTimeoutHandle = () => {
  if (autosaveTimeoutHandle) {
    clearTimeout(autosaveTimeoutHandle)
    autosaveTimeoutHandle = null
  }
}

export const mutations = {
  ...make.mutations(state),
  SET_DRAFT(st, draft) {
    st.draft = draft
  },
  SET_POLICY(st, policy) {
    st.effectivePolicy = policy
  },
  SET_IS_SAVING(st, isSaving) {
    st.isSaving = isSaving
  },
  SET_SAVE_STATUS(st, status) {
    st.saveStatus = status
  },
  SET_LAST_SAVED_TIME(st, time) {
    st.lastSavedTime = time
  },
  SET_ERROR_MESSAGE(st, msg) {
    st.errorMessage = msg
  },
  SET_RECOVERED(st, { recovered, draftId }) {
    st.isRecovered = recovered
    st.recoveredDraftId = draftId
  },
  RESET_WORKFLOW_STATE(st) {
    Object.assign(st, getDefaultState())
    _clearAutosaveTimeoutHandle()
  }
}

export const getters = {
  currentDraft: st => st.draft,
  currentState: st => (st.draft ? st.draft.state : 'draft'),
  canEdit: st => {
    const s = st.draft ? st.draft.state : 'draft'
    return s === 'draft' || s === 'changes_requested'
  },
  isSavingDraft: st => st.isSaving,
  autosaveStatus: st => st.saveStatus,
  isDraftRecovered: st => st.isRecovered,
  effectiveApprovalLevels: st => (st.effectivePolicy ? st.effectivePolicy.approvalLevels : 1)
}

export const actions = {
  /**
   * Load draft and policy for a given path and locale
   */
  async loadDraftAndPolicy({ commit, dispatch }, { apollo, path, locale = 'pt-br', autoRecover = true, rootStore, rootEmit } = {}) {
    if (!path) return null
    const client = apollo || (typeof WIKI !== 'undefined' && WIKI.$app && WIKI.$app.$apollo) || (typeof window !== 'undefined' && window.WIKI && window.WIKI.$apollo)
    if (!client) return null

    try {
      const { data } = await client.query({
        query: QUERY_DRAFT_AND_POLICY,
        variables: { path, locale },
        fetchPolicy: 'network-only'
      })

      if (data && data.workflow) {
        if (data.workflow.policy) {
          commit('SET_POLICY', data.workflow.policy)
        }
        const draft = data.workflow.draftByPath
        if (draft) {
          commit('SET_DRAFT', draft)
          if (draft.updatedAt) {
            commit('SET_LAST_SAVED_TIME', draft.updatedAt)
          }

          // Auto-recovery: if draft is in-progress (not published/archived), apply to editor
          const isActionable = ['draft', 'changes_requested', 'in_review', 'awaiting_approval'].includes(draft.state)
          if (autoRecover && isActionable) {
            await dispatch('recoverDraft', { draft, rootStore, rootEmit })
          }
        }
        return data.workflow
      }
    } catch (err) {
      commit('SET_ERROR_MESSAGE', err.message)
    }
    return null
  },

  /**
   * Recovers in-flight draft content and metadata into the editor
   */
  async recoverDraft({ commit, state }, { draft, rootStore, rootEmit } = {}) {
    const targetDraft = draft || state.draft
    if (!targetDraft) return false

    const store = rootStore || (typeof WIKI !== 'undefined' && WIKI.$store) || (typeof window !== 'undefined' && window.WIKI && window.WIKI.$store)
    const emitter = rootEmit || (typeof WIKI !== 'undefined' && WIKI.$app) || (typeof window !== 'undefined' && window.WIKI)

    if (store && typeof store.set === 'function') {
      if (targetDraft.content !== undefined && targetDraft.content !== null) {
        store.set('editor/content', targetDraft.content)
      }
      if (targetDraft.title) {
        store.set('page/title', targetDraft.title)
      }
      if (targetDraft.description !== undefined && targetDraft.description !== null) {
        store.set('page/description', targetDraft.description)
      }
      if (Array.isArray(targetDraft.tags)) {
        store.set('page/tags', targetDraft.tags)
      }
    }

    if (emitter && typeof emitter.$emit === 'function') {
      emitter.$emit('overwriteEditorContent')
      emitter.$emit('workflowDraftRecovered', targetDraft)
    }

    commit('SET_RECOVERED', { recovered: true, draftId: targetDraft.id })
    return true
  },

  /**
   * Direct manual or automated saveDraft mutation call
   */
  async saveDraft({ commit, state, rootState }, payload = {}) {
    commit('SET_IS_SAVING', true)
    commit('SET_SAVE_STATUS', 'saving')
    commit('SET_ERROR_MESSAGE', null)

    const client = payload.apollo || (typeof WIKI !== 'undefined' && WIKI.$app && WIKI.$app.$apollo) || (typeof window !== 'undefined' && window.WIKI && window.WIKI.$apollo)
    if (!client) {
      commit('SET_IS_SAVING', false)
      commit('SET_SAVE_STATUS', 'error')
      commit('SET_ERROR_MESSAGE', 'Apollo client is not available')
      throw new Error('Apollo client is not available')
    }

    const draftId = payload.id !== undefined ? payload.id : (state.draft ? state.draft.id : null)
    const pageId = payload.pageId !== undefined ? payload.pageId : _.get(rootState, 'page.id', null)
    const path = payload.path || _.get(rootState, 'page.path')
    const locale = payload.locale || _.get(rootState, 'page.locale', 'pt-br')
    const title = payload.title || _.get(rootState, 'page.title', 'Untitled')
    const description = payload.description !== undefined ? payload.description : _.get(rootState, 'page.description', '')
    const content = payload.content !== undefined ? payload.content : _.get(rootState, 'editor.content', '')
    const contentType = payload.contentType || _.get(rootState, 'page.contentType', 'markdown')
    const editorKey = payload.editorKey || _.get(rootState, 'editor.editor', 'markdown')
    const tags = payload.tags !== undefined ? payload.tags : _.get(rootState, 'page.tags', [])
    const approvalMode = payload.approvalMode || (state.draft ? state.draft.approvalMode : (state.effectivePolicy && state.effectivePolicy.approvalLevels === 2 ? '2_levels' : '1_level'))

    try {
      const { data } = await client.mutate({
        mutation: MUTATION_SAVE_DRAFT,
        variables: {
          id: draftId,
          pageId,
          path,
          locale,
          title,
          description,
          content,
          contentType,
          editorKey,
          tags,
          approvalMode,
          baseHash: payload.baseHash || null
        }
      })

      if (data && data.workflow && data.workflow.saveDraft) {
        const result = data.workflow.saveDraft
        if (result.responseResult && result.responseResult.succeeded) {
          const updatedDraft = result.draft
          commit('SET_DRAFT', updatedDraft)
          const nowIso = new Date().toISOString()
          commit('SET_LAST_SAVED_TIME', updatedDraft.updatedAt || nowIso)
          commit('SET_SAVE_STATUS', 'saved')
          commit('SET_IS_SAVING', false)
          return updatedDraft
        } else {
          const msg = (result.responseResult && result.responseResult.message) || 'Erro ao salvar rascunho'
          commit('SET_SAVE_STATUS', 'error')
          commit('SET_ERROR_MESSAGE', msg)
          commit('SET_IS_SAVING', false)
          throw new Error(msg)
        }
      }
      throw new Error('Resposta vazia ao salvar rascunho')
    } catch (err) {
      commit('SET_IS_SAVING', false)
      commit('SET_SAVE_STATUS', 'error')
      commit('SET_ERROR_MESSAGE', err.message)
      throw err
    }
  },

  /**
   * Debounced autosave mechanism (30 seconds default delay)
   */
  triggerAutosave({ dispatch, commit, state }, { delay = 30000, getPayload, payload, apollo } = {}) {
    const currentState = state.draft ? state.draft.state : 'draft'
    if (currentState !== 'draft' && currentState !== 'changes_requested') {
      return Promise.resolve(null)
    }

    commit('SET_SAVE_STATUS', 'pending')

    if (autosaveTimeoutHandle) {
      clearTimeout(autosaveTimeoutHandle)
      autosaveTimeoutHandle = null
    }

    return new Promise((resolve, reject) => {
      autosaveTimeoutHandle = setTimeout(async () => {
        try {
          const actualPayload = typeof getPayload === 'function' ? getPayload() : (payload || {})
          const savedDraft = await dispatch('saveDraft', { ...actualPayload, apollo })
          resolve(savedDraft)
        } catch (err) {
          reject(err)
        } finally {
          autosaveTimeoutHandle = null
        }
      }, delay)
    })
  },

  /**
   * Cancel any pending autosave timer
   */
  cancelAutosave({ commit, state }) {
    if (autosaveTimeoutHandle) {
      clearTimeout(autosaveTimeoutHandle)
      autosaveTimeoutHandle = null
    }
    if (state.saveStatus === 'pending') {
      commit('SET_SAVE_STATUS', 'idle')
    }
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  getters,
  actions
}

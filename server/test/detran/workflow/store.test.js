const Vue = require('vue')
const Vuex = require('vuex')

// Import the Detran Workflow Vuex store module
const detranWorkflowModule = require('../../../../client/store/detran-workflow').default
const {
  getDefaultState,
  _clearAutosaveTimeoutHandle
} = require('../../../../client/store/detran-workflow')

Vue.use(Vuex)

describe('Detran Workflow - Vuex Store & Autosave (TDD - Etapa 2.2)', () => {
  let store
  let mockApollo

  beforeEach(() => {
    jest.useFakeTimers()
    _clearAutosaveTimeoutHandle()

    mockApollo = {
      mutate: jest.fn().mockResolvedValue({
        data: {
          workflow: {
            saveDraft: {
              responseResult: { succeeded: true, message: 'Rascunho salvo' },
              draft: {
                id: 42,
                path: 'normas/procedimento-01',
                locale: 'pt-br',
                title: 'Procedimento 01',
                content: 'Texto atualizado',
                state: 'draft',
                approvalMode: '1_level',
                currentLevel: 1,
                authorId: 101,
                updatedAt: new Date().toISOString()
              }
            }
          }
        }
      }),
      query: jest.fn().mockResolvedValue({
        data: {
          workflow: {
            policy: {
              pathPrefix: 'normas/',
              approvalLevels: 2,
              reviewIntervalDays: 365,
              autoArchiveOnExpire: false
            },
            draftByPath: {
              id: 42,
              path: 'normas/procedimento-01',
              locale: 'pt-br',
              title: 'Procedimento 01 - Rascunho',
              description: 'Descrição do rascunho',
              content: 'Conteúdo em tramitação recuperado',
              tags: ['norma', 'detran'],
              state: 'draft',
              approvalMode: '2_levels',
              currentLevel: 1,
              authorId: 101,
              updatedAt: '2026-10-16T12:00:00.000Z'
            }
          }
        }
      })
    }

    store = new Vuex.Store({
      modules: {
        detranWorkflow: {
          ...detranWorkflowModule,
          state: getDefaultState()
        }
      }
    })
  })

  afterEach(() => {
    _clearAutosaveTimeoutHandle()
    jest.useRealTimers()
  })

  // ---------------------------------------------------------------------------
  // 1. Initial State & Basic Mutations
  // ---------------------------------------------------------------------------
  test('1. Initial state has expected defaults', () => {
    const state = store.state.detranWorkflow
    expect(state.draft).toBeNull()
    expect(state.saveStatus).toBe('idle')
    expect(state.isSaving).toBe(false)
    expect(state.isRecovered).toBe(false)
    expect(state.autosaveIntervalMs).toBe(30000)
    expect(state.effectivePolicy.approvalLevels).toBe(1)
  })

  test('2. Mutations update state properly and RESET_WORKFLOW_STATE clears all', () => {
    store.commit('detranWorkflow/SET_SAVE_STATUS', 'pending')
    expect(store.state.detranWorkflow.saveStatus).toBe('pending')

    store.commit('detranWorkflow/SET_DRAFT', { id: 1, state: 'draft' })
    expect(store.state.detranWorkflow.draft.id).toBe(1)

    store.commit('detranWorkflow/SET_RECOVERED', { recovered: true, draftId: 1 })
    expect(store.state.detranWorkflow.isRecovered).toBe(true)
    expect(store.state.detranWorkflow.recoveredDraftId).toBe(1)

    store.commit('detranWorkflow/RESET_WORKFLOW_STATE')
    expect(store.state.detranWorkflow.draft).toBeNull()
    expect(store.state.detranWorkflow.saveStatus).toBe('idle')
    expect(store.state.detranWorkflow.isRecovered).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // 2. Autosave with Debounce of 30 Seconds
  // ---------------------------------------------------------------------------
  test('3. triggerAutosave executes saveDraft after 30 seconds of quiet time', async () => {
    const payload = {
      path: 'normas/procedimento-01',
      title: 'Procedimento 01',
      content: 'Conteúdo inicial alterado'
    }

    const promise = store.dispatch('detranWorkflow/triggerAutosave', {
      delay: 30000,
      apollo: mockApollo,
      payload
    })

    // Immediately: status is pending, no mutation call yet
    expect(store.state.detranWorkflow.saveStatus).toBe('pending')
    expect(mockApollo.mutate).not.toHaveBeenCalled()

    // Advance 10s: still pending, no call
    jest.advanceTimersByTime(10000)
    expect(store.state.detranWorkflow.saveStatus).toBe('pending')
    expect(mockApollo.mutate).not.toHaveBeenCalled()

    // Advance remaining 20s (total 30s)
    jest.advanceTimersByTime(20000)

    await promise

    // Mutation should have fired exactly once
    expect(mockApollo.mutate).toHaveBeenCalledTimes(1)
    expect(store.state.detranWorkflow.saveStatus).toBe('saved')
    expect(store.state.detranWorkflow.isSaving).toBe(false)
    expect(store.state.detranWorkflow.draft.id).toBe(42)
  })

  test('4. Multiple rapid keystrokes debounce and execute ONLY ONCE 30s after the last call', async () => {
    // Keystroke 1 at t = 0s
    let p = store.dispatch('detranWorkflow/triggerAutosave', {
      delay: 30000,
      apollo: mockApollo,
      payload: { path: 'doc', title: 'Doc', content: 'v1' }
    })

    // Advance 15s, Keystroke 2 at t = 15s
    jest.advanceTimersByTime(15000)
    expect(mockApollo.mutate).not.toHaveBeenCalled()

    p = store.dispatch('detranWorkflow/triggerAutosave', {
      delay: 30000,
      apollo: mockApollo,
      payload: { path: 'doc', title: 'Doc', content: 'v2' }
    })

    // Advance 20s (t = 35s total, but only 20s since Keystroke 2)
    jest.advanceTimersByTime(20000)
    expect(mockApollo.mutate).not.toHaveBeenCalled() // Still debouncing!

    // Advance remaining 10s (t = 45s total, 30s since Keystroke 2)
    jest.advanceTimersByTime(10000)

    await p

    expect(mockApollo.mutate).toHaveBeenCalledTimes(1)
    const mutateCallVars = mockApollo.mutate.mock.calls[0][0].variables
    expect(mutateCallVars.content).toBe('v2') // Saved the latest content
  })

  test('5. Continuous typing simulation (15 keystrokes every 2s) triggers exactly 1 save 30s after typing stops', async () => {
    let lastPromise = null

    // User types every 2 seconds for 30 seconds (15 keystrokes)
    for (let i = 1; i <= 15; i++) {
      jest.advanceTimersByTime(2000)
      lastPromise = store.dispatch('detranWorkflow/triggerAutosave', {
        delay: 30000,
        apollo: mockApollo,
        payload: {
          path: 'normas/resolucao-02',
          title: 'Resolução 02',
          content: `Texto digitado no passo ${i}`
        }
      })
      // During active typing, no save should have fired
      expect(mockApollo.mutate).not.toHaveBeenCalled()
    }

    // Now user stops typing. Advance 29 seconds: still no save
    jest.advanceTimersByTime(29000)
    expect(mockApollo.mutate).not.toHaveBeenCalled()

    // Advance 1 more second (30 seconds of quiet time)
    jest.advanceTimersByTime(1000)

    await lastPromise

    // Exactly 1 save executed with the final content from step 15
    expect(mockApollo.mutate).toHaveBeenCalledTimes(1)
    const vars = mockApollo.mutate.mock.calls[0][0].variables
    expect(vars.content).toBe('Texto digitado no passo 15')
    expect(store.state.detranWorkflow.saveStatus).toBe('saved')
  })

  // ---------------------------------------------------------------------------
  // 3. Draft Recovery Mechanism
  // ---------------------------------------------------------------------------
  test('6. recoverDraft updates editor content, page metadata and emits overwriteEditorContent', async () => {
    const storeMap = {}
    const mockRootStore = {
      set: jest.fn((key, val) => { storeMap[key] = val })
    }
    const mockRootEmit = {
      $emit: jest.fn()
    }

    const inFlightDraft = {
      id: 88,
      title: 'Portaria Presidência - Revisão',
      description: 'Atualização de competências',
      content: '# Portaria 2026/01\nArt. 1º Fica homologado...',
      tags: ['portaria', 'detran']
    }

    const result = await store.dispatch('detranWorkflow/recoverDraft', {
      draft: inFlightDraft,
      rootStore: mockRootStore,
      rootEmit: mockRootEmit
    })

    expect(result).toBe(true)
    expect(mockRootStore.set).toHaveBeenCalledWith('editor/content', inFlightDraft.content)
    expect(mockRootStore.set).toHaveBeenCalledWith('page/title', inFlightDraft.title)
    expect(mockRootStore.set).toHaveBeenCalledWith('page/description', inFlightDraft.description)
    expect(mockRootStore.set).toHaveBeenCalledWith('page/tags', inFlightDraft.tags)

    expect(mockRootEmit.$emit).toHaveBeenCalledWith('overwriteEditorContent')
    expect(mockRootEmit.$emit).toHaveBeenCalledWith('workflowDraftRecovered', inFlightDraft)

    expect(store.state.detranWorkflow.isRecovered).toBe(true)
    expect(store.state.detranWorkflow.recoveredDraftId).toBe(88)
  })

  test('7. loadDraftAndPolicy automatically triggers draft recovery when active draft exists', async () => {
    const mockRootStore = { set: jest.fn() }
    const mockRootEmit = { $emit: jest.fn() }

    await store.dispatch('detranWorkflow/loadDraftAndPolicy', {
      apollo: mockApollo,
      path: 'normas/procedimento-01',
      locale: 'pt-br',
      autoRecover: true,
      rootStore: mockRootStore,
      rootEmit: mockRootEmit
    })

    expect(mockApollo.query).toHaveBeenCalledTimes(1)
    expect(store.state.detranWorkflow.draft.id).toBe(42)
    expect(store.state.detranWorkflow.effectivePolicy.approvalLevels).toBe(2)
    expect(store.state.detranWorkflow.isRecovered).toBe(true)

    // Editor content populated with in-flight draft
    expect(mockRootStore.set).toHaveBeenCalledWith('editor/content', 'Conteúdo em tramitação recuperado')
    expect(mockRootEmit.$emit).toHaveBeenCalledWith('overwriteEditorContent')
  })

  // ---------------------------------------------------------------------------
  // 4. Cancel Autosave & Non-editable State Guards
  // ---------------------------------------------------------------------------
  test('8. cancelAutosave prevents scheduled save and resets status to idle', async () => {
    store.dispatch('detranWorkflow/triggerAutosave', {
      delay: 30000,
      apollo: mockApollo,
      payload: { path: 'doc', content: 'test' }
    })
    expect(store.state.detranWorkflow.saveStatus).toBe('pending')

    store.dispatch('detranWorkflow/cancelAutosave')
    expect(store.state.detranWorkflow.saveStatus).toBe('idle')

    jest.advanceTimersByTime(35000)
    expect(mockApollo.mutate).not.toHaveBeenCalled()
  })

  test('9. triggerAutosave is blocked if draft is locked under review or published', async () => {
    store.commit('detranWorkflow/SET_DRAFT', { id: 1, state: 'in_review' })

    await store.dispatch('detranWorkflow/triggerAutosave', {
      delay: 30000,
      apollo: mockApollo,
      payload: { path: 'doc', content: 'test' }
    })

    jest.advanceTimersByTime(35000)
    expect(mockApollo.mutate).not.toHaveBeenCalled()
    expect(store.state.detranWorkflow.saveStatus).toBe('idle')
  })

  test('10. saveDraft sets error status when Apollo client fails', async () => {
    mockApollo.mutate.mockRejectedValueOnce(new Error('Conexão perdida com o servidor'))

    await expect(store.dispatch('detranWorkflow/saveDraft', {
      apollo: mockApollo,
      path: 'doc',
      content: 'fail'
    })).rejects.toThrow('Conexão perdida com o servidor')

    expect(store.state.detranWorkflow.saveStatus).toBe('error')
    expect(store.state.detranWorkflow.errorMessage).toBe('Conexão perdida com o servidor')
    expect(store.state.detranWorkflow.isSaving).toBe(false)
  })
})

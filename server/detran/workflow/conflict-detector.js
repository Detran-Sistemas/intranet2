const { ConcurrencyConflictError } = require('./errors')

/**
 * Optimistic Concurrency & Conflict Detection
 * Compares the draft's baseHash against the currently published page version
 * to prevent accidental overwrites when multiple edits occur concurrently.
 */
module.exports = {
  /**
   * Check for concurrency conflicts between a draft and the published live page.
   *
   * @param {Object} draft - DetranWfDraft instance or plain object
   * @param {Object|null} livePage - Current published Page instance from database, or null
   * @returns {{ hasConflict: boolean, reason?: string, type?: string, baseHash?: string, currentHash?: string }}
   */
  checkConflict(draft, livePage) {
    if (!draft) {
      return { hasConflict: false }
    }

    // Case 1: Draft of an existing page (pageId is present)
    if (draft.pageId) {
      if (!livePage) {
        return {
          hasConflict: true,
          type: 'PAGE_DELETED',
          reason: 'The original page was deleted from the portal while this draft was in review.'
        }
      }

      // Check hash mismatch
      if (draft.baseHash && livePage.hash && draft.baseHash !== livePage.hash) {
        return {
          hasConflict: true,
          type: 'MODIFIED_WHILE_IN_REVIEW',
          baseHash: draft.baseHash,
          currentHash: livePage.hash,
          reason: `The page was modified in production (version ${livePage.hash.substring(0, 8)}) while this draft was based on version ${draft.baseHash.substring(0, 8)}.`
        }
      }

      return { hasConflict: false }
    }

    // Case 2: Draft for a brand new page (pageId is null)
    if (livePage) {
      return {
        hasConflict: true,
        type: 'PATH_TAKEN',
        currentHash: livePage.hash,
        reason: 'Another document was published at this path while this new draft was being prepared.'
      }
    }

    return { hasConflict: false }
  },

  /**
   * Asserts that no conflict exists, throwing ConcurrencyConflictError if one is detected.
   *
   * @param {Object} draft
   * @param {Object|null} livePage
   * @throws {ConcurrencyConflictError}
   */
  assertNoConflict(draft, livePage) {
    const result = this.checkConflict(draft, livePage)
    if (result.hasConflict) {
      throw new ConcurrencyConflictError(result.reason, result)
    }
  }
}

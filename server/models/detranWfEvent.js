const Model = require('objection').Model

/**
 * Detran Workflow Events Model
 * Immutable audit trail tracking all actions and transitions in the document workflow.
 */
module.exports = class DetranWfEvent extends Model {
  static get tableName() {
    return 'detranWfEvents'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['draftId', 'action', 'fromState', 'toState', 'userId'],

      properties: {
        id: { type: 'integer' },
        draftId: { type: 'integer' },
        action: { type: 'string' },
        fromState: { type: 'string' },
        toState: { type: 'string' },
        userId: { type: 'integer' },
        comment: { type: ['string', 'null'] },
        createdAt: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    return {
      draft: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./detranWfDraft'),
        join: {
          from: 'detranWfEvents.draftId',
          to: 'detranWfDrafts.id'
        }
      },
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'detranWfEvents.userId',
          to: 'users.id'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
  }
}

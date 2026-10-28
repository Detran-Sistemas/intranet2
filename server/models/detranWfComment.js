const Model = require('objection').Model

/**
 * Detran Workflow Comments Model
 * Line-anchored or contextual comments made by reviewers on drafts.
 */
module.exports = class DetranWfComment extends Model {
  static get tableName() {
    return 'detranWfComments'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['draftId', 'userId', 'body'],

      properties: {
        id: { type: 'integer' },
        draftId: { type: 'integer' },
        userId: { type: 'integer' },
        lineNumber: { type: ['integer', 'null'] },
        anchorText: { type: ['string', 'null'] },
        body: { type: 'string' },
        resolved: { type: 'boolean', default: false },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    return {
      draft: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./detranWfDraft'),
        join: {
          from: 'detranWfComments.draftId',
          to: 'detranWfDrafts.id'
        }
      },
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'detranWfComments.userId',
          to: 'users.id'
        }
      }
    }
  }

  $beforeInsert() {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
    if (this.resolved === undefined) {
      this.resolved = false
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  $parseDatabaseJson(json) {
    json = super.$parseDatabaseJson(json)
    if (json.resolved !== undefined) {
      json.resolved = Boolean(json.resolved)
    }
    return json
  }
}

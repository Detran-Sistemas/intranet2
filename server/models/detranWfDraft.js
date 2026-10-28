const Model = require('objection').Model

/**
 * Detran Workflow Drafts Model
 * Represents drafts and in-flight revisions for intranet documents.
 */
module.exports = class DetranWfDraft extends Model {
  static get tableName() {
    return 'detranWfDrafts'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['path', 'title', 'content', 'authorId'],

      properties: {
        id: { type: 'integer' },
        pageId: { type: ['integer', 'null'] },
        path: { type: 'string' },
        locale: { type: 'string', default: 'pt-br' },
        title: { type: 'string' },
        description: { type: ['string', 'null'] },
        content: { type: 'string' },
        contentType: { type: 'string', default: 'markdown' },
        editorKey: { type: 'string', default: 'markdown' },
        tags: { type: ['array', 'object', 'null'] },
        state: { type: 'string', default: 'draft' },
        approvalMode: { type: 'string', default: '1_level' },
        currentLevel: { type: 'integer', default: 1 },
        authorId: { type: 'integer' },
        baseHash: { type: ['string', 'null'] },
        reviewDueDate: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  static get jsonAttributes() {
    return ['tags']
  }

  static get relationMappings() {
    return {
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'detranWfDrafts.pageId',
          to: 'pages.id'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'detranWfDrafts.authorId',
          to: 'users.id'
        }
      },
      events: {
        relation: Model.HasManyRelation,
        modelClass: require('./detranWfEvent'),
        join: {
          from: 'detranWfDrafts.id',
          to: 'detranWfEvents.draftId'
        }
      },
      comments: {
        relation: Model.HasManyRelation,
        modelClass: require('./detranWfComment'),
        join: {
          from: 'detranWfDrafts.id',
          to: 'detranWfComments.draftId'
        }
      }
    }
  }

  $beforeInsert() {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
    if (!this.locale) {
      this.locale = 'pt-br'
    }
    if (!this.state) {
      this.state = 'draft'
    }
    if (!this.approvalMode) {
      this.approvalMode = '1_level'
    }
    if (!this.currentLevel) {
      this.currentLevel = 1
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
}

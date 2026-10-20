/**
 * Detran-MG Workflow Migration
 * Creates workflow tables: detranWfDrafts, detranWfEvents, detranWfComments, detranWfPolicies
 * Supports both PostgreSQL and SQLite.
 */

exports.up = async knex => {
  // 1. POLICIES TABLE (Prefix rules, approval levels, validity interval)
  const hasPolicies = await knex.schema.hasTable('detranWfPolicies')
  if (!hasPolicies) {
    await knex.schema.createTable('detranWfPolicies', table => {
      table.increments('id').primary()
      table.string('pathPrefix').notNullable().unique()
      table.integer('approvalLevels').notNullable().defaultTo(1)
      table.integer('reviewIntervalDays').notNullable().defaultTo(365)
      table.boolean('autoArchiveOnExpire').notNullable().defaultTo(false)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
  }

  // 2. DRAFTS TABLE (Forward revisions and unpublished drafts)
  const hasDrafts = await knex.schema.hasTable('detranWfDrafts')
  if (!hasDrafts) {
    await knex.schema.createTable('detranWfDrafts', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().nullable().references('id').inTable('pages').onDelete('SET NULL')
      table.string('path').notNullable()
      table.string('locale', 10).notNullable().defaultTo('pt-br')
      table.string('title').notNullable()
      table.text('description').nullable()
      table.text('content').notNullable()
      table.string('contentType', 50).notNullable().defaultTo('markdown')
      table.string('editorKey', 50).notNullable().defaultTo('markdown')
      table.json('tags').nullable()
      table.string('state', 50).notNullable().defaultTo('draft')
      table.string('approvalMode', 20).notNullable().defaultTo('1_level')
      table.integer('currentLevel').notNullable().defaultTo(1)
      table.integer('authorId').unsigned().notNullable().references('id').inTable('users')
      table.string('baseHash', 64).nullable()
      table.string('reviewDueDate').nullable()
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()

      table.index(['state'], 'idx_detran_wf_drafts_state')
      table.index(['path', 'locale'], 'idx_detran_wf_drafts_path_locale')
      table.index(['authorId'], 'idx_detran_wf_drafts_author')
    })
  }

  // 3. EVENTS TABLE (Immutable audit log)
  const hasEvents = await knex.schema.hasTable('detranWfEvents')
  if (!hasEvents) {
    await knex.schema.createTable('detranWfEvents', table => {
      table.increments('id').primary()
      table.integer('draftId').unsigned().notNullable().references('id').inTable('detranWfDrafts').onDelete('CASCADE')
      table.string('action', 50).notNullable()
      table.string('fromState', 50).notNullable()
      table.string('toState', 50).notNullable()
      table.integer('userId').unsigned().notNullable().references('id').inTable('users')
      table.text('comment').nullable()
      table.string('createdAt').notNullable()

      table.index(['draftId'], 'idx_detran_wf_events_draft')
      table.index(['userId'], 'idx_detran_wf_events_user')
    })
  }

  // 4. COMMENTS TABLE (Contextual line annotations)
  const hasComments = await knex.schema.hasTable('detranWfComments')
  if (!hasComments) {
    await knex.schema.createTable('detranWfComments', table => {
      table.increments('id').primary()
      table.integer('draftId').unsigned().notNullable().references('id').inTable('detranWfDrafts').onDelete('CASCADE')
      table.integer('userId').unsigned().notNullable().references('id').inTable('users')
      table.integer('lineNumber').nullable()
      table.text('anchorText').nullable()
      table.text('body').notNullable()
      table.boolean('resolved').notNullable().defaultTo(false)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()

      table.index(['draftId'], 'idx_detran_wf_comments_draft')
    })
  }
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('detranWfComments')
  await knex.schema.dropTableIfExists('detranWfEvents')
  await knex.schema.dropTableIfExists('detranWfDrafts')
  await knex.schema.dropTableIfExists('detranWfPolicies')
}

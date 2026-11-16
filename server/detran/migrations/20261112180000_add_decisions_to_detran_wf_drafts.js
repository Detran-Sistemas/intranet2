/**
 * Detran-MG Workflow Migration: Add decisions column to detranWfDrafts
 * Stores persisted reviewer decisions for visual diff suggestions (e.g. {"sug-1": "accepted", "sug-2": "rejected"})
 */

exports.up = async knex => {
  const hasColumn = await knex.schema.hasColumn('detranWfDrafts', 'decisions')
  if (!hasColumn) {
    await knex.schema.alterTable('detranWfDrafts', table => {
      table.text('decisions').nullable()
    })
  }
}

exports.down = async knex => {
  const hasColumn = await knex.schema.hasColumn('detranWfDrafts', 'decisions')
  if (hasColumn) {
    await knex.schema.alterTable('detranWfDrafts', table => {
      table.dropColumn('decisions')
    })
  }
}

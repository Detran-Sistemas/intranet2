const path = require('path')

/**
 * Standalone Migrator for Detran-MG Workflow.
 * Uses a dedicated migrations table (`detran_migrations`) to avoid
 * conflicting with Wiki.js core migrations.
 */
module.exports = {
  migrationConfig: {
    tableName: 'detran_migrations',
    directory: path.join(__dirname, '../migrations')
  },

  /**
   * Run all pending Detran workflow migrations
   * @param {import('knex')} knex
   */
  async up(knex) {
    const [batchNo, log] = await knex.migrate.latest(this.migrationConfig)
    return { batchNo, log }
  },

  /**
   * Rollback the latest batch of Detran workflow migrations
   * @param {import('knex')} knex
   */
  async down(knex) {
    const [batchNo, log] = await knex.migrate.rollback(this.migrationConfig)
    return { batchNo, log }
  }
}

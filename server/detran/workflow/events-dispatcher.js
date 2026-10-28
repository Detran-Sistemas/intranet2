const { EventEmitter } = require('events')
const https = require('https')
const http = require('http')
const url = require('url')
const _ = require('lodash')

/**
 * Detran Workflow Events Dispatcher
 * Decoupled event bus connecting workflow transitions to email notifications and MS Teams webhooks.
 */
class WorkflowEventsDispatcher extends EventEmitter {
  constructor() {
    super()
    this.teamsWebhookUrl = null
    this.registerInternalListeners()
  }

  /**
   * Set Microsoft Teams Webhook URL for notifications
   *
   * @param {string|null} webhookUrl
   */
  setTeamsWebhookUrl(webhookUrl) {
    this.teamsWebhookUrl = webhookUrl
  }

  /**
   * Get configured Teams Webhook URL
   *
   * @returns {string|null}
   */
  getTeamsWebhookUrl() {
    return (
      this.teamsWebhookUrl ||
      _.get(global, 'WIKI.config.detranWorkflow.teamsWebhookUrl', null) ||
      process.env.DETRAN_WF_TEAMS_WEBHOOK_URL ||
      null
    )
  }

  /**
   * Resolve base host URL from WIKI config or fallback
   *
   * @returns {string}
   */
  getBaseHost() {
    return _.get(global, 'WIKI.config.host', 'http://localhost:3000').replace(/\/$/, '')
  }

  /**
   * Fetch user details by ID
   *
   * @param {number} userId
   * @returns {Promise<{ id: number, name: string, email: string }>}
   */
  async resolveUser(userId) {
    if (!userId) {
      return { id: 0, name: 'Servidor', email: 'workflow@detran.mg.gov.br' }
    }

    try {
      if (global.WIKI && global.WIKI.models && global.WIKI.models.users) {
        const u = await global.WIKI.models.users.query().findById(userId)
        if (u) {
          return { id: u.id, name: u.name, email: u.email }
        }
      }
    } catch {
      // Fallback
    }

    return { id: userId, name: `Servidor #${userId}`, email: `servidor${userId}@detran.mg.gov.br` }
  }

  /**
   * Register decoupled listeners for workflow transitions
   */
  registerInternalListeners() {
    // 1. Document Submitted
    this.on('wf:submitted', async (payload) => {
      await this.handleSubmitted(payload)
      await this.handleTeamsNotification('wf:submitted', payload)
    })

    // 2. Adjustments Requested
    this.on('wf:changes_requested', async (payload) => {
      await this.handleChangesRequested(payload)
      await this.handleTeamsNotification('wf:changes_requested', payload)
    })

    // 3. Technical Step Approved (Nível 1)
    this.on('wf:approved_step', async (payload) => {
      await this.handleTeamsNotification('wf:approved_step', payload)
    })

    // 4. Document Published Officially
    this.on('wf:published', async (payload) => {
      await this.handlePublished(payload)
      await this.handleTeamsNotification('wf:published', payload)
    })

    // 5. Document Revalidated
    this.on('wf:revalidated', async (payload) => {
      await this.handleTeamsNotification('wf:revalidated', payload)
    })

    // 6. Document Validity Expired (Periodic Review Due)
    this.on('wf:expired', async (payload) => {
      await this.handleExpired(payload)
      await this.handleTeamsNotification('wf:expired', payload)
    })
  }

  /**
   * Handle 'wf:submitted' notification
   */
  async handleSubmitted({ draft, user, comment }) {
    if (!draft) return
    const author = await this.resolveUser(draft.authorId)
    const baseHost = this.getBaseHost()
    const reviewUrl = `${baseHost}/w/review/${draft.id}`

    // Send confirmation or reviewer notification
    await this.sendEmail({
      template: 'detran-wf-submitted',
      to: author.email,
      subject: `[Workflow Detran-MG] Documento submetido para revisão: ${draft.title}`,
      data: {
        draft,
        author,
        comment: comment || null,
        reviewUrl,
        copyright: _.get(global, 'WIKI.config.company', 'Detran-MG • Intranet Institucional')
      }
    })
  }

  /**
   * Handle 'wf:changes_requested' notification
   */
  async handleChangesRequested({ draft, user, comment }) {
    if (!draft) return
    const author = await this.resolveUser(draft.authorId)
    const baseHost = this.getBaseHost()
    const editUrl = `${baseHost}/e/${draft.locale}/${draft.path}`

    await this.sendEmail({
      template: 'detran-wf-changes-requested',
      to: author.email,
      subject: `[Workflow Detran-MG] Ajustes solicitados: ${draft.title}`,
      data: {
        draft,
        author,
        reviewer: user || { name: 'Revisor Técnico' },
        comment: comment || 'Ajustes necessários indicados na revisão.',
        editUrl,
        copyright: _.get(global, 'WIKI.config.company', 'Detran-MG • Intranet Institucional')
      }
    })
  }

  /**
   * Handle 'wf:published' notification
   */
  async handlePublished({ draft, user, comment, pageId }) {
    if (!draft) return
    const author = await this.resolveUser(draft.authorId)
    const baseHost = this.getBaseHost()
    const liveUrl = `${baseHost}/${draft.locale}/${draft.path}`

    await this.sendEmail({
      template: 'detran-wf-published',
      to: author.email,
      subject: `[Workflow Detran-MG] Documento homologado e publicado: ${draft.title}`,
      data: {
        draft,
        author,
        approver: user || { name: 'Aprovador Institucional' },
        comment: comment || null,
        liveUrl,
        copyright: _.get(global, 'WIKI.config.company', 'Detran-MG • Intranet Institucional')
      }
    })
  }

  /**
   * Handle 'wf:expired' notification
   */
  async handleExpired({ draft, user, comment }) {
    if (!draft) return
    const author = await this.resolveUser(draft.authorId)
    const baseHost = this.getBaseHost()
    const reviewUrl = `${baseHost}/w/review/${draft.id}`

    await this.sendEmail({
      template: 'detran-wf-expired',
      to: author.email,
      subject: `[Workflow Detran-MG] Vigência Expirada - Revisão Periódica Necessária: ${draft.title}`,
      data: {
        draft,
        author,
        comment: comment || 'O prazo de vigência de 12 meses expirou.',
        reviewUrl,
        copyright: _.get(global, 'WIKI.config.company', 'Detran-MG • Intranet Institucional')
      }
    })
  }

  /**
   * Helper to dispatch email via WIKI.mail.send safely without throwing exceptions.
   */
  async sendEmail(opts) {
    if (!global.WIKI || !global.WIKI.mail || typeof global.WIKI.mail.send !== 'function') {
      return false
    }

    try {
      await global.WIKI.mail.send(opts)
      return true
    } catch (err) {
      if (global.WIKI && global.WIKI.logger && typeof global.WIKI.logger.warn === 'function') {
        global.WIKI.logger.warn(`[Detran Workflow] Falha ao enviar e-mail "${opts.template}": ${err.message}`)
      }
      return false
    }
  }

  /**
   * Dispatch Microsoft Teams Webhook notification if configured
   */
  async handleTeamsNotification(eventName, { draft, user, comment }) {
    const webhookUrl = this.getTeamsWebhookUrl()
    if (!webhookUrl || !draft) return false

    const baseHost = this.getBaseHost()
    let themeColor = '288b4a'
    let title = 'Workflow Institucional Detran-MG'
    let text = ''

    if (eventName === 'wf:submitted') {
      themeColor = '288b4a'
      title = `📋 Documento Submetido para Revisão: ${draft.title}`
      text = `O servidor **${user?.name || 'Autor'}** submeteu o documento \`/${draft.locale}/${draft.path}\` para apreciação técnica.`
    } else if (eventName === 'wf:changes_requested') {
      themeColor = 'd97706'
      title = `⚠️ Ajustes Solicitados: ${draft.title}`
      text = `O revisor **${user?.name || 'Revisor'}** solicitou ajustes no documento.\n\n> Parecer: "${comment || ''}"`
    } else if (eventName === 'wf:approved_step') {
      themeColor = '0284c7'
      title = `✅ Nível 1 Aprovado: ${draft.title}`
      text = `O revisor **${user?.name || 'Revisor'}** aprovou o Nível 1. Documento avançou para homologação final.`
    } else if (eventName === 'wf:published') {
      themeColor = '16a34a'
      title = `🎉 Documento Homologado e Publicado: ${draft.title}`
      text = `O homologador **${user?.name || 'Aprovador'}** publicou oficialmente o documento na Intranet Detran-MG.`
    } else if (eventName === 'wf:revalidated') {
      themeColor = '0d9488'
      title = `🔄 Vigência Renovada (+12m): ${draft.title}`
      text = `A vigência do ato normativo foi revalidada por mais 12 meses por **${user?.name || 'Gestor'}**.`
    } else if (eventName === 'wf:expired') {
      themeColor = 'b91c1c'
      title = `⏰ Revisão Periódica Expirada: ${draft.title}`
      text = `A vigência de 12 meses do ato normativo \`/${draft.locale}/${draft.path}\` expirou. O documento entrou em revisão periódica para revalidação.`
    }

    const cardPayload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor,
      summary: title,
      title,
      text,
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'Abrir no Sistema',
          targets: [
            {
              os: 'default',
              uri: `${baseHost}/w/review/${draft.id}`
            }
          ]
        }
      ]
    }

    return this.postJson(webhookUrl, cardPayload)
  }

  /**
   * HTTP POST helper for webhooks
   */
  postJson(targetUrl, data) {
    return new Promise((resolve) => {
      try {
        const parsed = url.parse(targetUrl)
        const isHttps = parsed.protocol === 'https:'
        const client = isHttps ? https : http
        const payloadString = JSON.stringify(data)

        const req = client.request(
          {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.path,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payloadString)
            },
            timeout: 5000
          },
          (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 300)
          }
        )

        req.on('error', () => resolve(false))
        req.on('timeout', () => {
          req.destroy()
          resolve(false)
        })

        req.write(payloadString)
        req.end()
      } catch {
        resolve(false)
      }
    })
  }

  /**
   * Main dispatch method
   * Emits event asynchronously on next tick so callers are not blocked.
   *
   * @param {string} eventName - e.g. 'wf:submitted', 'wf:changes_requested', 'wf:published'
   * @param {object} payload - { draft, user, comment, pageId }
   */
  dispatch(eventName, payload) {
    process.nextTick(() => {
      this.emit(eventName, payload)
    })
  }
}

module.exports = new WorkflowEventsDispatcher()

const path = require('path')
const fs = require('fs-extra')
const _ = require('lodash')
const eventsDispatcher = require('../../../detran/workflow/events-dispatcher')

describe('Etapa 3.3: E-mails Institucionais e Barramento de Eventos', () => {
  let originalWiki
  let mailSendSpy

  beforeAll(() => {
    originalWiki = global.WIKI
    mailSendSpy = jest.fn().mockResolvedValue(true)

    global.WIKI = {
      config: {
        host: 'https://intranet.detran.mg.gov.br',
        title: 'Intranet Detran-MG',
        company: 'Detran-MG • Polícia Civil',
        mail: {
          senderName: 'Workflow Detran-MG',
          senderEmail: 'workflow@detran.mg.gov.br'
        }
      },
      models: {
        users: {
          query() {
            return {
              findById: jest.fn().mockImplementation((id) => {
                return Promise.resolve({
                  id,
                  name: `Servidor Nome ${id}`,
                  email: `servidor${id}@detran.mg.gov.br`
                })
              })
            }
          }
        }
      },
      mail: {
        send: mailSendSpy
      },
      logger: {
        warn: jest.fn()
      }
    }
  })

  afterAll(() => {
    global.WIKI = originalWiki
  })

  beforeEach(() => {
    jest.clearAllMocks()
    eventsDispatcher.setTeamsWebhookUrl(null)
  })

  describe('1. Validação de Sintaxe dos Templates HTML Institucionais', () => {
    it('deve compilar e renderizar detran-wf-submitted.html com lodash template', async () => {
      const tmplPath = path.join(__dirname, '../../../templates/detran-wf-submitted.html')
      const tmplContent = await fs.readFile(tmplPath, 'utf8')
      const compiled = _.template(tmplContent)

      const rendered = compiled({
        draft: {
          title: 'Portaria Detran nº 123/2026',
          locale: 'pt-BR',
          path: 'normas/portaria-123',
          approvalMode: '2_levels'
        },
        author: {
          name: 'João Silva',
          email: 'joao.silva@detran.mg.gov.br'
        },
        comment: 'Solicito apreciação urgente para publicação no Diário.',
        reviewUrl: 'https://intranet.detran.mg.gov.br/w/review/42',
        copyright: 'Detran-MG • Polícia Civil'
      })

      expect(rendered).toContain('Portaria Detran nº 123/2026')
      expect(rendered).toContain('/pt-BR/normas/portaria-123')
      expect(rendered).toContain('João Silva')
      expect(rendered).toContain('Solicito apreciação urgente')
      expect(rendered).toContain('https://intranet.detran.mg.gov.br/w/review/42')
      expect(rendered).toContain('Fluxo em 2 Níveis')
    })

    it('deve compilar e renderizar detran-wf-changes-requested.html', async () => {
      const tmplPath = path.join(__dirname, '../../../templates/detran-wf-changes-requested.html')
      const tmplContent = await fs.readFile(tmplPath, 'utf8')
      const compiled = _.template(tmplContent)

      const rendered = compiled({
        draft: {
          title: 'Instrução de Serviço nº 45/2026',
          locale: 'pt-BR',
          path: 'habilitacao/is-45'
        },
        author: {
          name: 'Maria Souza',
          email: 'maria.souza@detran.mg.gov.br'
        },
        reviewer: {
          name: 'Carlos Oliveira (Revisor)'
        },
        comment: 'Adequar a fundamentação com base na Resolução Contran nº 900.',
        editUrl: 'https://intranet.detran.mg.gov.br/e/pt-BR/habilitacao/is-45',
        copyright: 'Detran-MG'
      })

      expect(rendered).toContain('Instrução de Serviço nº 45/2026')
      expect(rendered).toContain('Maria Souza')
      expect(rendered).toContain('Carlos Oliveira')
      expect(rendered).toContain('Resolução Contran nº 900')
      expect(rendered).toContain('Abrir no Editor para Ajustar')
    })

    it('deve compilar e renderizar detran-wf-published.html', async () => {
      const tmplPath = path.join(__dirname, '../../../templates/detran-wf-published.html')
      const tmplContent = await fs.readFile(tmplPath, 'utf8')
      const compiled = _.template(tmplContent)

      const rendered = compiled({
        draft: {
          title: 'Resolução Conjunta nº 88/2026',
          locale: 'pt-BR',
          path: 'normas/resolucao-88',
          reviewDueDate: '16/10/2027'
        },
        author: {
          name: 'Ana Pereira'
        },
        approver: {
          name: 'Diretor Geral do Detran-MG'
        },
        comment: 'Homologação oficial concluída com sucesso.',
        liveUrl: 'https://intranet.detran.mg.gov.br/pt-BR/normas/resolucao-88',
        copyright: 'Detran-MG'
      })

      expect(rendered).toContain('Resolução Conjunta nº 88/2026')
      expect(rendered).toContain('Diretor Geral do Detran-MG')
      expect(rendered).toContain('16/10/2027')
      expect(rendered).toContain('Acessar Documento na Intranet')
    })
  })

  describe('2. Barramento de Eventos e Envio de E-mails via WIKI.mail.send', () => {
    it('deve emitir wf:submitted e disparar template detran-wf-submitted', async () => {
      const draft = {
        id: 10,
        title: 'Portaria de Teste',
        locale: 'pt-BR',
        path: 'portarias/teste',
        authorId: 100,
        approvalMode: '1_level'
      }

      await eventsDispatcher.handleSubmitted({
        draft,
        user: { id: 100, name: 'Autor' },
        comment: 'Nova proposta para revisão'
      })

      expect(mailSendSpy).toHaveBeenCalledTimes(1)
      const callArgs = mailSendSpy.mock.calls[0][0]
      expect(callArgs.template).toBe('detran-wf-submitted')
      expect(callArgs.to).toBe('servidor100@detran.mg.gov.br')
      expect(callArgs.subject).toContain('Portaria de Teste')
      expect(callArgs.data.reviewUrl).toBe('https://intranet.detran.mg.gov.br/w/review/10')
    })

    it('deve emitir wf:changes_requested e disparar template detran-wf-changes-requested', async () => {
      const draft = {
        id: 20,
        title: 'Norma de Veículos',
        locale: 'pt-BR',
        path: 'veiculos/norma',
        authorId: 200
      }

      await eventsDispatcher.handleChangesRequested({
        draft,
        user: { id: 300, name: 'Revisor Técnico' },
        comment: 'Reescrever o Artigo 3º.'
      })

      expect(mailSendSpy).toHaveBeenCalledTimes(1)
      const callArgs = mailSendSpy.mock.calls[0][0]
      expect(callArgs.template).toBe('detran-wf-changes-requested')
      expect(callArgs.to).toBe('servidor200@detran.mg.gov.br')
      expect(callArgs.data.comment).toBe('Reescrever o Artigo 3º.')
      expect(callArgs.data.editUrl).toBe('https://intranet.detran.mg.gov.br/e/pt-BR/veiculos/norma')
    })

    it('deve emitir wf:published e disparar template detran-wf-published', async () => {
      const draft = {
        id: 30,
        title: 'Portaria Homologada',
        locale: 'pt-BR',
        path: 'portarias/oficial',
        authorId: 100,
        reviewDueDate: '2027-10-16'
      }

      await eventsDispatcher.handlePublished({
        draft,
        user: { id: 500, name: 'Diretor' },
        comment: 'Publicação autorizada'
      })

      expect(mailSendSpy).toHaveBeenCalledTimes(1)
      const callArgs = mailSendSpy.mock.calls[0][0]
      expect(callArgs.template).toBe('detran-wf-published')
      expect(callArgs.to).toBe('servidor100@detran.mg.gov.br')
      expect(callArgs.data.liveUrl).toBe('https://intranet.detran.mg.gov.br/pt-BR/portarias/oficial')
    })

    it('deve lidar com falhas de e-mail de forma resiliente sem quebrar a execução', async () => {
      mailSendSpy.mockRejectedValueOnce(new Error('SMTP Connection Refused'))

      const success = await eventsDispatcher.sendEmail({
        template: 'test',
        to: 'falha@detran.mg.gov.br',
        subject: 'Teste de Falha',
        data: {}
      })

      expect(success).toBe(false)
      expect(global.WIKI.logger.warn).toHaveBeenCalled()
    })
  })

  describe('3. Integração com Microsoft Teams Webhook (Adaptive Cards)', () => {
    it('deve despachar notificação para Teams Webhook quando configurado', async () => {
      const mockWebhookUrl = 'https://detran.webhook.office.com/webhookb2/teams-channel'
      eventsDispatcher.setTeamsWebhookUrl(mockWebhookUrl)

      // Spy na requisição HTTP
      const postSpy = jest.spyOn(eventsDispatcher, 'postJson').mockResolvedValue(true)

      const draft = {
        id: 77,
        title: 'Resolução de Governança',
        locale: 'pt-BR',
        path: 'normas/gov'
      }

      const res = await eventsDispatcher.handleTeamsNotification('wf:published', {
        draft,
        user: { name: 'Diretor Presidente' },
        comment: 'Homologado pelo Conselho.'
      })

      expect(res).toBe(true)
      expect(postSpy).toHaveBeenCalledTimes(1)
      const [calledUrl, cardPayload] = postSpy.mock.calls[0]
      expect(calledUrl).toBe(mockWebhookUrl)
      expect(cardPayload['@type']).toBe('MessageCard')
      expect(cardPayload.title).toContain('Resolução de Governança')
      expect(cardPayload.potentialAction[0].targets[0].uri).toContain('/w/review/77')

      postSpy.mockRestore()
    })

    it('não deve disparar requisição se Teams Webhook não estiver configurado', async () => {
      eventsDispatcher.setTeamsWebhookUrl(null)
      const postSpy = jest.spyOn(eventsDispatcher, 'postJson')

      const res = await eventsDispatcher.handleTeamsNotification('wf:submitted', {
        draft: { id: 1 },
        user: { name: 'Autor' }
      })

      expect(res).toBe(false)
      expect(postSpy).not.toHaveBeenCalled()
      postSpy.mockRestore()
    })
  })
})

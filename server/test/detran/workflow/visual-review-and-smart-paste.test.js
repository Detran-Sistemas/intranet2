const { JSDOM } = require('jsdom')
const {
  buildVisualDiffDocument,
  encodeTextQuoteSelector,
  decodeTextQuoteSelector,
  createTextQuoteSelectorFromText,
  applySuggestionDecisionToMarkdown
} = require('../../../../client/store/detran-workflow-review')
const {
  detectClipboardOrigin,
  sanitizeAndTransformHtml,
  htmlToEditorBlocks,
  htmlToCleanMarkdown,
  uploadPastedImage,
  inspectMarkdownForBlobUrls,
  processSmartPastePayload
} = require('../../../../client/themes/default/components/transparent-editor/utils/smart-paste')

describe('Homologação Editorial Estilo Google Docs & Smart Paste (Colagem Inteligente)', () => {
  beforeAll(() => {
    const jsdomInstance = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    global.DOMParser = jsdomInstance.window.DOMParser
  })

  describe('1. Visual Diff Estilo Google Docs (Zero Markdown Cru)', () => {
    test('renderiza documento formatado com <ins class="suggestion-add"> e <del class="suggestion-del"> sem exibir símbolos Markdown', () => {
      const originalContent = [
        '## 1. Objetivo deste Guia Editorial',
        'Nosso objetivo é garantir que todas as informações sejam **técnicas e formais**.',
        '### 2. Prazo de Atualização',
        'O conteúdo deve ser atualizado em até 5 dias úteis após a publicação oficial.'
      ].join('\n\n')

      const draftContent = [
        '## 1. Objetivo deste Guia Editorial',
        'Nosso objetivo é garantir que todas as informações sejam **claras, diretas e acessíveis para todos os servidores**.',
        '### 2. Prazo de Atualização',
        'O conteúdo deve ser atualizado em até 5 dias úteis após a publicação oficial.',
        '![Painel de indicadores](/img_painel_123.png "Figura 1: Painel visual limpo")'
      ].join('\n\n')

      const result = buildVisualDiffDocument({
        originalContent,
        draftContent,
        authorName: 'Administrador',
        updatedAt: 'Hoje às 17:19'
      })

      // Critério 1: Zero símbolos crus de Markdown ou git diff
      expect(result.html).not.toContain('@@')
      expect(result.html).not.toContain('## ')
      expect(result.html).not.toContain('**')
      expect(result.html).not.toContain('![Painel')

      // Critério 2: Marcações visuais de adição e remoção
      expect(result.html).toContain('class="suggestion-del"')
      expect(result.html).toContain('técnicas e formais')
      expect(result.html).toContain('class="suggestion-add"')
      expect(result.html).toContain('claras, diretas e acessíveis para todos os servidores')

      // Imagem real renderizada dentro de .img-suggestion-box com badge "Nova Imagem Adicionada"
      expect(result.html).toContain('class="img-suggestion-box"')
      expect(result.html).toContain('Nova Imagem Adicionada')
      expect(result.html).toContain('<img src="/img_painel_123.png"')

      // Cartões de sugestão gerados para a barra lateral
      expect(result.suggestions.length).toBeGreaterThanOrEqual(2)
      const imgSuggestion = result.suggestions.find(s => s.isImage)
      expect(imgSuggestion).toBeDefined()
      expect(imgSuggestion.hasBlobWarning).toBe(false)
    })

    test('detecta e sinaliza alerta quando uma URL blob: efêmera está presente no rascunho', () => {
      const result = buildVisualDiffDocument({
        originalContent: '## Título\n\nTexto base.',
        draftContent: '## Título\n\nTexto base.\n\n![teste imagem](blob:http://localhost:3000/a37a3aeb-1234)'
      })

      const imgSug = result.suggestions.find(s => s.isImage)
      expect(imgSug).toBeDefined()
      expect(imgSug.hasBlobWarning).toBe(true)
      expect(result.html).toContain('URL Blob Local')

      const inspection = inspectMarkdownForBlobUrls('Texto ![teste imagem](blob:http://localhost:3000/a37a3aeb-1234)')
      expect(inspection.hasBlobUrls).toBe(true)
      expect(inspection.matches).toHaveLength(1)
      expect(inspection.sanitizedMarkdown).not.toContain('blob:http://localhost')
    })

    test('ancora comentários e sugestões de redação via TextQuoteSelector sem usar número de linha', () => {
      const fullText = 'Cada setor responsável deve atualizar a página em até 5 dias úteis após a publicação oficial.'
      const selector = createTextQuoteSelectorFromText(fullText, '5 dias úteis após a publicação oficial')

      expect(selector.exact).toBe('5 dias úteis após a publicação oficial')
      expect(selector.prefix).toContain('atualizar a página em até ')

      const encodedComment = encodeTextQuoteSelector({
        exact: selector.exact,
        prefix: selector.prefix,
        suffix: selector.suffix,
        status: 'pending'
      })

      const decoded = decodeTextQuoteSelector({ id: 10, anchorText: encodedComment, resolved: false })
      expect(decoded.exact).toBe('5 dias úteis após a publicação oficial')
      expect(decoded.status).toBe('pending')

      const diffWithComment = buildVisualDiffDocument({
        originalContent: fullText,
        draftContent: fullText,
        comments: [
          {
            id: 10,
            userName: 'Carla Mendes',
            anchorText: encodedComment,
            body: 'Mudou para 3 dias úteis.',
            resolved: false
          }
        ]
      })

      expect(diffWithComment.html).toContain('<mark id="item-com-10" data-item-id="com-10" class="comment-highlight"')
    })

    test('consolida decisões de Aceitar e Recusar sugestões no Markdown do rascunho', () => {
      const draftMd = 'Nosso objetivo é garantir informações claras e diretas.'
      const suggestion = {
        id: 'sug-1',
        rawOldMarkdown: 'Nosso objetivo é garantir informações técnicas e formais.',
        rawNewMarkdown: 'Nosso objetivo é garantir informações claras e diretas.',
        wordOld: 'técnicas e formais',
        wordNew: 'claras e diretas'
      }

      // Aceitar mantém a nova redação
      const acceptedMd = applySuggestionDecisionToMarkdown({
        draftContent: draftMd,
        suggestion,
        decision: 'accept'
      })
      expect(acceptedMd).toBe('Nosso objetivo é garantir informações claras e diretas.')

      // Recusar reverte para o trecho original
      const rejectedMd = applySuggestionDecisionToMarkdown({
        draftContent: draftMd,
        suggestion,
        decision: 'reject'
      })
      expect(rejectedMd).toBe('Nosso objetivo é garantir informações técnicas e formais.')

      // Reabrir (restore/pending) restaura a redação proposta
      const reopenedMd = applySuggestionDecisionToMarkdown({
        draftContent: rejectedMd,
        suggestion,
        decision: 'restore'
      })
      expect(reopenedMd).toBe('Nosso objetivo é garantir informações claras e diretas.')
    })

    test('preserva todos os cards de sugestão na lista com seus status ao aplicar decisões (accepted/rejected)', () => {
      const originalContent = 'Texto original do parágrafo.'
      const draftContent = 'Texto modificado do parágrafo com novidades.'

      // Quando não há decisões, status de ambos é pending
      const diff1 = buildVisualDiffDocument({
        originalContent,
        draftContent,
        decisions: {}
      })
      expect(diff1.suggestions).toHaveLength(2)
      expect(diff1.suggestions[0].status).toBe('pending')
      expect(diff1.suggestions[1].status).toBe('pending')

      // Quando sug-1 é aceita e sug-2 é rejeitada, ambos continuam na lista de suggestions com seus respectivos status
      const diff2 = buildVisualDiffDocument({
        originalContent,
        draftContent,
        decisions: { 'sug-1': 'accepted', 'sug-2': 'rejected' }
      })
      expect(diff2.suggestions).toHaveLength(2)
      expect(diff2.suggestions[0].status).toBe('accepted')
      expect(diff2.suggestions[1].status).toBe('rejected')
    })
  })

  describe('2. Smart Paste (Colagem Formatada Inteligente)', () => {
    test('detecta corretamente a origem do clipboard (MS Word, Google Docs, Web e Plain Text)', () => {
      const wordHtml = '<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta name="Generator" content="Microsoft Word 15"></head><body><p class="MsoNormal">Texto<o:p></o:p></p></body></html>'
      expect(detectClipboardOrigin(wordHtml, 'Texto')).toBe('word')

      const gdocsHtml = '<b id="docs-internal-guid-12345" style="font-weight:normal;"><span style="font-weight:700;">Título</span></b>'
      expect(detectClipboardOrigin(gdocsHtml, 'Título')).toBe('gdocs')

      expect(detectClipboardOrigin('<p>Olá mundo</p>', 'Olá mundo')).toBe('web')
      expect(detectClipboardOrigin('', 'Apenas texto puro')).toBe('plain')
    })

    test('higieniza HTML sujo do MS Word e Google Docs, promove títulos, converte listas falsas, tabelas, callouts e citações legais', () => {
      const dirtyWordAndDocsHtml = `
        <!--StartFragment-->
        <style>p.MsoNormal { font-family: Calibri; }</style>
        <b id="docs-internal-guid-9999" style="font-weight:normal;">
          <h1 style="color: red; font-size: 24pt;">Título Principal Colado</h1>
          <p style="font-size: 16pt; font-weight: 700;">Subtítulo Implícito por Estilo</p>
          <p class="MsoNormal" style="color: #333;"><span style="font-weight: 700;">Texto em negrito</span> e <span style="font-style: italic;">itálico</span> com link interno <a href="http://localhost:3000/pt-br/manual/regras">Manual</a>.<o:p></o:p></p>
          <p class="MsoListParagraph">• Primeiro item da lista falsa</p>
          <p class="MsoListParagraph">• Segundo item da lista falsa</p>
          <p style="margin-left: 36pt;">Art. 5º Os prazos previstos nesta Portaria entram em vigor na data de sua publicação.</p>
          <p>Atenção: O envio fora do prazo implicará bloqueio automático.</p>
          <table width="600" style="width: 450pt;">
            <tr><td bgcolor="#cccccc"><b>Setor</b></td><td bgcolor="#cccccc"><b>Ramal</b></td></tr>
            <tr><td width="300">Comunicação</td><td width="300">2104</td></tr>
          </table>
        </b>
        <!--EndFragment-->
      `

      const result = sanitizeAndTransformHtml(dirtyWordAndDocsHtml)
      expect(result.hadComplexFormatting).toBe(true)

      // Sem tags proprietárias ou atributos style/width/color sujos
      expect(result.html).not.toContain('<o:p>')
      expect(result.html).not.toContain('<style>')
      expect(result.html).not.toContain('docs-internal-guid')
      expect(result.html).not.toContain('style=')
      expect(result.html).not.toContain('<h1>')

      // <h1> e parágrafo curto >=16pt bold promovidos para <h2>/<h3>
      expect(result.html).toContain('<h2>Título Principal Colado</h2>')
      expect(result.html).toContain('<h3>Subtítulo Implícito por Estilo</h3>')

      // Spans com font-weight:700 e italic convertidos para <strong> e <em>
      expect(result.html).toContain('<strong>Texto em negrito</strong>')
      expect(result.html).toContain('<em>itálico</em>')

      // Link interno normalizado para caminho relativo
      expect(result.html).toContain('href="/pt-br/manual/regras"')

      // Lista falsa reconstruída em <ul><li>
      expect(result.html).toContain('<ul><li>Primeiro item da lista falsa</li><li>Segundo item da lista falsa</li></ul>')

      // Citação legal e Callout de Atenção mapeados
      expect(result.html).toContain('<blockquote class="detran-legal-citation">')
      expect(result.html).toContain('<blockquote class="is-warning">')

      // Tabela higienizada com <thead><tr><th>
      expect(result.html).toContain('<table class="detran-intranet-table"><thead><tr><th>Setor</th><th>Ramal</th></tr></thead>')

      // Conversão para Markdown e Blocos do Editor
      const cleanMd = htmlToCleanMarkdown(result.html)
      expect(cleanMd).toContain('## Título Principal Colado')
      expect(cleanMd).toContain('### Subtítulo Implícito por Estilo')
      expect(cleanMd).toContain('- Primeiro item da lista falsa')
      expect(cleanMd).toContain('{.is-warning}')
      expect(cleanMd).toContain('| Setor | Ramal |')

      const blocks = htmlToEditorBlocks(result.html)
      expect(blocks.some(b => b.type === 'heading' && b.level === 2)).toBe(true)
      expect(blocks.some(b => b.type === 'callout' && b.variant === 'warning')).toBe(true)
    })

    test('converte tabela de 1x1 célula para Callout da Intranet', () => {
      const singleCellTableHtml = '<table><tr><td>Nota Técnica: Utilize apenas formulários oficiais.</td></tr></table>'
      const res = sanitizeAndTransformHtml(singleCellTableHtml)
      expect(res.html).toContain('<blockquote class="is-info">')
      expect(res.html).not.toContain('<table')
    })

    test('intercepta upload de imagem colada no clipboard e bloqueia URLs blob: efêmeras', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          path: '/img_1762380000_print.png'
        })
      })

      const fakeImageFile = {
        name: 'print.png',
        type: 'image/png',
        size: 1024
      }

      const pasteRes = await processSmartPastePayload({
        html: '',
        plainText: '',
        files: [fakeImageFile],
        fetchImpl: mockFetch
      })

      expect(pasteRes.origin).toBe('image')
      expect(pasteRes.markdown).toBe('![print](/img_1762380000_print.png)')
      expect(pasteRes.markdown).not.toContain('blob:')
      expect(mockFetch).toHaveBeenCalledWith('/upload', expect.objectContaining({ method: 'POST' }))

      // Verifica que uploadPastedImage rejeita se servidor devolver URL blob:
      const badFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ path: 'blob:http://localhost:3000/bad' })
      })
      await expect(uploadPastedImage({ file: fakeImageFile, fetchImpl: badFetch })).rejects.toThrow()
    })

    test('decodifica e renderiza blocos diagram (Base64 SVG) e mermaid no modo de revisão sem expor texto Base64', () => {
      const svgRaw = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40"/><text x="10" y="25">Fluxo</text></svg>'
      const base64Svg = Buffer.from(svgRaw, 'utf8').toString('base64')

      const originalContent = [
        '## Introdução',
        'Fluxo oficial do processo.'
      ].join('\n\n')

      const draftContent = [
        '## Introdução',
        'Fluxo oficial do processo.',
        '```diagram\n' + base64Svg + '\n```',
        '```mermaid\ngraph TD\n\nA[Início] --> B[Fim]\n```'
      ].join('\n\n')

      const res = buildVisualDiffDocument({
        originalContent,
        draftContent,
        comments: [
          {
            id: 99,
            anchorText: JSON.stringify({ type: 'TextQuoteSelector', exact: 'Fluxo' }),
            resolved: false
          }
        ]
      })

      // Renderiza o SVG decodificado em vez do base64 cru
      expect(res.html).toContain('<div class="diagram">')
      expect(res.html).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
      expect(res.html).not.toContain(base64Svg)

      // Não injeta <mark> dentro de tags <svg> (deve marcar apenas o texto "Fluxo" fora do SVG)
      expect(res.html).toContain('<mark id="item-com-99"')
      expect(res.html).toContain('<text x="10" y="25">Fluxo</text>')

      // Diagrama adicionado gera cartão com descrição amigável sem base64
      const diagSug = res.suggestions.find(s => s.actionLabel === 'Inseriu um diagrama')
      expect(diagSug).toBeDefined()
      expect(diagSug.newText).toBe('[Diagrama Técnico]')

      // Bloco mermaid com linha em branco interna é mantido inteiro e classificado
      expect(res.html).toContain('<div class="mermaid">graph TD')
      expect(res.html).toContain('A[Início] --&gt; B[Fim]</div>')
    })
  })
})

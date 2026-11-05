import {
  escapeHtml,
  inlineMarkdownToHtml,
  inlineHtmlToMarkdown,
  renderRawBlockHtml,
  parseMarkdown,
  serializeBlocks,
  slugify
} from './markdown-blocks'

const roundTrip = md => serializeBlocks(parseMarkdown(md))

describe('transparent-editor/markdown-blocks', () => {
  it('parses headings with anchors', () => {
    expect(parseMarkdown('## O que você encontrará aqui? {#sec-encontrara}')).toEqual([
      { type: 'heading', level: 2, text: 'O que você encontrará aqui?', anchor: 'sec-encontrara' }
    ])
  })

  it('parses Wiki.js callouts', () => {
    const md = '> Bem-vindo(a) à **Intranet**\n{.is-success}'
    expect(parseMarkdown(md)).toEqual([{ type: 'callout', variant: 'success', text: 'Bem-vindo(a) à **Intranet**' }])
    expect(roundTrip(md)).toBe(md + '\n')
  })

  it('keeps plain blockquotes as raw', () => {
    expect(parseMarkdown('> citação')[0].type).toBe('raw')
    expect(roundTrip('> citação')).toBe('> citação\n')
  })

  it('parses links-list into cards', () => {
    const md = '- [Procedimentos *Operacionais*](/procedimentos)\n- [Manuais](/manuais)\n{.links-list}'
    expect(parseMarkdown(md)).toEqual([{
      type: 'links',
      items: [
        { title: 'Procedimentos', description: 'Operacionais', href: '/procedimentos' },
        { title: 'Manuais', description: '', href: '/manuais' }
      ]
    }])
    expect(roundTrip(md)).toBe(md + '\n')
  })

  it('parses images', () => {
    const md = '![Logo](/logo.png "Detran-MG")'
    expect(parseMarkdown(md)).toEqual([{ type: 'image', alt: 'Logo', src: '/logo.png', title: 'Detran-MG' }])
    expect(roundTrip(md)).toBe(md + '\n')
  })

  it('preserves code fences, tables and lists verbatim', () => {
    const md = [
      '```js\nconst a = 1\n\nconst b = 2\n```',
      '| A | B |\n|---|---|\n| 1 | 2 |',
      '- item 1\n- item 2'
    ].join('\n\n')
    expect(roundTrip(md)).toBe(md + '\n')
    expect(parseMarkdown(md).every(b => b.type === 'raw')).toBe(true)
  })

  it('round-trips a full document', () => {
    const md = [
      'A **Intranet do Detran-MG** é o ambiente oficial.',
      '> Construída de forma colaborativa.\n{.is-info}',
      '## Seção {#secao}',
      'Linha 1\nLinha 2',
      '- [Normativos](/normativos)\n{.links-list}'
    ].join('\n\n')
    expect(roundTrip(md)).toBe(md + '\n')
  })

  it('normalizes CRLF and drops empty paragraphs', () => {
    expect(roundTrip('a\r\n\r\n\r\nb')).toBe('a\n\nb\n')
    expect(serializeBlocks([{ type: 'paragraph', text: '  ' }, { type: 'paragraph', text: 'x' }])).toBe('x\n')
  })

  it('slugifies headings for the ToC', () => {
    expect(slugify('O que você encontrará aqui?')).toBe('o-que-voce-encontrara-aqui')
    expect(slugify()).toBe('')
  })

  it('handles default empty arguments and edge cases in parseMarkdown and serializeBlocks', () => {
    expect(parseMarkdown()).toEqual([])
    expect(serializeBlocks()).toBe('\n')

    // List with {.links-list} that has non-link items falls back to raw
    const malformedLinksList = '- Item comum sem link\n{.links-list}'
    const parsedMalformed = parseMarkdown(malformedLinksList)
    expect(parsedMalformed).toEqual([
      { type: 'raw', text: '- Item comum sem link\n{.links-list}' }
    ])

    // Heading without level or anchor, and image without alt or title
    const serialized = serializeBlocks([
      { type: 'heading', text: 'Sem Nivel' },
      { type: 'image', src: '/img.png' }
    ])
    expect(serialized).toBe('## Sem Nivel\n\n![](/img.png)\n')

    // Unknown block type throws
    expect(() => serializeBlocks([{ type: 'invalid-type' }])).toThrow('Tipo de bloco desconhecido: invalid-type')
  })

  it('converts inline Markdown to HTML and back seamlessly without losing formatting', () => {
    expect(escapeHtml()).toBe('')
    expect(inlineMarkdownToHtml()).toBe('')
    expect(inlineHtmlToMarkdown()).toBe('')

    const md = 'Elementos **Markdown** e *Design System* com `código **bruto**`, ~~riscado~~, ***ambos*** e [Link](/guia).'
    const html = inlineMarkdownToHtml(md)
    expect(html).toBe(
      'Elementos <strong>Markdown</strong> e <em>Design System</em> com <code>código **bruto**</code>, <s>riscado</s>, <strong><em>ambos</em></strong> e <a href="/guia">Link</a>.'
    )

    const backToMd = inlineHtmlToMarkdown(html)
    expect(backToMd).toBe(md)

    // Handles browser contenteditable tags (<b>, <i>, <del>, <div>, <br>, entities)
    const browserHtml = '<b>Negrito</b> <i>Itálico</i> <em><b>Ambos2</b></em> <del>Del</del><div>Linha 2&nbsp;&amp;&lt;&gt;&quot;&#39;</div>'
    expect(inlineHtmlToMarkdown(browserHtml)).toBe('**Negrito** *Itálico* ***Ambos2*** ~~Del~~\nLinha 2 &<>"\'')
  })

  it('renders raw structural blocks (hr, code fences, blockquotes, tables, lists, task lists) to HTML', () => {
    expect(renderRawBlockHtml()).toBe('')
    expect(parseMarkdown('---')).toEqual([{ type: 'raw', text: '---' }])
    expect(renderRawBlockHtml('---')).toBe('<hr>')

    expect(renderRawBlockHtml('```js\nconst x = 1 < 2\n```')).toBe(
      '<pre><code class="language-js">const x = 1 &lt; 2</code></pre>'
    )
    expect(renderRawBlockHtml('```\nsem lang\n```')).toBe(
      '<pre><code>sem lang</code></pre>'
    )

    expect(renderRawBlockHtml('> Linha **1**\n> Linha 2')).toBe(
      '<blockquote><p>Linha <strong>1</strong><br>Linha 2</p></blockquote>'
    )

    const tableMd = '| Col A | Col B |\n|---|---|\n| **1** | 2 |'
    expect(renderRawBlockHtml(tableMd)).toBe(
      '<table><thead><tr><th>Col A</th><th>Col B</th></tr></thead><tbody><tr><td><strong>1</strong></td><td>2</td></tr></tbody></table>'
    )

    const ulMd = '- Item **A**\n- Item *B*'
    expect(renderRawBlockHtml(ulMd)).toBe(
      '<ul><li>Item <strong>A</strong></li><li>Item <em>B</em></li></ul>'
    )

    const olMd = '1. Primeiro\n2. Segundo'
    expect(renderRawBlockHtml(olMd)).toBe(
      '<ol><li>Primeiro</li><li>Segundo</li></ol>'
    )

    const taskMd = '- [x] Concluído\n- [ ] Pendente'
    expect(renderRawBlockHtml(taskMd)).toBe(
      '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked disabled> <span>Concluído</span></li><li class="task-list-item"><input type="checkbox" disabled> <span>Pendente</span></li></ul>'
    )

    expect(renderRawBlockHtml('Texto avulso')).toBe('<p>Texto avulso</p>')
  })
})

import { parseMarkdown, serializeBlocks, slugify } from './markdown-blocks'

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
  })
})

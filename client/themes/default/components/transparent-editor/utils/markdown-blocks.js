/**
 * Edição Transparente — conversor bidirecional Markdown <-> Blocos
 *
 * Modelo de bloco:
 *  { type: 'heading',   level, text, anchor }
 *  { type: 'paragraph', text }
 *  { type: 'callout',   variant: 'info'|'success'|'warning'|'danger', text }
 *  { type: 'image',     src, alt, title }
 *  { type: 'links',     items: [{ title, description, href }] }
 *  { type: 'raw',       text }  ← qualquer estrutura não editável inline (código, tabela, listas…)
 *
 * O texto inline permanece em Markdown (negrito, itálico, links). A conversão
 * HTML <-> Markdown inline do contenteditable é responsabilidade da camada de UI.
 */

const RE_FENCE = /^(```|~~~)/
const RE_HEADING = /^(#{1,6})\s+(.*?)(?:\s*\{#([^}\s]+)\})?\s*$/
const RE_QUOTE = /^>\s?(.*)$/
const RE_CALLOUT_CLASS = /^\{\.is-(info|success|warning|danger)\}\s*$/
const RE_IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/
const RE_LIST_ITEM = /^\s*([-*+]|\d+\.)\s+/
const RE_LINKS_CLASS = /^\{\.links-list\}\s*$/
const RE_LINK_ITEM = /^[-*+]\s+\[(.+?)(?:\s+\*(.+?)\*)?\]\(([^)]+)\)\s*$/
const RE_TABLE = /^\s*\|/

const isBlank = l => l.trim() === ''

export function parseMarkdown (md = '') {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) { i++; continue }

    // Bloco de código: preservado integralmente
    if (RE_FENCE.test(line)) {
      const fence = line.match(RE_FENCE)[1]
      const buf = [line]
      i++
      while (i < lines.length) {
        buf.push(lines[i])
        if (lines[i].startsWith(fence)) { i++; break }
        i++
      }
      blocks.push({ type: 'raw', text: buf.join('\n') })
      continue
    }

    const h = line.match(RE_HEADING)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2], anchor: h[3] || null })
      i++
      continue
    }

    const img = line.match(RE_IMAGE)
    if (img) {
      blocks.push({ type: 'image', alt: img[1], src: img[2], title: img[3] || null })
      i++
      continue
    }

    // Citação / callout
    if (RE_QUOTE.test(line)) {
      const buf = []
      while (i < lines.length && RE_QUOTE.test(lines[i])) {
        buf.push(lines[i].match(RE_QUOTE)[1])
        i++
      }
      const cls = i < lines.length ? lines[i].match(RE_CALLOUT_CLASS) : null
      if (cls) {
        blocks.push({ type: 'callout', variant: cls[1], text: buf.join('\n') })
        i++
      } else {
        blocks.push({ type: 'raw', text: buf.map(l => `> ${l}`.trimEnd()).join('\n') })
      }
      continue
    }

    // Listas (links-list vira cards; demais preservadas)
    if (RE_LIST_ITEM.test(line)) {
      const buf = []
      while (i < lines.length && !isBlank(lines[i]) && !RE_LINKS_CLASS.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      if (i < lines.length && RE_LINKS_CLASS.test(lines[i])) {
        const items = buf.map(l => l.match(RE_LINK_ITEM))
        if (items.every(Boolean)) {
          blocks.push({
            type: 'links',
            items: items.map(m => ({ title: m[1], description: m[2] || '', href: m[3] }))
          })
          i++
          continue
        }
        buf.push(lines[i])
        i++
      }
      blocks.push({ type: 'raw', text: buf.join('\n') })
      continue
    }

    if (RE_TABLE.test(line)) {
      const buf = []
      while (i < lines.length && !isBlank(lines[i])) { buf.push(lines[i]); i++ }
      blocks.push({ type: 'raw', text: buf.join('\n') })
      continue
    }

    // Parágrafo: linhas consecutivas até quebra ou início de outra estrutura
    const buf = []
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !RE_FENCE.test(lines[i]) &&
      !RE_HEADING.test(lines[i]) &&
      !RE_QUOTE.test(lines[i]) &&
      !(buf.length > 0 && RE_LIST_ITEM.test(lines[i]))
    ) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: buf.join('\n') })
  }

  return blocks
}

function serializeBlock (b) {
  switch (b.type) {
    case 'heading':
      return `${'#'.repeat(b.level || 2)} ${b.text}${b.anchor ? ` {#${b.anchor}}` : ''}`
    case 'paragraph':
      return b.text
    case 'callout':
      return b.text.split('\n').map(l => `> ${l}`.trimEnd()).join('\n') + `\n{.is-${b.variant}}`
    case 'image':
      return `![${b.alt || ''}](${b.src}${b.title ? ` "${b.title}"` : ''})`
    case 'links':
      return b.items
        .map(it => `- [${it.title}${it.description ? ` *${it.description}*` : ''}](${it.href})`)
        .join('\n') + '\n{.links-list}'
    case 'raw':
      return b.text
    default:
      throw new Error(`Tipo de bloco desconhecido: ${b.type}`)
  }
}

export function serializeBlocks (blocks = []) {
  return blocks
    .filter(b => !(b.type === 'paragraph' && !b.text.trim()))
    .map(serializeBlock)
    .join('\n\n') + '\n'
}

/** Gera âncora no padrão Wiki.js para H2 (usada pelo Índice do Guia). */
export function slugify (text = '') {
  return String(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

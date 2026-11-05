/**
 * Edição Transparente — conversor bidirecional Markdown <-> Blocos e Inline HTML
 *
 * Modelo de bloco:
 *  { type: 'heading',   level, text, anchor }
 *  { type: 'paragraph', text }
 *  { type: 'callout',   variant: 'info'|'success'|'warning'|'danger', text }
 *  { type: 'image',     src, alt, title }
 *  { type: 'links',     items: [{ title, description, href }] }
 *  { type: 'raw',       text }  ← código, tabela, listas, divisores, citações
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
const RE_HR = /^\s*(?:[-]{3,}|[*]{3,}|[_]{3,})\s*$/

const isBlank = l => l.trim() === ''

export function escapeHtml (str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Converte formatação Markdown inline (**negrito**, *itálico*, ~~riscado~~, `código`, [link](url))
 * para HTML rico exibido dentro dos elementos contenteditable.
 */
export function inlineMarkdownToHtml (md = '') {
  if (!md) return ''
  const codeTokens = []
  let html = escapeHtml(md)

  // Protege trechos de código inline `...`
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = codeTokens.length
    codeTokens.push(`<code>${code}</code>`)
    return `@@CODE_${idx}@@`
  })

  // Links [texto](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Negrito + Itálico ***texto***
  html = html.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')

  // Negrito **texto** ou __texto__
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')

  // Tachado ~~texto~~
  html = html.replace(/~~([^~\n]+)~~/g, '<s>$1</s>')

  // Itálico *texto* ou _texto_
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  html = html.replace(/\b_([^_\n]+)_\b/g, '<em>$1</em>')

  // Restaura tokens de código
  html = html.replace(/@@CODE_(\d+)@@/g, (_, idx) => codeTokens[Number(idx)])

  return html
}

/**
 * Converte o innerHTML de um elemento contenteditable de volta para Markdown inline limpo.
 */
export function inlineHtmlToMarkdown (html = '') {
  if (!html) return ''
  let md = String(html)

  // Quebras de linha inseridas pelo navegador
  md = md.replace(/<div><br\s*\/?><\/div>/gi, '\n')
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<\/p>\s*<p[^>]*>/gi, '\n')
  md = md.replace(/<div>([\s\S]*?)<\/div>/gi, '\n$1')

  // Tags de formatação inline (suporta aninhamento simples)
  md = md.replace(/<(?:strong|b)(?:\s[^>]*)?>\s*<(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\/(?:em|i)>\s*<\/(?:strong|b)>/gi, '***$1***')
  md = md.replace(/<(?:em|i)(?:\s[^>]*)?>\s*<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>\s*<\/(?:em|i)>/gi, '***$1***')
  md = md.replace(/<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
  md = md.replace(/<(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
  md = md.replace(/<(?:s|del|strike)(?:\s[^>]*)?>([\s\S]*?)<\/(?:s|del|strike)>/gi, '~~$1~~')
  md = md.replace(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, '`$1`')
  md = md.replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Remove tags residuais
  md = md.replace(/<[^>]+>/g, '')

  // Decodifica entidades HTML
  md = md
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')

  return md
}

/**
 * Renderiza blocos estruturais (raw: listas, tabelas, código, citações, divisores)
 * para HTML idêntico ao pipeline visual do Wiki.js (.detran-contents).
 */
export function renderRawBlockHtml (rawText = '') {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return ''

  // 1. Divisor horizontal (---, ***, ___)
  if (RE_HR.test(trimmed)) {
    return '<hr>'
  }

  // 2. Bloco de código (```lang ... ```)
  if (RE_FENCE.test(trimmed)) {
    const lines = trimmed.split('\n')
    const firstLine = lines[0]
    const lang = firstLine.replace(RE_FENCE, '').trim()
    const lastLine = lines[lines.length - 1]
    const bodyLines = RE_FENCE.test(lastLine) && lines.length > 1 ?
      lines.slice(1, -1) :
      lines.slice(1)
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
    return `<pre><code${langAttr}>${escapeHtml(bodyLines.join('\n'))}</code></pre>`
  }

  // 3. Blockquote simples (> citação)
  const lines = trimmed.split('\n')
  if (lines.every(l => RE_QUOTE.test(l))) {
    const inner = lines
      .map(l => inlineMarkdownToHtml(l.replace(RE_QUOTE, '$1')))
      .join('<br>')
    return `<blockquote><p>${inner}</p></blockquote>`
  }

  // 4. Tabela Markdown
  if (RE_TABLE.test(lines[0]) && lines.length >= 2) {
    const parseRow = row => row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(c => c.trim())

    const headerCells = parseRow(lines[0])
    const isSeparator = /^[\s|:-]+$/.test(lines[1])
    const bodyRows = (isSeparator ? lines.slice(2) : lines.slice(1)).map(parseRow)

    const thead = `<thead><tr>${headerCells.map(c => `<th>${inlineMarkdownToHtml(c)}</th>`).join('')}</tr></thead>`
    const tbody = `<tbody>${bodyRows.map(r => `<tr>${r.map(c => `<td>${inlineMarkdownToHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
    return `<table>${thead}${tbody}</table>`
  }

  // 5. Listas (ordenadas, não-ordenadas e task lists)
  if (RE_LIST_ITEM.test(lines[0])) {
    const isOrdered = /^\s*\d+\.\s+/.test(lines[0])
    const tag = isOrdered ? 'ol' : 'ul'
    let hasTasks = false
    const itemsHtml = lines
      .filter(l => !isBlank(l))
      .map(l => {
        const content = l.replace(RE_LIST_ITEM, '')
        const taskMatch = content.match(/^\[([ xX])\]\s+(.*)$/)
        if (taskMatch) {
          hasTasks = true
          const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked' : ''
          return `<li class="task-list-item"><input type="checkbox"${checked} disabled> <span>${inlineMarkdownToHtml(taskMatch[2])}</span></li>`
        }
        return `<li>${inlineMarkdownToHtml(content)}</li>`
      })
      .join('')
    const listClass = hasTasks ? ' class="contains-task-list"' : ''
    return `<${tag}${listClass}>${itemsHtml}</${tag}>`
  }

  return `<p>${inlineMarkdownToHtml(trimmed)}</p>`
}

export function parseMarkdown (md = '') {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) { i++; continue }

    // Divisor horizontal (---, ***, ___)
    if (RE_HR.test(line)) {
      blocks.push({ type: 'raw', text: line.trim() })
      i++
      continue
    }

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
      !RE_HR.test(lines[i]) &&
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

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

const {
  escapeHtml: sharedEscapeHtml,
  sanitizeSafeUrl,
  decodeDiagramBase64Svg: sharedDecodeDiagramBase64Svg
} = require('./markdown-security')

const RE_FENCE = /^(```|~~~)/
const RE_HEADING = /^(#{1,6})\s+(.*?)(?:\s*\{#([^}\s]+)\})?\s*$/
const RE_QUOTE = /^>\s?(.*)$/
const RE_CALLOUT_CLASS = /^\{\.is-(info|success|warning|danger)\}\s*$/
const RE_GH_ALERT = /^\[!(info|success|warning|danger|note|tip|important|caution)\]\s*(.*)$/i
const RE_HTML_CALLOUT_OPEN = /^\s*<(div|blockquote)\s+[^>]*class=["'][^"']*\bis-(info|success|warning|danger)\b[^"']*["'][^>]*>([\s\S]*)$/i

function normalizeAlertVariant (rawVariant = 'info') {
  const v = String(rawVariant || 'info').toLowerCase()
  if (v === 'note' || v === 'info') return 'info'
  if (v === 'tip' || v === 'success') return 'success'
  if (v === 'important' || v === 'warning') return 'warning'
  if (v === 'caution' || v === 'danger' || v === 'error') return 'danger'
  return 'info'
}

export function decodeDiagramBase64Svg (rawPayload = '') {
  return sharedDecodeDiagramBase64Svg(rawPayload)
}
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

  // Protege trechos de código inline `...` e <code>...</code>
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = codeTokens.length
    codeTokens.push(`<code>${code}</code>`)
    return `@@CODE_${idx}@@`
  })
  html = html.replace(/&lt;code&gt;([^\n]+?)&lt;\/code&gt;/gi, (_, code) => {
    const idx = codeTokens.length
    codeTokens.push(`<code>${code}</code>`)
    return `@@CODE_${idx}@@`
  })

  // Preserva tags HTML inline seguras presentes no Markdown bruto (<strong>, <b>, <em>, <i>, <u>, <s>, <mark>, <kbd>, <br>)
  html = html.replace(/&lt;(?:strong|b)&gt;([\s\S]+?)&lt;\/(?:strong|b)&gt;/gi, '<strong>$1</strong>')
  html = html.replace(/&lt;(?:em|i)&gt;([\s\S]+?)&lt;\/(?:em|i)&gt;/gi, '<em>$1</em>')
  html = html.replace(/&lt;u&gt;([^\n]+?)&lt;\/u&gt;/gi, '<u>$1</u>')
  html = html.replace(/&lt;(?:s|del|strike)&gt;([\s\S]+?)&lt;\/(?:s|del|strike)&gt;/gi, '<s>$1</s>')
  html = html.replace(/&lt;mark&gt;([\s\S]+?)&lt;\/mark&gt;/gi, '<mark>$1</mark>')
  html = html.replace(/&lt;kbd&gt;([\s\S]+?)&lt;\/kbd&gt;/gi, '<kbd>$1</kbd>')
  html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>')

  // Imagens inline ![alt](url) — bloqueia esquemas inseguros (javascript:, vbscript:, data:)
  html = html.replace(/!\[([^\]]*)\]\(((?:\([^)]*\)|[^)])+)\)/g, (_, alt, rawUrl) => {
    const safeSrc = sanitizeSafeUrl(rawUrl)
    if (!safeSrc) return alt || ''
    return `<img src="${sharedEscapeHtml(safeSrc)}" alt="${alt}">`
  })

  // Links [texto](url) — bloqueia esquemas inseguros (javascript:, vbscript:, data:)
  html = html.replace(/\[([^\]]+)\]\(((?:\([^)]*\)|[^)])+)\)/g, (_, label, rawUrl) => {
    const safeHref = sanitizeSafeUrl(rawUrl)
    if (!safeHref) return label
    return `<a href="${sharedEscapeHtml(safeHref)}">${label}</a>`
  })

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

  // Ignora único <br> fantasma inserido pelo Chrome em contenteditable vazio
  if (/^(?:<br\s*\/?>|\s|&nbsp;)*$/i.test(md)) return ''

  // Quebras de linha inseridas pelo navegador (remove <br> terminal solitário)
  md = md.replace(/<br\s*\/?>$/i, '')
  md = md.replace(/<div><br\s*\/?><\/div>/gi, '\n')
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<\/p>\s*<p[^>]*>/gi, '\n')
  md = md.replace(/<div>([\s\S]*?)<\/div>/gi, '\n$1')

  // Tags de formatação inline (suporta aninhamento simples)
  md = md.replace(/<(?:strong|b)(?:\s[^>]*)?>\s*<(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\/(?:em|i)>\s*<\/(?:strong|b)>/gi, '***$1***')
  md = md.replace(/<(?:em|i)(?:\s[^>]*)?>\s*<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>\s*<\/(?:em|i)>/gi, '***$1***')
  md = md.replace(/<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
  md = md.replace(/<(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
  md = md.replace(/<u(?:\s[^>]*)?>([\s\S]*?)<\/u>/gi, '@@U_START@@$1@@U_END@@')
  md = md.replace(/<(?:s|del|strike)(?:\s[^>]*)?>([\s\S]*?)<\/(?:s|del|strike)>/gi, '~~$1~~')
  md = md.replace(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, '`$1`')
  md = md.replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

  // Remove tags residuais
  md = md.replace(/<[^>]+>/g, '')

  // Restaura tags de sublinhado <u>...</u>
  md = md.replace(/@@U_START@@/g, '<u>').replace(/@@U_END@@/g, '</u>')

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

  // 2. Bloco de código / Diagrama Draw.io / Mermaid (```lang ... ```)
  if (RE_FENCE.test(trimmed)) {
    const lines = trimmed.split('\n')
    const firstLine = lines[0]
    const lang = firstLine.replace(RE_FENCE, '').trim()
    const langLower = lang.toLowerCase()
    const lastLine = lines[lines.length - 1]
    const bodyLines = RE_FENCE.test(lastLine) && lines.length > 1 ?
      lines.slice(1, -1) :
      lines.slice(1)
    const bodyContent = bodyLines.join('\n')

    if (langLower === 'diagram' || langLower === 'drawio' || (!langLower && /^PHN2Zy/.test(bodyContent.trim()))) {
      const svgHtml = decodeDiagramBase64Svg(bodyContent)
      if (svgHtml) {
        return `<div class="diagram">${svgHtml}</div>`
      }
    }

    if (langLower === 'mermaid') {
      return `<div class="mermaid">${escapeHtml(bodyContent.trim())}</div>`
    }

    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
    return `<pre><code${langAttr}>${escapeHtml(bodyContent)}</code></pre>`
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
    const parsedTable = parseRawTable(trimmed)
    const thead = `<thead><tr>${parsedTable.headers.map(c => `<th>${inlineMarkdownToHtml(c)}</th>`).join('')}</tr></thead>`
    const tbody = `<tbody>${parsedTable.rows.map(r => `<tr>${r.map(c => `<td>${inlineMarkdownToHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
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

function splitUnescapedPipes (row = '') {
  let s = String(row || '').trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells = []
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      buf += '|'
      i++
    } else if (s[i] === '|') {
      cells.push(buf.trim())
      buf = ''
    } else {
      buf += s[i]
    }
  }
  cells.push(buf.trim())
  return cells
}

function escapeTableCell (cell = '') {
  return String(cell || '')
    .replace(/\r?\n/g, '<br>')
    .replace(/\\\|/g, '|')
    .replace(/\|/g, '\\|')
    .trim()
}

export function detectRawBlockKind (rawText = '') {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return 'unknown'
  if (RE_HR.test(trimmed)) return 'hr'

  if (RE_FENCE.test(trimmed)) {
    const lines = trimmed.split('\n')
    const langLower = lines[0].replace(RE_FENCE, '').trim().toLowerCase()
    const lastLine = lines[lines.length - 1]
    const bodyLines = RE_FENCE.test(lastLine) && lines.length > 1 ? lines.slice(1, -1) : lines.slice(1)
    const body = bodyLines.join('\n').trim()
    if (langLower === 'diagram' || langLower === 'drawio' || (!langLower && /^PHN2Zy/.test(body))) {
      return 'diagram'
    }
    if (langLower === 'mermaid') {
      return 'mermaid'
    }
    return 'code'
  }

  const lines = trimmed.split('\n')
  if (lines.every(l => RE_QUOTE.test(l))) return 'quote'
  if (RE_TABLE.test(lines[0]) && lines.length >= 2) return 'table'
  if (RE_LIST_ITEM.test(lines[0])) return 'list'
  return 'unknown'
}

export function parseRawCodeBlock (rawText = '') {
  const normalized = String(rawText || '').replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const firstLine = lines[0] || '```'
  const fenceMatch = firstLine.match(RE_FENCE)
  const fence = fenceMatch ? fenceMatch[1] : '```'
  const lang = firstLine.replace(RE_FENCE, '').trim()
  const lastLine = lines[lines.length - 1] || ''
  const hasClosingFence = lines.length > 1 && lastLine.trim().startsWith(fence)
  const bodyLines = hasClosingFence ? lines.slice(1, -1) : lines.slice(1)
  return {
    fence,
    lang,
    code: bodyLines.join('\n')
  }
}

export function serializeRawCodeBlock ({ fence = '```', lang = '', code = '' } = {}) {
  const safeFence = fence === '~~~' ? '~~~' : '```'
  const cleanLang = String(lang || '').replace(/[\r\n`~]/g, '').trim()
  const cleanCode = String(code || '').replace(/\r\n?/g, '\n')
  return `${safeFence}${cleanLang}\n${cleanCode}\n${safeFence}`
}

export function parseRawTable (rawText = '') {
  const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length === 0) {
    return {
      headers: ['Coluna 1', 'Coluna 2'],
      alignments: ['---', '---'],
      rows: [['', '']]
    }
  }
  const headers = splitUnescapedPipes(lines[0])
  const colCount = Math.max(1, headers.length)
  const hasSeparator = lines.length >= 2 && /^[\s|:-]+$/.test(lines[1])
  const rawAligns = hasSeparator ? splitUnescapedPipes(lines[1]) : []
  const alignments = Array.from({ length: colCount }, (_, idx) => {
    const token = (rawAligns[idx] || '').trim()
    return /^:?-+:?$/.test(token) ? token : '---'
  })
  const rawBody = hasSeparator ? lines.slice(2) : lines.slice(1)
  const rows = rawBody.map(line => {
    const parsed = splitUnescapedPipes(line)
    return Array.from({ length: colCount }, (_, idx) => parsed[idx] !== undefined ? parsed[idx] : '')
  })
  return { headers, alignments, rows }
}

export function serializeRawTable ({ headers = [], alignments = [], rows = [] } = {}) {
  const safeHeaders = headers.length > 0 ? headers : ['Coluna 1']
  const colCount = safeHeaders.length
  const safeAligns = Array.from({ length: colCount }, (_, idx) => {
    const tok = String((alignments && alignments[idx]) || '---').trim()
    return /^:?-+:?$/.test(tok) ? tok : '---'
  })
  const headerLine = `| ${safeHeaders.map(h => escapeTableCell(h)).join(' | ')} |`
  const sepLine = `| ${safeAligns.join(' | ')} |`
  const bodyLines = (Array.isArray(rows) ? rows : []).map(row => {
    const cells = Array.from({ length: colCount }, (_, idx) => escapeTableCell(row && row[idx]))
    return `| ${cells.join(' | ')} |`
  })
  return [headerLine, sepLine, ...bodyLines].join('\n')
}

export function insertTableRow (table = {}, afterRowIdx = null) {
  const headers = Array.isArray(table.headers) ? [...table.headers] : ['Coluna 1']
  const alignments = Array.isArray(table.alignments) ? [...table.alignments] : headers.map(() => '---')
  const rows = Array.isArray(table.rows) ? table.rows.map(r => [...r]) : []
  const blankRow = headers.map(() => '')
  const pos = (typeof afterRowIdx === 'number' && afterRowIdx >= -1 && afterRowIdx < rows.length) ?
    afterRowIdx + 1 :
    rows.length
  rows.splice(pos, 0, blankRow)
  return { headers, alignments, rows }
}

export function removeTableRow (table = {}, rowIdx = null) {
  const headers = Array.isArray(table.headers) ? [...table.headers] : ['Coluna 1']
  const alignments = Array.isArray(table.alignments) ? [...table.alignments] : headers.map(() => '---')
  const rows = Array.isArray(table.rows) ? table.rows.map(r => [...r]) : []
  if (rows.length <= 1) return { headers, alignments, rows }
  const target = (typeof rowIdx === 'number' && rowIdx >= 0 && rowIdx < rows.length) ? rowIdx : rows.length - 1
  rows.splice(target, 1)
  return { headers, alignments, rows }
}

export function insertTableColumn (table = {}, afterColIdx = null) {
  const headers = Array.isArray(table.headers) ? [...table.headers] : ['Coluna 1']
  const alignments = Array.isArray(table.alignments) ? [...table.alignments] : headers.map(() => '---')
  const rows = Array.isArray(table.rows) ? table.rows.map(r => [...r]) : []
  const pos = (typeof afterColIdx === 'number' && afterColIdx >= -1 && afterColIdx < headers.length) ?
    afterColIdx + 1 :
    headers.length
  headers.splice(pos, 0, 'Nova Coluna')
  alignments.splice(pos, 0, '---')
  rows.forEach(r => { r.splice(pos, 0, '') })
  return { headers, alignments, rows }
}

export function removeTableColumn (table = {}, colIdx = null) {
  const headers = Array.isArray(table.headers) ? [...table.headers] : ['Coluna 1']
  const alignments = Array.isArray(table.alignments) ? [...table.alignments] : headers.map(() => '---')
  const rows = Array.isArray(table.rows) ? table.rows.map(r => [...r]) : []
  if (headers.length <= 1) return { headers, alignments, rows }
  const target = (typeof colIdx === 'number' && colIdx >= 0 && colIdx < headers.length) ? colIdx : headers.length - 1
  headers.splice(target, 1)
  alignments.splice(target, 1)
  rows.forEach(r => { r.splice(target, 1) })
  return { headers, alignments, rows }
}

export function parseRawList (rawText = '') {
  const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n').filter(l => !isBlank(l))
  if (lines.length === 0) {
    return { ordered: false, items: [{ indent: '', marker: '-', checked: null, text: '' }] }
  }
  const ordered = /^\s*\d+\.\s+/.test(lines[0])
  const items = lines.map(line => {
    const match = line.match(/^(\s*)([-*+]|\d+\.)(?:\s+(.*))?$/)
    if (!match) {
      return { indent: '', marker: '-', checked: null, text: line.trim() }
    }
    const indent = match[1] || ''
    const marker = match[2] || '-'
    const rest = match[3] || ''
    const taskMatch = rest.match(/^\[([ xX])\]\s*(.*)$/)
    if (taskMatch) {
      return {
        indent,
        marker,
        checked: taskMatch[1].toLowerCase() === 'x',
        text: taskMatch[2] || ''
      }
    }
    return { indent, marker, checked: null, text: rest }
  })
  return { ordered, items }
}

export function serializeRawList ({ ordered = false, items = [] } = {}) {
  const safeItems = Array.isArray(items) && items.length > 0 ?
    items :
    [{ indent: '', marker: '-', checked: null, text: '' }]
  return safeItems
    .map((item, idx) => {
      const indent = item.indent || ''
      const marker = ordered ? `${idx + 1}.` : (item.marker && !/^\d+\.$/.test(item.marker) ? item.marker : '-')
      const checkbox = item.checked === true ? '[x] ' : (item.checked === false ? '[ ] ' : '')
      const text = String(item.text || '').replace(/\r?\n/g, ' ')
      return `${indent}${marker} ${checkbox}${text}`
    })
    .join('\n')
}

export function parseRawQuote (rawText = '') {
  return String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.replace(RE_QUOTE, '$1'))
    .join('\n')
}

export function serializeRawQuote (text = '') {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => (l ? `> ${l}` : '>'))
    .join('\n')
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

    // Bloco HTML Callout (<div class="is-info">...</div> ou <blockquote class="is-warning">...</blockquote>)
    const htmlCalloutMatch = line.match(RE_HTML_CALLOUT_OPEN)
    if (htmlCalloutMatch) {
      const tagName = htmlCalloutMatch[1].toLowerCase()
      const variant = normalizeAlertVariant(htmlCalloutMatch[2])
      const closeRegex = new RegExp(`<\\/${tagName}\\s*>`, 'i')
      const htmlBuf = [htmlCalloutMatch[3]]
      i++
      while (
        i < lines.length &&
        !closeRegex.test(htmlBuf[htmlBuf.length - 1]) &&
        !isBlank(lines[i]) &&
        !RE_FENCE.test(lines[i]) &&
        !RE_HEADING.test(lines[i]) &&
        !RE_HTML_CALLOUT_OPEN.test(lines[i])
      ) {
        htmlBuf.push(lines[i])
        i++
      }
      const innerRaw = htmlBuf.join('\n').replace(closeRegex, '').trim()
      const cleanText = inlineHtmlToMarkdown(innerRaw).trim()
      blocks.push({ type: 'callout', variant, text: cleanText })
      continue
    }

    // Citação / callout (> ... {.is-info} ou > [!info] ...), com proteção contra diagramas/blocos citados acidentalmente
    if (RE_QUOTE.test(line)) {
      const firstUnquoted = line.replace(/^(?:>\s?)+/, '')
      if (RE_FENCE.test(firstUnquoted)) {
        const fence = firstUnquoted.match(RE_FENCE)[1]
        const buf = [firstUnquoted]
        i++
        while (i < lines.length) {
          const unq = lines[i].replace(/^(?:>\s?)+/, '')
          buf.push(unq)
          if (unq.trim().startsWith(fence)) { i++; break }
          i++
        }
        if (i < lines.length && RE_CALLOUT_CLASS.test(lines[i].trim())) i++
        blocks.push({ type: 'raw', text: buf.join('\n') })
        continue
      }

      const buf = []
      let nestedCalloutVariant = null
      while (i < lines.length && RE_QUOTE.test(lines[i])) {
        const innerLine = lines[i].match(RE_QUOTE)[1]
        const strippedAllQuotes = lines[i].replace(/^(?:>\s?)+/, '')
        if (RE_FENCE.test(strippedAllQuotes)) {
          break
        }
        const nestedCls = strippedAllQuotes.match(RE_CALLOUT_CLASS)
        if (nestedCls) {
          nestedCalloutVariant = nestedCls[1]
          i++
          while (i < lines.length && /^>\s*$/.test(lines[i].trim())) i++
          break
        }
        buf.push(innerLine.replace(/^(?:>\s?)+/, ''))
        i++
      }
      const cls = i < lines.length ? lines[i].match(RE_CALLOUT_CLASS) : null
      if (cls || nestedCalloutVariant) {
        const resolvedVariant = cls ? cls[1] : nestedCalloutVariant
        const firstAlert = buf[0] ? buf[0].match(RE_GH_ALERT) : null
        if (firstAlert) {
          buf[0] = firstAlert[2] || ''
          if (!buf[0] && buf.length > 1) buf.shift()
        }
        const textBody = buf.join('\n').trim()
        if (textBody) {
          blocks.push({ type: 'callout', variant: resolvedVariant, text: textBody })
        }
        if (cls) i++
      } else if (buf.length > 0 && RE_GH_ALERT.test(buf[0].trim())) {
        const alertMatch = buf[0].trim().match(RE_GH_ALERT)
        const variant = normalizeAlertVariant(alertMatch[1])
        const firstLineRest = (alertMatch[2] || '').trim()
        const bodyLines = firstLineRest ? [firstLineRest, ...buf.slice(1)] : buf.slice(1)
        blocks.push({ type: 'callout', variant, text: bodyLines.join('\n').trim() })
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
      !RE_HTML_CALLOUT_OPEN.test(lines[i]) &&
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

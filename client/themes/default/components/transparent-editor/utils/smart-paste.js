/**
 * Smart Paste (Colagem Formatada Inteligente) — Design System Intranet Detran-MG
 *
 * Intercepta colagens do MS Word, Google Docs, Excel, páginas web e PDFs,
 * higieniza estilos inline e tags proprietárias via DOMParser, realiza
 * inferência semântica e converte para componentes e Markdown limpo da Intranet.
 * Também intercepta imagens coladas e bloqueia URLs efêmeras `blob:`.
 */

const ALLOWED_CLASSES = new Set([
  'is-warning',
  'is-info',
  'is-success',
  'is-danger',
  'detran-legal-citation',
  'detran-intranet-table',
  'detran-img-uploading'
])

const LEGAL_CITATION_REGEX = /^\s*(?:Art\.?\s*\d+|Artigo\s+\d+|§\s*\d+|Parágrafo\s+único|Portaria\s+(?:[\w/-]+\s+)?n[º°o]?|Decreto\s+n[º°o]?|Lei\s+(?:Federal\s+|Estadual\s+)?n[º°o]?|Resolução\s+n[º°o]?|Instrução\s+Normativa)/i
const WARNING_CALLOUT_REGEX = /^\s*(?:Atenção|Importante|Alerta|Cuidado)\s*:/i
const INFO_CALLOUT_REGEX = /^\s*(?:Nota\s+Técnica|Nota|Observação|Dica|Informação)\s*:/i
const FAKE_BULLET_REGEX = /^\s*(?:[•●▪◦‣–—]|\*(?!\*)|-(?!-))\s+([\s\S]+)$/
const FAKE_ORDERED_REGEX = /^\s*(?:(\d+)[.)]|([a-zA-Z])[.)]|([IVXLCDM]+)\s*[-–.)])\s+([\s\S]+)$/
const BARE_URL_REGEX = /(^|[\s(])((?:https?:\/\/)[^\s<>"')]+)(?=$|[\s.,;:!?)]+)/gi

/**
 * Obtém uma instância de DOMParser compatível com navegador ou ambiente de teste (Node/JSDOM).
 */
function getDomParser (customParser = null) {
  if (customParser && typeof customParser.parseFromString === 'function') {
    return customParser
  }
  if (typeof window !== 'undefined' && typeof window.DOMParser === 'function') {
    return new window.DOMParser()
  }
  if (typeof global !== 'undefined' && typeof global.DOMParser === 'function') {
    const GP = global.DOMParser
    return new GP()
  }
  return null
}

/**
 * 3.2.2 Detecção de Origem via Metadados HTML
 * @param {string} html
 * @param {string} plainText
 * @returns {'word' | 'gdocs' | 'web' | 'plain'}
 */
export function detectClipboardOrigin (html = '', plainText = '') {
  const rawHtml = String(html || '').trim()
  if (!rawHtml) {
    return 'plain'
  }

  // Microsoft Word / Office
  if (
    /xmlns:w=["']urn:schemas-microsoft-com:office:word["']/i.test(rawHtml) ||
    /xmlns:o=["']urn:schemas-microsoft-com:office:office["']/i.test(rawHtml) ||
    /<meta[^>]*name=["']?Generator["']?[^>]*content=["']?[^"']*Microsoft\s+Word/i.test(rawHtml) ||
    /\bclass=["']?[^"']*\b(?:MsoNormal|MsoListParagraph|MsoTitle|MsoHeading\d|MsoSubtitle)\b/i.test(rawHtml) ||
    /<o:p\b/i.test(rawHtml) ||
    /<w:sdt\b/i.test(rawHtml) ||
    /\bmso-[a-z-]+:/i.test(rawHtml)
  ) {
    return 'word'
  }

  // Google Docs
  if (
    /\bid=["']?docs-internal-guid-[a-z0-9-]+["']?/i.test(rawHtml) ||
    (/<span[^>]*style=["'][^"']*font-weight:\s*700/i.test(rawHtml) && !/<strong\b/i.test(rawHtml))
  ) {
    return 'gdocs'
  }

  return 'web'
}

/**
 * Extrai o tamanho da fonte em pt a partir de um atributo style inline.
 */
function extractFontSizePt (styleStr = '') {
  if (!styleStr) return 0
  const ptMatch = styleStr.match(/font-size\s*:\s*([\d.]+)\s*pt/i)
  if (ptMatch) {
    return parseFloat(ptMatch[1]) || 0
  }
  const pxMatch = styleStr.match(/font-size\s*:\s*([\d.]+)\s*px/i)
  if (pxMatch) {
    const px = parseFloat(pxMatch[1]) || 0
    return px * 0.75
  }
  return 0
}

/**
 * Extrai o recuo esquerdo (margin-left / padding-left) em pt a partir de um atributo style inline.
 */
function extractLeftIndentPt (styleStr = '') {
  if (!styleStr) return 0
  const ptMatch = styleStr.match(/(?:margin-left|padding-left|mso-margin-left-alt)\s*:\s*([\d.]+)\s*pt/i)
  if (ptMatch) {
    return parseFloat(ptMatch[1]) || 0
  }
  const pxMatch = styleStr.match(/(?:margin-left|padding-left)\s*:\s*([\d.]+)\s*px/i)
  if (pxMatch) {
    return (parseFloat(pxMatch[1]) || 0) * 0.75
  }
  const inMatch = styleStr.match(/(?:margin-left|padding-left)\s*:\s*([\d.]+)\s*in/i)
  if (inMatch) {
    return (parseFloat(inMatch[1]) || 0) * 72
  }
  return 0
}

/**
 * Verifica se o estilo inline indica texto em negrito.
 */
function hasBoldStyle (styleStr = '') {
  if (!styleStr) return false
  return /font-weight\s*:\s*(?:bold|bolder|700|800|900)\b/i.test(styleStr)
}

/**
 * Verifica se o estilo inline indica texto em itálico.
 */
function hasItalicStyle (styleStr = '') {
  if (!styleStr) return false
  return /font-style\s*:\s*italic\b/i.test(styleStr)
}

/**
 * Verifica se uma célula possui cor de fundo definida nos metadados originais.
 */
function hasBackgroundStyle (el) {
  if (!el || !el.getAttribute) return false
  const bgAttr = el.getAttribute('bgcolor')
  if (bgAttr && bgAttr.trim() && bgAttr.trim().toLowerCase() !== '#ffffff' && bgAttr.trim().toLowerCase() !== 'transparent') {
    return true
  }
  const styleStr = el.getAttribute('style') || ''
  const bgMatch = styleStr.match(/background(?:-color)?\s*:\s*([^;]+)/i)
  if (!bgMatch) return false
  const val = bgMatch[1].trim().toLowerCase()
  return Boolean(val && val !== 'transparent' && val !== 'none' && val !== '#fff' && val !== '#ffffff' && val !== 'rgb(255, 255, 255)' && val !== 'window')
}

/**
 * Normaliza um link (mantém href seguro e converte URLs internas da Intranet para caminho relativo).
 */
export function normalizeIntranetUrl (rawHref = '', internalOrigins = []) {
  const trimmed = String(rawHref || '').trim()
  if (!trimmed) return ''
  if (/^(?:javascript|vbscript|data):/i.test(trimmed)) {
    return ''
  }

  const origins = Array.isArray(internalOrigins) ? [...internalOrigins] : []
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    origins.push(window.location.origin)
  }
  origins.push('http://localhost:3000', 'https://localhost:3000', 'http://127.0.0.1:3000', 'https://intranet.detran.mg.gov.br')

  for (const origin of origins) {
    if (!origin) continue
    const cleanOrigin = origin.replace(/\/+$/, '')
    if (trimmed.toLowerCase().startsWith(cleanOrigin.toLowerCase())) {
      const rest = trimmed.slice(cleanOrigin.length)
      if (!rest || rest.startsWith('/') || rest.startsWith('?') || rest.startsWith('#')) {
        return rest.startsWith('/') ? rest : `/${rest}`
      }
    }
  }

  return trimmed
}

/**
 * Pré-limpa comentários condicionais do Office e tags proprietárias com namespace (`<o:p>`, `<w:sdt>`)
 * antes de entregar ao DOMParser.
 */
function preCleanProprietaryMarkup (rawHtml = '') {
  let cleaned = String(rawHtml || '')
  // Remove comentários HTML (incluindo StartFragment/EndFragment e condicionais do Word)
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '')
  // Remove elementos de estilo/script/xml/title completos
  cleaned = cleaned.replace(/<(?:style|script|xml|title)\b[^>]*>[\s\S]*?<\/(?:style|script|xml|title)>/gi, '')
  cleaned = cleaned.replace(/<(?:meta|link)\b[^>]*\/?>/gi, '')
  // Remove spans de marcadores ignoráveis do Word (<span style="mso-list:Ignore">•</span>)
  cleaned = cleaned.replace(/<span[^>]*mso-list\s*:\s*Ignore[^>]*>[\s\S]*?<\/span>/gi, '')
  // Remove tags vazias <o:p></o:p> e desembrulha <w:sdt> / <o:...>
  cleaned = cleaned.replace(/<\/?(?:o|w|v|st1):[a-z0-9_-]+[^>]*>/gi, '')
  return cleaned
}

function escapeHtml (str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeHtmlWithLinks (str = '', options = {}) {
  const escaped = escapeHtml(str)
  return escaped.replace(BARE_URL_REGEX, (match, prefix, url) => {
    const normalized = normalizeIntranetUrl(url, options.internalOrigins)
    if (!normalized) return match
    return `${prefix}<a href="${normalized}">${url}</a>`
  })
}

/**
 * Converte texto puro (ex: colado de PDF ou bloco de notas) em HTML estruturado.
 */
export function convertPlainTextToStructuredHtml (plainText = '', options = {}) {
  const raw = String(plainText || '').replace(/\r\n/g, '\n').trim()
  if (!raw) return ''

  const lines = raw.split('\n')
  const blocks = []
  let currentList = null
  let paragraphLines = []

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    const text = paragraphLines.join(' ').replace(/\s+/g, ' ').trim()
    paragraphLines = []
    if (!text) return

    if (WARNING_CALLOUT_REGEX.test(text)) {
      blocks.push(`<blockquote class="is-warning"><p>${escapeHtmlWithLinks(text, options)}</p></blockquote>`)
    } else if (INFO_CALLOUT_REGEX.test(text)) {
      blocks.push(`<blockquote class="is-info"><p>${escapeHtmlWithLinks(text, options)}</p></blockquote>`)
    } else if (LEGAL_CITATION_REGEX.test(text)) {
      blocks.push(`<blockquote class="detran-legal-citation"><p>${escapeHtmlWithLinks(text, options)}</p></blockquote>`)
    } else {
      blocks.push(`<p>${escapeHtmlWithLinks(text, options)}</p>`)
    }
  }

  const flushList = () => {
    if (!currentList) return
    const tag = currentList.type
    const itemsHtml = currentList.items.map(it => `<li>${escapeHtmlWithLinks(it, options)}</li>`).join('')
    blocks.push(`<${tag}>${itemsHtml}</${tag}>`)
    currentList = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const bulletMatch = line.match(FAKE_BULLET_REGEX)
    if (bulletMatch) {
      flushParagraph()
      if (!currentList || currentList.type !== 'ul') {
        flushList()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(bulletMatch[1].trim())
      continue
    }

    const orderedMatch = line.match(FAKE_ORDERED_REGEX)
    if (orderedMatch) {
      flushParagraph()
      if (!currentList || currentList.type !== 'ol') {
        flushList()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(orderedMatch[4].trim())
      continue
    }

    flushList()
    paragraphLines.push(line)
  }

  flushParagraph()
  flushList()

  return blocks.join('\n')
}

/**
 * 3.3. Pipeline de Sanitização e Transformação via DOMParser
 */
export function sanitizeAndTransformHtml (rawHtml = '', options = {}) {
  const origin = detectClipboardOrigin(rawHtml, options.plainText || '')
  if (!String(rawHtml || '').trim()) {
    return {
      origin: 'plain',
      html: convertPlainTextToStructuredHtml(options.plainText || '', options),
      hadComplexFormatting: false,
      detectedImages: [],
      blockedBlobUrls: []
    }
  }

  const preCleaned = preCleanProprietaryMarkup(rawHtml)
  const parser = getDomParser(options.domParser)
  if (!parser) {
    return {
      origin,
      html: convertPlainTextToStructuredHtml(options.plainText || preCleaned.replace(/<[^>]+>/g, ' '), options),
      hadComplexFormatting: true,
      detectedImages: [],
      blockedBlobUrls: []
    }
  }

  const doc = parser.parseFromString(preCleaned, 'text/html')
  const body = doc.body
  if (!body) {
    return {
      origin,
      html: '',
      hadComplexFormatting: false,
      detectedImages: [],
      blockedBlobUrls: []
    }
  }

  const detectedImages = []
  const blockedBlobUrls = []

  // 1. Remover tags proibidas remanescentes no DOM
  const forbiddenSelectors = 'style, script, meta, link, xml, title, iframe, object, embed'
  Array.from(body.querySelectorAll(forbiddenSelectors)).forEach(el => el.remove())

  // 2. Desembrulhar wrapper <b id="docs-internal-guid-..."> do Google Docs
  Array.from(body.querySelectorAll('b[id^="docs-internal-guid"], B[id^="docs-internal-guid"]')).forEach(wrapper => {
    const parent = wrapper.parentNode
    if (parent) {
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper)
      }
      parent.removeChild(wrapper)
    }
  })

  // 3. Inferência semântica em elementos inline (spans/fonts com bold ou italic antes de limpar style)
  Array.from(body.querySelectorAll('span, font')).forEach(span => {
    const styleStr = span.getAttribute('style') || ''
    const isBold = hasBoldStyle(styleStr)
    const isItalic = hasItalicStyle(styleStr)

    if (isBold || isItalic) {
      const replacement = doc.createElement(isBold ? 'strong' : 'em')
      if (isBold && isItalic) {
        const innerEm = doc.createElement('em')
        while (span.firstChild) {
          innerEm.appendChild(span.firstChild)
        }
        replacement.appendChild(innerEm)
      } else {
        while (span.firstChild) {
          replacement.appendChild(span.firstChild)
        }
      }
      const fontSizePt = extractFontSizePt(styleStr)
      if (fontSizePt >= 16) {
        replacement.setAttribute('data-font-size-pt', String(fontSizePt))
      }
      if (span.parentNode) {
        span.parentNode.replaceChild(replacement, span)
      }
    } else {
      const fontSizePt = extractFontSizePt(styleStr)
      if (fontSizePt >= 16 && span.parentNode) {
        span.parentNode.setAttribute('data-font-size-pt', String(fontSizePt))
      }
      const parent = span.parentNode
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span)
        }
        parent.removeChild(span)
      }
    }
  })

  // Normalizar <b> e <i> legados para <strong> e <em>
  Array.from(body.querySelectorAll('b')).forEach(bEl => {
    const styleStr = bEl.getAttribute('style') || ''
    if (/font-weight\s*:\s*(?:normal|400)\b/i.test(styleStr)) {
      const parent = bEl.parentNode
      if (parent) {
        while (bEl.firstChild) parent.insertBefore(bEl.firstChild, bEl)
        parent.removeChild(bEl)
      }
      return
    }
    const strong = doc.createElement('strong')
    while (bEl.firstChild) strong.appendChild(bEl.firstChild)
    if (bEl.parentNode) bEl.parentNode.replaceChild(strong, bEl)
  })

  Array.from(body.querySelectorAll('i')).forEach(iEl => {
    const em = doc.createElement('em')
    while (iEl.firstChild) em.appendChild(iEl.firstChild)
    if (iEl.parentNode) iEl.parentNode.replaceChild(em, iEl)
  })

  // 4. Hierarquia de Títulos: converter <h1> para <h2>
  Array.from(body.querySelectorAll('h1')).forEach(h1 => {
    const h2 = doc.createElement('h2')
    while (h1.firstChild) h2.appendChild(h1.firstChild)
    if (h1.parentNode) h1.parentNode.replaceChild(h2, h1)
  })

  // 5. Transformar Tabelas (incluindo detecção de tabela 1x1 -> Callout e promoção de <thead>)
  Array.from(body.querySelectorAll('table')).forEach(table => {
    const rows = Array.from(table.querySelectorAll('tr'))
    if (rows.length === 0) {
      table.remove()
      return
    }

    // Tabela de 1x1 célula -> Callout da Intranet
    if (rows.length === 1) {
      const cells = Array.from(rows[0].querySelectorAll('td, th'))
      if (cells.length === 1) {
        const cellText = (cells[0].textContent || '').trim()
        const blockquote = doc.createElement('blockquote')
        const isWarn = WARNING_CALLOUT_REGEX.test(cellText)
        blockquote.setAttribute('class', isWarn ? 'is-warning' : 'is-info')
        const p = doc.createElement('p')
        p.innerHTML = cells[0].innerHTML.trim() || escapeHtml(cellText)
        blockquote.appendChild(p)
        if (table.parentNode) {
          table.parentNode.replaceChild(blockquote, table)
        }
        return
      }
    }

    // Tabela multi-célula: higienizar e promover primeira linha para <thead><tr><th>
    const cleanTable = doc.createElement('table')
    cleanTable.setAttribute('class', 'detran-intranet-table')

    const firstRowCells = Array.from(rows[0].querySelectorAll('th, td'))
    const hasHeaderFormatting = firstRowCells.some(c =>
      c.tagName.toLowerCase() === 'th' ||
      hasBackgroundStyle(c) ||
      hasBoldStyle(c.getAttribute('style') || '') ||
      Boolean(c.querySelector('strong, b'))
    )
    const thead = doc.createElement('thead')
    if (hasHeaderFormatting) {
      thead.setAttribute('data-detected-header', 'true')
    }
    const headTr = doc.createElement('tr')
    firstRowCells.forEach(cell => {
      const th = doc.createElement('th')
      th.textContent = (cell.textContent || '').replace(/\s+/g, ' ').trim()
      headTr.appendChild(th)
    })
    thead.appendChild(headTr)
    cleanTable.appendChild(thead)

    const tbody = doc.createElement('tbody')
    const bodyRows = rows.slice(1)
    bodyRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td, th'))
      if (cells.length === 0) return
      const tr = doc.createElement('tr')
      cells.forEach(cell => {
        const td = doc.createElement('td')
        td.innerHTML = sanitizeInlineCellHtml(cell)
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    cleanTable.appendChild(tbody)

    if (table.parentNode) {
      table.parentNode.replaceChild(cleanTable, table)
    }
  })

  // 6. Processar Parágrafos: Títulos implícitos, Listas Falsas do Word/PDF, Callouts e Citações Legais
  const paragraphs = Array.from(body.querySelectorAll('p, div'))
  paragraphs.forEach(p => {
    if (p.tagName.toLowerCase() === 'div' && p.querySelector('p, div, table, ul, ol, h1, h2, h3, h4, blockquote')) {
      return
    }

    const className = p.getAttribute('class') || ''
    const styleStr = p.getAttribute('style') || ''
    const text = (p.textContent || '').replace(/\u00a0/g, ' ').trim()

    if (!text && !p.querySelector('img')) {
      return
    }

    // 6.1. Classes de título do Word (MsoTitle, MsoHeading1, MsoHeading2, MsoSubtitle)
    if (/\b(?:MsoTitle|MsoHeading1)\b/i.test(className)) {
      const h2 = doc.createElement('h2')
      h2.textContent = text
      if (p.parentNode) p.parentNode.replaceChild(h2, p)
      return
    }
    if (/\b(?:MsoSubtitle|MsoHeading2|MsoHeading3)\b/i.test(className)) {
      const h3 = doc.createElement('h3')
      h3.textContent = text
      if (p.parentNode) p.parentNode.replaceChild(h3, p)
      return
    }

    // 6.2. Parágrafo curto (< 100 chars) isolado com font-size >= 16pt e bold -> promover para <h2> ou <h3>
    const fontSizePt = Math.max(
      extractFontSizePt(styleStr),
      parseFloat(p.getAttribute('data-font-size-pt') || '0') || 0,
      ...Array.from(p.querySelectorAll('[data-font-size-pt]')).map(el => parseFloat(el.getAttribute('data-font-size-pt') || '0') || 0)
    )
    const isAllBold = hasBoldStyle(styleStr) || (
      p.children.length === 1 &&
      p.children[0].tagName &&
      p.children[0].tagName.toLowerCase() === 'strong' &&
      (p.children[0].textContent || '').trim() === text
    )

    if (text.length > 0 && text.length < 100 && fontSizePt >= 16 && isAllBold) {
      const headingTag = fontSizePt >= 18 ? 'h2' : 'h3'
      const hEl = doc.createElement(headingTag)
      hEl.textContent = text
      if (p.parentNode) p.parentNode.replaceChild(hEl, p)
      return
    }

    // 6.3. Listas Falsas do Word / PDF (MsoListParagraph ou prefixos •, –, 1., a), I -)
    const isMsoList = /\bMsoListParagraph/i.test(className) || /\bmso-list\s*:/i.test(styleStr)
    const bulletMatch = text.match(FAKE_BULLET_REGEX)
    const orderedMatch = text.match(FAKE_ORDERED_REGEX)

    if (isMsoList || bulletMatch || orderedMatch) {
      const indentPt = extractLeftIndentPt(styleStr)
      const levelMatch = styleStr.match(/mso-list\s*:[^;]*\blevel(\d+)/i)
      const listLevel = levelMatch ? Math.max(1, parseInt(levelMatch[1], 10)) : (indentPt >= 48 ? 2 : 1)
      const listType = orderedMatch ? 'ol' : 'ul'

      p.setAttribute('data-fake-list-type', listType)
      p.setAttribute('data-fake-list-level', String(listLevel))

      if (bulletMatch) {
        stripLeadingMarkerFromElement(p, FAKE_BULLET_REGEX, '$1')
      } else if (orderedMatch) {
        stripLeadingMarkerFromElement(p, FAKE_ORDERED_REGEX, '$4')
      }
      return
    }

    // 6.4. Callouts / Blocos de Alerta ("Atenção:", "Importante:", "Nota Técnica:")
    if (WARNING_CALLOUT_REGEX.test(text)) {
      const bq = doc.createElement('blockquote')
      bq.setAttribute('class', 'is-warning')
      const innerP = doc.createElement('p')
      innerP.innerHTML = p.innerHTML
      bq.appendChild(innerP)
      if (p.parentNode) p.parentNode.replaceChild(bq, p)
      return
    }

    if (INFO_CALLOUT_REGEX.test(text)) {
      const bq = doc.createElement('blockquote')
      bq.setAttribute('class', 'is-info')
      const innerP = doc.createElement('p')
      innerP.innerHTML = p.innerHTML
      bq.appendChild(innerP)
      if (p.parentNode) p.parentNode.replaceChild(bq, p)
      return
    }

    // 6.5. Citações Legais (Artigos, Portarias, Decretos em parágrafos recuados ou normativos)
    const leftIndentPt = extractLeftIndentPt(styleStr)
    if (LEGAL_CITATION_REGEX.test(text) && (leftIndentPt >= 12 || options.promoteAllLegalCitations !== false)) {
      const bq = doc.createElement('blockquote')
      bq.setAttribute('class', 'detran-legal-citation')
      const innerP = doc.createElement('p')
      innerP.innerHTML = p.innerHTML
      bq.appendChild(innerP)
      if (p.parentNode) p.parentNode.replaceChild(bq, p)
    }
  })

  // 7. Reconstruir sequências de [data-fake-list-type] em listas reais <ul><li> / <ol><li>
  reconstructFakeLists(body, doc)

  // 8. Tratamento de Imagens (<img src="...">) — Detectar blob: e data:image/
  Array.from(body.querySelectorAll('img')).forEach(img => {
    const rawSrc = (img.getAttribute('src') || '').trim()
    const alt = (img.getAttribute('alt') || img.getAttribute('title') || 'Imagem colada').trim()

    if (!rawSrc || /^file:\/\//i.test(rawSrc)) {
      blockedBlobUrls.push(rawSrc || 'file://')
      img.remove()
      return
    }

    if (/^blob:/i.test(rawSrc)) {
      blockedBlobUrls.push(rawSrc)
      detectedImages.push({ type: 'blob', src: rawSrc, alt })
      img.setAttribute('data-pending-upload-src', rawSrc)
      img.setAttribute('src', '/_assets/img/uploading-placeholder.png')
      img.setAttribute('alt', `Enviando imagem para o servidor... (${alt})`)
      return
    }

    if (/^data:image\//i.test(rawSrc)) {
      detectedImages.push({ type: 'data', src: rawSrc, alt })
      img.setAttribute('data-pending-upload-src', rawSrc)
      img.setAttribute('alt', alt)
      return
    }

    const normalizedSrc = normalizeIntranetUrl(rawSrc, options.internalOrigins)
    img.setAttribute('src', normalizedSrc)
    img.setAttribute('alt', alt)
  })

  // 9. Links Inteligentes: normalizar <a href> e converter URLs soltas em links clicáveis
  Array.from(body.querySelectorAll('a')).forEach(aEl => {
    const rawHref = aEl.getAttribute('href') || ''
    const cleanHref = normalizeIntranetUrl(rawHref, options.internalOrigins)
    if (!cleanHref) {
      const parent = aEl.parentNode
      if (parent) {
        while (aEl.firstChild) parent.insertBefore(aEl.firstChild, aEl)
        parent.removeChild(aEl)
      }
      return
    }
    aEl.setAttribute('href', cleanHref)
  })

  linkifyTextNodes(body, doc, options)

  // 10. Limpeza final estrita de atributos (style, class, face, size, color, id, etc.)
  Array.from(body.querySelectorAll('*')).forEach(el => {
    const attrs = Array.from(el.attributes || [])
    attrs.forEach(attr => {
      const name = attr.name.toLowerCase()
      if (name === 'href' && el.tagName.toLowerCase() === 'a') return
      if ((name === 'src' || name === 'alt' || name === 'data-pending-upload-src') && el.tagName.toLowerCase() === 'img') return
      if (name === 'class') {
        const validClasses = attr.value
          .split(/\s+/)
          .filter(c => ALLOWED_CLASSES.has(c))
        if (validClasses.length > 0) {
          el.setAttribute('class', validClasses.join(' '))
        } else {
          el.removeAttribute('class')
        }
        return
      }
      el.removeAttribute(attr.name)
    })
  })

  // Remover parágrafos vazios residuais
  Array.from(body.querySelectorAll('p, div, span')).forEach(el => {
    if (!el.querySelector('img, table, ul, ol') && !(el.textContent || '').trim()) {
      el.remove()
    }
  })

  const finalHtml = body.innerHTML.trim()
  const hadComplexFormatting = origin === 'word' || origin === 'gdocs' || /<(?:h[2-6]|table|blockquote|ul|ol|strong|em|a|img)\b/i.test(finalHtml)

  return {
    origin,
    html: finalHtml,
    hadComplexFormatting,
    detectedImages,
    blockedBlobUrls
  }
}

function sanitizeInlineCellHtml (cellEl) {
  const clone = cellEl.cloneNode(true)
  Array.from(clone.querySelectorAll('p, div')).forEach(p => {
    const parent = p.parentNode
    if (parent) {
      while (p.firstChild) parent.insertBefore(p.firstChild, p)
      parent.removeChild(p)
    }
  })
  return (clone.innerHTML || '').replace(/\s+/g, ' ').trim()
}

function stripLeadingMarkerFromElement (el, regex, replacementGroup) {
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */, null, false)
  let firstTextNode = walker.nextNode()
  while (firstTextNode && !(firstTextNode.nodeValue || '').trim()) {
    firstTextNode = walker.nextNode()
  }
  if (firstTextNode) {
    firstTextNode.nodeValue = firstTextNode.nodeValue.replace(regex, replacementGroup)
  }
}

function reconstructFakeLists (container, doc) {
  const fakeItems = Array.from(container.querySelectorAll('[data-fake-list-type]'))
  let i = 0
  while (i < fakeItems.length) {
    const firstItem = fakeItems[i]
    if (!firstItem.parentNode) {
      i++
      continue
    }
    const listType = firstItem.getAttribute('data-fake-list-type') || 'ul'
    const listEl = doc.createElement(listType)
    const parent = firstItem.parentNode
    parent.insertBefore(listEl, firstItem)

    let currentTopLi = null
    let currentSubList = null

    while (i < fakeItems.length) {
      const item = fakeItems[i]
      const itemType = item.getAttribute('data-fake-list-type') || 'ul'
      const itemLevel = parseInt(item.getAttribute('data-fake-list-level') || '1', 10)

      if (itemLevel === 1 && itemType !== listType) {
        break
      }

      const li = doc.createElement('li')
      li.innerHTML = item.innerHTML.trim()

      if (itemLevel > 1 && currentTopLi) {
        if (!currentSubList) {
          currentSubList = doc.createElement(itemType)
          currentTopLi.appendChild(currentSubList)
        }
        currentSubList.appendChild(li)
      } else {
        currentSubList = null
        listEl.appendChild(li)
        currentTopLi = li
      }

      const nextSibling = item.nextElementSibling
      item.remove()
      i++
      if (!nextSibling || !nextSibling.hasAttribute('data-fake-list-type')) {
        break
      }
    }
  }
}

function linkifyTextNodes (rootEl, doc, options) {
  const walker = doc.createTreeWalker(rootEl, 4 /* NodeFilter.SHOW_TEXT */, null, false)
  const textNodes = []
  let node = walker.nextNode()
  while (node) {
    const parentTag = node.parentNode && node.parentNode.tagName ? node.parentNode.tagName.toLowerCase() : ''
    if (parentTag !== 'a' && parentTag !== 'code' && parentTag !== 'pre') {
      if (BARE_URL_REGEX.test(node.nodeValue || '')) {
        textNodes.push(node)
      }
      BARE_URL_REGEX.lastIndex = 0
    }
    node = walker.nextNode()
  }

  textNodes.forEach(textNode => {
    const text = textNode.nodeValue || ''
    const frag = doc.createDocumentFragment()
    let lastIdx = 0
    BARE_URL_REGEX.lastIndex = 0
    let match
    while ((match = BARE_URL_REGEX.exec(text)) !== null) {
      const prefix = match[1] || ''
      const rawUrl = match[2] || ''
      const matchStart = match.index + prefix.length
      if (matchStart > lastIdx) {
        frag.appendChild(doc.createTextNode(text.slice(lastIdx, matchStart)))
      }
      const a = doc.createElement('a')
      a.setAttribute('href', normalizeIntranetUrl(rawUrl, options.internalOrigins))
      a.textContent = rawUrl
      frag.appendChild(a)
      lastIdx = matchStart + rawUrl.length
    }
    if (lastIdx < text.length) {
      frag.appendChild(doc.createTextNode(text.slice(lastIdx)))
    }
    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(frag, textNode)
    }
  })
}

/**
 * Converte nós inline de um elemento em sintaxe Markdown limpa.
 */
function serializeInlineToMarkdown (el) {
  if (!el) return ''
  let out = ''
  const childNodes = Array.from(el.childNodes || [])
  for (const node of childNodes) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      out += node.nodeValue || ''
    } else if (node.nodeType === 1 /* ELEMENT_NODE */) {
      const tag = node.tagName.toLowerCase()
      const inner = serializeInlineToMarkdown(node)
      if (tag === 'strong' || tag === 'b') {
        out += inner.trim() ? `**${inner.trim()}**` : ''
      } else if (tag === 'em' || tag === 'i') {
        out += inner.trim() ? `*${inner.trim()}*` : ''
      } else if (tag === 'code') {
        out += `\`${inner}\``
      } else if (tag === 'a') {
        const href = node.getAttribute('href') || ''
        out += href ? `[${inner || href}](${href})` : inner
      } else if (tag === 'img') {
        const src = node.getAttribute('src') || ''
        const alt = node.getAttribute('alt') || 'Imagem'
        if (src && !src.startsWith('blob:')) {
          out += `![${alt}](${src})`
        }
      } else if (tag === 'br') {
        out += '\n'
      } else {
        out += inner
      }
    }
  }
  return out
}

/**
 * Converte uma tabela DOM higienizada para Markdown GFM.
 */
function serializeTableToMarkdown (tableEl) {
  const rows = Array.from(tableEl.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  const matrix = rows.map(row =>
    Array.from(row.querySelectorAll('th, td')).map(cell =>
      serializeInlineToMarkdown(cell).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()
    )
  ).filter(r => r.length > 0)

  if (matrix.length === 0) return ''
  const colCount = Math.max(...matrix.map(r => r.length))
  const padRow = r => {
    const padded = [...r]
    while (padded.length < colCount) padded.push('')
    return `| ${padded.join(' | ')} |`
  }

  const headerLine = padRow(matrix[0])
  const separatorLine = `| ${Array(colCount).fill('---').join(' | ')} |`
  const bodyLines = matrix.slice(1).map(padRow)

  return [headerLine, separatorLine, ...bodyLines].join('\n')
}

/**
 * Converte uma lista DOM (ul/ol) em linhas Markdown (com suporte a sub-listas aninhadas).
 */
function serializeListToMarkdown (listEl, indent = 0) {
  const isOrdered = listEl.tagName.toLowerCase() === 'ol'
  const lines = []
  const items = Array.from(listEl.children).filter(c => c.tagName && c.tagName.toLowerCase() === 'li')

  items.forEach((li, idx) => {
    const clone = li.cloneNode(true)
    const nestedLists = Array.from(clone.querySelectorAll('ul, ol'))
    nestedLists.forEach(nl => nl.remove())

    const itemText = serializeInlineToMarkdown(clone).replace(/\s+/g, ' ').trim()
    const prefix = isOrdered ? `${idx + 1}. ` : '- '
    const pad = '  '.repeat(indent)
    if (itemText) {
      lines.push(`${pad}${prefix}${itemText}`)
    }

    Array.from(li.children)
      .filter(c => c.tagName && ['ul', 'ol'].includes(c.tagName.toLowerCase()))
      .forEach(subList => {
        const subMd = serializeListToMarkdown(subList, indent + 1)
        if (subMd) lines.push(subMd)
      })
  })

  return lines.join('\n')
}

/**
 * Converte HTML higienizado pelo Smart Paste em blocos estruturados da Edição Transparente
 * e em Markdown limpo compatível com o Wiki.js.
 */
export function htmlToEditorBlocks (cleanHtml = '', options = {}) {
  const parser = getDomParser(options.domParser)
  if (!parser || !String(cleanHtml || '').trim()) {
    return []
  }

  const doc = parser.parseFromString(cleanHtml, 'text/html')
  const body = doc.body
  if (!body) return []

  const blocks = []
  let seq = 0
  const nextId = () => `${options.idPrefix || 'paste'}-${Date.now()}-${seq++}`

  const processNode = (node) => {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      const txt = (node.nodeValue || '').trim()
      if (txt) {
        blocks.push({ id: nextId(), type: 'paragraph', text: txt })
      }
      return
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return

    const tag = node.tagName.toLowerCase()

    if (/^h[1-6]$/.test(tag)) {
      const rawLevel = parseInt(tag.charAt(1), 10)
      const level = rawLevel === 1 ? 2 : Math.min(4, Math.max(2, rawLevel))
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
      if (text) {
        blocks.push({
          id: nextId(),
          type: 'heading',
          level,
          text,
          anchor: null
        })
      }
      return
    }

    if (tag === 'blockquote') {
      const cls = node.getAttribute('class') || ''
      const text = serializeInlineToMarkdown(node).replace(/\s+/g, ' ').trim()
      if (!text) return
      if (cls.includes('is-warning')) {
        blocks.push({
          id: nextId(),
          type: 'callout',
          variant: 'warning',
          text
        })
      } else if (cls.includes('detran-legal-citation')) {
        blocks.push({
          id: nextId(),
          type: 'callout',
          variant: 'info',
          text: text.startsWith('⚖️') ? text : `⚖️ ${text}`
        })
      } else {
        blocks.push({
          id: nextId(),
          type: 'callout',
          variant: 'info',
          text
        })
      }
      return
    }

    if (tag === 'table') {
      const tableMd = serializeTableToMarkdown(node)
      if (tableMd) {
        blocks.push({
          id: nextId(),
          type: 'raw',
          text: tableMd
        })
      }
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      const listMd = serializeListToMarkdown(node)
      if (listMd) {
        blocks.push({
          id: nextId(),
          type: 'raw',
          text: listMd
        })
      }
      return
    }

    if (tag === 'img') {
      const src = node.getAttribute('src') || ''
      const alt = node.getAttribute('alt') || 'Imagem'
      if (src && !src.startsWith('blob:')) {
        blocks.push({
          id: nextId(),
          type: 'image',
          src,
          alt,
          title: alt
        })
      }
      return
    }

    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
      const imgs = Array.from(node.querySelectorAll('img'))
      if (imgs.length === 1 && !(node.textContent || '').trim()) {
        processNode(imgs[0])
        return
      }
      const inlineMd = serializeInlineToMarkdown(node).replace(/[ \t]+/g, ' ').trim()
      if (inlineMd) {
        if (WARNING_CALLOUT_REGEX.test(inlineMd)) {
          blocks.push({ id: nextId(), type: 'callout', variant: 'warning', text: inlineMd })
        } else if (INFO_CALLOUT_REGEX.test(inlineMd)) {
          blocks.push({ id: nextId(), type: 'callout', variant: 'info', text: inlineMd })
        } else {
          blocks.push({ id: nextId(), type: 'paragraph', text: inlineMd })
        }
      }
      return
    }

    const fallbackText = serializeInlineToMarkdown(node).trim()
    if (fallbackText) {
      blocks.push({ id: nextId(), type: 'paragraph', text: fallbackText })
    }
  }

  Array.from(body.childNodes).forEach(processNode)
  return blocks
}

/**
 * Converte HTML higienizado pelo Smart Paste diretamente para Markdown limpo do Wiki.js.
 */
export function htmlToCleanMarkdown (cleanHtml = '', options = {}) {
  const blocks = htmlToEditorBlocks(cleanHtml, options)
  return blocks.map(blk => {
    if (blk.type === 'heading') {
      const hashes = '#'.repeat(blk.level || 2)
      return `${hashes} ${blk.text}`
    }
    if (blk.type === 'callout') {
      const variant = blk.variant === 'warning' ? 'is-warning' : 'is-info'
      return `> ${blk.text}\n{.${variant}}`
    }
    if (blk.type === 'image') {
      return `![${blk.alt || 'Imagem'}](${blk.src})`
    }
    return blk.text
  }).filter(Boolean).join('\n\n')
}

/**
 * 3.3.4 Faz o upload automático de um arquivo binário, Blob ou data:image/... para o servidor (/upload),
 * prevenindo que URLs `blob:http://localhost...` sejam salvas no Markdown.
 */
export async function uploadPastedImage ({
  file = null,
  dataUrl = '',
  blobUrl = '',
  filename = 'imagem-colada.png',
  fetchImpl = null
} = {}) {
  const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch : null)
  if (!fetcher) {
    throw new Error('Cliente HTTP indisponível para upload de imagem.')
  }

  let uploadFile = file
  if (!uploadFile && blobUrl && /^blob:/i.test(blobUrl)) {
    try {
      const blobRes = await fetcher(blobUrl)
      if (blobRes && blobRes.ok && typeof blobRes.blob === 'function') {
        uploadFile = await blobRes.blob()
      }
    } catch (err) {
      throw new Error('A imagem temporária (blob:) expirou ou não pôde ser lida. Cole a imagem diretamente.')
    }
    if (!uploadFile) {
      throw new Error('A imagem temporária (blob:) não pôde ser recuperada.')
    }
  }

  if (uploadFile) {
    const formData = typeof FormData !== 'undefined' ? new FormData() : { append () {} }
    if (typeof formData.append === 'function') {
      try {
        formData.append('mediaAsset', uploadFile, uploadFile.name || filename)
      } catch (err) {
        formData.append('mediaAsset', uploadFile)
      }
    }
    const res = await fetcher('/upload', {
      method: 'POST',
      body: formData
    })
    if (!res || !res.ok) {
      throw new Error('Falha ao enviar imagem para o servidor da Intranet.')
    }
    const payload = await res.json()
    const permanentUrl = payload && (payload.path || payload.url)
    if (!permanentUrl || /^blob:/i.test(permanentUrl)) {
      throw new Error('Servidor não retornou uma URL permanente válida para a imagem.')
    }
    return permanentUrl
  }

  if (dataUrl && /^data:image\//i.test(dataUrl)) {
    const res = await fetcher('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, filename })
    })
    if (!res || !res.ok) {
      throw new Error('Falha ao converter imagem embutida para o servidor.')
    }
    const payload = await res.json()
    const permanentUrl = payload && (payload.path || payload.url)
    if (!permanentUrl || /^blob:/i.test(permanentUrl)) {
      throw new Error('Servidor não retornou uma URL permanente válida para a imagem.')
    }
    return permanentUrl
  }

  throw new Error('Nenhuma mídia válida fornecida para upload.')
}

/**
 * Inspeciona um Markdown em busca de URLs `blob:` efêmeras e bloqueia/remove ou alerta.
 */
export function inspectMarkdownForBlobUrls (markdown = '') {
  const raw = String(markdown || '')
  const matches = []
  const regex = /!\[([^\]]*)\]\((blob:[^)]+)\)/gi
  let m
  while ((m = regex.exec(raw)) !== null) {
    matches.push({
      fullMatch: m[0],
      alt: m[1] || 'Imagem',
      blobUrl: m[2]
    })
  }
  return {
    hasBlobUrls: matches.length > 0,
    matches,
    sanitizedMarkdown: raw.replace(regex, '![Imagem removida: link temporário expirado](/_assets/img/uploaded-fallback.png)')
  }
}

/**
 * Processa um evento ou payload completo de área de transferência (Smart Paste).
 */
export async function processSmartPastePayload ({
  html = '',
  plainText = '',
  files = [],
  fetchImpl = null,
  domParser = null,
  internalOrigins = [],
  onUploadStart = null,
  onUploadComplete = null
} = {}) {
  const fileList = Array.from(files || []).filter(f => f && String(f.type || '').startsWith('image/'))

  // Caso 1: Usuário colou print de tela ou arquivo de imagem direto do clipboard
  if (fileList.length > 0) {
    const uploadedBlocks = []
    for (const imgFile of fileList) {
      if (typeof onUploadStart === 'function') {
        onUploadStart('Enviando imagem para o servidor...')
      }
      const url = await uploadPastedImage({
        file: imgFile,
        filename: imgFile.name || 'captura-tela.png',
        fetchImpl
      })
      if (typeof onUploadComplete === 'function') {
        onUploadComplete(url)
      }
      uploadedBlocks.push({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'image',
        src: url,
        alt: imgFile.name ? imgFile.name.replace(/\.[^.]+$/, '') : 'Imagem colada',
        title: 'Imagem colada'
      })
    }
    const markdown = uploadedBlocks.map(b => `![${b.alt}](${b.src})`).join('\n\n')
    return {
      origin: 'image',
      html: uploadedBlocks.map(b => `<img src="${b.src}" alt="${b.alt}">`).join('\n'),
      markdown,
      blocks: uploadedBlocks,
      plainText: markdown,
      hadComplexFormatting: true,
      uploadedImages: uploadedBlocks.map(b => b.src),
      blockedBlobUrls: []
    }
  }

  // Caso 2: Processar HTML ou Texto Puro
  const transformed = sanitizeAndTransformHtml(html, {
    plainText,
    domParser,
    internalOrigins
  })

  let finalHtml = transformed.html
  const uploadedImages = []
  const blockedBlobs = [...transformed.blockedBlobUrls]

  if (transformed.detectedImages.length > 0 && (fetchImpl || typeof fetch === 'function')) {
    for (const imgInfo of transformed.detectedImages) {
      try {
        if (typeof onUploadStart === 'function') {
          onUploadStart('Enviando imagem para o servidor...')
        }
        const permanentUrl = await uploadPastedImage({
          dataUrl: imgInfo.type === 'data' ? imgInfo.src : '',
          blobUrl: imgInfo.type === 'blob' ? imgInfo.src : '',
          fetchImpl
        })
        uploadedImages.push(permanentUrl)
        finalHtml = finalHtml
          .replace(`data-pending-upload-src="${imgInfo.src}"`, '')
          .replace('/_assets/img/uploading-placeholder.png', permanentUrl)
          .replace(imgInfo.src, permanentUrl)
        if (typeof onUploadComplete === 'function') {
          onUploadComplete(permanentUrl)
        }
      } catch (err) {
        finalHtml = finalHtml.replace(new RegExp(`<img[^>]*data-pending-upload-src=["']${imgInfo.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'gi'), '')
      }
    }
  } else if (transformed.detectedImages.length > 0) {
    transformed.detectedImages.forEach(imgInfo => {
      if (imgInfo.type === 'blob') {
        finalHtml = finalHtml.replace(new RegExp(`<img[^>]*data-pending-upload-src=["']${imgInfo.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'gi'), '')
      }
    })
  }

  const blocks = htmlToEditorBlocks(finalHtml, { domParser })
  const markdown = htmlToCleanMarkdown(finalHtml, { domParser })

  return {
    origin: transformed.origin,
    html: finalHtml,
    markdown,
    blocks,
    plainText: String(plainText || '').trim(),
    hadComplexFormatting: transformed.hadComplexFormatting,
    uploadedImages,
    blockedBlobUrls: blockedBlobs
  }
}

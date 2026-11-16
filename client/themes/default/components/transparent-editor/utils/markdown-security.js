/**
 * Núcleo Compartilhado de Sanitização XSS, URLs, SVGs e Tabelas Markdown (DRY / Security)
 * Utilizado tanto pelo Editor Transparente quanto pelo Painel de Revisão / Diff Visual.
 */

function escapeHtml (str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Decodifica entidades HTML básicas para impedir bypass de esquema (ex: &#106;avascript:).
 */
function decodeHtmlEntitiesForSchemeCheck (val = '') {
  return String(val || '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '')
    .replace(/&newline;/gi, '')
}

/**
 * Valida uma URL contra esquemas executáveis ou efêmeros (javascript:, vbscript:, data:, file:, blob:).
 * Retorna string vazia se a URL for insegura.
 *
 * @param {string} rawUrl
 * @returns {string}
 */
function sanitizeSafeUrl (rawUrl = '') {
  const trimmed = String(rawUrl || '').trim()
  if (!trimmed) return ''

  const normalizedCheck = Array.from(decodeHtmlEntitiesForSchemeCheck(trimmed))
    .filter(ch => ch.charCodeAt(0) > 32)
    .join('')
    .toLowerCase()

  if (/^(?:javascript|vbscript|data|file|blob):/i.test(normalizedCheck)) {
    return ''
  }

  // Se possuir esquema explícito, permitir apenas http:, https: ou mailto:
  const schemeMatch = normalizedCheck.match(/^([a-z][a-z0-9+.-]*):/i)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase()
    if (scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto') {
      return ''
    }
  }

  return trimmed
}

/**
 * Sanitiza markup SVG decodificado de blocos ```diagram (Base64),
 * removendo scripts, foreignObject, iframes, objetos embutidos, handlers on* e links javascript:/data:.
 *
 * @param {string} rawSvg
 * @returns {string}
 */
function sanitizeSvgMarkup (rawSvg = '') {
  const str = String(rawSvg || '').replace(/\uFFFD+/g, '').trim()
  if (!str || !/<svg[\s>]/i.test(str)) return ''

  let cleaned = str
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<(?:iframe|object|embed|applet|meta|link)\b[\s\S]*?<\/(?:iframe|object|embed|applet|meta|link)>/gi, '')
    .replace(/<(?:iframe|object|embed|applet|meta|link)\b[^>]*\/?>/gi, '')
    .replace(/<foreignObject\b[^>]*>\s*<\/foreignObject>/gi, '')
    .replace(/\son[a-z0-9_]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:href|href|src|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (full, dq, sq, uq) => {
      const val = dq !== undefined ? dq : (sq !== undefined ? sq : (uq || ''))
      const safe = sanitizeSafeUrl(val)
      if (!safe) return ''
      const attrName = full.split('=')[0].trim()
      return ` ${attrName}="${escapeHtml(safe)}"`
    })
    .trim()

  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    cleaned = window.DOMPurify.sanitize(cleaned, {
      USE_PROFILES: { svg: true, svgFilters: true, html: true },
      ADD_TAGS: ['foreignObject'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus']
    })
  }

  return cleaned
}

/**
 * Decodifica e sanitiza diagrama SVG armazenado em Base64 (ou SVG direto) dentro de blocos ```diagram.
 *
 * @param {string} b64
 * @returns {string}
 */
function decodeDiagramBase64Svg (b64 = '') {
  const unquoted = String(b64 || '')
    .replace(/^\s*>+\s?/gm, '')
    .replace(/\berro\+(?=PGRlZn)/g, '')
    .trim()
  if (!unquoted) return ''
  if (/^<svg[\s>]/i.test(unquoted)) {
    return sanitizeSvgMarkup(unquoted)
  }
  const cleanB64 = unquoted.replace(/\s+/g, '')
  if (!cleanB64) return ''
  let decoded = ''
  try {
    if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(cleanB64, 'base64').toString('utf8')
    } else if (typeof atob === 'function') {
      const binary = atob(cleanB64)
      try {
        decoded = decodeURIComponent(escape(binary))
      } catch (e) {
        decoded = binary
      }
    }
  } catch (err) {
    return ''
  }
  return sanitizeSvgMarkup(decoded)
}

/**
 * Divide uma linha de tabela Markdown por pipes não escapados (\|) e restaura \| para |.
 *
 * @param {string} line
 * @returns {Array<string>}
 */
function splitEscapedTableRow (line = '') {
  const trimmed = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells = []
  let current = ''
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
      current += '|'
      i++
    } else if (trimmed[i] === '|') {
      cells.push(current.trim())
      current = ''
    } else {
      current += trimmed[i]
    }
  }
  cells.push(current.trim())
  return cells
}

module.exports = {
  escapeHtml,
  sanitizeSafeUrl,
  sanitizeSvgMarkup,
  decodeDiagramBase64Svg,
  splitEscapedTableRow
}

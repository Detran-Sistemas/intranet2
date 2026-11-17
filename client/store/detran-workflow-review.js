const Diff = require('diff')
const Diff2Html = require('diff2html')
const _ = require('lodash')
const {
  escapeHtml,
  sanitizeSafeUrl,
  decodeDiagramBase64Svg,
  splitEscapedTableRow
} = require('../themes/default/components/transparent-editor/utils/markdown-security')

/**
 * Detran Workflow Review Logic Helper
 * Pure JS helper to manage diff calculation (both legacy unified diff and
 * Google Docs-style Visual WYSIWYG Diff), TextQuoteSelector anchoring,
 * suggestion accept/reject consolidation, and reviewer action state.
 */

/**
 * Generate a unified diff patch between original live content and proposed draft content.
 *
 * @param {object} params
 * @param {string} params.path - Document path
 * @param {string} [params.originalContent=''] - Live published content
 * @param {string} [params.draftContent=''] - Draft content in review
 * @returns {string} Unified diff patch
 */
function generateDiffPatch ({ path = 'document', originalContent = '', draftContent = '' }) {
  const safePath = path.startsWith('/') ? path : `/${path}`
  const orig = originalContent || ''
  const draft = draftContent || ''
  return Diff.createPatch(safePath, orig, draft, 'Versão Publicada', 'Rascunho Proposto')
}

/**
 * Render diff string to HTML using diff2html
 *
 * @param {object} params
 * @param {string} params.patch - Unified diff patch
 * @param {('line-by-line'|'side-by-side')} [params.viewMode='side-by-side']
 * @returns {string} Rendered HTML string
 */
function renderDiffHtml ({ patch, viewMode = 'side-by-side' }) {
  if (!patch) return ''
  return Diff2Html.html(patch, {
    inputFormat: 'diff',
    drawFileList: false,
    matching: 'lines',
    outputFormat: viewMode === 'line-by-line' ? 'line-by-line' : 'side-by-side'
  })
}

/**
 * Group comments by line number and calculate summary counts
 *
 * @param {Array<object>} comments
 * @returns {{ byLine: object, general: Array<object>, unresolvedCount: number, totalCount: number }}
 */
function groupCommentsByLine (comments = []) {
  const safeComments = Array.isArray(comments) ? comments : []
  const byLine = {}
  const general = []
  let unresolvedCount = 0

  for (const c of safeComments) {
    if (!c.resolved) {
      unresolvedCount++
    }
    const line = _.toSafeInteger(c.lineNumber)
    if (line > 0) {
      if (!byLine[line]) {
        byLine[line] = []
      }
      byLine[line].push(c)
    } else {
      general.push(c)
    }
  }

  return {
    byLine,
    general,
    unresolvedCount,
    totalCount: safeComments.length
  }
}

/**
 * Determine which reviewer/approver actions are available for a given draft state and approval mode.
 *
 * @param {object} params
 * @param {string} params.state - 'draft', 'in_review', 'in_approval_step2', 'changes_requested', 'published', 'rejected'
 * @param {string} params.approvalMode - '1_level' or '2_levels'
 * @param {object} [params.permissions={}] - User effective permissions
 * @returns {object} Action flags
 */
const ACTIVE_REVIEW_STATES = new Set([
  'in_review',
  'awaiting_approval',
  'in_approval_step2',
  'periodic_review',
  'revisao_periodica'
])

/**
 * Determine whether the current user can open direct text editing ("Editar Texto")
 * for a draft in the comparative review screen.
 *
 * Authors cannot silently edit while their draft is in active review — they must
 * retract it to `draft` first. Third-party reviewers/approvers CAN edit inline.
 *
 * @param {object} options
 * @param {string} options.state
 * @param {boolean} [options.isAuthor=false]
 * @param {boolean} [options.canReviewOrApprove=false]
 * @returns {boolean}
 */
function canEditDraftContentInReview ({ state, isAuthor = false, canReviewOrApprove = false } = {}) {
  if (!state || state === 'published' || state === 'archived') {
    return false
  }
  if (ACTIVE_REVIEW_STATES.has(state)) {
    return Boolean(!isAuthor && canReviewOrApprove)
  }
  if (state === 'draft' || state === 'changes_requested') {
    return Boolean(isAuthor || canReviewOrApprove)
  }
  return false
}

/**
 * Determine whether the current user can accept/reject/reopen review items
 * (suggestions, redactions, comments).
 *
 * Enforces strict Four-Eyes (authors never decide their own submission, even with
 * elevated permissions) and locks decisions outside active review states.
 *
 * @param {object} options
 * @param {boolean} [options.isAuthor=false]
 * @param {boolean} [options.canReviewOrApprove=false]
 * @param {string} [options.state='in_review']
 * @returns {boolean}
 */
function canDecideReviewSuggestion ({ isAuthor = false, canReviewOrApprove = false, state = 'in_review' } = {}) {
  if (isAuthor || !canReviewOrApprove) {
    return false
  }
  return ACTIVE_REVIEW_STATES.has(state)
}

function getAvailableReviewActions (draftOrOptions = {}, permissionsArg = null) {
  const opts = draftOrOptions || {}
  const state = opts.state
  const approvalMode = opts.approvalMode || '1_level'
  const permissions = permissionsArg || opts.permissions || {}
  const canReview = Boolean(permissions['review:pages'] || permissions['manage:pages'] || permissions['manage:system'])
  const canApprove = Boolean(permissions['approve:pages'] || permissions['manage:pages'] || permissions['manage:system'])
  const resolvedIsAuthor = opts.isAuthor !== undefined ?
    Boolean(opts.isAuthor) :
    Boolean(opts.userId != null && opts.authorId != null && Number(opts.userId) === Number(opts.authorId))
  const pendingReviewCount = Number(opts.pendingReviewCount) || 0
  const canReviewOrApprove = canReview || canApprove

  const actions = {
    canRequestChanges: false,
    canApproveStep: false,
    canPublish: false,
    canRevalidate: false,
    canSubmit: state === 'draft' || state === 'changes_requested',
    canRetract: resolvedIsAuthor && (state === 'in_review' || state === 'awaiting_approval' || state === 'in_approval_step2'),
    canEditText: canEditDraftContentInReview({ state, isAuthor: resolvedIsAuthor, canReviewOrApprove }),
    isApprovalBlockedByPendingItems: false,
    canFinalizeApproveStep: false,
    canFinalizePublish: false,
    requiresApproverToPublish: false,
    awaitingFinalApprovalOnly: false,
    labelApproveStep: 'Enviar para o Aprovador',
    labelPublish: 'Homologar e Publicar',
    labelRevalidate: 'Revalidar Vigência (+12m)',
    statusDescription: ''
  }

  if (state === 'in_review') {
    if (!resolvedIsAuthor) {
      actions.canRequestChanges = canReviewOrApprove
    }
    if (!resolvedIsAuthor) {
      if (canApprove && approvalMode !== '2_levels') {
        // Approver in 1-level mode can publish directly
        actions.canPublish = true
        actions.canApproveStep = false
        actions.statusDescription = 'Aguardando Homologação Direta (Nível Único)'
      } else {
        // Reviewer (or in 2-level mode): can approve review step and forward to Approver
        actions.canPublish = false
        actions.canApproveStep = canReviewOrApprove
        actions.labelApproveStep = 'Enviar para o Aprovador'
        actions.statusDescription = resolvedIsAuthor ?
          'Aguardando parecer do revisor técnico. Puxe de volta para editar se necessário.' :
          (approvalMode === '2_levels' ?
            'Aguardando Revisão Técnica (Nível 1 de 2)' :
            'Aguardando Parecer do Revisor — revise as modificações e envie ao aprovador')
      }
    } else {
      actions.statusDescription = 'Aguardando parecer do revisor técnico. Puxe de volta para editar se necessário.'
    }
  } else if (state === 'awaiting_approval' || state === 'in_approval_step2') {
    if (!resolvedIsAuthor) {
      actions.canRequestChanges = canApprove
      actions.canPublish = canApprove
    }
    actions.statusDescription = resolvedIsAuthor ?
      'Aguardando homologação final. Puxe de volta para editar se necessário.' :
      'Aguardando Homologação Final (Nível 2 de 2)'
  } else if (state === 'revisao_periodica' || state === 'periodic_review') {
    if (!resolvedIsAuthor) {
      actions.canRevalidate = canApprove
      actions.canRequestChanges = canReviewOrApprove
    }
    actions.statusDescription = 'Vigência de 12 meses expirada. Aguardando revalidação periódica ou revisão.'
  } else if (state === 'changes_requested') {
    actions.statusDescription = 'Ajustes solicitados ao autor. Aguardando reedição e nova submissão.'
  } else if (state === 'published') {
    actions.statusDescription = 'Documento homologado e publicado oficialmente na intranet.'
  } else if (state === 'draft') {
    actions.statusDescription = 'Rascunho preliminar. Aguardando submissão pelo autor para revisão.'
  }

  actions.isApprovalBlockedByPendingItems = pendingReviewCount > 0 && (actions.canApproveStep || actions.canPublish)
  actions.canFinalizeApproveStep = Boolean(actions.canApproveStep && !actions.isApprovalBlockedByPendingItems)
  actions.canFinalizePublish = Boolean(actions.canPublish && !actions.isApprovalBlockedByPendingItems)
  actions.awaitingFinalApprovalOnly = Boolean(
    !resolvedIsAuthor &&
    !canApprove &&
    (state === 'awaiting_approval' || state === 'in_approval_step2')
  )
  actions.requiresApproverToPublish = Boolean(
    !resolvedIsAuthor &&
    canReview &&
    !canApprove &&
    (state === 'awaiting_approval' || state === 'in_approval_step2')
  )

  return actions
}

/**
 * Extract target line number from a clicked diff element.
 *
 * @param {HTMLElement|object} el - Clicked element or mock object with className/innerText/attributes
 * @returns {number|null} Line number or null
 */
function extractLineFromDiffElement (el) {
  if (!el) return null

  let current = el
  for (let i = 0; i < 5 && current; i++) {
    const className = current.className || ''
    const text = (current.innerText || current.textContent || '').trim()

    if (typeof className === 'string' && className.includes('d2h-code-linenumber')) {
      const parsed = parseInt(text, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }

    if (current.dataset && current.dataset.lineNumber) {
      const parsed = parseInt(current.dataset.lineNumber, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }

    current = current.parentElement
  }

  return null
}

// =============================================================================
// NOVO MOTOR DE REVISÃO VISUAL (ESTILO GOOGLE DOCS) + TEXT QUOTE SELECTOR
// =============================================================================

/**
 * Remove símbolos crus de Markdown para exibição amigável nos cartões laterais.
 */

function stripMarkdownSymbols (md = '') {
  return String(md || '')
    .replace(/^(?:```+|~~~+)\s*diagram\b[\s\S]*?(?:\n(?:```+|~~~+)\s*$|$)/gim, '[Diagrama Técnico]')
    .replace(/^(?:```+|~~~+)\s*mermaid\b[\s\S]*?(?:\n(?:```+|~~~+)\s*$|$)/gim, '[Diagrama Mermaid]')
    .replace(/^(?:```+|~~~+)[^\n]*\n([\s\S]*?)\n(?:```+|~~~+)\s*$/gm, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s*\{#[^}\s]+\}/g, '')
    .replace(/\{\.is-(?:info|warning|success|danger)\}/g, '')
    .replace(/\{\.links-list\}/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/**
 * Converte formatação Markdown inline em HTML rico sem deixar símbolos Markdown (`**`, `*`, `[txt](url)`).
 */
function renderInlineMarkdownToHtml (md = '') {
  if (!md) return ''
  let html = escapeHtml(md)
  // Remove sufixos de atributos Wiki.js
  html = html.replace(/\s*\{#[^}\s]+\}/g, '')
  html = html.replace(/\{\.is-(?:info|warning|success|danger)\}/g, '')
  html = html.replace(/\{\.links-list\}/g, '')

  // Código inline
  html = html.replace(/`([^`\n]+)`/g, '<code class="detran-inline-code">$1</code>')
  // Imagens inline (caso existam no meio de uma frase) — higieniza URL
  html = html.replace(/!\[([^\]]*)\]\(((?:\([^)]*\)|[^)])+)\)/g, (_, alt, rawUrl) => {
    const safeSrc = sanitizeSafeUrl(rawUrl)
    if (!safeSrc) return alt || ''
    return `<img src="${escapeHtml(safeSrc)}" alt="${alt}" class="detran-inline-img">`
  })
  // Links [texto](url) — higieniza URL contra javascript:/vbscript:/data:
  html = html.replace(/\[([^\]]+)\]\(((?:\([^)]*\)|[^)])+)\)/g, (_, label, rawUrl) => {
    const safeHref = sanitizeSafeUrl(rawUrl)
    if (!safeHref) return label
    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener">${label}</a>`
  })
  // Negrito + Itálico
  html = html.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  // Negrito
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  // Tachado
  html = html.replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
  // Itálico
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')

  return html
}

/**
 * Divide um documento Markdown em blocos lógicos para comparação visual WYSIWYG.
 */
function splitMarkdownIntoBlocks (md = '') {
  const normalized = String(md || '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const lines = normalized.split('\n')
  const blocks = []
  let current = []
  let activeFence = null
  let activeFenceWasQuoted = false

  const flushCurrent = () => {
    if (current.length > 0) {
      const chunk = current.join('\n').trim()
      if (chunk && !/^\{\.is-(?:info|warning|success|danger)\}$/i.test(chunk)) {
        blocks.push(chunk)
      }
      current = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    const unquotedTrimmed = trimmedLine.replace(/^(?:>\s*)+/, '').trim()

    if (activeFence) {
      const fenceLine = activeFenceWasQuoted ? line.replace(/^\s*(?:>\s?)+/, '') : line
      current.push(fenceLine)
      const checkClose = fenceLine.trim()
      if (
        checkClose.startsWith(activeFence[0].repeat(3)) &&
        checkClose.replace(new RegExp('^' + activeFence[0] + '+'), '').trim() === ''
      ) {
        blocks.push(current.join('\n').trim())
        current = []
        activeFence = null
        activeFenceWasQuoted = false
      }
      continue
    }

    const fenceOpen = unquotedTrimmed.match(/^(```+|~~~+)([^\s`~]*)/)
    if (fenceOpen) {
      flushCurrent()
      activeFence = fenceOpen[1]
      activeFenceWasQuoted = trimmedLine.startsWith('>')
      current.push(activeFenceWasQuoted ? line.replace(/^\s*(?:>\s?)+/, '') : line)
      continue
    }

    if (trimmedLine === '' || /^>(?:\s*>)*\s*$/.test(trimmedLine)) {
      flushCurrent()
      continue
    }

    if (/^\{\.is-(?:info|warning|success|danger)\}$/i.test(unquotedTrimmed) || /^\{\.links-list\}$/i.test(unquotedTrimmed)) {
      if (current.length > 0) {
        current.push(unquotedTrimmed)
        flushCurrent()
      }
      continue
    }

    if (/^<\/(?:div|blockquote)\s*>$/i.test(unquotedTrimmed)) {
      current.push(line)
      flushCurrent()
      continue
    }

    current.push(line)
  }

  flushCurrent()

  return blocks.filter(Boolean)
}

/**
 * Identifica o tipo de um bloco Markdown.
 */
function classifyMarkdownBlock (rawBlock = '') {
  const trimmed = String(rawBlock || '').trim()

  const fenceLines = trimmed.split('\n').map(l => l.replace(/^\s*(?:>\s?)+/, ''))
  const fenceStart = fenceLines[0].trim().match(/^(```+|~~~+)\s*([^\s`~]*)/)
  if (fenceStart && fenceLines.length >= 2) {
    const fenceMarker = fenceStart[1]
    const lang = (fenceStart[2] || '').toLowerCase()
    const lastLine = fenceLines[fenceLines.length - 1].trim()
    const hasClosing = lastLine.startsWith(fenceMarker[0].repeat(3))
    const bodyLines = hasClosing ? fenceLines.slice(1, -1) : fenceLines.slice(1)
    const code = bodyLines.join('\n')
    const cleanCode = code.trim()
    if (
      lang === 'diagram' ||
      lang === 'drawio' ||
      lang === 'svg' ||
      (!lang && (/^PHN2Zy/.test(cleanCode) || /^<svg[\s>]/i.test(cleanCode)))
    ) {
      return { kind: 'diagram', lang: 'diagram', code: cleanCode, raw: trimmed }
    }
    if (
      lang === 'mermaid' ||
      (!lang && /^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|mindmap)\b/i.test(cleanCode))
    ) {
      return { kind: 'mermaid', lang: 'mermaid', code: cleanCode, raw: trimmed }
    }
    return { kind: 'code', lang, code, raw: trimmed }
  }

  if (/^(?:[-]{3,}|[*]{3,}|[_]{3,})$/.test(trimmed)) {
    return { kind: 'hr', raw: trimmed }
  }

  const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/)
  if (imgMatch) {
    return {
      kind: 'image',
      alt: imgMatch[1] || 'Imagem ilustrativa',
      src: imgMatch[2] || '',
      title: imgMatch[3] || imgMatch[1] || '',
      raw: trimmed
    }
  }

  const headingMatch = trimmed.match(/^(#{1,6})\s+(.*?)(?:\s*\{#([^}\s]+)\})?\s*$/)
  if (headingMatch) {
    return {
      kind: 'heading',
      level: Math.min(6, Math.max(1, headingMatch[1].length)),
      text: headingMatch[2].trim(),
      raw: trimmed
    }
  }

  const htmlCalloutMatch = trimmed.match(/^\s*<(div|blockquote)\s+[^>]*class=["'][^"']*\bis-(info|warning|success|danger)\b[^"']*["'][^>]*>([\s\S]*)$/i)
  if (htmlCalloutMatch) {
    const tagName = htmlCalloutMatch[1].toLowerCase()
    const variant = htmlCalloutMatch[2].toLowerCase()
    const closeRegex = new RegExp(`<\\/${tagName}\\s*>\\s*$`, 'i')
    const innerHtml = htmlCalloutMatch[3].replace(closeRegex, '').trim()
    const cleanText = innerHtml
      .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
      .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      kind: 'callout',
      variant,
      text: cleanText,
      raw: trimmed
    }
  }

  const lines = trimmed.split('\n')
  if (lines[0].startsWith('>')) {
    const lastLine = lines[lines.length - 1].trim().replace(/^(?:>\s*)+/, '')
    const calloutMatch = lastLine.match(/^\{\.is-(info|warning|success|danger)\}$/)
    const variant = calloutMatch ? calloutMatch[1] : 'info'
    const quoteLines = calloutMatch ? lines.slice(0, -1) : lines
    const text = quoteLines.map(l => l.replace(/^\s*(?:>\s?)+/, '')).join(' ').trim()
    return {
      kind: 'callout',
      variant,
      text,
      raw: trimmed
    }
  }

  if (lines[0].trim().startsWith('|') && lines.length >= 2) {
    return {
      kind: 'table',
      lines,
      raw: trimmed
    }
  }

  if (/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[0])) {
    const isLinksList = lines[lines.length - 1].trim() === '{.links-list}'
    return {
      kind: isLinksList ? 'links' : 'list',
      ordered: /^\s*\d+\.\s+/.test(lines[0]),
      lines: isLinksList ? lines.slice(0, -1) : lines,
      raw: trimmed
    }
  }

  return {
    kind: 'paragraph',
    text: trimmed,
    raw: trimmed
  }
}

/**
 * Renderiza um bloco Markdown sem alterações para HTML WYSIWYG da folha A4.
 */
function renderCleanBlockToHtml (blockOrMd, innerHtmlOverride = null) {
  if (!blockOrMd) return ''
  const blockObj = typeof blockOrMd === 'string' ? classifyMarkdownBlock(blockOrMd) : blockOrMd
  if (!blockObj) return ''

  if (blockObj.kind === 'image') {
    const isBlob = /^blob:/i.test(blockObj.src)
    const safeSrc = isBlob ? blockObj.src : sanitizeSafeUrl(blockObj.src)
    const caption = escapeHtml(blockObj.title || blockObj.alt || 'Imagem ilustrativa')
    return `
      <figure class="detran-doc-figure">
        ${safeSrc ? `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(blockObj.alt)}" class="detran-doc-img" />` : ''}
        ${isBlob ? '<div class="detran-blob-warning">⚠️ Alerta: Imagem temporária local (blob:) detectada.</div>' : ''}
        <figcaption class="detran-doc-figcaption">${caption}</figcaption>
      </figure>
    `.trim()
  }

  if (blockObj.kind === 'heading') {
    const tag = `h${Math.max(2, Math.min(4, blockObj.level))}`
    const content = innerHtmlOverride !== null ? innerHtmlOverride : renderInlineMarkdownToHtml(blockObj.text)
    return `<${tag} class="detran-doc-${tag}">${content}</${tag}>`
  }

  if (blockObj.kind === 'callout') {
    const content = innerHtmlOverride !== null ? innerHtmlOverride : renderInlineMarkdownToHtml(blockObj.text)
    return `<blockquote class="detran-doc-callout is-${blockObj.variant}"><p>${content}</p></blockquote>`
  }

  if (blockObj.kind === 'table') {
    const headerCells = splitEscapedTableRow(blockObj.lines[0])
    const isSep = blockObj.lines[1] && /^[\s|:-]+$/.test(blockObj.lines[1])
    const bodyRows = (isSep ? blockObj.lines.slice(2) : blockObj.lines.slice(1)).map(splitEscapedTableRow)
    const thead = `<thead><tr>${headerCells.map(c => `<th>${renderInlineMarkdownToHtml(c)}</th>`).join('')}</tr></thead>`
    const tbody = `<tbody>${bodyRows.map(r => `<tr>${r.map(c => `<td>${renderInlineMarkdownToHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
    return `<div class="detran-doc-table-wrap"><table class="detran-doc-table">${thead}${tbody}</table></div>`
  }

  if (blockObj.kind === 'links') {
    const items = blockObj.lines.map(l => {
      const m = l.trim().match(/^[-*+]\s+\[(.+?)(?:\s+\*(.+?)\*)?\]\(([^)]+)\)/)
      if (!m) return `<li>${renderInlineMarkdownToHtml(l.replace(/^[-*+]\s+/, ''))}</li>`
      const safeHref = sanitizeSafeUrl(m[3])
      const innerLabel = `<strong>${escapeHtml(m[1])}</strong>${m[2] ? ` <em>${escapeHtml(m[2])}</em>` : ''}`
      if (!safeHref) return `<li>${innerLabel}</li>`
      return `<li><a href="${escapeHtml(safeHref)}">${innerLabel}</a></li>`
    }).join('')
    return `<ul class="detran-doc-links-list">${items}</ul>`
  }

  if (blockObj.kind === 'list') {
    const tag = blockObj.ordered ? 'ol' : 'ul'
    const items = blockObj.lines
      .filter(l => l.trim())
      .map(l => `<li>${renderInlineMarkdownToHtml(l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''))}</li>`)
      .join('')
    return `<${tag} class="detran-doc-list">${items}</${tag}>`
  }

  if (blockObj.kind === 'diagram') {
    const svg = decodeDiagramBase64Svg(blockObj.code)
    if (svg) {
      return `<div class="detran-doc-diagram"><div class="diagram">${svg}</div></div>`
    }
    return `<pre class="detran-doc-code"><code>${escapeHtml(blockObj.code)}</code></pre>`
  }

  if (blockObj.kind === 'mermaid') {
    return `<div class="detran-doc-diagram detran-doc-mermaid"><div class="mermaid">${escapeHtml(blockObj.code)}</div></div>`
  }

  if (blockObj.kind === 'code') {
    const langAttr = blockObj.lang ? ` class="language-${escapeHtml(blockObj.lang)}"` : ''
    return `<pre class="detran-doc-code"><code${langAttr}>${escapeHtml(blockObj.code)}</code></pre>`
  }

  if (blockObj.kind === 'hr') {
    return '<hr class="detran-doc-hr" />'
  }

  const content = innerHtmlOverride !== null ? innerHtmlOverride : renderInlineMarkdownToHtml(blockObj.text)
  return `<p class="detran-doc-p">${content}</p>`
}

/**
 * Envolve um diagrama adicionado ou removido em destaque visual mantendo o SVG/Mermaid renderizado.
 */
function wrapDiagramInSuggestionBox (blockObj, sugId, badgeLabel = 'Novo Diagrama Adicionado', mode = 'add') {
  const rendered = renderCleanBlockToHtml(blockObj)
  const cls = mode === 'del' ? 'is-del' : 'is-add'
  const pill = mode === 'del' ? 'Sugestão de Remoção' : 'Sugestão de Adição'
  return `
    <div id="item-${sugId}" data-item-id="${sugId}" class="diagram-suggestion-box ${cls}">
      <div class="img-suggestion-badge">
        <span class="img-suggestion-badge__left">📐 ${escapeHtml(badgeLabel)}</span>
        <span class="img-suggestion-badge__pill">${pill}</span>
      </div>
      ${rendered}
    </div>
  `.trim()
}

/**
 * Envolve uma imagem recém-adicionada ou substituída na caixa tracejada verde estilo Google Docs (Seção 2.2).
 */
function wrapImageInSuggestionBox (blockObj, sugId, badgeLabel = 'Nova Imagem Adicionada') {
  const isBlob = /^blob:/i.test(blockObj.src)
  const caption = escapeHtml(blockObj.title || blockObj.alt || 'Imagem inserida no documento')
  return `
    <div id="item-${sugId}" data-item-id="${sugId}" class="img-suggestion-box">
      <div class="img-suggestion-badge">
        <span class="img-suggestion-badge__left">🖼️ ${escapeHtml(badgeLabel)}</span>
        <span class="img-suggestion-badge__pill">${isBlob ? '⚠️ URL Blob Local' : 'Sugestão de Adição'}</span>
      </div>
      ${isBlob ? '<div class="detran-blob-alert">Atenção: Esta imagem usa uma URL temporária (blob:) que não abrirá em outros computadores.</div>' : ''}
      <figure class="detran-doc-figure">
        <img src="${escapeHtml(blockObj.src)}" alt="${escapeHtml(blockObj.alt)}" class="detran-doc-img" />
        <figcaption class="detran-doc-figcaption">${caption}</figcaption>
      </figure>
    </div>
  `.trim()
}

/**
 * Codifica um objeto TextQuoteSelector (Web Annotation Data Model) para persistência em anchorText.
 */
function encodeTextQuoteSelector ({
  id = '',
  targetId = null,
  parentCommentId = null,
  exact = '',
  prefix = '',
  suffix = '',
  suggestedReplacement = '',
  status = 'pending',
  reviewedAt = null,
  replies = []
} = {}) {
  return JSON.stringify({
    type: 'TextQuoteSelector',
    id: id || `tq-${Date.now()}`,
    targetId: targetId || undefined,
    parentCommentId: parentCommentId || undefined,
    exact: String(exact || '').trim(),
    prefix: String(prefix || '').slice(-30),
    suffix: String(suffix || '').slice(0, 30),
    suggestedReplacement: String(suggestedReplacement || '').trim(),
    status: status || 'pending',
    reviewedAt: reviewedAt || null,
    replies: Array.isArray(replies) ? replies : []
  })
}

/**
 * Decodifica o campo anchorText de um comentário do banco (suporta JSON TextQuoteSelector e strings legadas).
 */
function decodeTextQuoteSelector (commentRow = {}) {
  const rawAnchor = commentRow && commentRow.anchorText ? String(commentRow.anchorText).trim() : ''
  if (rawAnchor.startsWith('{') && rawAnchor.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawAnchor)
      if (parsed && (parsed.type === 'TextQuoteSelector' || typeof parsed.exact === 'string')) {
        return {
          id: parsed.id || `com-${commentRow.id || Date.now()}`,
          targetId: parsed.targetId || null,
          parentCommentId: parsed.parentCommentId || null,
          exact: parsed.exact || '',
          prefix: parsed.prefix || '',
          suffix: parsed.suffix || '',
          suggestedReplacement: parsed.suggestedReplacement || '',
          status: commentRow.resolved ? 'accepted' : (parsed.status || 'pending'),
          reviewedAt: parsed.reviewedAt || null,
          replies: Array.isArray(parsed.replies) ? parsed.replies : []
        }
      }
    } catch (err) {
      // Fallback para texto simples
    }
  }

  return {
    id: `com-${commentRow.id || Date.now()}`,
    targetId: null,
    parentCommentId: null,
    exact: rawAnchor,
    prefix: '',
    suffix: '',
    suggestedReplacement: '',
    status: commentRow && commentRow.resolved ? 'accepted' : 'pending',
    reviewedAt: null,
    replies: []
  }
}

/**
 * Cria um seletor TextQuoteSelector (`{ exact, prefix, suffix }`) a partir do texto completo e do trecho selecionado.
 */
function createTextQuoteSelectorFromText (fullText = '', selectedText = '', selectionStartOffset = -1) {
  const exact = String(selectedText || '').trim()
  if (!exact) {
    return { exact: '', prefix: '', suffix: '' }
  }
  const source = String(fullText || '')
  let idx = selectionStartOffset >= 0 ? source.indexOf(exact, Math.max(0, selectionStartOffset - 15)) : -1
  if (idx === -1) {
    idx = source.indexOf(exact)
  }
  if (idx === -1) {
    return { exact, prefix: '', suffix: '' }
  }
  const prefix = source.slice(Math.max(0, idx - 30), idx)
  const suffix = source.slice(idx + exact.length, idx + exact.length + 30)
  return { exact, prefix, suffix }
}

/**
 * Gera o documento HTML visual (estilo Google Docs) + lista de cartões de sugestões de diff e comentários
 * ancorados via TextQuoteSelector, sem exibir nenhum caractere cru de Markdown.
 */
function buildVisualDiffDocument ({
  originalContent = '',
  draftContent = '',
  comments = [],
  authorName = 'Autor',
  updatedAt = 'Agora mesmo',
  decisions = {}
} = {}) {
  const origTrimmed = String(originalContent || '').trim()
  const draftTrimmed = String(draftContent || '').trim()

  const origBlocks = splitMarkdownIntoBlocks(origTrimmed)
  const draftBlocks = splitMarkdownIntoBlocks(draftTrimmed)

  const suggestions = []
  const htmlBlocks = []
  let sugCounter = 1
  const hasOriginalBaseline = origBlocks.length > 0

  if (!hasOriginalBaseline) {
    // Página nova ou sem versão anterior publicada: renderiza os blocos limpos e destaca imagens novas
    draftBlocks.forEach(rawBlk => {
      const classified = classifyMarkdownBlock(rawBlk)
      if (classified.kind === 'image') {
        const sugId = `sug-${sugCounter++}`
        const decision = decisions[sugId] || 'pending'
        if (decision === 'accepted') {
          htmlBlocks.push(renderCleanBlockToHtml(classified))
        } else if (decision === 'rejected') {
          // Imagem rejeitada não é renderizada na folha
        } else {
          htmlBlocks.push(wrapImageInSuggestionBox(classified, sugId, 'Nova Imagem Adicionada'))
        }
        suggestions.push({
          id: sugId,
          type: 'suggestion',
          isImage: true,
          hasBlobWarning: /^blob:/i.test(classified.src),
          author: authorName || 'Autor',
          role: 'Autor da alteração',
          time: updatedAt,
          actionLabel: 'Inseriu uma nova imagem',
          oldText: '',
          newText: classified.alt || classified.src,
          rawOldMarkdown: '',
          rawNewMarkdown: rawBlk,
          status: decision,
          replies: []
        })
      } else {
        htmlBlocks.push(renderCleanBlockToHtml(classified))
      }
    })
  } else {
    // Comparação estruturada bloco-a-bloco e palavra-a-palavra entre Versão Publicada e Rascunho Proposto
    const arrayDiff = Diff.diffArrays(origBlocks, draftBlocks)
    let idx = 0

    while (idx < arrayDiff.length) {
      const part = arrayDiff[idx]
      const nextPart = arrayDiff[idx + 1]

      // Caso 1: Bloco(s) inalterado(s)
      if (!part.added && !part.removed) {
        part.value.forEach(rawBlk => {
          const classified = classifyMarkdownBlock(rawBlk)
          htmlBlocks.push(renderCleanBlockToHtml(classified))
        })
        idx++
        continue
      }

      // Caso 2: Bloco(s) removido(s) seguido(s) imediatamente por bloco(s) adicionado(s) -> Edição / Substituição
      if (part.removed && nextPart && nextPart.added) {
        const removedList = part.value || []
        const addedList = nextPart.value || []
        const maxLen = Math.max(removedList.length, addedList.length)

        for (let k = 0; k < maxLen; k++) {
          const oldRaw = removedList[k]
          const newRaw = addedList[k]

          if (oldRaw !== undefined && newRaw !== undefined) {
            const oldClassified = classifyMarkdownBlock(oldRaw)
            const newClassified = classifyMarkdownBlock(newRaw)

            // Se adicionou/trocou um diagrama (Draw.io SVG Base64 ou Mermaid)
            if (newClassified.kind === 'diagram' || newClassified.kind === 'mermaid') {
              const isSameDiagram =
                oldClassified.kind === newClassified.kind &&
                (newClassified.kind === 'diagram' ?
                  decodeDiagramBase64Svg(oldClassified.code) === decodeDiagramBase64Svg(newClassified.code) :
                  oldClassified.code.trim() === newClassified.code.trim())

              if (isSameDiagram) {
                htmlBlocks.push(renderCleanBlockToHtml(newClassified))
              } else {
                const sugId = `sug-${sugCounter++}`
                const decision = decisions[sugId] || 'pending'
                if (decision === 'accepted') {
                  htmlBlocks.push(renderCleanBlockToHtml(newClassified))
                } else if (decision === 'rejected') {
                  htmlBlocks.push(renderCleanBlockToHtml(oldClassified))
                } else {
                  const badge = oldClassified.kind === newClassified.kind ? 'Diagrama Atualizado' : 'Novo Diagrama Adicionado'
                  htmlBlocks.push(wrapDiagramInSuggestionBox(newClassified, sugId, badge, 'add'))
                }
                suggestions.push({
                  id: sugId,
                  type: 'suggestion',
                  isImage: false,
                  author: authorName || 'Autor',
                  role: 'Autor da alteração',
                  time: updatedAt,
                  actionLabel: oldClassified.kind === newClassified.kind ? 'Atualizou um diagrama' : 'Inseriu um diagrama',
                  oldText: oldClassified.kind === 'diagram' || oldClassified.kind === 'mermaid' ? '[Diagrama Anterior]' : stripMarkdownSymbols(oldRaw),
                  newText: newClassified.kind === 'mermaid' ? '[Diagrama Mermaid]' : '[Diagrama Técnico]',
                  rawOldMarkdown: oldRaw,
                  rawNewMarkdown: newRaw,
                  status: decision,
                  replies: []
                })
              }
            } else if (newClassified.kind === 'image') {
              const sugId = `sug-${sugCounter++}`
              const decision = decisions[sugId] || 'pending'
              if (decision === 'accepted') {
                htmlBlocks.push(renderCleanBlockToHtml(newClassified))
              } else if (decision === 'rejected') {
                htmlBlocks.push(renderCleanBlockToHtml(oldClassified))
              } else {
                htmlBlocks.push(wrapImageInSuggestionBox(newClassified, sugId, 'Nova Imagem Adicionada'))
              }
              suggestions.push({
                id: sugId,
                type: 'suggestion',
                isImage: true,
                hasBlobWarning: /^blob:/i.test(newClassified.src),
                author: authorName || 'Autor',
                role: 'Autor da alteração',
                time: updatedAt,
                actionLabel: oldClassified.kind === 'image' ? 'Substituiu imagem' : 'Inseriu uma nova imagem',
                oldText: stripMarkdownSymbols(oldRaw),
                newText: newClassified.alt || newClassified.src,
                rawOldMarkdown: oldRaw,
                rawNewMarkdown: newRaw,
                status: decision,
                replies: []
              })
            } else if (
              ['paragraph', 'heading', 'callout'].includes(oldClassified.kind) &&
              ['paragraph', 'heading', 'callout'].includes(newClassified.kind)
            ) {
              // Word-level diff dentro do parágrafo/título/callout (com coalescência de conectores curtos)
              const oldPlain = stripMarkdownSymbols(oldClassified.text || oldRaw)
              const newPlain = stripMarkdownSymbols(newClassified.text || newRaw)
              if (
                oldPlain === newPlain &&
                oldClassified.kind === newClassified.kind &&
                (oldClassified.variant || '') === (newClassified.variant || '')
              ) {
                htmlBlocks.push(renderCleanBlockToHtml(newClassified))
                continue
              }
              const wordDiff = coalesceWordDiffParts(Diff.diffWordsWithSpace(oldPlain, newPlain))

              let inlineHtml = ''
              let wIdx = 0
              while (wIdx < wordDiff.length) {
                const wPart = wordDiff[wIdx]
                const wNext = wordDiff[wIdx + 1]

                if (!wPart.added && !wPart.removed) {
                  inlineHtml += escapeHtml(wPart.value)
                  wIdx++
                } else if (wPart.removed && wNext && wNext.added) {
                  const sugId = `sug-${sugCounter++}`
                  const decision = decisions[sugId] || 'pending'
                  if (decision === 'accepted') {
                    inlineHtml += escapeHtml(wNext.value)
                  } else if (decision === 'rejected') {
                    inlineHtml += escapeHtml(wPart.value)
                  } else {
                    inlineHtml += `<del id="item-${sugId}" data-item-id="${sugId}" class="suggestion-del" title="Clique para ver a sugestão">${escapeHtml(wPart.value)}</del>`
                    inlineHtml += `<ins id="item-${sugId}-add" data-item-id="${sugId}" class="suggestion-add" title="Clique para ver a sugestão">${escapeHtml(wNext.value)}</ins>`
                  }
                  suggestions.push({
                    id: sugId,
                    type: 'suggestion',
                    isImage: false,
                    author: authorName || 'Autor',
                    role: 'Autor da alteração',
                    time: updatedAt,
                    actionLabel: 'Trocou trecho de texto',
                    oldText: wPart.value.trim(),
                    newText: wNext.value.trim(),
                    rawOldMarkdown: oldRaw,
                    rawNewMarkdown: newRaw,
                    wordOld: wPart.value,
                    wordNew: wNext.value,
                    status: decision,
                    replies: []
                  })
                  wIdx += 2
                } else if (wPart.added) {
                  const sugId = `sug-${sugCounter++}`
                  const decision = decisions[sugId] || 'pending'
                  if (decision === 'accepted') {
                    inlineHtml += escapeHtml(wPart.value)
                  } else if (decision === 'rejected') {
                    // Omite a adição recusada
                  } else {
                    inlineHtml += `<ins id="item-${sugId}" data-item-id="${sugId}" class="suggestion-add" title="Clique para ver a sugestão">${escapeHtml(wPart.value)}</ins>`
                  }
                  suggestions.push({
                    id: sugId,
                    type: 'suggestion',
                    isImage: false,
                    author: authorName || 'Autor',
                    role: 'Autor da alteração',
                    time: updatedAt,
                    actionLabel: 'Adicionou trecho de texto',
                    oldText: '',
                    newText: wPart.value.trim(),
                    rawOldMarkdown: oldRaw,
                    rawNewMarkdown: newRaw,
                    wordOld: '',
                    wordNew: wPart.value,
                    status: decision,
                    replies: []
                  })
                  wIdx++
                } else if (wPart.removed) {
                  const sugId = `sug-${sugCounter++}`
                  const decision = decisions[sugId] || 'pending'
                  if (decision === 'accepted') {
                    // Omite a exclusão aceita
                  } else if (decision === 'rejected') {
                    inlineHtml += escapeHtml(wPart.value)
                  } else {
                    inlineHtml += `<del id="item-${sugId}" data-item-id="${sugId}" class="suggestion-del" title="Clique para ver a sugestão">${escapeHtml(wPart.value)}</del>`
                  }
                  suggestions.push({
                    id: sugId,
                    type: 'suggestion',
                    isImage: false,
                    author: authorName || 'Autor',
                    role: 'Autor da alteração',
                    time: updatedAt,
                    actionLabel: 'Removeu trecho de texto',
                    oldText: wPart.value.trim(),
                    newText: '',
                    rawOldMarkdown: oldRaw,
                    rawNewMarkdown: newRaw,
                    wordOld: wPart.value,
                    wordNew: '',
                    status: decision,
                    replies: []
                  })
                  wIdx++
                }
              }

              htmlBlocks.push(renderCleanBlockToHtml(newClassified, inlineHtml))
            } else {
              // Bloco estrutural substituído (ex: tabela ou lista)
              const sugId = `sug-${sugCounter++}`
              const decision = decisions[sugId] || 'pending'
              if (decision === 'accepted') {
                htmlBlocks.push(renderCleanBlockToHtml(newClassified))
              } else if (decision === 'rejected') {
                htmlBlocks.push(renderCleanBlockToHtml(oldClassified))
              } else {
                htmlBlocks.push(`
                  <div id="item-${sugId}" data-item-id="${sugId}" class="suggestion-block-wrap">
                    <del class="suggestion-del-block">${renderCleanBlockToHtml(oldClassified)}</del>
                    <ins id="item-${sugId}-add" data-item-id="${sugId}" class="suggestion-add-block">${renderCleanBlockToHtml(newClassified)}</ins>
                  </div>
                `.trim())
              }
              suggestions.push({
                id: sugId,
                type: 'suggestion',
                isImage: false,
                author: authorName || 'Autor',
                role: 'Autor da alteração',
                time: updatedAt,
                actionLabel: 'Atualizou bloco estrutural',
                oldText: stripMarkdownSymbols(oldRaw),
                newText: stripMarkdownSymbols(newRaw),
                rawOldMarkdown: oldRaw,
                rawNewMarkdown: newRaw,
                status: decision,
                replies: []
              })
            }
          } else if (newRaw !== undefined) {
            // Bloco extra adicionado
            processAddedBlock(newRaw)
          } else if (oldRaw !== undefined) {
            // Bloco extra removido
            processRemovedBlock(oldRaw)
          }
        }
        idx += 2
        continue
      }

      // Caso 3: Apenas bloco(s) adicionado(s)
      if (part.added) {
        ;(part.value || []).forEach(processAddedBlock)
        idx++
        continue
      }

      // Caso 4: Apenas bloco(s) removido(s)
      if (part.removed) {
        ;(part.value || []).forEach(processRemovedBlock)
        idx++
        continue
      }

      idx++
    }
  }

  function processAddedBlock (newRaw) {
    const classified = classifyMarkdownBlock(newRaw)
    const sugId = `sug-${sugCounter++}`
    const decision = decisions[sugId] || 'pending'

    if (decision === 'accepted') {
      htmlBlocks.push(renderCleanBlockToHtml(classified))
    } else if (decision === 'rejected') {
      // Omite do HTML da folha
    } else {
      if (classified.kind === 'image') {
        htmlBlocks.push(wrapImageInSuggestionBox(classified, sugId, 'Nova Imagem Adicionada'))
      } else if (classified.kind === 'diagram' || classified.kind === 'mermaid') {
        htmlBlocks.push(wrapDiagramInSuggestionBox(classified, sugId, 'Novo Diagrama Adicionado', 'add'))
      } else if (['paragraph', 'heading', 'callout'].includes(classified.kind)) {
        const inner = `<ins id="item-${sugId}" data-item-id="${sugId}" class="suggestion-add" title="Clique para ver a sugestão">${renderInlineMarkdownToHtml(classified.text || newRaw)}</ins>`
        htmlBlocks.push(renderCleanBlockToHtml(classified, inner))
      } else {
        htmlBlocks.push(`<ins id="item-${sugId}" data-item-id="${sugId}" class="suggestion-add-block">${renderCleanBlockToHtml(classified)}</ins>`)
      }
    }

    if (classified.kind === 'image') {
      suggestions.push({
        id: sugId,
        type: 'suggestion',
        isImage: true,
        hasBlobWarning: /^blob:/i.test(classified.src),
        author: authorName || 'Autor',
        role: 'Autor da alteração',
        time: updatedAt,
        actionLabel: 'Inseriu uma nova fotografia',
        oldText: '',
        newText: classified.alt || classified.src,
        rawOldMarkdown: '',
        rawNewMarkdown: newRaw,
        status: decision,
        replies: []
      })
    } else if (classified.kind === 'diagram' || classified.kind === 'mermaid') {
      suggestions.push({
        id: sugId,
        type: 'suggestion',
        isImage: false,
        author: authorName || 'Autor',
        role: 'Autor da alteração',
        time: updatedAt,
        actionLabel: 'Inseriu um diagrama',
        oldText: '',
        newText: classified.kind === 'mermaid' ? '[Diagrama Mermaid]' : '[Diagrama Técnico]',
        rawOldMarkdown: '',
        rawNewMarkdown: newRaw,
        status: decision,
        replies: []
      })
    } else if (['paragraph', 'heading', 'callout'].includes(classified.kind)) {
      suggestions.push({
        id: sugId,
        type: 'suggestion',
        isImage: false,
        author: authorName || 'Autor',
        role: 'Autor da alteração',
        time: updatedAt,
        actionLabel: 'Adicionou novo trecho',
        oldText: '',
        newText: stripMarkdownSymbols(newRaw),
        rawOldMarkdown: '',
        rawNewMarkdown: newRaw,
        status: decision,
        replies: []
      })
    } else {
      suggestions.push({
        id: sugId,
        type: 'suggestion',
        isImage: false,
        author: authorName || 'Autor',
        role: 'Autor da alteração',
        time: updatedAt,
        actionLabel: 'Adicionou bloco estrutural',
        oldText: '',
        newText: stripMarkdownSymbols(newRaw),
        rawOldMarkdown: '',
        rawNewMarkdown: newRaw,
        status: decision,
        replies: []
      })
    }
  }

  function processRemovedBlock (oldRaw) {
    const classified = classifyMarkdownBlock(oldRaw)
    const sugId = `sug-${sugCounter++}`
    const decision = decisions[sugId] || 'pending'

    if (decision === 'accepted') {
      // Omite da visualização
    } else if (decision === 'rejected') {
      htmlBlocks.push(renderCleanBlockToHtml(classified))
    } else {
      if (classified.kind === 'diagram' || classified.kind === 'mermaid') {
        htmlBlocks.push(wrapDiagramInSuggestionBox(classified, sugId, 'Diagrama Removido', 'del'))
      } else if (['paragraph', 'heading', 'callout'].includes(classified.kind)) {
        const inner = `<del id="item-${sugId}" data-item-id="${sugId}" class="suggestion-del" title="Clique para ver a sugestão">${renderInlineMarkdownToHtml(classified.text || oldRaw)}</del>`
        htmlBlocks.push(renderCleanBlockToHtml(classified, inner))
      } else {
        htmlBlocks.push(`<del id="item-${sugId}" data-item-id="${sugId}" class="suggestion-del-block">${renderCleanBlockToHtml(classified)}</del>`)
      }
    }

    if (classified.kind === 'diagram' || classified.kind === 'mermaid') {
      suggestions.push({
        id: sugId,
        type: 'suggestion',
        isImage: false,
        author: authorName || 'Autor',
        role: 'Autor da alteração',
        time: updatedAt,
        actionLabel: 'Removeu um diagrama',
        oldText: classified.kind === 'mermaid' ? '[Diagrama Mermaid]' : '[Diagrama Técnico]',
        newText: '',
        rawOldMarkdown: oldRaw,
        rawNewMarkdown: '',
        status: decision,
        replies: []
      })
    } else if (['paragraph', 'heading', 'callout'].includes(classified.kind)) {
      suggestions.push({
        id: sugId,
        type: 'suggestion',
        isImage: false,
        author: authorName || 'Autor',
        role: 'Autor da alteração',
        time: updatedAt,
        actionLabel: 'Removeu trecho do documento',
        oldText: stripMarkdownSymbols(oldRaw),
        newText: '',
        rawOldMarkdown: oldRaw,
        rawNewMarkdown: '',
        status: decision,
        replies: []
      })
    } else {
      suggestions.push({
        id: sugId,
        type: 'suggestion',
        isImage: false,
        author: authorName || 'Autor',
        role: 'Autor da alteração',
        time: updatedAt,
        actionLabel: 'Removeu bloco estrutural',
        oldText: stripMarkdownSymbols(oldRaw),
        newText: '',
        rawOldMarkdown: oldRaw,
        rawNewMarkdown: '',
        status: decision,
        replies: []
      })
    }
  }

  let documentHtml = htmlBlocks.join('\n')

  // Aplicar marcações amarelas (<mark class="comment-highlight">) e sugestões de redação dos comentários
  const normalizedComments = (Array.isArray(comments) ? comments : []).map(c => {
    const selector = decodeTextQuoteSelector(c)
    return {
      ...c,
      cardId: `com-${c.id}`,
      type: selector.suggestedReplacement ? 'redaction' : 'comment',
      quote: selector.exact,
      prefix: selector.prefix,
      suffix: selector.suffix,
      suggestedReplacement: selector.suggestedReplacement,
      status: c.resolved ? 'resolved' : (selector.status || 'pending'),
      replies: selector.replies || []
    }
  })

  normalizedComments.forEach(c => {
    if (c.resolved || !c.quote) return
    const escapedQuote = escapeHtml(c.quote)
    if (!escapedQuote) return

    if (c.suggestedReplacement) {
      const escapedRep = escapeHtml(c.suggestedReplacement)
      const replacementMarkup = `<del id="item-${c.cardId}" data-item-id="${c.cardId}" class="suggestion-del" title="Sugestão de redação">${escapedQuote}</del><ins id="item-${c.cardId}-add" data-item-id="${c.cardId}" class="suggestion-add" title="Sugestão de redação">${escapedRep}</ins>`
      documentHtml = replaceTextOutsideHtmlTags(documentHtml, escapedQuote, replacementMarkup)
    } else {
      const highlightMarkup = `<mark id="item-${c.cardId}" data-item-id="${c.cardId}" class="comment-highlight" title="Clique para ver o comentário">${escapedQuote}</mark>`
      documentHtml = replaceTextOutsideHtmlTags(documentHtml, escapedQuote, highlightMarkup)
    }
  })

  return {
    html: documentHtml,
    suggestions,
    comments: normalizedComments
  }
}

/**
 * Agrupa partes adjacentes do diff de palavras quando separadas apenas por espaços ou conectores curtos (ex: " e ", " de "),
 * produzindo sugestões legíveis estilo Google Docs.
 */
function coalesceWordDiffParts (rawParts = []) {
  const parts = Array.isArray(rawParts) ? rawParts.map(p => ({ ...p })) : []
  // Passo 1: absorver conectores curtos inalterados (<= 4 chars) que estejam cercados por alterações
  const absorbed = []
  let i = 0
  while (i < parts.length) {
    const curr = parts[i]
    const prevChanged = absorbed.length > 0 && (absorbed[absorbed.length - 1].added || absorbed[absorbed.length - 1].removed)
    const nextChanged = i + 1 < parts.length && (parts[i + 1].added || parts[i + 1].removed)

    if (!curr.added && !curr.removed && prevChanged && nextChanged && curr.value.trim().length <= 3 && curr.value.length <= 5) {
      absorbed.push({ value: curr.value, removed: true })
      absorbed.push({ value: curr.value, added: true })
    } else {
      absorbed.push(curr)
    }
    i++
  }

  // Passo 2: consolidar blocos contínuos de alterações em pares únicos [removed, added]
  const result = []
  let k = 0
  while (k < absorbed.length) {
    if (!absorbed[k].added && !absorbed[k].removed) {
      result.push(absorbed[k])
      k++
      continue
    }
    let delAcc = ''
    let addAcc = ''
    while (k < absorbed.length && (absorbed[k].added || absorbed[k].removed)) {
      if (absorbed[k].removed) delAcc += absorbed[k].value
      if (absorbed[k].added) addAcc += absorbed[k].value
      k++
    }
    if (delAcc) result.push({ value: delAcc, removed: true })
    if (addAcc) result.push({ value: addAcc, added: true })
  }
  return result
}

/**
 * Substitui a primeira ocorrência de `targetText` que esteja fora de tags HTML `<...>`.
 */
function replaceTextOutsideHtmlTags (html = '', targetText = '', replacementHtml = '') {
  if (!html || !targetText) return html
  const parts = html.split(/(<[^>]+>)/g)
  let replaced = false
  let svgDepth = 0
  let styleDepth = 0
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i]
    if (token.startsWith('<')) {
      const lower = token.toLowerCase()
      if (/^<svg[\s>]/.test(lower) && !/\/>$/.test(lower)) svgDepth++
      else if (/^<\/svg>/.test(lower)) svgDepth = Math.max(0, svgDepth - 1)
      else if (/^<style[\s>]/.test(lower) && !/\/>$/.test(lower)) styleDepth++
      else if (/^<\/style>/.test(lower)) styleDepth = Math.max(0, styleDepth - 1)
      continue
    }
    if (svgDepth > 0 || styleDepth > 0) continue
    const pos = token.indexOf(targetText)
    if (pos !== -1) {
      parts[i] = token.slice(0, pos) + replacementHtml + token.slice(pos + targetText.length)
      replaced = true
      break
    }
  }
  return replaced ? parts.join('') : html
}

/**
 * Consolida a decisão de aceitar ou recusar uma sugestão diretamente no Markdown do rascunho.
 */
function applySuggestionDecisionToMarkdown ({
  draftContent = '',
  suggestion = {},
  decision = 'accept'
} = {}) {
  let content = String(draftContent || '')
  if (!suggestion) return content

  // Sugestão de Redação criada pelo Revisor (TextQuoteSelector com suggestedReplacement)
  if (suggestion.suggestedReplacement && suggestion.quote) {
    if (decision === 'accept') {
      return content.replace(suggestion.quote, suggestion.suggestedReplacement)
    }
    if (decision === 'restore' || decision === 'pending') {
      return content.replace(suggestion.suggestedReplacement, suggestion.quote)
    }
    return content
  }

  // Sugestão de Diff do Autor:
  // No rascunho atual, `newText` / `rawNewMarkdown` já está no `draftContent`.
  // Portanto, 'accept' mantém o novo texto; 'reject' reverte para o texto original (`wordOld` ou `rawOldMarkdown`).
  if (decision === 'reject') {
    if (typeof suggestion.wordNew === 'string' && suggestion.wordNew.length > 0 && typeof suggestion.wordOld === 'string' && suggestion.rawNewMarkdown) {
      const revertedBlock = suggestion.rawNewMarkdown.replace(suggestion.wordNew, suggestion.wordOld)
      return content.replace(suggestion.rawNewMarkdown, revertedBlock)
    }
    if (suggestion.rawNewMarkdown && suggestion.rawOldMarkdown) {
      return content.replace(suggestion.rawNewMarkdown, suggestion.rawOldMarkdown)
    }
    if (suggestion.rawNewMarkdown && !suggestion.rawOldMarkdown) {
      return content.replace(suggestion.rawNewMarkdown, '').replace(/\n{3,}/g, '\n\n').trim()
    }
    if (!suggestion.rawNewMarkdown && suggestion.rawOldMarkdown) {
      return `${content}\n\n${suggestion.rawOldMarkdown}`.trim()
    }
  }

  if (decision === 'restore' || decision === 'pending') {
    if (typeof suggestion.wordNew === 'string' && typeof suggestion.wordOld === 'string' && suggestion.rawNewMarkdown) {
      const revertedBlock = suggestion.rawNewMarkdown.replace(suggestion.wordNew, suggestion.wordOld)
      if (content.includes(revertedBlock)) {
        return content.replace(revertedBlock, suggestion.rawNewMarkdown)
      }
    }
    if (suggestion.rawNewMarkdown && suggestion.rawOldMarkdown) {
      if (content.includes(suggestion.rawOldMarkdown)) {
        return content.replace(suggestion.rawOldMarkdown, suggestion.rawNewMarkdown)
      }
    }
    if (suggestion.rawNewMarkdown && !suggestion.rawOldMarkdown) {
      if (!content.includes(suggestion.rawNewMarkdown)) {
        return `${content}\n\n${suggestion.rawNewMarkdown}`.trim()
      }
    }
    if (!suggestion.rawNewMarkdown && suggestion.rawOldMarkdown) {
      if (content.includes(suggestion.rawOldMarkdown)) {
        return content.replace(suggestion.rawOldMarkdown, '').replace(/\n{3,}/g, '\n\n').trim()
      }
    }
  }

  return content
}

function parseTimestampMs (val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (!val) return 0
  const ms = Date.parse(String(val))
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Ordena os itens do painel de revisão colocando os pendentes primeiro e os
 * já revisados (aceitos/recusados/resolvidos) no fim da lista, do mais novo
 * para o mais antigo em cada grupo.
 */
function sortReviewItems (items = [], { reviewedTimestamps = {}, fallbackCreatedAt = null } = {}) {
  if (!Array.isArray(items) || items.length === 0) return []
  const tsMap = reviewedTimestamps && typeof reviewedTimestamps === 'object' ? reviewedTimestamps : {}

  return items
    .map((item, origIdx) => ({ item, origIdx }))
    .sort((aWrap, bWrap) => {
      const a = aWrap.item || {}
      const b = bWrap.item || {}
      const aResolved = Boolean(a.status && a.status !== 'pending')
      const bResolved = Boolean(b.status && b.status !== 'pending')

      if (aResolved !== bResolved) {
        return aResolved ? 1 : -1
      }

      const aTime = aResolved ?
        parseTimestampMs(tsMap[a.id] || a.reviewedAt || a.updatedAt || a.createdAt || fallbackCreatedAt) :
        parseTimestampMs(a.createdAt || a.updatedAt || fallbackCreatedAt)
      const bTime = bResolved ?
        parseTimestampMs(tsMap[b.id] || b.reviewedAt || b.updatedAt || b.createdAt || fallbackCreatedAt) :
        parseTimestampMs(b.createdAt || b.updatedAt || fallbackCreatedAt)

      if (aTime !== bTime) {
        return bTime - aTime
      }

      const aComId = Number(a.rawCommentId) || 0
      const bComId = Number(b.rawCommentId) || 0
      if (aComId > 0 && bComId > 0 && aComId !== bComId) {
        return bComId - aComId
      }

      return aWrap.origIdx - bWrap.origIdx
    })
    .map(w => w.item)
}

module.exports = {
  generateDiffPatch,
  renderDiffHtml,
  groupCommentsByLine,
  getAvailableReviewActions,
  canEditDraftContentInReview,
  canDecideReviewSuggestion,
  extractLineFromDiffElement,
  decodeDiagramBase64Svg,
  stripMarkdownSymbols,
  renderInlineMarkdownToHtml,
  renderCleanBlockToHtml,
  encodeTextQuoteSelector,
  decodeTextQuoteSelector,
  createTextQuoteSelectorFromText,
  buildVisualDiffDocument,
  applySuggestionDecisionToMarkdown,
  sortReviewItems
}

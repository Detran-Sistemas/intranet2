import { parseMarkdown, serializeBlocks, slugify, inlineHtmlToMarkdown } from './markdown-blocks'

export const SLASH_MENU_ITEMS = [
  {
    type: 'paragraph',
    group: 'Texto Básico',
    shortcut: 'P',
    icon: 'mdi-format-paragraph',
    avatarColor: '#f1f5f9',
    iconColor: '#475569',
    title: 'Texto Simples',
    subtitle: 'Parágrafo padrão'
  },
  {
    type: 'heading',
    group: 'Texto Básico',
    shortcut: '##',
    icon: 'mdi-format-header-2',
    avatarColor: '#f1f5f9',
    iconColor: '#1e293b',
    title: 'Título de Seção',
    subtitle: 'Cabeçalho H2 com índice'
  },
  {
    type: 'heading-3',
    group: 'Texto Básico',
    shortcut: '###',
    icon: 'mdi-format-header-3',
    avatarColor: '#f1f5f9',
    iconColor: '#334155',
    title: 'Subtítulo',
    subtitle: 'Cabeçalho H3 de subseção'
  },
  {
    type: 'callout-info',
    group: 'Destaques',
    shortcut: '> i',
    icon: 'mdi-information-outline',
    avatarColor: '#eff6ff',
    iconColor: '#2563eb',
    title: 'Bloco Informativo',
    subtitle: 'Destaque azul para notas'
  },
  {
    type: 'callout-success',
    group: 'Destaques',
    shortcut: '> ✓',
    icon: 'mdi-check-circle-outline',
    avatarColor: '#f0fdf4',
    iconColor: '#1b6535',
    title: 'Bloco Institucional',
    subtitle: 'Aviso verde Detran-MG'
  },
  {
    type: 'callout-warning',
    group: 'Destaques',
    shortcut: '> !',
    icon: 'mdi-alert-outline',
    avatarColor: '#fffbeb',
    iconColor: '#d97706',
    title: 'Aviso de Atenção',
    subtitle: 'Alerta âmbar para prazos e regras'
  },
  {
    type: 'table',
    group: 'Mídia & Estrutura',
    shortcut: '| |',
    icon: 'mdi-table',
    avatarColor: '#f0fdf4',
    iconColor: '#15803d',
    title: 'Tabela de Dados',
    subtitle: 'Grade editável inline'
  },
  {
    type: 'code',
    group: 'Mídia & Estrutura',
    shortcut: '```',
    icon: 'mdi-code-tags',
    avatarColor: '#f1f5f9',
    iconColor: '#0f172a',
    title: 'Bloco de Código',
    subtitle: 'Trecho técnico ou comando'
  },
  {
    type: 'image',
    group: 'Mídia & Estrutura',
    shortcut: 'IMG',
    icon: 'mdi-image-outline',
    avatarColor: '#fef3c7',
    iconColor: '#d97706',
    title: 'Imagem / Mídia',
    subtitle: 'Upload ou galeria de assets'
  },
  {
    type: 'links',
    group: 'Mídia & Estrutura',
    shortcut: '[]',
    icon: 'mdi-view-grid-outline',
    avatarColor: '#e0f2fe',
    iconColor: '#0284c7',
    title: 'Cards de Links',
    subtitle: 'Grade de acessos rápidos'
  },
  {
    type: 'hr',
    group: 'Mídia & Estrutura',
    shortcut: '---',
    icon: 'mdi-minus',
    avatarColor: '#f1f5f9',
    iconColor: '#64748b',
    title: 'Linha Divisória',
    subtitle: 'Separador horizontal de seções'
  }
]

/**
 * Agrupa os itens do menu de comandos "/" preservando o índice linear para navegação via teclado.
 */
export function groupSlashMenuItems (items = SLASH_MENU_ITEMS) {
  if (!Array.isArray(items) || items.length === 0) return []
  const groupMap = new Map()
  items.forEach((item, flatIndex) => {
    const label = (item && item.group) || 'Blocos'
    if (!groupMap.has(label)) {
      groupMap.set(label, [])
    }
    groupMap.get(label).push({
      ...item,
      flatIndex
    })
  })
  return Array.from(groupMap.entries()).map(([label, groupItems]) => ({
    label,
    items: groupItems
  }))
}

function normalizeSearchToken (str = '') {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Extrai a query ativa após "/" no final do texto (ex: "/" -> "", "texto /tab" -> "tab").
 * Retorna null quando não há comando "/" ativo (ex: URLs como "https://..." ou após espaço).
 */
export function extractActiveSlashQuery (text = '') {
  const raw = String(text || '')
  if (!raw || /\s$/.test(raw)) return null
  const match = raw.match(/(?:^|\s)\/([^\s/]*)$/)
  return match ? match[1] : null
}

/**
 * Filtra os itens do menu "/" sem sensibilidade a maiúsculas ou acentos.
 */
export function filterSlashMenuItems (items = SLASH_MENU_ITEMS, query = '') {
  if (!Array.isArray(items)) return []
  const q = normalizeSearchToken(query)
  if (!q) return items
  return items.filter(item => {
    if (!item) return false
    const haystack = normalizeSearchToken([
      item.title,
      item.subtitle,
      item.group,
      item.type,
      item.shortcut
    ].join(' '))
    return haystack.includes(q)
  })
}

/**
 * Decide se o evento de digitação atual deve abrir o menu de comandos "/".
 * Suporta "/" no final do bloco, em linha vazia ou digitado diretamente no cursor (mesmo antes de texto existente),
 * ignorando barras em URLs como "https://".
 */
export function shouldTriggerSlashFromInput ({ mdText = '', inputData = '', textBeforeCaret = '' } = {}) {
  if (inputData === '/') {
    if (!textBeforeCaret) return true
    return /(?:^|\s)\/$/.test(String(textBeforeCaret))
  }
  return extractActiveSlashQuery(mdText) === ''
}

export const DEFAULT_LINK_ITEMS = [
  { title: 'Procedimentos operacionais', description: 'Manuais institucionais', href: '/procedimentos' },
  { title: 'Manuais e guias', description: 'Orientações aos servidores', href: '/manuais' },
  { title: 'Normativos internos', description: 'Portarias e resoluções', href: '/normativos' }
]

/**
 * Inicializa a lista de blocos a partir de um documento Markdown bruto.
 */
export function initEditorBlocks (md = '', idPrefix = 'blk') {
  const parsed = parseMarkdown(md || '')
  if (parsed.length === 0) {
    parsed.push({ type: 'paragraph', text: '' })
  }
  return parsed.map((b, idx) => ({
    ...b,
    id: `${idPrefix}-${idx}`
  }))
}

/**
 * Atualiza um bloco em uma posição específica preservando seu ID.
 */
export function updateBlockAt (blocks = [], index, updatedBlock) {
  if (index < 0 || index >= blocks.length || !updatedBlock) {
    return [...blocks]
  }
  const next = [...blocks]
  const currentId = next[index] && next[index].id ? next[index].id : `blk-${index}`
  next[index] = {
    ...updatedBlock,
    id: currentId
  }
  return next
}

/**
 * Insere um novo parágrafo vazio logo abaixo do índice informado.
 */
export function insertBlockBelow (blocks = [], index, newId = 'blk-new') {
  const next = [...blocks]
  const targetIndex = Math.max(0, Math.min(index + 1, next.length))
  const newBlock = {
    id: newId,
    type: 'paragraph',
    text: ''
  }
  next.splice(targetIndex, 0, newBlock)
  return {
    blocks: next,
    insertedIndex: targetIndex,
    insertedBlock: newBlock
  }
}

/**
 * Remove um bloco se houver mais de um bloco no documento.
 */
export function deleteBlockAt (blocks = [], index) {
  if (!Array.isArray(blocks) || blocks.length <= 1 || index < 0 || index >= blocks.length) {
    return {
      blocks: [...blocks],
      deleted: false,
      focusIndex: Math.max(0, index)
    }
  }
  const next = [...blocks]
  next.splice(index, 1)
  return {
    blocks: next,
    deleted: true,
    focusIndex: Math.max(0, index - 1)
  }
}

/**
 * Remove um bloco pelo índice ou limpa o bloco restante para parágrafo vazio quando for o único.
 */
export function clearOrDeleteBlockAt (blocks = [], index) {
  if (!Array.isArray(blocks) || blocks.length === 0 || index < 0 || index >= blocks.length) {
    return {
      blocks: Array.isArray(blocks) ? [...blocks] : [],
      deleted: false,
      focusIndex: 0
    }
  }
  if (blocks.length === 1) {
    const current = blocks[0]
    const isAlreadyEmptyParagraph = current.type === 'paragraph' && !String(current.text || '').trim()
    if (isAlreadyEmptyParagraph) {
      return {
        blocks: [...blocks],
        deleted: false,
        focusIndex: 0
      }
    }
    return {
      blocks: [{
        id: current.id || 'blk-0',
        type: 'paragraph',
        text: ''
      }],
      deleted: true,
      focusIndex: 0
    }
  }
  const next = [...blocks]
  next.splice(index, 1)
  return {
    blocks: next,
    deleted: true,
    focusIndex: Math.min(Math.max(0, index - 1), next.length - 1)
  }
}

/**
 * Reordena um bloco movendo-o da posição fromIndex para toIndex.
 */
export function reorderBlocks (blocks = [], fromIndex, toIndex) {
  if (!Array.isArray(blocks) || blocks.length <= 1) {
    return {
      blocks: Array.isArray(blocks) ? [...blocks] : [],
      moved: false
    }
  }
  const from = Number(fromIndex)
  const to = Number(toIndex)
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    from >= blocks.length ||
    to < 0 ||
    to >= blocks.length ||
    from === to
  ) {
    return {
      blocks: [...blocks],
      moved: false
    }
  }
  const next = [...blocks]
  const [movedItem] = next.splice(from, 1)
  next.splice(to, 0, movedItem)
  return {
    blocks: next,
    moved: true
  }
}

/**
 * Transforma um bloco de acordo com o comando selecionado no menu "/" ou barra flutuante.
 */
export function applySlashCommandToBlock (block = {}, type = 'paragraph') {
  const cleanText = String(block.text || '')
    .replace(/(?:^|\s)\/[^\s/]*$/, '')
    .replace(/\/$/, '')
    .trim()

  if (type === 'callout-info') {
    return {
      ...block,
      type: 'callout',
      variant: 'info',
      text: cleanText
    }
  }

  if (type === 'callout-success') {
    return {
      ...block,
      type: 'callout',
      variant: 'success',
      text: cleanText
    }
  }

  if (type === 'callout-warning') {
    return {
      ...block,
      type: 'callout',
      variant: 'warning',
      text: cleanText
    }
  }

  if (type === 'heading') {
    return {
      ...block,
      type: 'heading',
      level: 2,
      anchor: slugify(cleanText),
      text: cleanText
    }
  }

  if (type === 'heading-3') {
    return {
      ...block,
      type: 'heading',
      level: 3,
      anchor: slugify(cleanText),
      text: cleanText
    }
  }

  if (type === 'table') {
    return {
      ...block,
      type: 'raw',
      text: '| Coluna 1 | Coluna 2 | Coluna 3 |\n| --- | --- | --- |\n| Dado 1 | Dado 2 | Dado 3 |'
    }
  }

  if (type === 'code') {
    return {
      ...block,
      type: 'raw',
      text: `\`\`\`texto\n${cleanText}\n\`\`\``
    }
  }

  if (type === 'hr') {
    return {
      ...block,
      type: 'raw',
      text: '---'
    }
  }

  if (type === 'links') {
    return {
      ...block,
      type: 'links',
      items: DEFAULT_LINK_ITEMS.map(item => ({ ...item }))
    }
  }

  return {
    ...block,
    type: 'paragraph',
    text: cleanText
  }
}

/**
 * Cria e insere um bloco de imagem após o índice indicado.
 */
export function insertMediaBlock (blocks = [], insertAfterIndex, { src, alt }, newId = 'blk-img') {
  const next = [...blocks]
  const normalizedAlt = String(alt || '').trim() || 'Imagem'
  const imageBlock = {
    id: newId,
    type: 'image',
    src: String(src || '').trim(),
    alt: normalizedAlt,
    title: normalizedAlt
  }
  const pos = (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0) ?
    Math.min(insertAfterIndex + 1, next.length) :
    next.length
  next.splice(pos, 0, imageBlock)
  return {
    blocks: next,
    insertedIndex: pos,
    imageBlock
  }
}

/**
 * Atualiza um campo ('title', 'description' ou 'href') de um card em um bloco de links.
 */
export function updateLinkCardItem (block = {}, itemIndex, field, value) {
  const items = Array.isArray(block.items) ? block.items.map(it => ({ ...it })) : []
  if (itemIndex >= 0 && itemIndex < items.length && ['title', 'description', 'href'].includes(field)) {
    items[itemIndex][field] = String(value || '').trim()
  }
  return {
    ...block,
    items
  }
}

/**
 * Gera a lista reativa de itens do Índice (ToC) a partir dos cabeçalhos H2+ dos blocos.
 */
export function buildReactiveToc (blocks = []) {
  return blocks
    .filter(b => b && b.type === 'heading' && String(b.text || '').trim())
    .map(h => {
      const cleanTitle = String(h.text).trim()
      const slug = h.anchor || slugify(cleanTitle)
      return {
        title: cleanTitle,
        anchor: `#${slug}`,
        level: h.level || 2,
        children: []
      }
    })
}

/**
 * Compila o payload de alteração do editor transparente (markdown + blocos + toc).
 */
export function buildEditorChangePayload (blocks = []) {
  return {
    markdown: serializeBlocks(blocks),
    blocks,
    toc: buildReactiveToc(blocks)
  }
}

/**
 * Verifica se o texto digitado termina com o gatilho "/" do menu de comandos.
 */
export function detectSlashTrigger (text = '') {
  return String(text || '').trim().endsWith('/')
}

/**
 * Obtém o retângulo âncora exato do cursor (caret) dentro de um elemento editável
 * para posicionar o menu "/" na linha ativa, com fallback para o retângulo do bloco.
 */
export function getCaretTriggerRect (el, win = (typeof window !== 'undefined' ? window : null)) {
  const fallback = el && typeof el.getBoundingClientRect === 'function' ?
    el.getBoundingClientRect() :
    { top: 0, left: 0, bottom: 0, width: 0, height: 0 }

  if (!win || typeof win.getSelection !== 'function') {
    return fallback
  }

  try {
    const sel = win.getSelection()
    if (!sel || sel.rangeCount < 1) {
      return fallback
    }
    const range = sel.getRangeAt(0)
    if (!range) {
      return fallback
    }
    if (el && typeof el.contains === 'function' && range.startContainer && !el.contains(range.startContainer)) {
      return fallback
    }

    const hasPositionedRect = r => Boolean(r && (r.top > 0 || r.left > 0))
    const clientRects = typeof range.getClientRects === 'function' ? range.getClientRects() : null
    const rawRect = (clientRects && clientRects.length > 0 && clientRects[0]) ||
      (typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null)

    if (hasPositionedRect(rawRect)) {
      return {
        top: rawRect.top,
        left: rawRect.left,
        bottom: rawRect.bottom || (rawRect.top + (rawRect.height || 20)),
        width: rawRect.width || 0,
        height: rawRect.height || 20
      }
    }

    if (range.startContainer && range.startContainer.nodeType === 3 && range.startOffset > 0 && typeof range.cloneRange === 'function') {
      const charRange = range.cloneRange()
      charRange.setStart(range.startContainer, range.startOffset - 1)
      charRange.setEnd(range.startContainer, range.startOffset)
      const charRect = charRange.getBoundingClientRect()
      if (hasPositionedRect(charRect)) {
        return {
          top: charRect.top,
          left: charRect.right || charRect.left,
          bottom: charRect.bottom || (charRect.top + (charRect.height || 20)),
          width: charRect.width || 0,
          height: charRect.height || 20
        }
      }
    }
  } catch (err) {}

  return fallback
}

/**
 * Calcula posição segura na tela para o menu "/" evitando corte nas bordas da janela
 * e invertendo para cima do cursor quando próximo ao rodapé para não cobrir a linha digitada.
 */
export function computeSlashMenuPosition (position = { top: 0, left: 0 }, viewport = { width: 1024, height: 768 }) {
  const vpHeight = viewport.height || 768
  const vpWidth = viewport.width || 1024
  const caretTop = position.top || 0
  const maxTop = Math.max(16, vpHeight - 320)
  const maxLeft = Math.max(16, vpWidth - 300)
  const belowTop = caretTop + 28
  const shouldFlipAbove = vpHeight >= 400 && belowTop > maxTop && caretTop >= 320
  const finalTop = shouldFlipAbove ? Math.max(16, caretTop - 310) : Math.min(belowTop, maxTop)

  return {
    position: 'fixed',
    top: `${finalTop}px`,
    left: `${Math.min(position.left || 0, maxLeft)}px`,
    zIndex: 9999
  }
}

/**
 * Calcula posição segura na tela para a barra flutuante de formatação,
 * invertendo para baixo da seleção quando próximo ao topo.
 */
export function computeFloatingToolbarPosition (position = { top: 0, left: 0 }, viewport = { width: 1024, height: 768 }) {
  const vpWidth = (typeof window !== 'undefined' ? window.innerWidth : viewport.width) || 1024
  const vpHeight = (typeof window !== 'undefined' ? window.innerHeight : viewport.height) || 768
  const maxLeft = Math.max(16, vpWidth - 340)
  const rawTop = position.top || 0
  const shouldFlipBelow = rawTop < 58 && typeof position.bottom === 'number'
  const finalTop = shouldFlipBelow ?
    Math.min(position.bottom + 8, Math.max(12, vpHeight - 56)) :
    Math.max(rawTop - 46, 12)

  return {
    position: 'fixed',
    top: `${finalTop}px`,
    left: `${Math.min(Math.max(position.left || 0, 16), maxLeft)}px`,
    zIndex: 9999
  }
}

/**
 * Valida se o modal de mídia possui dados suficientes para inserção.
 */
export function canInsertMedia ({ activeTab = 0, imageUrl = '', imageFile = null } = {}) {
  if (activeTab === 0) {
    return Boolean(String(imageUrl || '').trim())
  }
  if (activeTab === 1) {
    return Boolean(imageFile)
  }
  return false
}

/**
 * Resolve a URL final da imagem (por URL direta ou upload via FormData para /upload).
 */
export async function resolveMediaUpload ({
  activeTab = 0,
  imageUrl = '',
  imageFile = null,
  imageAlt = '',
  fetchImpl = null,
  createObjectURL = null
} = {}) {
  let finalSrc = String(imageUrl || '').trim()
  const fallbackUrlFn = typeof createObjectURL === 'function' ?
    createObjectURL :
    () => '/_assets/img/uploaded-fallback.png'

  if (activeTab === 1 && imageFile) {
    const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch : null)
    if (fetcher) {
      try {
        const formData = typeof FormData !== 'undefined' ? new FormData() : { append () {} }
        if (typeof formData.append === 'function') {
          formData.append('mediaAsset', imageFile)
          formData.append('folder', 'images')
        }
        const res = await fetcher('/upload', {
          method: 'POST',
          body: formData
        })
        if (res && res.ok) {
          const data = await res.json()
          finalSrc = (data && (data.path || data.url)) || fallbackUrlFn(imageFile)
        } else {
          finalSrc = fallbackUrlFn(imageFile)
        }
      } catch (err) {
        finalSrc = fallbackUrlFn(imageFile)
      }
    } else {
      finalSrc = fallbackUrlFn(imageFile)
    }
  }

  return {
    src: finalSrc,
    alt: String(imageAlt || '').trim() || 'Imagem'
  }
}

/**
 * Normaliza o comentário de envio para validação.
 */
export function buildValidationPayload (comment = '') {
  const trimmed = String(comment || '').trim()
  return {
    comment: trimmed || 'Atualização editorial via Edição Transparente'
  }
}

/**
 * Filtra as tarefas de notificação conforme a aba ativa (0: Todas, 1: Validações, 2: Publicações).
 */
export function filterNotificationTasks (tasks = [], notifTab = 0) {
  if (!Array.isArray(tasks)) return []
  if (notifTab === 2) {
    return tasks.filter(t => t && (t.state === 'published' || t.type === 'news'))
  }
  return tasks
}

/**
 * Carrega o conteúdo Markdown para a Edição Transparente priorizando rascunho ativo.
 */
export async function loadTransparentPageSource ({
  apollo,
  queryDraftAndPolicy,
  pageSingleQuery,
  path,
  locale,
  pageId
}) {
  if (!apollo) {
    throw new Error('Apollo client não disponível')
  }

  const draftRes = await apollo.query({
    query: queryDraftAndPolicy,
    variables: { path, locale },
    fetchPolicy: 'network-only'
  })

  const activeDraft = draftRes &&
    draftRes.data &&
    draftRes.data.workflow &&
    draftRes.data.workflow.draftByPath

  if (activeDraft && activeDraft.content) {
    return {
      markdown: activeDraft.content,
      draftId: activeDraft.id,
      draftState: activeDraft.state || 'draft',
      source: 'draft'
    }
  }

  if (!pageId) {
    return {
      markdown: (activeDraft && typeof activeDraft.content === 'string') ? activeDraft.content : '',
      draftId: activeDraft ? activeDraft.id : null,
      draftState: activeDraft ? (activeDraft.state || 'draft') : null,
      source: activeDraft ? 'draft' : 'page'
    }
  }

  const pageRes = await apollo.query({
    query: pageSingleQuery,
    variables: { id: pageId },
    fetchPolicy: 'network-only'
  })

  const pageContent = (pageRes &&
    pageRes.data &&
    pageRes.data.pages &&
    pageRes.data.pages.single &&
    pageRes.data.pages.single.content) || ''

  return {
    markdown: pageContent,
    draftId: activeDraft ? activeDraft.id : null,
    draftState: activeDraft ? (activeDraft.state || 'draft') : null,
    source: 'page'
  }
}

/**
 * Salva automaticamente o rascunho editado no modo transparente via GraphQL.
 */
export async function saveTransparentDraft ({
  apollo,
  mutationSaveDraft,
  activeDraftId = null,
  pageId = 0,
  path = 'home',
  locale = 'pt-br',
  title = 'Untitled',
  description = '',
  markdown = '',
  tags = []
}) {
  if (!apollo) {
    throw new Error('Apollo client não disponível')
  }

  const normalizedTags = Array.isArray(tags) ?
    tags.map(t => (typeof t === 'string' ? t : (t && (t.tag || t.title)) || '')).filter(Boolean) :
    []

  const res = await apollo.mutate({
    mutation: mutationSaveDraft,
    variables: {
      id: activeDraftId,
      pageId,
      path,
      locale,
      title,
      description,
      content: markdown,
      contentType: 'markdown',
      editorKey: 'markdown',
      tags: normalizedTags
    }
  })

  const saveDraftResult = res &&
    res.data &&
    res.data.workflow &&
    res.data.workflow.saveDraft

  const draft = saveDraftResult && saveDraftResult.draft
  const responseResult = saveDraftResult && saveDraftResult.responseResult
  return {
    succeeded: Boolean(responseResult && responseResult.succeeded),
    message: (responseResult && responseResult.message) || '',
    draftId: draft && draft.id ? draft.id : activeDraftId,
    draft: draft || null
  }
}

/**
 * Submete o rascunho ativo da Edição Transparente para validação no workflow.
 */
export async function submitTransparentValidation ({
  apollo,
  mutationWorkflowSubmit,
  activeDraftId,
  comment = ''
}) {
  if (!apollo) {
    throw new Error('Apollo client não disponível')
  }
  if (!activeDraftId) {
    return {
      succeeded: false,
      message: 'Nenhum rascunho ativo para submeter.'
    }
  }

  const payload = buildValidationPayload(comment)
  const res = await apollo.mutate({
    mutation: mutationWorkflowSubmit,
    variables: {
      id: activeDraftId,
      comment: payload.comment
    }
  })

  const submitData = res && res.data && res.data.workflowSubmit
  const result = submitData && submitData.responseResult
  return {
    succeeded: Boolean(result && result.succeeded),
    message: (result && result.message) || '',
    draft: (submitData && submitData.draft) || null
  }
}

/**
 * Transforma um bloco em cabeçalho com o nível informado (1..6).
 */
export function transformBlockHeading (block = {}, level = 2) {
  const clean = String(block.text || '').trim()
  const lvl = Math.max(1, Math.min(6, parseInt(level, 10) || 2))
  return {
    ...block,
    type: 'heading',
    level: lvl,
    anchor: slugify(clean),
    text: clean
  }
}

/**
 * Transforma um bloco de volta em parágrafo normal.
 */
export function transformBlockParagraph (block = {}) {
  const clean = String(block.text || '').trim()
  const { level, anchor, variant, ...rest } = block
  return {
    ...rest,
    type: 'paragraph',
    text: clean
  }
}

/**
 * Detecta e aplica gatilhos Markdown digitados no início do bloco (#, ##, ###, -, *, 1., >).
 */
export function handleMarkdownPrefixTrigger (text = '', currentBlock = {}) {
  const raw = String(text || '')

  // Callout HTML completo (<div class="is-info">...</div>)
  const htmlCallout = raw.match(/^\s*<(div|blockquote)\s+[^>]*class=["'][^"']*\bis-(info|success|warning|danger)\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>\s*$/i)
  if (htmlCallout) {
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'callout',
        variant: htmlCallout[2].toLowerCase(),
        text: inlineHtmlToMarkdown(htmlCallout[3]).trim()
      }
    }
  }

  // Diretiva de Callout (> [!info] texto ou [!warning] texto)
  const alertDirective = raw.match(/^(?:>\s*)?\[!(info|success|warning|danger|note|tip|important|caution)\]\s+(.*)$/i)
  if (alertDirective) {
    const rawVar = alertDirective[1].toLowerCase()
    const variantMap = {
      info: 'info',
      note: 'info',
      success: 'success',
      tip: 'success',
      warning: 'warning',
      important: 'warning',
      danger: 'danger',
      caution: 'danger'
    }
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'callout',
        variant: variantMap[rawVar] || 'info',
        text: alertDirective[2]
      }
    }
  }

  // Sufixo {.is-info|success|warning|danger} digitado ao final do bloco
  const classSuffix = raw.match(/^([\s\S]*?)\s*\{\.is-(info|success|warning|danger)\}\s*$/i)
  if (classSuffix) {
    const bodyText = classSuffix[1].replace(/^>\s?/, '').trim()
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'callout',
        variant: classSuffix[2].toLowerCase(),
        text: bodyText
      }
    }
  }

  // ###### .. # Headings (1 a 6)
  const headingMatch = raw.match(/^(#{1,6})\s+(.*)$/)
  if (headingMatch) {
    const level = headingMatch[1].length
    const remaining = headingMatch[2]
    return {
      triggered: true,
      block: transformBlockHeading({ ...currentBlock, text: remaining }, level)
    }
  }

  // Bloco de código com crase ou til (```js , ``` , ~~~python )
  const codeFenceMatch = raw.match(/^(```|~~~)([a-zA-Z0-9_-]*)\s$/)
  if (codeFenceMatch) {
    const fence = codeFenceMatch[1]
    const lang = codeFenceMatch[2] || ''
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'raw',
        text: `${fence}${lang}\n\n${fence}`
      }
    }
  }

  // Checklist direta ([ ] tarefa ou [x] tarefa)
  const taskPrefixMatch = raw.match(/^\[([ xX])\]\s(.*)$/)
  if (taskPrefixMatch) {
    const mark = taskPrefixMatch[1].toLowerCase() === 'x' ? 'x' : ' '
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'raw',
        text: `- [${mark}] ${taskPrefixMatch[2]}`
      }
    }
  }

  // Lista com Marcadores (- ou *)
  if (raw.startsWith('- ') || raw.startsWith('* ')) {
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'raw',
        text: '- ' + raw.slice(2)
      }
    }
  }
  // Lista Numerada (1. )
  if (/^\d+\.\s/.test(raw)) {
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'raw',
        text: raw
      }
    }
  }
  // Bloco de Destaque / Citação (> )
  if (raw.startsWith('> ')) {
    const remaining = raw.slice(2)
    return {
      triggered: true,
      block: {
        ...currentBlock,
        type: 'callout',
        variant: 'info',
        text: remaining
      }
    }
  }

  return { triggered: false }
}

/**
 * Registra um novo snapshot no histórico de blocos.
 */
export function pushHistorySnapshot (stack = [], currentIndex = -1, blocks = [], maxDepth = 30) {
  const clone = JSON.parse(JSON.stringify(blocks || []))
  const newStack = (Array.isArray(stack) ? stack : []).slice(0, currentIndex + 1)
  newStack.push(clone)
  if (newStack.length > maxDepth) {
    newStack.shift()
  }
  return {
    historyStack: newStack,
    historyIndex: newStack.length - 1
  }
}

/**
 * Desfaz para o snapshot anterior da pilha de histórico.
 */
export function undoHistory (stack = [], currentIndex = 0) {
  if (!Array.isArray(stack) || currentIndex <= 0 || !stack[currentIndex - 1]) {
    return { canUndo: false, blocks: null, newIndex: currentIndex }
  }
  const newIndex = currentIndex - 1
  return {
    canUndo: true,
    blocks: JSON.parse(JSON.stringify(stack[newIndex])),
    newIndex
  }
}

/**
 * Refaz para o próximo snapshot da pilha de histórico.
 */
export function redoHistory (stack = [], currentIndex = -1) {
  if (!Array.isArray(stack) || currentIndex >= stack.length - 1 || !stack[currentIndex + 1]) {
    return { canRedo: false, blocks: null, newIndex: currentIndex }
  }
  const newIndex = currentIndex + 1
  return {
    canRedo: true,
    blocks: JSON.parse(JSON.stringify(stack[newIndex])),
    newIndex
  }
}

/**
 * Calcula estado de recolhimento da barra de pesquisa global durante scroll.
 * Acumula deslocamento direcional para suportar scroll suave (incrementos de 1-4px/frame).
 */
export function computeSearchCollapseOnScroll ({
  currentY = 0,
  lastScrollY = 0,
  downDistance = 0,
  upDistance = 0,
  isCollapsed = false,
  isFocused = false,
  hasQuery = false
} = {}) {
  const y = Math.max(0, Number(currentY) || 0)
  const prevY = Math.max(0, Number(lastScrollY) || 0)

  if (isFocused || hasQuery) {
    return {
      isCollapsed,
      lastScrollY: y,
      downDistance: 0,
      upDistance: 0
    }
  }

  if (y <= 24) {
    return {
      isCollapsed: false,
      lastScrollY: y,
      downDistance: 0,
      upDistance: 0
    }
  }

  let nextCollapsed = Boolean(isCollapsed)
  let nextDown = Math.max(0, Number(downDistance) || 0)
  let nextUp = Math.max(0, Number(upDistance) || 0)
  const delta = y - prevY

  if (delta > 0) {
    nextDown += delta
    nextUp = 0
    if (y > 40 && nextDown >= 10) {
      nextCollapsed = true
    }
  } else if (delta < 0) {
    nextUp += Math.abs(delta)
    nextDown = 0
    if (nextUp >= 18) {
      nextCollapsed = false
    }
  }

  return {
    isCollapsed: nextCollapsed,
    lastScrollY: y,
    downDistance: nextDown,
    upDistance: nextUp
  }
}

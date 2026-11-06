import { parseMarkdown, serializeBlocks, slugify } from './markdown-blocks'

export const SLASH_MENU_ITEMS = [
  {
    type: 'paragraph',
    icon: 'mdi-format-paragraph',
    avatarColor: '#f1f5f9',
    iconColor: '#475569',
    title: 'Texto Simples',
    subtitle: 'Parágrafo padrão'
  },
  {
    type: 'heading',
    icon: 'mdi-format-header-2',
    avatarColor: '#f1f5f9',
    iconColor: '#1e293b',
    title: 'Título de Seção',
    subtitle: 'Cabeçalho H2 com índice'
  },
  {
    type: 'callout-info',
    icon: 'mdi-information-outline',
    avatarColor: '#eff6ff',
    iconColor: '#2563eb',
    title: 'Bloco Informativo',
    subtitle: 'Destaque azul para notas'
  },
  {
    type: 'callout-success',
    icon: 'mdi-check-circle-outline',
    avatarColor: '#f0fdf4',
    iconColor: '#1b6535',
    title: 'Bloco Institucional',
    subtitle: 'Aviso verde Detran-MG'
  },
  {
    type: 'image',
    icon: 'mdi-image-outline',
    avatarColor: '#fef3c7',
    iconColor: '#d97706',
    title: 'Imagem / Mídia',
    subtitle: 'Upload ou galeria de assets'
  },
  {
    type: 'links',
    icon: 'mdi-view-grid-outline',
    avatarColor: '#e0f2fe',
    iconColor: '#0284c7',
    title: 'Cards de Links',
    subtitle: 'Grade de acessos rápidos'
  }
]

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
 * Transforma um bloco de acordo com o comando selecionado no menu "/" ou barra flutuante.
 */
export function applySlashCommandToBlock (block = {}, type = 'paragraph') {
  const cleanText = String(block.text || '').replace(/\/$/, '').trim()

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

  if (type === 'heading') {
    return {
      ...block,
      type: 'heading',
      level: 2,
      anchor: slugify(cleanText),
      text: cleanText
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
 * Calcula posição segura na tela para o menu "/" evitando corte nas bordas da janela.
 */
export function computeSlashMenuPosition (position = { top: 0, left: 0 }, viewport = { width: 1024, height: 768 }) {
  const maxTop = Math.max(16, (viewport.height || 768) - 320)
  const maxLeft = Math.max(16, (viewport.width || 1024) - 300)
  return {
    position: 'fixed',
    top: `${Math.min((position.top || 0) + 28, maxTop)}px`,
    left: `${Math.min(position.left || 0, maxLeft)}px`,
    zIndex: 9999
  }
}

/**
 * Calcula posição segura na tela para a barra flutuante de formatação.
 */
export function computeFloatingToolbarPosition (position = { top: 0, left: 0 }) {
  return {
    position: 'fixed',
    top: `${Math.max((position.top || 0) - 46, 12)}px`,
    left: `${Math.max(position.left || 0, 16)}px`,
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
      source: 'draft'
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
    draftId: null,
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
  return {
    succeeded: Boolean(saveDraftResult && saveDraftResult.responseResult && saveDraftResult.responseResult.succeeded),
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

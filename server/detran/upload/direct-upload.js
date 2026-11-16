const _ = require('lodash')
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')
const sanitize = require('sanitize-filename')

/* global WIKI */

const ALLOWED_RASTER_MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp'
}

const ALLOWED_RASTER_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])

/**
 * Middleware de preparação multipart para o endpoint /upload do Editor Transparente
 */
function directUploadMultipartMiddleware(req, res, next) {
  const contentType = String((req.headers && req.headers['content-type']) || '').toLowerCase()
  if (contentType.includes('multipart/form-data')) {
    const uploadDir = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
    fs.ensureDirSync(uploadDir)
    return multer({
      dest: uploadDir,
      limits: {
        fileSize: _.get(WIKI, 'config.uploads.maxFileSize', 10 * 1024 * 1024),
        files: 1
      }
    }).any()(req, res, next)
  }
  next()
}

/**
 * Handler seguro (fail-closed + allowlist raster) para POST /upload
 */
async function directUploadHandler(req, res) {
  try {
    const user = req && req.user ? req.user : null
    const userId = user && user.id ? Number(user.id) : 0
    const hasPerm = Boolean(
      user && (
        userId === 1 ||
        _.some(user.permissions, pm => _.includes(['write:assets', 'write:pages', 'manage:system'], pm))
      )
    )

    if (!user || userId <= 0 || userId === 2 || !hasPerm) {
      return res.status(403).json({
        ok: false,
        succeeded: false,
        message: 'Sem permissão para enviar arquivos de mídia.'
      })
    }

    const uploadDir = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
    await fs.ensureDir(uploadDir)

    let fileMeta = _.get(req, 'files[0]', null)

    // Support base64 dataUrl payload from Smart Paste (strictly raster images)
    if (!fileMeta && req.body && req.body.dataUrl) {
      const match = String(req.body.dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
      if (!match) {
        return res.status(400).json({
          ok: false,
          succeeded: false,
          message: 'Formato de imagem em base64 inválido.'
        })
      }
      const mimeType = match[1].toLowerCase()
      const allowedExt = ALLOWED_RASTER_MIME_EXT[mimeType]
      if (!allowedExt) {
        return res.status(400).json({
          ok: false,
          succeeded: false,
          message: 'Tipo de imagem não permitido. Envie apenas imagens raster (PNG, JPG, GIF, WEBP ou BMP).'
        })
      }

      const buffer = Buffer.from(match[2], 'base64')
      const tempName = `paste_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const tempPath = path.join(uploadDir, tempName)
      await fs.writeFile(tempPath, buffer)

      fileMeta = {
        originalname: req.body.filename || `${tempName}${allowedExt}`,
        mimetype: mimeType,
        size: buffer.length,
        path: tempPath
      }
    }

    if (!fileMeta) {
      return res.status(400).json({
        ok: false,
        succeeded: false,
        message: 'Nenhum arquivo de imagem recebido no upload.'
      })
    }

    const mimeType = String(fileMeta.mimetype || '').toLowerCase()
    const parsed = path.parse(fileMeta.originalname || '')
    const rawExt = (parsed.ext || '').toLowerCase()
    const mimeExt = ALLOWED_RASTER_MIME_EXT[mimeType] || ''

    if (!mimeExt || (rawExt && !ALLOWED_RASTER_EXTS.has(rawExt))) {
      return res.status(400).json({
        ok: false,
        succeeded: false,
        message: 'Extensão ou formato não permitido. Envie apenas imagens raster (PNG, JPG, GIF, WEBP ou BMP).'
      })
    }

    const ext = rawExt && ALLOWED_RASTER_EXTS.has(rawExt) ? rawExt : mimeExt
    let baseName = sanitize((parsed.name || 'imagem').toLowerCase().replace(/[\s,;#]+/g, '_'))
    if (!baseName || ['image', 'clipboard', 'paste', 'blob', 'upload', 'captura'].includes(baseName)) {
      baseName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    } else {
      baseName = `${baseName}_${Date.now()}`
    }

    const safeFilename = sanitize(`${baseName}${ext}`)
    fileMeta.originalname = safeFilename

    await WIKI.models.assets.upload({
      ...fileMeta,
      mode: 'upload',
      folderId: null,
      assetPath: safeFilename,
      user
    })

    const publicUrl = `/${safeFilename}`
    return res.status(200).json({
      ok: true,
      succeeded: true,
      path: publicUrl,
      url: publicUrl,
      filename: safeFilename
    })
  } catch (err) {
    if (typeof WIKI !== 'undefined' && WIKI && WIKI.logger) {
      WIKI.logger.warn(err)
    }
    return res.status(500).json({
      ok: false,
      succeeded: false,
      message: err.message || 'Falha interna ao processar upload de mídia.'
    })
  }
}

function registerDirectUpload(router) {
  router.post('/upload', directUploadMultipartMiddleware, directUploadHandler)
}

module.exports = {
  ALLOWED_RASTER_MIME_EXT,
  ALLOWED_RASTER_EXTS,
  directUploadMultipartMiddleware,
  directUploadHandler,
  registerDirectUpload
}

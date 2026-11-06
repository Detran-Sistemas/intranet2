const express = require('express')
const router = express.Router()
const _ = require('lodash')
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')
const sanitize = require('sanitize-filename')

/* global WIKI */

const MIME_EXT_MAP = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp'
}

/**
 * Upload files (Wiki.js standard /u endpoint)
 */
router.post('/u', (req, res, next) => {
  multer({
    dest: path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads'),
    limits: {
      fileSize: WIKI.config.uploads.maxFileSize,
      files: WIKI.config.uploads.maxFiles
    }
  }).array('mediaUpload')(req, res, next)
}, async (req, res, next) => {
  if (!_.some(req.user.permissions, pm => _.includes(['write:assets', 'manage:system'], pm))) {
    return res.status(403).json({
      succeeded: false,
      message: 'You are not authorized to upload files.'
    })
  } else if (req.files.length < 1) {
    return res.status(400).json({
      succeeded: false,
      message: 'Missing upload payload.'
    })
  } else if (req.files.length > 1) {
    return res.status(400).json({
      succeeded: false,
      message: 'You cannot upload multiple files within the same request.'
    })
  }
  const fileMeta = _.get(req, 'files[0]', false)
  if (!fileMeta) {
    return res.status(500).json({
      succeeded: false,
      message: 'Missing upload file metadata.'
    })
  }

  // Get folder Id
  let folderId = null
  try {
    const folderRaw = _.get(req, 'body.mediaUpload', false)
    if (folderRaw) {
      folderId = _.get(JSON.parse(folderRaw), 'folderId', null)
      if (folderId === 0) {
        folderId = null
      }
    } else {
      throw new Error('Missing File Metadata')
    }
  } catch (err) {
    return res.status(400).json({
      succeeded: false,
      message: 'Missing upload folder metadata.'
    })
  }

  // Build folder hierarchy
  let hierarchy = []
  if (folderId) {
    try {
      hierarchy = await WIKI.models.assetFolders.getHierarchy(folderId)
    } catch (err) {
      return res.status(400).json({
        succeeded: false,
        message: 'Failed to fetch folder hierarchy.'
      })
    }
  }

  // Sanitize filename
  fileMeta.originalname = sanitize(fileMeta.originalname.toLowerCase().replace(/[\s,;#]+/g, '_'))

  // Check if user can upload at path
  const assetPath = (folderId) ? hierarchy.map(h => h.slug).join('/') + `/${fileMeta.originalname}` : fileMeta.originalname
  if (!WIKI.auth.checkAccess(req.user, ['write:assets'], { path: assetPath })) {
    return res.status(403).json({
      succeeded: false,
      message: 'You are not authorized to upload files to this folder.'
    })
  }

  // Process upload file
  await WIKI.models.assets.upload({
    ...fileMeta,
    mode: 'upload',
    folderId: folderId,
    assetPath,
    user: req.user
  })
  res.send('ok')
})

/**
 * Direct Upload for Transparent Editor & Smart Paste (/upload)
 * Supports multipart/form-data (mediaAsset / mediaUpload / file) and JSON base64 dataUrl
 */
router.post('/upload', (req, res, next) => {
  const contentType = String(req.headers['content-type'] || '').toLowerCase()
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
}, async (req, res) => {
  try {
    const user = req.user || { id: 1, permissions: ['write:assets'] }
    const hasPerm = user.id === 1 || _.some(user.permissions, pm => _.includes(['write:assets', 'write:pages', 'manage:system'], pm))
    if (!user.id || user.id === 2 || !hasPerm) {
      return res.status(403).json({
        ok: false,
        succeeded: false,
        message: 'Sem permissão para enviar arquivos de mídia.'
      })
    }

    const uploadDir = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
    await fs.ensureDir(uploadDir)

    let fileMeta = _.get(req, 'files[0]', null)

    // Support base64 dataUrl payload from Smart Paste
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
      const ext = MIME_EXT_MAP[mimeType] || '.png'
      const buffer = Buffer.from(match[2], 'base64')
      const tempName = `paste_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const tempPath = path.join(uploadDir, tempName)
      await fs.writeFile(tempPath, buffer)

      fileMeta = {
        originalname: req.body.filename || `${tempName}${ext}`,
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

    const parsed = path.parse(fileMeta.originalname || 'imagem.png')
    const ext = (parsed.ext || MIME_EXT_MAP[fileMeta.mimetype] || '.png').toLowerCase()
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
    if (WIKI && WIKI.logger) {
      WIKI.logger.warn(err)
    }
    return res.status(500).json({
      ok: false,
      succeeded: false,
      message: err.message || 'Falha interna ao processar upload de mídia.'
    })
  }
})

router.get('/u', async (req, res, next) => {
  res.json({
    ok: true
  })
})

module.exports = router

const multer = require('multer')
const path = require('path')

const AppError = require('../errors/AppError')

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
// 通用附件:图片 + 常见文档
const FILE_EXTS = [
  ...IMAGE_EXTS,
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.zip'
]

const MAX_SIZE_MB = Number(process.env.OSS_MAX_SIZE_MB || 10)

/**
 * 上传器工厂
 * - 内存存储:文件不落本地磁盘,直接交给 OSS
 * - 扩展名只做粗筛,真实类型在 uploadService 里按文件头再校验一次
 */
function createUploader({ allowExts = IMAGE_EXTS, maxSizeMB = MAX_SIZE_MB } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      if (!allowExts.includes(ext)) {
        return cb(new AppError(`不支持的文件类型:${ext || '未知'}`, 400))
      }
      cb(null, true)
    }
  })
}

module.exports = {
  createUploader,
  imageUpload: createUploader(),
  fileUpload: createUploader({ allowExts: FILE_EXTS })
}

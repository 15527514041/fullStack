import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { renderNodeToPng, type ImageExportOptions } from '@/utils/image'
import { downloadBlob } from '@/utils/file'

export interface ExportImageParams extends ImageExportOptions {
  /** 文件名(不用带扩展名,统一补 .png) */
  fileName: string
}

/**
 * 导出图片:节点 → PNG → 浏览器下载,附带 loading 状态与成功 / 失败提示
 *
 * 用法(节点上挂个 ref 即可,样式沿用页面自己的):
 *   const cardRef = ref<HTMLElement | null>(null)
 *   const { exporting, exportImage } = useImageExport()
 *   <el-button :loading="exporting" @click="exportImage(cardRef, { title, fileName })">导出</el-button>
 */
export function useImageExport() {
  const { t } = useI18n()
  const exporting = ref(false)

  async function exportImage(node: HTMLElement | null, params: ExportImageParams): Promise<boolean> {
    // 正在导出时忽略重复点击(按钮同时也会 loading)
    if (!node || exporting.value) return false

    exporting.value = true
    try {
      const blob = await renderNodeToPng(node, params)
      downloadBlob(blob, `${params.fileName}.png`)
      ElMessage.success(t('common.exported'))
      return true
    } catch {
      ElMessage.error(t('common.exportFailed'))
      return false
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportImage }
}

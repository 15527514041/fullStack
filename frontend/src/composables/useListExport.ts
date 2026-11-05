import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { downloadBlob } from '@/utils/file'
import type { ExportDownload } from '@/api/export'

/**
 * 列表导出按钮的公共交互:
 * 文件、文件名和行数都由后端返回,这里只负责触发请求、下载与统一提示。
 */
export function useListExport() {
  const { t } = useI18n()
  const exporting = ref(false)

  async function exportList(request: () => Promise<ExportDownload>): Promise<boolean> {
    if (exporting.value) return false

    exporting.value = true
    try {
      const file = await request()
      if (!file.blob.size) {
        ElMessage.warning(t('common.exportEmpty'))
        return false
      }

      try {
        downloadBlob(file.blob, file.fileName)
      } catch {
        ElMessage.error(t('common.exportDataFailed'))
        return false
      }

      ElMessage.success(t('common.exportedRows', { count: file.count }))
      return true
    } catch {
      // 后端 / 网络错误已由 axios 拦截器提示,避免重复弹错
      return false
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportList }
}

import { request } from './request'
import type { UploadAvatarResult } from '@/types'

// 头像上传:FormData 交给 axios 自动生成 multipart boundary,不要手动设置 Content-Type
export function uploadAvatar(file: File): Promise<UploadAvatarResult> {
  const formData = new FormData()
  formData.append('avatar', file)

  return request<UploadAvatarResult>({
    url: '/users/me/avatar',
    method: 'post',
    data: formData
  })
}
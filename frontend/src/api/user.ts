import { request } from './request'
import type { ChangePasswordPayload, UploadAvatarResult } from '@/types'

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

// 修改密码:成功后服务端不签发新 token,由前端引导用户重新登录
export function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  return request<{ message: string }>({
    url: '/users/me/password',
    method: 'patch',
    data: payload
  })
}

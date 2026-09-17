import { request } from './request'
import type { AdminUser, Role } from '@/types'

// 获取用户列表(仅管理员)
export function getUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>({ url: '/admin/users', method: 'get' })
}

export interface UpdateRoleResult {
  id: number
  username: string
  role: Role
}

// 修改用户角色(仅管理员)
export function updateUserRole(id: number, role: Role): Promise<UpdateRoleResult> {
  return request<UpdateRoleResult>({
    url: `/admin/users/${id}/role`,
    method: 'patch',
    data: { role }
  })
}
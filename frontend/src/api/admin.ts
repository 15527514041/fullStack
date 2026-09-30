import { request } from './request'
import type { AdminUserQuery, Role, UserListResult, UserStatus } from '@/types'

// 用户列表(分页 + 搜索,仅管理员)
export function getUsers(params?: AdminUserQuery): Promise<UserListResult> {
  return request<UserListResult>({ url: '/admin/users', method: 'get', params })
}

export interface UpdateRoleResult {
  id: number
  username: string
  role: Role
  status: UserStatus
}

export function updateUserRole(id: number, role: Role): Promise<UpdateRoleResult> {
  return request<UpdateRoleResult>({
    url: `/admin/users/${id}/role`,
    method: 'patch',
    data: { role }
  })
}

export function updateUserStatus(id: number, status: UserStatus): Promise<UpdateRoleResult> {
  return request<UpdateRoleResult>({
    url: `/admin/users/${id}/status`,
    method: 'patch',
    data: { status }
  })
}
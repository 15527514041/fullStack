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

export interface DeleteUserResult {
  message: string
  username: string
  /** 一起清掉的数据条数,用来给一个明确的提示 */
  removed: { todos: number; tags: number; reflections: number; plans: number }
}

// 删除用户:账号连同它的 TODO / 标签 / 反思 / 规划一起删除(不可恢复,调用前必须二次确认)
export function deleteUser(id: number): Promise<DeleteUserResult> {
  return request<DeleteUserResult>({
    url: `/admin/users/${id}`,
    method: 'delete'
  })
}

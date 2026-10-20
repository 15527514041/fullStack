import { request } from './request'
import type { LoginResult, User } from '@/types'

export interface AuthPayload {
  username: string
  password: string
}

export interface RegisterPayload extends AuthPayload {
  locale?: 'zh_CN' | 'en_US'
}

export function loginApi(data: AuthPayload): Promise<LoginResult> {
  return request<LoginResult>({ url: '/auth/login', method: 'post', data })
}

export function registerApi(data: RegisterPayload): Promise<User> {
  return request<User>({ url: '/auth/register', method: 'post', data })
}

import { request } from './request'
import type { LoginResult, User } from '@/types'

export interface AuthPayload {
  username: string
  password: string
}

export function loginApi(data: AuthPayload): Promise<LoginResult> {
  return request<LoginResult>({ url: '/auth/login', method: 'post', data })
}

export function registerApi(data: AuthPayload): Promise<User> {
  return request<User>({ url: '/auth/register', method: 'post', data })
}
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import i18n from '@/lang'
import { getToken, removeToken } from '@/utils/auth'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10000
})

// 请求拦截器:自动携带 token
service.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let redirecting = false

// 响应拦截器:统一解包 data、统一错误提示、401 时跳转登录页
service.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || i18n.global.t('request.failed')

    if (status === 401) {
      removeToken()
      if (!redirecting) {
        redirecting = true
        ElMessage.error(i18n.global.t('request.expired'))
        const current = window.location.pathname + window.location.search
        if (!current.startsWith('/login')) {
          window.location.href = `/login?redirect=${encodeURIComponent(current)}`
        }
        setTimeout(() => {
          redirecting = false
        }, 1000)
      }
    } else {
      ElMessage.error(message)
    }

    return Promise.reject(new Error(message))
  }
)

export function request<T>(config: AxiosRequestConfig): Promise<T> {
  return service.request(config) as unknown as Promise<T>
}

export default service

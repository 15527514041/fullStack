import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse
} from 'axios'
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

async function errorMessageFrom(error: AxiosError<unknown>): Promise<string> {
  const data = error.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text) as { message?: string }
      return parsed.message || error.message
    } catch {
      return error.message
    }
  }

  if (data && typeof data === 'object' && 'message' in data) {
    return String(data.message || error.message)
  }
  return error.message
}

// 响应拦截器:统一解包 data、统一错误提示、401 时跳转登录页
service.interceptors.response.use(
  // blob 请求保留完整 response,下载接口要读文件名和导出行数响应头
  (response) => (response.config.responseType === 'blob' ? response : response.data),
  async (error: AxiosError<unknown>) => {
    const status = error.response?.status
    const message = (await errorMessageFrom(error)) || i18n.global.t('request.failed')

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

export function requestFile(config: AxiosRequestConfig): Promise<AxiosResponse<Blob>> {
  return service.request({
    ...config,
    responseType: 'blob'
  }) as unknown as Promise<AxiosResponse<Blob>>
}

export default service

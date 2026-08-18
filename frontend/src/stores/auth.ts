import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loginApi, registerApi, type AuthPayload } from '@/api/auth'
import { getToken, removeToken, setToken } from '@/utils/auth'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getToken())
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => Boolean(token.value))

  async function login(payload: AuthPayload): Promise<void> {
    const result = await loginApi(payload)
    token.value = result.token
    user.value = result.user
    setToken(result.token)
  }

  async function register(payload: AuthPayload): Promise<void> {
    await registerApi(payload)
  }

  function logout(): void {
    token.value = null
    user.value = null
    removeToken()
  }

  return { token, user, isLoggedIn, login, register, logout }
})
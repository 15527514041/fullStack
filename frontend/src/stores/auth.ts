import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loginApi, registerApi, type AuthPayload } from '@/api/auth'
import { getToken, getUser, removeToken, removeUser, setToken, setUser } from '@/utils/auth'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getToken())
  const user = ref<User | null>(getUser<User>())

  const isLoggedIn = computed(() => Boolean(token.value))

  async function login(payload: AuthPayload): Promise<void> {
    const result = await loginApi(payload)
    token.value = result.token
    user.value = result.user
    setToken(result.token)
    setUser(result.user)
  }

  async function register(payload: AuthPayload): Promise<void> {
    await registerApi(payload)
  }

  function logout(): void {
    token.value = null
    user.value = null
    removeToken()
    removeUser()
  }

  return { token, user, isLoggedIn, login, register, logout }
})
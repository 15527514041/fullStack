import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { title: '注册' }
  },
  {
    path: '/',
    name: 'todos',
    component: () => import('@/views/TodoView.vue'),
    meta: { title: 'TODO 列表', requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局前置守卫:未登录访问受保护页面 -> 登录页;已登录访问登录/注册页 -> 首页
router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if ((to.name === 'login' || to.name === 'register') && authStore.isLoggedIn) {
    return { name: 'todos' }
  }
})

// 全局后置守卫:同步页面标题
router.afterEach((to) => {
  const base = 'Fullstack TODO'
  const title = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = title ? `${title} - ${base}` : base
})

export default router
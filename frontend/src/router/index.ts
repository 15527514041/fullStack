import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import i18n from '@/lang'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/views/LoginView.vue'),
        meta: { titleKey: 'route.login' }
      }
    ]
  },
  {
    path: '/register',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'register',
        component: () => import('@/views/RegisterView.vue'),
        meta: { titleKey: 'route.register' }
      }
    ]
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'todos',
        component: () => import('@/views/TodoView.vue'),
        meta: { titleKey: 'route.todos', requiresAuth: true }
      },
      {
        path: 'trash',
        name: 'trash',
        component: () => import('@/views/TrashView.vue'),
        meta: { titleKey: 'route.trash', requiresAuth: true }
      },
      {
        path: 'tags',
        name: 'tags',
        component: () => import('@/views/TagsView.vue'),
        meta: { titleKey: 'route.tags', requiresAuth: true }
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/AdminView.vue'),
        meta: { titleKey: 'route.users', requiresAuth: true, requiresAdmin: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // 每次切路由把文档滚动复位:移动端键盘/地址栏滚动后会残留偏移,导致导航栏被顶出屏幕
  scrollBehavior: () => ({ top: 0, left: 0 })
})

// 全局前置守卫:未登录 → 登录页;非管理员访问管理页 → 回首页
router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'todos' }
  }

  if ((to.name === 'login' || to.name === 'register') && authStore.isLoggedIn) {
    return { name: 'todos' }
  }
})

// 同步页面标题(切语言时由 App.vue 再调一次)
export function syncDocumentTitle(): void {
  const to = router.currentRoute.value
  const base = 'Confluo'
  const key = typeof to.meta.titleKey === 'string' ? to.meta.titleKey : ''
  document.title = key ? `${i18n.global.t(key)} - ${base}` : base
}

// 全局后置守卫:同步页面标题
router.afterEach(syncDocumentTitle)

export default router

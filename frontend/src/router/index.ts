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
        component: () => import('@/views/auth/login.vue'),
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
        component: () => import('@/views/auth/register.vue'),
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
        component: () => import('@/views/todo/index.vue'),
        meta: { titleKey: 'route.todos', requiresAuth: true }
      },
      {
        path: 'trash',
        name: 'trash',
        component: () => import('@/views/todo/trash.vue'),
        meta: { titleKey: 'route.trash', requiresAuth: true }
      },
      {
        // 详情页:复用主布局,靠 meta.noSidebar 隐藏侧栏(参考 client)
        path: 'todos/:id',
        name: 'todo-detail',
        component: () => import('@/views/todo/detail.vue'),
        meta: { titleKey: 'route.todoDetail', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'tags',
        name: 'tags',
        component: () => import('@/views/tag/index.vue'),
        meta: { titleKey: 'route.tags', requiresAuth: true }
      },
      {
        path: 'reflections',
        name: 'reflections',
        component: () => import('@/views/reflection/index.vue'),
        meta: { titleKey: 'route.reflections', requiresAuth: true }
      },
      {
        path: 'plans',
        name: 'plans',
        component: () => import('@/views/plan/index.vue'),
        meta: { titleKey: 'route.plans', requiresAuth: true }
      },
      {
        path: 'weekly-reviews',
        name: 'weekly-reviews',
        component: () => import('@/views/weekly-review/index.vue'),
        meta: { titleKey: 'route.weeklyReviews', requiresAuth: true }
      },
      {
        // 反思详情:展示某天的条目,新增/编辑走弹窗,靠 meta.noSidebar 隐藏菜单栏
        path: 'reflections/:id',
        name: 'reflection-detail',
        component: () => import('@/views/reflection/detail.vue'),
        meta: { titleKey: 'route.reflectionDetail', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'plans/new',
        name: 'plan-new',
        component: () => import('@/views/plan/edit.vue'),
        meta: { titleKey: 'route.planNew', requiresAuth: true, noSidebar: true }
      },
      {
        // 详情页:只读展示 + 卡片外侧的编辑/删除
        path: 'plans/:id',
        name: 'plan-detail',
        component: () => import('@/views/plan/detail.vue'),
        meta: { titleKey: 'route.planDetail', requiresAuth: true, noSidebar: true }
      },
      {
        // 编辑页:从详情页的「编辑」进入,整页表单
        path: 'plans/:id/edit',
        name: 'plan-edit',
        component: () => import('@/views/plan/edit.vue'),
        meta: { titleKey: 'route.planEdit', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'weekly-reviews/new',
        name: 'weekly-review-new',
        component: () => import('@/views/weekly-review/edit.vue'),
        meta: { titleKey: 'route.weeklyReviewNew', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'weekly-reviews/:id',
        name: 'weekly-review-detail',
        component: () => import('@/views/weekly-review/detail.vue'),
        meta: { titleKey: 'route.weeklyReviewDetail', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'weekly-reviews/:id/edit',
        name: 'weekly-review-edit',
        component: () => import('@/views/weekly-review/edit.vue'),
        meta: { titleKey: 'route.weeklyReviewEdit', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/accounts',
        name: 'ledger-accounts',
        component: () => import('@/views/ledger/accounts.vue'),
        meta: { titleKey: 'route.ledgerAccounts', requiresAuth: true }
      },
      {
        path: 'ledger/entries',
        component: () => import('@/views/ledger/entries/components/LedgerEntriesListShell.vue'),
        meta: { requiresAuth: true },
        children: [
          {
            path: '',
            name: 'ledger-entries',
            component: () => import('@/views/ledger/entries/components/LedgerEntriesIndex.vue'),
            meta: { titleKey: 'route.ledgerEntries', requiresAuth: true }
          },
          {
            path: 'day',
            name: 'ledger-entries-day',
            component: () => import('@/views/ledger/entries/day/index.vue'),
            meta: { titleKey: 'route.ledgerEntriesDay', requiresAuth: true }
          },
          {
            path: 'week',
            name: 'ledger-entries-week',
            component: () => import('@/views/ledger/entries/week/index.vue'),
            meta: { titleKey: 'route.ledgerEntriesWeek', requiresAuth: true }
          },
          {
            path: 'month',
            name: 'ledger-entries-month',
            component: () => import('@/views/ledger/entries/month/index.vue'),
            meta: { titleKey: 'route.ledgerEntriesMonth', requiresAuth: true }
          }
        ]
      },
      {
        path: 'ledger/entries/day/new',
        name: 'ledger-entry-day-new',
        component: () => import('@/views/ledger/entries/day/edit.vue'),
        meta: { titleKey: 'route.ledgerEntryDayNew', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/day/:id/edit',
        name: 'ledger-entry-day-edit',
        component: () => import('@/views/ledger/entries/day/edit.vue'),
        meta: { titleKey: 'route.ledgerEntryDayEdit', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/day/:id',
        name: 'ledger-entry-day-detail',
        component: () => import('@/views/ledger/entries/day/detail.vue'),
        meta: { titleKey: 'route.ledgerEntryDayDetail', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/week/new',
        name: 'ledger-entry-week-new',
        component: () => import('@/views/ledger/entries/week/edit.vue'),
        meta: { titleKey: 'route.ledgerEntryWeekNew', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/week/:id/edit',
        name: 'ledger-entry-week-edit',
        component: () => import('@/views/ledger/entries/week/edit.vue'),
        meta: { titleKey: 'route.ledgerEntryWeekEdit', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/week/:id',
        name: 'ledger-entry-week-detail',
        component: () => import('@/views/ledger/entries/week/detail.vue'),
        meta: { titleKey: 'route.ledgerEntryWeekDetail', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/month/new',
        name: 'ledger-entry-month-new',
        component: () => import('@/views/ledger/entries/month/edit.vue'),
        meta: { titleKey: 'route.ledgerEntryMonthNew', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/month/:id/edit',
        name: 'ledger-entry-month-edit',
        component: () => import('@/views/ledger/entries/month/edit.vue'),
        meta: { titleKey: 'route.ledgerEntryMonthEdit', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'ledger/entries/month/:id',
        name: 'ledger-entry-month-detail',
        component: () => import('@/views/ledger/entries/month/detail.vue'),
        meta: { titleKey: 'route.ledgerEntryMonthDetail', requiresAuth: true, noSidebar: true }
      },
      {
        path: 'settings/preferences',
        name: 'preferences',
        component: () => import('@/views/preferences/index.vue'),
        meta: { titleKey: 'route.preferences', requiresAuth: true }
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/admin/index.vue'),
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

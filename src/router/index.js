import { createRouter, createWebHistory } from 'vue-router'
import { useAccountStore } from '@/stores/account'

/**
 * 路由配置
 */
const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/oauth/callback',
    name: 'OAuthCallback',
    component: () => import('@/views/OAuthCallback.vue'),
    meta: { title: 'OAuth2 认证' },
  },
  {
    path: '/main',
    name: 'Main',
    component: () => import('@/views/Main.vue'),
    meta: { title: '主界面', requiresAuth: true },
    children: [
      {
        path: 'inbox',
        name: 'Inbox',
        component: () => import('@/views/mail/Inbox.vue'),
        meta: { title: '收件箱' },
      },
      {
        path: 'sent',
        name: 'Sent',
        component: () => import('@/views/mail/Sent.vue'),
        meta: { title: '已发送' },
      },
      {
        path: 'drafts',
        name: 'Drafts',
        component: () => import('@/views/mail/Drafts.vue'),
        meta: { title: '草稿箱' },
      },
      {
        path: 'trash',
        name: 'Trash',
        component: () => import('@/views/mail/Trash.vue'),
        meta: { title: '回收站' },
      },
      {
        path: 'contacts',
        name: 'Contacts',
        component: () => import('@/views/Contacts.vue'),
        meta: { title: '通讯录' },
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: '设置' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * 路由守卫
 */
router.beforeEach(async (to, from, next) => {
  const accountStore = useAccountStore()
  
  // 设置页面标题
  document.title = to.meta.title 
    ? `${to.meta.title} - Maillionaire` 
    : 'Maillionaire'
  
  // 检查是否需要登录
  if (to.meta.requiresAuth) {
    // 如果没有加载账户，先加载
    if (accountStore.accounts.length === 0) {
      await accountStore.loadAccounts()
    }
    
    // 检查是否有当前账户
    if (!accountStore.currentAccount) {
      // 如果有账户但没有选中，自动选中第一个
      if (accountStore.accounts.length > 0) {
        accountStore.switchAccount(accountStore.accounts[0].id)
        next()
      } else {
        // 没有账户，跳转到登录页
        next('/login')
      }
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router

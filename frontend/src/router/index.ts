import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Lazy load components for better performance
const Dashboard = () => import('@/views/Dashboard.vue')
const Login = () => import('@/views/Auth/Login.vue')
const Register = () => import('@/views/Auth/Register.vue')
const Exchanges = () => import('@/views/Exchanges.vue')
const Trading = () => import('@/views/Trading.vue')
const PaperTrading = () => import('@/views/PaperTrading.vue')
const Portfolio = () => import('@/views/Portfolio.vue')
const Analytics = () => import('@/views/Analytics.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/exchanges',
    name: 'Exchanges',
    component: Exchanges,
    meta: { requiresAuth: true }
  },
  {
    path: '/trading',
    name: 'Trading',
    component: Trading,
    meta: { requiresAuth: true }
  },
  {
    path: '/paper-trading',
    name: 'PaperTrading',
    component: PaperTrading,
    meta: { requiresAuth: true }
  },
  {
    path: '/portfolio',
    name: 'Portfolio',
    component: Portfolio,
    meta: { requiresAuth: true }
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: Analytics,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated
  
  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
    return
  }
  
  // Check if route requires guest (not authenticated)
  if (to.meta.requiresGuest && isAuthenticated) {
    next('/dashboard')
    return
  }
  
  next()
})

export default router
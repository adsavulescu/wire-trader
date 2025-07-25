import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import './assets/style.css'

async function initApp() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)

  // Initialize auth before router to ensure auth state is ready
  const authStore = useAuthStore()
  await authStore.initializeAuth()

  app.use(router)
  app.mount('#app')
}

initApp()
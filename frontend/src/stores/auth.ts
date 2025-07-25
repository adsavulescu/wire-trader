import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth'
import type { User, LoginCredentials, RegisterCredentials } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => {
    return !!user.value && !!token.value && authService.isTokenValid()
  })

  const userFullName = computed(() => {
    if (!user.value) return ''
    return `${user.value.firstName} ${user.value.lastName}`
  })

  // Actions
  const initializeAuth = async () => {
    const storedToken = authService.getToken()
    if (storedToken && authService.isTokenValid()) {
      token.value = storedToken
      await fetchProfile()
    } else {
      await logout()
    }
  }

  const login = async (credentials: LoginCredentials) => {
    loading.value = true
    error.value = null

    try {
      const response = await authService.login(credentials)
      
      if (response.success && response.data) {
        user.value = response.data.user
        token.value = response.data.token
        authService.setToken(response.data.token)
        return true
      } else {
        error.value = response.error || 'Login failed'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred during login'
      return false
    } finally {
      loading.value = false
    }
  }

  const register = async (credentials: RegisterCredentials) => {
    loading.value = true
    error.value = null

    try {
      const response = await authService.register(credentials)
      
      if (response.success && response.data) {
        user.value = response.data.user
        token.value = response.data.token
        authService.setToken(response.data.token)
        return true
      } else {
        error.value = response.error || 'Registration failed'
        return false
      }
    } catch (err) {
      error.value = 'An unexpected error occurred during registration'
      return false
    } finally {
      loading.value = false
    }
  }

  const fetchProfile = async () => {
    if (!token.value) return false

    try {
      const response = await authService.getProfile()
      
      if (response.success && response.data) {
        user.value = response.data
        return true
      } else {
        await logout()
        return false
      }
    } catch (err) {
      await logout()
      return false
    }
  }

  const logout = async () => {
    try {
      // Call logout endpoint to invalidate token on server
      await authService.logout()
    } catch (err) {
      // Continue with logout even if server call fails
      console.warn('Server logout failed:', err)
    } finally {
      // Clear local state
      user.value = null
      token.value = null
      error.value = null
      authService.removeToken()
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    user,
    token,
    loading,
    error,
    // Getters
    isAuthenticated,
    userFullName,
    // Actions
    initializeAuth,
    login,
    register,
    fetchProfile,
    logout,
    clearError,
  }
})
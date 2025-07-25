<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <h2 class="text-3xl font-extrabold text-gray-900">Wire-Trader</h2>
        <p class="mt-2 text-sm text-gray-600">Sign in to your trading account</p>
      </div>
      
      <BaseCard>
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <BaseInput
            id="email"
            v-model="form.email"
            type="email"
            label="Email Address"
            placeholder="Enter your email"
            required
            :error="errors.email"
          />
          
          <BaseInput
            id="password"
            v-model="form.password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            required
            :error="errors.password"
          />
          
          <div v-if="authStore.error" class="bg-red-50 border border-red-200 rounded-md p-4">
            <div class="text-sm text-red-600">{{ authStore.error }}</div>
          </div>
          
          <BaseButton
            type="submit"
            :loading="authStore.loading"
            loading-text="Signing in..."
            fullWidth
          >
            Sign In
          </BaseButton>
        </form>
        
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Don't have an account?
            <router-link to="/register" class="font-medium text-primary-600 hover:text-primary-500">
              Sign up here
            </router-link>
          </p>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { LoginCredentials } from '@/types'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive<LoginCredentials>({
  email: '',
  password: '',
})

const errors = ref<Partial<LoginCredentials>>({})

const validateForm = (): boolean => {
  errors.value = {}

  if (!form.email) {
    errors.value.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.value.email = 'Please enter a valid email address'
  }

  if (!form.password) {
    errors.value.password = 'Password is required'
  } else if (form.password.length < 6) {
    errors.value.password = 'Password must be at least 6 characters long'
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) return

  authStore.clearError()
  
  const success = await authStore.login(form)
  
  if (success) {
    router.push('/dashboard')
  }
}
</script>
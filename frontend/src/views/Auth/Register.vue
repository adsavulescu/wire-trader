<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <h2 class="text-3xl font-extrabold text-gray-900">Wire-Trader</h2>
        <p class="mt-2 text-sm text-gray-600">Create your trading account</p>
      </div>
      
      <BaseCard>
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <BaseInput
              id="firstName"
              v-model="form.firstName"
              type="text"
              label="First Name"
              placeholder="John"
              required
              :error="errors.firstName"
            />
            
            <BaseInput
              id="lastName"
              v-model="form.lastName"
              type="text"
              label="Last Name"
              placeholder="Doe"
              required
              :error="errors.lastName"
            />
          </div>
          
          <BaseInput
            id="email"
            v-model="form.email"
            type="email"
            label="Email Address"
            placeholder="john@example.com"
            required
            :error="errors.email"
          />
          
          <BaseInput
            id="password"
            v-model="form.password"
            type="password"
            label="Password"
            placeholder="Enter a secure password"
            required
            :error="errors.password"
            hint="Password must be at least 8 characters long"
          />
          
          <BaseInput
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            label="Confirm Password"
            placeholder="Confirm your password"
            required
            :error="errors.confirmPassword"
          />
          
          <div v-if="authStore.error" class="bg-red-50 border border-red-200 rounded-md p-4">
            <div class="text-sm text-red-600">{{ authStore.error }}</div>
          </div>
          
          <BaseButton
            type="submit"
            :loading="authStore.loading"
            loading-text="Creating account..."
            fullWidth
          >
            Create Account
          </BaseButton>
        </form>
        
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            Already have an account?
            <router-link to="/login" class="font-medium text-primary-600 hover:text-primary-500">
              Sign in here
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
import type { RegisterCredentials } from '@/types'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive<RegisterCredentials & { confirmPassword: string }>({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const errors = ref<Partial<RegisterCredentials & { confirmPassword: string }>>({})

const validateForm = (): boolean => {
  errors.value = {}

  if (!form.firstName) {
    errors.value.firstName = 'First name is required'
  }

  if (!form.lastName) {
    errors.value.lastName = 'Last name is required'
  }

  if (!form.email) {
    errors.value.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.value.email = 'Please enter a valid email address'
  }

  if (!form.password) {
    errors.value.password = 'Password is required'
  } else if (form.password.length < 8) {
    errors.value.password = 'Password must be at least 8 characters long'
  }

  if (!form.confirmPassword) {
    errors.value.confirmPassword = 'Please confirm your password'
  } else if (form.password !== form.confirmPassword) {
    errors.value.confirmPassword = 'Passwords do not match'
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) return

  authStore.clearError()
  
  const { confirmPassword, ...credentials } = form
  const success = await authStore.register(credentials)
  
  if (success) {
    router.push('/dashboard')
  }
}
</script>
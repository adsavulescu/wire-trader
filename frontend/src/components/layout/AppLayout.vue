<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <!-- Logo -->
            <div class="flex-shrink-0 flex items-center">
              <router-link to="/dashboard" class="text-2xl font-bold text-primary-600">
                Wire-Trader
              </router-link>
            </div>

            <!-- Navigation Links -->
            <div class="hidden md:ml-8 md:flex md:space-x-8">
              <router-link
                v-for="item in navigation"
                :key="item.name"
                :to="item.href"
                :class="[
                  isActiveRoute(item.href)
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                ]"
              >
                {{ item.name }}
              </router-link>
            </div>
          </div>

          <!-- User Menu -->
          <div class="flex items-center">
            <div class="relative ml-3">
              <div class="flex items-center space-x-4">
                <span class="text-sm text-gray-700">{{ authStore.userFullName }}</span>
                <BaseButton variant="secondary" size="sm" @click="handleLogout">
                  Logout
                </BaseButton>
              </div>
            </div>
          </div>

          <!-- Mobile menu button -->
          <div class="md:hidden flex items-center">
            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path
                  :class="{ hidden: mobileMenuOpen, 'inline-flex': !mobileMenuOpen }"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
                <path
                  :class="{ hidden: !mobileMenuOpen, 'inline-flex': mobileMenuOpen }"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <div :class="{ block: mobileMenuOpen, hidden: !mobileMenuOpen }" class="md:hidden">
        <div class="pt-2 pb-3 space-y-1">
          <router-link
            v-for="item in navigation"
            :key="item.name"
            :to="item.href"
            :class="[
              isActiveRoute(item.href)
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800',
              'block pl-3 pr-4 py-2 border-l-4 text-base font-medium'
            ]"
            @click="mobileMenuOpen = false"
          >
            {{ item.name }}
          </router-link>
        </div>
        <div class="pt-4 pb-3 border-t border-gray-200">
          <div class="px-4">
            <div class="text-base font-medium text-gray-800">{{ authStore.userFullName }}</div>
            <div class="text-sm font-medium text-gray-500">{{ authStore.user?.email }}</div>
          </div>
          <div class="mt-3 px-4">
            <BaseButton variant="secondary" size="sm" fullWidth @click="handleLogout">
              Logout
            </BaseButton>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import BaseButton from '@/components/common/BaseButton.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const mobileMenuOpen = ref(false)

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Trading', href: '/trading' },
  { name: 'Exchanges', href: '/exchanges' },
]

const isActiveRoute = (href: string) => {
  return route.path === href
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>
<template>
  <AppLayout>
    <div class="px-4 sm:px-0">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Exchange Management</h1>
        <p class="text-gray-600">Connect and manage your cryptocurrency exchanges</p>
      </div>

      <!-- Error Alert -->
      <div v-if="exchangeStore.error" class="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div class="ml-3">
            <p class="text-sm text-red-600">{{ exchangeStore.error }}</p>
          </div>
          <div class="ml-auto">
            <button @click="exchangeStore.clearError" class="text-red-400 hover:text-red-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Connected Exchanges Section -->
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900">Connected Exchanges</h2>
          <BaseButton @click="showConnectModal = true">
            Connect New Exchange
          </BaseButton>
        </div>

        <div v-if="exchangeStore.loading" class="text-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          <p class="text-gray-500 mt-2">Loading exchanges...</p>
        </div>

        <div v-else-if="exchangeStore.connectedExchanges.length === 0" class="text-center py-12 bg-white rounded-lg shadow-sm border">
          <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No Exchanges Connected</h3>
          <p class="text-gray-500 mb-6">Connect your first exchange to start trading</p>
          <BaseButton @click="showConnectModal = true">
            Connect Your First Exchange
          </BaseButton>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BaseCard v-for="exchange in exchangeStore.connectedExchanges" :key="exchange.name">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center">
                <div class="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                  <span class="text-lg font-bold text-primary-600 capitalize">{{ exchange.name.slice(0, 2) }}</span>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900 capitalize">{{ exchange.name }}</h3>
                  <p class="text-sm text-gray-500">{{ exchange.sandbox ? 'Sandbox Mode' : 'Live Trading' }}</p>
                </div>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                Connected
              </span>
            </div>

            <div class="space-y-2 mb-4">
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Status:</span>
                <span class="font-medium text-gray-900">Active</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">Mode:</span>
                <span class="font-medium text-gray-900">{{ exchange.sandbox ? 'Sandbox' : 'Live' }}</span>
              </div>
            </div>

            <div class="flex space-x-2">
              <BaseButton
                variant="secondary"
                size="sm"
                @click="testConnection(exchange.name)"
                :loading="testingConnection === exchange.name"
                class="flex-1"
              >
                Test Connection
              </BaseButton>
              <BaseButton
                variant="danger"
                size="sm"
                @click="handleDisconnect(exchange.name)"
                :loading="disconnecting === exchange.name"
                class="flex-1"
              >
                Disconnect
              </BaseButton>
            </div>
          </BaseCard>
        </div>
      </div>

      <!-- Connect Exchange Modal -->
      <div v-if="showConnectModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 w-full max-w-md">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Connect Exchange</h3>
            <button @click="closeConnectModal" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form @submit.prevent="handleConnect" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Exchange</label>
              <select v-model="connectForm.exchangeName" class="input" required>
                <option value="">Select an exchange</option>
                <option value="binance">Binance</option>
                <option value="coinbase">Coinbase Pro</option>
                <option value="kraken">Kraken</option>
                <option value="kucoin">KuCoin</option>
              </select>
            </div>

            <BaseInput
              v-model="connectForm.apiKey"
              label="API Key"
              placeholder="Enter your API key"
              required
              :error="connectErrors.apiKey"
            />

            <BaseInput
              v-model="connectForm.secret"
              type="password"
              label="Secret Key"
              placeholder="Enter your secret key"
              required
              :error="connectErrors.secret"
            />

            <BaseInput
              v-if="connectForm.exchangeName === 'coinbase'"
              v-model="connectForm.passphrase"
              type="password"
              label="Passphrase"
              placeholder="Enter your passphrase"
              hint="Required for Coinbase Pro"
            />

            <div class="flex items-center">
              <input
                id="sandbox"
                v-model="connectForm.sandbox"
                type="checkbox"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label for="sandbox" class="ml-2 block text-sm text-gray-900">
                Use sandbox/testnet mode
              </label>
            </div>

            <div class="flex space-x-3 pt-4">
              <BaseButton
                type="button"
                variant="secondary"
                @click="closeConnectModal"
                class="flex-1"
              >
                Cancel
              </BaseButton>
              <BaseButton
                type="submit"
                :loading="exchangeStore.loading"
                loading-text="Connecting..."
                class="flex-1"
              >
                Connect
              </BaseButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useExchangeStore } from '@/stores/exchanges'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import type { ExchangeCredentials } from '@/types'

const exchangeStore = useExchangeStore()

const showConnectModal = ref(false)
const testingConnection = ref<string | null>(null)
const disconnecting = ref<string | null>(null)

const connectForm = reactive<ExchangeCredentials & { passphrase: string }>({
  exchangeName: '',
  apiKey: '',
  secret: '',
  sandbox: true,
  passphrase: '',
})

const connectErrors = ref<Partial<ExchangeCredentials>>({})

const resetConnectForm = () => {
  connectForm.exchangeName = ''
  connectForm.apiKey = ''
  connectForm.secret = ''
  connectForm.sandbox = true
  connectForm.passphrase = ''
  connectErrors.value = {}
}

const closeConnectModal = () => {
  showConnectModal.value = false
  resetConnectForm()
  exchangeStore.clearError()
}

const validateConnectForm = (): boolean => {
  connectErrors.value = {}

  if (!connectForm.apiKey.trim()) {
    connectErrors.value.apiKey = 'API Key is required'
  }

  if (!connectForm.secret.trim()) {
    connectErrors.value.secret = 'Secret Key is required'
  }

  return Object.keys(connectErrors.value).length === 0
}

const handleConnect = async () => {
  if (!validateConnectForm()) return

  const success = await exchangeStore.connectExchange({
    ...connectForm,
    passphrase: connectForm.passphrase || undefined,
  })

  if (success) {
    closeConnectModal()
  }
}

const handleDisconnect = async (exchangeName: string) => {
  if (!confirm(`Are you sure you want to disconnect from ${exchangeName}?`)) return

  disconnecting.value = exchangeName
  await exchangeStore.disconnectExchange(exchangeName)
  disconnecting.value = null
}

const testConnection = async (exchangeName: string) => {
  testingConnection.value = exchangeName
  const success = await exchangeStore.testConnection(exchangeName)
  testingConnection.value = null
  
  // Show a simple alert for now - in production this would be a toast notification
  if (success) {
    alert('Connection test successful!')
  } else {
    alert('Connection test failed. Please check your credentials.')
  }
}

onMounted(async () => {
  await exchangeStore.fetchConnectedExchanges()
})
</script>
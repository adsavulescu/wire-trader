<template>
  <AppLayout>
    <div class="px-4 sm:px-0">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Paper Trading</h1>
            <p class="text-gray-600">Practice trading with virtual funds</p>
          </div>
          <div class="flex items-center space-x-4">
            <BaseButton @click="showCreateAccountModal = true" variant="primary">
              Create Account
            </BaseButton>
            <BaseButton 
              v-if="paperTradingStore.currentAccount" 
              @click="showResetModal = true" 
              variant="secondary"
            >
              Reset Account
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Account Selection -->
      <div class="mb-8" v-if="paperTradingStore.accounts.length > 0">
        <BaseCard title="Paper Trading Accounts">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              v-for="account in paperTradingStore.accounts"
              :key="account.id"
              @click="selectAccount(account.id)"
              :class="[
                'p-4 rounded-lg border-2 cursor-pointer transition-all',
                paperTradingStore.currentAccount?.id === account.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              ]"
            >
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-gray-900">{{ account.name }}</h3>
                <button
                  @click.stop="deleteAccount(account.id)"
                  class="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div class="space-y-1 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Balance:</span>
                  <span class="font-medium">${{ formatCurrency(account.currentBalance) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">P&L:</span>
                  <span :class="[
                    'font-medium',
                    account.totalPnL >= 0 ? 'text-success-600' : 'text-danger-600'
                  ]">
                    {{ account.totalPnL >= 0 ? '+' : '' }}${{ formatCurrency(Math.abs(account.totalPnL)) }}
                    ({{ account.totalPnLPercent.toFixed(2) }}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Account Overview -->
      <div v-if="paperTradingStore.currentAccount" class="mb-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <BaseCard title="Account Balance">
            <div class="text-center">
              <p class="text-3xl font-bold text-gray-900">
                ${{ formatCurrency(paperTradingStore.currentAccount.currentBalance) }}
              </p>
              <p class="text-sm text-gray-500 mt-1">Available Balance</p>
            </div>
          </BaseCard>

          <BaseCard title="Total P&L">
            <div class="text-center">
              <p :class="[
                'text-3xl font-bold',
                paperTradingStore.totalPnL >= 0 ? 'text-success-600' : 'text-danger-600'
              ]">
                {{ paperTradingStore.totalPnL >= 0 ? '+' : '' }}${{ formatCurrency(Math.abs(paperTradingStore.totalPnL)) }}
              </p>
              <p :class="[
                'text-sm mt-1',
                paperTradingStore.totalPnLPercent >= 0 ? 'text-success-600' : 'text-danger-600'
              ]">
                {{ paperTradingStore.totalPnLPercent >= 0 ? '+' : '' }}{{ paperTradingStore.totalPnLPercent.toFixed(2) }}%
              </p>
            </div>
          </BaseCard>

          <BaseCard title="Portfolio Value">
            <div class="text-center">
              <p class="text-3xl font-bold text-gray-900">
                ${{ formatCurrency(paperTradingStore.totalPortfolioValue) }}
              </p>
              <p class="text-sm text-gray-500 mt-1">Total Value</p>
            </div>
          </BaseCard>

          <BaseCard title="Active Orders">
            <div class="text-center">
              <p class="text-3xl font-bold text-primary-600">
                {{ paperTradingStore.activeOrdersCount }}
              </p>
              <p class="text-sm text-gray-500 mt-1">Open Orders</p>
            </div>
          </BaseCard>
        </div>
      </div>

      <!-- Trading Interface -->
      <div v-if="paperTradingStore.currentAccount" class="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-8">
        <!-- Order Form -->
        <div class="xl:col-span-1">
          <BaseCard title="Place Paper Order">
            <form @submit.prevent="handlePlaceOrder" class="space-y-4">
              <!-- Symbol Input -->
              <BaseInput
                v-model="orderForm.symbol"
                label="Trading Pair"
                placeholder="BTC/USDT"
                required
                hint="Enter symbol in format: BTC/USDT"
              />

              <!-- Order Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
                <select v-model="orderForm.type" class="input" required>
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </div>

              <!-- Side Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Side</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    @click="orderForm.side = 'buy'"
                    :class="[
                      'px-4 py-2 rounded-lg border-2 font-medium transition-colors',
                      orderForm.side === 'buy'
                        ? 'border-success-500 bg-success-50 text-success-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    ]"
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    @click="orderForm.side = 'sell'"
                    :class="[
                      'px-4 py-2 rounded-lg border-2 font-medium transition-colors',
                      orderForm.side === 'sell'
                        ? 'border-danger-500 bg-danger-50 text-danger-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    ]"
                  >
                    Sell
                  </button>
                </div>
              </div>

              <!-- Amount -->
              <BaseInput
                v-model="orderForm.amount"
                type="number"
                step="0.00000001"
                label="Amount"
                placeholder="0.001"
                required
              />

              <!-- Price (for limit orders) -->
              <BaseInput
                v-if="orderForm.type === 'limit'"
                v-model="orderForm.price"
                type="number"
                step="0.01"
                label="Price"
                placeholder="50000.00"
                required
              />

              <BaseButton
                type="submit"
                :variant="orderForm.side === 'buy' ? 'success' : 'danger'"
                :loading="paperTradingStore.loading"
                fullWidth
              >
                {{ paperTradingStore.loading ? 'Placing Order...' : 
                   `${orderForm.side === 'buy' ? 'Buy' : 'Sell'} ${orderForm.symbol || 'Asset'}` }}
              </BaseButton>
            </form>
          </BaseCard>
        </div>

        <!-- Market Data -->
        <div class="xl:col-span-3">
          <MarketDataPanel @symbol-selected="handleSymbolSelected" />
        </div>
      </div>

      <!-- Virtual Balances -->
      <div v-if="paperTradingStore.currentAccount && paperTradingStore.balances.length > 0" class="mb-8">
        <BaseCard title="Virtual Balances">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Currency
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Available
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Price
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unrealized P&L
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="balance in paperTradingStore.balances" :key="balance.currency">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ balance.currency }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ formatNumber(balance.total) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ formatNumber(balance.available) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${{ formatCurrency(balance.averagePrice) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${{ formatCurrency(balance.totalCost) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span :class="[
                      'font-medium',
                      balance.unrealizedPnL >= 0 ? 'text-success-600' : 'text-danger-600'
                    ]">
                      {{ balance.unrealizedPnL >= 0 ? '+' : '' }}${{ formatCurrency(Math.abs(balance.unrealizedPnL)) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>

      <!-- Active Orders Table -->
      <div v-if="paperTradingStore.currentAccount" class="mb-8">
        <BaseCard title="Active Paper Orders">
          <div v-if="paperTradingStore.activeOrders.length === 0" class="text-center py-8">
            <p class="text-gray-500">No active orders</p>
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Side
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="order in paperTradingStore.activeOrders" :key="order.id">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ order.symbol }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ order.type.toUpperCase() }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span :class="[
                      'px-2 py-1 rounded text-xs font-medium',
                      order.side === 'buy' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
                    ]">
                      {{ order.side.toUpperCase() }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ formatNumber(order.amount) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ order.type === 'market' ? 'Market' : `$${formatCurrency(order.price || 0)}` }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span :class="[
                      'px-2 py-1 rounded text-xs font-medium',
                      order.status === 'open' ? 'bg-blue-100 text-blue-800' : 
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    ]">
                      {{ order.status.toUpperCase() }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <BaseButton
                      size="sm"
                      variant="danger"
                      @click="cancelOrder(order.id)"
                      :loading="paperTradingStore.loading"
                    >
                      Cancel
                    </BaseButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>

      <!-- Create Account Modal -->
      <BaseModal v-model="showCreateAccountModal" title="Create Paper Trading Account">
        <form @submit.prevent="createAccount" class="space-y-4">
          <BaseInput
            v-model="newAccountForm.name"
            label="Account Name"
            placeholder="My Trading Account"
            required
          />
          <BaseInput
            v-model="newAccountForm.initialBalance"
            type="number"
            step="100"
            label="Initial Balance (USD)"
            placeholder="10000"
            required
          />
          <div class="flex justify-end space-x-3">
            <BaseButton variant="secondary" @click="showCreateAccountModal = false">
              Cancel
            </BaseButton>
            <BaseButton
              type="submit"
              variant="primary"
              :loading="paperTradingStore.loading"
            >
              Create Account
            </BaseButton>
          </div>
        </form>
      </BaseModal>

      <!-- Reset Account Modal -->
      <BaseModal v-model="showResetModal" title="Reset Account">
        <div class="space-y-4">
          <p class="text-gray-600">
            Are you sure you want to reset your paper trading account? 
            This will clear all positions, orders, and trade history, and restore your initial balance.
          </p>
          <div class="flex justify-end space-x-3">
            <BaseButton variant="secondary" @click="showResetModal = false">
              Cancel
            </BaseButton>
            <BaseButton
              variant="danger"
              @click="resetAccount"
              :loading="paperTradingStore.loading"
            >
              Reset Account
            </BaseButton>
          </div>
        </div>
      </BaseModal>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { usePaperTradingStore } from '@/stores/paperTrading'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import MarketDataPanel from '@/components/trading/MarketDataPanel.vue'
import type { OrderRequest } from '@/types'

const paperTradingStore = usePaperTradingStore()

const showCreateAccountModal = ref(false)
const showResetModal = ref(false)

const orderForm = reactive<OrderRequest & { price: number }>({
  symbol: '',
  type: 'market',
  side: 'buy',
  amount: 0,
  exchange: 'paper', // Paper trading uses virtual exchange
  price: 0,
})

const newAccountForm = reactive({
  name: '',
  initialBalance: 10000,
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

const handleSymbolSelected = (symbol: string) => {
  orderForm.symbol = symbol
}

const selectAccount = async (accountId: string) => {
  await paperTradingStore.selectAccount(accountId)
}

const createAccount = async () => {
  const success = await paperTradingStore.createAccount(
    newAccountForm.name,
    newAccountForm.initialBalance
  )
  
  if (success) {
    showCreateAccountModal.value = false
    newAccountForm.name = ''
    newAccountForm.initialBalance = 10000
  }
}

const resetAccount = async () => {
  if (!paperTradingStore.currentAccount) return
  
  const success = await paperTradingStore.resetAccount(paperTradingStore.currentAccount.id)
  
  if (success) {
    showResetModal.value = false
  }
}

const deleteAccount = async (accountId: string) => {
  if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
    await paperTradingStore.deleteAccount(accountId)
  }
}

const handlePlaceOrder = async () => {
  if (!orderForm.symbol) {
    alert('Please enter a trading pair')
    return
  }

  if (!orderForm.amount || orderForm.amount <= 0) {
    alert('Please enter a valid amount')
    return
  }

  if (orderForm.type === 'limit' && (!orderForm.price || orderForm.price <= 0)) {
    alert('Please enter a valid price for limit order')
    return
  }

  // Prepare order request
  const orderRequest: OrderRequest = {
    symbol: orderForm.symbol,
    type: orderForm.type,
    side: orderForm.side,
    amount: orderForm.amount,
    exchange: 'paper',
    ...(orderForm.type === 'limit' && { price: orderForm.price }),
  }

  const result = await paperTradingStore.placeOrder(orderRequest)
  
  if (result.success) {
    alert(`Paper order placed successfully!\\n\\nType: ${orderForm.type}\\nSide: ${orderForm.side}\\nSymbol: ${orderForm.symbol}\\nAmount: ${orderForm.amount}`)
    
    // Reset form
    orderForm.amount = 0
    orderForm.price = 0
  } else {
    alert(`Failed to place order: ${result.error}`)
  }
}

const cancelOrder = async (orderId: string) => {
  if (confirm('Are you sure you want to cancel this order?')) {
    await paperTradingStore.cancelOrder(orderId)
  }
}

onMounted(async () => {
  await paperTradingStore.fetchAccounts()
})
</script>
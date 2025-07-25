<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="$emit('click')"
  >
    <div v-if="loading" class="flex items-center">
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {{ loadingText || 'Loading...' }}
    </div>
    <div v-else class="flex items-center justify-center">
      <slot />
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'success' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
})

defineEmits<{
  click: []
}>()

const buttonClasses = computed(() => [
  'btn',
  `btn-${props.variant}`,
  {
    'px-3 py-1.5 text-sm': props.size === 'sm',
    'px-4 py-2': props.size === 'md',
    'px-6 py-3 text-lg': props.size === 'lg',
    'w-full': props.fullWidth,
    'opacity-50 cursor-not-allowed': props.disabled || props.loading,
  },
])
</script>
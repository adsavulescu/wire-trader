<template>
  <div :class="cardClasses">
    <div v-if="title || $slots.header" class="border-b border-gray-200 pb-4 mb-4">
      <slot name="header">
        <h3 v-if="title" class="text-lg font-medium text-gray-900">
          {{ title }}
        </h3>
      </slot>
    </div>
    
    <div class="flex-1">
      <slot />
    </div>
    
    <div v-if="$slots.footer" class="border-t border-gray-200 pt-4 mt-4">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title?: string
  padding?: boolean
  shadow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  padding: true,
  shadow: true,
})

const cardClasses = computed(() => [
  'card',
  {
    'p-0': !props.padding,
    'shadow-none border border-gray-200': !props.shadow,
  },
])
</script>
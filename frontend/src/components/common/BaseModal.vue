<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <!-- Background overlay -->
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          @click="closeModal"
        ></div>

        <!-- This element is to trick the browser into centering the modal contents. -->
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <!-- Modal panel -->
        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <!-- Modal Title -->
                <h3
                  v-if="title"
                  class="text-lg leading-6 font-medium text-gray-900 mb-4"
                  id="modal-title"
                >
                  {{ title }}
                </h3>

                <!-- Modal Content -->
                <div class="mt-2">
                  <slot></slot>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer slot (optional) -->
          <div v-if="$slots.footer" class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  closeOnClickOutside?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  closeOnClickOutside: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const closeModal = () => {
  if (props.closeOnClickOutside) {
    emit('update:modelValue', false)
  }
}

// Handle escape key
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        emit('update:modelValue', false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }
})
</script>
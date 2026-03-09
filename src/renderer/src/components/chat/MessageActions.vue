<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Copy, Pencil, RotateCw } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    role: 'user' | 'assistant'
    isStreaming?: boolean
    copied?: boolean
  }>(),
  { isStreaming: false, copied: false }
)

const emit = defineEmits<{
  copy: []
  regenerate: []
  edit: []
}>()

function onCopy(): void {
  emit('copy')
}

function onRegenerate(): void {
  emit('regenerate')
}

function onEdit(): void {
  emit('edit')
}
</script>

<template>
  <div
    class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
  >
    <Button
      variant="ghost"
      size="sm"
      :aria-label="copied ? 'Copied' : 'Copy'"
      @click="onCopy"
    >
      <span v-if="copied">Copied</span>
      <Copy v-else class="size-4" />
    </Button>
    <Button v-if="role === 'user'" variant="ghost" size="sm" aria-label="Edit" @click="onEdit">
      <Pencil class="size-4" />
    </Button>
    <Button
      v-if="role === 'assistant'"
      variant="ghost"
      size="sm"
      aria-label="Regenerate"
      :disabled="isStreaming"
      @click="onRegenerate"
    >
      <RotateCw class="size-4" />
    </Button>
  </div>
</template>

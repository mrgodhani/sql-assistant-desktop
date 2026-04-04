<script setup lang="ts">
import { ref, computed } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@renderer/components/shared/LoadingSpinner.vue'
import { useDesignerStore } from '@renderer/stores/useDesignerStore'

const store = useDesignerStore()

const prompt = ref('')
const promptHistory = ref<string[]>([])

const canGenerate = computed(() => prompt.value.trim().length > 0 && !store.generating)

async function handleGenerate(): Promise<void> {
  const text = prompt.value.trim()
  if (!text) return

  await store.generateFromPrompt(text)

  if (!store.generateError) {
    promptHistory.value = [text, ...promptHistory.value].slice(0, 3)
    prompt.value = ''
  }
}

function onKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    handleGenerate()
  }
}

function applyHistoryChip(text: string): void {
  prompt.value = text
}
</script>

<template>
  <div class="flex flex-col gap-3 p-4 h-full border-r border-border bg-background">
    <div class="flex items-center gap-2">
      <Sparkles class="size-4 text-primary" />
      <span class="text-sm font-medium">Describe your schema</span>
    </div>

    <textarea
      v-model="prompt"
      class="flex-1 min-h-[120px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      placeholder="Describe your schema in plain English…&#10;e.g. 'A blog with users, posts, and comments. Users can have many posts.'"
      data-testid="nl-textarea"
      @keydown="onKeydown"
    />

    <div class="flex flex-col gap-2">
      <Button
        :disabled="!canGenerate"
        class="w-full gap-2"
        data-testid="generate-button"
        @click="handleGenerate"
      >
        <LoadingSpinner v-if="store.generating" size="sm" />
        <Sparkles v-else class="size-4" />
        {{ store.generating ? 'Generating…' : 'Generate' }}
      </Button>

      <p class="text-[11px] text-muted-foreground text-center">⌘ Enter to generate</p>
    </div>

    <div
      v-if="store.generateError"
      class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      data-testid="generate-error"
    >
      {{ store.generateError }}
    </div>

    <div v-if="promptHistory.length > 0" class="flex flex-col gap-1.5">
      <p class="text-[11px] text-muted-foreground">Recent</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="item in promptHistory"
          :key="item"
          class="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/80 truncate max-w-full cursor-pointer"
          :title="item"
          data-testid="history-chip"
          @click="applyHistoryChip(item)"
        >
          {{ item.length > 40 ? item.slice(0, 37) + '…' : item }}
        </button>
      </div>
    </div>
  </div>
</template>

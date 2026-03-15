<script setup lang="ts">
import { computed } from 'vue'
import { TableProperties, BarChart3, GitMerge } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@renderer/stores/useChatStore'

const chatStore = useChatStore()

const hasConnection = computed(() => Boolean(chatStore.activeConnectionId))

const categories = [
  {
    label: 'Schema Exploration',
    icon: TableProperties,
    prompts: [
      'List all tables with their column counts and data types',
      'Show foreign key relationships between tables'
    ]
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    prompts: [
      'Show monthly trends with year-over-year comparison',
      'Calculate running totals and moving averages'
    ]
  },
  {
    label: 'Joins & Relationships',
    icon: GitMerge,
    prompts: [
      'Find all orders with customer details and product names',
      'Show users who have never placed an order'
    ]
  }
] as const

function selectPrompt(text: string): void {
  chatStore.inputContentForEdit = text
}
</script>

<template>
  <div class="flex flex-col items-center gap-6 px-6 py-8">
    <div class="text-center">
      <h2 class="text-lg font-semibold text-foreground">What would you like to explore?</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{
          hasConnection
            ? 'Pick an example or type your own question below'
            : 'Select a connection above to get started'
        }}
      </p>
    </div>

    <div class="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="category in categories" :key="category.label" class="flex flex-col gap-2">
        <div class="flex items-center gap-2 text-muted-foreground">
          <component :is="category.icon" class="size-4 shrink-0" />
          <span class="text-xs font-medium uppercase tracking-wide">
            {{ category.label }}
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <Button
            v-for="prompt in category.prompts"
            :key="prompt"
            variant="outline"
            class="h-auto justify-start whitespace-normal px-3 py-2 text-left text-xs font-normal leading-snug"
            :disabled="!hasConnection"
            @click="selectPrompt(prompt)"
          >
            {{ prompt }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

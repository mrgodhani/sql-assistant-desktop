<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Loader2, User, Bot } from 'lucide-vue-next'
import DDLApprovalCard from './DDLApprovalCard.vue'
import type { DesignerMessage } from '@renderer/stores/useSchemaDesignerStore'

const props = defineProps<{
  message: DesignerMessage
}>()

const emit = defineEmits<{
  approve: [approved: boolean]
}>()

const isUser = computed(() => props.message.role === 'user')
</script>

<template>
  <div :class="['flex w-full', isUser ? 'justify-end' : 'justify-start']">
    <div :class="['flex max-w-[90%] min-w-0 gap-3', isUser ? 'flex-row-reverse' : 'flex-row']">
      <div
        :class="[
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        ]"
      >
        <User v-if="isUser" class="size-3.5" />
        <Bot v-else class="size-3.5" />
      </div>
      <div class="min-w-0 flex-1 space-y-2">
        <div
          :class="[
            'rounded-lg px-4 py-3 text-sm',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          ]"
        >
          <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
        </div>

        <div
          v-if="message.toolIndicator"
          class="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader2 class="size-3 animate-spin" />
          <span>{{ message.toolIndicator }}</span>
        </div>

        <div v-if="message.changelog?.length" class="flex flex-wrap gap-1.5">
          <Badge
            v-for="(change, i) in message.changelog"
            :key="i"
            variant="secondary"
            class="text-xs"
          >
            {{ change }}
          </Badge>
        </div>

        <DDLApprovalCard
          v-if="message.ddlStatements?.length"
          :statements="message.ddlStatements"
          :awaiting-approval="message.awaitingApproval ?? false"
          @approve="(approved) => emit('approve', approved)"
        />
      </div>
    </div>
  </div>
</template>

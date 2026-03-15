<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { ChatMessage as ChatMessageType } from '../../../../shared/types'
import ChatMessage from './ChatMessage.vue'
import { useChatStore } from '@renderer/stores/useChatStore'

const VIRTUAL_THRESHOLD = 20
const ESTIMATE_SIZE = 200

const chatStore = useChatStore()
const scrollContainerRef = ref<HTMLDivElement | null>(null)
const messagesEndRef = ref<HTMLElement | null>(null)

interface PairItem {
  message: ChatMessageType
  originalIndex: number
}

const messagePairs = computed<PairItem[][]>(() => {
  const msgs = chatStore.currentConversation?.messages ?? []
  const pairs: PairItem[][] = []
  let current: PairItem[] = []

  for (let idx = 0; idx < msgs.length; idx++) {
    const m = msgs[idx]
    const item: PairItem = { message: m, originalIndex: idx }
    if (m.role === 'user') {
      if (current.length > 0) {
        pairs.push([...current])
        current = []
      }
      current.push(item)
    } else {
      if (current.length > 0) {
        current.push(item)
        pairs.push([...current])
        current = []
      } else {
        pairs.push([item])
      }
    }
  }
  if (current.length > 0) pairs.push(current)
  return pairs
})

const useVirtual = computed(() => messagePairs.value.length > VIRTUAL_THRESHOLD)

const virtualizerOptions = computed(() => ({
  count: messagePairs.value.length,
  getScrollElement: () => scrollContainerRef.value,
  estimateSize: () => ESTIMATE_SIZE,
  overscan: 5
}))

const virtualizer = useVirtualizer(virtualizerOptions)

function scrollToBottom(): void {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

watch(
  () => [
    chatStore.currentConversation?.messages.length,
    chatStore.streamingState?.accumulatedContent
  ],
  scrollToBottom,
  { deep: true }
)
</script>

<template>
  <div ref="scrollContainerRef" class="flex-1 overflow-y-auto px-6 py-4">
    <div class="space-y-8">
      <template v-if="!useVirtual">
        <div v-for="(pair, pairIdx) in messagePairs" :key="pairIdx" class="space-y-8">
          <ChatMessage
            v-for="(item, i) in pair"
            :key="`${pairIdx}-${i}`"
            :message="item.message"
            :message-index="item.originalIndex"
            :is-streaming="
              chatStore.streamingState !== null &&
              chatStore.streamingState.messageIndex === item.originalIndex
            "
          />
        </div>
      </template>
      <div
        v-else
        :style="{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%'
        }"
      >
        <div
          v-for="virtualRow in virtualizer.getVirtualItems()"
          :key="String(virtualRow.key)"
          class="absolute left-0 w-full space-y-8"
          :style="{
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`
          }"
        >
          <ChatMessage
            v-for="(item, i) in messagePairs[virtualRow.index]"
            :key="i"
            :message="item.message"
            :message-index="item.originalIndex"
            :is-streaming="
              chatStore.streamingState !== null &&
              chatStore.streamingState.messageIndex === item.originalIndex
            "
          />
        </div>
      </div>
      <div ref="messagesEndRef" />
    </div>
  </div>
</template>

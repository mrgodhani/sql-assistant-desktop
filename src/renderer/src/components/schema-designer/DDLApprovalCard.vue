<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Play, X } from 'lucide-vue-next'

defineProps<{
  statements: string[]
  awaitingApproval: boolean
}>()

const emit = defineEmits<{
  approve: [approved: boolean]
}>()
</script>

<template>
  <Card class="border-amber-500/50 bg-amber-500/5">
    <CardContent class="p-4">
      <div class="flex items-center gap-2 text-amber-500 mb-3">
        <AlertTriangle class="size-4" />
        <span class="text-sm font-medium">DDL Execution Review</span>
      </div>
      <div class="rounded bg-muted p-3 max-h-60 overflow-auto">
        <pre class="text-xs font-mono whitespace-pre-wrap text-foreground">{{ statements.join('\n\n') }}</pre>
      </div>
      <div v-if="awaitingApproval" class="flex gap-2 mt-3">
        <Button
          size="sm"
          class="bg-green-600 hover:bg-green-700 text-white"
          @click="emit('approve', true)"
        >
          <Play class="size-3 mr-1" />
          Execute
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="border-destructive text-destructive hover:bg-destructive/10"
          @click="emit('approve', false)"
        >
          <X class="size-3 mr-1" />
          Cancel
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

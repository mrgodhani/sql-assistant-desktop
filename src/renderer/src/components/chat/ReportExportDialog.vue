<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  open: boolean
  canIncludeChart: boolean
  defaultTitle?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', payload: { title: string; logoPath?: string; includeChart: boolean }): void
}>()

const title = ref('')
const logoPath = ref<string | undefined>()
const includeChart = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      title.value = props.defaultTitle ?? 'Report'
      logoPath.value = undefined
      includeChart.value = props.canIncludeChart
    }
  }
)

watch(
  () => props.defaultTitle,
  (v) => {
    if (props.open && v) title.value = v
  }
)

async function pickLogo(): Promise<void> {
  const path = await window.exportApi.showOpenDialog(
    JSON.stringify({ filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }] })
  )
  if (path) logoPath.value = path
}

function cancel(): void {
  emit('update:open', false)
}

function confirm(): void {
  emit('confirm', {
    title: title.value.trim() || 'Report',
    logoPath: logoPath.value,
    includeChart: includeChart.value && props.canIncludeChart
  })
  emit('update:open', false)
}
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Export Report</AlertDialogTitle>
        <AlertDialogDescription>
          Configure report options. The report will include headers, footers, and optional branding.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <Label for="report-title">Report title</Label>
          <Input id="report-title" v-model="title" placeholder="Report" maxlength="200" />
        </div>
        <div class="grid gap-2">
          <Label>Logo (optional)</Label>
          <div class="flex gap-2">
            <Button type="button" variant="outline" size="sm" @click="pickLogo">
              {{ logoPath ? 'Change logo' : 'Select logo' }}
            </Button>
            <span v-if="logoPath" class="truncate text-sm text-muted-foreground">
              {{ logoPath.split(/[/\\]/).pop() }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input
            id="include-chart"
            v-model="includeChart"
            type="checkbox"
            :disabled="!canIncludeChart"
            class="size-4 rounded border-input"
          />
          <Label for="include-chart" :class="{ 'opacity-50': !canIncludeChart }">
            Include chart
          </Label>
        </div>
        <p v-if="!canIncludeChart" class="text-xs text-muted-foreground">
          No numeric columns to chart
        </p>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel @click="cancel">Cancel</AlertDialogCancel>
        <AlertDialogAction @click="confirm"> Export Report </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

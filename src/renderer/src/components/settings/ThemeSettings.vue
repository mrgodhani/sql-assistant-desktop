<script setup lang="ts">
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import type { ThemeMode } from '@renderer/stores/useSettingsStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const settingsStore = useSettingsStore()

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Follow system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

function onThemeChange(value: unknown): void {
  if (value === 'system' || value === 'light' || value === 'dark') {
    settingsStore.setTheme(value)
  }
}
</script>

<template>
  <div data-testid="theme-settings">
    <h3 class="text-sm font-medium">Appearance</h3>
    <div class="mt-3 flex items-center justify-between">
      <Label for="theme-select">Theme</Label>
      <Select :model-value="settingsStore.theme" @update:model-value="onThemeChange">
        <SelectTrigger id="theme-select" class="w-[160px]" data-testid="theme-select">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in THEME_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>

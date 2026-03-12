<script setup lang="ts">
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import type { ThemeMode } from '@renderer/stores/useSettingsStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  <Card data-testid="theme-settings">
    <CardHeader>
      <CardTitle>Appearance</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex items-center justify-between">
        <Label for="theme-select">Theme</Label>
        <Select :model-value="settingsStore.theme" @update:model-value="onThemeChange">
          <SelectTrigger id="theme-select" class="w-[140px]" data-testid="theme-select">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in THEME_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardContent>
  </Card>
</template>

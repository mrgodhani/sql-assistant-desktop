<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

const settingsStore = useSettingsStore()

const isDark = computed(() => settingsStore.theme === 'dark')

function onToggle(): void {
  settingsStore.toggleTheme()
}
</script>

<template>
  <Card data-testid="theme-settings">
    <CardHeader>
      <CardTitle>Appearance</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex items-center justify-between">
        <Label for="dark-mode-switch" class="cursor-pointer">Dark Mode</Label>
        <Switch
          id="dark-mode-switch"
          :checked="isDark"
          data-testid="theme-toggle-switch"
          @update:checked="onToggle"
        />
      </div>
    </CardContent>
  </Card>
</template>

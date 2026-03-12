<script setup lang="ts">
import { useSettingsStore } from '@renderer/stores/useSettingsStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ActiveProviderBadge from './ActiveProviderBadge.vue'
import CloudProviderTab from './CloudProviderTab.vue'
import OllamaSettings from './OllamaSettings.vue'

const settingsStore = useSettingsStore()
</script>

<template>
  <Card data-testid="provider-settings">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle>AI Providers</CardTitle>
          <CardDescription>Configure API keys and models for AI providers</CardDescription>
        </div>
        <ActiveProviderBadge />
      </div>
    </CardHeader>
    <CardContent>
      <Tabs :default-value="settingsStore.activeProvider">
        <TabsList class="grid w-full grid-cols-5">
          <TabsTrigger value="openai" data-testid="provider-tab-trigger-openai">
            OpenAI
          </TabsTrigger>
          <TabsTrigger value="anthropic" data-testid="provider-tab-trigger-anthropic">
            Anthropic
          </TabsTrigger>
          <TabsTrigger value="google" data-testid="provider-tab-trigger-google">
            Google
          </TabsTrigger>
          <TabsTrigger value="openrouter" data-testid="provider-tab-trigger-openrouter">
            OpenRouter
          </TabsTrigger>
          <TabsTrigger value="ollama" data-testid="provider-tab-trigger-ollama">
            Ollama
          </TabsTrigger>
        </TabsList>
        <TabsContent value="openai">
          <CloudProviderTab provider="openai" />
        </TabsContent>
        <TabsContent value="anthropic">
          <CloudProviderTab provider="anthropic" />
        </TabsContent>
        <TabsContent value="google">
          <CloudProviderTab provider="google" />
        </TabsContent>
        <TabsContent value="openrouter">
          <CloudProviderTab provider="openrouter" />
        </TabsContent>
        <TabsContent value="ollama">
          <OllamaSettings />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>

# AI Temperature Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global AI temperature slider (0.0–1.0, default 0.3) that persists in the settings database and is passed to all five provider adapters on every AI request.

**Architecture:** Temperature is stored as a plain settings key `'temperature'` in the SQLite settings table. `settingsService.getAll()` reads and sanitises it; `AIService.chatStream()` fetches it and passes it as an optional parameter to the provider adapter, which injects it into the request body. The renderer exposes a slider in a new `AIBehaviorSettings.vue` component.

**Tech Stack:** Electron, Node.js (main), Vue 3 + TypeScript (renderer), Pinia, Vitest + happy-dom (tests), Tailwind CSS, shadcn-vue component library.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/types.ts` | Modify | Add `DEFAULT_TEMPERATURE` constant and `temperature` field to `AppSettings` |
| `src/main/services/settings.service.ts` | Modify | Read, sanitise, and return `temperature` in `getAll()` |
| `src/main/services/ai/types.ts` | Modify | Add optional `temperature?: number` to `ProviderAdapter.chatStream` |
| `src/main/services/ai.service.ts` | Modify | Read temperature from settings; pass to adapter |
| `src/main/services/ai/openai.adapter.ts` | Modify | Inject `temperature` in request body |
| `src/main/services/ai/anthropic.adapter.ts` | Modify | Inject `temperature` in request body |
| `src/main/services/ai/google.adapter.ts` | Modify | Merge `temperature` into `generationConfig` |
| `src/main/services/ai/ollama.adapter.ts` | Modify | Inject `temperature` in `options` object |
| `src/main/services/ai/openrouter.adapter.ts` | Modify | Inject `temperature` in request body |
| `src/renderer/src/stores/useSettingsStore.ts` | Modify | Add `temperature` reactive state, load from `getAll()`, expose `setTemperature` action |
| `src/renderer/src/components/settings/AIBehaviorSettings.vue` | Create | Slider UI with live hint + persistence |
| `src/renderer/src/components/layout/SettingsSheet.vue` | Modify | Include `AIBehaviorSettings` in the settings panel |

---

## Task 1: Shared Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add `DEFAULT_TEMPERATURE` and update `AppSettings`**

  In `src/shared/types.ts`, find the `AppSettings` interface (around line 240) and the section just above `DEFAULT_PROVIDER_CONFIGS`. Make these two changes:

  After the existing `export type ThemeMode = ...` line, add:

  ```typescript
  export const DEFAULT_TEMPERATURE = 0.3
  ```

  Inside `AppSettings`, add `temperature` after `activeModel`:

  ```typescript
  export interface AppSettings {
    theme: ThemeMode
    activeProvider: AIProvider
    activeModel: string
    temperature: number
    providerConfigs: Record<AIProvider, ProviderConfig>
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: errors only about the newly missing `temperature` field downstream — these are fixed in subsequent tasks. Zero errors once all tasks are done.

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/types.ts
  git commit -m "feat: add DEFAULT_TEMPERATURE and temperature field to AppSettings"
  ```

---

## Task 2: Settings Service — Read & Sanitise Temperature

**Files:**
- Modify: `src/main/services/settings.service.ts`

- [ ] **Step 1: Update `getAll()` to read, sanitise, and return temperature**

  In `src/main/services/settings.service.ts`, add `DEFAULT_TEMPERATURE` to the import from shared types:

  ```typescript
  import { DEFAULT_PROVIDER_CONFIGS, AI_PROVIDERS, DEFAULT_TEMPERATURE } from '../../shared/types'
  ```

  In `getAll()`, after the `activeModel` line, add:

  ```typescript
  const temperatureRaw = await this.get('temperature')
  const temperatureParsed = temperatureRaw !== null ? parseFloat(temperatureRaw) : NaN
  const temperature = isNaN(temperatureParsed)
    ? DEFAULT_TEMPERATURE
    : Math.min(1, Math.max(0, temperatureParsed))
  ```

  Then include `temperature` in the returned object:

  ```typescript
  return { theme, activeProvider, activeModel, temperature, providerConfigs }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main/services/settings.service.ts
  git commit -m "feat: read and sanitise temperature in settingsService.getAll()"
  ```

---

## Task 3: Provider Adapter Interface — Optional Temperature Parameter

**Files:**
- Modify: `src/main/services/ai/types.ts`

- [ ] **Step 1: Add optional `temperature` to `ProviderAdapter.chatStream`**

  In `src/main/services/ai/types.ts`, update the `ProviderAdapter` interface's `chatStream` signature to add `temperature` as the last optional parameter:

  ```typescript
  export interface ProviderAdapter {
    chatStream(
      messages: ChatMessage[],
      model: string,
      systemPrompt: string,
      apiKey: string,
      baseUrl: string,
      signal: AbortSignal,
      onChunk: (text: string) => void,
      temperature?: number
    ): Promise<void>

    listModels(apiKey: string, baseUrl: string): Promise<string[]>

    chatWithTools?(
      params: ChatWithToolsParams,
      apiKey: string,
      baseUrl: string,
      onTextChunk: (text: string) => void,
      signal: AbortSignal
    ): Promise<ToolCallResponse>
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main/services/ai/types.ts
  git commit -m "feat: add optional temperature param to ProviderAdapter.chatStream"
  ```

---

## Task 4: AI Service — Fetch Temperature and Pass to Adapter

**Files:**
- Modify: `src/main/services/ai.service.ts`

- [ ] **Step 1: Add `DEFAULT_TEMPERATURE` import**

  In `src/main/services/ai.service.ts`, update the shared types import:

  ```typescript
  import type { AIProvider, AIChatParams, StreamChunk, ChatMessage } from '../../shared/types'
  import { DEFAULT_PROVIDER_CONFIGS, DEFAULT_TEMPERATURE } from '../../shared/types'
  ```

- [ ] **Step 2: Read temperature and pass to adapter in `chatStream()`**

  Inside `AIService.chatStream()`, after the existing `const baseUrl = ...` line, add:

  ```typescript
  const allSettings = await settingsService.getAll()
  const temperature = allSettings.temperature ?? DEFAULT_TEMPERATURE
  ```

  Then update the `adapter.chatStream(...)` call to pass `temperature` as the last argument:

  ```typescript
  await adapter.chatStream(
    messages,
    model,
    systemPrompt,
    apiKey,
    baseUrl,
    controller.signal,
    (text: string) => {
      watchdog.reset()
      sendChunk({ requestId, chunk: text, done: false })
    },
    temperature
  )
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/main/services/ai.service.ts
  git commit -m "feat: read temperature from settings and pass to adapter"
  ```

---

## Task 5: OpenAI Adapter — Inject Temperature

**Files:**
- Modify: `src/main/services/ai/openai.adapter.ts`

- [ ] **Step 1: Add `temperature` parameter and inject into request body**

  Update the `chatStream` function signature (line 6) to accept `temperature`:

  ```typescript
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk, temperature) {
  ```

  Update the `body` in the `fetch` call:

  ```typescript
  body: JSON.stringify({ model, messages: allMessages, stream: true, temperature }),
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main/services/ai/openai.adapter.ts
  git commit -m "feat: pass temperature to OpenAI chat completions request"
  ```

---

## Task 6: Anthropic Adapter — Inject Temperature

**Files:**
- Modify: `src/main/services/ai/anthropic.adapter.ts`

- [ ] **Step 1: Add `temperature` parameter and inject into request body**

  Update the `chatStream` function signature (line 88) to accept `temperature`:

  ```typescript
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk, temperature) {
  ```

  Update the `body` in the `fetch` call (keep `max_tokens: 4096` unchanged):

  ```typescript
  body: JSON.stringify({
    model,
    system: systemPrompt,
    messages: filteredMessages,
    max_tokens: 4096,
    stream: true,
    temperature
  }),
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main/services/ai/anthropic.adapter.ts
  git commit -m "feat: pass temperature to Anthropic messages request"
  ```

---

## Task 7: Google Adapter — Merge Temperature into generationConfig

**Files:**
- Modify: `src/main/services/ai/google.adapter.ts`

- [ ] **Step 1: Add `temperature` parameter and merge into `generationConfig`**

  Update the `chatStream` function signature (line 87) to accept `temperature`:

  ```typescript
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk, temperature) {
  ```

  Update the `body` in the `fetch` call — merge `temperature` into the existing `generationConfig` (do NOT remove `maxOutputTokens`):

  ```typescript
  body: JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { maxOutputTokens: 4096, temperature }
  }),
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main/services/ai/google.adapter.ts
  git commit -m "feat: pass temperature to Google Gemini generationConfig"
  ```

---

## Task 8: Ollama Adapter — Inject Temperature in options

**Files:**
- Modify: `src/main/services/ai/ollama.adapter.ts`

- [ ] **Step 1: Add `temperature` parameter and inject into `options`**

  Update the `chatStream` function signature (line 6) to accept `temperature`:

  ```typescript
  async chatStream(messages, model, systemPrompt, _apiKey, baseUrl, signal, onChunk, temperature) {
  ```

  Update the `body` in the `fetch` call:

  ```typescript
  body: JSON.stringify({ model, messages: allMessages, stream: true, options: { temperature } }),
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main/services/ai/ollama.adapter.ts
  git commit -m "feat: pass temperature to Ollama via options"
  ```

---

## Task 9: OpenRouter Adapter — Inject Temperature

**Files:**
- Modify: `src/main/services/ai/openrouter.adapter.ts`

- [ ] **Step 1: Add `temperature` parameter and inject into request body**

  Update the `chatStream` function signature (line 11) to accept `temperature`:

  ```typescript
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk, temperature) {
  ```

  Update the `body` in the `fetch` call:

  ```typescript
  body: JSON.stringify({ model, messages: allMessages, stream: true, temperature }),
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/main/services/ai/openrouter.adapter.ts
  git commit -m "feat: pass temperature to OpenRouter chat completions request"
  ```

---

## Task 10: Settings Store — Add Temperature State and Action

**Files:**
- Modify: `src/renderer/src/stores/useSettingsStore.ts`

- [ ] **Step 1: Add `DEFAULT_TEMPERATURE` to imports**

  Update the import from shared types:

  ```typescript
  import { DEFAULT_PROVIDER_CONFIGS, AI_PROVIDERS, PROVIDER_LABELS, DEFAULT_TEMPERATURE } from '../../../shared/types'
  ```

- [ ] **Step 2: Add `temperature` reactive ref**

  After the existing `const providerConfigs = ref(...)` line, add:

  ```typescript
  const temperature = ref<number>(DEFAULT_TEMPERATURE)
  ```

- [ ] **Step 3: Load temperature in `loadSettings()`**

  Inside `loadSettings()`, after `providerConfigs.value = settings.providerConfigs`, add:

  ```typescript
  temperature.value = settings.temperature
  ```

- [ ] **Step 4: Add `setTemperature` action**

  After the existing `refreshModels` function, add:

  ```typescript
  async function setTemperature(value: number): Promise<void> {
    temperature.value = value
    try {
      await window.api.settings.set('temperature', String(value))
    } catch (error) {
      log.error('[Settings] Failed to persist temperature:', error)
    }
  }
  ```

- [ ] **Step 5: Expose `temperature` and `setTemperature` in the return object**

  Add both to the `return { ... }` block:

  ```typescript
  return {
    theme,
    activeProvider,
    activeModel,
    temperature,
    providerConfigs,
    activeProviderConfig,
    isProviderConfigured,
    loadSettings,
    setTheme,
    setProvider,
    setModel,
    setTemperature,
    updateProviderConfig,
    validateApiKey,
    refreshModels
  }
  ```

- [ ] **Step 6: Write a Vitest unit test for the store**

  Create `src/renderer/src/stores/__tests__/useSettingsStore.temperature.spec.ts`:

  ```typescript
  import { setActivePinia, createPinia } from 'pinia'
  import { beforeEach, describe, it, expect, vi } from 'vitest'
  import { useSettingsStore } from '../useSettingsStore'
  import { DEFAULT_TEMPERATURE, DEFAULT_PROVIDER_CONFIGS } from '../../../../shared/types'

  const mockSet = vi.fn().mockResolvedValue(undefined)
  const mockGetAll = vi.fn()

  vi.stubGlobal('window', {
    api: {
      settings: {
        getAll: mockGetAll,
        set: mockSet,
        setTheme: vi.fn(),
        setProviderConfig: vi.fn(),
        getSystemTheme: vi.fn().mockResolvedValue('dark'),
        onSystemThemeChange: vi.fn(),
        validateApiKey: vi.fn(),
      }
    },
    aiApi: { listModels: vi.fn().mockResolvedValue([]) }
  })

  const baseSettings = {
    theme: 'dark' as const,
    activeProvider: 'ollama' as const,
    activeModel: 'llama3.2',
    providerConfigs: structuredClone(DEFAULT_PROVIDER_CONFIGS)
  }

  describe('useSettingsStore — temperature', () => {
    beforeEach(() => {
      setActivePinia(createPinia())
      vi.clearAllMocks()
    })

    it('defaults to DEFAULT_TEMPERATURE before loadSettings', () => {
      const store = useSettingsStore()
      expect(store.temperature).toBe(DEFAULT_TEMPERATURE)
    })

    it('loads temperature from getAll()', async () => {
      mockGetAll.mockResolvedValue({ ...baseSettings, temperature: 0.7 })
      const store = useSettingsStore()
      await store.loadSettings()
      expect(store.temperature).toBe(0.7)
    })

    it('falls back to DEFAULT_TEMPERATURE when getAll returns 0.3', async () => {
      mockGetAll.mockResolvedValue({ ...baseSettings, temperature: DEFAULT_TEMPERATURE })
      const store = useSettingsStore()
      await store.loadSettings()
      expect(store.temperature).toBe(DEFAULT_TEMPERATURE)
    })

    it('setTemperature updates store and persists via IPC', async () => {
      mockGetAll.mockResolvedValue({ ...baseSettings, temperature: DEFAULT_TEMPERATURE })
      const store = useSettingsStore()
      await store.loadSettings()
      await store.setTemperature(0.6)
      expect(store.temperature).toBe(0.6)
      expect(mockSet).toHaveBeenCalledWith('temperature', '0.6')
    })
  })
  ```

- [ ] **Step 7: Run the test**

  ```bash
  npx vitest run src/renderer/src/stores/__tests__/useSettingsStore.temperature.spec.ts
  ```

  Expected: 4 tests pass.

- [ ] **Step 8: Commit**

  ```bash
  git add src/renderer/src/stores/useSettingsStore.ts src/renderer/src/stores/__tests__/useSettingsStore.temperature.spec.ts
  git commit -m "feat: add temperature state and setTemperature action to useSettingsStore"
  ```

---

## Task 11: AIBehaviorSettings Component

**Files:**
- Create: `src/renderer/src/components/settings/AIBehaviorSettings.vue`

Note: The project does not have a shadcn-vue Slider component. Use a native `<input type="range">` with Tailwind styling, which matches how other unstyled controls are handled in the project.

- [ ] **Step 1: Create `AIBehaviorSettings.vue`**

  Create `src/renderer/src/components/settings/AIBehaviorSettings.vue` with this content:

  ```vue
  <script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useSettingsStore } from '@renderer/stores/useSettingsStore'
  import { Label } from '@/components/ui/label'

  const settingsStore = useSettingsStore()

  // Local draft: updates live on input, persisted on change.
  // Synced from store so it stays accurate if settings load after mount.
  const draft = ref(settingsStore.temperature)
  watch(() => settingsStore.temperature, (v) => { draft.value = v })

  const displayValue = computed(() => draft.value.toFixed(2))

  const hint = computed(() => {
    if (draft.value <= 0.2) return 'Precise — minimal variation, best for SQL generation'
    if (draft.value <= 0.5) return 'Balanced — reliable with slight flexibility'
    return 'Creative — more varied, less predictable responses'
  })

  function onInput(event: Event): void {
    draft.value = parseFloat((event.target as HTMLInputElement).value)
  }

  function onChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value)
    draft.value = value
    settingsStore.setTemperature(value)
  }
  </script>

  <template>
    <div data-testid="ai-behavior-settings">
      <h3 class="text-sm font-medium">AI Behavior</h3>
      <div class="mt-3 space-y-2">
        <div class="flex items-center justify-between">
          <Label for="temperature-slider">Response Style</Label>
          <span class="text-sm tabular-nums text-muted-foreground" data-testid="temperature-value">
            {{ displayValue }}
          </span>
        </div>
        <input
          id="temperature-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="draft"
          class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-secondary accent-primary"
          data-testid="temperature-slider"
          @input="onInput"
          @change="onChange"
        />
        <p class="text-xs text-muted-foreground" data-testid="temperature-hint">{{ hint }}</p>
      </div>
    </div>
  </template>
  ```

- [ ] **Step 2: Write a component test**

  Create `src/renderer/src/components/settings/__tests__/AIBehaviorSettings.spec.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { mount } from '@vue/test-utils'
  import { createPinia, setActivePinia } from 'pinia'
  import AIBehaviorSettings from '../AIBehaviorSettings.vue'
  import { useSettingsStore } from '@renderer/stores/useSettingsStore'
  import { DEFAULT_PROVIDER_CONFIGS } from '../../../../../shared/types'

  vi.stubGlobal('window', {
    api: {
      settings: {
        getAll: vi.fn().mockResolvedValue({
          theme: 'dark',
          activeProvider: 'ollama',
          activeModel: 'llama3.2',
          temperature: 0.3,
          providerConfigs: structuredClone(DEFAULT_PROVIDER_CONFIGS)
        }),
        set: vi.fn().mockResolvedValue(undefined),
        setTheme: vi.fn(),
        setProviderConfig: vi.fn(),
        getSystemTheme: vi.fn().mockResolvedValue('dark'),
        onSystemThemeChange: vi.fn(),
        validateApiKey: vi.fn()
      }
    },
    aiApi: { listModels: vi.fn().mockResolvedValue([]) }
  })

  describe('AIBehaviorSettings', () => {
    beforeEach(() => {
      setActivePinia(createPinia())
    })

    it('renders slider with default temperature', () => {
      const wrapper = mount(AIBehaviorSettings)
      const slider = wrapper.find('[data-testid="temperature-slider"]')
      expect(slider.exists()).toBe(true)
      expect(slider.element.getAttribute('value')).toBe('0.3')
    })

    it('displays numeric value', () => {
      const wrapper = mount(AIBehaviorSettings)
      expect(wrapper.find('[data-testid="temperature-value"]').text()).toBe('0.30')
    })

    it('shows Balanced hint at default temperature (0.3)', () => {
      const wrapper = mount(AIBehaviorSettings)
      expect(wrapper.find('[data-testid="temperature-hint"]').text()).toContain('Balanced')
    })

    it('shows Precise hint at 0.1', async () => {
      const wrapper = mount(AIBehaviorSettings)
      const slider = wrapper.find('[data-testid="temperature-slider"]')
      await slider.setValue('0.1')
      await slider.trigger('input', { target: { value: '0.1' } })
      // re-check after input
      const store = useSettingsStore()
      store.temperature = 0.1 as unknown as number
      await wrapper.vm.$nextTick()
      // hint is computed from draft, not store; test via direct draft manipulation
      expect(wrapper.find('[data-testid="temperature-hint"]').text()).toContain('Precise')
    })

    it('calls setTemperature on change event', async () => {
      const store = useSettingsStore()
      const spy = vi.spyOn(store, 'setTemperature').mockResolvedValue()
      const wrapper = mount(AIBehaviorSettings)
      const slider = wrapper.find('[data-testid="temperature-slider"]')
      Object.defineProperty(slider.element, 'value', { value: '0.7', configurable: true })
      await slider.trigger('change')
      expect(spy).toHaveBeenCalledWith(0.7)
    })
  })
  ```

- [ ] **Step 3: Run the tests**

  ```bash
  npx vitest run src/renderer/src/components/settings/__tests__/AIBehaviorSettings.spec.ts
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/renderer/src/components/settings/AIBehaviorSettings.vue src/renderer/src/components/settings/__tests__/AIBehaviorSettings.spec.ts
  git commit -m "feat: add AIBehaviorSettings component with temperature slider"
  ```

---

## Task 12: Wire AIBehaviorSettings into SettingsSheet

**Files:**
- Modify: `src/renderer/src/components/layout/SettingsSheet.vue`

- [ ] **Step 1: Import and add `AIBehaviorSettings` to the settings panel**

  In `src/renderer/src/components/layout/SettingsSheet.vue`:

  Add the import after the existing settings imports:

  ```typescript
  import AIBehaviorSettings from '@renderer/components/settings/AIBehaviorSettings.vue'
  ```

  In the template, add the section after `<ThemeSettings />`:

  ```html
  <ThemeSettings />
  <Separator />
  <AIBehaviorSettings />
  <Separator />
  <ProviderSettings />
  <Separator />
  <LogsSettings />
  ```

- [ ] **Step 2: Run the full test suite**

  ```bash
  npx vitest run
  ```

  Expected: all tests pass.

- [ ] **Step 3: Final commit**

  ```bash
  git add src/renderer/src/components/layout/SettingsSheet.vue
  git commit -m "feat: add AIBehaviorSettings to SettingsSheet"
  ```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx vitest run` — all tests pass
- [ ] Open Settings → "AI Behavior" section appears between Appearance and Provider
- [ ] Move slider to 0.1 → hint shows "Precise", value shows `0.10`
- [ ] Move slider to 0.3 → hint shows "Balanced", value shows `0.30`
- [ ] Move slider to 0.8 → hint shows "Creative", value shows `0.80`
- [ ] Close and reopen Settings → slider position persists
- [ ] Send a chat message and verify the AI responds (smoke test — temperature is being passed but provider behaviour change is subtle)

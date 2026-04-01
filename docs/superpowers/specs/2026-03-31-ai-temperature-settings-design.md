# AI Temperature Settings — Design Spec

**Date:** 2026-03-31
**Status:** Approved

---

## Overview

Add a global AI temperature setting to sql-assist-desktop so users can control how deterministic or creative the AI's responses are. The default is 0.3 — low enough for reliable SQL generation while leaving slight flexibility for natural-language explanations.

Temperature applies to all `chatStream`-based paths — the chat assistant and the query optimizer — across all five providers (OpenAI, Anthropic, Google, OpenRouter, Ollama).

---

## Goals

- Let users tune AI output from precise/deterministic to more varied/creative via a single global control.
- Default to a conservative value (0.3) that suits SQL-focused work.
- Keep the change minimal — follow the existing architecture patterns exactly.
- Expose a clear, approachable slider UI in Settings with contextual hints.

## Non-Goals

- Per-provider temperature (global only for now).
- Per-session or inline chat temperature controls.
- Separate temperature for query optimization vs chat.

---

## Architecture

### Approach

Temperature is stored as a top-level global setting (`temperature`) in the settings database. The `AIService` reads it internally alongside `apiKey` and `baseUrl`, then passes it to each provider adapter. This mirrors how other provider parameters are handled today.

No changes to `AIChatParams` or the IPC call boundary — the service encapsulates the temperature fetch.

---

## Data Model Changes

### `src/shared/types.ts`

Add a `temperature` field to `AppSettings` and a shared constant:

```typescript
export const DEFAULT_TEMPERATURE = 0.3

export interface AppSettings {
  theme: ThemeMode
  activeProvider: AIProvider
  activeModel: string
  temperature: number          // global, 0.0–1.0
  providerConfigs: Record<AIProvider, ProviderConfig>
}
```

`ProviderConfig` is unchanged — temperature is intentionally not per-provider.

---

## Settings Service Changes

### `src/main/services/settings.service.ts`

`getAll()` reads temperature from the settings table:

```typescript
const temperatureRaw = await this.get('temperature')
const temperature = temperatureRaw !== null ? parseFloat(temperatureRaw) : DEFAULT_TEMPERATURE
```

Falls back to `DEFAULT_TEMPERATURE` (0.3) if no value has been persisted. Persisting uses the existing generic `set('temperature', String(value))`.

---

## AI Service Changes

### `src/main/services/ai/types.ts`

Add `temperature` as an optional parameter to the `ProviderAdapter.chatStream` signature:

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
    temperature?: number           // NEW
  ): Promise<void>
  // ...
}
```

Optional so adapters that do not support it can ignore it safely.

### `src/main/services/ai.service.ts`

`chatStream()` reads temperature from settings and passes it to the adapter:

```typescript
const settings = await settingsService.getAll()
const temperature = settings.temperature ?? DEFAULT_TEMPERATURE

await adapter.chatStream(
  messages, model, systemPrompt, apiKey, baseUrl,
  controller.signal, onChunk, temperature
)
```

`optimizeQuery()` flows through `chatStream()`, so it inherits temperature automatically with no additional changes.

### Adapter Changes (all five adapters)

Each adapter adds `temperature` to its JSON request body when building the fetch payload:

**OpenAI / OpenRouter:**
```typescript
body: JSON.stringify({ model, messages: allMessages, stream: true, temperature })
```

**Anthropic:**
```typescript
// Add temperature only; keep existing max_tokens unchanged (4096 for chatStream)
body: JSON.stringify({ model, messages, system: systemPrompt, stream: true, max_tokens: 4096, temperature })
```

**Google (Gemini):**
```typescript
// Merge temperature into the existing generationConfig — do NOT replace it (maxOutputTokens must be preserved)
generationConfig: { maxOutputTokens: 4096, temperature }
```

**Ollama:**
```typescript
body: JSON.stringify({ model, messages: allMessages, stream: true, options: { temperature } })
```

---

## Settings UI Changes

### Location

A new **"AI Behavior"** section is added inside the existing settings sheet. The most appropriate component to extend is `src/renderer/src/components/layout/SettingsSheet.vue` or a new `AISettings.vue` component extracted from it — whichever keeps the file size manageable.

### Controls

- **Label:** "Response Style"
- **Slider:** range 0.0–1.0, step 0.05
- **Value display:** current value shown numerically to 2 decimal places (e.g. `0.30`)
- **Contextual hint** — updates live on every `input` event (so it tracks the thumb as the user drags):

| Range | Hint text |
|-------|-----------|
| 0.00–0.20 | "Precise — minimal variation, best for SQL generation" |
| 0.21–0.50 | "Balanced — reliable with slight flexibility" |
| 0.51–1.00 | "Creative — more varied, less predictable responses" |

> **Note:** The UI slider is capped at 1.0. Some providers (e.g. Gemini) support higher values in their APIs, but 1.0 is the product-defined maximum for this app.

### Persistence

Temperature is saved on slider `change` (mouse release / keyboard commit), not on every `input` event, to avoid excessive IPC calls. The hint label and numeric display update on `input` for immediate feedback; only persistence waits for `change`. Uses the existing `window.api.settings.set('temperature', value)` IPC pattern.

### Store

`useSettingsStore` is extended to include `temperature` in its state, loaded on app init alongside other settings, and updated optimistically on save.

---

## IPC Changes

No new IPC channels required. The existing `settings.get` / `settings.set` generic channel handles temperature reads and writes. The existing `settings.getAll` channel returns the updated `AppSettings` shape including `temperature`. No changes to `settings.ipc.ts` or the preload `index.d.ts` (both delegate to the `AppSettings` type which already flows through).

### `chatWithTools` (out of scope)

The optional `chatWithTools` method on adapters is not currently called from anywhere in the codebase. Temperature will **not** be applied to tool-call requests under this spec — this is intentional and can be addressed in a future update if `chatWithTools` becomes active.

---

## Error Handling & Edge Cases

| Case | Handling |
|------|----------|
| No temperature in DB (first run) | Falls back to `DEFAULT_TEMPERATURE` (0.3) |
| Corrupt / non-numeric value in DB (e.g. `"abc"`) | `parseFloat` → `NaN`; treated as missing → falls back to `DEFAULT_TEMPERATURE` in `getAll()` |
| Value out of range (e.g. `1.5`) | Clamped to [0.0, 1.0] in `getAll()` before use |
| Provider silently ignores temperature | Adapter passes it; no error surfaced |
| Provider rejects temperature with HTTP 400 (e.g. certain OpenAI reasoning models that don't accept the parameter) | Surfaces as a normal AI error via the existing `classifyError` path — no special handling needed |
| Ollama model doesn't support it | Passed in `options`; Ollama ignores unknown option keys |

---

## Testing Considerations

- Unit test: `settingsService.getAll()` returns `DEFAULT_TEMPERATURE` when key absent.
- Unit test: `settingsService.getAll()` returns persisted value when key present.
- Unit test: each adapter includes `temperature` in the serialized request body.
- Integration: slider change in UI persists value and is reflected in subsequent AI calls.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `DEFAULT_TEMPERATURE`, add `temperature` to `AppSettings` |
| `src/main/services/settings.service.ts` | Read/return `temperature` in `getAll()` |
| `src/main/services/ai/types.ts` | Add optional `temperature` to `ProviderAdapter.chatStream` |
| `src/main/services/ai.service.ts` | Read temperature from settings, pass to adapter |
| `src/main/services/ai/openai.adapter.ts` | Pass `temperature` in request body |
| `src/main/services/ai/anthropic.adapter.ts` | Pass `temperature` in request body |
| `src/main/services/ai/google.adapter.ts` | Pass `temperature` in `generationConfig` |
| `src/main/services/ai/ollama.adapter.ts` | Pass `temperature` in `options` |
| `src/main/services/ai/openrouter.adapter.ts` | Pass `temperature` in request body |
| `src/renderer/src/stores/useSettingsStore.ts` | Add `temperature` to store state and actions |
| `src/renderer/src/components/layout/SettingsSheet.vue` (or new `AISettings.vue`) | Add slider UI for temperature |

import type { ProviderAdapter, ToolCallResponse } from './types'
import { assertResponseOk } from './types'
import { parseSSEStream } from './sse-parser'

export const openaiAdapter: ProviderAdapter = {
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk) {
    const allMessages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ]

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages: allMessages, stream: true }),
      signal
    })

    await assertResponseOk(response)

    for await (const data of parseSSEStream(response, signal)) {
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) onChunk(content)
      } catch {
        // skip malformed JSON lines
      }
    }
  },

  async listModels(apiKey, baseUrl) {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!response.ok) return []

    const data = (await response.json()) as { data?: { id: string }[] }
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id) => /gpt|o1|o3/i.test(id))
      .sort()
  },

  async chatWithTools(params, apiKey, baseUrl, onTextChunk, signal): Promise<ToolCallResponse> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        tools: params.tools,
        stream: true
      }),
      signal
    })

    await assertResponseOk(response)

    let content = ''
    const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>()

    for await (const data of parseSSEStream(response, signal)) {
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta

        if (delta?.content) {
          content += delta.content
          onTextChunk(delta.content)
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCallAccumulator.has(idx)) {
              toolCallAccumulator.set(idx, {
                id: tc.id ?? '',
                name: tc.function?.name ?? '',
                args: ''
              })
            }
            const acc = toolCallAccumulator.get(idx)!
            if (tc.id) acc.id = tc.id
            if (tc.function?.name) acc.name = tc.function.name
            if (tc.function?.arguments) acc.args += tc.function.arguments
          }
        }
      } catch {
        // skip malformed JSON
      }
    }

    const toolCalls =
      toolCallAccumulator.size > 0
        ? Array.from(toolCallAccumulator.values()).map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: JSON.parse(tc.args || '{}') as Record<string, unknown>
          }))
        : undefined

    return { content, toolCalls }
  }
}

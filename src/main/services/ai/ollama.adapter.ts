import type { ProviderAdapter, ToolCallResponse } from './types'
import { assertResponseOk } from './types'
import { parseNDJSONStream } from './sse-parser'

export const ollamaAdapter: ProviderAdapter = {
  async chatStream(messages, model, systemPrompt, _apiKey, baseUrl, signal, onChunk) {
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ]

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: allMessages, stream: true }),
      signal
    })

    await assertResponseOk(response)

    for await (const line of parseNDJSONStream(response, signal)) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.done) break
        if (parsed.message?.content) onChunk(parsed.message.content)
      } catch {
        // skip malformed lines
      }
    }
  },

  async listModels(_apiKey, baseUrl) {
    const response = await fetch(`${baseUrl}/api/tags`)
    if (!response.ok) return []

    const data = (await response.json()) as { models?: { name: string }[] }
    return (data.models ?? []).map((m) => m.name).sort()
  },

  async chatWithTools(params, _apiKey, baseUrl, onTextChunk, signal): Promise<ToolCallResponse> {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        tools: params.tools,
        stream: false
      }),
      signal
    })

    await assertResponseOk(response)

    const data = (await response.json()) as {
      message?: {
        content?: string
        tool_calls?: Array<{
          function: { name: string; arguments: Record<string, unknown> }
        }>
      }
    }

    const content = data.message?.content ?? ''
    if (content) onTextChunk(content)

    const toolCalls = data.message?.tool_calls?.map((tc, i) => ({
      id: `call_${i}`,
      name: tc.function.name,
      arguments: tc.function.arguments
    }))

    return { content, toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined }
  }
}

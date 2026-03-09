import type { ProviderAdapter } from './types'
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
  }
}

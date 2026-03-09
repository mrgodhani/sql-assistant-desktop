import type { ProviderAdapter } from './types'
import { assertResponseOk } from './types'
import { parseSSEStream } from './sse-parser'

export const anthropicAdapter: ProviderAdapter = {
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk) {
    const filteredMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: filteredMessages,
        max_tokens: 4096,
        stream: true
      }),
      signal
    })

    await assertResponseOk(response)

    for await (const data of parseSSEStream(response, signal)) {
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onChunk(parsed.delta.text)
        }
      } catch {
        // skip malformed lines
      }
    }
  },

  async listModels() {
    return [
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ]
  }
}

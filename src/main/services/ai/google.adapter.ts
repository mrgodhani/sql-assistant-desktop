import type { ProviderAdapter } from './types'
import { assertResponseOk } from './types'
import { parseSSEStream } from './sse-parser'

function mapRole(role: string): string {
  if (role === 'assistant') return 'model'
  return role
}

export const googleAdapter: ProviderAdapter = {
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk) {
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: mapRole(m.role),
        parts: [{ text: m.content }]
      }))

    const url = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 4096 }
      }),
      signal
    })

    await assertResponseOk(response)

    for await (const data of parseSSEStream(response, signal)) {
      try {
        const parsed = JSON.parse(data)
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onChunk(text)
      } catch {
        // skip malformed lines
      }
    }
  },

  async listModels(apiKey, baseUrl) {
    const response = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`)
    if (!response.ok) return []

    const data = (await response.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[]
    }
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      .sort()
  }
}

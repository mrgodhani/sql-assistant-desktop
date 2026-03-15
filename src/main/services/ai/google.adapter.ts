import type { ProviderAdapter, ToolCallResponse } from './types'
import { assertResponseOk } from './types'
import { parseSSEStream } from './sse-parser'

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: unknown }
}

interface GeminiContent {
  role: string
  parts: GeminiPart[]
}

function convertMessagesToGemini(
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }>
): { systemInstruction: string; contents: GeminiContent[] } {
  let systemInstruction = ''
  const contents: GeminiContent[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content
      continue
    }

    if (msg.role === 'assistant' || msg.role === 'model') {
      const parts: GeminiPart[] = []
      if (msg.content) parts.push({ text: msg.content })
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls as Array<{
          id: string
          function: { name: string; arguments: string }
        }>) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || '{}')
            }
          })
        }
      }
      if (parts.length > 0) contents.push({ role: 'model', parts })
      continue
    }

    if (msg.role === 'tool') {
      let response: unknown
      try {
        response = JSON.parse(msg.content)
      } catch {
        response = { result: msg.content }
      }
      const prevFunc = contents.length > 0 ? contents[contents.length - 1] : null
      const funcName = prevFunc?.parts?.find((p) => p.functionCall)?.functionCall?.name ?? 'unknown'
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: funcName, response } }]
      })
      continue
    }

    contents.push({ role: 'user', parts: [{ text: msg.content }] })
  }

  return { systemInstruction, contents }
}

function convertToolsToGemini(tools: unknown[]): Array<{
  functionDeclarations: Array<{ name: string; description: string; parameters: unknown }>
}> {
  const declarations = (
    tools as Array<{
      type: string
      function: { name: string; description: string; parameters: unknown }
    }>
  ).map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters
  }))
  return [{ functionDeclarations: declarations }]
}

export const googleAdapter: ProviderAdapter = {
  async chatStream(messages, model, systemPrompt, apiKey, baseUrl, signal, onChunk) {
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : m.role,
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
  },

  async chatWithTools(params, apiKey, baseUrl, onTextChunk, signal): Promise<ToolCallResponse> {
    const { systemInstruction, contents } = convertMessagesToGemini(params.messages)
    const tools = convertToolsToGemini(params.tools)

    const url = `${baseUrl}/v1beta/models/${params.model}:streamGenerateContent?key=${apiKey}&alt=sse`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: { maxOutputTokens: 8192 }
      }),
      signal
    })

    await assertResponseOk(response)

    let content = ''
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []

    for await (const data of parseSSEStream(response, signal)) {
      try {
        const parsed = JSON.parse(data)
        const parts = parsed.candidates?.[0]?.content?.parts as GeminiPart[] | undefined
        if (!parts) continue

        for (const part of parts) {
          if (part.text) {
            content += part.text
            onTextChunk(part.text)
          }
          if (part.functionCall) {
            toolCalls.push({
              id: `call_${crypto.randomUUID().slice(0, 8)}`,
              name: part.functionCall.name,
              arguments: part.functionCall.args ?? {}
            })
          }
        }
      } catch {
        // skip malformed lines
      }
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
  }
}

import type { ProviderAdapter, ToolCallResponse } from './types'
import { assertResponseOk } from './types'
import { parseSSEStream } from './sse-parser'

interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

type AnthropicMsgContent = string | AnthropicContentBlock[]

function convertMessagesForAnthropic(
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }>
): { system: string; messages: Array<{ role: string; content: AnthropicMsgContent }> } {
  let system = ''
  const out: Array<{ role: string; content: AnthropicMsgContent }> = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      system += (system ? '\n\n' : '') + msg.content
      continue
    }

    if (msg.role === 'assistant') {
      const blocks: AnthropicContentBlock[] = []
      if (msg.content) blocks.push({ type: 'text', text: msg.content })
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls as Array<{
          id: string
          type: string
          function: { name: string; arguments: string }
        }>) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}')
          })
        }
      }
      out.push({
        role: 'assistant',
        content: blocks.length === 1 && blocks[0].text ? blocks[0].text : blocks
      })
      continue
    }

    if (msg.role === 'tool') {
      const lastMsg = out[out.length - 1]
      const toolResultBlock: AnthropicContentBlock = {
        type: 'tool_result',
        id: msg.tool_call_id ?? '',
        text: msg.content
      }
      if (lastMsg?.role === 'user' && Array.isArray(lastMsg.content)) {
        ;(lastMsg.content as AnthropicContentBlock[]).push(toolResultBlock)
      } else {
        out.push({ role: 'user', content: [toolResultBlock] })
      }
      continue
    }

    out.push({ role: 'user', content: msg.content })
  }

  return { system, messages: out }
}

function convertToolsForAnthropic(
  tools: unknown[]
): Array<{ name: string; description: string; input_schema: unknown }> {
  return (
    tools as Array<{
      type: string
      function: { name: string; description: string; parameters: unknown }
    }>
  ).map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
  }))
}

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
    return ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
  },

  async chatWithTools(params, apiKey, baseUrl, onTextChunk, signal): Promise<ToolCallResponse> {
    const { system, messages } = convertMessagesForAnthropic(params.messages)
    const tools = convertToolsForAnthropic(params.tools)

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: params.model,
        system,
        messages,
        tools,
        max_tokens: 8192,
        stream: true
      }),
      signal
    })

    await assertResponseOk(response)

    let content = ''
    const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>()
    let currentBlockIndex = -1

    for await (const data of parseSSEStream(response, signal)) {
      try {
        const parsed = JSON.parse(data)

        if (parsed.type === 'content_block_start') {
          currentBlockIndex = parsed.index ?? 0
          const block = parsed.content_block
          if (block?.type === 'tool_use') {
            toolCallAccumulator.set(currentBlockIndex, {
              id: block.id ?? '',
              name: block.name ?? '',
              args: ''
            })
          }
        }

        if (parsed.type === 'content_block_delta') {
          const idx = parsed.index ?? currentBlockIndex
          if (parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
            content += parsed.delta.text
            onTextChunk(parsed.delta.text)
          }
          if (parsed.delta?.type === 'input_json_delta' && parsed.delta?.partial_json) {
            const acc = toolCallAccumulator.get(idx)
            if (acc) acc.args += parsed.delta.partial_json
          }
        }
      } catch {
        // skip malformed lines
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

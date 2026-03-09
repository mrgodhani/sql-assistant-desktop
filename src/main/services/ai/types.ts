import type { ChatMessage, AIProvider, AIErrorType } from '../../../shared/types'

export interface ProviderAdapter {
  chatStream(
    messages: ChatMessage[],
    model: string,
    systemPrompt: string,
    apiKey: string,
    baseUrl: string,
    signal: AbortSignal,
    onChunk: (text: string) => void
  ): Promise<void>

  listModels(apiKey: string, baseUrl: string): Promise<string[]>
}

export class AIServiceError extends Error {
  constructor(
    public readonly type: AIErrorType,
    message: string,
    public readonly provider: AIProvider,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

export function classifyError(error: unknown, provider: AIProvider): AIServiceError {
  if (error instanceof AIServiceError) return error

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AIServiceError('cancelled', 'Request cancelled', provider, false)
  }

  const msg = error instanceof Error ? error.message : String(error)
  const status = (error as Record<string, unknown>)?.status as number | undefined

  if (status === 401 || status === 403) {
    return new AIServiceError('auth', 'Invalid or expired API key. Check your settings.', provider, false)
  }
  if (status === 404) {
    return new AIServiceError('model_not_found', 'Model not found. Try refreshing your model list in Settings.', provider, false)
  }
  if (status === 429) {
    return new AIServiceError('rate_limit', 'Rate limit exceeded. Please wait and try again.', provider, true)
  }
  if (status === 400 && /token|context|length/i.test(msg)) {
    return new AIServiceError('token_limit', 'Message too long. Try shortening the conversation or reducing schema context.', provider, false)
  }
  if (status && status >= 500) {
    return new AIServiceError('unknown', `Provider server error (${status}). Try again shortly.`, provider, true)
  }
  if (/ECONNREFUSED|ENOTFOUND|network|fetch failed/i.test(msg)) {
    return new AIServiceError('network', 'Network error. Check your connection and provider URL.', provider, true)
  }
  if (/timed? ?out/i.test(msg)) {
    return new AIServiceError('network', 'Request timed out. The provider may be overloaded.', provider, true)
  }

  const detail = msg.length > 150 ? msg.slice(0, 150) + '...' : msg
  return new AIServiceError('unknown', `Error from ${provider}: ${detail}`, provider, true)
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export async function assertResponseOk(response: Response): Promise<void> {
  if (response.ok) return

  let body = ''
  try {
    body = await response.text()
  } catch {
    // ignore read errors
  }

  throw new HttpError(response.status, `HTTP ${response.status}: ${body.slice(0, 200)}`)
}

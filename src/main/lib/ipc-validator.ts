import { ipcMain } from 'electron'
import log from 'electron-log/main'

export function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`)
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${fieldName} is required`)
  return trimmed
}

export function assertOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a string`)
  const trimmed = value.trim()
  return trimmed || undefined
}

export function assertNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number`)
  }
  return value
}

export function assertOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value == null) return undefined
  return assertNumber(value, fieldName)
}

type SchemaType = 'string' | 'number' | 'boolean'

export function assertShape<T extends Record<string, SchemaType>>(
  value: unknown,
  shape: T
): { [K in keyof T]: T[K] extends 'string' ? string : T[K] extends 'number' ? number : boolean } {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected an object')
  }
  const obj = value as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, expectedType] of Object.entries(shape)) {
    const val = obj[key]
    if (val == null) throw new Error(`${key} is required`)
    if (typeof val !== expectedType) throw new Error(`${key} must be a ${expectedType}`)
    if (expectedType === 'number' && Number.isNaN(val)) throw new Error(`${key} must be a number`)
    if (expectedType === 'string' && !(val as string).trim()) throw new Error(`${key} is required`)
    result[key] = expectedType === 'string' ? (val as string).trim() : val
  }

  return result as ReturnType<typeof assertShape<T>>
}

export function handleValidated<T>(
  channel: string,
  validate: (...args: unknown[]) => T,
  handler: (validated: T) => Promise<unknown>
): void {
  ipcMain.handle(channel, async (_event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => {
    try {
      const validated = validate(...args)
      return await handler(validated)
    } catch (error) {
      log.error(
        `[IPC:${channel}] Validation failed:`,
        error instanceof Error ? error.message : error
      )
      throw error
    }
  })
}

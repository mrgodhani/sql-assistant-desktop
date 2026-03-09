import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExecutionResult } from '../../../shared/types'

function key(messageIndex: number, blockIndex: number): string {
  return `${messageIndex}-${blockIndex}`
}

export const useResultsStore = defineStore('results', () => {
  const results = ref<Record<string, ExecutionResult>>({})

  function getResult(messageIndex: number, blockIndex: number): ExecutionResult | null {
    return results.value[key(messageIndex, blockIndex)] ?? null
  }

  function setResult(messageIndex: number, blockIndex: number, result: ExecutionResult): void {
    results.value[key(messageIndex, blockIndex)] = result
  }

  function clearResult(messageIndex: number, blockIndex: number): void {
    delete results.value[key(messageIndex, blockIndex)]
  }

  async function executeQuery(
    connectionId: string | null,
    sql: string,
    messageIndex: number,
    blockIndex: number
  ): Promise<ExecutionResult> {
    if (!connectionId) {
      const result: ExecutionResult = {
        success: false,
        error: 'Select a connection first'
      }
      setResult(messageIndex, blockIndex, result)
      return result
    }

    const trimmed = sql.trim()
    if (!trimmed) {
      const result: ExecutionResult = {
        success: false,
        error: 'SQL query is required'
      }
      setResult(messageIndex, blockIndex, result)
      return result
    }

    setResult(messageIndex, blockIndex, { success: false, error: 'Running query...' })

    try {
      const execResult = await window.dbApi.execute(connectionId, trimmed)
      setResult(messageIndex, blockIndex, execResult)
      return execResult
    } catch (err) {
      const result: ExecutionResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Execution failed'
      }
      setResult(messageIndex, blockIndex, result)
      return result
    }
  }

  return {
    results: computed(() => results.value),
    getResult,
    setResult,
    clearResult,
    executeQuery
  }
})

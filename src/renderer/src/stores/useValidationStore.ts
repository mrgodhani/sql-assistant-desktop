import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SqlValidationResult } from '../../../shared/types'

function key(messageIndex: number, blockIndex: number): string {
  return `${messageIndex}-${blockIndex}`
}

export const useValidationStore = defineStore('validation', () => {
  const results = ref<Record<string, SqlValidationResult>>({})

  const getValidation = (messageIndex: number, blockIndex: number): SqlValidationResult | null =>
    results.value[key(messageIndex, blockIndex)] ?? null

  function setValidation(
    messageIndex: number,
    blockIndex: number,
    result: SqlValidationResult
  ): void {
    results.value[key(messageIndex, blockIndex)] = result
  }

  function clearValidation(messageIndex: number, blockIndex: number): void {
    delete results.value[key(messageIndex, blockIndex)]
  }

  function clearAll(): void {
    results.value = {}
  }

  async function validateSqlBlock(
    connectionId: string,
    messageIndex: number,
    blockIndex: number,
    sql: string
  ): Promise<SqlValidationResult> {
    const trimmed = sql.trim()
    if (!trimmed) {
      const result: SqlValidationResult = { valid: false, error: 'SQL query is required' }
      setValidation(messageIndex, blockIndex, result)
      return result
    }
    try {
      const result = await window.dbApi.validateSql(connectionId, trimmed)
      setValidation(messageIndex, blockIndex, result)
      return result
    } catch (err) {
      const result: SqlValidationResult = {
        valid: false,
        error: err instanceof Error ? err.message : 'Validation failed'
      }
      setValidation(messageIndex, blockIndex, result)
      return result
    }
  }

  return {
    results: computed(() => results.value),
    getValidation,
    setValidation,
    clearValidation,
    clearAll,
    validateSqlBlock
  }
})

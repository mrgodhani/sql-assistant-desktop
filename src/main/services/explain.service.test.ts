/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runExplain } from './explain.service'
import { databaseService } from './database.service'

vi.mock('./database.service', () => ({
  databaseService: {
    getConnectionType: vi.fn(),
    executeQuery: vi.fn(),
    executeSqlServerShowplan: vi.fn()
  }
}))

describe('runExplain — SQL Server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls executeSqlServerShowplan and returns raw + mermaid', async () => {
    vi.mocked(databaseService.getConnectionType).mockReturnValue('sqlserver')
    vi.mocked(databaseService.executeSqlServerShowplan).mockResolvedValue([
      'StmtText',
      '--------------------------------------------',
      '  |--Clustered Index Scan(OBJECT:([dbo].[users].[PK_users]))'
    ])

    const result = await runExplain('conn-1', 'SELECT * FROM users')

    expect(databaseService.executeSqlServerShowplan).toHaveBeenCalledWith(
      'conn-1',
      'SELECT * FROM users'
    )
    expect(result.raw).toContain('Clustered Index Scan')
    expect(result.mermaid).toContain('flowchart TB')
    expect(result.mermaid).toContain('Clustered Index Scan')
  })

  it('returns empty raw and fallback mermaid for empty plan lines', async () => {
    vi.mocked(databaseService.getConnectionType).mockReturnValue('sqlserver')
    vi.mocked(databaseService.executeSqlServerShowplan).mockResolvedValue([])

    const result = await runExplain('conn-1', 'SELECT 1')

    expect(result.raw).toBe('')
    expect(result.mermaid).toBe('flowchart TB')
  })
})

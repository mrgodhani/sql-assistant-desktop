/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import {
  parseConnectionString,
  stripConnectionStringParams,
  buildConnectionString
} from './database.service'
import type { ConnectionConfig } from '../../shared/types'

describe('parseConnectionString', () => {
  it('parses PostgreSQL connection string', () => {
    const result = parseConnectionString('postgresql://user:pass@localhost:5432/mydb')
    expect(result).toMatchObject({
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'user',
      password: 'pass'
    })
  })

  it('parses MySQL connection string', () => {
    const result = parseConnectionString('mysql://root@localhost:3306/testdb')
    expect(result).toMatchObject({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'testdb',
      username: 'root'
    })
  })

  it('parses SQLite connection string', () => {
    const result = parseConnectionString('sqlite:///path/to/db.sqlite')
    expect(result).toMatchObject({
      type: 'sqlite',
      filePath: 'path/to/db.sqlite',
      database: 'path/to/db.sqlite'
    })
  })

  it('throws for unknown format', () => {
    expect(() => parseConnectionString('invalid://x')).toThrow('Unknown connection string format')
  })
})

describe('stripConnectionStringParams', () => {
  it('strips non-standard params', () => {
    const input = 'postgresql://localhost/db?sslmode=require&statusColor=red&tLSMode=1'
    expect(stripConnectionStringParams(input)).toBe('postgresql://localhost/db?sslmode=require')
  })

  it('returns string unchanged when no query params', () => {
    const input = 'postgresql://localhost/db'
    expect(stripConnectionStringParams(input)).toBe(input)
  })
})

describe('buildConnectionString', () => {
  it('builds PostgreSQL connection string', () => {
    const config: ConnectionConfig = {
      name: 'test',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'user',
      password: 'secret',
      sslEnabled: false
    }
    expect(buildConnectionString(config)).toMatch(/postgresql:\/\/user:\*\*\*@localhost:5432\/mydb/)
  })

  it('builds SQLite connection string', () => {
    const config: ConnectionConfig = {
      name: 'test',
      type: 'sqlite',
      database: '/path/to/db.sqlite',
      filePath: '/path/to/db.sqlite',
      sslEnabled: false
    }
    expect(buildConnectionString(config)).toBe('sqlite:////path/to/db.sqlite')
  })
})

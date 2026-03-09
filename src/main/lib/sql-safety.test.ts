/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { detectDestructiveStatements } from './sql-safety'

describe('sql-safety', () => {
  it('returns empty for SELECT queries', () => {
    expect(detectDestructiveStatements('SELECT * FROM users')).toEqual([])
  })

  it('returns empty for SELECT with subquery', () => {
    expect(
      detectDestructiveStatements('SELECT * FROM users WHERE id IN (SELECT id FROM active)')
    ).toEqual([])
  })

  it('detects DROP TABLE', () => {
    expect(detectDestructiveStatements('DROP TABLE users')).toContain('DROP')
  })

  it('detects DROP DATABASE', () => {
    expect(detectDestructiveStatements('DROP DATABASE mydb')).toContain('DROP')
  })

  it('detects TRUNCATE', () => {
    expect(detectDestructiveStatements('TRUNCATE TABLE orders')).toContain('TRUNCATE')
  })

  it('detects DELETE without WHERE', () => {
    expect(detectDestructiveStatements('DELETE FROM users')).toContain('DELETE without WHERE')
  })

  it('allows DELETE with WHERE', () => {
    expect(detectDestructiveStatements('DELETE FROM users WHERE id = 1')).toEqual([])
  })

  it('detects UPDATE without WHERE', () => {
    expect(detectDestructiveStatements('UPDATE users SET name = "x"')).toContain(
      'UPDATE without WHERE'
    )
  })

  it('allows UPDATE with WHERE', () => {
    expect(detectDestructiveStatements('UPDATE users SET name = "x" WHERE id = 1')).toEqual([])
  })

  it('detects ALTER TABLE', () => {
    expect(detectDestructiveStatements('ALTER TABLE users ADD COLUMN age INT')).toContain('ALTER')
  })

  it('detects GRANT', () => {
    expect(detectDestructiveStatements('GRANT ALL ON db.* TO user')).toContain('GRANT')
  })

  it('detects REVOKE', () => {
    expect(detectDestructiveStatements('REVOKE ALL ON db.* FROM user')).toContain('REVOKE')
  })

  it('detects INSERT', () => {
    expect(detectDestructiveStatements('INSERT INTO users VALUES (1, "a")')).toContain('INSERT')
  })

  it('detects CREATE', () => {
    expect(detectDestructiveStatements('CREATE TABLE foo (id INT)')).toContain('CREATE')
  })

  it('is case-insensitive', () => {
    expect(detectDestructiveStatements('drop table users')).toContain('DROP')
  })

  it('handles leading whitespace', () => {
    expect(detectDestructiveStatements('   DROP TABLE users')).toContain('DROP')
  })

  it('returns empty for EXPLAIN queries', () => {
    expect(detectDestructiveStatements('EXPLAIN SELECT * FROM users')).toEqual([])
  })
})

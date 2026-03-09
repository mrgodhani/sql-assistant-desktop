const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^\s*DROP\b/i, label: 'DROP' },
  { pattern: /^\s*TRUNCATE\b/i, label: 'TRUNCATE' },
  { pattern: /^\s*ALTER\b/i, label: 'ALTER' },
  { pattern: /^\s*GRANT\b/i, label: 'GRANT' },
  { pattern: /^\s*REVOKE\b/i, label: 'REVOKE' },
  { pattern: /^\s*CREATE\b/i, label: 'CREATE' },
  { pattern: /^\s*INSERT\b/i, label: 'INSERT' }
]

const DELETE_WITHOUT_WHERE = /^\s*DELETE\b(?!.*\bWHERE\b)/is
const UPDATE_WITHOUT_WHERE = /^\s*UPDATE\b(?!.*\bWHERE\b)/is

export function detectDestructiveStatements(sql: string): string[] {
  const detected: string[] = []

  for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(sql)) detected.push(label)
  }

  if (DELETE_WITHOUT_WHERE.test(sql)) detected.push('DELETE without WHERE')
  if (UPDATE_WITHOUT_WHERE.test(sql)) detected.push('UPDATE without WHERE')

  return detected
}

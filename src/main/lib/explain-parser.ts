/**
 * PostgreSQL EXPLAIN (FORMAT JSON) output structure.
 * Typically: [{ "Plan": { "Node Type": "...", "Relation Name": "...", "Plan Rows": N, "Plans": [...] } }]
 */
export interface PostgresPlanNode {
  'Node Type': string
  'Relation Name'?: string
  'Plan Rows'?: number
  Plans?: PostgresPlanNode[]
}

export interface PostgresExplainEntry {
  Plan: PostgresPlanNode
}

/**
 * Sanitize a string for use as a Mermaid node ID.
 * Mermaid node IDs must be alphanumeric + underscore (no spaces, special chars).
 */
function sanitizeNodeId(str: string, suffix?: string): string {
  const base =
    str
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'node'
  return suffix !== undefined ? `${base}_${suffix}` : base
}

/**
 * Build label for a plan node: Node Type + Relation Name (if present) + Plan Rows.
 */
function buildNodeLabel(node: PostgresPlanNode): string {
  const parts: string[] = [node['Node Type']]
  if (node['Relation Name']) {
    parts.push(node['Relation Name'])
  }
  if (node['Plan Rows'] !== undefined && node['Plan Rows'] !== null) {
    parts.push(`rows: ${node['Plan Rows']}`)
  }
  return parts.join(' | ')
}

/**
 * Recursively walk plan nodes and collect Mermaid lines (node defs + edges).
 */
function walkPlan(
  node: PostgresPlanNode,
  parentId: string | null,
  idCounter: { value: number }
): string[] {
  const lines: string[] = []
  const nodeId = sanitizeNodeId(node['Node Type'], String(idCounter.value++))
  const label = buildNodeLabel(node)

  lines.push(`${nodeId}["${label}"]`)
  if (parentId !== null) {
    lines.push(`${parentId} --> ${nodeId}`)
  }

  const plans = node.Plans ?? []
  for (const child of plans) {
    lines.push(...walkPlan(child, nodeId, idCounter))
  }

  return lines
}

/**
 * Convert PostgreSQL EXPLAIN (FORMAT JSON) output to a Mermaid flowchart.
 *
 * @param postgresJson - Array of EXPLAIN entries, typically from EXPLAIN (FORMAT JSON) output
 * @returns Mermaid flowchart string (flowchart TB with nodes and edges)
 */
export function postgresJsonToMermaid(postgresJson: PostgresExplainEntry[]): string {
  const lines: string[] = ['flowchart TB']
  const idCounter = { value: 0 }

  for (const entry of postgresJson) {
    const plan = entry.Plan
    if (plan) {
      lines.push(...walkPlan(plan, null, idCounter))
    }
  }

  return lines.join('\n')
}

/** MySQL EXPLAIN FORMAT=JSON table object (nested inside nested_loop or table). */
interface MysqlTableObj {
  table_name?: string
  access_type?: string
  rows_examined_per_scan?: number
  rows_produced_per_join?: number
  key?: string
  materialized_from_subquery?: { query_block?: MysqlQueryBlock }
  grouping_operation?: { nested_loop?: MysqlNestedLoopEntry[] }
}

/** MySQL nested_loop entry: { table: {...} } or nested structures. */
type MysqlNestedLoopEntry = { table?: MysqlTableObj }

/** MySQL query_block: has nested_loop or table. */
interface MysqlQueryBlock {
  select_id?: number
  nested_loop?: MysqlNestedLoopEntry[]
  table?: MysqlTableObj
}

/** MySQL root: { query_block: {...} } or { EXPLAIN: { query_block: {...} } }. */
interface MysqlExplainRoot {
  query_block?: MysqlQueryBlock
  EXPLAIN?: { query_block?: MysqlQueryBlock }
}

function isMysqlExplainRoot(obj: unknown): obj is MysqlExplainRoot {
  if (obj === null || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return 'query_block' in o || 'EXPLAIN' in o
}

function getMysqlQueryBlock(root: MysqlExplainRoot): MysqlQueryBlock | undefined {
  return root.query_block ?? root.EXPLAIN?.query_block
}

function buildMysqlNodeLabel(table: MysqlTableObj): string {
  const parts: string[] = []
  const name = (table.table_name ?? '').trim() || 'table'
  parts.push(name)
  if (table.access_type) parts.push(table.access_type)
  if (table.rows_examined_per_scan !== undefined)
    parts.push(`rows: ${table.rows_examined_per_scan}`)
  if (table.key) parts.push(`key: ${table.key}`)
  return parts.join(' | ')
}

function walkMysqlTable(
  table: MysqlTableObj,
  parentId: string | null,
  idCounter: { value: number }
): { lines: string[]; nodeId: string } {
  const lines: string[] = []
  const label = buildMysqlNodeLabel(table)
  const nodeId = sanitizeNodeId(label, String(idCounter.value++))

  lines.push(`${nodeId}["${label.replace(/"/g, '#quot;')}"]`)
  if (parentId !== null) {
    lines.push(`${parentId} --> ${nodeId}`)
  }

  const mat = table.materialized_from_subquery?.query_block
  if (mat) {
    if (mat.nested_loop) {
      for (const entry of mat.nested_loop) {
        if (entry.table) {
          const child = walkMysqlTable(entry.table, nodeId, idCounter)
          lines.push(...child.lines)
        }
      }
    } else if (mat.table) {
      const child = walkMysqlTable(mat.table, nodeId, idCounter)
      lines.push(...child.lines)
    }
  }

  const grp = table.grouping_operation?.nested_loop
  if (grp) {
    for (const entry of grp) {
      if (entry.table) {
        const child = walkMysqlTable(entry.table, nodeId, idCounter)
        lines.push(...child.lines)
      }
    }
  }

  return { lines, nodeId }
}

function walkMysqlQueryBlock(
  qb: MysqlQueryBlock,
  parentId: string | null,
  idCounter: { value: number }
): string[] {
  const lines: string[] = []
  const nl = qb.nested_loop
  if (nl) {
    let prevId: string | null = parentId
    for (const entry of nl) {
      if (entry.table) {
        const { lines: tableLines, nodeId } = walkMysqlTable(entry.table, prevId, idCounter)
        lines.push(...tableLines)
        prevId = nodeId
      }
    }
    return lines
  }
  if (qb.table) {
    const { lines: tableLines } = walkMysqlTable(qb.table, parentId, idCounter)
    return tableLines
  }
  return lines
}

/**
 * Convert MySQL EXPLAIN FORMAT=JSON output to a Mermaid flowchart.
 * MySQL structure: query_block with nested_loop/table, table_name, access_type, etc.
 *
 * @param json - MySQL EXPLAIN FORMAT=JSON output (object or parsed JSON)
 * @returns Mermaid flowchart string (flowchart TB with nodes and edges)
 */
export function mysqlJsonToMermaid(json: unknown): string {
  const lines: string[] = ['flowchart TB']
  const idCounter = { value: 0 }

  if (!isMysqlExplainRoot(json)) {
    return lines.join('\n')
  }

  const qb = getMysqlQueryBlock(json)
  if (qb) {
    lines.push(...walkMysqlQueryBlock(qb, null, idCounter))
  }

  return lines.join('\n')
}

/** SQLite EXPLAIN QUERY PLAN line: depth from indentation, content after tree prefix. */
interface SqlitePlanLine {
  depth: number
  content: string
}

function parseSqliteLines(text: string): SqlitePlanLine[] {
  const result: SqlitePlanLine[] = []
  const raw = text.replace(/\r\n/g, '\n').split('\n')
  for (const line of raw) {
    const trimmed = line.trimEnd()
    if (!trimmed) continue
    if (trimmed === 'QUERY PLAN') continue
    const match = trimmed.match(/^(\s*)([|`]*)(--)(.*)$/)
    if (match) {
      const leadingSpaces = match[1].length
      const content = (match[4] ?? '').trim()
      const depth = Math.floor(leadingSpaces / 3)
      result.push({ depth, content })
      continue
    }
    const simple = trimmed.match(
      /^(SCAN|SEARCH|USE TEMP|MULTI-INDEX|CO-ROUTINE|MATERIALIZE|COMPOUND|MERGE|LEFT|RIGHT|LEFT-MOST|UNION|SCALAR|CORRELATED|COVERING|TABLE)(.*)$/i
    )
    if (simple) {
      result.push({ depth: 0, content: trimmed })
    }
  }
  return result
}

/**
 * Convert SQLite EXPLAIN QUERY PLAN text to a Mermaid flowchart.
 * Format: "QUERY PLAN\n|--SCAN users" or "SCAN table_name" - pipe/tree shows hierarchy.
 * Indentation (3 spaces per level) determines parent-child relationship.
 *
 * @param text - SQLite EXPLAIN QUERY PLAN output
 * @returns Mermaid flowchart string (flowchart TB with nodes and edges)
 */
export function sqliteTextToMermaid(text: string): string {
  const mermaidLines: string[] = ['flowchart TB']
  const idCounter = { value: 0 }
  const parsed = parseSqliteLines(text)
  if (parsed.length === 0) return mermaidLines.join('\n')

  const stack: { nodeId: string; depth: number }[] = []
  const lastSiblingAtDepth: Map<number, string> = new Map()
  for (const { depth, content } of parsed) {
    const label = content || 'step'
    const nodeId = sanitizeNodeId(label, String(idCounter.value++))
    mermaidLines.push(`${nodeId}["${label.replace(/"/g, '#quot;')}"]`)

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop()
    }
    let parent: string | null = stack.length > 0 ? stack[stack.length - 1].nodeId : null
    if (parent === null && depth > 0) {
      parent = lastSiblingAtDepth.get(depth - 1) ?? null
    }
    if (parent === null && depth === 0) {
      parent = lastSiblingAtDepth.get(0) ?? null
    }
    if (parent !== null) {
      mermaidLines.push(`${parent} --> ${nodeId}`)
    }
    lastSiblingAtDepth.set(depth, nodeId)
    stack.push({ nodeId, depth })
  }

  return mermaidLines.join('\n')
}

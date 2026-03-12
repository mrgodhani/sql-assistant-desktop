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
  const base = str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'node'
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

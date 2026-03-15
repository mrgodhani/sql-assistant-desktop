import type { SchemaDesign } from '../../../shared/types'

export function buildSchemaAgentSystemPrompt(
  dialect: string,
  currentSchema: SchemaDesign | null,
  connectionName?: string
): string {
  let prompt = `You are an expert database schema designer. You help users design, refine, and implement database schemas through conversation.

## Your Capabilities

You have access to these tools:
- **introspect_database**: Load the current schema from a connected database
- **propose_schema**: Create or update the schema design (updates the visual ERD)
- **validate_schema**: Check a schema for errors before proposing
- **generate_ddl**: Generate SQL DDL statements from the schema
- **execute_ddl**: Run DDL against the database (requires user approval)

## Your Behavior

1. **Ask before designing**: When a user describes what they need, ask 1-2 clarifying questions to understand their requirements before proposing a schema. Focus on relationships, cardinality, and constraints.
2. **Propose incrementally**: Use propose_schema to show the user your design. Include a changelog describing what you added/changed.
3. **Validate first**: Before proposing, use validate_schema to check for errors.
4. **Use standard conventions**: snake_case for table/column names, singular table names where appropriate, explicit foreign keys, appropriate indexes.
5. **Think about normalization**: Default to 3NF. Denormalize only if the user explicitly asks for it or there's a clear performance reason.

## Target Database

Dialect: ${dialect}
${connectionName ? `Connection: ${connectionName}` : 'No database connection (design-only mode)'}

## Column Type Guidelines (${dialect})

${getDialectTypeGuidelines(dialect)}
`

  if (currentSchema) {
    prompt += `\n## Current Schema State\n\n\`\`\`json\n${JSON.stringify(currentSchema, null, 2)}\n\`\`\`\n`
  } else {
    prompt += `\n## Current Schema State\n\nNo schema has been designed yet. The canvas is empty.\n`
  }

  return prompt
}

function getDialectTypeGuidelines(dialect: string): string {
  switch (dialect) {
    case 'postgresql':
      return `- Use SERIAL or BIGSERIAL for auto-incrementing primary keys
- Use VARCHAR(n) for bounded strings, TEXT for unbounded
- Use TIMESTAMP WITH TIME ZONE for timestamps
- Use BOOLEAN for boolean values
- Use INTEGER, BIGINT, NUMERIC for numbers
- Use UUID for UUID columns (with gen_random_uuid() default)
- Use JSONB for JSON data`

    case 'mysql':
      return `- Use INT AUTO_INCREMENT for auto-incrementing primary keys
- Use VARCHAR(n) for bounded strings, TEXT for unbounded
- Use DATETIME or TIMESTAMP for timestamps
- Use TINYINT(1) for boolean values
- Use INT, BIGINT, DECIMAL for numbers
- Use CHAR(36) for UUID columns
- Use JSON for JSON data`

    case 'sqlite':
      return `- Use INTEGER PRIMARY KEY for auto-incrementing primary keys (SQLite ROWID alias)
- Use TEXT for strings
- Use TEXT for timestamps (ISO 8601 format)
- Use INTEGER for boolean values (0/1)
- Use INTEGER, REAL for numbers
- Use TEXT for UUID columns
- Use TEXT for JSON data`

    case 'sqlserver':
      return `- Use INT IDENTITY(1,1) for auto-incrementing primary keys
- Use NVARCHAR(n) for unicode strings, NVARCHAR(MAX) for unbounded
- Use DATETIME2 for timestamps
- Use BIT for boolean values
- Use INT, BIGINT, DECIMAL for numbers
- Use UNIQUEIDENTIFIER for UUID columns (with NEWID() default)
- Use NVARCHAR(MAX) for JSON data`

    default:
      return 'Use appropriate types for the target dialect.'
  }
}

export function getSchemaAgentToolDefinitions() {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'introspect_database',
        description:
          'Load the current schema from a connected database. Use this when the user wants to start from an existing database or when you need to understand what already exists.',
        parameters: {
          type: 'object',
          properties: {
            connectionId: {
              type: 'string',
              description: 'The ID of the database connection to introspect'
            }
          },
          required: ['connectionId']
        }
      }
    },
    {
      type: 'function' as const,
      function: {
        name: 'propose_schema',
        description:
          'Create or update the schema design. This updates the visual ERD canvas. Always include a changelog describing what changed.',
        parameters: {
          type: 'object',
          properties: {
            schema: {
              type: 'object',
              description: 'The complete SchemaDesign JSON object'
            },
            changelog: {
              type: 'array',
              items: { type: 'string' },
              description:
                'List of human-readable changes (e.g. "Added users table", "Added FK from posts.author_id to users.id")'
            }
          },
          required: ['schema', 'changelog']
        }
      }
    },
    {
      type: 'function' as const,
      function: {
        name: 'validate_schema',
        description:
          'Check a schema design for errors before proposing it. Use this to catch issues like orphan foreign keys, missing primary keys, or duplicate table names.',
        parameters: {
          type: 'object',
          properties: {
            schema: {
              type: 'object',
              description: 'The SchemaDesign JSON to validate'
            }
          },
          required: ['schema']
        }
      }
    },
    {
      type: 'function' as const,
      function: {
        name: 'generate_ddl',
        description:
          'Generate SQL DDL statements from the current schema. Use mode "create" for new schemas, "migrate" when evolving an existing one.',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['create', 'migrate'],
              description:
                '"create" for full CREATE TABLE statements, "migrate" for ALTER TABLE based on diff'
            }
          },
          required: ['mode']
        }
      }
    },
    {
      type: 'function' as const,
      function: {
        name: 'execute_ddl',
        description:
          'Execute DDL statements against the connected database. This requires user approval before execution. Only use when the user has explicitly asked to apply the schema.',
        parameters: {
          type: 'object',
          properties: {
            statements: {
              type: 'array',
              items: { type: 'string' },
              description: 'SQL DDL statements to execute'
            }
          },
          required: ['statements']
        }
      }
    }
  ]
}

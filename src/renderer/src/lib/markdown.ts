import { marked } from 'marked'
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'br',
  'code',
  'pre',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'hr',
  'span',
  'div'
]

export function renderMarkdown(content: string): string {
  if (!content.trim()) return ''
  const rawHtml = marked.parse(content, { async: false }) as string
  return DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS })
}

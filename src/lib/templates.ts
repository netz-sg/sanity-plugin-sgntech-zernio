import type {SocialPostValue} from './types'

/**
 * A reusable caption, first comment and hashtag set.
 *
 * @public
 */
export interface TemplateValue {
  _id?: string
  _type?: string
  /** Name in the picker. */
  title?: string
  caption?: string
  firstComment?: string
  hashtags?: string[]
  /** Where the hashtags go when the template is applied. Defaults to the caption. */
  hashtagPlacement?: 'caption' | 'firstComment'
}

/**
 * The pieces of a template that can be applied on their own.
 *
 * @public
 */
export type TemplatePart = 'caption' | 'firstComment' | 'hashtags'

/**
 * The values `{{…}}` placeholders are filled from.
 *
 * @public
 */
export type TemplateContext = Record<string, string | undefined>

/**
 * Fills `{{name}}` placeholders from the context.
 *
 * Anything the context does not know is left standing: a visible `{{artist}}`
 * in the caption is a reminder to fill it in, while a silently emptied one
 * would go out unnoticed.
 *
 * @public
 */
export function fillPlaceholders(
  text: string | undefined,
  context: TemplateContext = {},
): string {
  if (!text) return ''

  const lookup = new Map(
    Object.entries(context).map(([key, value]) => [key.trim().toLowerCase(), value]),
  )

  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) => {
    const value = lookup.get(name.toLowerCase())
    return value === undefined || value === '' ? match : value
  })
}

/**
 * Turns a list of tags into the line that goes into a post.
 *
 * Tags are stored without the `#` as often as with one, and a duplicate tag is
 * a shadowban risk on Instagram — both are cleaned up here rather than in the
 * editor's head.
 *
 * @public
 */
export function hashtagLine(tags: string[] | undefined, context: TemplateContext = {}): string {
  if (!Array.isArray(tags)) return ''

  const seen = new Set<string>()
  const cleaned: string[] = []

  for (const raw of tags) {
    const filled = fillPlaceholders(raw, context)
    const tag = filled.trim().replace(/^#+/, '').replace(/\s+/g, '')
    if (!tag) continue

    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cleaned.push(`#${tag}`)
  }

  return cleaned.join(' ')
}

/** Appends a block to a text, keeping a blank line between the two. */
function append(text: string, block: string): string {
  if (!block) return text
  if (!text.trim()) return block
  return `${text.replace(/\s+$/, '')}\n\n${block}`
}

/**
 * The context a post offers its own templates: its title, the day it is
 * scheduled for, and the post type.
 *
 * @public
 */
export function templateContext(
  post: SocialPostValue | undefined,
  extra: TemplateContext = {},
): TemplateContext {
  const raw = (post?.scheduledFor ?? '').trim()
  const when = raw ? new Date(raw) : undefined
  const valid = when && !Number.isNaN(when.getTime()) ? when : undefined

  return {
    title: post?.title,
    kind: post?.kind,
    date: valid?.toLocaleDateString(),
    time: valid
      ? `${String(valid.getHours()).padStart(2, '0')}:${String(valid.getMinutes()).padStart(2, '0')}`
      : undefined,
    accounts: (post?.targets ?? [])
      .map((target) => target.label)
      .filter(Boolean)
      .join(', '),
    ...extra,
  }
}

/**
 * Applies the chosen parts of a template to a post.
 *
 * Caption and first comment are replaced — that is what picking a template
 * means. Hashtags are appended, because they belong under whatever text is
 * already there.
 *
 * @public
 */
export function applyTemplate(
  post: SocialPostValue | undefined,
  template: TemplateValue | undefined,
  parts: TemplatePart[],
  context: TemplateContext = {},
): Partial<SocialPostValue> {
  if (!template || parts.length === 0) return {}

  const wanted = new Set(parts)
  const patch: Partial<SocialPostValue> = {}

  let content = post?.content ?? ''
  let firstComment = post?.firstComment ?? ''

  if (wanted.has('caption') && template.caption !== undefined) {
    content = fillPlaceholders(template.caption, context)
    patch.content = content
  }

  if (wanted.has('firstComment') && template.firstComment !== undefined) {
    firstComment = fillPlaceholders(template.firstComment, context)
    patch.firstComment = firstComment
  }

  if (wanted.has('hashtags')) {
    const line = hashtagLine(template.hashtags, context)
    if (line && template.hashtagPlacement === 'firstComment') {
      patch.firstComment = append(firstComment, line)
    } else if (line) {
      patch.content = append(content, line)
    }
  }

  return patch
}

import {Box, Button, Card, Flex, Select, Stack, Text} from '@sanity/ui'
import {useState} from 'react'

import {useTemplates} from '../hooks/useTemplates'
import {
  applyTemplate,
  templateContext,
  type TemplatePart,
  type TemplateValue,
} from '../lib/templates'
import type {SocialPostValue} from '../lib/types'

/**
 * Picks a template and applies parts of it to the post.
 *
 * The parts are separate buttons on purpose: hashtags get reused far more often
 * than the caption they were written with, and picking a whole template to keep
 * one line of it is how people end up not using templates at all.
 *
 * @public
 */
export function TemplateBar(props: {
  templateType: string
  post: SocialPostValue
  onApply: (patch: Partial<SocialPostValue>) => void
}): React.JSX.Element | null {
  const {templateType, post, onApply} = props
  const {templates, loading} = useTemplates(templateType)
  const [selected, setSelected] = useState('')

  const template: TemplateValue | undefined = templates.find((entry) => entry._id === selected)

  const apply = (parts: TemplatePart[]) => {
    const patch = applyTemplate(post, template, parts, templateContext(post))
    if (Object.keys(patch).length > 0) onApply(patch)
  }

  if (loading || templates.length === 0) return null

  const hasHashtags = (template?.hashtags ?? []).length > 0
  const parts: TemplatePart[] = ['caption', 'firstComment', 'hashtags']

  return (
    <Card padding={3} radius={2} border tone="transparent">
      <Stack gap={3}>
        <Flex gap={2} align="center" wrap="wrap">
          <Text size={1} weight="medium">
            Template
          </Text>
          <Box flex={1} style={{minWidth: 160}}>
            <Select value={selected} onChange={(event) => setSelected(event.currentTarget.value)}>
              <option value="">Pick one…</option>
              {templates.map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {entry.title ?? 'Untitled'}
                </option>
              ))}
            </Select>
          </Box>
        </Flex>

        {template && (
          <Flex gap={2} wrap="wrap">
            <Button
              text="Apply all"
              tone="primary"
              mode="ghost"
              fontSize={1}
              disabled={!template.caption && !template.firstComment && !hasHashtags}
              onClick={() => apply(parts)}
            />
            <Button
              text="Caption"
              mode="bleed"
              fontSize={1}
              disabled={!template.caption}
              onClick={() => apply(['caption'])}
            />
            <Button
              text="Hashtags"
              mode="bleed"
              fontSize={1}
              disabled={!hasHashtags}
              onClick={() => apply(['hashtags'])}
            />
            <Button
              text="First comment"
              mode="bleed"
              fontSize={1}
              disabled={!template.firstComment}
              onClick={() => apply(['firstComment'])}
            />
          </Flex>
        )}

        {template && (
          <Text size={0} muted>
            Caption and first comment are replaced, hashtags are appended
            {template.hashtagPlacement === 'firstComment'
              ? ' to the first comment.'
              : ' to the caption.'}{' '}
            Placeholders like {'{{title}}'} are filled in.
          </Text>
        )}
      </Stack>
    </Card>
  )
}

import {Badge, Box, Button, Card, Flex, Radio, Stack, Text, TextArea, TextInput} from '@sanity/ui'
import {useCallback, useState} from 'react'
import {useClient} from 'sanity'

import {useTemplates} from '../hooks/useTemplates'
import {hashtagLine, type TemplateValue} from '../lib/templates'

const API_VERSION = '2024-10-01'

/** Tags typed as one line, the way people write them. */
function parseTags(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
}

function TemplateForm(props: {
  template: TemplateValue
  onSave: (patch: Partial<TemplateValue>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const {template, onSave, onDelete, onClose} = props

  const [title, setTitle] = useState(template.title ?? '')
  const [caption, setCaption] = useState(template.caption ?? '')
  const [firstComment, setFirstComment] = useState(template.firstComment ?? '')
  const [tags, setTags] = useState((template.hashtags ?? []).join(' '))
  const [placement, setPlacement] = useState(template.hashtagPlacement ?? 'caption')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await onSave({
        title: title.trim() || 'Untitled',
        caption,
        firstComment,
        hashtags: parseTags(tags),
        hashtagPlacement: placement,
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padding={4} radius={2} border>
      <Stack gap={4}>
        <Stack gap={2}>
          <Text size={1} weight="medium">
            Name
          </Text>
          <TextInput value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Caption
          </Text>
          <TextArea
            rows={5}
            value={caption}
            onChange={(event) => setCaption(event.currentTarget.value)}
            placeholder="Out now: {{title}} — from {{date}}"
          />
          <Text size={0} muted>
            {'{{title}}'}, {'{{date}}'}, {'{{time}}'}, {'{{kind}}'} and {'{{accounts}}'} are filled
            in when the template is applied. Anything else stays visible.
          </Text>
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            First comment
          </Text>
          <TextArea
            rows={2}
            value={firstComment}
            onChange={(event) => setFirstComment(event.currentTarget.value)}
            placeholder="All links in the bio"
          />
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Hashtags
          </Text>
          <TextArea
            rows={3}
            value={tags}
            onChange={(event) => setTags(event.currentTarget.value)}
            placeholder="metal newrelease livemusic"
          />
          <Text size={0} muted>
            Separated by spaces or commas, with or without the #. Preview:{' '}
            {hashtagLine(parseTags(tags)) || '—'}
          </Text>
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Put the hashtags in
          </Text>
          <Flex gap={4}>
            <Flex align="center" gap={2}>
              <Radio
                name="placement"
                checked={placement === 'caption'}
                onChange={() => setPlacement('caption')}
              />
              <Text size={1}>The caption</Text>
            </Flex>
            <Flex align="center" gap={2}>
              <Radio
                name="placement"
                checked={placement === 'firstComment'}
                onChange={() => setPlacement('firstComment')}
              />
              <Text size={1}>The first comment</Text>
            </Flex>
          </Flex>
        </Stack>

        <Flex gap={2} wrap="wrap">
          <Button text="Save" tone="primary" disabled={busy} onClick={() => void save()} />
          <Button text="Cancel" mode="bleed" onClick={onClose} />
          <Box flex={1} />
          {confirmDelete ? (
            <Flex gap={2}>
              <Button
                text="Really delete"
                tone="critical"
                fontSize={1}
                onClick={() => void onDelete()}
              />
              <Button
                text="Keep"
                mode="bleed"
                fontSize={1}
                onClick={() => setConfirmDelete(false)}
              />
            </Flex>
          ) : (
            template._id && (
              <Button
                text="Delete"
                mode="bleed"
                tone="critical"
                fontSize={1}
                onClick={() => setConfirmDelete(true)}
              />
            )
          )}
        </Flex>
      </Stack>
    </Card>
  )
}

/**
 * Templates, managed inside the tool: list, write, change, delete.
 *
 * @public
 */
export function TemplatePanel(props: {templateType: string}): React.JSX.Element {
  const {templateType} = props
  const client = useClient({apiVersion: API_VERSION})
  const {templates, loading, reload} = useTemplates(templateType)
  const [editing, setEditing] = useState<TemplateValue | undefined>()

  const save = useCallback(
    async (template: TemplateValue, patch: Partial<TemplateValue>) => {
      if (template._id) {
        await client.patch(template._id).set(patch).commit({visibility: 'async'})
      } else {
        await client.create({_type: templateType, ...patch})
      }
      reload()
    },
    [client, reload, templateType],
  )

  const remove = useCallback(
    async (template: TemplateValue) => {
      if (!template._id) return
      await client.delete(template._id)
      await client.delete(`drafts.${template._id}`).catch(() => undefined)
      setEditing(undefined)
      reload()
    },
    [client, reload],
  )

  return (
    <Stack gap={4}>
      <Flex align="center" gap={3}>
        <Stack gap={2} flex={1}>
          <Text size={1} weight="medium">
            Templates
          </Text>
          <Text size={0} muted>
            A caption, a first comment and a hashtag set to reuse. Applied whole or in parts, in the
            composer.
          </Text>
        </Stack>
        <Button text="New template" tone="primary" onClick={() => setEditing({})} />
      </Flex>

      {editing && (
        <TemplateForm
          key={editing._id ?? 'new'}
          template={editing}
          onSave={(patch) => save(editing, patch)}
          onDelete={() => remove(editing)}
          onClose={() => setEditing(undefined)}
        />
      )}

      {!loading && templates.length === 0 && !editing && (
        <Card padding={4} radius={2} border tone="transparent">
          <Text size={1} muted>
            No templates yet.
          </Text>
        </Card>
      )}

      <Stack gap={2}>
        {templates.map((template) => (
          <Card key={template._id} padding={3} radius={2} border>
            <Flex align="center" gap={3} wrap="wrap">
              <Stack gap={2} flex={1} style={{minWidth: 200}}>
                <Flex align="center" gap={2}>
                  <Text size={1} weight="medium">
                    {template.title ?? 'Untitled'}
                  </Text>
                  {template.caption && <Badge>caption</Badge>}
                  {template.firstComment && <Badge>first comment</Badge>}
                  {(template.hashtags ?? []).length > 0 && (
                    <Badge tone="primary">{template.hashtags?.length} hashtags</Badge>
                  )}
                </Flex>
                <Text size={0} muted textOverflow="ellipsis">
                  {(template.caption ?? '').slice(0, 120) || 'no caption'}
                </Text>
              </Stack>
              <Button text="Edit" mode="ghost" onClick={() => setEditing(template)} />
            </Flex>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}

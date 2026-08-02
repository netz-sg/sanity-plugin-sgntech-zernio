import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Stack,
  Switch,
  Text,
  TextArea,
  TextInput,
} from '@sanity/ui'
import {useCallback, useMemo, useRef, useState} from 'react'
import {useClient} from 'sanity'

import {useZernioClient, useZernioSettings} from '../hooks/useZernio'
import {deliveryUrl, isVideo} from '../lib/media'
import {canSend} from '../lib/rules'
import {sendPost} from '../lib/send'
import type {PostKind, PostStatus, SocialMediaItem, SocialPostValue} from '../lib/types'
import {MediaEditor} from './MediaEditor'
import {PlatformIcon} from './PlatformIcon'
import {PostPreview} from './PostPreview'
import {TemplateBar} from './TemplateBar'

const API_VERSION = '2024-10-01'
const KINDS: PostKind[] = ['feed', 'carousel', 'story', 'reel']

/** The fields the composer owns. Everything else on the document is left alone. */
const OWNED = [
  'title',
  'kind',
  'content',
  'firstComment',
  'media',
  'targets',
  'publishNow',
  'scheduledFor',
  'timezone',
] as const

/** `YYYY-MM-DDTHH:mm` for the datetime input, in local time. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function startTime(post: SocialPostValue | undefined, initialDay: string | undefined): string {
  const raw = (post?.scheduledFor ?? '').trim()
  if (raw) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return toLocalInput(parsed)
  }
  return toLocalInput(initialDay ? new Date(`${initialDay}T12:00:00`) : new Date(Date.now() + 3600_000))
}

/**
 * Write, edit and publish a post without leaving the tool.
 *
 * The document is still written — that is what keeps history, roles and the
 * status write-back working — but nothing here sends anyone to the desk.
 *
 * @public
 */
export function Composer(props: {
  documentType: string
  templateType: string
  /** The post being edited, or nothing for a new one. */
  post?: SocialPostValue
  initialDay?: string
  onSent: () => void
  onChanged: () => void
  onDeleted?: () => void
  onNewTemplate?: () => void
}): React.JSX.Element {
  const {
    documentType,
    templateType,
    post,
    initialDay,
    onSent,
    onChanged,
    onDeleted,
    onNewTemplate,
  } = props
  const client = useClient({apiVersion: API_VERSION})
  const {settings} = useZernioSettings()
  const zernio = useZernioClient(settings.apiKey)
  const fileInput = useRef<HTMLInputElement>(null)

  const [postId, setPostId] = useState(post?._id)
  const [title, setTitle] = useState(post?.title ?? '')
  const [kind, setKind] = useState<PostKind>(post?.kind ?? 'feed')
  const [content, setContent] = useState(post?.content ?? '')
  const [firstComment, setFirstComment] = useState(post?.firstComment ?? '')
  const [media, setMedia] = useState<SocialMediaItem[]>(post?.media ?? [])
  const [accountIds, setAccountIds] = useState<string[]>(
    (post?.targets ?? []).map((target) => target.accountId ?? '').filter(Boolean),
  )
  const [publishNow, setPublishNow] = useState(post?.publishNow ?? false)
  const [when, setWhen] = useState(() => startTime(post, initialDay))
  const [editing, setEditing] = useState<string | undefined>()
  const [busy, setBusy] = useState<string | undefined>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [note, setNote] = useState<{tone: 'positive' | 'critical'; text: string} | undefined>()

  const status: PostStatus = post?.status ?? 'draft'
  const sent = Boolean(post?.zernioPostId)
  const editingItem = media.find((item) => (item._key ?? '') === editing)

  const accounts = useMemo(
    () =>
      (settings.accounts ?? []).filter((account) =>
        ['instagram', 'facebook'].includes((account.platform ?? '').toLowerCase()),
      ),
    [settings.accounts],
  )

  const value: SocialPostValue = useMemo(
    () => ({
      _id: postId,
      title: title.trim() || 'Untitled',
      kind,
      content,
      // Only Instagram feed and carousel have one; sending it elsewhere is noise.
      firstComment:
        (kind === 'feed' || kind === 'carousel') && firstComment.trim() ? firstComment : undefined,
      media,
      publishNow,
      scheduledFor: publishNow ? undefined : new Date(when).toISOString(),
      timezone: settings.timezone || 'UTC',
      targets: accountIds.map((id) => {
        const account = accounts.find((entry) => entry.accountId === id)
        return {
          _key: id,
          accountId: id,
          platform: (account?.platform ?? '').toLowerCase(),
          label: account?.name ?? account?.username ?? id,
        }
      }),
      status,
      zernioPostId: post?.zernioPostId,
    }),
    [
      accountIds,
      accounts,
      content,
      firstComment,
      kind,
      media,
      post?.zernioPostId,
      postId,
      publishNow,
      settings.timezone,
      status,
      title,
      when,
    ],
  )

  /** Writes the post and returns its id, creating the document the first time. */
  const store = useCallback(
    async (nextStatus: PostStatus) => {
      const fields = Object.fromEntries(OWNED.map((field) => [field, value[field] ?? null]))

      if (postId) {
        // Only the fields the composer owns are touched — results, the Zernio id
        // and anything a project added to the type stay as they are.
        await client
          .patch(postId)
          .set({...fields, status: nextStatus})
          .commit({visibility: 'async'})
        return postId
      }

      const created = await client.create({_type: documentType, ...value, status: nextStatus})
      setPostId(created._id)
      return created._id
    },
    [client, documentType, postId, value],
  )

  const save = useCallback(async () => {
    setBusy('save')
    setNote(undefined)

    try {
      await store(sent ? status : 'draft')
      setNote({tone: 'positive', text: 'Saved'})
      onChanged()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Could not save'})
    } finally {
      setBusy(undefined)
    }
  }, [onChanged, sent, status, store])

  const send = useCallback(async () => {
    if (!zernio) {
      setNote({tone: 'critical', text: 'No API key stored — see Settings.'})
      return
    }

    setBusy('send')
    setNote(undefined)

    try {
      const id = await store('ready')
      const outcome = await sendPost(client, zernio, {...value, _id: id})

      setNote({tone: outcome.ok ? 'positive' : 'critical', text: outcome.message})
      if (outcome.ok) onSent()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Unknown error'})
    } finally {
      setBusy(undefined)
    }
  }, [client, onSent, store, value, zernio])

  const remove = useCallback(async () => {
    if (!postId) return
    setBusy('delete')

    try {
      // The draft goes too, otherwise the post reappears the next time anyone
      // opens it in the desk.
      await client.delete(postId)
      await client.delete(`drafts.${postId.replace(/^drafts\./, '')}`).catch(() => undefined)
      onDeleted?.()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Could not delete'})
    } finally {
      setBusy(undefined)
    }
  }, [client, onDeleted, postId])

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBusy('upload')
      setNote(undefined)

      try {
        const uploaded = await Promise.all(
          Array.from(files).map(async (file) => {
            const video = file.type.startsWith('video/')
            const asset = await client.assets.upload(video ? 'file' : 'image', file, {
              filename: file.name,
            })

            return {
              _key: asset._id,
              _type: video ? 'video' : 'photo',
              asset: {
                _id: asset._id,
                url: asset.url,
                size: asset.size,
                mimeType: asset.mimeType,
                metadata: asset.metadata,
              },
            }
          }),
        )

        setMedia((current) => [...current, ...uploaded])
      } catch (error) {
        setNote({
          tone: 'critical',
          text: error instanceof Error ? error.message : 'Upload failed',
        })
      } finally {
        setBusy(undefined)
      }
    },
    [client],
  )

  return (
    <Box style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24}}>
      <Stack gap={4}>
        <Flex align="center" gap={2}>
          <Text size={1} weight="medium">
            {postId ? 'Editing a post' : 'New post'}
          </Text>
          {postId && <Badge tone={sent ? 'positive' : 'default'}>{status}</Badge>}
          {sent && <Badge tone="primary">in Zernio</Badge>}
        </Flex>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Internal name
          </Text>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="Only shown inside the Studio"
          />
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Post type
          </Text>
          <Flex gap={2} wrap="wrap">
            {KINDS.map((entry) => (
              <Button
                key={entry}
                text={entry}
                mode={kind === entry ? 'default' : 'ghost'}
                tone={kind === entry ? 'primary' : 'default'}
                onClick={() => setKind(entry)}
              />
            ))}
          </Flex>
        </Stack>

        <TemplateBar
          templateType={templateType}
          post={value}
          onCreate={onNewTemplate}
          onApply={(patch) => {
            if (patch.content !== undefined) setContent(patch.content)
            if (patch.firstComment !== undefined) setFirstComment(patch.firstComment)
          }}
        />

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Caption
          </Text>
          <TextArea
            rows={6}
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
            placeholder="What goes out…"
          />
        </Stack>

        {(kind === 'feed' || kind === 'carousel') && (
          <Stack gap={2}>
            <Text size={1} weight="medium">
              First comment
            </Text>
            <TextArea
              rows={2}
              value={firstComment}
              onChange={(event) => setFirstComment(event.currentTarget.value)}
              placeholder="Posted right after publishing — Instagram feed and carousel only"
            />
          </Stack>
        )}

        <Stack gap={2}>
          <Flex align="center" gap={2}>
            <Text size={1} weight="medium">
              Media
            </Text>
            <Box flex={1} />
            <Button
              text="Add image or video"
              mode="ghost"
              disabled={busy === 'upload'}
              onClick={() => fileInput.current?.click()}
            />
          </Flex>

          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(event) => void upload(event.currentTarget.files)}
          />

          {media.length === 0 && (
            <Text size={0} muted>
              Add an image and “Adjust” lets you move and zoom it inside the frame the post type
              will show — with Instagram's safe zones for stories and reels.
            </Text>
          )}

          {media.length > 0 && (
            <Flex gap={2} wrap="wrap">
              {media.map((item, index) => {
                const key = item._key ?? String(index)
                const video = isVideo(item)

                return (
                  <Card key={key} radius={2} border overflow="hidden">
                    <Box style={{width: 84, height: 84, position: 'relative'}}>
                      {!video && deliveryUrl(item, kind) ? (
                        <img
                          src={deliveryUrl(item, kind)}
                          alt=""
                          style={{width: '100%', height: '100%', objectFit: 'cover'}}
                        />
                      ) : (
                        <Flex align="center" justify="center" style={{height: '100%'}}>
                          <Text size={0}>video</Text>
                        </Flex>
                      )}
                    </Box>
                    <Flex>
                      <Button
                        text={editing === key ? 'Close' : 'Adjust'}
                        mode="bleed"
                        fontSize={0}
                        padding={2}
                        disabled={video}
                        onClick={() => setEditing(editing === key ? undefined : key)}
                      />
                      <Button
                        text="Remove"
                        mode="bleed"
                        tone="critical"
                        fontSize={0}
                        padding={2}
                        onClick={() => {
                          setEditing(undefined)
                          setMedia((current) => current.filter((_, i) => i !== index))
                        }}
                      />
                    </Flex>
                  </Card>
                )
              })}
            </Flex>
          )}

          {editingItem && (
            <MediaEditor
              key={editing}
              item={editingItem}
              kind={kind}
              onChange={(crop) =>
                setMedia((current) =>
                  current.map((entry) => ((entry._key ?? '') === editing ? {...entry, crop} : entry)),
                )
              }
              onClose={() => setEditing(undefined)}
            />
          )}
        </Stack>

        <Stack gap={2}>
          <Text size={1} weight="medium">
            Accounts
          </Text>
          {accounts.length === 0 ? (
            <Card padding={3} radius={2} border tone="caution">
              <Text size={1}>No accounts loaded. Open Settings and press “Reload accounts”.</Text>
            </Card>
          ) : (
            <Stack gap={2}>
              {accounts.map((account) => {
                const checked = accountIds.includes(account.accountId)
                return (
                  <Card
                    key={account.accountId}
                    padding={2}
                    radius={2}
                    border
                    tone={checked ? 'primary' : 'default'}
                  >
                    <Flex align="center" gap={3}>
                      <Checkbox
                        checked={checked}
                        onChange={(event) => {
                          // Read before the updater runs — by then React has
                          // released the event and `currentTarget` is null.
                          const {checked: on} = event.currentTarget
                          setAccountIds((current) =>
                            on
                              ? [...current, account.accountId]
                              : current.filter((id) => id !== account.accountId),
                          )
                        }}
                      />
                      <PlatformIcon platform={account.platform} />
                      <Text size={1}>{account.name ?? account.username ?? account.accountId}</Text>
                      {account.disconnected && <Badge tone="critical">disconnected</Badge>}
                    </Flex>
                  </Card>
                )
              })}
            </Stack>
          )}
        </Stack>

        <Stack gap={3}>
          <Flex align="center" gap={3}>
            <Switch
              checked={publishNow}
              onChange={(event) => setPublishNow(event.currentTarget.checked)}
            />
            <Text size={1}>Publish immediately</Text>
          </Flex>

          {!publishNow && (
            <Stack gap={2}>
              <TextInput
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.currentTarget.value)}
              />
              <Text size={0} muted>
                Read in {settings.timezone || 'UTC'} — change it under Settings.
              </Text>
            </Stack>
          )}
        </Stack>

        {note && (
          <Card padding={3} radius={2} border tone={note.tone}>
            <Text size={1}>{note.text}</Text>
          </Card>
        )}

        {sent && (
          <Card padding={3} radius={2} border tone="caution">
            <Text size={1}>
              This post is already with Zernio. Editing it here changes the document, not what was
              handed over — send it again to replace it.
            </Text>
          </Card>
        )}

        <Flex gap={2} wrap="wrap">
          <Button
            text={publishNow ? 'Publish now' : 'Schedule'}
            tone="primary"
            disabled={!canSend(value) || busy === 'send'}
            onClick={() => void send()}
          />
          <Button
            text={postId ? 'Save' : 'Save as draft'}
            mode="ghost"
            disabled={busy === 'save'}
            onClick={() => void save()}
          />
          <Box flex={1} />
          {postId &&
            (confirmDelete ? (
              <Flex gap={2}>
                <Button
                  text="Really delete"
                  tone="critical"
                  fontSize={1}
                  disabled={busy === 'delete'}
                  onClick={() => void remove()}
                />
                <Button
                  text="Keep"
                  mode="bleed"
                  fontSize={1}
                  onClick={() => setConfirmDelete(false)}
                />
              </Flex>
            ) : (
              <Button
                text="Delete"
                mode="bleed"
                tone="critical"
                fontSize={1}
                onClick={() => setConfirmDelete(true)}
              />
            ))}
        </Flex>
      </Stack>

      <Box style={{width: 320}}>
        <Stack gap={3}>
          <Text size={1} weight="medium">
            Preview
          </Text>
          <PostPreview value={value} />
        </Stack>
      </Box>
    </Box>
  )
}

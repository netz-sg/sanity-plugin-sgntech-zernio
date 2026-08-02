import {AddIcon} from '@sanity/icons/Add'
import {CropIcon} from '@sanity/icons/Crop'
import {ImageIcon} from '@sanity/icons/Image'
import {PublishIcon} from '@sanity/icons/Publish'
import {TrashIcon} from '@sanity/icons/Trash'
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
import {canSend, rulesFor} from '../lib/rules'
import {sendPost} from '../lib/send'
import type {PostKind, PostStatus, SocialMediaItem, SocialPostValue} from '../lib/types'
import {MediaEditor} from './MediaEditor'
import {PlatformIcon} from './PlatformIcon'
import {PostPreview} from './PostPreview'
import {TemplateBar} from './TemplateBar'
import {EmptyState, Field, Section, StatusPill} from './ui'

const API_VERSION = '2024-10-01'

const KINDS: {value: PostKind; label: string; note: string}[] = [
  {value: 'feed', label: 'Feed', note: '4:5 · one image'},
  {value: 'carousel', label: 'Carousel', note: '4:5 · 2–10 images'},
  {value: 'story', label: 'Story', note: '9:16 · 24 hours'},
  {value: 'reel', label: 'Reel', note: '9:16 · video'},
]

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
  return toLocalInput(
    initialDay ? new Date(`${initialDay}T12:00:00`) : new Date(Date.now() + 3600_000),
  )
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

  const limits = rulesFor(value.targets?.[0]?.platform, kind)
  const captionHint = `${content.length} / ${limits.maxContent} · fold at ${limits.foldAt}`

  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)',
        alignItems: 'start',
        gap: 16,
      }}
    >
      <Stack gap={3}>
        <Section
          title={postId ? 'Editing a post' : 'New post'}
          actions={
            <Flex gap={2} align="center">
              {postId && <StatusPill status={status} />}
              {sent && <Badge tone="primary">in Zernio</Badge>}
            </Flex>
          }
        >
          <Stack gap={4}>
            <Field label="Internal name" description="Only ever shown inside the Studio.">
              <TextInput
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="Album announcement"
              />
            </Field>

            <Field label="Post type">
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 8,
                }}
              >
                {KINDS.map((entry) => {
                  const active = kind === entry.value
                  return (
                    <Card
                      key={entry.value}
                      as="button"
                      padding={3}
                      radius={2}
                      border
                      tone={active ? 'primary' : 'default'}
                      pressed={active}
                      onClick={() => setKind(entry.value)}
                      style={{cursor: 'pointer', textAlign: 'left'}}
                    >
                      <Stack gap={2}>
                        <Text size={1} weight="medium">
                          {entry.label}
                        </Text>
                        <Text size={0} muted>
                          {entry.note}
                        </Text>
                      </Stack>
                    </Card>
                  )
                })}
              </Box>
            </Field>
          </Stack>
        </Section>

        <Section title="Text">
          <Stack gap={4}>
            <TemplateBar
              templateType={templateType}
              post={value}
              onCreate={onNewTemplate}
              onApply={(patch) => {
                if (patch.content !== undefined) setContent(patch.content)
                if (patch.firstComment !== undefined) setFirstComment(patch.firstComment)
              }}
            />

            <Field label="Caption" hint={captionHint}>
              <TextArea
                rows={7}
                value={content}
                onChange={(event) => setContent(event.currentTarget.value)}
                placeholder="What goes out…"
              />
            </Field>

            {(kind === 'feed' || kind === 'carousel') && (
              <Field
                label="First comment"
                description="Posted right after publishing. Instagram feed and carousel only."
              >
                <TextArea
                  rows={2}
                  value={firstComment}
                  onChange={(event) => setFirstComment(event.currentTarget.value)}
                  placeholder="All links in the bio"
                />
              </Field>
            )}
          </Stack>
        </Section>

        <Section
          title="Media"
          actions={
            <Button
              text="Add"
              icon={AddIcon}
              mode="ghost"
              fontSize={1}
              disabled={busy === 'upload'}
              onClick={() => fileInput.current?.click()}
            />
          }
        >
          <Stack gap={3}>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(event) => void upload(event.currentTarget.files)}
            />

            {media.length === 0 && (
              <EmptyState
                icon={<ImageIcon />}
                title={busy === 'upload' ? 'Uploading…' : 'No media yet'}
                description="Add a picture and “Adjust” moves and zooms it inside the frame this post type will show — with Instagram's safe zones for stories and reels."
                action={
                  <Button
                    text="Add image or video"
                    icon={AddIcon}
                    mode="ghost"
                    disabled={busy === 'upload'}
                    onClick={() => fileInput.current?.click()}
                  />
                }
              />
            )}

            {media.length > 0 && (
              <Flex gap={3} wrap="wrap">
                {media.map((item, index) => {
                  const key = item._key ?? String(index)
                  const video = isVideo(item)
                  const open = editing === key

                  return (
                    <Card
                      key={key}
                      radius={2}
                      border
                      overflow="hidden"
                      tone={open ? 'primary' : 'default'}
                    >
                      <Box style={{width: 96, height: 96, position: 'relative'}}>
                        {!video && deliveryUrl(item, kind) ? (
                          <img
                            src={deliveryUrl(item, kind)}
                            alt=""
                            style={{width: '100%', height: '100%', objectFit: 'cover'}}
                          />
                        ) : (
                          <Flex align="center" justify="center" style={{height: '100%'}}>
                            <Text size={0} muted>
                              video
                            </Text>
                          </Flex>
                        )}
                        <Box style={{position: 'absolute', top: 4, left: 4}}>
                          <Badge fontSize={0}>{index + 1}</Badge>
                        </Box>
                      </Box>
                      <Flex>
                        <Button
                          icon={CropIcon}
                          title={open ? 'Close' : 'Adjust'}
                          aria-label={open ? 'Close' : 'Adjust'}
                          mode="bleed"
                          fontSize={0}
                          padding={2}
                          disabled={video}
                          onClick={() => setEditing(open ? undefined : key)}
                        />
                        <Button
                          icon={TrashIcon}
                          title="Remove"
                          aria-label="Remove"
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
                    current.map((entry) =>
                      (entry._key ?? '') === editing ? {...entry, crop} : entry,
                    ),
                  )
                }
                onClose={() => setEditing(undefined)}
              />
            )}
          </Stack>
        </Section>

        <Section
          title="Accounts"
          description={
            accountIds.length > 0 ? `${accountIds.length} selected` : 'Where this post goes.'
          }
        >
          {accounts.length === 0 ? (
            <EmptyState
              title="No accounts loaded"
              description="Open Settings, save your API key and press “Reload accounts”."
            />
          ) : (
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8,
              }}
            >
              {accounts.map((account) => {
                const checked = accountIds.includes(account.accountId)
                return (
                  <Card
                    key={account.accountId}
                    padding={3}
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
                      <PlatformIcon platform={account.platform} size={16} />
                      <Box flex={1} style={{minWidth: 0}}>
                        <Text size={1} textOverflow="ellipsis">
                          {account.name ?? account.username ?? account.accountId}
                        </Text>
                      </Box>
                      {account.disconnected && (
                        <Badge tone="critical" fontSize={0}>
                          off
                        </Badge>
                      )}
                    </Flex>
                  </Card>
                )
              })}
            </Box>
          )}
        </Section>

        <Section title="When">
          <Stack gap={4}>
            <Flex align="center" gap={3}>
              <Switch
                checked={publishNow}
                onChange={(event) => setPublishNow(event.currentTarget.checked)}
              />
              <Text size={1}>Publish immediately</Text>
            </Flex>

            {!publishNow && (
              <Field label="Scheduled for" hint={settings.timezone || 'UTC'}>
                <TextInput
                  type="datetime-local"
                  value={when}
                  onChange={(event) => setWhen(event.currentTarget.value)}
                />
              </Field>
            )}
          </Stack>
        </Section>
      </Stack>

      <Box style={{position: 'sticky', top: 0}}>
        <Stack gap={3}>
          <Card padding={3} radius={3} border>
            <Stack gap={3}>
              <Button
                text={publishNow ? 'Publish now' : 'Schedule'}
                icon={PublishIcon}
                tone="primary"
                disabled={!canSend(value) || busy === 'send'}
                loading={busy === 'send'}
                onClick={() => void send()}
              />
              <Flex gap={2}>
                <Box flex={1}>
                  <Button
                    text={postId ? 'Save' : 'Save as draft'}
                    mode="ghost"
                    disabled={busy === 'save'}
                    loading={busy === 'save'}
                    onClick={() => void save()}
                    style={{width: '100%'}}
                  />
                </Box>
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
                      icon={TrashIcon}
                      title="Delete"
                      aria-label="Delete"
                      mode="bleed"
                      tone="critical"
                      onClick={() => setConfirmDelete(true)}
                    />
                  ))}
              </Flex>

              {note && (
                <Card padding={3} radius={2} tone={note.tone} border>
                  <Text size={1}>{note.text}</Text>
                </Card>
              )}

              {sent && (
                <Card padding={3} radius={2} tone="caution" border>
                  <Text size={0}>
                    Already with Zernio. Editing here changes the document, not what was handed
                    over — send it again to replace it.
                  </Text>
                </Card>
              )}
            </Stack>
          </Card>

          <Section title="Preview">
            <PostPreview value={value} />
          </Section>
        </Stack>
      </Box>
    </Box>
  )
}

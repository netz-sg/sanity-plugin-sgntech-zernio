import {ComposeIcon} from '@sanity/icons/Compose'
import {RefreshIcon} from '@sanity/icons/Refresh'
import {Box, Button, Card, Container, Flex, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {useCallback, useState} from 'react'

import {usePosts} from '../hooks/usePosts'
import {useRemotePosts} from '../hooks/useRemotePosts'
import {useZernioSettings} from '../hooks/useZernio'
import type {SocialPostValue} from '../lib/types'
import {CalendarView} from './CalendarView'
import {Composer} from './Composer'
import {PostDetail} from './PostDetail'
import {PostList} from './PostList'
import {SettingsPanel} from './SettingsPanel'
import {ensureZernioStyles} from './styles'
import {TemplatePanel} from './TemplatePanel'
import {ZernioIcon} from './ZernioIcon'

type TabValue = 'compose' | 'calendar' | 'posts' | 'templates' | 'settings'

const TABS: {value: TabValue; label: string}[] = [
  {value: 'compose', label: 'Compose'},
  {value: 'calendar', label: 'Calendar'},
  {value: 'posts', label: 'Posts'},
  {value: 'templates', label: 'Templates'},
  {value: 'settings', label: 'Settings'},
]

/** Green when the tool can talk to Zernio, amber while it cannot. */
function StatusDot(props: {ok: boolean}): React.JSX.Element {
  return (
    <Box
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: props.ok ? '#16a34a' : '#d97706',
      }}
    />
  )
}

/**
 * Props the plugin hands to the tool.
 *
 * @public
 */
export interface ZernioToolProps {
  documentType: string
  templateType: string
}

/**
 * The cockpit: calendar, list and settings in one place.
 *
 * @public
 */
export function ZernioTool(props: {options?: ZernioToolProps}): React.JSX.Element {
  ensureZernioStyles()
  const documentType = props.options?.documentType ?? 'socialPost'
  const templateType = props.options?.templateType ?? 'zernioTemplate'
  const [tab, setTab] = useState<TabValue>('compose')
  const [composeDay, setComposeDay] = useState<string | undefined>()
  const [editingPost, setEditingPost] = useState<SocialPostValue | undefined>()
  const [detailId, setDetailId] = useState<string | undefined>()
  // Bumped to start the composer over — its fields are local state.
  const [composeKey, setComposeKey] = useState(0)
  const [generation, setGeneration] = useState(0)
  const {settings, loading: settingsLoading} = useZernioSettings()
  const {posts, loading, reload} = usePosts(documentType)
  const {remote, error: remoteError} = useRemotePosts(posts, generation)

  const refresh = useCallback(() => {
    reload()
    setGeneration((current) => current + 1)
  }, [reload])

  /** Opens the composer empty, on a day when the calendar asked for one. */
  const create = useCallback((dayKey?: string) => {
    setDetailId(undefined)
    setEditingPost(undefined)
    setComposeDay(dayKey)
    setComposeKey((current) => current + 1)
    setTab('compose')
  }, [])

  /** Opens the detail page of a post — the calendar and the list both land here. */
  const open = useCallback((post: SocialPostValue) => {
    setDetailId(post._id)
  }, [])

  /** Detail page to composer, with the post loaded. */
  const edit = useCallback((post: SocialPostValue) => {
    setDetailId(undefined)
    setEditingPost(post)
    setComposeDay(undefined)
    setComposeKey((current) => current + 1)
    setTab('compose')
  }, [])

  /** A copy of a post, opened in the composer as a fresh draft. */
  const duplicate = useCallback((post: SocialPostValue) => {
    // Everything that ties a post to Zernio is dropped: a copy is a new post.
    const rest = {
      title: post.title,
      kind: post.kind,
      content: post.content,
      firstComment: post.firstComment,
      media: post.media,
      targets: post.targets,
      publishNow: post.publishNow,
      scheduledFor: post.scheduledFor,
      timezone: post.timezone,
    }
    setDetailId(undefined)
    setEditingPost({...rest, title: `${post.title ?? 'Untitled'} (copy)`, status: 'draft'})
    setComposeDay(undefined)
    setComposeKey((current) => current + 1)
    setTab('compose')
  }, [])

  // Read from the live list, so a status that comes back from Zernio while the
  // page is open shows up without reopening it.
  const detailPost = detailId ? posts.find((entry) => entry._id === detailId) : undefined

  const configured = Boolean(settings.apiKey)

  return (
    <Container width={5} padding={4} className="zn-shell">
      <Stack gap={4}>
        <Flex align="center" gap={3} wrap="wrap">
          <div className="zn-brand">
            <Text size={2} style={{color: '#fff'}}>
              <ZernioIcon />
            </Text>
          </div>
          <Stack gap={2} flex={1} style={{minWidth: 180}}>
            <Heading size={2}>Zernio</Heading>
            <Flex align="center" gap={2}>
              <StatusDot ok={configured} />
              <Text size={0} muted>
                {configured ? 'Connected' : 'Not set up'} · {posts.length} post
                {posts.length === 1 ? '' : 's'}
                {remote.length > 0 ? ` · ${remote.length} in Zernio only` : ''}
              </Text>
            </Flex>
          </Stack>
          {(loading || settingsLoading) && <Spinner muted />}
          <Button text="Refresh" icon={RefreshIcon} mode="bleed" onClick={refresh} />
          <Button text="New post" icon={ComposeIcon} tone="primary" onClick={() => create()} />
        </Flex>

        {remoteError && (
          <Card padding={3} radius={2} border tone="caution">
            <Text size={1}>Zernio could not be read: {remoteError}</Text>
          </Card>
        )}

        {!configured && !settingsLoading && (
          <Card padding={4} radius={2} border tone="caution">
            <Stack gap={3}>
              <Text weight="medium">Not set up yet</Text>
              <Text size={1}>
                Enter your Zernio API key under Settings, pick a profile and connect an Instagram or
                Facebook account. Posts can be written before that — they just cannot be sent.
              </Text>
            </Stack>
          </Card>
        )}

        {detailPost ? (
          <PostDetail
            post={detailPost}
            onBack={() => setDetailId(undefined)}
            onEdit={edit}
            onDuplicate={duplicate}
            onChanged={refresh}
            onDeleted={() => {
              setDetailId(undefined)
              refresh()
            }}
          />
        ) : (
          <>
            <div className="zn-nav" role="tablist" aria-label="Zernio sections">
              {TABS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.value}
                  onClick={() => setTab(entry.value)}
                >
                  <span className="zn-nav-dot" />
                  {entry.label}
                  {entry.value === 'posts' && posts.length > 0 && (
                    <span className="zn-nav-count">{posts.length}</span>
                  )}
                </button>
              ))}
            </div>

            {tab === 'compose' && (
              <Composer
                key={composeKey}
                documentType={documentType}
                templateType={templateType}
                post={editingPost}
                initialDay={composeDay}
                onSent={refresh}
                onChanged={refresh}
                onDeleted={() => {
                  refresh()
                  create()
                }}
                onNewTemplate={() => setTab('templates')}
              />
            )}

            {tab === 'calendar' && (
              <CalendarView
                posts={posts}
                remote={remote}
                onOpen={open}
                onChanged={refresh}
                onCreate={create}
              />
            )}

            {tab === 'posts' && (
              <PostList
                posts={posts}
                remote={remote}
                onOpen={open}
                onChanged={refresh}
                onCreate={() => create()}
              />
            )}

            {tab === 'templates' && <TemplatePanel templateType={templateType} />}

            {tab === 'settings' && <SettingsPanel />}
          </>
        )}
      </Stack>
    </Container>
  )
}

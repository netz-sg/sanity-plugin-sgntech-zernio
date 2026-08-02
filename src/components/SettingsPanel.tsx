import {RefreshIcon} from '@sanity/icons/Refresh'
import {Badge, Box, Button, Card, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {useCallback, useState} from 'react'
import {useClient} from 'sanity'

import {useZernioSettings} from '../hooks/useZernio'
import {ZernioClient} from '../lib/client'
import {cacheAccounts, clearSetting, keyWarning} from '../lib/settings'
import type {ZernioProfile} from '../lib/types'
import {PlatformIcon} from './PlatformIcon'
import {EmptyState, Field, Section} from './ui'

const API_VERSION = '2024-10-01'
const PLATFORMS = ['instagram', 'facebook']

/**
 * Everything needed to set the plugin up, without touching code: the API key,
 * the profile, the connected accounts and the defaults.
 *
 * @public
 */
export function SettingsPanel(): React.JSX.Element {
  const sanity = useClient({apiVersion: API_VERSION})
  const {settings, save, reload} = useZernioSettings()

  const [key, setKey] = useState('')
  const [busy, setBusy] = useState<string | undefined>()
  const [note, setNote] = useState<
    {tone: 'positive' | 'critical' | 'caution'; text: string} | undefined
  >()
  const [profiles, setProfiles] = useState<ZernioProfile[]>([])
  const [newProfile, setNewProfile] = useState('')

  const run = useCallback(async (label: string, task: () => Promise<void>) => {
    setBusy(label)
    setNote(undefined)
    try {
      await task()
    } catch (error) {
      setNote({tone: 'critical', text: error instanceof Error ? error.message : 'Unknown error'})
    } finally {
      setBusy(undefined)
    }
  }, [])

  const saveKey = useCallback(() => {
    const trimmed = key.trim()
    if (!trimmed) return

    void run('key', async () => {
      const client = new ZernioClient({apiKey: trimmed})
      const check = await client.checkKey()
      if (!check.ok) {
        setNote({tone: 'critical', text: 'Zernio rejected this key'})
        return
      }

      await save({apiKey: trimmed})
      setKey('')

      const warning = keyWarning(check.scope, check.permission)
      setNote(
        warning
          ? {tone: 'caution', text: warning}
          : {tone: 'positive', text: 'Key saved and accepted'},
      )
    })
  }, [key, run, save])

  const loadProfiles = useCallback(() => {
    const apiKey = settings.apiKey
    if (!apiKey) return

    void run('profiles', async () => {
      setProfiles(await new ZernioClient({apiKey}).listProfiles())
    })
  }, [run, settings.apiKey])

  const createProfile = useCallback(() => {
    const name = newProfile.trim()
    const apiKey = settings.apiKey
    if (!apiKey || !name) return

    void run('create-profile', async () => {
      const client = new ZernioClient({apiKey})
      const profile = await client.createProfile(name)
      setNewProfile('')
      if (profile?._id) await save({profileId: profile._id})
      setProfiles(await client.listProfiles())
      setNote({tone: 'positive', text: `Profile "${name}" created`})
    })
  }, [newProfile, run, save, settings.apiKey])

  const clearProfile = useCallback(() => {
    void run('clear-profile', async () => {
      await clearSetting(sanity, 'profileId')
      reload()
      setNote({
        tone: 'positive',
        text: 'Profile filter removed — reload the accounts to see all of them.',
      })
    })
  }, [reload, run, sanity])

  const refreshAccounts = useCallback(() => {
    const apiKey = settings.apiKey
    if (!apiKey) return

    void run('accounts', async () => {
      const client = new ZernioClient({apiKey})
      const accounts = await client.listAccounts(settings.profileId)
      await cacheAccounts(sanity, accounts)
      reload()
      setNote({tone: 'positive', text: `${accounts.length} account(s) loaded`})
    })
  }, [reload, run, sanity, settings.apiKey, settings.profileId])

  const connect = useCallback(
    (platform: string) => {
      const apiKey = settings.apiKey
      const profileId = settings.profileId
      if (!apiKey || !profileId) return

      void run(`connect-${platform}`, async () => {
        const url = await new ZernioClient({apiKey}).connectUrl(platform, profileId)
        if (!url) {
          setNote({tone: 'critical', text: 'Zernio returned no authorization URL'})
          return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
        setNote({
          tone: 'caution',
          text: 'Finish the authorization in the new tab, then reload the accounts.',
        })
      })
    },
    [run, settings.apiKey, settings.profileId],
  )

  const accounts = settings.accounts ?? []

  return (
    <Stack gap={3}>
      <Section
        title="API key"
        description="Stored in this dataset — everyone who can read the dataset can use it. Use a key limited to one profile, write access only, with an expiry date."
        actions={settings.apiKey ? <Badge tone="positive">stored</Badge> : undefined}
      >
        <Flex gap={2}>
          <Box flex={1}>
            <TextInput
              value={key}
              onChange={(event) => setKey(event.currentTarget.value)}
              placeholder={settings.apiKey ? 'Replace the stored key…' : 'sk_…'}
              type="password"
            />
          </Box>
          <Button
            text="Save and check"
            tone="primary"
            disabled={!key.trim() || busy === 'key'}
            onClick={saveKey}
          />
        </Flex>

        {settings.apiKey && (
          <Text size={0} muted>
            Ends in …{settings.apiKey.slice(-6)}.
          </Text>
        )}
      </Section>

      <Section
        title="Profile"
        description="A profile narrows which accounts are loaded. Leave it unset to see every account of the Zernio workspace — the right choice for most Studios."
      >
        <Flex gap={2} align="center" wrap="wrap">
          <Button
            text="Load profiles"
            mode="ghost"
            disabled={!settings.apiKey || busy === 'profiles'}
            onClick={loadProfiles}
          />
          {settings.profileId ? (
            <>
              <Badge tone="primary">filtered: {settings.profileId}</Badge>
              <Button
                text="Show all accounts"
                mode="ghost"
                disabled={busy === 'clear-profile'}
                onClick={clearProfile}
              />
            </>
          ) : (
            <Badge>no filter — all accounts</Badge>
          )}
        </Flex>

        {profiles.length > 0 && (
          <Stack gap={2}>
            {profiles.map((profile) => (
              <Card key={profile._id} padding={3} radius={2} border>
                <Flex align="center" gap={3}>
                  <Stack gap={2} flex={1}>
                    <Text size={1} weight="medium">
                      {profile.name ?? profile._id}
                    </Text>
                    <Text size={0} muted>
                      {profile._id}
                    </Text>
                  </Stack>
                  <Button
                    text={settings.profileId === profile._id ? 'In use' : 'Use'}
                    mode={settings.profileId === profile._id ? 'bleed' : 'ghost'}
                    disabled={settings.profileId === profile._id}
                    onClick={() => save({profileId: profile._id})}
                  />
                </Flex>
              </Card>
            ))}
          </Stack>
        )}

        <Flex gap={2}>
          <Box flex={1}>
            <TextInput
              value={newProfile}
              onChange={(event) => setNewProfile(event.currentTarget.value)}
              placeholder="New profile name"
            />
          </Box>
          <Button
            text="Create"
            mode="ghost"
            disabled={!settings.apiKey || !newProfile.trim() || busy === 'create-profile'}
            onClick={createProfile}
          />
        </Flex>
      </Section>

      <Section
        title="Accounts"
        description="Accounts already connected in Zernio only need a reload — connecting is for adding a new one."
        actions={
          <Button
            text="Reload"
            icon={RefreshIcon}
            tone="primary"
            fontSize={1}
            disabled={!settings.apiKey || busy === 'accounts'}
            loading={busy === 'accounts'}
            onClick={refreshAccounts}
          />
        }
      >
        <Flex gap={2} wrap="wrap">
          {PLATFORMS.map((platform) => (
            <Button
              key={platform}
              text={`Connect a new ${platform} account`}
              mode="ghost"
              disabled={!settings.apiKey || !settings.profileId || busy === `connect-${platform}`}
              onClick={() => connect(platform)}
            />
          ))}
        </Flex>

        {accounts.length === 0 ? (
          <EmptyState
            title="No accounts loaded yet"
            description="If Zernio already has connected accounts, press “Reload”. If the list stays empty, a profile filter is usually hiding them."
          />
        ) : (
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 8,
            }}
          >
            {accounts.map((account) => (
              <Card key={account.accountId} padding={3} radius={3} border>
                <Flex align="center" gap={3}>
                  <PlatformIcon platform={account.platform} size={16} />
                  <Stack gap={2} flex={1} style={{minWidth: 0}}>
                    <Text size={1} weight="medium">
                      {account.name ?? account.username ?? account.accountId}
                    </Text>
                    <Text size={0} muted>
                      {account.platform}
                      {account.username ? ` · @${account.username}` : ''}
                    </Text>
                  </Stack>
                  {account.disconnected && <Badge tone="critical">disconnected</Badge>}
                </Flex>
              </Card>
            ))}
          </Box>
        )}
      </Section>

      <Section title="Defaults">
        <Field
          label="Timezone"
          description="What new posts start with. Zernio reads the scheduled time in this zone."
        >
          <TextInput
            value={settings.timezone ?? ''}
            onChange={(event) => save({timezone: event.currentTarget.value})}
            placeholder="Europe/Berlin"
          />
        </Field>
      </Section>

      {note && (
        <Card padding={3} radius={2} border tone={note.tone}>
          <Text size={1}>{note.text}</Text>
        </Card>
      )}
    </Stack>
  )
}

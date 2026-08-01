import {Badge, Card, Checkbox, Flex, Stack, Text} from '@sanity/ui'
import {useCallback} from 'react'
import {type ArrayOfObjectsInputProps, set, unset} from 'sanity'

import {useZernioSettings} from '../hooks/useZernio'
import type {CachedAccount, SocialTarget} from '../lib/types'

/** Only the platforms this plugin validates and previews. */
const SUPPORTED = new Set(['instagram', 'facebook'])

function labelOf(account: CachedAccount): string {
  return account.name || account.username || account.accountId
}

/**
 * Picks the accounts a post goes to from the ones connected in Zernio.
 *
 * The chosen accounts are stored on the document — id, platform and a label —
 * so the post list keeps making sense even when Zernio is unreachable or an
 * account was disconnected in the meantime.
 */
export function TargetsInput(props: ArrayOfObjectsInputProps): React.JSX.Element {
  const {onChange, value} = props
  const {settings, loading} = useZernioSettings()

  const selected = (value ?? []) as SocialTarget[]
  const accounts = (settings.accounts ?? []).filter((account) =>
    SUPPORTED.has((account.platform ?? '').toLowerCase()),
  )

  const toggle = useCallback(
    (account: CachedAccount, checked: boolean) => {
      // Read from props rather than a derived variable: the callback must not
      // change on every render, or the checkboxes remount while clicking.
      const current = (value ?? []) as SocialTarget[]
      const rest = current.filter((target) => target.accountId !== account.accountId)

      if (!checked) {
        onChange(rest.length > 0 ? set(rest) : unset())
        return
      }

      onChange(
        set([
          ...rest,
          {
            _key: account.accountId,
            _type: 'target',
            accountId: account.accountId,
            platform: (account.platform ?? '').toLowerCase(),
            label: labelOf(account),
          },
        ]),
      )
    },
    [onChange, value],
  )

  if (loading) {
    return (
      <Text size={1} muted>
        Loading accounts…
      </Text>
    )
  }

  if (accounts.length === 0) {
    return (
      <Card padding={3} radius={2} tone="caution" border>
        <Text size={1}>
          No connected Instagram or Facebook accounts yet. Open the Zernio tool, enter the API key
          and connect an account.
        </Text>
      </Card>
    )
  }

  return (
    <Stack gap={2}>
      {accounts.map((account) => {
        const checked = selected.some((target) => target.accountId === account.accountId)

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
                onChange={(event) => toggle(account, event.currentTarget.checked)}
              />
              <Stack gap={2} flex={1}>
                <Text size={1} weight="medium">
                  {labelOf(account)}
                </Text>
                <Text size={0} muted>
                  {account.platform}
                  {account.username ? ` · @${account.username}` : ''}
                </Text>
              </Stack>
              {account.disconnected && <Badge tone="critical">disconnected</Badge>}
            </Flex>
          </Card>
        )
      })}
    </Stack>
  )
}

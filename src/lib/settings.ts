import type {SanityClient} from 'sanity'

import type {CachedAccount, ZernioAccount, ZernioSettings} from './types'

/**
 * Document id the settings live under. A fixed id keeps it a singleton — there
 * is exactly one Zernio configuration per dataset.
 *
 * @public
 */
export const SETTINGS_ID = 'zernio.settings'

/**
 * Document type of the settings singleton.
 *
 * @public
 */
export const SETTINGS_TYPE = 'zernio.settings'

/**
 * Reads the settings, or an empty object when the Studio has not been set up.
 *
 * @public
 */
export async function readSettings(client: SanityClient): Promise<ZernioSettings> {
  const document = await client.fetch<ZernioSettings | null>(
    '*[_id == $id][0]{apiKey, profileId, timezone, accounts, accountsRefreshedAt}',
    {id: SETTINGS_ID},
  )
  return document ?? {}
}

/**
 * Writes part of the settings, creating the document on first use.
 *
 * @public
 */
export async function writeSettings(
  client: SanityClient,
  patch: Partial<ZernioSettings>,
): Promise<void> {
  await client
    .transaction()
    .createIfNotExists({_id: SETTINGS_ID, _type: SETTINGS_TYPE})
    .patch(SETTINGS_ID, (p) => p.set(patch))
    .commit({visibility: 'async'})
}

/**
 * Removes a single setting again — used to drop the profile filter, which is
 * not the same as setting it to an empty string: Zernio returns every account
 * only when no profile is sent at all.
 *
 * @public
 */
export async function clearSetting(
  client: SanityClient,
  field: keyof ZernioSettings,
): Promise<void> {
  await client
    .patch(SETTINGS_ID)
    .unset([field])
    .commit({visibility: 'async'})
    .catch(() => undefined)
}

/**
 * Stores the account list so the document form can offer accounts without
 * calling Zernio on every keystroke.
 *
 * @public
 */
export async function cacheAccounts(
  client: SanityClient,
  accounts: ZernioAccount[],
): Promise<void> {
  const cached: CachedAccount[] = accounts.map((account) => ({
    // `_id` from the API becomes `accountId`: Sanity reserves leading underscores.
    accountId: account._id,
    platform: account.platform,
    name: account.name,
    username: account.username,
    profileId: account.profileId,
    disconnected: account.disconnected,
  }))

  await writeSettings(client, {accounts: cached, accountsRefreshedAt: new Date().toISOString()})
}

/**
 * Warns about a key that can do more than this plugin needs.
 *
 * The key sits in the dataset, so everyone with read access to the dataset can
 * use it. A key limited to one profile and to writing posts keeps the damage
 * small if it ever leaks.
 *
 * @public
 */
export function keyWarning(
  scope: string | undefined,
  permission: string | undefined,
): string | undefined {
  if (scope === 'full') {
    return 'This key has full account access — including SMS and ad spend. Anyone who can read this dataset can use it. Consider a key limited to one profile.'
  }
  if (permission === 'read') {
    return 'This key is read-only, so posts cannot be sent with it.'
  }
  return undefined
}

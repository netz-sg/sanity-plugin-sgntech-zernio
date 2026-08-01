<!-- Social preview / OpenGraph image -->
<p align="center">
  <img src="https://raw.githubusercontent.com/netz-sg/sanity-plugin-sgntech-zernio/main/assets/og-image.png" alt="sanity-plugin-sgntech-zernio — plan Instagram and Facebook posts inside Sanity Studio" width="640" />
</p>

<h1 align="center">sanity-plugin-sgntech-zernio</h1>

<p align="center">
  Plan, preview and publish Instagram and Facebook posts from inside Sanity Studio, through the <a href="https://zernio.com">Zernio</a> API.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sanity-plugin-sgntech-zernio"><img alt="npm version" src="https://img.shields.io/npm/v/sanity-plugin-sgntech-zernio.svg?style=flat-square" /></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/npm/l/sanity-plugin-sgntech-zernio.svg?style=flat-square" /></a>
</p>

---

## What you get

- **Posts are documents.** A `socialPost` lives in your dataset, so it gets drafts, version history, roles, review — and a reference to the article or release it belongs to. That is the reason to do this in Sanity rather than in a separate dashboard.
- **A cockpit tool**: month and week calendar with drag-and-drop rescheduling, a filtered post list, and a settings panel.
- **Previews in the real geometry** per post type — 4:5 for feed and carousel, 9:16 for story and reel — with the caption folded where the platform folds it, at 125 characters on Instagram and 480 on Facebook.
- **Validation while writing**, per platform and post type: media count, file size, aspect ratio, caption length. What the API would reject is an error; what the platform would crop or hide is a warning.
- **Media without uploads.** Images are handed over as Sanity CDN URLs, cropped by the image pipeline to what the post type expects. Nothing is copied, nothing is uploaded twice.
- **Everything Zernio knows, not just your own work.** The calendar and the list also show posts written in Zernio's dashboard or by another tool, marked as external and read-only — otherwise a calendar looks complete while hiding half the schedule.
- **Status write-back.** While the tool is open it asks Zernio about posts in flight and writes status, links to the published posts and errors back onto the document.
- Instagram feed, carousel, story and reel · Facebook feed, story and reel.

## Before you install: where the API key lives

The plugin stores your Zernio API key **in the dataset**. A Sanity Studio is a browser
application, so anything it can read at runtime can be read by anyone who opens that Studio, and by
anyone with read access to the dataset.

A Zernio key with `scope: full` can post, delete, disconnect accounts, send SMS and spend ad budget.
Do not put one of those here. In Zernio, create a key that is

- limited to a **single profile** (`profileIds`),
- **read-write**, not full scope,
- given an **expiry date**.

The settings panel checks the key when you save it and warns if it has full access.

If that trade-off is not acceptable for your setup, do not use this plugin as it stands: put the key
on a server and route the calls through it. The client in `src/lib/client.ts` takes a `baseUrl`, so
pointing it at your own proxy is a small change.

## Installation

```sh
npm install sanity-plugin-sgntech-zernio
```

Requires Sanity Studio v5 or v6 and React 18 or 19. No runtime dependencies beyond `@sanity/ui`,
which the Studio already ships.

## Usage

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {zernio} from 'sanity-plugin-sgntech-zernio'

export default defineConfig({
  // ...
  plugins: [
    zernio({
      relatedTypes: ['post', 'release'], // what a social post can point at
      timezone: 'Europe/Berlin',
    }),
  ],
})
```

Then open the **Zernio** tool, go to **Settings** and:

1. paste the API key — it is checked immediately,
2. press **Reload accounts**.

That is all, provided the accounts are already connected in Zernio. Connecting is only for adding a
new account, and it opens Zernio's own OAuth flow in a new tab.

A profile narrows which accounts are loaded. Leave it unset and every account of the workspace is
offered; set one and only its accounts appear — if the list stays empty although Zernio has
accounts, that filter is usually the reason. **Show all accounts** removes it again.

Posts can be written before any of this; they just cannot be sent.

### Options

```ts
zernio({
  name: 'socialPost', // document type name
  title: 'Social post',
  relatedTypes: [], // document types a post may reference
  timezone: 'UTC', // default for new posts
  toolTitle: 'Zernio', // label in the Studio navigation
  documentAction: true, // adds "Send to Zernio" to the document menu
})
```

## How a post travels

1. **New post** in the tool — or the small **+** on a day in the calendar, which creates it already scheduled for that day. Both open the document straight away.
2. Write it: caption, media, post type, accounts, time.
3. **Publish the document.** The plugin sends the published version, never the draft — what goes out has to be what was reviewed.
4. Hit **Send to Zernio**, either from the document menu or from the list in the tool.
5. Zernio schedules or publishes it; the document keeps the Zernio post id.
6. While the tool is open, the status is refreshed every 30 seconds until it settles, and every published post gets a link.

Nothing is polled while the tool is closed — the status then updates the next time somebody opens
it. Webhooks would be the alternative, and they need a server; this plugin deliberately does not
require one.

## What is stored

```json
{
  "_type": "socialPost",
  "title": "Album announcement",
  "kind": "carousel",
  "content": "Out on 5 March…",
  "media": [{"_type": "photo", "asset": {"_ref": "image-…"}}],
  "targets": [{"accountId": "66b2…", "platform": "instagram", "label": "Main account"}],
  "scheduledFor": "2027-03-05T10:00:00.000Z",
  "timezone": "Europe/Berlin",
  "status": "scheduled",
  "zernioPostId": "66c3…",
  "results": [{"platform": "instagram", "status": "published", "url": "https://…"}]
}
```

## Media handling

Images are delivered as Sanity CDN URLs with the image pipeline doing the work:

```
https://cdn.sanity.io/images/…jpg?w=1080&h=1350&fit=crop&crop=entropy&auto=format&q=90
```

Feed and carousel get 1080×1350, story and reel 1080×1920. Videos are passed through untouched —
the image pipeline cannot transcode them, so they have to arrive in the right format.

The preview says when an image will be cropped, and the validation blocks files above the
platform's limit (8 MB on Instagram, 4 MB on Facebook).

## Two entry points

The Studio side is the default entry. Everything that has nothing to do with the Studio — the
rules, the payload builder, the API client, the calendar maths — also lives under `/logic`, which
imports neither `sanity` nor `@sanity/ui` and therefore runs in a plain Node process or a
serverless function:

```ts
// in the Studio
import {zernio, PostPreview} from 'sanity-plugin-sgntech-zernio'

// anywhere else — no Studio, no CSS, no React
import {
  validatePost,
  postPayload,
  ZernioClient,
  monthGrid,
} from 'sanity-plugin-sgntech-zernio/logic'
```

That is also the seam for moving the key off the browser: `new ZernioClient({apiKey, baseUrl})`
points at your own proxy just as happily as at Zernio.

## Known limits

- Only Instagram and Facebook are validated and previewed. Zernio speaks to twelve more platforms; posts to those are not blocked, they simply get Instagram's stricter rules applied.
- No webhooks, so no status updates while the Studio is closed.
- Carousels and stories share one caption per post; per-account captions would need one post per account.
- The Media Library's own crop is not applied — the delivery URL crops by entropy, not by hotspot.

## Develop

```sh
npm install
npm test            # rules, payload, media and calendar
npm run lint
npm run build
npm run link-watch
```

Built with [@sanity/plugin-kit](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit).

Not affiliated with Zernio, Instagram or Meta. The Zernio mark in the plugin icon identifies the
service this plugin talks to; all rights to it remain with Zernio.

## License

[MIT](LICENSE) © SGNTech

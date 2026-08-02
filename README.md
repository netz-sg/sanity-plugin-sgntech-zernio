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

- **Write and publish inside the tool.** The **Compose** tab is a full post editor: caption, first comment, media upload, accounts, time, live preview, one button to publish or schedule. Nobody has to walk through the document form to get something out.
- **Templates** for caption, first comment and hashtags — one document, three parts, applied together or one at a time. `{{title}}`, `{{date}}`, `{{time}}`, `{{kind}}` and `{{accounts}}` are filled in; unknown placeholders stay visible so it is obvious what is still missing. Available in the composer and in the document form.
- **Move and zoom the image** in the tool, in the frame the post type will show, and switch Instagram's **safe zones** on to see what the profile row, the reply bar or the reel buttons will cover. The crop is stored in Sanity's own `crop` shape, so the image field's crop tool and this one edit the same thing.
- **Posts are documents.** Every post is still a `socialPost` in your dataset, so it gets version history, roles, review — and a reference to the article or release it belongs to. That is the reason to do this in Sanity rather than in a separate dashboard.
- **A cockpit tool**: composer, month and week calendar with drag-and-drop rescheduling, a filtered post list, template management, and a settings panel. Writing, editing, scheduling, sending and deleting all happen here — nothing sends you to the desk.
- **Previews that look like the app** — the Instagram feed card with its profile row and action bar, the story with its progress bars and reply field, the reel with its side rail, the Facebook post with its Like/Comment/Share row. Right geometry per post type (4:5 for feed and carousel, 9:16 for story and reel) and the caption folded where the platform folds it: 125 characters on Instagram, 480 on Facebook.
- **Validation while writing**, per platform and post type: media count, file size, aspect ratio, caption length. What the API would reject is an error; what the platform would crop or hide is a warning.
- **Media without uploads.** Images are handed over as Sanity CDN URLs, cropped by the image pipeline to what the post type expects. Nothing is copied, nothing is uploaded twice.
- **Everything Zernio knows, not just your own work.** The calendar shows posts written in Zernio's dashboard or by another tool, and the list shows them as cards with their image, platform icons and a link to the published post — otherwise a calendar looks complete while hiding half the schedule.
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

## Setup

Five steps, about ten minutes, no code beyond the config block.

### 1. Install

```sh
npm install sanity-plugin-sgntech-zernio
```

Sanity Studio v5 or v6, React 18 or 19. Nothing else to install — `@sanity/ui` and `@sanity/icons`
come with the Studio.

### 2. Add it to the config

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {zernio, zernioTypeNames} from 'sanity-plugin-sgntech-zernio'

const zernioConfig = {
  timezone: 'Europe/Berlin', // what new posts start with
  relatedTypes: ['post', 'release'], // what a post may point at, optional
}

export default defineConfig({
  name: 'default',
  title: 'My Studio',
  projectId: '…',
  dataset: 'production',

  plugins: [
    structureTool({
      // Everything about posts and templates happens in the Zernio tool,
      // so its types are kept out of the desk. Leave this out and they
      // appear in the content list like any other document type.
      structure: (S) =>
        S.list()
          .title('Content')
          .items(
            S.documentTypeListItems().filter(
              (item) => !zernioTypeNames(zernioConfig).includes(item.getId() ?? ''),
            ),
          ),
    }),
    zernio(zernioConfig),
  ],
})
```

Start the Studio. **Zernio** is now in the navigation, next to your content.

### 3. Make an API key in Zernio

In Zernio, under API keys, create one that is

- limited to a **single profile** (`profileIds`),
- **read-write**, not `full` scope,
- given an **expiry date**.

The key is stored in your dataset and read by the browser — see
[where the API key lives](#before-you-install-where-the-api-key-lives) above for why that matters.
A `full` key can disconnect accounts and spend ad budget; the settings panel warns you if you paste
one.

### 4. Connect the Studio

Open the **Zernio** tool → **Settings**:

1. paste the key and press **Save and check** — it is verified against Zernio straight away, and
   the badge turns to `stored`,
2. press **Reload** under *Accounts*.

Your connected Instagram and Facebook accounts appear as cards. That is the whole setup, provided
the accounts are already connected in Zernio.

If the list stays empty: a **profile** filter is the usual reason. Leave the profile unset to see
every account in the workspace — *Show all accounts* removes an existing filter. **Connect a new …
account** is only for adding an account Zernio does not have yet; it opens Zernio's own OAuth flow
in a new tab, after which you press **Reload** again.

Under *Defaults*, set the timezone Zernio should read scheduled times in, e.g. `Europe/Berlin`.

### 5. Write the first post

**Compose** is the first tab:

1. give it an internal name, pick the post type (feed, carousel, story, reel),
2. write the caption — the counter shows the platform limit and where the caption folds,
3. **Add** an image or video; **Adjust** moves and zooms it inside the frame that post type will
   show, with Instagram's safe zones on top for stories and reels,
4. tick the accounts it goes to,
5. **Publish now**, or leave the switch off and pick a time, then **Schedule**.

The post is written as a document and handed to Zernio in one step. Everything else — the calendar,
the list of what has been sent, the templates — is in the other tabs of the same tool.

Posts can be written before any of the above; they just cannot be sent.

### Options

```ts
zernio({
  name: 'socialPost', // document type name
  title: 'Social post',
  templateType: 'zernioTemplate', // template document type
  templateTitle: 'Post template',
  relatedTypes: [], // document types a post may reference
  timezone: 'UTC', // default for new posts
  toolTitle: 'Zernio', // label in the Studio navigation
  documentAction: true, // adds "Send to Zernio" to the document menu
})
```

If your dataset already has a `socialPost` type, give this one another name — `zernio({name:
'zernioPost'})` — so the two schemas do not collide.

## The tool, tab by tab

| Tab | What it is for |
| --- | --- |
| **Compose** | Write a new post or edit an existing one on a single screen that never scrolls: the caption grows into the space that is left, the preview stands next to it, and scheduling and sending sit in the bar at the bottom. |
| **Calendar** | Month and week view of everything scheduled — yours and what already lives in Zernio. Drag a post to another day, or press **+** on a day to compose for it. |
| **Posts** | Every post in this Studio, filterable by status and account, with thumbnails and links to what has been published. Below it, the posts that exist only in Zernio. |
| **Post detail** | Opened from the calendar or the list: caption, media, accounts, schedule, what Zernio reported per platform, and the actions — edit, duplicate, check status, send, delete. |
| **Templates** | Reusable captions, first comments and hashtag sets. |
| **Settings** | API key, profile, connected accounts, default timezone. |

## How a post travels

### From the tool, in one go

1. **Compose** in the Zernio tool — or the small **+** on a day in the calendar, which opens the composer on that day.
2. Write it: caption, first comment, media, post type, accounts, time. Pick a template if there is one. The preview next to it shows the crop and the fold while you type.
3. **Adjust** a picture to move and zoom it inside the frame; for stories and reels the safe zones show what Instagram covers up.
4. **Publish now** or **Schedule**. The document is written and handed to Zernio in the same step; the composer stays open for the next post.

Media added here is uploaded to Sanity's asset store first, so it ends up in your media library like
any other image — the tool never sends a file to Zernio, only a URL.

Clicking a post in the calendar or the list opens it in the composer again: change it, save it,
send it, delete it. **Save** only touches the fields the composer owns, so anything a project added
to the post type stays untouched.

### Through the document, when a post needs review

The document form is still a full editor, with the same preview and template picker, for teams that
want posts to go through review before they are sent. It needs the post type to be reachable in the
desk, so leave the structure filter from [step 2](#2-add-it-to-the-config) out if you want this
route.

1. Create a `socialPost` in the desk, write it, have it reviewed, **publish the document**. The plugin sends the published version, never the draft — what goes out has to be what was reviewed.
2. Hit **Send to Zernio**, from the document menu or from the list in the tool.

Either way Zernio schedules or publishes it, the document keeps the Zernio post id, and while the
tool is open the status is refreshed every 30 seconds until it settles — every published post gets a
link.

Nothing is polled while the tool is closed — the status then updates the next time somebody opens
it. Webhooks would be the alternative, and they need a server; this plugin deliberately does not
require one.

## Templates

Templates are written in the tool's **Templates** tab — name, caption, first comment, hashtags and
where the hashtags go. Behind it is an ordinary document:

```json
{
  "_type": "zernioTemplate",
  "title": "Album release",
  "caption": "Out now: {{title}} — everywhere from {{date}}.",
  "firstComment": "All links in the bio",
  "hashtags": ["metal", "newrelease"],
  "hashtagPlacement": "caption"
}
```

Caption and first comment are replaced when applied, hashtags are appended — to the caption or to
the first comment, whichever the template says. Tags are cleaned up on the way in: a leading `#` is
optional, spaces are removed and duplicates are dropped, because a repeated tag is a shadowban risk
on Instagram.

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
https://cdn.sanity.io/images/…jpg?w=1080&h=1350&fit=crop&rect=600,0,800,1000&auto=format&q=90
```

Feed and carousel get 1080×1350, story and reel 1080×1920. What is cropped away is decided in this
order: the crop you set with **Adjust** (`rect=`), otherwise the image's hotspot
(`crop=focalpoint`), otherwise the pipeline's own guess (`crop=entropy`). The crop is stored in
Sanity's own `crop` shape, so the image field's crop tool and the tool's editor change the same
thing.

Videos are passed through untouched — the image pipeline cannot transcode them, so they have to
arrive in the right format.

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
- Videos are sent as they are: no transcoding, no cover frame, no trimming.

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

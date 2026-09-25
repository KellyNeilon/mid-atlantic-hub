# Homepage ticker — going live

The ticker reads `/data/ticker.json`. Everything below is about who writes that
file. Nothing here changes the app.

---

## Phase A — live today, no Azure

`public/data/ticker.json` is in the repo. Edit it in GitHub's web editor, commit,
and Azure redeploys in about 90 seconds.

```json
{ "kind": "event", "label": "Sep 18 — Access gate review", "href": null }
```

`kind` is `"event"` or `"news"`. Events sort first and get an accent dot; that
ordering is the design lock's ("the events feed loads first, then the list
rows"). `href` must be `http`/`https` or it is dropped — the loader rejects
anything else, because once the list is live anyone on the team can type a URL
into it.

**This is already working.** Phase B replaces who writes the file, not the file.

---

## Phase B — the Logic App

```
Outlook events calendar ─┐
                         ├─► Logic App (every 15 min) ─► ticker.json in Blob
MS Ticker SharePoint list┘                                       │
                                    homepage fetches it ◄────────┘
```

Add or delete a row in the list, and it is live within 15 minutes with no
deploy and no code.

### 1. Create the list

A SharePoint list on the Mid-Atlantic Marketing site named **MS Ticker**:

| Column | Type | Notes |
|---|---|---|
| `Title` | Single line of text | the ticker text. Keep it under ~70 characters |
| `Live` | Yes/No, default No | **the check mark.** Only `Yes` rows publish |
| `Link` | Hyperlink | opens in a new tab. Blank renders as plain text |
| `Starts` | Date | optional. Blank means "already running" |
| `Expires` | Date | optional. Past rows drop themselves — this is the reason to use the list rather than the JSON file |
| `Order` | Number | ascending. Ties break on Modified, newest first |

Seed it with three or four placeholder rows so there is something to see.

### 2. Build the Logic App

Consumption plan, same region as the Static Web App. Five actions:

1. **Recurrence** — 15 minutes.
2. **Office 365 Outlook → Get calendar view of events (V3)**. Point it at the
   **Media Events** calendar (the shared calendar, not a personal mailbox — see
   "Decided" below), start `@{utcNow()}`, end `@{addDays(utcNow(), 60)}`.
3. **SharePoint → Get items**, list `MS Ticker`, with
   `Filter Query: Live eq 1 and (Expires eq null or Expires ge datetime'@{utcNow()}')`
   and `Order By: Order asc,Modified desc`.
4. **Two Select actions**, mapping each source to the same shape:

   *Select events* — from `body('Get_calendar_view')?['value']`, map to
   ```
   kind   event
   label  @{formatDateTime(item()?['start'], 'MMM d')} — @{item()?['subject']}
   href   @{item()?['webLink']}
   ```
   *Select news* — from `body('Get_items')?['value']`, map to
   ```
   kind   news
   label  @{item()?['Title']}
   href   @{item()?['Link']?['Value']}
   ```
5. **Compose**, then write it to blob:
   ```
   {
     "updated": "@{utcNow()}",
     "source": "logic-app",
     "items": "@union(body('Select_events'), body('Select_news'))"
   }
   ```
   Note `items` has no braces around the expression — that keeps it an array
   rather than stringifying it. This is the one line that most often goes
   wrong; if the ticker shows nothing, look here first.

   Then **Azure Blob Storage → Create blob (V2)**, overwriting
   `ticker.json` in a container with public read on blobs.

### 3. Point the app at it

One line, in `src/data/ticker-items.js`:

```js
export const TICKER_FEED = 'https://<account>.blob.core.windows.net/<container>/ticker.json';
```

Enable CORS on the storage account for the Static Web App's origin, `GET` only.

### Worth deciding before you switch

A public-read blob means the ticker's contents are readable by anyone with the
URL. For events and announcements that is usually fine — but it is the same
call you already deferred on the BD Directory, and it is worth making
deliberately rather than by default. The alternative is a `/api/ticker`
function on the Static Web App that reads the blob with a managed identity, at
the cost of one more moving part.

---

## Decided

**Calendar:** the **Media Events** calendar in Outlook. It's a shared
calendar rather than a personal mailbox, so the feed doesn't break if one
person's account changes.

# Mid-Atlantic Hub

Internal Marketing Hub for ICS/CMTA Mid-Atlantic: the homepage plus the in-house React tools.

**Live:** https://black-beach-08680560f.7.azurestaticapps.net

| Page | Link |
|---|---|
| Homepage | `/` |
| Project Map | `/?tool=map` |
| BD Directory | `/?tool=bd` |

Related tools that live in their own repos:

| Tool | Repo | Live |
|---|---|---|
| Presentation Generator | `presentation_generator` | https://orange-ground-0d656b20f.7.azurestaticapps.net/composer |
| Tools page + Monthly Client Updater | `monthly-client-updater-review` | https://witty-river-0c0078e0f.7.azurestaticapps.net |

## Run it on your laptop

```powershell
cd $HOME\Developer\mid-atlantic-hub
git pull
npm install
npm run dev
```
Open http://localhost:5173

## Publish

Push to `main`. GitHub Actions builds the site and deploys it to Azure in about 2 minutes (check the **Actions** tab).
The deploy uses the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN_BLACK_BEACH`.

## Where things are

| Folder | What's in it |
|---|---|
| `src/components/Homepage/` | Homepage layout; `hero/` is the day-to-dusk background |
| `src/components/MapPanel/` | Glass map panel on the homepage |
| `src/components/DistrictMap/` | Project Map tool |
| `src/components/BDDirectory/` | BD Directory tool |
| `src/components/CircularGallery/` | 3D card carousel (not wired up yet) |
| `src/data/` | Nav menu, info cards, ticker, tools list, map geometry |
| `src/lib/` | Map helpers (colors, geometry, zoom/pan, CSV) |
| `src/styles/tokens.css` | Brand colors and fonts: change them here only |
| `public/data/` | `district-data.csv` (map), `bd-clients.json`, `ticker.json` |
| `public/assets/` | Hero images, card art, brand logos, district logos |
| `scripts/` | Python scripts that rebuild map data from PennDOT files |
| `api/ask/` | Agent chat proxy (parked, not deployed) |

## Updating content

- **Ticker:** edit `public/data/ticker.json` on GitHub; live in about 2 minutes.
- **Map data:** edit `public/data/district-data.csv`.
- **Tools list:** edit `src/data/tools.js`.

## History

Started fresh on 2026-09-25 from the old `Mid-Atlantic-Intranet` repo (archived, read-only). The hero source photos, the hero image builder script, and the prospect coverage export are still available there.

Never put passwords, API keys, or tokens in this repo. They go in GitHub secrets or Azure settings.

# ScratchJr Web Edition — AI Agent Reference

## Project Objective

A web-based port of ScratchJr (originally an iPad/Android app) that runs in modern browsers. It is a visual programming environment for young children (ages 5-7) where they create interactive stories and games by snapping graphical programming blocks together.

This project adapts the original native mobile app to browser environments using Vite as the build tool, Express.js as the optional backend, and Supabase (PostgreSQL) for cloud data storage.

---

## ⚠️ Agent Reminders

These notes exist to prevent recurring mistakes. Read them before making any change.

### Active Entry Points
There are now **five** active HTML pages, each with its own JS entry:

| HTML | Entry Function | Description |
|------|---------------|-------------|
| `index.html` | `indexMain` | Splash/login screen |
| `home.html` | `homeMain` | Project lobby |
| `editor.html` | `editorMain` | Block editor |
| `gettingstarted.html` | `gettingstartedMain` | Getting started guide |
| `player.html` | `playerMain` | Public read-only project viewer |

`src/app/appEntry-vite.js` is the module entry for the editor/home/splash pages.
`src/app/src/entry/player.js` is the **separate** entry module for the player page — it is loaded directly by `player.html` and NOT bundled through `appEntry-vite.js`.

Do NOT touch or reference `appEntry.js` or `appEntry-web.js` — they are in `_legacy/`.

### Development vs. Build
- `npm run dev` serves files directly from source via Vite's dev server.
  **No build step needed** to test changes locally — edits are reflected immediately.
- `npm run build` is only required for Vercel deployment (and Vercel runs it automatically on deploy).
  Never instruct the user to run `npm run build` to test local changes.

### Player Mode — Patch Architecture

The player (`player.html` / `src/app/src/entry/player.js`) reuses the full editor engine but overrides dangerous or editor-only behaviors using **prototype patches** applied at startup. Each patch file is isolated and has no side effects when not called:

| Patch file | What it patches |
|-----------|----------------|
| `src/app/src/editor/ScratchJr_player.js` | `ScratchJr.numEditKey` — guards against null `activeFocus` |
| `src/app/src/editor/engine/Page_player.js` | Page-level engine patches |
| `src/app/src/editor/engine/Sprite_player.js` | `whoIsIt` — BoundingClientRect-based hit-test (replaces stamp-based) |
| `src/app/src/editor/engine/Stage_player.js` | Stage-level player patches |

**Rules for player patches:**
- Each patch file exports a single `applyXxxPlayerPatches()` function. Call it in `player.js` only.
- Never import `*_player.js` files from the editor pages (`editor.js`, `home.js`).
- When the player needs different behavior from an engine method, add it to the relevant `*_player.js` — do NOT modify the original engine file.

### Public Share System

The project has a share/public-player feature added after the initial architecture:

- **Backend:** `backend/src/routes/share.js` — adds authenticated endpoints (`POST/DELETE /api/share/:projectId`) and **public** endpoints (`GET/POST /api/public/project/:token`) for the player.
- The `projects` table now has a `share_token` column and a `reactions` column (JSON, emoji counters).
- Public routes are registered **before** the auth middleware in `backend/src/index.js` — they intentionally require no JWT.
- **Frontend:** `player.js` fetches `/api/public/project/:token` (no auth header). Emoji reactions are posted to `/api/public/project/:token/react`.
- Allowed emojis: `❤️ 😄 👏 🌟 🎉` — hardcoded in both `share.js` and `player.js`. Change in both if you need to add/remove.

### Legacy Folder
`_legacy/` contains files from previous generations of the project (Electron app, old CI).
Do NOT import, modify, or reference anything inside `_legacy/`.
To revert a file, copy it back from `_legacy/<original-path>` to `<original-path>`.

### Database
This project uses **Supabase (PostgreSQL)** via `@supabase/supabase-js`.
The `pg` package is also a dependency but Supabase is the primary data layer.
Do NOT assume or suggest Neon.tech, PlanetScale, or any other provider.

### Image Assets (Static Paths)
Images in `src/app/assets/` are loaded via static string paths (e.g., `"assets/blocks/blueCmd.png"`),
NOT via Vite imports. The `copyStaticAssetsPlugin` in `vite.config.js` copies the entire
`assets/` directory to `dist/assets/` at build time. Do not refactor to `import` statements
unless explicitly requested — it would break the existing loading mechanism.

### Mixed PNG/SVG Usage
Most block images use `.svg`, but some (e.g., `blueCmd`) use `.png`. This is intentional.
Do not "fix" the inconsistency unless explicitly asked.

### CSS Template Literals
CSS files use JavaScript template expressions (`${css_vh(N)}`, `${scaleMultiplier}`).
These are evaluated at runtime by `preprocess()` in `lib.js` (uses `eval()`).
Vite processes them at build time via `handleTemplateLiteralCss` plugin.
Do not remove or convert these to standard CSS values.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Language** | JavaScript ES6+ (Vanilla, no framework) |
| **Build Tool** | Vite 7.x |
| **CSS** | Plain CSS with JavaScript template-literal preprocessing (`${css_vh(N)}`, `${css_vw(N)}`, `${scaleMultiplier}`) |
| **Backend Runtime** | Node.js >= 14 |
| **Backend Framework** | Express.js 4.x |
| **Cloud Database** | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| **In-Browser DB (legacy)** | SQLite via `sql.js` |
| **Cloud Storage** | Supabase Storage |
| **Auth** | JWT tokens (Firebase-compatible) + mock tokens for dev |
| **Deployment** | Vercel (serverless functions) |
| **Package Manager** | npm |
| **Linting** | ESLint 3.x with Airbnb config (heavily relaxed) |

**Key npm dependencies (frontend):** `jszip`, `snapsvg`, `sql.js`, `express`, `cors`, `helmet`, `morgan`, `dotenv`, `@supabase/supabase-js`, `pg`

**Key npm dependencies (backend):** `express`, `cors`, `helmet`, `morgan`, `dotenv`, `@supabase/supabase-js`, `pg`, `body-parser`

---

## Architecture & Directory Structure

```
.
├── api/
│   └── index.js                  # Vercel serverless entry point (mounts Express app)
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server startup (CORS, auth, routes)
│   │   └── routes/
│   │       ├── db.js             # /api/db — SQL-to-Supabase translator, CRUD for projects
│   │       ├── media.js          # /api/media — Supabase Storage upload/download/delete
│   │       └── share.js          # /api/share + /api/public — project sharing & emoji reactions
│   ├── supabase-setup.sql        # PostgreSQL schema (projects, usershapes, userbkgs, projectfiles, media)
│   ├── .env / .env.example       # Backend environment variables
│   └── package.json
├── src/
│   └── app/                      # ** Main frontend application (Vite root) **
│       ├── index.html            # HTML entry: splash screen
│       ├── home.html             # HTML entry: project lobby
│       ├── editor.html           # HTML entry: block editor
│       ├── gettingstarted.html   # HTML entry: getting started guide
│       ├── player.html           # HTML entry: public read-only project player (share links)
│       ├── appEntry-vite.js      # ** ÚNICO entry point ativo ** (imports, CSS processing, router)
│       ├── bootstrap.js          # Fallback polyfills (IO, Localization, iOS mocks)
│       ├── sync-wrapper.js       # Bridging async WebInterface Promises → callback-based iOS.js API
│       ├── settings.json         # App configuration (sprites, colors, locales, intervals)
│       ├── media.json            # Sprite/background catalog (md5, dimensions, names, tags)
│       ├── public/               # Static files served via Vite publicDir
│       ├── assets/               # Static images/icons (start screen, UI elements)
│       ├── sounds/               # Audio resources (.wav, .mp3)
│       ├── css/                  # Stylesheets (with ${template} literals)
│       │   ├── font.css, base.css, start.css, lobby.css, thumbs.css
│       │   ├── editor.css, editorleftpanel.css, editorstage.css
│       │   ├── editormodal.css, librarymodal.css, paintlook.css, gs.css
│       ├── localizations/        # i18n JSON files (en, pt, es, fr, de, it, nl, ja, sv, th, zh-cn, ca)
│       ├── pnglibrary/           # Raster sprite/background images
│       ├── svglibrary/           # Vector sprite/background SVGs
│       ├── samples/              # Sample project files
│       ├── inapp/                # In-app help pages (about, blocks guide, paint guide, interface guide)
│       └── src/                  # ** JavaScript source modules **
│           ├── entry/            # Page entry functions
│           │   ├── index.js      #   Splash screen entry (indexMain)
│           │   ├── home.js       #   Lobby entry (homeMain)
│           │   ├── editor.js     #   Editor entry (editorMain)
│           │   ├── gettingstarted.js  # Getting started entry
│           │   ├── inapp.js      #   In-app help entry
│           │   ├── index-mock.js #   Mock for offline development
│           │   └── player.js     #   ** Player entry (playerMain) — public share viewer **
│           ├── editor/           # Core block-based editor engine
│           │   ├── ScratchJr.js  #   App controller / global state
│           │   ├── ScratchJr_player.js  # Player patches for ScratchJr (apply via applyScratchJrPlayerPatches)
│           │   ├── blocks/       #   Block definitions
│           │   │   ├── Block.js, BlockArg.js, BlockSpecs.js, Menu.js
│           │   ├── engine/       #   Execution engine
│           │   │   ├── Runtime.js, Thread.js, Prims.js
│           │   │   ├── Stage.js, Stage_player.js   # Stage + player patches
│           │   │   ├── Sprite.js, Sprite_player.js # Sprite + player patches (BoundingClientRect hit-test)
│           │   │   └── Page.js, Page_player.js     # Page + player patches
│           │   └── ui/           #   User interface
│           │       ├── UI.js, Project.js, Scripts.js, ScriptsPane.js
│           │       ├── Palette.js, Library.js, Thumbs.js, Scroll.js
│           │       ├── Grid.js, Undo.js, Alert.js, Record.js
│           ├── lobby/            # Project lobby / home screen
│           │   ├── Lobby.js, Home.js, Samples.js
│           ├── painteditor/      # Vector paint/drawing tool
│           │   ├── Paint.js, PaintAction.js, PaintUndo.js
│           │   ├── Layer.js, Path.js, Ghost.js, Camera.js, Transform.js
│           │   ├── SVGImage.js, SVGTools.js, PNGCache.js
│           ├── services/         # API / platform abstraction layer
│           │   └── WebInterface.js  # ** Central HTTP API client (991 lines) **
│           │                          Replaces native iOS/Android calls with REST API
│           ├── iPad/             # Platform interface (named "iPad" for legacy reasons)
│           │   ├── iOS.js        #   Tablet interface dispatcher (auth, db, file ops)
│           │   ├── IO.js         #   File I/O, ZIP, thumbnails, SVG→Canvas
│           │   └── MediaLib.js   #   Media library loader (sprites, backgrounds, sounds)
│           ├── geom/             # 2D geometry
│           │   ├── Matrix.js, Rectangle.js, Vector.js
│           ├── utils/            # General utilities
│           │   ├── lib.js         #   CSS preprocessing, DOM helpers, eval-based template engine
│           │   ├── Localization.js #   i18n (locale detection, message loading)
│           │   ├── ScratchAudio.js #  Audio playback via Web Audio API
│           │   ├── Sound.js       #   Sound recording wrapper
│           │   ├── SVG2Canvas.js   #   SVG to Canvas renderer
│           │   ├── DrawPath.js     #   Vector path drawing
│           │   ├── Events.js       #   Event system
│           │   ├── Cookie.js       #   Cookie management
│           │   └── AppUsage.js     #   Usage analytics (school/home tracking)
│           ├── shims/            # Browser shims
│           │   ├── jszip.js, snapsvg.js, stream.js
│           └── snap/             # Snap.svg library (minified, do not edit)
│               └── snap.svg-min.js
├── dist/                         # Build output (Vite build)
├── _legacy/                      # Files from previous project generations (Electron, old CI)
│   ├── src/
│   │   ├── main.js               #   Electron main process (archived)
│   │   ├── electronClient.js     #   Electron renderer (archived)
│   │   └── app/
│   │       ├── appEntry.js       #   Original synchronous entry point (archived)
│   │       ├── appEntry-web.js   #   ES6 module entry without bundler (archived)
│   │       └── index-vite.html   #   Alternative HTML without CSS <link> tags (archived)
│   ├── .compilerc                #   Legacy Babel config for Electron (archived)
│   ├── .travis.yml               #   Legacy CI pipeline (archived)
│   └── docs/                     #   Electron documentation (archived)
├── scripts/                      # (empty)
├── vite.config.js                # Vite configuration (plugins, proxy, aliases, CSS processing)
├── vercel.json                   # Vercel deployment config (routes, functions)
├── .vercelignore
├── package.json                  # Root package.json (scripts, eslintConfig, dependencies)
├── .env.local                    # Frontend env vars (VITE_MOCK_TOKEN)
├── eslint_rc                     # Alternative ESLint config file
├── .eslintignore
├── fix-imports.js                # Utility script to add .js extensions to relative imports
└── CONTRIBUTING.md
```

### How Pages Load

**Editor / Lobby / Splash / Getting Started:**
1. Browser loads `index.html`, `home.html`, `editor.html`, or `gettingstarted.html`
2. Each HTML sets `window.scratchJrPage` to the page name and loads `appEntry-vite.js` as a `<script type="module">`
3. `appEntry-vite.js` imports all modules via ES6 imports, exposes them on `window`, then calls the appropriate entry function (`indexMain`, `homeMain`, `editorMain`, etc.)
4. Entry functions call `iOS.waitForInterface()` which polls for `window.tabletInterface` (the `WebInterface` instance)
5. The `WebInterface` constructor reads auth tokens from URL parameters or sessionStorage
6. All database/file operations go through `window.tabletInterface` methods → HTTP fetch → Express backend → Supabase

**Player (public share viewer):**
1. Browser loads `player.html?token=<share_token>`
2. `player.html` loads `src/entry/player.js` directly as `<script type="module">` — does NOT use `appEntry-vite.js`
3. `playerMain()` applies engine patches (`applyScratchJrPlayerPatches`, `applyPagePlayerPatches`, etc.) then fetches `/api/public/project/:token` — **no auth required**
4. Project JSON and assets are loaded from Supabase Storage public URLs; `iOS.path` is set to the Supabase base URL so PNG assets resolve correctly
5. The stage auto-starts the project animation on load

### Data Flow

```
Browser (WebInterface.js)                     [Editor / Lobby / Authenticated pages]
  → HTTP fetch to /api/db/query or /api/db/stmt
    → Express backend (backend/src/index.js)
      → Auth middleware (JWT or mock token)
        → Route handler (backend/src/routes/db.js)
          → Translates legacy SQL strings / structured payloads to Supabase queries
            → Supabase PostgreSQL

Browser (WebInterface.js)
  → HTTP fetch to /api/media
    → Express backend
      → Auth middleware
        → Route handler (backend/src/routes/media.js)
          → Supabase Storage (files namespaced by userId)

Browser (Lobby share button)                  [Authenticated — generate share link]
  → POST /api/share/:projectId
    → Auth middleware → share.js
      → Generates/returns share_token on projects row → Supabase

Browser (player.js)                           [Public — no auth]
  → GET /api/public/project/:token            (registered BEFORE auth middleware)
    → share.js publicRouter
      → Reads project row by share_token from Supabase → returns name, json, thumbnail, reactions

Browser (player.js emoji reaction)
  → POST /api/public/project/:token/react  { emoji: "❤️" }
    → share.js publicRouter
      → Increments reactions JSON counter in Supabase
```

---

## Code Standards & Guidelines

### Naming Conventions

| Convention | Usage |
|-----------|-------|
| **camelCase** | All variables, functions, methods, properties |
| **PascalCase** | Class names and constructor functions only |
| **ALL_CAPS** | Constants (module-level) and enum-like values |
| **Hyphen-case** | File names: `appEntry-vite.js`, `sync-wrapper.js` |
| **Prefix `_`** | "Private" methods/properties (e.g., `_authHeader()`, `_extractTokenFromUrl()`) |
| **Leading `$`** | jQuery-style wrapped DOM elements (if any exist) |

### Module & Import Rules

- All `.js` files use ES6 module syntax (`import` / `export`).
- Relative imports **MUST** include the `.js` extension (e.g., `import IO from '../iPad/IO.js'`).
- Use `export default class ClassName` for classes.
- Use named exports from utility modules: `export function fnName`, `export const NAME`.
- Vite aliases are available: `@` → `/src`, `jszip` → `/src/shims/jszip.js`, `snapsvg` → `/src/shims/snapsvg.js`, `stream` → `/src/shims/stream.js`.
- The entry point `appEntry-vite.js` is the only file that should set globals on `window`. All other modules import what they need.

### Global Variables (window.*)

The original codebase uses `window` globals extensively. The following are the legitimate globals:

| Global | Module Source | Purpose |
|--------|--------------|---------|
| `window.tabletInterface` | `WebInterface` | Central API object (all platform ops) |
| `window.Settings` | `settings.json` | App configuration |
| `window.IO` | `IO.js` | File I/O operations |
| `window.iOS` | `iOS.js` | Platform dispatcher |
| `window.MediaLib` | `MediaLib.js` | Media library |
| `window.Localization` | `Localization.js` | i18n |
| `window.AppUsage` | `AppUsage.js` | Usage tracking |
| `window.ScratchJrRouter` | `appEntry-vite.js` | Page navigation |
| `window.PNGCache` | `PNGCache.js` | PNG watermark cache |
| `window.preprocessAndLoadCss` | `lib.js` | CSS loader |
| `window.__AUTH_TOKEN__` | `WebInterface` | Auth token |
| `window.API_URL` | HTML pages | Backend API base URL |
| `window.scratchJrPage` | HTML pages | Current page identifier |
| `window.css_vh`, `window.css_vw`, `window.scaleMultiplier` | `lib.js` | CSS template functions |

Never introduce new globals. Always use module imports.

### CSS Conventions

- CSS files are plain `.css` with embedded JavaScript template literals.
- Template expressions include:
  - `${css_vh(N)}` → converts to `Nvh` viewport-relative units
  - `${css_vw(N)}` → converts to `Nvw` viewport-relative units
  - `${N * scaleMultiplier}` → converts to `N` pixels
  - `${scaleMultiplier}` → evaluates to `1`
- Templates are evaluated at runtime via `preprocess()` in `lib.js` (uses `eval()`).
- During Vite build, `handleTemplateLiteralCss` plugin in `vite.config.js` pre-processes these to static values.
- In development with Vite, CSS is loaded via `<link>` tags and post-processed client-side by `processAllCss()` in `appEntry-vite.js`.
- CSS file naming: functional names (`editor.css`, `lobby.css`, `paintlook.css`, `start.css`).

### Error Handling

- Backend: Use Express middleware pattern. Throw errors with `.status` property. Use `next(err)` or the global error handler in `api/index.js`.
- Backend: Multi-tenant checks (`OWNER_TABLES`) must verify `req.userId` before mutations.
- Frontend: `WebInterface` uses try/catch with `console.error`. Original codebase uses callback patterns with `null` returns on failure.
- Database mutations: The backend enforces daily project creation limits (1 per user per UTC day) — returns `DAILY_LIMIT_EXCEEDED` with HTTP 429.

### Code Style (Enforced by ESLint)

- **Quotes:** single quotes (`'string'`), template literals allowed.
- **Semicolons:** required.
- **Indentation:** 4 spaces (configured in `eslint_rc` file).
- **Max line length:** 120 characters.
- **Braces:** 1TBS style (opening brace on same line).
- **Line endings:** Unix (`\n`).
- **Trailing spaces:** not allowed.
- **Unused vars:** error, with `varsIgnorePattern: "^_"`.
- **`var` declarations:** allowed (legacy codebase).
- **`++` operators:** allowed.
- **`===` strict equality:** not enforced.
- **Async functions:** use `async/await` in new code (WebInterface, backend routes). Legacy code uses callbacks.

### DO NOT:

- Add expository comments explaining what code does — code should be self-documenting.
- Add JSDoc or documentation comments unless explicitly requested.
- Introduce new npm dependencies without explicit user request.
- Modify anything inside `_legacy/` (archived Electron code).
- Modify `src/app/src/snap/snap.svg-min.js` (third-party minified library).
- Create new global variables on `window`.
- Use `console.log` for temporary debugging in production paths — use structured logging or remove before commit.
- Add `.DS_Store` files (gitignored).
- Import `*_player.js` files from editor/lobby pages — they are player-only patches.
- Add auth requirements to `/api/public/*` routes — they are intentionally public.
- Use `appEntry-vite.js` as a reference for the player page — `player.html` has its own separate entry.

### DO:

- Follow existing patterns in the file you are editing.
- Use `fetch()` for HTTP calls in the frontend (WebInterface pattern).
- Use `import`/`export` for new modules.
- Include `.js` extension in all relative imports.
- Use the `@/` alias for imports from `src/app/src/` when convenient.
- Validate user-scoped data with `req.userId` in backend routes.
- Follow the existing multi-tenant pattern: `OWNER_TABLES` set dictates which tables require `owner` column filtering.

---

## Environment & Deployment

### Environment Variables

**Frontend (`.env.local`):**

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_MOCK_TOKEN` | Auth token for local dev (dev-user-a / dev-user-b) | `dev-user-a` |

**Backend (`.env`):**

| Variable | Purpose | Required |
|----------|---------|----------|
| `PORT` | Backend server port | No (default: 5000) |
| `NODE_ENV` | Environment mode (`development` / `production`) | No |
| `FRONTEND_URL` | Frontend origin for CORS | No |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins (production mode only) | No |
| `SUPABASE_URL` | Supabase project URL | Yes (for cloud DB) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Yes (for backend) |
| `SUPABASE_MEDIA_BUCKET` | Supabase Storage bucket name | No (default: `media`) |
| `AUTH_MODE` | `mock` for dev (uses dev-user-a/b tokens) or `production` (JWT + header fallback) | No (default: `mock`) |
| `JWT_USER_HEADER` | Header name for user ID injection in production mode | No (default: `x-user-id`) |
| `DEBUG` | Enable debug logging | No (default: `false`) |

### Local Development Commands

```bash
# Install all dependencies (root + backend)
npm run install:all

# Start both frontend (Vite on :3000) and backend (Express on :5000)
npm run dev

# Start backend only
npm run backend

# Start backend with auto-reload (nodemon)
npm run backend:dev

# Start frontend only (without backend)
npm run frontend:vite

# Build frontend for production (output: dist/)
npm run build

# Preview production build locally
npm run preview

# Run ESLint
npm run lint

# Fix missing .js extensions in imports
node fix-imports.js
```

### URLs in Development

| Service | URL |
|---------|-----|
| Frontend (Vite dev server) | http://localhost:3000 |
| Backend API (Express) | http://localhost:5000 |
| API proxy (Vite → Express) | http://localhost:3000/api → http://localhost:5000/api |

### Production Deployment (Vercel)

```bash
npm run build              # Builds frontend to dist/
vercel                     # Deploys dist/ + api/ serverless function
```

The `vercel.json` configures:
- All `/api/*` requests routed to `api/index.js` (Express serverless function)
- All static assets served from the build output
- SPA fallback: unmatched routes serve `index.html`

### Database Schema

The Supabase schema is defined in `backend/supabase-setup.sql`. Tables:

| Table | Columns | Purpose |
|-------|---------|---------|
| `projects` | id, ctime, mtime, name, json, thumbnail, owner, gallery, isgift, deleted, version, created_at, updated_at, **share_token**, **reactions** | User projects (multi-tenant via `owner`); `share_token` enables public links; `reactions` is a JSON object of emoji→count |
| `usershapes` | id, md5, width, height, ext, name, owner, scale | Custom sprites/shapes |
| `userbkgs` | id, md5, width, height, ext, owner | Custom backgrounds |
| `projectfiles` | md5 (PK), contents | Project file assets (binary content as text) |
| `media` | id, project_id (FK), name, type, data (BYTEA) | Media associated with projects |

Multi-tenant tables (require `owner` for all operations): `projects`, `usershapes`, `userbkgs`.

> **`share_token`** is a random UUID stored on the `projects` row. It is returned by `POST /api/share/:projectId` and revoked by `DELETE /api/share/:projectId`. A null `share_token` means the project is not shared.

### Legacy SQL API

The frontend sends database operations as legacy SQL strings (matching the original iPad format):
```json
{ "sql": "select * from projects where deleted = ? order by ctime desc", "values": ["NO"] }
```
or structured:
```json
{ "action": "insert", "table": "projects", "data": { "name": "My Project", "json": "..." } }
```

The backend (`db.js`) translates both formats into Supabase SDK calls. The `owner` column is automatically injected/validated for multi-tenant tables.

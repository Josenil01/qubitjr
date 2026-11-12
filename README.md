## Official Disclaimer

Scratch and ScratchJr are trademarks of the Massachusetts Institute of Technology, which does not sponsor, endorse, or authorize this content. See [scratchjr.org](https://scratchjr.org) for more information. This project is an independent, community-built web port and is not affiliated with MIT or the Scratch Foundation.

## About QubitJr

**QubitJr** is a web-based reimagining of ScratchJr — the visual, block-based programming environment for young children — rebuilt to run entirely in the browser instead of as a native iPad/Android app. It keeps ScratchJr's core editing model (pages, sprites, drag-and-drop blocks, paint editor) while adding cloud accounts, cross-device project sync, and classroom tools for teachers.

If you're looking for the official ScratchJr app from MIT, see [LLK/scratchjr](https://github.com/LLK/scratchjr).

## Key Features

- **Full block-based editor** — pages, sprites/actors, scripts, paint editor, sound recording — ported from the original iPad/Android codebase.
- **Cloud projects** — students' projects, custom art, and photos are saved to a real backend (Supabase) instead of local device storage, so work follows the student across devices.
- **Custom Qubit Jr character library** — a dedicated, from-scratch character pack (Qubit, Ruby, Allan, Cris, and 100+ others) alongside the original ScratchJr art assets.
- **Live classroom observation** — teachers can watch a student's editor live, mirrored in real time, and temporarily take control when needed.
- **HelloYotta platform integration** — single sign-on and classroom roster data flow in from the parent HelloYotta platform; student and teacher identity use two independent, purpose-built verification paths.
- **Public project sharing** — read-only shareable links via a dedicated player view, with emoji reactions.
- **Mobile & tablet support** — touch-first interactions (drag, hold-to-delete, category selection) alongside the original mouse-driven desktop experience.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES6+, no framework), built with **Vite** |
| Styling | Plain CSS with a custom template-literal preprocessor (`${css_vh(N)}`, `${css_vw(N)}`) resolved at build time |
| Backend | **Node.js** + **Express** |
| Database | **Supabase** (PostgreSQL) |
| File storage | **Supabase Storage** (projects, custom art, recordings) |
| Realtime | Supabase Realtime (live classroom observation channels) |
| Auth | JWT — HMAC-signed teacher tokens verified locally; student tokens verified against the HelloYotta platform |
| Deployment | **Vercel** (static frontend + serverless Express function) |

For the full architecture reference (directory-by-directory), see [agent.md](agent.md).

## Recent Platform Improvements

A snapshot of the more substantial work that's gone into hardening and polishing QubitJr recently:

**Asset pipeline & character library**
- Updated all 58 visible animals to the reviewed chibi artwork, including corrected birds, snake, butterfly legs and plain insect antennae. PNG thumbnails, stage SVGs and alpha-derived hit-test outlines are synchronized; catalog identifiers and scales are preserved. Export/validation details and the original-asset backup are documented in [the animal library notes](art-previews/chibi/animais/README.md).
- Traced accurate hit-test outlines (`pathborder_`) for all 127 Qubit Jr characters, so click/drag/collision now follows each character's real silhouette instead of its full bounding rectangle.
- Removed baked-in white/black backgrounds from the entire Qubit Jr SVG/PNG pack via alpha-aware background removal, so characters render with true transparency.
- Fixed the sprite catalog (`media.json`) so the character picker groups and orders correctly, and curated which characters are offered by default.
- Filled in 75 missing Portuguese character names and corrected the legacy brand color to the current Qubit Jr palette across the UI.

**Mobile & responsive**
- Added full touch support (drag, hold-to-delete) to the stage, block palette, scripts pane, actor list, and page list — previously mouse-only.
- Fixed the editor's block area rendering too short on mobile by switching the build's CSS unit substitution from `vh`/`vw` to dynamic viewport units (`dvh`/`dvw`), which correctly track the visible area as the browser's address bar collapses/expands.
- Rebuilt the Home/Lobby project grid as a real flex-wrap layout (previously an inconsistent `inline-block` flow mixing viewport-width and viewport-height units), and fixed character-picker card centering.

**Reliability**
- Fixed a save-blocking crash: a 0×0 canvas from an uninitialized text sprite could abort the entire project save mid-flight, silently discarding a session's edits.
- Added a network fallback for project/page/sprite thumbnails that were never cached in the current browser (e.g. synced from another device), plus a loading screen that waits for the project list and all thumbnails before revealing the Home grid.
- Added in-memory caching for student identity token verification, fixing a HelloYotta API quota exhaustion caused by re-verifying the same token on every request during live observation polling.

**Performance**
- Configured edge/browser caching (`Cache-Control`) for the static character library, UI icons, and other public assets, cutting repeat network requests when reopening the character gallery.

## Quick Start

### Prerequisites
- **Node.js 14+**
- **npm**

### Local Development

```bash
# Install all dependencies (root + backend)
npm run install:all

# Start both backend (Express, :5000) and frontend (Vite, :3000)
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

### Production Build

```bash
npm run build
# Output: dist/ (deployed as-is to Vercel)
```

### Deploy

The project deploys to **Vercel**: `vercel.json` builds the frontend with `vite build` and mounts the Express backend as a serverless function at `/api/*`. Pushing to the default branch triggers a fresh build — the `dist/` folder tracked in git is not what actually ships.

## Environment Variables

| Location | Purpose |
|---|---|
| `.env.local` | Frontend dev-only mock auth token (`VITE_MOCK_TOKEN`) and Supabase Realtime credentials for local testing |
| `backend/.env` | Supabase connection, HelloYotta integration mode/credentials, JWT signing secret — see `backend/.env.example` |

Never commit real secrets — both `.env` files are gitignored; only the `.example` files are tracked.

## Project Structure

```
.
├── api/                # Vercel serverless entry point
├── backend/src/        # Express backend (routes, Supabase/HelloYotta services)
├── src/app/             # Frontend (Vite root)
│   ├── src/editor/      # Block editor engine + UI
│   ├── src/lobby/       # Project lobby / home screen
│   ├── src/painteditor/ # Paint tool
│   ├── src/services/    # WebInterface — REST API client replacing native iOS/Android calls
│   ├── svglibrary/, pnglibrary/  # Character & background art
│   └── css/              # Stylesheets (template-literal preprocessed at build time)
├── vite.config.js       # Build configuration
├── vercel.json          # Deployment routing & caching rules
└── agent.md             # Full architecture reference for contributors/AI agents
```

## Code Quality

```bash
npm run lint
```

ESLint with a relaxed Airbnb-derived config, adapted for the original ScratchJr codebase's conventions.

## Acknowledgments

Thanks to the official Scratch/ScratchJr team and contributors:
https://github.com/LLK/scratchjr

Special thanks to the libraries this project builds on:
- **Snap.svg** (MIT/Berkeley) — block visual scripting foundations
- **Vite** — build tooling and dev server
- **Supabase** — database, storage, and realtime infrastructure
- **Vercel** — hosting and deployment

## Disclaimers

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

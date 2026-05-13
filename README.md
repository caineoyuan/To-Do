# To-Do

A personal task and target management app with a dark-themed UI, deployed on Railway.

**Live:** [to-do-neo.up.railway.app](https://to-do-neo.up.railway.app/)

## Features

### Tasks
- **Create, edit, and delete tasks** with inline editing and real-time updates
- **Prefix grouping** — tasks are automatically grouped by prefix (e.g. `SHUC - Fix bug` groups under **SHUC**)
- **Priority tagging** — append `- P0`, `- P1`, or `- P2` to set priority; sections sort by average priority
- **Section counts** — each group shows a task count; total count displayed next to the title
- **Completion** — check off tasks with a satisfying bell ding sound and smooth animation
- **Notes** — expand any task to add notes; hyperlinks are auto-detected and converted to buttons:
  - **Teams links** → purple gradient button with Teams icon
  - **Outlook links** → blue gradient button with Outlook icon
  - **Other links** → grey button with link icon and hostname
- **Export** — copy icon next to the title copies all tasks as a formatted bulleted list (rich HTML) ready to paste into Teams

### Targets
- **Monthly target tracking** — targets are prefixed with a month code (e.g. `2605 - SHUC - Ship` for May 2026)
- **Auto-generated IDs** — each target gets a unique sequential ID (01, 02, 03...)
- **Month sections** — current month appears first, future months next, past months collapse under a "Past" section
- **Sub-grouping** — within each month, targets group by prefix (e.g. SHUC, OOBE)
- **Progress bars** — each target shows a green progress bar with percentage based on linked task completion
- **Task linking** — append `- 05` to a task title to link it to target 05; supports both `- 05 - P0` and `- P0 - 05` orderings
- **Click to expand** — click a target to see its linked child tasks (with green checkmarks for completed ones)
- **Export** — same rich-text copy as tasks, grouped by month and prefix

### Quick-Add (Desktop)
- **Global hotkey** — `Ctrl+Shift+X` opens a floating dark-themed popup at your cursor position
- **Instant capture** — type a task and press Enter; it's sent directly to the API
- **AutoHotkey v2** script (`quick-add.ahk`) with screen-edge clamping and forced foreground activation

### UI
- **Dark theme** — dark background with subtle borders, rounded corners, and smooth animations
- **Responsive layout** — two-panel layout (Targets left, Tasks right) that adapts to smaller screens
- **DM Serif Text** title font with italic styling
- **Fluent UI icons** throughout (copy, link, checkmarks, target bullseye)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML/CSS/JS — single `index.html`, `style.css`, `app.js` |
| **Backend** | [Express](https://expressjs.com/) (Node.js) — REST API with JSON endpoints |
| **Database** | [PostgreSQL](https://www.postgresql.org/) via `pg` — with JSON file fallback for local dev |
| **Auth** | API key header (`X-API-Key`) for the quick-add script |
| **Hosting** | [Railway](https://railway.app/) — auto-deploys from GitHub on push |
| **Desktop** | [AutoHotkey v2](https://www.autohotkey.com/) — global hotkey script for quick task capture |

### Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express server, API routes, PostgreSQL/JSON dual storage, schema migrations |
| `app.js` | All frontend logic — rendering, parsing, API calls, export |
| `style.css` | Dark theme, two-panel layout, all component styles |
| `index.html` | HTML structure with SVG icons |
| `quick-add.ahk` | AutoHotkey v2 global hotkey script |

## Running Locally

```bash
npm install
npm start
```

The app starts on `http://localhost:3000`. Without a `DATABASE_URL` environment variable, it falls back to local JSON file storage (`data.json`).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks (active + completed) |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/:id` | Update task title/notes/targetNumber |
| `POST` | `/api/tasks/:id/complete` | Mark task as completed |
| `POST` | `/api/tasks/:id/uncomplete` | Restore a completed task |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `GET` | `/api/targets` | List all targets (active + completed) |
| `POST` | `/api/targets` | Create a target |
| `PATCH` | `/api/targets/:id` | Update target title/notes |
| `POST` | `/api/targets/:id/complete` | Mark target as completed |
| `POST` | `/api/targets/:id/uncomplete` | Restore a completed target |
| `DELETE` | `/api/targets/:id` | Delete a target |
| `GET` | `/api/targets/:targetNumber/tasks` | Get tasks linked to a target |

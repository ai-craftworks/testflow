# TestFlow — Developer Documentation

> Knowledge transfer guide for developers joining or taking over this project.

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 18+ | Stable LTS, wide hosting support |
| Framework | Express 4 | Minimal, battle-tested, no magic |
| Templating | express-handlebars (`.hbs`) | Server-side rendering, no build step |
| Database | better-sqlite3 | Synchronous SQLite driver, zero external deps |
| File uploads | multer v2 | Standard multipart handling |
| Slug generation | Custom utility | No deps needed for simple slug logic |
| CSS | Vanilla CSS (custom design system) | No Tailwind/Bootstrap build step |
| JS (frontend) | Vanilla ES2020 | No bundler, no framework |

---

## Project Structure

```
testflow/
├── src/
│   ├── app.js                  # Entry point: Express setup, routes, server start
│   ├── routes/
│   │   ├── projects.js         # CRUD for /projects
│   │   ├── repositories.js     # CRUD for /projects/:p/repos
│   │   ├── testcases.js        # CRUD for .../cases
│   │   ├── testplans.js        # CRUD for .../plans
│   │   ├── testruns.js         # Runs + AJAX result/note endpoints
│   │   └── uploads.js          # POST /upload/image (multer)
│   └── utils/
│       ├── initDb.js           # Schema creation + getDb() factory
│       ├── resetDb.js          # Delete DB file, re-init
│       ├── seed.js             # Insert demo data
│       └── slug.js             # makeSlug(), uniqueSlug()
├── views/
│   ├── layouts/
│   │   └── main.hbs            # HTML shell: nav, breadcrumbs, body slot
│   ├── partials/
│   │   ├── rich-editor.hbs     # Reusable rich text editor widget
│   │   └── case-card.hbs       # Test case card used in repo + plan views
│   ├── projects/
│   │   ├── index.hbs           # Project listing (home page)
│   │   └── show.hbs            # Project detail: stats + repo list
│   ├── repositories/
│   │   └── show.hbs            # Repo detail: cases, plans, runs (tabbed)
│   ├── testcases/
│   │   ├── show.hbs            # Test case detail view
│   │   └── edit.hbs            # Test case edit form
│   ├── testplans/
│   │   ├── new.hbs             # Create plan + select cases
│   │   ├── show.hbs            # Plan detail: case list, run history
│   │   └── edit.hbs            # Edit plan: name, status, re-select cases
│   ├── testruns/
│   │   ├── new.hbs             # Create run: from plan or manual selection
│   │   └── show.hbs            # Run execution view: results, notes, progress
│   ├── 404.hbs
│   └── error.hbs
├── public/
│   ├── css/
│   │   └── main.css            # Full design system (CSS custom properties)
│   ├── js/
│   │   └── main.js             # All frontend behaviour (modals, AJAX, editor)
│   └── images/uploads/         # User-uploaded images (multer destination)
├── data/
│   └── testflow.db             # SQLite database (auto-created)
├── package.json
├── README.md
└── development.md              # This file
```

---

## Database Schema

The database is initialized by `src/utils/initDb.js` which runs `CREATE TABLE IF NOT EXISTS` on every startup — safe to call repeatedly.

### Tables

#### `projects`
Top-level container for all test artifacts.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Display name |
| slug | TEXT UNIQUE | URL-safe identifier, auto-generated |
| description | TEXT | Optional |
| color | TEXT | Hex color for UI indicator |
| created_at / updated_at | DATETIME | Auto timestamps |

#### `repositories`
Belongs to a project. Groups related test cases.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| project_id | FK → projects | CASCADE DELETE |
| name / slug | TEXT | Slug unique per project |
| description | TEXT | |

#### `test_groups`
Optional folder inside a repository to group test cases visually.

| Column | Type |
|---|---|
| id | INTEGER PK |
| repository_id | FK → repositories, CASCADE |
| name / description | TEXT |

#### `test_cases`
The core entity. Stores all test case metadata.

| Column | Type | Constraint |
|---|---|---|
| repository_id | FK | CASCADE |
| group_id | FK → test_groups | SET NULL |
| priority | TEXT | critical/high/medium/low |
| type | TEXT | functional/regression/smoke/performance/security/usability/other |
| status | TEXT | active/deprecated/draft |
| steps | TEXT | Plain text, newline-separated |

#### `test_plans`
Named collection of test cases.

| Column | Type |
|---|---|
| repository_id | FK |
| status | active / archived |

#### `test_plan_cases`
Join table: many-to-many between plans and cases, with ordering.

| Column | Type |
|---|---|
| test_plan_id | FK, CASCADE |
| test_case_id | FK, CASCADE |
| sort_order | INTEGER |
| UNIQUE | (test_plan_id, test_case_id) |

#### `test_runs`
An execution instance. May reference a plan (or be ad-hoc).

| Column | Type |
|---|---|
| repository_id | FK |
| test_plan_id | FK nullable |
| status | in_progress / completed / aborted |
| completed_at | DATETIME nullable |

#### `test_run_results`
One row per (run × case) pair. Tracks execution outcome.

| Column | Type |
|---|---|
| test_run_id | FK, CASCADE |
| test_case_id | FK, CASCADE |
| status | pending/passed/failed/blocked/skipped |
| UNIQUE | (test_run_id, test_case_id) |

#### `test_run_notes`
Unlimited rich-text notes per result row. Stores HTML from the contenteditable editor.

| Column | Type |
|---|---|
| test_run_result_id | FK, CASCADE |
| content | TEXT (HTML) |

---

## Routing Conventions

All routes follow REST-like conventions using **POST for mutations** (no PUT/PATCH/DELETE — browser forms only support GET/POST).

| Pattern | Method | Handler | Action |
|---|---|---|---|
| `/` | GET | projects#index | List projects |
| `/` | POST | projects#create | Create project |
| `/projects/:slug` | GET | projects#show | Project detail |
| `/projects/:slug/edit` | POST | projects#update | Update project |
| `/projects/:slug/delete` | POST | projects#destroy | Delete project |
| `/projects/:p/repos` | POST | repos#create | Create repo |
| `/projects/:p/repos/:r` | GET | repos#show | Repo detail |
| `/projects/:p/repos/:r/cases` | POST | cases#create | Create case |
| `/projects/:p/repos/:r/cases/:id` | GET | cases#show | Case detail |
| `/projects/:p/repos/:r/cases/:id/edit` | GET/POST | cases#edit/update | Edit case |
| `/projects/:p/repos/:r/plans/new` | GET | plans#new | New plan form |
| `/projects/:p/repos/:r/plans` | POST | plans#create | Create plan |
| `/projects/:p/repos/:r/runs/new` | GET | runs#new | New run form |
| `/projects/:p/repos/:r/runs` | POST | runs#create | Create run |
| `/projects/:p/repos/:r/runs/:id/results/:rid/status` | POST | runs#updateStatus | **AJAX** |
| `/projects/:p/repos/:r/runs/:id/results/:rid/notes` | POST | runs#addNote | **AJAX** |
| `/upload/image` | POST | uploads#image | **AJAX** file upload |

Routes use `mergeParams: true` so nested routers can access parent params (e.g. `:projectSlug` is available inside the repositories router).

---

## Handlebars Helpers

Defined in `src/app.js` under the `helpers` object passed to `express-handlebars`.

| Helper | Usage | Returns |
|---|---|---|
| `eq a b` | `{{#if (eq x 'val')}}` | Boolean equality |
| `ne a b` | `{{#if (ne x null)}}` | Not equal |
| `includes arr val` | `{{#if (includes selectedIds id)}}` | Array membership (string-coerced) |
| `json v` | `{{json obj}}` | JSON.stringify / JSON.parse |
| `colorList` | `{{#each (colorList)}}` | Returns the 9 project color hex codes |
| `priorityClass p` | `class="{{priorityClass priority}}"` | CSS class string |
| `statusClass s` | | CSS class string |
| `capitalize s` | `{{capitalize priority}}` | First letter uppercase |
| `formatDate d` | `{{formatDate created_at}}` | "Jan 5, 2025" |
| `formatDateTime d` | `{{formatDateTime updated_at}}` | "Jan 5, 2025, 02:30 PM" |
| `pct a b` | `{{pct passed total}}` | Integer percentage (0 if b=0) |
| `truncate s len` | `{{truncate description 60}}` | Truncate with ellipsis |
| `typeLabel t` | `{{typeLabel type}}` | Human label (e.g. "functional" → "Functional") |
| `statusLabel s` | `{{statusLabel status}}` | Human label (e.g. "in_progress" → "In Progress") |
| `ifCond v1 op v2` | `{{#ifCond x ">" 0}}` | Block helper for comparisons |
| `add a b` | `{{add passed failed}}` | Numeric add |
| `sub a b` | | Numeric subtract |
| `or a b` | `{{or plan_name '—'}}` | Logical OR / fallback |

---

## Frontend Architecture

There is **no build step**. All frontend code is in `public/js/main.js` — plain ES2020 loaded via a `<script>` tag in the layout.

### Modal System
Modals use data attributes for wiring:
```html
<!-- Trigger -->
<button data-modal="modal-new-project">Open</button>

<!-- Close button inside modal -->
<button data-close-modal="modal-new-project">✕</button>

<!-- Overlay click also closes -->
<div class="modal-overlay" id="modal-new-project">...</div>
```
`main.js` listens for clicks on `[data-modal]` and `[data-close-modal]` globally. Pressing `Escape` closes all open modals.

### Tab System
```html
<div class="tab-set">
  <div class="tabs">
    <button class="tab-btn active" data-tab="tab-cases">Cases</button>
    <button class="tab-btn" data-tab="tab-plans">Plans</button>
  </div>
  <div class="tab-panel active" id="tab-cases">...</div>
  <div class="tab-panel" id="tab-plans">...</div>
</div>
```
Click handler in `main.js` toggles `active` class on both buttons and panels within the same `.tab-set` ancestor.

### AJAX Status Updates
Result status selects have `class="result-status-select"` and `data-url="..."`. The `change` event fires a `fetch` POST with `{ status }` JSON body. On success the badge text/class is updated in place without a page reload.

### Rich Text Editor
The contenteditable-based editor is initialized by `initRichEditor(wrap)` (and `initRichEditorInline(wrap)` for dynamically created note forms in the run view). It uses `document.execCommand` for formatting commands — this is legacy but universally supported and requires no dependencies.

**Image flow:**
1. User clicks 📷 or pastes/drops an image
2. `uploadImage(file)` POSTs to `/upload/image` (multer)
3. Server saves to `public/images/uploads/` and returns `{ url }`
4. `document.execCommand('insertImage', false, url)` inserts it inline

The hidden input `<input type="hidden" name="content">` is kept in sync with `editor.innerHTML` on every `input` event. This ensures the value is submitted with the form.

### Note Persistence
Notes in test runs are saved via AJAX (`fetch` POST to `.../notes`). The response includes the saved note object, which is immediately rendered into the DOM. Existing notes can be edited inline (toggling `contentEditable`) and deleted.

---

## CSS Design System

All design tokens are in `:root` CSS custom properties at the top of `public/css/main.css`:

```css
--bg            /* page background: #f7f8fa */
--surface       /* card/modal background: white */
--border        /* standard border: #e3e6ec */
--accent        /* primary blue: #3b6ef4 */
--green / --red / --yellow / --purple / --orange
--text / --text-2 / --text-3   /* text hierarchy */
--radius / --radius-lg         /* 8px / 12px */
--shadow-sm / --shadow / --shadow-lg
--font / --mono
```

**Key component classes:**
- `.card`, `.card-header`, `.card-body` — container with border and shadow
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.btn-sm` — buttons
- `.form-control`, `.form-group`, `.form-label`, `.form-row` — form elements
- `.badge`, `.badge-blue/.green/.red/.gray` — pill labels
- `.status-badge.{status}` — coloured status pills (passed/failed/blocked etc.)
- `.priority-badge.{priority}` — priority with dot indicator
- `.modal-overlay`, `.modal`, `.modal-lg` — modal system
- `.tabs`, `.tab-btn`, `.tab-panel` — tab navigation
- `.stats-row`, `.stat-card` — dashboard stat grid
- `.progress-stacked`, `.seg-{status}` — multi-colour progress bar
- `.rich-editor-wrap`, `.rich-editor-toolbar`, `.rich-editor` — editor
- `.empty-state` — centred empty placeholder

---

## Development Patterns

### Adding a New Entity
1. Add table to `src/utils/initDb.js` (use `CREATE TABLE IF NOT EXISTS`)
2. Create `src/routes/myentity.js` — follow the same `ctx()` guard pattern
3. Mount in `src/app.js`: `app.use('/projects/:p/repos/:r/myentity', myRouter)`
4. Add Handlebars views in `views/myentity/`
5. Link from the repository show page (add a new tab or section)

### Adding a New Handlebars Helper
Add to the `helpers` object in `src/app.js`:
```js
myHelper: (arg) => doSomething(arg)
```
Then use in any template: `{{myHelper someValue}}`

### Adding a New AJAX Endpoint
1. Add the route in the relevant router file
2. Use `res.json({ ok: true, data: ... })` for the response
3. In `main.js`, `fetch()` the endpoint and update the DOM on success

### Handling DB Errors
All routes open a DB connection, use it, then close it. Always close in a `try/finally` if there's risk of an early return — currently routes use inline guards (`if (!x) { db.close(); return res.redirect(...) }`) which is sufficient for this scale.

### Slug Generation
`makeSlug(text)` converts any string to a URL-safe slug. `uniqueSlug(db, table, slug, column, extraWhere, extraParams)` appends `-1`, `-2` etc. to avoid collisions.

```js
const slug = uniqueSlug(db, 'repositories', makeSlug(name), 'slug', 'AND project_id = ?', [projectId]);
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |

No `.env` file is needed. Export variables in your shell or use a process manager like PM2.

---

## Deployment (Local / Self-Hosted)

### With PM2 (recommended for persistent local use)
```bash
npm install -g pm2
pm2 start src/app.js --name testflow
pm2 save
pm2 startup   # auto-start on reboot
```

### With systemd
```ini
[Unit]
Description=TestFlow

[Service]
WorkingDirectory=/path/to/testflow
ExecStart=/usr/bin/node src/app.js
Restart=always
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Backup
```bash
# Backup data
cp data/testflow.db data/testflow.db.bak
cp -r public/images/uploads /backup/location/
```

---

## Known Limitations & Future Ideas

- **No authentication** — by design, for local/trusted use only. Do not expose publicly.
- **No real-time updates** — if two users run tests simultaneously, they won't see each other's status changes without refreshing.
- **No attachment support beyond images** — only image uploads in notes are supported.
- **No test case import/export** — could add CSV/JSON export in a future iteration.
- **execCommand is deprecated** — the rich text editor uses `document.execCommand`. It works in all browsers but a future refactor could use a library like Trix or ProseMirror for richer editing.
- **SQLite concurrency** — WAL mode is enabled (`PRAGMA journal_mode = WAL`) which handles concurrent reads well, but this app is intended for a single user or small team on localhost.

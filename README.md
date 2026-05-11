# TestFlow — Test Case Management Platform

A lightweight, self-hosted test case management tool. No database server, no authentication required, no cloud needed — runs entirely on your machine.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

### Access globally

Alternatively, you can link it globally and run from anywhere.

```bash
# 1. Link globally
npm link

# 2. Check version
testflow version

# 3. Run from anywhere
testflow start
```

---

## NPM Scripts

| Command | Description |
|---|---|
| `npm start` | Start the server (production) |
| `npm run dev` | Start with auto-reload on file changes (requires nodemon) |
| `npm run init-db` | Create/initialize the database (runs automatically on start) |
| `npm run reset-db` | **⚠ Destructive** — wipe and recreate the database |
| `npm run seed` | Load demo data (run after `reset-db` on empty database) |

### Custom Port

```bash
PORT=8080 npm start
```

---

## Features

### Projects
- Create named projects with a color label
- See aggregate stats: repository count, test case count, active runs
- Priority and run-result breakdowns on the project dashboard

### Repositories
Inside a project, create one or more **repositories** to group related test cases (e.g. "Checkout Flow", "User Auth").

Each repository has:
- **Test Cases** — individual test scenarios
- **Test Groups** — optional folders to organize cases
- **Test Plans** — curated sets of cases for a specific test objective
- **Test Runs** — an execution instance of a plan or manual case selection

### Test Cases
Each test case stores:

| Field | Description |
|---|---|
| Title | Short descriptive name |
| Priority | Critical / High / Medium / Low |
| Type | Functional / Regression / Smoke / Performance / Security / Usability / Other |
| Status | Active / Draft / Deprecated |
| URL | The page or endpoint under test |
| Description | Context and purpose |
| Preconditions | Setup required before running |
| Steps | Numbered steps (one per line) |
| Expected Result | What a passing test looks like |
| Tags | Comma-separated labels |
| Group | Optional organizational folder |

### Test Plans
A test plan is a saved selection of test cases. Use plans to define:
- Sprint regression suites
- Smoke test checklists
- Feature-specific coverage sets

Create a plan → select cases → save. Plans can be reused across multiple runs.

### Test Runs
A test run executes a set of cases:
1. Create a run from a **Test Plan** (all plan cases loaded automatically) or **manual selection**
2. For each case, set the result: **Passed / Failed / Blocked / Skipped / Pending**
3. Add **rich-text notes** with formatted text, images (upload or paste/drag), and links
4. Complete or abort the run when finished

#### Notes Editor
The notes editor supports:
- **Bold, italic, underline, strikethrough**
- **Bullet and numbered lists**
- **Blockquotes and code blocks**
- **Image upload** via the 📷 button
- **Paste images** directly from clipboard (screenshots, etc.)
- **Drag and drop** image files into the editor
- **Hyperlinks**

### Stats & Reporting
- **Project dashboard**: total repos, cases, plans, runs, active runs, priority breakdown, run result distribution
- **Repository dashboard**: case/plan/run counts, priority and type breakdowns
- **Test run view**: live stacked progress bar (pass/fail/blocked/skipped/pending), count per status, completion timestamp, pass rate

---

## Data Storage

All data lives in `data/testflow.db` (SQLite). Uploaded images are stored in `public/images/uploads/`.

To back up: copy the `data/` folder and `public/images/uploads/`.

To reset: `npm run reset-db` (this deletes all data permanently).

---

## Tips

- Use **groups** to organise test cases by feature or user story inside a repository
- Use **test plans** for recurring test objectives — you can run the same plan many times
- Tag cases with consistent labels (`smoke`, `regression`, `auth`) to make filtering easier
- The **filter bar** on test runs lets you quickly see only failed or pending cases
- Status updates on a run are saved instantly via AJAX — no need to submit a form
- Notes are saved per test result (not per test case), so each run has its own notes history

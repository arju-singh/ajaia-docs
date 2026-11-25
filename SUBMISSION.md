# Submission: AI-Native Full Stack Developer Assignment

**Candidate:** Arju Singh

| | |
|---|---|
| Live app | https://ajaia-docs-vbmu.onrender.com |
| Source code | https://github.com/arju-singh/ajaia-docs (also in this Drive folder) |
| Walkthrough video | VIDEO_URL_PLACEHOLDER |
| Login | `alice@ajaia.test` / `bob@ajaia.test` / `carol@ajaia.test`, password `demo1234` (one-click buttons on the login page) |

> The live app runs on Render's free tier: the first load after idle can take ~30–50 s while it wakes up.

## What's included

| File / folder | What it is |
|---|---|
| `server/` | Express 5 API, SQLite schema + seed data, access control, file import |
| `client/` | React + TipTap editor UI |
| `server/test/api.test.js` | 11 automated API tests (`npm test`) |
| `samples/` | `.docx`, `.md` and `.txt` files to try the import |
| `screenshots/` | Screenshots of the main flows |
| `README.md` | Setup, run, test and deploy instructions; demo accounts |
| `ARCHITECTURE.md` | What I prioritized, data model, tradeoffs, next steps |
| `AI_WORKFLOW.md` | AI tools used, what I changed or rejected, how I verified |
| `VIDEO_URL.txt` | Link to the walkthrough video |
| `render.yaml` | Deployment config |

## What works end to end

- Sign in as any of three seeded users
- Create, rename, edit, delete documents, with autosave and a visible save status
- Rich text: bold, italic, underline, strikethrough, H1–H3, bulleted and numbered lists, quotes, undo/redo
- Import .txt / .md / .docx as a new document, keeping headings, lists and emphasis
- Share by email as **Can edit** or **Can view**; change or remove access; owner-only share/delete
- "My documents" vs "Shared with me" with role badges; viewers get a read-only editor
- Persistence in SQLite; formatting survives reloads
- Export to Markdown or HTML (stretch)
- Role-based permissions beyond basic access (stretch)

## What's incomplete or intentionally cut

- **No real-time co-editing.** Concurrent edits are last-write-wins.
- **Mock auth:** seeded users only, no signup/reset/token expiry.
- **Data on the live demo resets** when the free Render instance restarts (ephemeral disk). Demo data is re-seeded automatically.
- No comments, version history, images or tables.
- No frontend automated tests (API tests only).

## Next 2–4 hours

1. Version history with restore
2. Conflict detection on save (409 + reload/overwrite prompt)
3. Postgres + persistent hosting
4. Playwright end-to-end test of the share flow
5. Import into an existing document

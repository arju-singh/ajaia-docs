# Ajaia Docs

A lightweight collaborative document editor: create and format documents, import files, and share them with other users as editors or viewers.

**Live app:** https://ajaia-docs-vbmu.onrender.com
**Source:** https://github.com/arju-singh/ajaia-docs

## Demo accounts

All seeded accounts use the password **`demo1234`**. The login page also has one-click buttons for each.

| User | Email | Starts with |
|---|---|---|
| Alice Johnson | alice@ajaia.test | Owns "Q3 planning notes", already shared with Bob as editor |
| Bob Martinez | bob@ajaia.test | Sees that doc under "Shared with me" |
| Carol Chen | carol@ajaia.test | Nothing, so you can test sharing from scratch |

**Quick sharing check:** sign in as Alice → open a doc → **Share** → add `carol@ajaia.test` as *Can view* → sign out → sign in as Carol. The doc appears under "Shared with me", opens read-only, and has no toolbar.

## Features

- **Documents:** create, rename (click the title), edit, delete (owner only). Changes autosave about 0.8 s after you stop typing; the header shows *Saving… / All changes saved / Not saved + Retry*.
- **Rich text:** bold, italic, underline, strikethrough, Heading 1–3, bulleted and numbered lists, quotes, undo/redo, plus the usual keyboard shortcuts (⌘B / ⌘I / ⌘U, `# ` for headings, `- ` and `1. ` for lists).
- **File import:** upload **.txt, .md or .docx** (max 5 MB) and it becomes a new editable document. Markdown and Word headings, lists, bold and italic carry over. Other file types are rejected with a clear message.
- **Sharing:** the owner adds people by email as **Can edit** or **Can view**, and can change or remove access later. The document list separates **My documents** from **Shared with me** and shows role badges.
- **Export:** download any document as Markdown or HTML.
- **Persistence:** SQLite. Documents are stored as sanitized HTML, so formatting survives reloads.

Sample files for testing import are in [`samples/`](samples/).

## Running locally

Requires **Node.js 22.13 or newer** (it uses the built-in `node:sqlite` module, so there are no native builds). Tested on Node 24.

```bash
git clone https://github.com/arju-singh/ajaia-docs.git
cd ajaia-docs
npm run build      # installs server + client deps and builds the client
npm start          # http://localhost:3001
```

For development with hot reload, run these in two terminals:

```bash
npm run dev --prefix server   # API on :3001
npm run dev --prefix client   # Vite on :5173, proxies /api to :3001
```

The database is created at `server/data/docs.db` on first start and seeded with the demo users. Delete that file to reset. Set `DB_FILE` to change the location, or `PORT` to change the port.

## Tests

```bash
npm test
```

Runs 11 API tests (Node's built-in test runner + supertest, against an in-memory database). They cover auth, create/rename/reopen with formatting preserved, HTML sanitizing, title validation, sharing visibility, viewer/editor/owner permissions, revoking access, and .md/.txt/unsupported-file imports.

## Deployment

Deployed on Render's free tier using [`render.yaml`](render.yaml): `npm run build`, then `npm start`. A single Node service serves both the API and the built React app.

**Note:** Render's free instances sleep after ~15 minutes idle, so the first request can take ~30–50 s. They also have an ephemeral disk, so the SQLite file resets on redeploy or restart and the demo data is re-seeded. That's fine for a review build. See ARCHITECTURE.md for what I'd change for production.

## Project layout

```
server/
  src/app.js      routes, access checks, validation, error handling
  src/db.js       schema, seed data, password hashing
  src/html.js     HTML sanitizing and .txt/.md/.docx → HTML conversion
  test/           API tests
client/
  src/DocumentList.jsx   home: new doc, import, owned vs shared
  src/DocumentEditor.jsx editor page, autosave, export
  src/Toolbar.jsx        formatting toolbar
  src/ShareDialog.jsx    share / change role / remove access
  src/useAutosave.js     debounced, ordered saves with retry
```

More docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_WORKFLOW.md](AI_WORKFLOW.md) · [SUBMISSION.md](SUBMISSION.md)

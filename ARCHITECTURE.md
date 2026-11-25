# Architecture note

## What I prioritized

The brief rewards depth over breadth, so I picked one coherent slice and tried to make every part of it work properly:

1. **An editor that feels reliable.** Autosave with a visible status, saves that can't arrive out of order, a retry when a save fails, and no lost edits when you navigate away. A doc editor that sometimes loses text is worse than one with fewer features.
2. **Sharing with real access rules on the server.** Owner / editor / viewer, enforced on every request, not just hidden in the UI.
3. **Import that keeps structure.** .docx and .md headings, lists and emphasis come through as real formatting, not a blob of text.
4. **Something reviewers can run in one step.** One Node process, no external services, seeded users.

## Stack and why

| Layer | Choice | Reason |
|---|---|---|
| Editor | **TipTap** (ProseMirror) | Solid schema-based rich text with good list/heading behaviour. Writing on raw `contentEditable` would have used the whole timebox on edge cases. |
| Client | React + Vite | Fast to build, small surface. Hash routing (`#/d/:id`) because there are only two screens. |
| API | Express 5 | Async errors propagate to one error handler, so routes stay short. |
| Storage | SQLite via built-in `node:sqlite` | Relational data (users, docs, shares) with zero setup and no native dependency to compile on deploy. |
| Hosting | Render free tier | Free, deploys from GitHub, one service serves API + static client. |

## Data model

```
users(id, email, name, password_hash)
sessions(token, user_id)
documents(id, owner_id, title, content, created_at, updated_at)
document_shares(document_id, user_id, role: viewer|editor)   PK(document_id, user_id)
```

- **Content is stored as HTML** produced by the editor. It's what TipTap reads and writes natively, it round-trips formatting exactly, and it's readable when debugging. Every write goes through `sanitize-html` with an allow-list that matches the editor's schema, so nothing outside it (scripts, event handlers, styles) can be stored, whether it comes from the editor, an import, or a hand-crafted API call.
- **Ownership is a column; sharing is a join table** with a role. One query (`findDocForUser`) returns the document together with the caller's access level, and every route goes through `loadDoc(req, minimumRole)`.
- A document you have no access to returns **404, not 403**, so IDs can't be probed to discover documents. Insufficient role (e.g. a viewer trying to edit) returns 403 with a readable message.

## Key decisions and tradeoffs

- **Autosave instead of a Save button.** Changes are batched for 800 ms and sent as one PATCH. Saves are chained so an older request can't overwrite a newer one. Failed changes are kept and retried, and the page flushes on navigation.
- **Last write wins.** Two editors typing at the same moment will overwrite each other's saves. Real-time co-editing (CRDT/OT via Yjs + websockets) is the right fix but is a project on its own, so I cut it deliberately.
- **Mock auth, real session handling.** Seeded users with scrypt-hashed passwords and random bearer tokens stored in the DB. There's no signup, password reset, or token expiry; those were out of scope.
- **Share by email to existing users only.** No invite flow for unknown emails. The dialog suggests the demo users so reviewers don't have to guess.
- **Import creates a new document** rather than merging into an existing one. It's the clearest behaviour and avoids "where did my content go" questions. PDF isn't supported: extracting structured text from PDFs reliably is a rabbit hole.
- **Ephemeral SQLite on Render free.** Acceptable for a review build. For production I'd move to Postgres (same schema) or attach a persistent disk.

## Deliberately not built

Real-time collaboration and presence, comments/suggestions, version history, images/tables, signup and password reset, pagination of the document list, rate limiting.

## With another 2–4 hours

1. **Version history:** snapshot content on save (throttled) into a `document_versions` table, with a "restore" button. Cheap, and it covers the last-write-wins risk.
2. **Conflict detection:** send `updatedAt` with each PATCH and return 409 if the doc changed underneath, with a "reload / overwrite" prompt.
3. **Postgres + persistent hosting** so data survives restarts.
4. **Frontend tests:** a Playwright happy path (login → create → format → share → open as second user).
5. **Import into the current document** as a second upload mode.

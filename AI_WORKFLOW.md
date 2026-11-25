# AI workflow note

## Tools used

- **Claude Code** (CLI agent in my terminal) for scaffolding, writing most of the first-pass code and tests, and driving a browser to click through the app.
- No other AI tools.

## Where AI sped things up

- **Boilerplate and wiring:** Express routes, SQLite schema, the Vite/React setup, CSS. That would have been an hour of typing; it took minutes.
- **Library details:** TipTap v3 API changes (`useEditorState`, StarterKit now bundling Underline), `mammoth` for .docx, `node:sqlite`. I didn't have to look these up from scratch.
- **Tests:** once I listed the access cases that mattered (non-shared user, viewer, editor, owner, revoke), it wrote the supertest cases quickly.
- **Docs:** first drafts of the README and this note, which I then edited.

## What I changed or rejected

- **Spurious save on open.** Opening a document immediately showed "All changes saved", meaning a PATCH was firing with no edits. The cause was TipTap's `setEditable()` emitting an update event by default. I found it while clicking through the app and fixed it with `setEditable(x, false)`.
- **Fragile content loading.** The first version decided whether to load content into the editor by checking `editor.getHTML() === '<p></p>'`. That breaks for an empty document and is order-dependent, so I replaced it with an explicit "loaded" ref.
- **403 vs 404.** The generated access check returned 403 for documents you can't see. I changed it to 404 so document IDs can't be probed, and kept 403 only for "you can see it but your role doesn't allow this".
- **Native SQLite driver.** I rejected `better-sqlite3` in favour of Node's built-in `node:sqlite` to avoid native compilation on the deploy host.
- **Import titles.** Titles came from the filename (`release_notes.md` → "release notes"). I changed it to use the document's first heading when there is one, and updated the test.
- **Scope suggestions I said no to:** real-time collaboration with websockets/Yjs and a separate frontend deployment. Both were reasonable ideas but would have eaten the timebox; I wrote them down as next steps instead.
- **Sanitizer allow-list.** I narrowed it to exactly the node types the editor supports instead of a generic "safe HTML" list.

## How I verified it

- **Automated:** 11 API tests covering auth, formatting round-trip, sanitizing, validation, every permission boundary, revocation, and imports. `npm test` must pass before each push.
- **Manual, in a real browser:** created and formatted a doc (headings, bold, underline, both list types), reloaded to confirm persistence, shared it as *Can view* with a second user, signed in as that user, and confirmed it shows under "Shared with me", opens read-only, has no toolbar, and ignores typing. Checked the console for errors.
- **Imports:** tested a real .docx (headings, bold/italic, bulleted and numbered lists), a .md, and a .txt from `samples/`, and checked the HTML that came out.
- **Reading the code:** I read every generated file before committing, especially the access-control query and the autosave hook, since those are where subtle bugs would hurt users most.

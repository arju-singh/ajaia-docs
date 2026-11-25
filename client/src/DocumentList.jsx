import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { timeAgo } from './format.js';

const ACCEPTED = '.txt,.md,.docx';

export default function DocumentList() {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const load = () =>
    api.listDocuments()
      .then(setDocs)
      .catch((err) => setError(err.message));

  useEffect(() => { load(); }, []);

  const open = (id) => { window.location.hash = `#/d/${id}`; };

  async function createBlank() {
    setBusy(true);
    try {
      const { document } = await api.createDocument('Untitled document');
      open(document.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function importFile(ev) {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { document } = await api.importFile(file);
      open(document.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    try {
      await api.deleteDocument(doc.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="list-page">
      <section className="start-row">
        <button className="new-card" onClick={createBlank} disabled={busy}>
          <span className="new-plus">+</span>
          <span>Blank document</span>
        </button>
        <button className="new-card" onClick={() => fileInput.current.click()} disabled={busy}>
          <span className="new-plus">⇪</span>
          <span>Import a file</span>
          <span className="muted small">.txt, .md or .docx · up to 5 MB</span>
        </button>
        <input ref={fileInput} type="file" accept={ACCEPTED} hidden onChange={importFile} />
      </section>

      {error && <p className="error banner" role="alert">{error}</p>}

      {!docs ? (
        <p className="muted">Loading documents…</p>
      ) : (
        <>
          <DocSection title="My documents" empty="You haven't created any documents yet.">
            {docs.owned.map((d) => (
              <DocRow key={d.id} doc={d} onOpen={open}
                meta={d.shareCount ? `Shared with ${d.shareCount}` : 'Only you'}
                badge={<span className="badge owner">Owner</span>}
                onDelete={() => remove(d)} />
            ))}
          </DocSection>

          <DocSection title="Shared with me" empty="Nothing has been shared with you yet.">
            {docs.shared.map((d) => (
              <DocRow key={d.id} doc={d} onOpen={open}
                meta={`From ${d.ownerName}`}
                badge={<span className={`badge ${d.role}`}>{d.role === 'editor' ? 'Can edit' : 'View only'}</span>} />
            ))}
          </DocSection>
        </>
      )}
    </main>
  );
}

function DocSection({ title, empty, children }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="doc-section">
      <h2>{title}</h2>
      {hasItems ? <ul className="doc-list">{children}</ul> : <p className="muted empty">{empty}</p>}
    </section>
  );
}

function DocRow({ doc, meta, badge, onOpen, onDelete }) {
  return (
    <li className="doc-row">
      <button className="doc-row-main" onClick={() => onOpen(doc.id)}>
        <span className="doc-icon" aria-hidden>▤</span>
        <span className="doc-title">{doc.title}</span>
        {badge}
        <span className="muted small doc-meta">{meta}</span>
        <span className="muted small doc-time">{timeAgo(doc.updatedAt)}</span>
      </button>
      {onDelete && (
        <button className="icon-btn danger" title="Delete document" aria-label={`Delete ${doc.title}`} onClick={onDelete}>
          ✕
        </button>
      )}
    </li>
  );
}

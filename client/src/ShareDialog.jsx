import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function ShareDialog({ doc, onClose }) {
  const isOwner = doc.access === 'owner';
  const [shares, setShares] = useState([]);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listShares(doc.id).then((r) => setShares(r.shares)).catch((e) => setError(e.message));
    if (isOwner) api.listUsers().then((r) => setUsers(r.users)).catch(() => {});
  }, [doc.id, isOwner]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      const { shares } = await action();
      setShares(shares);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (await run(() => api.share(doc.id, email, role))) setEmail('');
  }

  const suggestions = users.filter((u) => !shares.some((s) => s.id === u.id));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">{isOwner ? `Share “${doc.title}”` : 'People with access'}</h2>

        {isOwner && (
          <form className="share-form" onSubmit={submit}>
            <input type="email" placeholder="Add people by email" value={email} list="share-users"
              onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <datalist id="share-users">
              {suggestions.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
            </datalist>
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Permission">
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <button className="btn primary" disabled={busy}>Share</button>
          </form>
        )}
        {isOwner && suggestions.length > 0 && (
          <p className="muted small">Demo users: {suggestions.map((u) => u.email).join(', ')}</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <ul className="people">
          <li>
            <span className="avatar">{doc.owner.name[0]}</span>
            <span className="person"><strong>{doc.owner.name}</strong><span className="muted small">{doc.owner.email}</span></span>
            <span className="muted small">Owner</span>
          </li>
          {shares.map((s) => (
            <li key={s.id}>
              <span className="avatar">{s.name[0]}</span>
              <span className="person"><strong>{s.name}</strong><span className="muted small">{s.email}</span></span>
              {isOwner ? (
                <>
                  <select value={s.role} disabled={busy} aria-label={`Permission for ${s.name}`}
                    onChange={(e) => run(() => api.share(doc.id, s.email, e.target.value))}>
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button className="icon-btn danger" disabled={busy} title="Remove access" aria-label={`Remove ${s.name}`}
                    onClick={() => run(() => api.unshare(doc.id, s.id))}>✕</button>
                </>
              ) : (
                <span className="muted small">{s.role === 'editor' ? 'Can edit' : 'Can view'}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

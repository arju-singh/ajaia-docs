import { useState } from 'react';
import { api } from './api.js';

const DEMO_ACCOUNTS = [
  { email: 'alice@ajaia.test', name: 'Alice Johnson', note: 'owns a doc shared with Bob' },
  { email: 'bob@ajaia.test', name: 'Bob Martinez', note: 'has a shared doc' },
  { email: 'carol@ajaia.test', name: 'Carol Chen', note: 'starts empty' },
];
const DEMO_PASSWORD = 'demo1234';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e, p) {
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(e, p));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1><span className="logo" aria-hidden>▤</span> Ajaia Docs</h1>
        <p className="muted">Sign in to write and share documents.</p>

        <form onSubmit={(ev) => { ev.preventDefault(); signIn(email, password); }}>
          <label>
            Email
            <input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} required autoFocus />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <div className="demo-accounts">
          <p className="muted small">Demo accounts (password <code>{DEMO_PASSWORD}</code>):</p>
          {DEMO_ACCOUNTS.map((acc) => (
            <button key={acc.email} className="demo-account" disabled={busy} onClick={() => signIn(acc.email, DEMO_PASSWORD)}>
              <span className="avatar">{acc.name[0]}</span>
              <span>
                <strong>{acc.name}</strong>
                <span className="muted small"> · {acc.email} · {acc.note}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Login from './Login.jsx';
import DocumentList from './DocumentList.jsx';
import DocumentEditor from './DocumentEditor.jsx';

function parseRoute() {
  const match = window.location.hash.match(/^#\/d\/(\d+)/);
  return match ? { page: 'doc', id: Number(match[1]) } : { page: 'list' };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = ({ token, user }) => {
    setToken(token);
    setUser(user);
  };

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    setToken(null);
    setUser(null);
    window.location.hash = '';
  };

  if (checking) return <div className="center muted">Loading…</div>;
  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="logo" aria-hidden>▤</span> Ajaia Docs
        </a>
        <div className="topbar-user">
          <span className="avatar" title={user.email}>{user.name[0]}</span>
          <span className="hide-sm">{user.name}</span>
          <button className="btn-link" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {route.page === 'doc'
        ? <DocumentEditor key={route.id} id={route.id} user={user} />
        : <DocumentList user={user} />}
    </div>
  );
}

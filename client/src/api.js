const TOKEN_KEY = 'ajaia.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/me'),

  listDocuments: () => request('GET', '/api/documents'),
  getDocument: (id) => request('GET', `/api/documents/${id}`),
  createDocument: (title) => request('POST', '/api/documents', { title }),
  updateDocument: (id, changes) => request('PATCH', `/api/documents/${id}`, changes),
  deleteDocument: (id) => request('DELETE', `/api/documents/${id}`),
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/api/documents/import', form);
  },

  listShares: (id) => request('GET', `/api/documents/${id}/shares`),
  share: (id, email, role) => request('POST', `/api/documents/${id}/shares`, { email, role }),
  unshare: (id, userId) => request('DELETE', `/api/documents/${id}/shares/${userId}`),
  listUsers: () => request('GET', '/api/users'),
};

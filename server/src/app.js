import express from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { verifyPassword } from './db.js';
import { cleanHtml, fileToHtml, pickTitle, MAX_CONTENT_BYTES, SUPPORTED_EXTENSIONS } from './html.js';
import { HttpError, badRequest, forbidden, notFound } from './errors.js';

const MAX_TITLE = 200;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function createApp(db, { clientDir } = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) cb(null, true);
      else cb(badRequest(`Unsupported file type "${ext || 'none'}". Use ${SUPPORTED_EXTENSIONS.join(', ')}.`));
    },
  });

  // ---- helpers -------------------------------------------------------------

  const findUserByToken = db.prepare(
    'SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  );

  function requireAuth(req, _res, next) {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = token && findUserByToken.get(token);
    if (!user) return next(new HttpError(401, 'Please sign in'));
    req.user = user;
    next();
  }

  const findDocForUser = db.prepare(`
    SELECT d.*, u.name AS owner_name, u.email AS owner_email,
           CASE WHEN d.owner_id = :userId THEN 'owner' ELSE s.role END AS access
    FROM documents d
    JOIN users u ON u.id = d.owner_id
    LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = :userId
    WHERE d.id = :docId AND (d.owner_id = :userId OR s.user_id IS NOT NULL)
  `);

  // Returns the doc plus the caller's access level. A document the caller
  // can't see is reported as 404 rather than 403 so ids can't be probed.
  function loadDoc(req, minimum = 'viewer') {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId <= 0) throw badRequest('Invalid document id');

    const doc = findDocForUser.get({ docId, userId: req.user.id });
    if (!doc) throw notFound('Document not found');

    const rank = { viewer: 1, editor: 2, owner: 3 };
    if (rank[doc.access] < rank[minimum]) {
      throw forbidden(minimum === 'owner' ? 'Only the owner can do that' : 'You have view-only access');
    }
    return doc;
  }

  function validateTitle(title) {
    if (typeof title !== 'string') throw badRequest('Title must be a string');
    const trimmed = title.trim();
    if (!trimmed) throw badRequest('Title cannot be empty');
    if (trimmed.length > MAX_TITLE) throw badRequest(`Title must be ${MAX_TITLE} characters or fewer`);
    return trimmed;
  }

  function validateContent(content) {
    if (typeof content !== 'string') throw badRequest('Content must be a string');
    if (Buffer.byteLength(content) > MAX_CONTENT_BYTES) throw badRequest('Document is too large (1 MB limit)');
    return cleanHtml(content);
  }

  const serializeDoc = (doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    access: doc.access,
    owner: { id: doc.owner_id, name: doc.owner_name, email: doc.owner_email },
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  });

  const insertDoc = db.prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)');

  function createDoc(userId, title, content) {
    const id = insertDoc.run(userId, title, content).lastInsertRowid;
    return serializeDoc(findDocForUser.get({ docId: id, userId }));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // ---- auth ----------------------------------------------------------------

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw badRequest('Email and password are required');
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    const token = randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = req.get('authorization').replace(/^Bearer\s+/i, '');
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.status(204).end();
  });

  app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

  app.get('/api/users', requireAuth, (req, res) => {
    const users = db.prepare('SELECT id, email, name FROM users WHERE id != ? ORDER BY name').all(req.user.id);
    res.json({ users });
  });

  // ---- documents -----------------------------------------------------------

  app.get('/api/documents', requireAuth, (req, res) => {
    const owned = db
      .prepare(`SELECT d.id, d.title, d.updated_at,
                  (SELECT COUNT(*) FROM document_shares s WHERE s.document_id = d.id) AS share_count
                FROM documents d WHERE d.owner_id = ? ORDER BY d.updated_at DESC`)
      .all(req.user.id);

    const shared = db
      .prepare(`SELECT d.id, d.title, d.updated_at, s.role, u.name AS owner_name
                FROM document_shares s
                JOIN documents d ON d.id = s.document_id
                JOIN users u ON u.id = d.owner_id
                WHERE s.user_id = ? ORDER BY d.updated_at DESC`)
      .all(req.user.id);

    res.json({
      owned: owned.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updated_at, shareCount: d.share_count })),
      shared: shared.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updated_at, role: d.role, ownerName: d.owner_name })),
    });
  });

  app.post('/api/documents', requireAuth, (req, res) => {
    const title = validateTitle(req.body?.title ?? 'Untitled document');
    const content = validateContent(req.body?.content ?? '');
    res.status(201).json({ document: createDoc(req.user.id, title, content) });
  });

  app.post('/api/documents/import', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) throw badRequest('Choose a file to import');
    if (req.file.size === 0) throw badRequest('That file is empty');

    let html;
    try {
      html = await fileToHtml(req.file.originalname, req.file.buffer);
    } catch (err) {
      throw badRequest(err.message.startsWith('Unsupported') ? err.message : 'Could not read that file. Is it a valid document?');
    }
    if (Buffer.byteLength(html) > MAX_CONTENT_BYTES) throw badRequest('Imported document is too large (1 MB limit)');

    const title = pickTitle(html, req.file.originalname);
    res.status(201).json({ document: createDoc(req.user.id, title, html) });
  });

  app.get('/api/documents/:id', requireAuth, (req, res) => {
    res.json({ document: serializeDoc(loadDoc(req)) });
  });

  app.patch('/api/documents/:id', requireAuth, (req, res) => {
    const doc = loadDoc(req, 'editor');
    const { title, content } = req.body ?? {};
    if (title === undefined && content === undefined) throw badRequest('Nothing to update');

    const next = {
      title: title === undefined ? doc.title : validateTitle(title),
      content: content === undefined ? doc.content : validateContent(content),
    };
    db.prepare("UPDATE documents SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?")
      .run(next.title, next.content, doc.id);

    res.json({ document: serializeDoc(findDocForUser.get({ docId: doc.id, userId: req.user.id })) });
  });

  app.delete('/api/documents/:id', requireAuth, (req, res) => {
    const doc = loadDoc(req, 'owner');
    db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
    res.status(204).end();
  });

  // ---- sharing -------------------------------------------------------------

  const listShares = db.prepare(`
    SELECT u.id, u.email, u.name, s.role FROM document_shares s
    JOIN users u ON u.id = s.user_id WHERE s.document_id = ? ORDER BY u.name
  `);

  app.get('/api/documents/:id/shares', requireAuth, (req, res) => {
    const doc = loadDoc(req);
    res.json({ shares: listShares.all(doc.id) });
  });

  app.post('/api/documents/:id/shares', requireAuth, (req, res) => {
    const doc = loadDoc(req, 'owner');
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const role = req.body?.role ?? 'editor';

    if (!email) throw badRequest('Enter an email address to share with');
    if (!['viewer', 'editor'].includes(role)) throw badRequest('Role must be "viewer" or "editor"');

    const target = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!target) throw notFound(`No user with email ${email}`);
    if (target.id === req.user.id) throw badRequest('You already own this document');

    db.prepare(`INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)
                ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`)
      .run(doc.id, target.id, role);

    res.status(201).json({ shares: listShares.all(doc.id) });
  });

  app.delete('/api/documents/:id/shares/:userId', requireAuth, (req, res) => {
    const doc = loadDoc(req, 'owner');
    db.prepare('DELETE FROM document_shares WHERE document_id = ? AND user_id = ?').run(doc.id, Number(req.params.userId));
    res.json({ shares: listShares.all(doc.id) });
  });

  app.use('/api', (_req, _res, next) => next(notFound('Unknown API route')));

  // ---- static client -------------------------------------------------------

  if (clientDir && fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }

  // ---- errors --------------------------------------------------------------

  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (5 MB limit)' : err.message;
      return res.status(400).json({ error: message });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });

    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side' : err.message });
  });

  return app;
}

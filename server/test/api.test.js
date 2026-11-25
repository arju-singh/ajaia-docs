import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { openDatabase, DEMO_PASSWORD } from '../src/db.js';
import { createApp } from '../src/app.js';

let app;

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  assert.equal(res.status, 200);
  return { Authorization: `Bearer ${res.body.token}` };
}

beforeEach(() => {
  app = createApp(openDatabase(':memory:'));
});

describe('auth', () => {
  test('rejects a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@ajaia.test', password: 'nope' });
    assert.equal(res.status, 401);
  });

  test('document routes require a session', async () => {
    const res = await request(app).get('/api/documents');
    assert.equal(res.status, 401);
  });
});

describe('documents', () => {
  test('create, rename, edit and reopen keeps formatting', async () => {
    const alice = await login('alice@ajaia.test');

    const created = await request(app).post('/api/documents').set(alice).send({ title: 'Draft' });
    assert.equal(created.status, 201);
    const id = created.body.document.id;

    const html = '<h2>Heading</h2><p><strong>bold</strong> <em>italic</em> <u>under</u></p><ol><li><p>one</p></li></ol>';
    const saved = await request(app).patch(`/api/documents/${id}`).set(alice).send({ title: 'Final', content: html });
    assert.equal(saved.status, 200);

    const reopened = await request(app).get(`/api/documents/${id}`).set(alice);
    assert.equal(reopened.body.document.title, 'Final');
    assert.equal(reopened.body.document.content, html);
  });

  test('strips scripts and event handlers from saved content', async () => {
    const alice = await login('alice@ajaia.test');
    const { body } = await request(app).post('/api/documents').set(alice)
      .send({ title: 'x', content: '<p onclick="steal()">hi</p><script>alert(1)</script>' });
    assert.equal(body.document.content, '<p>hi</p>');
  });

  test('validates titles', async () => {
    const alice = await login('alice@ajaia.test');
    const empty = await request(app).post('/api/documents').set(alice).send({ title: '   ' });
    assert.equal(empty.status, 400);
    const long = await request(app).post('/api/documents').set(alice).send({ title: 'a'.repeat(201) });
    assert.equal(long.status, 400);
  });
});

describe('sharing', () => {
  test('other users cannot see a document until it is shared', async () => {
    const alice = await login('alice@ajaia.test');
    const carol = await login('carol@ajaia.test');
    const { body } = await request(app).post('/api/documents').set(alice).send({ title: 'Private' });
    const id = body.document.id;

    assert.equal((await request(app).get(`/api/documents/${id}`).set(carol)).status, 404);

    const share = await request(app).post(`/api/documents/${id}/shares`).set(alice)
      .send({ email: 'carol@ajaia.test', role: 'viewer' });
    assert.equal(share.status, 201);

    const opened = await request(app).get(`/api/documents/${id}`).set(carol);
    assert.equal(opened.status, 200);
    assert.equal(opened.body.document.access, 'viewer');

    const list = await request(app).get('/api/documents').set(carol);
    assert.ok(list.body.shared.some((d) => d.id === id));
    assert.ok(!list.body.owned.some((d) => d.id === id));
  });

  test('viewers cannot edit, editors can, and only the owner can share or delete', async () => {
    const alice = await login('alice@ajaia.test');
    const bob = await login('bob@ajaia.test');
    const carol = await login('carol@ajaia.test');
    const { body } = await request(app).post('/api/documents').set(alice).send({ title: 'Roles' });
    const id = body.document.id;

    await request(app).post(`/api/documents/${id}/shares`).set(alice).send({ email: 'bob@ajaia.test', role: 'editor' });
    await request(app).post(`/api/documents/${id}/shares`).set(alice).send({ email: 'carol@ajaia.test', role: 'viewer' });

    assert.equal((await request(app).patch(`/api/documents/${id}`).set(carol).send({ content: '<p>x</p>' })).status, 403);
    assert.equal((await request(app).patch(`/api/documents/${id}`).set(bob).send({ content: '<p>bob</p>' })).status, 200);
    assert.equal((await request(app).post(`/api/documents/${id}/shares`).set(bob).send({ email: 'carol@ajaia.test' })).status, 403);
    assert.equal((await request(app).delete(`/api/documents/${id}`).set(bob)).status, 403);

    // Revoking access hides it again.
    const bobId = (await request(app).get('/api/me').set(bob)).body.user.id;
    await request(app).delete(`/api/documents/${id}/shares/${bobId}`).set(alice);
    assert.equal((await request(app).get(`/api/documents/${id}`).set(bob)).status, 404);
  });

  test('sharing with an unknown email gives a clear error', async () => {
    const alice = await login('alice@ajaia.test');
    const { body } = await request(app).post('/api/documents').set(alice).send({ title: 'x' });
    const res = await request(app).post(`/api/documents/${body.document.id}/shares`).set(alice).send({ email: 'ghost@nowhere.test' });
    assert.equal(res.status, 404);
    assert.match(res.body.error, /No user/);
  });
});

describe('file import', () => {
  test('markdown becomes a formatted document titled from its first heading', async () => {
    const alice = await login('alice@ajaia.test');
    const res = await request(app).post('/api/documents/import').set(alice)
      .attach('file', Buffer.from('# Release notes\n\n- **fast** saves\n- lists'), 'release_notes.md');
    assert.equal(res.status, 201);
    assert.equal(res.body.document.title, 'Release notes');
    assert.match(res.body.document.content, /<h1>Release notes<\/h1>/);
    assert.match(res.body.document.content, /<strong>fast<\/strong>/);
  });

  test('plain text keeps paragraphs and escapes markup', async () => {
    const alice = await login('alice@ajaia.test');
    const res = await request(app).post('/api/documents/import').set(alice)
      .attach('file', Buffer.from('Hello <b>world</b>\n\nSecond para'), 'notes.txt');
    assert.equal(res.body.document.content, '<p>Hello &lt;b&gt;world&lt;/b&gt;</p><p>Second para</p>');
    assert.equal(res.body.document.title, 'notes');
  });

  test('rejects unsupported file types', async () => {
    const alice = await login('alice@ajaia.test');
    const res = await request(app).post('/api/documents/import').set(alice)
      .attach('file', Buffer.from('%PDF'), 'scan.pdf');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unsupported/);
  });
});

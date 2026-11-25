import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE || path.join(here, '..', 'data', 'docs.db');
const clientDir = path.join(here, '..', '..', 'client', 'dist');
const port = Number(process.env.PORT) || 3001;

const db = openDatabase(dbFile);
const app = createApp(db, { clientDir });

app.listen(port, () => {
  console.log(`Ajaia Docs listening on http://localhost:${port}`);
});

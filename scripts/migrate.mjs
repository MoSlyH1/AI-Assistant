import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Add it to .env.local or your shell before running migrate.');
  process.exit(1);
}
const needsSsl = /neon\.tech|render\.com|supabase|sslmode=require/.test(url);
const client = new pg.Client({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : false });

const sql = readFileSync(join(here, '..', 'db', 'schema.sql'), 'utf8');
await client.connect();
await client.query(sql);
await client.end();
console.log('Schema is up to date.');

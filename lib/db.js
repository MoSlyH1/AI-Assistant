import pg from 'pg';

const rawConn = String(process.env.DATABASE_URL || '').trim();

function splitConn(url) {
  if (!url) return { conn: '', ssl: false };
  const hadSslMode = /[?&]sslmode=/i.test(url);
  const managed = /neon\.tech|render\.com|supabase|amazonaws\.com|azure\.com/i.test(url);
  const conn = url
    .replace(/([?&])sslmode=[^&]*&?/gi, '$1')
    .replace(/([?&])channel_binding=[^&]*&?/gi, '$1')
    .replace(/[?&]$/, '');
  return { conn, ssl: hadSslMode || managed ? { rejectUnauthorized: false } : false };
}

const { conn, ssl } = splitConn(rawConn);

const globalForPg = globalThis;

function makePool() {
  if (!conn) throw new Error('DATABASE_URL is not set.');
  return new pg.Pool({
    connectionString: conn,
    ssl,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export const pool = globalForPg.__nimbusPool || (globalForPg.__nimbusPool = makePool());

export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

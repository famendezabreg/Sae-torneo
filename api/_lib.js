const crypto = require('crypto');

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Run one Redis command through the Upstash REST API, e.g. redis('HGET', 'key', 'field')
async function redis(...cmd) {
  if (!DB_URL || !DB_TOKEN) throw new Error('Database is not connected yet (see README step 4).');
  const r = await fetch(DB_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + DB_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const slotKey = (m) => (m % 2 === 0 ? 'a' : 'b');

function advance(rounds, r, m, name) {
  rounds[r][m].w = name;
  if (r < rounds.length - 1) rounds[r + 1][m >> 1][slotKey(m)] = name;
}

function clear(rounds, r, m) {
  const x = rounds[r][m];
  const old = x.w;
  if (!old) return;
  x.w = null;
  if (r < rounds.length - 1) {
    const n = rounds[r + 1][m >> 1];
    if (n.w === old) clear(rounds, r + 1, m >> 1);
    n[slotKey(m)] = null;
  }
}

function buildBracket(players) {
  const p = shuffle([...players]);
  const matches = Array.from({ length: 16 }, (_, i) => ({ a: p[i * 2], b: p[i * 2 + 1], w: null }));
  shuffle(matches);
  const rounds = [matches];
  for (let r = 1; r < 5; r++) {
    rounds.push(Array.from({ length: 32 >> (r + 1) }, () => ({ a: null, b: null, w: null })));
  }
  return { rounds, drawnAt: Date.now() };
}

module.exports = { redis, shuffle, advance, clear, buildBracket };

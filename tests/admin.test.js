const test = require('node:test');
const assert = require('node:assert/strict');

let hashes;
let strings;
const originalFetch = global.fetch;
const originalPassword = process.env.ADMIN_PASSWORD;
const originalRedisUrl = process.env.KV_REST_API_URL;
const originalRedisToken = process.env.KV_REST_API_TOKEN;
process.env.KV_REST_API_URL = 'https://redis.test.invalid';
process.env.KV_REST_API_TOKEN = 'test-only-token';
const admin = require('../api/admin');
const state = require('../api/state');

function flat(hash) {
  return [...hash.entries()].flat();
}

global.fetch = async (_url, options) => {
  const [command, ...args] = JSON.parse(options.body);
  let result;
  switch (command) {
    case 'HKEYS': result = [...(hashes.get(args[0]) || new Map()).keys()]; break;
    case 'HGETALL': result = flat(hashes.get(args[0]) || new Map()); break;
    case 'GET': result = strings.get(args[0]) ?? null; break;
    case 'SET': {
      const [key, value, ...flags] = args;
      if (flags.includes('NX') && strings.has(key)) result = null;
      else { strings.set(key, value); result = 'OK'; }
      break;
    }
    case 'EVAL': {
      const [, , key, field, value, limit] = args;
      const hash = hashes.get(key) || new Map();
      hashes.set(key, hash);
      if (hash.size >= Number(limit)) result = -1;
      else if (hash.has(field)) result = 0;
      else { hash.set(field, value); result = 1; }
      break;
    }
    case 'HSET': {
      const [key, ...pairs] = args;
      const hash = hashes.get(key) || new Map();
      hashes.set(key, hash);
      result = 0;
      for (let i = 0; i < pairs.length; i += 2) {
        if (!hash.has(pairs[i])) result++;
        hash.set(pairs[i], pairs[i + 1]);
      }
      break;
    }
    case 'HSETNX': {
      const [key, field, value] = args;
      const hash = hashes.get(key) || new Map();
      hashes.set(key, hash);
      if (hash.has(field)) result = 0;
      else { hash.set(field, value); result = 1; }
      break;
    }
    case 'HDEL': {
      const [key, field] = args;
      result = Number(hashes.get(key)?.delete(field) || false);
      break;
    }
    case 'DEL': {
      result = 0;
      for (const key of args) {
        result += Number(hashes.delete(key));
        result += Number(strings.delete(key));
      }
      break;
    }
    case 'EXISTS': result = Number(hashes.has(args[0]) || strings.has(args[0])); break;
    case 'HEXISTS': result = Number(hashes.get(args[0])?.has(args[1]) || false); break;
    case 'HGET': result = hashes.get(args[0])?.get(args[1]) ?? null; break;
    default: throw new Error(`Redis command not implemented in test: ${command}`);
  }
  return { json: async () => ({ result }) };
};

test.beforeEach(() => {
  hashes = new Map();
  strings = new Map();
  process.env.ADMIN_PASSWORD = 'test-only-admin-password';
  process.env.KV_REST_API_URL = 'https://redis.test.invalid';
  process.env.KV_REST_API_TOKEN = 'test-only-token';
});

test.after(() => {
  global.fetch = originalFetch;
  if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = originalPassword;
  if (originalRedisUrl === undefined) delete process.env.KV_REST_API_URL;
  else process.env.KV_REST_API_URL = originalRedisUrl;
  if (originalRedisToken === undefined) delete process.env.KV_REST_API_TOKEN;
  else process.env.KV_REST_API_TOKEN = originalRedisToken;
});

async function call(body, method = 'POST') {
  let status = 200;
  let payload;
  const res = {
    setHeader() {},
    status(code) { status = code; return this; },
    json(value) { payload = value; return this; },
  };
  await admin({ method, body }, res);
  return { status, payload };
}

const auth = { password: 'test-only-admin-password' };
const add = (name, paidConfirmed = true) => call({ ...auth, action: 'add-player', name, paidConfirmed });

test('protege el panel y solo agrega participantes con pago confirmado', async () => {
  assert.equal((await call({ action: 'list' })).status, 401);
  assert.deepEqual((await call({ ...auth, action: 'list' })).payload.players, []);
  assert.equal((await add('Ana', false)).status, 400);

  const saved = await add('  Ana   María  ');
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.payload.players, ['Ana María']);
  assert.match((await add('Ana María')).payload.error, /ya está en la lista/i);

  const publicResponse = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.payload = value; return this; } };
  await state({ method: 'GET' }, publicResponse);
  assert.equal(publicResponse.code, 200);
  assert.equal(publicResponse.payload.playerCount, 1);
  assert.equal(publicResponse.payload.bracket, null);
});

test('no sortea antes de 32 inscritos y forma 16 partidos con los 32 nombres', async () => {
  for (let i = 1; i <= 31; i++) assert.equal((await add(`Jugador ${i}`)).status, 200);
  assert.match((await call({ ...auth, action: 'draw' })).payload.error, /31 participantes/i);
  assert.equal((await add('Jugador 32')).status, 200);
  assert.match((await add('Jugador 33')).payload.error, /32 participantes/i);

  const result = await call({ ...auth, action: 'draw' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload.bracket.rounds.map((round) => round.length), [16, 8, 4, 2, 1]);
  const firstRoundPlayers = result.payload.bracket.rounds[0].flatMap(({ a, b }) => [a, b]);
  assert.equal(firstRoundPlayers.length, 32);
  assert.equal(new Set(firstRoundPlayers).size, 32);
  assert.deepEqual(new Set(firstRoundPlayers), new Set(result.payload.players));
  assert.match((await call({ ...auth, action: 'draw' })).payload.error, /Ya existe un sorteo/i);
});

test('avanza al ganador, permite corregir el resultado y deshacerlo', async () => {
  for (let i = 1; i <= 32; i++) await add(`Jugador ${i}`);
  const drawn = (await call({ ...auth, action: 'draw' })).payload.bracket;
  const [match0, match1] = drawn.rounds[0];
  const originalWinner = match0.a;
  const replacement = match0.b;
  const otherWinner = match1.a;

  assert.equal((await call({ ...auth, action: 'winner', round: 0, match: 0, name: 'Fuera del partido' })).status, 400);
  let current = (await call({ ...auth, action: 'winner', round: 0, match: 0, name: originalWinner })).payload.bracket;
  assert.equal(current.rounds[1][0].a, originalWinner);
  await call({ ...auth, action: 'winner', round: 0, match: 1, name: otherWinner });
  await call({ ...auth, action: 'winner', round: 1, match: 0, name: originalWinner });

  current = (await call({ ...auth, action: 'winner', round: 0, match: 0, name: replacement })).payload.bracket;
  assert.equal(current.rounds[0][0].w, replacement);
  assert.equal(current.rounds[1][0].a, replacement);
  assert.equal(current.rounds[1][0].w, null);
  assert.equal(current.rounds[2][0].a, null);

  current = (await call({ ...auth, action: 'winner', round: 0, match: 0, name: replacement })).payload.bracket;
  assert.equal(current.rounds[0][0].w, null);
  assert.equal(current.rounds[1][0].a, null);
});

test('rehacer el sorteo conserva inscritos y reiniciar limpia el torneo', async () => {
  for (let i = 1; i <= 32; i++) await add(`Jugador ${i}`);
  await call({ ...auth, action: 'draw' });
  let current = await call({ ...auth, action: 'reset-draw' });
  assert.equal(current.payload.bracket, null);
  assert.equal(current.payload.players.length, 32);

  current = await call({ ...auth, action: 'reset-all' });
  assert.equal(current.payload.bracket, null);
  assert.deepEqual(current.payload.players, []);
  assert.equal(current.payload.codes.length, 32);
  assert.equal(new Set(current.payload.codes.map(({ code }) => code)).size, 32);
});

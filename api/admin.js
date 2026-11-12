const crypto = require('crypto');
const { redis, sha, genCodes, buildBracket, advance, clear } = require('./_lib');

const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  try {
    const pass = process.env.ADMIN_PASSWORD;
    if (!pass) return bad(res, 'ADMIN_PASSWORD is not set in Vercel yet (see README step 5).', 500);
    const { password, action, round, match, name, paidConfirmed } = req.body || {};
    if (!password || !same(password, pass)) return bad(res, 'Contraseña incorrecta.', 401);

    const players = await redis('HKEYS', 't:players');
    const raw = await redis('GET', 't:bracket');
    let bracket = raw ? JSON.parse(raw) : null;

    if (action === 'add-player') {
      if (bracket) return bad(res, 'El sorteo ya se realizó. No se pueden agregar participantes.');
      if (paidConfirmed !== true) return bad(res, 'Confirmá que el pago está verificado antes de agregar a esta persona.');
      const player = String(name || '').normalize('NFC').replace(/\s+/g, ' ').trim();
      if (!player) return bad(res, 'Escribí el nombre del participante.');
      if (player.length > 80) return bad(res, 'El nombre no puede superar 80 caracteres.');
      const added = await redis(
        'EVAL',
        "if redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[3]) then return -1 end; return redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2])",
        '1', 't:players', player, JSON.stringify({ t: Date.now(), source: 'admin' }), '32'
      );
      if (added === -1) return bad(res, 'Ya hay 32 participantes en la lista.');
      if (!added) return bad(res, 'Ese participante ya está en la lista.');
    } else if (action === 'draw') {
      if (bracket) return bad(res, 'Ya existe un sorteo. Rehacé el sorteo antes de generar otro.');
      const n = players.length;
      if (n > 32) return bad(res, 'La lista supera los 32 participantes. Revisala antes del sorteo.');
      if (n !== 32) return bad(res, `El sorteo se habilita al completar los 32 cupos. Hay ${n} participantes en la lista.`);
      bracket = buildBracket(players);
      const ok = await redis('SET', 't:bracket', JSON.stringify(bracket), 'NX');
      if (!ok) return bad(res, 'Ya existe un sorteo.');
    } else if (action === 'winner') {
      if (!bracket) return bad(res, 'Todavía no se realizó el sorteo.');
      const m = bracket.rounds[round] && bracket.rounds[round][match];
      if (!m || (name !== m.a && name !== m.b)) return bad(res, 'Esa persona no pertenece a este partido.');
      if (m.w === name) clear(bracket.rounds, round, match); // click the winner again to undo
      else { clear(bracket.rounds, round, match); advance(bracket.rounds, round, match, name); }
      await redis('SET', 't:bracket', JSON.stringify(bracket));
    } else if (action === 'release') {
      if (bracket) return bad(res, 'Rehacé el sorteo antes de quitar participantes.');
      const claims = await redis('HGETALL', 't:claims');
      for (let i = 0; i < claims.length; i += 2) if (claims[i + 1] === name) await redis('HDEL', 't:claims', claims[i]);
      await redis('HDEL', 't:players', name);
    } else if (action === 'reset-draw') {
      await redis('DEL', 't:bracket');
      bracket = null;
    } else if (action === 'reset-all') {
      await redis('DEL', 't:bracket', 't:players', 't:claims', 't:codes');
      const fresh = genCodes(32);
      await redis('HSET', 't:codes', ...fresh.flatMap((c) => [sha(c), c]));
      bracket = null;
    } else if (action !== 'list') {
      return bad(res, 'Acción desconocida.');
    }

    const now = await redis('HKEYS', 't:players');
    const [stored, used] = await Promise.all([redis('HGETALL', 't:codes'), redis('HKEYS', 't:claims')]);
    let codes = null;
    if (stored && stored.length) {
      codes = [];
      for (let i = 0; i < stored.length; i += 2) codes.push({ code: stored[i + 1], used: used.includes(stored[i]) });
      codes.sort((a, b) => a.code.localeCompare(b.code));
    }
    res.status(200).json({ ok: true, players: now.sort(), bracket, codes, usedCount: used.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

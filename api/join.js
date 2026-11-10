const { redis, sha, canon } = require('./_lib');
const { CODE_HASHES, NAMES } = require('./_config');

const bad = (res, msg) => res.status(400).json({ error: msg });

// Until the first "Restart everything", the original 32 codes (hashed in _config.js) are valid.
// After a restart, the codes stored in the database are the only valid ones.
async function codeValid(h) {
  if (await redis('EXISTS', 't:codes')) return (await redis('HEXISTS', 't:codes', h)) === 1;
  return CODE_HASHES.includes(h);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { code, name } = req.body || {};
    const c = canon(code);
    const h = c ? sha(c) : '';
    if (!h || !(await codeValid(h))) return bad(res, 'Ese código no es válido. Revisalo e intentá de nuevo.');
    if (await redis('HGET', 't:claims', h)) return bad(res, 'Ese código ya fue utilizado.');
    if (await redis('GET', 't:bracket')) return bad(res, 'El sorteo ya se realizó y las inscripciones están cerradas.');

    // Step 1: just checking the code, return the names still free
    if (!name) {
      const taken = await redis('HKEYS', 't:players');
      return res.status(200).json({ ok: true, available: NAMES.filter((n) => !taken.includes(n)) });
    }

    // Step 2: claim name + code (HSETNX is atomic, so two people can't grab the same one)
    if (!NAMES.includes(name)) return bad(res, 'Elegí un nombre de la lista.');
    const gotName = await redis('HSETNX', 't:players', name, JSON.stringify({ t: Date.now() }));
    if (!gotName) return bad(res, 'Alguien acaba de elegir ese nombre. Seleccioná otro.');
    const gotCode = await redis('HSETNX', 't:claims', h, name);
    if (!gotCode) {
      await redis('HDEL', 't:players', name);
      return bad(res, 'Ese código ya fue utilizado.');
    }
    res.status(200).json({ ok: true, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

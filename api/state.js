const { redis } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const [players, br] = await Promise.all([redis('HKEYS', 't:players'), redis('GET', 't:bracket')]);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ playerCount: players.length, bracket: br ? JSON.parse(br) : null, max: 32 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

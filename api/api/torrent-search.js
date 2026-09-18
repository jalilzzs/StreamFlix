const piratebay = require('thepiratebay');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const results = await piratebay.search(q, {
      category: 200, // أفلام ومسلسلات
      sortBy: 'seeds'
    });
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Torrent search failed', details: err.message });
  }
};

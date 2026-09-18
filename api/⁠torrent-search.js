const TorrentSearchApi = require('torrent-search-api');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    TorrentSearchApi.enablePublicProviders();
    const results = await TorrentSearchApi.search(query, 'Movies', 10);
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Search failed', details: err.message });
  }
};

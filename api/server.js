const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

function fetchJson(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

const KNOWN_IMDBS = {
  'interstellar': 'tt0816692',
  'inception': 'tt1375666',
  'avatar': 'tt0499549',
  'breaking bad': 'tt0903747'
};

async function getImdbId(query, type) {
  const cleanQuery = query.trim().toLowerCase();
  if (KNOWN_IMDBS[cleanQuery]) return KNOWN_IMDBS[cleanQuery];

  try {
    if (type === 'tv' || type === 'series') {
      const tvData = await fetchJson(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanQuery)}`);
      if (tvData?.externals?.imdb) return tvData.externals.imdb;
    }
  } catch (err) {}
  
  return null;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (parsedUrl.pathname === '/api/get-id') {
    const q = parsedUrl.query.q;
    const type = parsedUrl.query.type || 'movie';

    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'يرجى إرسال q' }));
    }

    const imdbId = await getImdbId(q, type);
    return res.end(JSON.stringify({ success: !!imdbId, imdbId }));
  }

  res.end(JSON.stringify({ message: 'StreamFlix Active' }));
});

server.listen(PORT);

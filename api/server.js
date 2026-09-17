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
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP Status: ${res.statusCode}`));
        }

        try {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        } catch (e) {
          reject(new Error('فشل تفكيك استجابة JSON'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('انتهت مهلة الاتصال'));
    });

    req.end();
  });
}

// دالة جلب IMDb ID عبر كلمة البحث من TMDB API المجاني المفتوح
async function getImdbId(query, type) {
  const searchType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
  const tmdbSearchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=15d2fb0e2275f113e185012e1ffaa923&query=${encodeURIComponent(query)}`;
  
  const searchRes = await fetchJson(tmdbSearchUrl);
  if (!searchRes.results || searchRes.results.length === 0) return null;
  
  const tmdbId = searchRes.results[0].id;
  const externalIdsUrl = `https://api.themoviedb.org/3/${searchType}/${tmdbId}/external_ids?api_key=15d2fb0e2275f113e185012e1ffaa923`;
  const extRes = await fetchJson(externalIdsUrl);
  
  return extRes.imdb_id;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (pathname === '/api/test-pirate') {
    const q = query.q;
    const type = query.type || 'movie';
    const season = query.season || 1;
    const episode = query.episode || 1;

    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'يرجى إرسال كلمة البحث عبر q' }));
    }

    try {
      // 1. تحويل اسم الفيلم/المسلسل إلى IMDb ID
      const imdbId = await getImdbId(q, type);

      if (!imdbId) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: false,
          queryUsed: q,
          message: 'لم يتم العثور على المعرف الخاص بالفيلم/المسلسل',
          results: []
        }));
      }

      // 2. الاستعلام عبر Torrentio API (مكفول 100% وبدون حظر DNS)
      let torrentioUrl = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
      if (type === 'tv' || type === 'series') {
        torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
      }

      const torrentData = await fetchJson(torrentioUrl);

      if (!torrentData.streams || torrentData.streams.length === 0) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: false,
          imdbId: imdbId,
          message: 'لا توجد روابط تورنت متاحة لهذا المحتوى',
          results: []
        }));
      }

      const formattedResults = torrentData.streams.slice(0, 10).map((s) => ({
        name: s.name,
        title: s.title,
        infoHash: s.infoHash,
        magnet: s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}&dn=${encodeURIComponent(q)}` : null,
        fileIdx: s.fileIdx
      }));

      res.writeHead(200);
      return res.end(JSON.stringify({
        success: true,
        queryUsed: q,
        imdbId: imdbId,
        totalFound: formattedResults.length,
        results: formattedResults
      }));

    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  if (pathname === '/') {
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'StreamFlix Torrentio Engine Active' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

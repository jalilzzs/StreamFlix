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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let rawData = '';

      res.on('data', (chunk) => { rawData += chunk; });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`API Error Code: ${res.statusCode}`));
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
    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'يرجى إرسال كلمة البحث عبر q' }));
    }

    try {
      // الاستعلام عبر YTS API الرسمي (سريع ومضمون مع السيرفرات السحابية)
      const ytsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(q.trim())}`;
      const data = await fetchJson(ytsUrl);

      if (!data || !data.data || !data.data.movies || data.data.movies.length === 0) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: false,
          queryUsed: q,
          message: 'لم يتم العثور على نتائج متطابقة',
          results: []
        }));
      }

      const movie = data.data.movies[0];
      const formattedResults = movie.torrents.map((t) => ({
        title: `${movie.title_long} [${t.quality}] [${t.type}]`,
        quality: t.quality,
        size_mb: t.size,
        seeders: t.seeds,
        leechers: t.peers,
        hash: t.hash,
        magnet: `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(movie.title_long)}&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80`
      }));

      res.writeHead(200);
      return res.end(JSON.stringify({
        success: true,
        queryUsed: q,
        movieTitle: movie.title_long,
        rating: movie.rating,
        cover: movie.medium_cover_image,
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
    return res.end(JSON.stringify({ message: 'StreamFlix YTS API Service is active' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

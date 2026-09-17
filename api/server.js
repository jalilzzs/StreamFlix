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

// دالة جلب IMDb ID مضمونة عبر أكثر من مصدر مفتوح
async function getImdbId(query, type) {
  try {
    // المصدر الأول: البحث عبر Cinemeta المحدث للسينما
    const isTv = (type === 'tv' || type === 'series');
    const catalogType = isTv ? 'series' : 'movie';
    const searchUrl = `https://v3-cinemeta.strem.fun/catalog/${catalogType}/top/search=${encodeURIComponent(query)}.json`;
    
    const cinemetaData = await fetchJson(searchUrl);

    if (cinemetaData && cinemetaData.metas && cinemetaData.metas.length > 0) {
      // إرجاع id الفيلم الأول المتطابق (مثلاً tt0816692)
      return cinemetaData.metas[0].id;
    }

    // المصدر الثاني (احتياطي للمسلسلات): TVMaze API
    if (isTv) {
      const tvmazeUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}`;
      const tvData = await fetchJson(tvmazeUrl);
      if (tvData && tvData.externals && tvData.externals.imdb) {
        return tvData.externals.imdb;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // إعدادات CORS
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
      // 1. جلب الـ IMDb ID
      const imdbId = await getImdbId(q.trim(), type);

      if (!imdbId) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: false,
          queryUsed: q,
          message: 'لم يتم العثور على المعرف الخاص بالفيلم/المسلسل',
          results: []
        }));
      }

      // 2. الاستعلام عن روابط التورنت عبر Torrentio
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
          message: 'لا توجد روابط تورنت متاحة لهذا المحتوى حالياً',
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
    return res.end(JSON.stringify({ message: 'StreamFlix Core Engine Active' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

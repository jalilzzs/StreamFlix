const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// دالة جلب البيانات من API تورنت مباشر وسريع لا يفرض حظر 403 (SolidTorrents API)
function fetchTorrentData(query) {
  return new Promise((resolve, reject) => {
    // نستخدم SolidTorrents API لأنه سريع، مفتوح، ويدعم إرجاع JSON مستقر
    const targetUrl = `https://solidtorrents.to/api/v1/search?q=${encodeURIComponent(query)}`;
    const parsed = url.parse(targetUrl);

    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let rawData = '';

      res.on('data', (chunk) => { rawData += chunk; });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`API Status Code: ${res.statusCode}`));
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
      reject(new Error('انتهت مهلة الاتصال للسيرفر'));
    });

    req.end();
  });
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

  // 1. Endpoint للتجربة المباشرة وإرجاع النتيجة
  if (pathname === '/api/test-pirate') {
    const q = query.q;
    const type = query.type || 'movie';
    const season = query.season || 1;
    const episode = query.episode || 1;

    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'يرجى إرسال كلمة البحث عبر q' }));
    }

    let searchQuery = q.trim();
    if (type === 'tv' || type === 'series') {
      const s = String(season).padStart(2, '0');
      const e = String(episode).padStart(2, '0');
      searchQuery += ` S${s}E${e}`;
    }

    try {
      const data = await fetchTorrentData(searchQuery);

      if (!data || !data.results || data.results.length === 0) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: false,
          queryUsed: searchQuery,
          message: 'لم يتم العثور على أي نتائج متطابقة',
          results: []
        }));
      }

      const formattedResults = data.results.slice(0, 10).map((item) => ({
        title: item.title,
        size_mb: (item.size / (1024 * 1024)).toFixed(2) + ' MB',
        seeders: item.swarm.seeders,
        leechers: item.swarm.leechers,
        magnet: item.magnet,
        info_hash: item.infohash
      }));

      res.writeHead(200);
      return res.end(JSON.stringify({
        success: true,
        queryUsed: searchQuery,
        totalFound: data.results.length,
        results: formattedResults
      }));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // الصفحة الرئيسية
  if (pathname === '/') {
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'StreamFlix Torrent API is active' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

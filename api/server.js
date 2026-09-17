const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// دالة مساعدة لعمل طلبات HTTPS وإرجاع Promise
function fetchJson(apiUrl) {
  return new Promise((resolve, reject) => {
    https.get(apiUrl, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve(parsed);
        } catch (e) {
          reject(new Error('خطأ في تحليلات JSON من المصدر'));
        }
      });
    }).on('error', (err) => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // إعدادات CORS للسماح للواجهة بالاتصال
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 1. Endpoint للتجربة المباشرة وإرجاع JSON في المتصفح
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
      const apiUrl = `https://apibay.org/q.php?q=${encodeURIComponent(searchQuery)}`;
      const data = await fetchJson(apiUrl);

      if (!data || data.length === 0 || data[0].id === '0') {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: false,
          queryUsed: searchQuery,
          message: 'لا يوجد محتوى متطابق في Pirate Bay',
          results: []
        }));
      }

      res.writeHead(200);
      return res.end(JSON.stringify({
        success: true,
        queryUsed: searchQuery,
        totalFound: data.length,
        results: data.slice(0, 10).map((item) => ({
          id: item.id,
          name: item.name,
          info_hash: item.info_hash,
          size_mb: (Number(item.size) / (1024 * 1024)).toFixed(2) + ' MB',
          seeders: Number(item.seeders),
          leechers: Number(item.leechers),
          magnet: `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`
        }))
      }));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 2. Endpoint الرئيسي للباك إند الخاص بك
  if (pathname === '/api/piratebay') {
    const q = query.q;
    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing query parameter q' }));
    }

    try {
      const apiUrl = `https://apibay.org/q.php?q=${encodeURIComponent(q)}`;
      const data = await fetchJson(apiUrl);

      res.writeHead(200);
      return res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // الصفحة الرئيسية للتحقق من أن السيرفر يعمل
  if (pathname === '/') {
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'StreamFlix API is running...' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`Server executing on port ${PORT}`);
});

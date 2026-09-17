const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// دالة جلب البيانات مع استخدام البروكسي المجاني لمنع حظر 403
function fetchJsonViaProxy(targetUrl) {
  return new Promise((resolve, reject) => {
    // نمرر الطلب عبر بروكسي عام لتفادي حظر Render IP
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const parsed = url.parse(proxyUrl);

    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let rawData = '';

      res.on('data', (chunk) => { rawData += chunk; });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Proxy HTTP Status ${res.statusCode}`));
        }

        try {
          const parsedData = JSON.parse(rawData);
          resolve(parsedData);
        } catch (e) {
          reject(new Error('فشل تفكيك الـ JSON المستلم عبر البروكسي'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('انتهت مهلة الاتصال (Timeout)'));
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
      const targetApi = `https://apibay.org/q.php?q=${encodeURIComponent(searchQuery)}`;
      const data = await fetchJsonViaProxy(targetApi);

      if (!data || !Array.isArray(data) || data.length === 0 || data[0].id === '0') {
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

  // 2. Endpoint الرئيسي للباك إند
  if (pathname === '/api/piratebay') {
    const q = query.q;
    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing query parameter q' }));
    }

    try {
      const targetApi = `https://apibay.org/q.php?q=${encodeURIComponent(q)}`;
      const data = await fetchJsonViaProxy(targetApi);
      res.writeHead(200);
      return res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // الصفحة الرئيسية
  if (pathname === '/') {
    res.writeHead(200);
    return res.end(JSON.stringify({ message: 'StreamFlix API is running...' }));
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

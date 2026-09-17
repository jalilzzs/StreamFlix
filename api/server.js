const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// دالة جلب البيانات مع إرسال User-Agent لمنع الحظر
function fetchJson(apiUrl) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    };

    https.get(apiUrl, options, (res) => {
      let rawData = '';

      res.on('data', (chunk) => { rawData += chunk; });

      res.on('end', () => {
        // إذا أرجع السيرفر كود غير 200
        if (res.statusCode !== 200) {
          return reject(new Error(`Server responded with status code ${res.statusCode}`));
        }

        try {
          // التحقق مما إذا كانت الاستجابة تبدأ بـ HTML (صفحة حظر)
          if (rawData.trim().startsWith('<')) {
            return reject(new Error('المصدر أرجع صفحة HTML بدلاً من JSON (احتمال حظر أو حماية)'));
          }

          const parsed = JSON.parse(rawData);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`خطأ في تفكيك JSON: ${e.message} - المحتوى المستلم: ${rawData.substring(0, 100)}...`));
        }
      });
    }).on('error', (err) => reject(err));
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
      // تجربة API احتياطي لـ Pirate Bay إذا فشل الأول
      const primaryUrl = `https://apibay.org/q.php?q=${encodeURIComponent(searchQuery)}`;
      let data;
      
      try {
        data = await fetchJson(primaryUrl);
      } catch (primaryErr) {
        // استخدام API بديل في حال حظر apibay.org
        const backupUrl = `https://piratebay-api.vytal.io/search?q=${encodeURIComponent(searchQuery)}`;
        data = await fetchJson(backupUrl);
      }

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
          id: item.id || item.id,
          name: item.name || item.title,
          info_hash: item.info_hash || item.hash,
          size_mb: item.size ? (Number(item.size) / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A',
          seeders: Number(item.seeders || 0),
          leechers: Number(item.leechers || 0),
          magnet: item.magnet || `magnet:?xt=urn:btih:${item.info_hash || item.hash}&dn=${encodeURIComponent(item.name || item.title)}`
        }))
      }));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // 2. Endpoint الرئيسي للواجهة
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

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// استدعاء متغير FlareSolverr المربوط لديك في البيئة (أو الرابط الافتراضي)
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'https://flaresolverr-latest.onrender.com/v1';

// دالة جلب البيانات مع إمكانية التمرير عبر FlareSolverr لتجاوز الحظر 403
function fetchJson(targetUrl, useFlareSolverr = false) {
  return new Promise((resolve, reject) => {
    if (useFlareSolverr) {
      // تحويل الطلب عبر FlareSolverr
      const postData = JSON.stringify({
        cmd: 'request.get',
        url: targetUrl,
        maxTimeout: 60000
      });

      const parsedFlare = url.parse(FLARESOLVERR_URL);
      const isHttps = parsedFlare.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedFlare.hostname,
        port: parsedFlare.port || (isHttps ? 443 : 80),
        path: parsedFlare.path || '/v1',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 65000
      };

      const req = client.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);
            if (parsedData.status === 'ok' && parsedData.solution) {
              let responseText = parsedData.solution.response;

              // تنظيف الاستجابة واستخراج JSON في حال كانت محاطة بـ HTML
              if (responseText.includes('<pre>')) {
                responseText = responseText.split('<pre>')[1].split('</pre>')[0];
              } else if (responseText.includes('<body>')) {
                responseText = responseText.replace(/<[^>]*>?/gm, '');
              }

              resolve(JSON.parse(responseText.trim()));
            } else {
              reject(new Error(parsedData.message || 'فشل FlareSolverr في تجاوز الحماية'));
            }
          } catch (e) {
            reject(new Error('فشل تفكيك استجابة JSON عبر FlareSolverr'));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('انتهت مهلة استجابة FlareSolverr'));
      });

      req.write(postData);
      req.end();

    } else {
      // الاتصال المادي العادي
      const parsed = url.parse(targetUrl);
      const options = {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
    }
  });
}

// جدول تحويل يدوي ومباشر لأشهر الأفلام لمنع أي خطأ خارجي
const KNOWN_IMDBS = {
  'interstellar': 'tt0816692',
  'inception': 'tt1375666',
  'avatar': 'tt0499549',
  'breaking bad': 'tt0903747'
};

async function getImdbId(query, type) {
  const cleanQuery = query.trim().toLowerCase();
  
  // 1. استخدام القائمة المحلية المباشرة إن وجدت
  if (KNOWN_IMDBS[cleanQuery]) {
    return KNOWN_IMDBS[cleanQuery];
  }

  try {
    // 2. استخدام TVMaze للمسلسلات
    if (type === 'tv' || type === 'series') {
      const tvmazeUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanQuery)}`;
      const tvData = await fetchJson(tvmazeUrl, false);
      if (tvData && tvData.externals && tvData.externals.imdb) {
        return tvData.externals.imdb;
      }
    }

    // 3. استخدام Cinemeta عبر FlareSolverr لمنع خطأ 403
    const catalogType = (type === 'tv' || type === 'series') ? 'series' : 'movie';
    const searchUrl = `https://v3-cinemeta.strem.fun/catalog/${catalogType}/top/search=${encodeURIComponent(cleanQuery)}.json`;
    const cinemetaData = await fetchJson(searchUrl, true);

    if (cinemetaData && cinemetaData.metas && cinemetaData.metas.length > 0) {
      return cinemetaData.metas[0].id;
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

      // 1. تجربة جلب البيانات عبر Torrentio أولاً بدون FlareSolverr
      let torrentioUrl = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
      if (type === 'tv' || type === 'series') {
        torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`;
      }

      let torrentData;
      try {
        torrentData = await fetchJson(torrentioUrl, false);
      } catch (err) {
        // في حال حظر الطلب المباشر (403/Timeout)، يتم التمرير مباشرة عبر FlareSolverr
        torrentData = await fetchJson(torrentioUrl, true);
      }

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

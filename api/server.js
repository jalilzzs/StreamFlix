const http = require('http');
const https = require('https');
const url = require('url');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;

// دالة صامتة لفحص رابط المشغل (HTTP Request) والتأكد من توفر الفيديو
function verifyStreamUrl(embedUrl) {
  return new Promise((resolve) => {
    const client = embedUrl.startsWith('https') ? https : http;
    const req = client.get(embedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // قراءة كود الرد والنصوص التالفة مثل "Video Unavailable" أو "404"
        const isUnavailable =
          res.statusCode === 404 ||
          data.includes('Video Unavailable') ||
          data.includes('Not Found') ||
          data.includes('File was deleted');
        
        resolve({ available: !isUnavailable, statusCode: res.statusCode });
      });
    });

    req.on('error', () => resolve({ available: false, statusCode: 500 }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ available: false, statusCode: 408 });
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // إعدادات الـ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 1. EndPoint التورنت الأساسي
  if (parsedUrl.pathname === '/api/torrent-search') {
    const q = parsedUrl.query.q;

    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'يرجى إرسال كلمة البحث q' }));
    }

    const sanitizedQuery = q.replace(/"/g, '\\"');

    exec(`python3 tpb_search.py "${sanitizedQuery}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Python Exec Error:', error);
        res.writeHead(500);
        return res.end(JSON.stringify({ success: false, error: 'حدث خطأ أثناء تشغيل سكربت البحث' }));
      }

      try {
        const data = JSON.parse(stdout);
        return res.end(JSON.stringify(data));
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, stdout);
        res.writeHead(500);
        return res.end(JSON.stringify({ success: false, error: 'فشل معالجة مخرجات البايثون' }));
      }
    });
    return;
  }

  // 2. EndPoint الفحص المسبق (Cron Job Verification)
  if (parsedUrl.pathname === '/api/cron/check-stream') {
    const { tmdbId, type = 'movie', season = 1, episode = 1 } = parsedUrl.query;

    if (!tmdbId) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'TMDB ID مطلوب' }));
    }

    // جلب رابط الفحص بالسيرفر الرئيسي
    const targetUrl = type === 'movie'
      ? `https://vidlink.pro/movie/${tmdbId}`
      : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;

    const checkResult = await verifyStreamUrl(targetUrl);

    // إذا قام المشغل بالرد بـ 404 أو فيديو غير متاح، نرجع قرار التغيير لـ Hidden/Draft
    return res.end(JSON.stringify({
      success: true,
      tmdbId,
      status: checkResult.available ? 'Public' : 'Hidden',
      action: checkResult.available ? 'KEEP' : 'HIDE_FROM_FRONTEND',
      httpCode: checkResult.statusCode
    }));
  }

  // الصفحة الرئيسية للسيرفر
  res.end(JSON.stringify({ message: 'StreamFlix Active' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const http = require('http');
const https = require('https');
const url = require('url');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;

// إعداد الاتصال بـ Supabase عبر متغيرات البيئة
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

// دالة فحص رابط المشغل (HTTP Request)
function verifyStreamUrl(embedUrl) {
  return new Promise((resolve) => {
    const client = embedUrl.startsWith('https') ? https : http;
    const req = client.get(embedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
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

// دالة فحص وتحديث عنوان معين في Supabase
async function processTitleCheck(tmdbId, type = 'movie', season = 1, episode = 1) {
  const targetUrl = type === 'movie'
    ? `https://vidlink.pro/movie/${tmdbId}`
    : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;

  const checkResult = await verifyStreamUrl(targetUrl);

  // إذا كان المشغل مكسوراً وهناك اتصال بـ Supabase، نغير الحالة إلى hidden
  if (!checkResult.available && supabase) {
    await supabase
      .from('titles')
      .update({ status: 'hidden' })
      .eq('tmdb_id', tmdbId);
  }

  return {
    tmdbId,
    available: checkResult.available,
    status: checkResult.available ? 'public' : 'hidden',
    statusCode: checkResult.statusCode
  };
}

// =========================================================
// جدولة الفحص التلقائي (Cron Job) - يعمل يومياً الساعة 3 صباحاً
// =========================================================
cron.schedule('0 3 * * *', async () => {
  console.log('🔄 بدء عملية الفحص التلقائي للأفلام والمسلسلات...');
  if (!supabase) return console.error('❌ Supabase غير متصل. يرجى ضبط المتغيرات.');

  try {
    // جلب العروض النشطة فقط (public)
    const { data: titles, error } = await supabase
      .from('titles')
      .select('id, tmdb_id, type')
      .eq('status', 'public');

    if (error) throw error;

    console.log(`🔍 جاري فحص ${titles.length} عنصر...`);

    for (const item of titles) {
      if (!item.tmdb_id) continue;
      const res = await processTitleCheck(item.tmdb_id, item.type || 'movie');
      if (!res.available) {
        console.log(`⚠️ تم إخفاء العنوان ذو الـ TMDB: ${item.tmdb_id} لأنه غير متاح.`);
      }
      // تأخير بسيط لمنع إجهاد السيرفرات (500 ملي ثانية بين كل فحص)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('✅ اكتمل الفحص التلقائي بنجاح.');
  } catch (err) {
    console.error('❌ خطأ أثناء الفحص التلقائي:', err.message);
  }
});

// =========================================================
// سيرفر Node.js والـ Endpoints
// =========================================================
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 1. EndPoint البحث عن التورنت
  if (parsedUrl.pathname === '/api/torrent-search') {
    const q = parsedUrl.query.q;
    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'يرجى إرسال كلمة البحث q' }));
    }

    const sanitizedQuery = q.replace(/"/g, '\\"');
    exec(`python3 tpb_search.py "${sanitizedQuery}"`, (error, stdout) => {
      if (error) {
        res.writeHead(500);
        return res.end(JSON.stringify({ success: false, error: 'خطأ في سكربت البحث' }));
      }
      try {
        return res.end(JSON.stringify(JSON.parse(stdout)));
      } catch (e) {
        res.writeHead(500);
        return res.end(JSON.stringify({ success: false, error: 'خطأ معالجة النتائج' }));
      }
    });
    return;
  }

  // 2. EndPoint فحص وتحديث عنصر واحد يدويًا
  if (parsedUrl.pathname === '/api/cron/check-stream') {
    const { tmdbId, type = 'movie', season = 1, episode = 1 } = parsedUrl.query;
    if (!tmdbId) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'TMDB ID مطلوب' }));
    }

    const result = await processTitleCheck(tmdbId, type, season, episode);
    return res.end(JSON.stringify({ success: true, data: result }));
  }

  res.end(JSON.stringify({ message: 'StreamFlix Backend Service Active' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

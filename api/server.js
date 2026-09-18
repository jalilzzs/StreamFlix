const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل CORS للسماح بالاتصال من أي فرونت-إند مستقبلاً
app.use(cors());
app.use(express.json());

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
    const req = client.get(embedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
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
    ? `https://vidlink.pro{tmdbId}`
    : `https://vidlink.pro{tmdbId}/${season}/${episode}`;

  const checkResult = await verifyStreamUrl(targetUrl);

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
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('✅ اكتمل الفحص التلقائي بنجاح.');
  } catch (err) {
    console.error('❌ خطأ أثناء الفحص التلقائي:', err.message);
  }
});

// =========================================================
// الـ Endpoints (المسارات)
// =========================================================

// رسالة ترحيبية عند فتح الرابط الرئيسي للموقع
app.get('/', (req, res) => {
  res.json({ message: 'StreamFlix Backend Service Active 🚀' });
});

// 1. مسار البحث عن التورنت (آمن 100% ضد الـ Command Injection)
app.get('/api/torrent-search', (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({ success: false, error: 'يرجى إرسال كلمة البحث q' });
  }

  // استخدام execFile لتمرير الـ query كـ Argument مستقل ومحمّي لنظام التشغيل
  execFile('python3', ['tpb_search.py', q], (error, stdout) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: 'خطأ في سكربت البحث البرمجي لبايثون' });
    }
    try {
      return res.json(JSON.parse(stdout));
    } catch (e) {
      return res.status(500).json({ success: false, error: 'خطأ في معالجة وفك تجميع نتائج الـ JSON' });
    }
  });
});

// 2. مسار فحص وتحديث عنصر واحد يدويًا
app.get('/api/cron/check-stream', async (req, res) => {
  const { tmdbId, type = 'movie', season = 1, episode = 1 } = req.query;
  if (!tmdbId) {
    return res.status(400).json({ success: false, error: 'TMDB ID مطلوب' });
  }

  const result = await processTitleCheck(tmdbId, type, season, episode);
  return res.json({ success: true, data: result });
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 StreamFlix Backend running on port ${PORT}`);
});

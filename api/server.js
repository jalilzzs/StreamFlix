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
const axios = require('axios'); // تأكد من وجوده في أعلى الملف

app.get('/api/torrent-search', async (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({ success: false, error: 'يرجى إرسال كلمة البحث q' });
  }

  // قائمة بأقوى المرايا المفتوحة لـ PirateBay والغير محجوبة على سيرفرات Render العالمية
  const mirrors = [
    `https://tpb.party{encodeURIComponent(q)}/1/99/201,207`,
    `https://thepiratebay10.org{encodeURIComponent(q)}/1/99/201,207`,
    `https://thepiratebay.zone{encodeURIComponent(q)}/1/99/201,207`
  ];

  // محاولة جلب البيانات من الروابط بالترتيب؛ إذا فشل أحدها ينتقل للتالي تلقائياً
  for (const url of mirrors) {
    try {
      const response = await axios.get(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 4000 // مهلة 4 ثوانٍ لكل سيرفر لضمان سرعة الاستجابة
      });

      const html = response.data;
      let torrents = [];

      // تعبير نمطي (Regex) متطور لقراءة وتحليل بيانات التورنت مباشرة من صفحة الـ HTML بدون حظر
      const rowRegex = /<tr>[\s\S]*?<a class="detLink"[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<a href="(magnet:\?xt=urn:btih:[\s\S]*?)"[\s\S]*?<font class="detDesc">[\s\S]*?Size ([\s\S]*?),[\s\S]*?<\/font>[\s\S]*?<td align="right">([\s\S]*?)<\/td>/g;
      
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const title = match[1].replace(/<\/?[^>]+(>|\$)/g, "").trim(); // تنظيف العنوان
        const magnet = match[2];
        const size = match[3].replace(/&nbsp;/g, " ").trim();
        const seeders = parseInt(match[4]) || 0;

        torrents.push({ title, seeders, size, magnet });
      }

      if (torrents.length > 0) {
        // ترتيب التورنت تنازلياً حسب الـ Seeders لإعطاء المشغل أفضل أداء
        torrents.sort((a, b) => b.seeders - a.seeders);
        return res.json({ success: true, results: torrents.slice(0, 10) });
      }
    } catch (err) {
      console.log(`⚠️ فشل الاتصال بالمرآة ${url}، جاري المحاولة مع الرابط البديل...`);
      continue; // الانتقال للموقع البديل في القائمة
    }
  }

  // إذا فشلت كافة المحاولات والمرايا (تنبيه احتياطي)
  return res.status(502).json({ 
    success: false, 
    error: "جميع خوادم التورنت الاحتياطية محجوبة حالياً من طرف جدار حماية الاستضافة" 
  });
});

      // ترتيب النتائج حسب الأعلى Seeders لضمان أفضل تشغيل
      torrents.sort((a, b) => b.seeders - a.seeders);

      return res.json({ success: true, results: torrents.slice(0, 10) });
    } else {
      return res.json({ success: true, results: [], message: "لم يتم العثور على تورنت لهذا الفيلم" });
    }

  } catch (error) {
    console.error("Error fetching torrents:", error.message);
    return res.status(500).json({ success: false, error: "خطأ أثناء جلب البيانات من خادم التورنت المتصل" });
  }
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

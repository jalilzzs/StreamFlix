import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { MOVIES } from '@consumet/extensions';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const flixhq = new MOVIES.FlixHQ();

// إعداد بروكسي حقيقي عبر https-proxy-agent لضمان إجبار مكتبة Consumet وكل طلبات الـ Axios على المرور عبر ScraperAPI وتجاوز Cloudflare نهائياً
if (SCRAPER_API_KEY) {
  const proxyUrl = `http://api_${SCRAPER_API_KEY}:@proxy.scraperapi.com:8001`;
  const agent = new HttpsProxyAgent(proxyUrl);
  
  // فرض البروكسي على جميع طلبات Axios الافتراضية والمنشأة حديثاً
  axios.defaults.httpAgent = agent;
  axios.defaults.httpsAgent = agent;
  axios.defaults.proxy = false; // تعطيل نظام البروكسي التقليدي وتفعيل الـ Agent المباشر
  
  // تفعيل خاصية الـ JavaScript Rendering إجبارياً لتجاوز حماية صفحات الفيديو
  axios.defaults.headers.common['X-ScraperAPI-Render'] = 'true';
  
  // رفع وقت الانتظار العام إلى 90 ثانية ليتناسب مع بطء استجابة الاستضافات المجانية
  axios.defaults.timeout = 90000;
}

app.get('/api/extract', async (req, res) => {
  const tmdbId = req.query.tmdb || req.query.id;
  const type = req.query.type || 'movie';
  const season = req.query.season || 1;
  const episode = req.query.episode || 1;

  if (!tmdbId) {
    return res.status(400).json({ success: false, error: 'رقم tmdb مطلوب' });
  }

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({ success: false, error: 'مفتاح SCRAPER_API_KEY غير معرف في إعدادات البيئة على Render' });
  }

  try {
    // 1. البحث عن العمل عبر مكتبة Consumet مع تمرير الطلب بالكامل عبر بروكسي التجاوز
    const searchResults = await flixhq.search(String(tmdbId));
    
    if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على المحتوى بهذا المعرف' });
    }

    const mediaId = searchResults.results[0].id;
    
    // 2. جلب معلومات الوسائط (الحلقات أو تفاصيل الفيلم)
    const mediaInfo = await flixhq.fetchMediaInfo(mediaId);
    
    if (!mediaInfo || !mediaInfo.episodes || mediaInfo.episodes.length === 0) {
      return res.status(404).json({ success: false, error: 'تعذر جلب تفاصيل الحلقات أو الوسائط' });
    }
    
    let targetEpisodeId = mediaInfo.episodes[0].id;
    
    if (type === 'tv') {
      const targetEp = mediaInfo.episodes.find(ep => ep.season == season && ep.number == episode);
      if (targetEp) {
        targetEpisodeId = targetEp.id;
      }
    }

    // 3. استخراج روابط البث الصافي النهائية
    const sourcesData = await flixhq.fetchEpisodeSources(targetEpisodeId);

    if (!sourcesData || !sourcesData.sources || sourcesData.sources.length === 0) {
      return res.status(404).json({ success: false, error: 'تعذر العثور على روابط البث الصافي للحلقة المطلوبة' });
    }

    return res.json({
      success: true,
      sources: sourcesData.sources,
      subtitles: sourcesData.subtitles || []
    });

  } catch (error) {
    console.error('Extraction Error Details:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'فشل عملية استخراج البث بسبب خطأ في الخادم أو مهلة الانتظار', 
      details: error.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server running smoothly on port ${PORT}`));

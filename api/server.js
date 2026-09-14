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

// التصحيح الجذري لصيغة بروكسي ScraperAPI: اسم المستخدم 'api' وكلمة المرور هي مفتاح الـ API
if (SCRAPER_API_KEY) {
  const proxyUrl = `http://api:${SCRAPER_API_KEY}@proxy.scraperapi.com:8001`;
  const agent = new HttpsProxyAgent(proxyUrl);
  
  axios.defaults.httpAgent = agent;
  axios.defaults.httpsAgent = agent;
  axios.defaults.proxy = false;
  
  // تفعيل محرك المتصفح لتجاوز حماية Cloudflare لكل طلبات مكتبة Consumet
  axios.defaults.headers.common['X-ScraperAPI-Render'] = 'true';
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
    const searchResults = await flixhq.search(String(tmdbId));
    
    if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على المحتوى بهذا المعرف' });
    }

    const mediaId = searchResults.results[0].id;
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

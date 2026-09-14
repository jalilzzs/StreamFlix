import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { MOVIES } from '@consumet/extensions';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
// مفتاح الخدمة المجانية تحطه في الـ Environment تاع Render باسم SCRAPER_API_KEY
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const flixhq = new MOVIES.FlixHQ();

app.get('/api/extract', async (req, res) => {
  const tmdbId = req.query.tmdb || req.query.id;
  const type = req.query.type || 'movie';
  const season = req.query.season || 1;
  const episode = req.query.episode || 1;

  if (!tmdbId) {
    return res.status(400).json({ success: false, error: 'رقم tmdb مطلوب' });
  }

  try {
    const targetUrl = `https://flixhq.to/search/${tmdbId}`;
    
    // استخدام API خارجي مجاني لتجاوز الحماية بطلب HTTP عادي بدون متصفح ثقيل
    const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}`;
    
    const solverResponse = await axios.get(scraperUrl, { timeout: 30000 });

    if (!solverResponse.data) {
      return res.status(500).json({ success: false, error: 'فشل جلب الصفحة عبر خدمة التجاوز' });
    }

    // البحث عبر مكتبة Consumet
    const searchResults = await flixhq.search(String(tmdbId));
    if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على المحتوى' });
    }

    const mediaId = searchResults.results[0].id;
    const mediaInfo = await flixhq.fetchMediaInfo(mediaId);
    
    let targetEpisodeId = mediaInfo.episodes[0].id;
    if (type === 'tv' && mediaInfo.episodes) {
      const targetEp = mediaInfo.episodes.find(ep => ep.season == season && ep.number == episode);
      if (targetEp) targetEpisodeId = targetEp.id;
    }

    const sourcesData = await flixhq.fetchEpisodeSources(targetEpisodeId);

    if (!sourcesData || !sourcesData.sources || sourcesData.sources.length === 0) {
      return res.status(404).json({ success: false, error: 'تعذر العثور على روابط البث الصافي' });
    }

    return res.json({
      success: true,
      sources: sourcesData.sources,
      subtitles: sourcesData.subtitles || []
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: 'خطأ في الخادم', 
      details: error.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

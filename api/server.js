import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { MOVIES } from '@consumet/extensions';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL;

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
    if (!FLARESOLVERR_URL) {
      return res.status(500).json({ success: false, error: 'رابط FLARESOLVERR_URL غير معرف في متغيرات البيئة' });
    }

    // إرسال الطلب لـ FlareSolverr مع وقت انتظار ممدد (90 ثانية) لتجاوز ثقل السبّات والـ Cold Start
    const solverResponse = await axios.post(FLARESOLVERR_URL, {
      cmd: 'request.get',
      url: `https://flixhq.to/search/${tmdbId}`,
      maxTimeout: 80000
    }, { timeout: 90000 });

    if (!solverResponse.data || solverResponse.data.status !== 'ok') {
      return res.status(500).json({ success: false, error: 'فشل تجاوز حماية Cloudflare عبر FlareSolverr' });
    }

    // البحث عبر مكتبة Consumet بعد تخطي الحظر بنجاح
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

    // إرجاع الروابط الصافية مباشرة
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

import express from 'express';
import cors from 'cors';
import { MOVIES } from '@consumet/extensions';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const flixhq = new MOVIES.FlixHQ();

app.get('/api/extract', async (req, res) => {
  try {
    // التقاط tmdb أو id من رابط الفرونتاند
    const tmdbId = req.query.tmdb || req.query.id;
    const type = req.query.type || 'movie';
    const season = req.query.season || 1;
    const episode = req.query.episode || 1;

    if (!tmdbId) {
      return res.status(400).json({ success: false, error: 'رقم tmdb مطلوب' });
    }

    // البحث في Consumet باستعمال رقم الـ TMDB أو كلمة مفتاحية
    const searchResults = await flixhq.search(String(tmdbId));
    
    if (!searchResults.results || searchResults.results.length === 0) {
      // محاولة ثانية ببحث عام إذا لمჩيّد الرقم مباشرة
      const fallbackSearch = await flixhq.search(`movie ${tmdbId}`);
      if (!fallbackSearch.results || fallbackSearch.results.length === 0) {
        return res.status(404).json({ success: false, error: 'لم يتم العثور على الفيلم في المصدر' });
      }
      var mediaId = fallbackSearch.results[0].id;
    } else {
      var mediaId = searchResults.results[0].id;
    }

    const mediaInfo = await flixhq.fetchMediaInfo(mediaId);
    
    let targetEpisodeId = mediaInfo.episodes[0].id;
    if (type === 'tv' && mediaInfo.episodes) {
      const targetEp = mediaInfo.episodes.find(ep => ep.season == season && ep.number == episode);
      if (targetEp) targetEpisodeId = targetEp.id;
    }

    const sourcesData = await flixhq.fetchEpisodeSources(targetEpisodeId);

    return res.json({
      success: true,
      sources: sourcesData.sources,
      subtitles: sourcesData.subtitles || []
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: 'فشل استخراج البث الصافي', 
      details: error.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

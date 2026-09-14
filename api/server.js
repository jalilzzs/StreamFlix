import express from 'express';
import cors from 'cors';
import { MOVIES } from '@consumet/extensions';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const flixhq = new MOVIES.FlixHQ();

app.get('/api/extract', async (req, res) => {
  const tmdbId = req.query.tmdb || req.query.id;
  const type = req.query.type || 'movie';
  const season = req.query.season || 1;
  const episode = req.query.episode || 1;

  // رابط الـ Embed البديل في حال حدوث حظر أو 522
  const fallbackEmbed = type === 'tv' 
    ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.to/embed/movie/${tmdbId}`;

  try {
    if (!tmdbId) {
      return res.status(400).json({ success: false, error: 'رقم tmdb مطلوب' });
    }

    // محاولة جلب الرابط الصافي عبر Consumet
    const searchResults = await flixhq.search(String(tmdbId));
    if (!searchResults.results || searchResults.results.length === 0) {
      return res.json({ success: false, fallbackUrl: fallbackEmbed });
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
      return res.json({ success: false, fallbackUrl: fallbackEmbed });
    }

    return res.json({
      success: true,
      sources: sourcesData.sources,
      subtitles: sourcesData.subtitles || []
    });

  } catch (error) {
    // إذا حدث خطأ 522 أو Timeout، يرجع الـ Embed مباشرة بدل ما يسقط السيرفر
    return res.json({ 
      success: false, 
      fallbackUrl: fallbackEmbed, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

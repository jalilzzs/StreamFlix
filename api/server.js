const express = require('express');
const cors = require('cors');
const { MOVIES } = require('@consumet/extensions');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;

// تهيئة محرك FlixHQ
const flixhq = new MOVIES.FlixHQ();

/**
 * 1. مسار البحث بـ TMDB أو اسم الفيلم/المسلسل
 * GET /api/search?q=avatar
 */
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'كلمة البحث مطلوب' });
    }

    const results = await flixhq.search(q);
    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 2. مسار استخراج رابط البث المباشر (m3u8)
 * GET /api/extract?id=movie/watch-avatar-1234
 */
app.get('/api/extract', async (req, res) => {
  const { id, episodeId } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'معرف المحتوى (id) مطلوب' });
  }

  try {
    let targetEpisodeId = episodeId;

    // في حال عدم إرسال episodeId (أفلام)، نقتطع أول حلقة/مشغل متوفر تلقائياً
    if (!targetEpisodeId) {
      const mediaInfo = await flixhq.fetchMediaInfo(id);
      if (!mediaInfo.episodes || mediaInfo.episodes.length === 0) {
        return res.status(404).json({ success: false, error: 'لم يتم العثور على مصدر بث' });
      }
      targetEpisodeId = mediaInfo.episodes[0].id;
    }

    // استخراج مصادر البث الصافية (.m3u8)
    const sourcesData = await flixhq.fetchEpisodeSources(targetEpisodeId);

    return res.json({
      success: true,
      sources: sourcesData.sources,       // تحتوي على روابط m3u8 والجودات
      subtitles: sourcesData.subtitles   // تحتوي على ملفات الترجمة vtt
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: 'فشل استخراج رابط البث', 
      details: error.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

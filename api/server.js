const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// إعداد CORS بشكل مفتوح لجميع المصادر
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/extract', async (req, res) => {
  const { tmdb, type = 'movie', season, episode } = req.query;

  if (!tmdb) {
    return res.status(400).json({ success: false, error: 'tmdb ID مطلوب' });
  }

  const embedUrl = type === 'tv' 
    ? `https://vidsrc.to/embed/tv/${tmdb}/${season || 1}/${episode || 1}`
    : `https://vidsrc.to/embed/movie/${tmdb}`;

  try {
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://vidsrc.to/'
      },
      timeout: 5000
    });

    // البحث عن روابط .m3u8
    const m3u8Match = response.data.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);

    if (m3u8Match) {
      return res.json({ success: true, streamUrl: m3u8Match[0] });
    }

    // إرجاع الـ Fallback مباشرة للفرونتاند في حال التشفير
    return res.json({ success: false, fallbackUrl: embedUrl });

  } catch (error) {
    // التحويل التلقائي للـ Fallback عند أي خطأ في السيرفر
    return res.json({ success: false, fallbackUrl: embedUrl });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

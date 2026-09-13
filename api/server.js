const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/extract', async (req, res) => {
  const { tmdb, type = 'movie', season, episode } = req.query;

  if (!tmdb) {
    return res.status(400).json({ error: 'tmdb ID مطلوب' });
  }

  try {
    const embedUrl = type === 'tv' 
      ? `https://vidsrc.to/embed/tv/${tmdb}/${season || 1}/${episode || 1}`
      : `https://vidsrc.to/embed/movie/${tmdb}`;

    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://vidsrc.to/'
      }
    });

    const m3u8Match = response.data.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);

    if (m3u8Match) {
      return res.json({ success: true, streamUrl: m3u8Match[0] });
    }

    res.json({ success: false, fallbackUrl: embedUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

app.get('/', (req, res) => {
  res.json({
    success: true,
    server: 'StreamFlix Backend',
    status: 'online'
  });
});

app.get('/api/test-vsembed', async (req, res) => {
  const targetUrl = 'https://vsembed.ru/vs_src.php?type=movie&id=550';

  if (!SCRAPER_API_KEY) {
    return res.json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Render'
    });
  }

  const startedAt = Date.now();

  try {
    const response = await axios.get('https://api.scraperapi.com', {
      params: {
        api_key: SCRAPER_API_KEY,
        url: targetUrl
      },
      timeout: 60000,
      validateStatus: () => true
    });

    const elapsed = Date.now() - startedAt;

    const body =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    return res.json({
      success: response.status >= 200 && response.status < 300,
      stage: 'vs_src_test',
      target_url: targetUrl,
      scraper_status: response.status,
      response_time_ms: elapsed,
      content_type: response.headers['content-type'] || null,
      response_size: body.length,

      looks_json:
        response.headers['content-type']?.includes('json') || false,

      has_m3u8: body.toLowerCase().includes('.m3u8'),
      has_mp4: body.toLowerCase().includes('.mp4'),
      has_source: body.toLowerCase().includes('source'),
      has_file: body.toLowerCase().includes('file'),
      has_url: body.toLowerCase().includes('url'),
      has_token: body.toLowerCase().includes('token'),

      preview: body.substring(0, 5000)
    });

  } catch (error) {
    return res.json({
      success: false,
      stage: 'request_error',
      error_code: error.code || null,
      error_message: error.message || null,
      response_time_ms: Date.now() - startedAt
    });
  }
});

app.listen(PORT, () => {
  console.log(`StreamFlix Backend running on port ${PORT}`);
});

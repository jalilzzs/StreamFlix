import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// =====================================================
// BASIC TEST
// =====================================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    server: 'StreamFlix Backend',
    status: 'online'
  });
});

// =====================================================
// TEST VSEmbed SOURCE API
// =====================================================

app.get('/api/test-vsembed', async (req, res) => {
  const targetUrl =
    'https://vsembed.ru/vs_src.php?type=movie&id=550';

  if (!SCRAPER_API_KEY) {
    return res.json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Render'
    });
  }

  const startedAt = Date.now();

  try {
    const response = await axios.get(
      'https://api.scraperapi.com',
      {
        params: {
          api_key: SCRAPER_API_KEY,
          url: targetUrl
        },
        timeout: 60000,
        validateStatus: () => true
      }
    );

    const elapsed = Date.now() - startedAt;

    const body =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    return res.json({
      success:
        response.status >= 200 &&
        response.status < 300,

      stage: 'vs_src_test',

      target_url: targetUrl,

      scraper_status: response.status,

      response_time_ms: elapsed,

      content_type:
        response.headers['content-type'] || null,

      response_size: body.length,

      looks_json:
        response.headers['content-type']?.includes('json') ||
        false,

      has_m3u8:
        body.toLowerCase().includes('.m3u8'),

      has_mp4:
        body.toLowerCase().includes('.mp4'),

      has_source:
        body.toLowerCase().includes('source'),

      has_file:
        body.toLowerCase().includes('file'),

      has_url:
        body.toLowerCase().includes('url'),

      has_token:
        body.toLowerCase().includes('token'),

      preview:
        body.substring(0, 5000)
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

// =====================================================
// TEST CLOUDORCHESTRANOVA
// =====================================================

app.get('/api/test-cloud', async (req, res) => {

  const targetUrl =
    'https://cloudorchestranova.com/embed/movie/550?vs=1vt55BdR0CY1qqEsBEY0eix0rTY84_HDTI9U5VqmbEqrm989c-61as7Q4vHQd3-m1IpiIHa-sBW55I-xTN0KN110Ec7vam2XQw';

  if (!SCRAPER_API_KEY) {
    return res.json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Render'
    });
  }

  const startedAt = Date.now();

  try {

    const response = await axios.get(
      'https://api.scraperapi.com',
      {
        params: {
          api_key: SCRAPER_API_KEY,
          url: targetUrl,
          render: 'true'
        },

        timeout: 90000,

        validateStatus: () => true,

        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'
        }
      }
    );

    const elapsed = Date.now() - startedAt;

    const body =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    const lower = body.toLowerCase();

    return res.json({

      success:
        response.status >= 200 &&
        response.status < 300,

      stage: 'cloudorchestranova_test',

      target_url: targetUrl,

      scraper_status: response.status,

      response_time_ms: elapsed,

      content_type:
        response.headers['content-type'] || null,

      response_size: body.length,

      is_html:
        lower.includes('<html') ||
        lower.includes('<!doctype'),

      looks_json:
        response.headers['content-type']?.includes('json') ||
        false,

      has_iframe:
        lower.includes('<iframe'),

      has_script:
        lower.includes('<script'),

      has_video:
        lower.includes('<video'),

      has_source:
        lower.includes('<source'),

      has_m3u8:
        lower.includes('.m3u8'),

      has_mp4:
        lower.includes('.mp4'),

      has_mpd:
        lower.includes('.mpd'),

      has_blob:
        lower.includes('blob:'),

      has_fetch:
        lower.includes('fetch('),

      has_xhr:
        lower.includes('xmlhttprequest') ||
        lower.includes('xhr'),

      has_axios:
        lower.includes('axios'),

      has_cloudflare:
        lower.includes('cloudflare') ||
        lower.includes('cf-ray'),

      has_token:
        lower.includes('token'),

      has_source_keyword:
        lower.includes('source'),

      preview:
        body.substring(0, 8000)

    });

  } catch (error) {

    return res.json({

      success: false,

      stage: 'cloudorchestranova_connection',

      error_code:
        error.code || null,

      error_message:
        error.message || null,

      response_time_ms:
        Date.now() - startedAt

    });

  }

});

// =====================================================
// SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(
    `StreamFlix Backend running on port ${PORT}`
  );
});

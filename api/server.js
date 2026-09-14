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
// TEST VSEmbed SOURCE ENDPOINT
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

      response_time_ms:
        Date.now() - startedAt,

      content_type:
        response.headers['content-type'] || null,

      response_size:
        body.length,

      looks_json:
        response.headers['content-type']
          ?.toLowerCase()
          .includes('json') || false,

      preview:
        body.substring(0, 5000)
    });

  } catch (error) {
    return res.json({
      success: false,
      stage: 'request_error',
      error_code: error.code || null,
      error_message: error.message || null,
      response_time_ms:
        Date.now() - startedAt
    });
  }
});

// =====================================================
// CLOUDORCHESTRANOVA DIAGNOSTIC
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
          url: targetUrl
        },

        timeout: 90000,

        validateStatus: () => true,

        maxRedirects: 10,

        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
          'Accept':
            'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
        }
      }
    );

    const body =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    const lower = body.toLowerCase();

    const headers = {};

    for (const [key, value] of Object.entries(response.headers)) {
      if (
        [
          'content-type',
          'location',
          'server',
          'cf-ray',
          'x-powered-by',
          'cache-control'
        ].includes(key.toLowerCase())
      ) {
        headers[key] = value;
      }
    }

    return res.json({

      success:
        response.status >= 200 &&
        response.status < 300,

      stage:
        'cloudorchestranova_diagnostic',

      target_url:
        targetUrl,

      scraper_status:
        response.status,

      status_text:
        response.statusText || null,

      response_time_ms:
        Date.now() - startedAt,

      content_type:
        response.headers['content-type'] || null,

      response_size:
        body.length,

      important_headers:
        headers,

      is_html:
        lower.includes('<html') ||
        lower.includes('<!doctype'),

      looks_json:
        response.headers['content-type']
          ?.toLowerCase()
          .includes('json') || false,

      is_not_found:
        response.status === 404 ||
        lower.includes('not found'),

      is_forbidden:
        response.status === 403,

      is_redirect:
        response.status >= 300 &&
        response.status < 400,

      has_location_header:
        !!response.headers.location,

      location:
        response.headers.location || null,

      preview:
        body.substring(0, 4000)

    });

  } catch (error) {

    return res.json({

      success: false,

      stage:
        'cloudorchestranova_connection',

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

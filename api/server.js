import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const MOVIE_ID = '550';

const VSEMBED_URL =
  `https://vsembed.ru/vs_src.php?type=movie&id=${MOVIE_ID}`;

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
// DYNAMIC VSEMBED → CLOUD DIAGNOSTIC
// =====================================================

app.get('/api/test-chain', async (req, res) => {

  if (!SCRAPER_API_KEY) {
    return res.json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Render'
    });
  }

  const startedAt = Date.now();

  try {

    // -------------------------------------------------
    // STEP 1 — GET DYNAMIC SRC FROM VSEMBED
    // -------------------------------------------------

    const sourceResponse = await axios.get(
      'https://api.scraperapi.com',
      {
        params: {
          api_key: SCRAPER_API_KEY,
          url: VSEMBED_URL
        },

        timeout: 60000,

        validateStatus: () => true
      }
    );

    const sourceBody =
      typeof sourceResponse.data === 'string'
        ? sourceResponse.data
        : JSON.stringify(sourceResponse.data);

    let sourceJson = null;

    try {
      sourceJson = JSON.parse(sourceBody);
    } catch {}

    const dynamicSrc =
      sourceJson?.src || null;

    // -------------------------------------------------
    // STEP 1 RESULT
    // -------------------------------------------------

    if (
      sourceResponse.status < 200 ||
      sourceResponse.status >= 300
    ) {
      return res.json({

        success: false,

        stage:
          'vsembed_failed',

        vsembed: {

          url:
            VSEMBED_URL,

          status:
            sourceResponse.status,

          content_type:
            sourceResponse.headers['content-type'] || null,

          preview:
            sourceBody.substring(0, 3000)

        },

        total_time_ms:
          Date.now() - startedAt

      });
    }

    if (!dynamicSrc) {
      return res.json({

        success: false,

        stage:
          'src_missing',

        vsembed: {

          url:
            VSEMBED_URL,

          status:
            sourceResponse.status,

          content_type:
            sourceResponse.headers['content-type'] || null,

          preview:
            sourceBody.substring(0, 3000)

        },

        total_time_ms:
          Date.now() - startedAt

      });
    }

    // -------------------------------------------------
    // STEP 2 — TEST THE NEW DYNAMIC SRC
    // -------------------------------------------------

    const cloudResponse = await axios.get(
      'https://api.scraperapi.com',
      {
        params: {
          api_key: SCRAPER_API_KEY,
          url: dynamicSrc
        },

        timeout: 90000,

        maxRedirects: 10,

        validateStatus: () => true,

        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',

          'Accept':
            'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
        }
      }
    );

    const cloudBody =
      typeof cloudResponse.data === 'string'
        ? cloudResponse.data
        : JSON.stringify(cloudResponse.data);

    const lower =
      cloudBody.toLowerCase();

    // -------------------------------------------------
    // FINAL DIAGNOSTIC
    // -------------------------------------------------

    return res.json({

      success:
        cloudResponse.status >= 200 &&
        cloudResponse.status < 300,

      stage:
        'dynamic_chain_test',

      total_time_ms:
        Date.now() - startedAt,

      // =========================
      // VSEMBED
      // =========================

      vsembed: {

        url:
          VSEMBED_URL,

        status:
          sourceResponse.status,

        content_type:
          sourceResponse.headers['content-type'] || null,

        returned_src:
          dynamicSrc

      },

      // =========================
      // CLOUDORCHESTRANOVA
      // =========================

      cloudorchestranova: {

        status:
          cloudResponse.status,

        status_text:
          cloudResponse.statusText || null,

        content_type:
          cloudResponse.headers['content-type'] || null,

        response_size:
          cloudBody.length,

        is_html:
          lower.includes('<html') ||
          lower.includes('<!doctype'),

        is_not_found:
          cloudResponse.status === 404,

        is_forbidden:
          cloudResponse.status === 403,

        is_redirect:
          cloudResponse.status >= 300 &&
          cloudResponse.status < 400,

        location:
          cloudResponse.headers['location'] || null,

        server:
          cloudResponse.headers['server'] || null,

        x_powered_by:
          cloudResponse.headers['x-powered-by'] || null,

        has_script:
          lower.includes('<script'),

        has_iframe:
          lower.includes('<iframe'),

        has_video:
          lower.includes('<video'),

        has_source:
          lower.includes('<source'),

        has_m3u8:
          lower.includes('.m3u8'),

        has_mp4:
          lower.includes('.mp4'),

        preview:
          cloudBody.substring(0, 5000)

      }

    });

  } catch (error) {

    return res.json({

      success: false,

      stage:
        'chain_request_error',

      error_code:
        error.code || null,

      error_message:
        error.message || null,

      total_time_ms:
        Date.now() - startedAt

    });

  }

});

// =====================================================
// OLD VSEMBED TEST
// =====================================================

app.get('/api/test-vsembed', async (req, res) => {

  if (!SCRAPER_API_KEY) {
    return res.json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Render'
    });
  }

  try {

    const response = await axios.get(
      'https://api.scraperapi.com',
      {
        params: {
          api_key: SCRAPER_API_KEY,
          url: VSEMBED_URL
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

      stage:
        'vs_src_test',

      target_url:
        VSEMBED_URL,

      scraper_status:
        response.status,

      response_time_ms:
        null,

      content_type:
        response.headers['content-type'] || null,

      response_size:
        body.length,

      preview:
        body.substring(0, 5000)

    });

  } catch (error) {

    return res.json({

      success: false,

      stage:
        'request_error',

      error_code:
        error.code || null,

      error_message:
        error.message || null

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

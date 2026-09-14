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
// TEST ANY URL THROUGH SCRAPERAPI
// =====================================================

app.get('/api/diagnose', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      stage: 'input',
      diagnosis: 'ضع الرابط في ?url='
    });
  }

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
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

    let diagnosis;

    if (response.status >= 200 && response.status < 300) {
      diagnosis = 'الموقع الهدف استجاب بنجاح عبر ScraperAPI';
    } else if (response.status === 401 || response.status === 403) {
      diagnosis = 'رفض صلاحية الطلب أو مشكلة في API Key';
    } else if (response.status === 429) {
      diagnosis = 'تم تجاوز حد ScraperAPI';
    } else if (response.status === 522) {
      diagnosis = 'الموقع الهدف لم يستجب في الوقت المناسب (522)';
    } else if (response.status >= 500) {
      diagnosis = `خطأ خادم HTTP ${response.status}`;
    } else {
      diagnosis = `الموقع الهدف رجع HTTP ${response.status}`;
    }

    return res.json({
      success: response.status >= 200 && response.status < 300,

      stage: 'target_test',

      target_url: targetUrl,

      scraper_status: response.status,

      diagnosis,

      response_time_ms: elapsed,

      content_type:
        response.headers['content-type'] || null,

      response_size: body.length,

      is_html:
        body.toLowerCase().includes('<html') ||
        body.toLowerCase().includes('<!doctype'),

      has_iframe:
        body.toLowerCase().includes('<iframe'),

      has_cloudflare:
        body.toLowerCase().includes('cloudflare') ||
        body.toLowerCase().includes('cf-ray'),

      preview: body.substring(0, 1500)
    });

  } catch (error) {

    const elapsed = Date.now() - startedAt;

    let diagnosis = 'فشل الاتصال بـ ScraperAPI';

    if (error.code === 'ECONNABORTED') {
      diagnosis = 'انتهت مهلة الانتظار';
    } else if (error.code === 'ENOTFOUND') {
      diagnosis = 'Render لم يتمكن من الوصول إلى ScraperAPI';
    } else if (error.code === 'ECONNREFUSED') {
      diagnosis = 'تم رفض الاتصال';
    } else if (error.code === 'ETIMEDOUT') {
      diagnosis = 'انتهت مهلة الشبكة';
    }

    return res.json({
      success: false,
      stage: 'connection',
      diagnosis,
      error_code: error.code || null,
      error_message: error.message || null,
      response_time_ms: elapsed
    });
  }
});

// =====================================================
// SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`StreamFlix Backend running on port ${PORT}`);
});

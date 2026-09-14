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
// SCRAPERAPI DIAGNOSTIC
// =====================================================

app.get('/api/test-scraper', async (req, res) => {
  const testUrl = req.query.url || 'https://example.com';

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Environment Variables على Render'
    });
  }

  const startedAt = Date.now();

  try {
    const response = await axios.get('https://api.scraperapi.com', {
      params: {
        api_key: SCRAPER_API_KEY,
        url: testUrl
      },
      timeout: 60000,
      validateStatus: () => true
    });

    const elapsed = Date.now() - startedAt;

    let diagnosis = 'غير معروف';

    if (response.status >= 200 && response.status < 300) {
      diagnosis = 'ScraperAPI تعمل بشكل صحيح';
    } else if (response.status === 401 || response.status === 403) {
      diagnosis = 'مشكلة في API Key أو صلاحيات ScraperAPI';
    } else if (response.status === 429) {
      diagnosis = 'ScraperAPI رفضت الطلب بسبب Rate Limit أو حدود الاستخدام';
    } else if (response.status === 522) {
      diagnosis = 'الموقع الهدف لم يستجب في الوقت المناسب';
    } else if (response.status >= 500) {
      diagnosis = 'خطأ من ScraperAPI أو من الموقع الهدف';
    }

    return res.status(200).json({
      success: response.status >= 200 && response.status < 300,

      stage: 'scraperapi',

      scraper_status: response.status,

      diagnosis,

      target_url: testUrl,

      response_time_ms: elapsed,

      content_type: response.headers['content-type'] || null,

      response_size:
        typeof response.data === 'string'
          ? response.data.length
          : JSON.stringify(response.data).length,

      preview:
        typeof response.data === 'string'
          ? response.data.substring(0, 500)
          : response.data
    });

  } catch (error) {
    const elapsed = Date.now() - startedAt;

    let diagnosis = 'فشل الاتصال بـ ScraperAPI';

    if (error.code === 'ECONNABORTED') {
      diagnosis = 'انتهت مهلة الانتظار أثناء الاتصال بـ ScraperAPI';
    } else if (error.code === 'ENOTFOUND') {
      diagnosis = 'Render لم يتمكن من الوصول إلى api.scraperapi.com';
    } else if (error.code === 'ECONNREFUSED') {
      diagnosis = 'تم رفض الاتصال بـ ScraperAPI';
    } else if (error.code === 'ETIMEDOUT') {
      diagnosis = 'انتهت مهلة الاتصال بالشبكة';
    }

    return res.status(200).json({
      success: false,

      stage: 'scraperapi_connection',

      diagnosis,

      error_code: error.code || null,

      error_message: error.message || 'Unknown error',

      response_time_ms: elapsed
    });
  }
});

// =====================================================
// SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

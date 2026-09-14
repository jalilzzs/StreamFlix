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
// DIAGNOSTIC - SCRAPERAPI
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
      diagnosis = 'مشكلة في API Key أو الصلاحيات';
    } else if (response.status === 429) {
      diagnosis = 'تم تجاوز Rate Limit أو حدود الاستخدام';
    } else if (response.status === 522) {
      diagnosis = 'الموقع الهدف لم يستجب في الوقت المناسب';
    } else if (response.status >= 500) {
      diagnosis = 'خطأ من ScraperAPI أو من الموقع الهدف';
    }

    const body =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    return res.status(200).json({
      success: response.status >= 200 && response.status < 300,

      stage: 'scraperapi',

      scraper_status: response.status,

      diagnosis,

      target_url: testUrl,

      response_time_ms: elapsed,

      content_type: response.headers['content-type'] || null,

      response_size: body.length,

      has_html: body.includes('<html') || body.includes('<!DOCTYPE'),

      has_iframe: body.includes('<iframe'),

      has_script: body.includes('<script'),

      preview: body.substring(0, 1000)
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
// FULL DIAGNOSTIC
// =====================================================

app.get('/api/diagnose', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      stage: 'input',
      diagnosis: 'لازم تبعث url للاختبار'
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

  const result = {
    success: false,
    stage: null,
    target_url: targetUrl,
    scraperapi: {},
    target: {},
    diagnosis: null,
    total_time_ms: null
  };

  try {
    result.stage = 'scraperapi_request';

    const response = await axios.get('https://api.scraperapi.com', {
      params: {
        api_key: SCRAPER_API_KEY,
        url: targetUrl
      },
      timeout: 60000,
      validateStatus: () => true
    });

    const body =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    result.scraperapi = {
      status: response.status,
      content_type: response.headers['content-type'] || null,
      response_size: body.length,
      response_time_ms: Date.now() - startedAt
    };

    // -----------------------------------------------
    // HTTP status diagnosis
    // -----------------------------------------------

    if (response.status === 401 || response.status === 403) {
      result.stage = 'scraperapi_auth';
      result.diagnosis = 'ScraperAPI رفضت الطلب: تحقق من API Key والصلاحيات';
      result.total_time_ms = Date.now() - startedAt;
      return res.json(result);
    }

    if (response.status === 429) {
      result.stage = 'scraperapi_limit';
      result.diagnosis = 'تم تجاوز حد استعمال ScraperAPI';
      result.total_time_ms = Date.now() - startedAt;
      return res.json(result);
    }

    if (response.status === 522) {
      result.stage = 'target_timeout';
      result.diagnosis =
        'ScraperAPI اشتغلت لكن الموقع الهدف لم يستجب في الوقت المناسب';
      result.total_time_ms = Date.now() - startedAt;
      return res.json(result);
    }

    if (response.status >= 500) {
      result.stage = 'target_or_scraper_server';
      result.diagnosis =
        'حدث خطأ HTTP من ScraperAPI أو من الموقع الهدف';
      result.total_time_ms = Date.now() - startedAt;
      return res.json(result);
    }

    if (response.status < 200 || response.status >= 300) {
      result.stage = 'target_http';
      result.diagnosis =
        `الموقع الهدف رجع HTTP ${response.status}`;
      result.total_time_ms = Date.now() - startedAt;
      return res.json(result);
    }

    // -----------------------------------------------
    // HTML diagnosis
    // -----------------------------------------------

    result.stage = 'target_response';

    result.target = {
      status: response.status,
      is_html:
        body.includes('<html') ||
        body.includes('<!DOCTYPE') ||
        body.includes('<HTML'),

      has_iframe: body.toLowerCase().includes('<iframe'),

      has_script: body.toLowerCase().includes('<script'),

      contains_cloudflare:
        body.toLowerCase().includes('cloudflare') ||
        body.toLowerCase().includes('cf-ray'),

      contains_access_denied:
        body.toLowerCase().includes('access denied') ||
        body.toLowerCase().includes('forbidden'),

      preview: body.substring(0, 1500)
    };

    result.success = true;
    result.stage = 'diagnostic_complete';

    result.diagnosis =
      'ScraperAPI وصلت للموقع الهدف واستلمت استجابة HTTP ناجحة. إذا كان التطبيق لا يعمل بعد ذلك، فالمشكلة في مرحلة التطبيق التالية وليست في اتصال ScraperAPI الأساسي.';

    result.total_time_ms = Date.now() - startedAt;

    return res.json(result);

  } catch (error) {
    result.stage = 'scraperapi_connection';

    if (error.code === 'ECONNABORTED') {
      result.diagnosis = 'انتهت مهلة الاتصال بـ ScraperAPI';
    } else if (error.code === 'ENOTFOUND') {
      result.diagnosis =
        'Render لم يتمكن من العثور على api.scraperapi.com';
    } else if (error.code === 'ECONNREFUSED') {
      result.diagnosis = 'تم رفض اتصال Render بـ ScraperAPI';
    } else if (error.code === 'ETIMEDOUT') {
      result.diagnosis = 'انتهت مهلة الاتصال بالشبكة';
    } else {
      result.diagnosis = 'حدث خطأ أثناء الاتصال بـ ScraperAPI';
    }

    result.error_code = error.code || null;
    result.error_message = error.message || 'Unknown error';
    result.total_time_ms = Date.now() - startedAt;

    return res.json(result);
  }
});

// =====================================================
// SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`StreamFlix Backend running on port ${PORT}`);
});

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
// DEEP DIAGNOSTIC
// =====================================================

app.get('/api/diagnose', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      stage: 'input',
      diagnosis: 'ضع الرابط هكذا: ?url=https://example.com'
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
    const response = await axios.get(
      'https://api.scraperapi.com',
      {
        params: {
          api_key: SCRAPER_API_KEY,
          url: targetUrl
        },
        timeout: 60000,
        validateStatus: () => true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'
        }
      }
    );

    const elapsed = Date.now() - startedAt;

    const html =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    // -------------------------------------------------
    // Extract iframe URLs
    // -------------------------------------------------

    const iframeUrls = [];

    const iframeRegex =
      /<iframe[^>]+src=["']([^"']+)["']/gi;

    let match;

    while ((match = iframeRegex.exec(html)) !== null) {
      iframeUrls.push(match[1]);
    }

    // -------------------------------------------------
    // Extract script URLs
    // -------------------------------------------------

    const scriptUrls = [];

    const scriptRegex =
      /<script[^>]+src=["']([^"']+)["']/gi;

    while ((match = scriptRegex.exec(html)) !== null) {
      scriptUrls.push(match[1]);
    }

    // -------------------------------------------------
    // Search interesting references
    // -------------------------------------------------

    const lower = html.toLowerCase();

    const interesting = [];

    const keywords = [
      'iframe',
      'player',
      'video',
      'source',
      'sources',
      'm3u8',
      'mp4',
      'hls',
      'manifest',
      'stream',
      'embed',
      'token',
      'api',
      'ajax',
      'fetch(',
      'axios',
      'xmlhttprequest',
      'cloudflare',
      'challenge',
      'gate'
    ];

    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        interesting.push(keyword);
      }
    }

    // -------------------------------------------------
    // Possible URLs in HTML
    // -------------------------------------------------

    const allUrls = [];

    const urlRegex =
      /https?:\/\/[^\s"'<>\\]+/gi;

    while ((match = urlRegex.exec(html)) !== null) {
      let url = match[0]
        .replace(/[),;]+$/g, '');

      if (!allUrls.includes(url)) {
        allUrls.push(url);
      }
    }

    // Limit output
    const limitedUrls = allUrls.slice(0, 100);

    // -------------------------------------------------
    // Diagnosis
    // -------------------------------------------------

    let diagnosis;

    if (response.status === 401 || response.status === 403) {
      diagnosis =
        'المشكل في صلاحية ScraperAPI أو API Key.';
    } else if (response.status === 429) {
      diagnosis =
        'ScraperAPI وصلت إلى Rate Limit.';
    } else if (response.status === 522) {
      diagnosis =
        'الموقع الهدف أعطى 522.';
    } else if (
      response.status >= 500 &&
      response.status <= 599
    ) {
      diagnosis =
        `خطأ HTTP ${response.status} من ScraperAPI أو الموقع الهدف.`;
    } else if (
      response.status >= 200 &&
      response.status < 300
    ) {
      if (iframeUrls.length > 0) {
        diagnosis =
          'ScraperAPI تعمل والصفحة تحتوي iframe. المرحلة التالية هي فحص iframe.';
      } else if (
        lower.includes('m3u8') ||
        lower.includes('.mp4')
      ) {
        diagnosis =
          'وجدنا مرجع فيديو داخل الصفحة.';
      } else if (
        lower.includes('fetch(') ||
        lower.includes('xmlhttprequest') ||
        lower.includes('axios')
      ) {
        diagnosis =
          'الصفحة تعتمد على JavaScript/طلبات ديناميكية.';
      } else {
        diagnosis =
          'الصفحة وصلت بنجاح ولكن لم يظهر رابط فيديو مباشر.';
      }
    } else {
      diagnosis =
        `الموقع رجع HTTP ${response.status}.`;
    }

    return res.json({
      success: response.status >= 200 && response.status < 300,

      stage: 'deep_diagnostic',

      target_url: targetUrl,

      scraper_status: response.status,

      diagnosis,

      response_time_ms: elapsed,

      content_type:
        response.headers['content-type'] || null,

      response_size: html.length,

      is_html:
        lower.includes('<html') ||
        lower.includes('<!doctype'),

      has_iframe: iframeUrls.length > 0,

      iframe_count: iframeUrls.length,

      iframe_urls: iframeUrls,

      script_count: scriptUrls.length,

      script_urls: scriptUrls,

      found_m3u8:
        lower.includes('.m3u8'),

      found_mp4:
        lower.includes('.mp4'),

      found_fetch:
        lower.includes('fetch('),

      found_xhr:
        lower.includes('xmlhttprequest'),

      found_axios:
        lower.includes('axios'),

      found_cloudflare:
        lower.includes('cloudflare') ||
        lower.includes('cf-ray') ||
        lower.includes('__cf'),

      found_token:
        lower.includes('token'),

      found_gate:
        lower.includes('gate'),

      interesting_keywords: interesting,

      discovered_urls: limitedUrls,

      preview: html.substring(0, 3000)
    });

  } catch (error) {

    const elapsed = Date.now() - startedAt;

    let diagnosis =
      'فشل الاتصال بـ ScraperAPI.';

    if (error.code === 'ECONNABORTED') {
      diagnosis =
        'انتهت مهلة الانتظار 60 ثانية.';
    } else if (error.code === 'ENOTFOUND') {
      diagnosis =
        'Render لم يتمكن من الوصول إلى ScraperAPI.';
    } else if (error.code === 'ECONNREFUSED') {
      diagnosis =
        'تم رفض الاتصال بالشبكة.';
    } else if (error.code === 'ETIMEDOUT') {
      diagnosis =
        'انتهت مهلة الاتصال بالشبكة.';
    }

    return res.status(200).json({
      success: false,

      stage: 'scraperapi_connection',

      diagnosis,

      error_code:
        error.code || null,

      error_message:
        error.message || null,

      response_time_ms: elapsed
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

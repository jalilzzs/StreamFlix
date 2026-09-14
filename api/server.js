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

// =====================================================
// JAVASCRIPT FETCH DIAGNOSTIC
// =====================================================

app.get('/api/inspect-js', async (req, res) => {
  const targetUrl =
    req.query.url ||
    'https://vsembed.ru/embed/movie/550/';

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Render'
    });
  }

  const startedAt = Date.now();

  try {
    const page = await axios.get(
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

    const html =
      typeof page.data === 'string'
        ? page.data
        : JSON.stringify(page.data);

    // استخراج ملفات JavaScript
    const scripts = [];

    const scriptRegex =
      /<script[^>]+src=["']([^"']+)["']/gi;

    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1]);
    }

    // البحث عن أجزاء fetch في الصفحة
    const fetchMatches = [];

    const fetchRegex =
      /fetch\s*\([\s\S]{0,1000}?\)/gi;

    while ((match = fetchRegex.exec(html)) !== null) {
      fetchMatches.push(match[0]);
    }

    // البحث عن المسارات المحتملة للـAPI
    const apiPaths = [];

    const pathRegex =
      /["'`](\/[^"'`\s]{1,200}(?:api|json|php|ajax|token|source|stream|player)[^"'`\s]{0,200})["'`]/gi;

    while ((match = pathRegex.exec(html)) !== null) {
      if (!apiPaths.includes(match[1])) {
        apiPaths.push(match[1]);
      }
    }

    // كلمات مهمة
    const interestingStrings = [];

    const keywords = [
      'fetch(',
      'token',
      'gate',
      'source',
      'sources',
      'stream',
      'player',
      'api',
      'json',
      'ajax',
      'manifest',
      'm3u8',
      'mp4',
      'iframe',
      'postMessage'
    ];

    for (const word of keywords) {
      if (
        html.toLowerCase().includes(word.toLowerCase())
      ) {
        interestingStrings.push(word);
      }
    }

    // تحميل ملفات JS المرتبطة بالصفحة
    const jsResults = [];

    for (const script of scripts.slice(0, 10)) {
      let scriptUrl;

      try {
        scriptUrl = new URL(
          script,
          targetUrl
        ).href;
      } catch {
        continue;
      }

      try {
        const js = await axios.get(
          'https://api.scraperapi.com',
          {
            params: {
              api_key: SCRAPER_API_KEY,
              url: scriptUrl
            },
            timeout: 60000,
            validateStatus: () => true
          }
        );

        const code =
          typeof js.data === 'string'
            ? js.data
            : JSON.stringify(js.data);

        const lower = code.toLowerCase();

        const jsFetches = [];

        const jsFetchRegex =
          /fetch\s*\([\s\S]{0,1000}?\)/gi;

        let fm;

        while (
          (fm = jsFetchRegex.exec(code)) !== null
        ) {
          jsFetches.push(
            fm[0].substring(0, 1500)
          );
        }

        const jsUrls = [];

        const urlRegex =
          /https?:\/\/[^\s"'`<>\\]+/gi;

        let um;

        while (
          (um = urlRegex.exec(code)) !== null
        ) {
          const u = um[0].replace(
            /[),;]+$/g,
            ''
          );

          if (!jsUrls.includes(u)) {
            jsUrls.push(u);
          }
        }

        jsResults.push({
          script_url: scriptUrl,

          status: js.status,

          size: code.length,

          contains_fetch:
            lower.includes('fetch('),

          contains_token:
            lower.includes('token'),

          contains_source:
            lower.includes('source'),

          contains_stream:
            lower.includes('stream'),

          contains_m3u8:
            lower.includes('m3u8'),

          contains_mp4:
            lower.includes('.mp4'),

          fetch_calls: jsFetches.slice(0, 20),

          external_urls:
            jsUrls.slice(0, 50),

          preview:
            code.substring(0, 2000)
        });

      } catch (error) {
        jsResults.push({
          script_url: scriptUrl,
          error: error.message
        });
      }
    }

    return res.json({
      success: true,

      stage: 'javascript_inspection',

      target_url: targetUrl,

      page_status: page.status,

      page_size: html.length,

      page_response_time_ms:
        Date.now() - startedAt,

      script_count: scripts.length,

      script_urls: scripts,

      fetch_calls:
        fetchMatches.slice(0, 20),

      possible_api_paths:
        apiPaths.slice(0, 50),

      interesting_strings:
        interestingStrings,

      javascript_files:
        jsResults,

      next_step:
        'نحتاج الآن فحص fetch_calls و possible_api_paths وملفات JavaScript لمعرفة واجهة الاتصال الرسمية التي يستخدمها المشغل.'
    });

  } catch (error) {
    return res.status(200).json({
      success: false,

      stage: 'javascript_inspection_error',

      error_code:
        error.code || null,

      error_message:
        error.message || null
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `StreamFlix Backend running on port ${PORT}`
  );
});

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
// INSPECT VSEMBED + JAVASCRIPT
// =====================================================

app.get('/api/inspect-js', async (req, res) => {
  const targetUrl =
    req.query.url || 'https://vsembed.ru/embed/movie/550/';

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
      success: false,
      stage: 'configuration',
      diagnosis: 'SCRAPER_API_KEY غير موجود في Render'
    });
  }

  const startedAt = Date.now();

  try {
    // -------------------------------------------------
    // 1. Get VSEmbed page
    // -------------------------------------------------

    const pageResponse = await axios.get(
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
      typeof pageResponse.data === 'string'
        ? pageResponse.data
        : JSON.stringify(pageResponse.data);

    // -------------------------------------------------
    // 2. Find script files
    // -------------------------------------------------

    const scriptUrls = [
      ...html.matchAll(
        /<script[^>]+src\s*=\s*["']([^"']+)["']/gi
      )
    ].map(match => match[1]);

    const absoluteScriptUrls = scriptUrls.map(src => {
      try {
        return new URL(src, targetUrl).href;
      } catch {
        return src;
      }
    });

    const unique = array => [...new Set(array)];

    const scripts = [];

    // -------------------------------------------------
    // 3. Download each JavaScript file through
    //    ScraperAPI
    // -------------------------------------------------

    for (const scriptUrl of unique(absoluteScriptUrls)) {
      try {
        const scriptResponse = await axios.get(
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

        const scriptBody =
          typeof scriptResponse.data === 'string'
            ? scriptResponse.data
            : JSON.stringify(scriptResponse.data);

        // -------------------------------------------------
        // Search URLs inside JS
        // -------------------------------------------------

        const urls = [
          ...scriptBody.matchAll(
            /https?:\/\/[^\s"'`<>\\]+/gi
          )
        ].map(match => match[0]);

        const apiPaths = [
          ...scriptBody.matchAll(
            /["'`](\/[^"'`]{2,300})["'`]/g
          )
        ].map(match => match[1]);

        const videoReferences = [
          ...scriptBody.matchAll(
            /[^\s"'`<>\\]{0,200}\.(?:m3u8|mp4|mkv|mpd)[^\s"'`<>\\]*/gi
          )
        ].map(match => match[0]);

        const interestingStrings = [
          ...scriptBody.matchAll(
            /["'`](.{0,200}(?:iframe|player|video|source|stream|embed|ajax|fetch|axios|m3u8|mp4|playlist).{0,300})["'`]/gi
          )
        ].map(match => match[1]);

        scripts.push({
          url: scriptUrl,

          status: scriptResponse.status,

          content_type:
            scriptResponse.headers['content-type'] || null,

          size: scriptBody.length,

          external_urls: unique(urls).slice(0, 100),

          api_paths: unique(apiPaths).slice(0, 100),

          video_references:
            unique(videoReferences).slice(0, 100),

          interesting_strings:
            unique(interestingStrings).slice(0, 100),

          preview: scriptBody.substring(0, 2000)
        });

      } catch (scriptError) {
        scripts.push({
          url: scriptUrl,

          error_code:
            scriptError.code || null,

          error_message:
            scriptError.message || null
        });
      }
    }

    // -------------------------------------------------
    // 4. Search the HTML itself for important
    //    JavaScript keywords
    // -------------------------------------------------

    const htmlMatches = [
      ...html.matchAll(
        /.{0,150}(?:iframe|player|video|source|stream|embed|fetch|axios|ajax|m3u8|mp4|playlist).{0,300}/gi
      )
    ].map(match => match[0]);

    return res.json({
      success: pageResponse.status >= 200 &&
        pageResponse.status < 300,

      stage: 'javascript_inspection',

      target_url: targetUrl,

      page_status: pageResponse.status,

      page_size: html.length,

      page_response_time_ms:
        Date.now() - startedAt,

      script_count:
        unique(absoluteScriptUrls).length,

      script_urls:
        unique(absoluteScriptUrls),

      html_interesting_matches:
        unique(htmlMatches).slice(0, 100),

      scripts
    });

  } catch (error) {
    return res.status(200).json({
      success: false,

      stage: 'javascript_inspection_connection',

      diagnosis:
        'فشل أثناء فحص JavaScript عبر ScraperAPI',

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

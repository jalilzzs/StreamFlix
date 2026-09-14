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
// DIAGNOSE VSEMBED INTERNAL LINKS
// =====================================================

app.get('/api/inspect', async (req, res) => {
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
    const response = await axios.get('https://api.scraperapi.com', {
      params: {
        api_key: SCRAPER_API_KEY,
        url: targetUrl
      },
      timeout: 60000,
      validateStatus: () => true
    });

    const elapsed = Date.now() - startedAt;

    const html =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    // -------------------------------------------------
    // Extract URLs
    // -------------------------------------------------

    const absoluteUrls = [
      ...html.matchAll(
        /https?:\/\/[^\s"'<>\\]+/gi
      )
    ].map(match => match[0]);

    const iframeUrls = [
      ...html.matchAll(
        /<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi
      )
    ].map(match => match[1]);

    const scriptUrls = [
      ...html.matchAll(
        /<script[^>]+src\s*=\s*["']([^"']+)["']/gi
      )
    ].map(match => match[1]);

    const m3u8Urls = [
      ...html.matchAll(
        /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi
      )
    ].map(match => match[0]);

    const mp4Urls = [
      ...html.matchAll(
        /https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/gi
      )
    ].map(match => match[0]);

    const playerUrls = absoluteUrls.filter(url =>
      /player|embed|stream|video|source|file|m3u8|mp4/i.test(url)
    );

    // Remove duplicates
    const unique = array => [...new Set(array)];

    return res.json({
      success: response.status >= 200 && response.status < 300,

      stage: 'vsembed_inspection',

      target_url: targetUrl,

      scraper_status: response.status,

      response_time_ms: elapsed,

      content_type:
        response.headers['content-type'] || null,

      response_size: html.length,

      has_iframe: iframeUrls.length > 0,

      has_scripts: scriptUrls.length > 0,

      has_m3u8: m3u8Urls.length > 0,

      has_mp4: mp4Urls.length > 0,

      iframe_urls: unique(iframeUrls),

      script_urls: unique(scriptUrls),

      m3u8_urls: unique(m3u8Urls),

      mp4_urls: unique(mp4Urls),

      player_related_urls: unique(playerUrls),

      all_external_urls: unique(absoluteUrls),

      preview: html.substring(0, 3000)
    });

  } catch (error) {
    return res.status(200).json({
      success: false,

      stage: 'inspection_connection',

      diagnosis: 'فشل جلب الصفحة عبر ScraperAPI',

      error_code: error.code || null,

      error_message: error.message || null,

      response_time_ms: Date.now() - startedAt
    });
  }
});

// =====================================================
// SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`StreamFlix Backend running on port ${PORT}`);
});

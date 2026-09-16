const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const VS_SRC_URL = "https://vsembed.ru/vs_src.php?type=movie&id=550";

/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

function scraperUrl(target) {
  const params = new URLSearchParams({
    api_key: SCRAPER_API_KEY,
    url: target
  });

  return `https://api.scraperapi.com/?${params.toString()}`;
}

function getContexts(text, keyword, radius = 2500) {
  const results = [];
  const lower = text.toLowerCase();
  const key = keyword.toLowerCase();

  let position = 0;

  while (true) {
    const index = lower.indexOf(key, position);

    if (index === -1) break;

    const start = Math.max(0, index - radius);
    const end = Math.min(
      text.length,
      index + key.length + radius
    );

    results.push({
      keyword,
      position: index,
      context: text.slice(start, end)
    });

    position = index + key.length;

    if (results.length >= 5) break;
  }

  return results;
}

function extractUrls(text) {
  const matches =
    text.match(
      /https?:\/\/[^"'`\s<>\\]+|\/[A-Za-z0-9._~:/?#$@!$&'()*+,;=%-]+/g
    ) || [];

  return [...new Set(matches)].slice(0, 300);
}

function preview(text, length = 4000) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, length);
}

async function getFreshPlayerUrl() {
  const response = await axios.get(
    scraperUrl(VS_SRC_URL),
    {
      timeout: 20000,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_16 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json,text/plain,*/*"
      }
    }
  );

  let data = response.data;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return {
        success: false,
        status: response.status,
        error: "vs_src did not return valid JSON",
        raw: preview(data, 2000)
      };
    }
  }

  if (!data || !data.src) {
    return {
      success: false,
      status: response.status,
      error: "No player src returned",
      data
    };
  }

  return {
    success: true,
    status: response.status,
    src: data.src
  };
}

/* =========================================================
   ROUTES
   ========================================================= */

app.get("/", (req, res) => {
  res.json({
    online: true,
    service: "StreamFlix diagnostic & Torrent API",
    stage: "active",
    endpoints: {
      find_player: "/api/find-player-code",
      piratebay_search: "/api/piratebay?q=Inception"
    }
  });
});

// ==========================================
// PIRATE BAY ENGINE ENDPOINT
// ==========================================
app.get("/api/piratebay", async (req, res) => {
  const { q, type, season, episode } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      error: "Query parameter 'q' is required"
    });
  }

  // بناء كلمة البحث تلقائياً (مثلاً: Movie Name S01E05)
  let searchQuery = q;
  if (type === "tv" && season && episode) {
    const s = String(season).padStart(2, "0");
    const e = String(episode).padStart(2, "0");
    searchQuery = `${q} S${s}E${e}`;
  }

  try {
    // استخدام PirateBay APi العادية / Proxy للحصول على النتائج بشكل JSON مباشر
    const apirUrl = `https://apibay.org/q.php?q=${encodeURIComponent(searchQuery)}`;

    const response = await axios.get(apirUrl, {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    const results = response.data;

    if (!Array.isArray(results) || results.length === 0 || results[0].id === "0") {
      return res.status(444).json({
        success: false,
        message: "No torrents found for this content",
        query: searchQuery
      });
    }

    // تنسيق واستخراج الروابط والمعلومات المهمة
    const torrents = results.slice(0, 15).map((item) => {
      // بناء رابط الـ Magnet Link المباشر
      const magnetLink = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`;

      return {
        id: item.id,
        name: item.name,
        info_hash: item.info_hash,
        seeders: Number(item.seeders),
        leechers: Number(item.leechers),
        size_bytes: Number(item.size),
        magnet: magnetLink,
        // يمكنك إرسال الـ Magnet لمشغل Torrent Web المفضل لديك
        stream_url: `https://webtor.io/show?magnet=${encodeURIComponent(magnetLink)}`
      };
    });

    return res.json({
      success: true,
      query: searchQuery,
      total_found: torrents.length,
      torrents
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch from Pirate Bay engine",
      details: error.message
    });
  }
});

// ==========================================
// DIAGNOSTIC ENDPOINT
// ==========================================
app.get("/api/find-player-code", async (req, res) => {
  const started = Date.now();

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "SCRAPER_API_KEY is missing"
    });
  }

  try {
    const player = await getFreshPlayerUrl();

    if (!player.success) {
      return res.status(502).json({
        success: false,
        stage: "vs_src",
        target_url: VS_SRC_URL,
        scraper_status: player.status,
        error: player.error,
        data: player.data || null,
        raw: player.raw || null,
        total_time_ms: Date.now() - started
      });
    }

    const PAGE_URL = player.src;

    const response = await axios.get(
      scraperUrl(PAGE_URL),
      {
        timeout: 20000,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_16 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      }
    );

    const html =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);

    const keywords = [
      "vs_src",
      "fetch(",
      "fetch (",
      "axios",
      "XMLHttpRequest",
      "source",
      "video",
      "player",
      "iframe",
      "m3u8",
      "mp4",
      "media",
      "api",
      "playlist",
      "file",
      "src"
    ];

    const contexts = {};

    for (const keyword of keywords) {
      contexts[keyword] = getContexts(
        html,
        keyword
      );
    }

    return res.json({
      success:
        response.status >= 200 &&
        response.status < 400,

      stage: "player_code_context",

      vs_src_url: VS_SRC_URL,

      fresh_player_url: PAGE_URL,

      scraper_status: response.status,

      response_size: html.length,

      total_time_ms:
        Date.now() - started,

      url_candidates:
        extractUrls(html),

      contexts,

      html_preview:
        preview(html, 4000)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,

      stage: "player_code_context",

      error: error.message,

      total_time_ms:
        Date.now() - started
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `StreamFlix server & PirateBay engine running on port ${PORT}`
  );
});

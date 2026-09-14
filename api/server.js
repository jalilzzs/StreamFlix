const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const VS_SRC_URL = "https://vsembed.ru/vs_src.php?type=movie&id=550";

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

app.get("/", (req, res) => {
  res.json({
    online: true,
    service: "StreamFlix diagnostic API",
    stage: "vs_src_dynamic",
    test_endpoint: "/api/find-player-code"
  });
});

app.get("/api/find-player-code", async (req, res) => {
  const started = Date.now();

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "SCRAPER_API_KEY is missing"
    });
  }

  try {
    // ==========================================
    // STEP 1
    // Get a fresh player URL from vsembed
    // ==========================================

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

    // ==========================================
    // STEP 2
    // Fetch the fresh player page
    // ==========================================

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

    // ==========================================
    // STEP 3
    // Search for player/source code
    // ==========================================

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

    // ==========================================
    // STEP 4
    // Return diagnostic result
    // ==========================================

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
    `StreamFlix player-code diagnostic running on port ${PORT}`
  );
});

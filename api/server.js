const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const PAGE_URL = "https://vsembed.ru/embed/movie/920/";

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
    const end = Math.min(text.length, index + key.length + radius);

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
  const matches = text.match(
    /https?:\/\/[^"'`\s<>\\]+|\/[A-Za-z0-9._~:/?#$begin:math:display$$end:math:display$@!$&'()*+,;=%-]+/g
  ) || [];

  return [...new Set(matches)].slice(0, 300);
}

function preview(text, length = 3000) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, length);
}

app.get("/", (req, res) => {
  res.json({
    online: true,
    service: "StreamFlix diagnostic API",
    target: PAGE_URL,
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
    const response = await axios.get(
      scraperUrl(PAGE_URL),
      {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1"
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
      "api"
    ];

    const contexts = {};

    for (const keyword of keywords) {
      contexts[keyword] = getContexts(html, keyword);
    }

    return res.json({
      success: response.status >= 200 && response.status < 400,

      stage: "player_code_context",

      target_url: PAGE_URL,

      scraper_status: response.status,

      response_size: html.length,

      total_time_ms: Date.now() - started,

      url_candidates: extractUrls(html),

      contexts,

      html_preview: preview(html, 4000)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      stage: "player_code_context",
      error: error.message,
      total_time_ms: Date.now() - started
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `StreamFlix player-code diagnostic running on port ${PORT}`
  );
});

const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const PAGE_URL = "https://vsembed.ru/embed/movie/920/";
const JS_URL =
  "https://vsembed.ru/assets/sbx.js?v=1786671805";

function scraperUrl(target) {
  const params = new URLSearchParams({
    api_key: SCRAPER_API_KEY,
    url: target
  });

  return `https://api.scraperapi.com/?${params.toString()}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractCandidates(text) {
  const results = [];

  const patterns = [
    /https?:\/\/[^"'`\s<>]+/gi,

    /["'`](\/[^"'`\s<>]{2,})["'`]/g,

    /["'`]([^"'`\s<>]*(?:\/api\/|\/ajax\/|\/source\/|\/player\/|\/embed\/|\/stream\/|\/media\/|\/rcp\/|\/generate)[^"'`\s<>]*)["'`]/gi,

    /(?:fetch|axios\.(?:get|post)|XMLHttpRequest)[^;\n]{0,500}/gi
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(text)) !== null) {
      let value = match[1] || match[0];

      if (!value) continue;

      value = value
        .replace(/\\u002F/g, "/")
        .replace(/\\\//g, "/")
        .replace(/&amp;/g, "&");

      results.push(value);
    }
  }

  return unique(results).slice(0, 300);
}

function extractImportantWords(text) {
  const words = [
    "fetch",
    "axios",
    "XMLHttpRequest",
    "WebSocket",
    "vs_src",
    "source",
    "player",
    "embed",
    "stream",
    "media",
    "api",
    "ajax",
    "rcp",
    "generate"
  ];

  return words.filter(word =>
    text.toLowerCase().includes(word.toLowerCase())
  );
}

function preview(text, length = 6000) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, length);
}

app.get("/", (req, res) => {
  res.json({
    online: true,
    service: "StreamFlix endpoint diagnostic",
    page: PAGE_URL,
    javascript: JS_URL,
    test_endpoint: "/api/analyze-player"
  });
});

app.get("/api/analyze-player", async (req, res) => {
  const started = Date.now();

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "SCRAPER_API_KEY is missing"
    });
  }

  try {
    const pageResponse = await axios.get(
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

    const pageHtml =
      typeof pageResponse.data === "string"
        ? pageResponse.data
        : JSON.stringify(pageResponse.data);

    const jsResponse = await axios.get(
      scraperUrl(JS_URL),
      {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1"
        }
      }
    );

    const jsText =
      typeof jsResponse.data === "string"
        ? jsResponse.data
        : JSON.stringify(jsResponse.data);

    const combined = pageHtml + "\n" + jsText;

    return res.json({
      success: true,

      stage: "player_endpoint_analysis",

      total_time_ms: Date.now() - started,

      page: {
        url: PAGE_URL,
        status: pageResponse.status,
        size: pageHtml.length
      },

      javascript: {
        url: JS_URL,
        status: jsResponse.status,
        content_type:
          jsResponse.headers["content-type"] || null,
        size: jsText.length
      },

      important_terms: extractImportantWords(combined),

      endpoint_candidates:
        extractCandidates(combined),

      page_preview:
        preview(pageHtml, 3000),

      javascript_preview:
        preview(jsText, 8000)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      stage: "player_endpoint_analysis",
      error: error.message,
      total_time_ms: Date.now() - started
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `StreamFlix endpoint diagnostic running on port ${PORT}`
  );
});

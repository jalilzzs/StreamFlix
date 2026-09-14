const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const TARGET_URL = "https://vidsrc.to/embed/movie/920";

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

function absoluteUrl(value) {
  if (!value) return null;

  try {
    return new URL(value, TARGET_URL).href;
  } catch {
    return value;
  }
}

function extract(html, tag, attribute) {
  const results = [];

  const regex = new RegExp(
    `<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["']`,
    "gi"
  );

  let match;

  while ((match = regex.exec(html)) !== null) {
    results.push(absoluteUrl(match[1]));
  }

  return unique(results);
}

function extractEndpoints(html) {
  const results = [];

  const patterns = [
    /https?:\/\/[^"'`\s<>]+/gi,
    /["'`](\/[^"'`\s<>]{2,})["'`]/g,
    /["'`]([^"'`\s<>]*(?:\/api\/|\/ajax\/|\/source\/|\/player\/|\/embed\/|\/stream\/|\/media\/)[^"'`\s<>]*)["'`]/gi
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(html)) !== null) {
      let value = match[1];

      if (!value) continue;

      value = value
        .replace(/\\u002F/g, "/")
        .replace(/\\\//g, "/")
        .replace(/&amp;/g, "&");

      results.push(value);
    }
  }

  return unique(results).slice(0, 200);
}

function preview(text, length = 5000) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, length);
}

app.get("/", (req, res) => {
  res.json({
    online: true,
    service: "StreamFlix diagnostic API",
    target: TARGET_URL,
    test_endpoint: "/api/inspect-920"
  });
});

app.get("/api/inspect-920", async (req, res) => {
  const started = Date.now();

  if (!SCRAPER_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "SCRAPER_API_KEY is missing"
    });
  }

  try {
    const response = await axios.get(
      scraperUrl(TARGET_URL),
      {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      }
    );

    const html =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);

    const scripts = extract(html, "script", "src");
    const iframes = extract(html, "iframe", "src");
    const forms = extract(html, "form", "action");

    const endpoints = extractEndpoints(html);

    const titleMatch = html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    return res.json({
      success: response.status >= 200 && response.status < 400,

      stage: "vidsrc_static_inspection",

      target_url: TARGET_URL,

      scraper_status: response.status,

      content_type:
        response.headers["content-type"] || null,

      response_size: html.length,

      total_time_ms: Date.now() - started,

      title: titleMatch
        ? titleMatch[1].replace(/\s+/g, " ").trim()
        : null,

      scripts,

      iframes,

      forms,

      endpoint_candidates: endpoints,

      preview: preview(html)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      stage: "vidsrc_static_inspection",
      error: error.message,
      total_time_ms: Date.now() - started
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `StreamFlix diagnostic API running on port ${PORT}`
  );
});

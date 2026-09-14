const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

const TARGET_URL = "https://vidsrc.to/embed/movie/920";

function scraperUrl(target, extra = {}) {
  const params = new URLSearchParams({
    api_key: SCRAPER_API_KEY,
    url: target,
    ...extra
  });

  return `https://api.scraperapi.com/?${params.toString()}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function absoluteUrl(value, base = TARGET_URL) {
  if (!value) return null;

  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

function extractAttribute(html, tag, attribute) {
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

      if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("/") ||
        value.includes("/api/") ||
        value.includes("/ajax/") ||
        value.includes("/source/") ||
        value.includes("/player/") ||
        value.includes("/embed/") ||
        value.includes("/stream/") ||
        value.includes("/media/")
      ) {
        results.push(value);
      }
    }
  }

  return unique(results).slice(0, 200);
}

function extractDataAttributes(html) {
  const results = [];

  const regex = /\bdata-([a-zA-Z0-9_-]+)\s*=\s*["']([^"']+)["']/g;

  let match;

  while ((match = regex.exec(html)) !== null) {
    results.push({
      name: `data-${match[1]}`,
      value: match[2]
    });
  }

  return results.slice(0, 200);
}

function makePreview(text, length = 4000) {
  if (!text) return "";

  return text
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
      scraperUrl(TARGET_URL, {
        render: "true"
      }),
      {
        timeout: 30000,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1"
        }
      }
    );

    const html =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);

    const scripts = extractAttribute(html, "script", "src");
    const iframes = extractAttribute(html, "iframe", "src");
    const forms = extractAttribute(html, "form", "action");
    const links = extractAttribute(html, "a", "href");

    const endpointCandidates = extractEndpoints(html);
    const dataAttributes = extractDataAttributes(html);

    const scriptDetails = [];

    for (const scriptUrl of scripts.slice(0, 20)) {
      try {
        const scriptResponse = await axios.get(
          scraperUrl(scriptUrl),
          {
            timeout: 15000,
            validateStatus: () => true,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
            }
          }
        );

        const scriptBody =
          typeof scriptResponse.data === "string"
            ? scriptResponse.data
            : JSON.stringify(scriptResponse.data);

        scriptDetails.push({
          url: scriptUrl,
          status: scriptResponse.status,
          content_type:
            scriptResponse.headers["content-type"] || null,
          size: scriptBody.length,
          endpoint_candidates:
            extractEndpoints(scriptBody).slice(0, 100),
          preview: makePreview(scriptBody, 1500)
        });
      } catch (error) {
        scriptDetails.push({
          url: scriptUrl,
          error: error.message
        });
      }
    }

    return res.json({
      success: response.status >= 200 && response.status < 400,
      stage: "vidsrc_endpoint_inspection",
      target_url: TARGET_URL,
      scraper_status: response.status,
      content_type: response.headers["content-type"] || null,
      response_size: html.length,
      total_time_ms: Date.now() - started,

      page: {
        title:
          (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]
            ?.replace(/\s+/g, " ")
            .trim() || null,
        scripts,
        iframes,
        forms,
        links: links.slice(0, 100),
        data_attributes: dataAttributes
      },

      endpoint_candidates: endpointCandidates,

      scripts_inspected: scriptDetails,

      preview: makePreview(html, 5000)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      stage: "vidsrc_endpoint_inspection",
      error: error.message,
      total_time_ms: Date.now() - started
    });
  }
});

app.listen(PORT, () => {
  console.log(`StreamFlix diagnostic API running on port ${PORT}`);
});

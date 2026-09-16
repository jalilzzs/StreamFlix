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
    // استخدام PirateBay API للحصول على النتائج بشكل JSON مباشر
    const apirUrl = `https://apibay.org/q.php?q=${encodeURIComponent(searchQuery)}`;

    const response = await axios.get(apirUrl, {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    const results = response.data;

    if (!Array.isArray(results) || results.length === 0 || results[0].id === "0") {
      return res.status(404).json({
        success: false,
        message: "No torrents found for this content",
        query: searchQuery
      });
    }

    // تنسيق النتائج وفرزها
    const torrents = results.slice(0, 15).map((item) => {
      const magnetLink = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`;

      return {
        id: item.id,
        name: item.name,
        info_hash: item.info_hash,
        seeders: Number(item.seeders),
        leechers: Number(item.leechers),
        size_bytes: Number(item.size),
        magnet: magnetLink,
        stream_url: `https://webtor.io/show?magnet=${encodeURIComponent(magnetLink)}`
      };
    });

    // التوجيه المباشر للمشغل عند فتح الرابط داخل iframe
    const bestTorrent = torrents[0];
    
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      return res.redirect(bestTorrent.stream_url);
    }

    return res.json({
      success: true,
      query: searchQuery,
      stream_url: bestTorrent.stream_url,
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

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';
const TMDB_READ_ACCESS_TOKEN = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN;

const STREAMSRC_BASE_URL = 'https://streamsrc.cc';
const STELLAR_BASE_URL = 'https://stellar.rip/en/watch/embed';

const PLACEHOLDER_POSTER =
  'https://via.placeholder.com/342x513?text=No+Poster';

const WILAYAS = [
  'Alger',
  'Oran',
  'Constantine',
  'Annaba',
  'Blida',
  'Batna',
  'Sétif',
  'Tlemcen',
  'Béjaïa',
  'Tizi Ouzou',
  'Djelfa',
  'Biskra',
  'Chlef',
  'Médéa',
  'Mostaganem',
  'Boumerdès',
  'Tiaret',
  'Tébessa',
  'Jijel',
  'Skikda',
  'El Oued',
  'Khenchela',
  'Mila',
  'Guelma',
  'Mascara',
  'Relizane',
  'Saïda',
  'Souk Ahras',
  'Tipaza',
  'Aïn Témouchent',
  'Adrar',
  'Bechar',
  'Laghouat',
  'Ouargla',
  'Ghardaïa',
  'Tindouf',
  'Illizi',
  'Tamanrasset',
  'Bordj Bou Arréridj',
  'Bouira',
  'Aïn Defla',
  'Oum El Bouaghi',
  'M’Sila',
  'Tissemsilt',
  'El Bayadh',
  'Naâma',
  'Bordj Badji Mokhtar',
  'Béni Abbès',
  'Timimoun',
  'Touggourt',
  'Djanet',
  'In Salah',
  'In Guezzam',
  'El Meniaa',
  'Ouled Djellal',
];

const getPosterUrl = (posterPath) => {
  if (!posterPath) return PLACEHOLDER_POSTER;

  if (posterPath.startsWith('http')) {
    return posterPath;
  }

  return `${TMDB_IMAGE}/w500${posterPath}`;
};

/* =========================================================
   STELLAR — SERVER 1
   ========================================================= */

const getStellarMovieUrl = (tmdbId) => {
  if (!tmdbId) return null;

  return `${STELLAR_BASE_URL}/movie/${encodeURIComponent(
    String(tmdbId)
  )}`;
};

const getStellarEpisodeUrl = (tmdbId, season, episode) => {
  if (!tmdbId || season == null || episode == null) return null;

  return `${STELLAR_BASE_URL}/tv/${encodeURIComponent(
    String(tmdbId)
  )}-${Number(season)}-${Number(episode)}`;
};

/* =========================================================
   STREAMSRC — SERVER 2
   ========================================================= */

const getStreamSrcMovieUrl = (tmdbId) => {
  if (!tmdbId) return null;

  return `${STREAMSRC_BASE_URL}/watch/movie/tmdbid=${encodeURIComponent(
    String(tmdbId)
  )}`;
};

const getStreamSrcSeriesUrl = (tmdbId) => {
  if (!tmdbId) return null;

  return `${STREAMSRC_BASE_URL}/watch/series/tmdbid=${encodeURIComponent(
    String(tmdbId)
  )}`;
};

const fetchStreamSrcJson = async (tmdbId) => {
  if (!tmdbId) return null;

  const url = `${STREAMSRC_BASE_URL}/tmdb=${encodeURIComponent(
    String(tmdbId)
  )}&json=1`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `StreamSrc HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('StreamSrc لم يرجع JSON');
  }

  return response.json();
};

const extractSourceUrls = (payload, results = []) => {
  if (!payload || results.length >= 20) {
    return results;
  }

  if (typeof payload === 'string') {
    if (
      /^https?:\/\//i.test(payload) &&
      !results.includes(payload)
    ) {
      results.push(payload);
    }

    return results;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      extractSourceUrls(item, results);

      if (results.length >= 20) break;
    }

    return results;
  }

  if (typeof payload === 'object') {
    const possibleKeys = [
      'url',
      'stream_url',
      'streamUrl',
      'file',
      'src',
      'source',
      'embed',
      'embed_url',
      'embedUrl',
      'link',
    ];

    for (const key of possibleKeys) {
      const value = payload[key];

      if (typeof value === 'string') {
        if (
          /^https?:\/\//i.test(value) &&
          !results.includes(value)
        ) {
          results.push(value);
        }
      }
    }

    for (const value of Object.values(payload)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        results.length < 20
      ) {
        extractSourceUrls(value, results);
      }

      if (results.length >= 20) break;
    }
  }

  return results;
};

/* =========================================================
   TMDB
   ========================================================= */

const tmdbFetch = async (path) => {
  if (!TMDB_READ_ACCESS_TOKEN) {
    throw new Error(
      'VITE_TMDB_READ_ACCESS_TOKEN غير موجود في Environment Variables'
    );
  }

  const response = await fetch(
    `${TMDB_BASE_URL}${path}`,
    {
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    let message = `TMDB HTTP ${response.status}`;

    try {
      const errorData = await response.json();

      if (errorData?.status_message) {
        message = errorData.status_message;
      }
    } catch {
      // ignore
    }

    throw new Error(message);
  }

  return response.json();
};

/* =========================================================
   FORMATTERS
   ========================================================= */

const formatMovie = (item) => ({
  tmdb_id: String(item.id),
  type: 'movie',
  name: item.title || item.original_title || 'Sans titre',
  synopsis: item.overview || '',
  poster_url: getPosterUrl(item.poster_path),
  release_year: item.release_date
    ? Number(String(item.release_date).slice(0, 4))
    : null,
  rating_avg:
    typeof item.vote_average === 'number'
      ? item.vote_average
      : 0,
  is_premium: false,
  url: getStellarMovieUrl(item.id),
});

const formatSeries = (item) => ({
  tmdb_id: String(item.id),
  type: 'series',
  name:
    item.name ||
    item.original_name ||
    'Sans titre',
  synopsis: item.overview || '',
  poster_url: getPosterUrl(item.poster_path),
  release_year: item.first_air_date
    ? Number(String(item.first_air_date).slice(0, 4))
    : null,
  rating_avg:
    typeof item.vote_average === 'number'
      ? item.vote_average
      : 0,
  is_premium: false,
  url: getStellarEpisodeUrl(item.id, 1, 1),
});

/* =========================================================
   DATABASE
   ========================================================= */

const findExistingTitle = async (tmdbId) => {
  const { data, error } = await supabase
    .from('titles')
    .select('id,tmdb_id,url,type,name')
    .eq('tmdb_id', String(tmdbId))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

/*
 * مهم:
 * إذا العنوان موجود:
 * UPDATE للمعلومات فقط.
 *
 * الـ URL القديم ما نبدلوهش إذا كان موجود.
 * إذا كان ناقص، نعطيه Stellar.
 */
const saveTitle = async (item) => {
  const existing = await findExistingTitle(item.tmdb_id);

  if (existing) {
    const updatePayload = {
      type: item.type,
      name: item.name,
      synopsis: item.synopsis,
      poster_url: item.poster_url,
      release_year: item.release_year,
      rating_avg: item.rating_avg,
      is_premium: item.is_premium,
    };

    /*
     * إذا ماكانش URL قديم، نحط Stellar.
     * إذا كاين URL قديم، نحافظ عليه.
     */
    if (!existing.url && item.url) {
      updatePayload.url = item.url;
    }

    const { data, error } = await supabase
      .from('titles')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data,
      created: false,
      updated: true,
      id: existing.id,
    };
  }

  const insertPayload = {
    type: item.type,
    name: item.name,
    synopsis: item.synopsis,
    poster_url: item.poster_url,
    release_year: item.release_year,
    rating_avg: item.rating_avg,
    is_premium: item.is_premium,
    tmdb_id: String(item.tmdb_id),
    url: item.url || null,
  };

  const { data, error } = await supabase
    .from('titles')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    data,
    created: true,
    updated: false,
    id: data.id,
  };
};

const saveTitles = async (items) => {
  let created = 0;
  let updated = 0;

  for (const item of items) {
    try {
      const result = await saveTitle(item);

      if (result.created) {
        created++;
      }

      if (result.updated) {
        updated++;
      }
    } catch (error) {
      console.error(
        `Erreur import ${item.name}:`,
        error
      );
    }
  }

  return {
    created,
    updated,
  };
};

/* =========================================================
   EPISODES
   ========================================================= */

const importSeriesEpisodes = async (
  series,
  titleId,
  setStatus
) => {
  if (!series?.id || !titleId) {
    return {
      inserted: 0,
      seasons: 0,
    };
  }

  const details = await tmdbFetch(
    `/tv/${series.id}`
  );

  const seasons =
    Array.isArray(details?.seasons)
      ? details.seasons
      : [];

  const realSeasons = seasons.filter(
    (season) =>
      Number(season.season_number) >= 0
  );

  let insertedCount = 0;

  for (const season of realSeasons) {
    const seasonNumber = Number(
      season.season_number
    );

    if (!Number.isFinite(seasonNumber)) {
      continue;
    }

    /*
     * بعض السلاسل فيها season 0 (specials)
     * نقدر نستوردها أيضا.
     */
    let seasonDetails;

    try {
      seasonDetails = await tmdbFetch(
        `/tv/${series.id}/season/${seasonNumber}`
      );
    } catch (error) {
      console.warn(
        `تعذر جلب الموسم ${seasonNumber}:`,
        error
      );

      continue;
    }

    const episodes = Array.isArray(
      seasonDetails?.episodes
    )
      ? seasonDetails.episodes
      : [];

    if (!episodes.length) {
      continue;
    }

    /*
     * نحافظ على server1 القديم إذا كان موجود.
     */
    const { data: existingEpisodes, error: existingError } =
      await supabase
        .from('episodes')
        .select(
          'id,season,episode_number,stream_urls'
        )
        .eq('title_id', titleId)
        .eq('season', seasonNumber);

    if (existingError) {
      throw existingError;
    }

    const existingMap = new Map();

    for (const oldEpisode of existingEpisodes || []) {
      existingMap.set(
        Number(oldEpisode.episode_number),
        oldEpisode
      );
    }

    const episodeRows = episodes
      .map((episode) => {
        const episodeNumber = Number(
          episode.episode_number
        );

        if (!Number.isFinite(episodeNumber)) {
          return null;
        }

        const oldEpisode =
          existingMap.get(episodeNumber);

        const oldStreamUrls =
          oldEpisode?.stream_urls &&
          typeof oldEpisode.stream_urls === 'object'
            ? oldEpisode.stream_urls
            : {};

        const stellarUrl =
          getStellarEpisodeUrl(
            series.id,
            seasonNumber,
            episodeNumber
          );

        const streamSrcUrl =
          getStreamSrcSeriesUrl(series.id);

        /*
         * SERVER 1:
         * Stellar للحلقة بالضبط.
         *
         * SERVER 2:
         * StreamSrc للسلسلة.
         *
         * ما نمسحوش أي server آخر كان مخزن.
         */
        const streamUrls = {
          ...oldStreamUrls,
          server1:
            stellarUrl ||
            oldStreamUrls.server1 ||
            null,
          server2:
            streamSrcUrl ||
            oldStreamUrls.server2 ||
            null,
        };

        return {
          title_id: titleId,
          season: seasonNumber,
          episode_number: episodeNumber,
          name:
            episode.name ||
            `الحلقة ${episodeNumber}`,
          duration_seconds:
            typeof episode.runtime === 'number'
              ? episode.runtime * 60
              : null,
          stream_urls: streamUrls,
        };
      })
      .filter(Boolean);

    if (!episodeRows.length) {
      continue;
    }

    /*
     * نحذف حلقات هذا الموسم فقط ثم نعيد إدخالها
     * بالمعلومات الجديدة.
     *
     * هذا لا يمس title نفسه.
     */
    const { error: deleteError } = await supabase
      .from('episodes')
      .delete()
      .eq('title_id', titleId)
      .eq('season', seasonNumber);

    if (deleteError) {
      throw deleteError;
    }

    /*
     * الإدخال على دفعات.
     */
    const batchSize = 50;

    for (
      let index = 0;
      index < episodeRows.length;
      index += batchSize
    ) {
      const batch = episodeRows.slice(
        index,
        index + batchSize
      );

      const { error: insertError } =
        await supabase
          .from('episodes')
          .insert(batch);

      if (insertError) {
        throw insertError;
      }

      insertedCount += batch.length;
    }

    if (setStatus) {
      setStatus(
        `📺 الموسم ${seasonNumber}: تم استيراد ${episodeRows.length} حلقة`
      );
    }
  }

  return {
    inserted: insertedCount,
    seasons: realSeasons.length,
  };
};

/* =========================================================
   STREAMSRC CHECK
   ========================================================= */

const fetchSourcesForTitle = async (tmdbId) => {
  try {
    const payload =
      await fetchStreamSrcJson(tmdbId);

    const urls =
      extractSourceUrls(payload);

    return {
      payload,
      urls,
      embedUrl:
        getStreamSrcMovieUrl(tmdbId),
    };
  } catch (error) {
    return {
      payload: null,
      urls: [],
      embedUrl:
        getStreamSrcMovieUrl(tmdbId),
      error,
    };
  }
};

/* =========================================================
   COMPONENT
   ========================================================= */

export default function Import() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);

  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] =
    useState(false);

  const [searchStatus, setSearchStatus] =
    useState(true);

  const [testStatus, setTestStatus] =
    useState(true);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [selectedType, setSelectedType] =
    useState('movie');

  const [page, setPage] = useState(1);

  const [stats, setStats] = useState({
    created: 0,
    updated: 0,
  });

  /* =====================================================
     SEARCH
     ===================================================== */

  const handleSearch = async (
    event
  ) => {
    event?.preventDefault();

    if (!query.trim()) {
      setError('اكتب اسم فيلم أو مسلسل');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('🔎 البحث في TMDB...');
    setMovies([]);

    try {
      const endpoint =
        selectedType === 'movie'
          ? `/search/movie?query=${encodeURIComponent(
              query.trim()
            )}&page=1&include_adult=false`
          : `/search/tv?query=${encodeURIComponent(
              query.trim()
            )}&page=1&include_adult=false`;

      const data = await tmdbFetch(endpoint);

      const results =
        Array.isArray(data?.results)
          ? data.results
          : [];

      const formatted =
        selectedType === 'movie'
          ? results.map(formatMovie)
          : results.map(formatSeries);

      setMovies(formatted);
      setStatus(
        `🔎 لقيت ${formatted.length} نتيجة`
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'حدث خطأ أثناء البحث'
      );

      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     IMPORT SINGLE
     ===================================================== */

  const importSingleItem = async (item) => {
    setError('');

    try {
      setStatus(
        `⏳ استيراد ${item.name}...`
      );

      /*
       * saveTitle يدير UPDATE إذا موجود،
       * INSERT إذا جديد.
       */
      const result =
        await saveTitle(item);

      let episodeInfo = null;

      /*
       * إذا Series:
       * نجيب الحلقات ونحط Stellar في server1
       * و StreamSrc في server2.
       */
      if (
        item.type === 'series' &&
        result.id
      ) {
        episodeInfo =
          await importSeriesEpisodes(
            item,
            result.id,
            setStatus
          );
      }

      /*
       * نتحقق من StreamSrc بدون ما نبدل
       * رابط Stellar في DB.
       */
      let streamSrcResult = null;

      try {
        streamSrcResult =
          await fetchSourcesForTitle(
            item.tmdb_id
          );
      } catch {
        // ignore
      }

      const sourceCount =
        streamSrcResult?.urls?.length || 0;

      setStatus(
        `${result.created ? '✅ تم إنشاء' : '🔄 تم تحديث'} ${
          item.name
        } — Stellar Server 1 جاهز${
          episodeInfo
            ? ` — ${episodeInfo.inserted} حلقة`
            : ''
        } — StreamSrc Server 2${
          sourceCount
            ? ` (${sourceCount} مصدر)`
            : ''
        }`
      );

      return result;
    } catch (err) {
      console.error(
        `Import error ${item.name}:`,
        err
      );

      setError(
        `${item.name}: ${
          err?.message ||
          'حدث خطأ أثناء الاستيراد'
        }`
      );

      throw err;
    }
  };

  /* =====================================================
     IMPORT ALL SEARCH RESULTS
     ===================================================== */

  const handleImportAll = async () => {
    if (!movies.length) {
      setError(
        'ماكان حتى نتيجة للاستيراد'
      );
      return;
    }

    setBulkLoading(true);
    setError('');

    let created = 0;
    let updated = 0;

    try {
      for (let i = 0; i < movies.length; i++) {
        const item = movies[i];

        setStatus(
          `📥 استيراد ${i + 1}/${movies.length}: ${item.name}`
        );

        try {
          const result =
            await importSingleItem(item);

          if (result.created) {
            created++;
          }

          if (result.updated) {
            updated++;
          }
        } catch (err) {
          console.error(
            `فشل استيراد ${item.name}`,
            err
          );
        }
      }

      setStats({
        created,
        updated,
      });

      setStatus(
        `✅ كمل الامبورت — جديد: ${created} — محدث: ${updated}`
      );
    } finally {
      setBulkLoading(false);
    }
  };

  /* =====================================================
     TRENDING
     ===================================================== */

  const handleTrending = async () => {
    setBulkLoading(true);
    setError('');
    setStatus(
      '🔥 جلب الأفلام والمسلسلات الرائجة...'
    );

    try {
      const movieData =
        await tmdbFetch(
          `/trending/movie/week`
        );

      const tvData =
        await tmdbFetch(
          `/trending/tv/week`
        );

      const formattedMovies =
        (movieData?.results || [])
          .map(formatMovie);

      const formattedSeries =
        (tvData?.results || [])
          .map(formatSeries);

      const allItems = [
        ...formattedMovies,
        ...formattedSeries,
      ];

      let created = 0;
      let updated = 0;

      for (
        let i = 0;
        i < allItems.length;
        i++
      ) {
        const item = allItems[i];

        setStatus(
          `🔥 Trending ${i + 1}/${allItems.length}: ${item.name}`
        );

        try {
          const result =
            await importSingleItem(item);

          if (result.created) {
            created++;
          }

          if (result.updated) {
            updated++;
          }
        } catch (err) {
          console.error(err);
        }
      }

      setStats({
        created,
        updated,
      });

      setMovies(allItems);

      setStatus(
        `🔥 Trending كمل — جديد: ${created} — محدث: ${updated}`
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'فشل جلب Trending'
      );
    } finally {
      setBulkLoading(false);
    }
  };

  /* =====================================================
     FETCH SINGLE SOURCE / TEST
     ===================================================== */

  const fetchSingleSource = async (
    item
  ) => {
    setTestStatus(true);
    setError('');

    try {
      setStatus(
        `🔗 اختبار مصادر ${item.name}...`
      );

      const result =
        await fetchSourcesForTitle(
          item.tmdb_id
        );

      const stellarUrl =
        item.type === 'movie'
          ? getStellarMovieUrl(
              item.tmdb_id
            )
          : getStellarEpisodeUrl(
              item.tmdb_id,
              1,
              1
            );

      const streamSrcUrl =
        item.type === 'movie'
          ? getStreamSrcMovieUrl(
              item.tmdb_id
            )
          : getStreamSrcSeriesUrl(
              item.tmdb_id
            );

      setStatus(
        `✅ ${item.name}\n` +
          `Server 1 — Stellar: ${stellarUrl}\n` +
          `Server 2 — StreamSrc: ${streamSrcUrl}\n` +
          `StreamSrc JSON sources: ${
            result.urls.length
          }`
      );

      return result;
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'فشل اختبار المصدر'
      );
    } finally {
      setTestStatus(false);
    }
  };

  /* =====================================================
     FETCH ALL SOURCES
     ===================================================== */

  const handleFetchAllSources =
    async () => {
      if (!movies.length) {
        setError(
          'ماكان حتى عنوان'
        );
        return;
      }

      setBulkLoading(true);
      setError('');

      let success = 0;
      let failed = 0;

      try {
        for (
          let i = 0;
          i < movies.length;
          i++
        ) {
          const item = movies[i];

          if (!item.tmdb_id) {
            continue;
          }

          setStatus(
            `🔗 فحص المصادر ${i + 1}/${movies.length}: ${item.name}`
          );

          try {
            await fetchSourcesForTitle(
              item.tmdb_id
            );

            success++;
          } catch {
            failed++;
          }
        }

        setStatus(
          `🔗 كمل فحص المصادر — ناجح: ${success} — فاشل: ${failed}`
        );
      } finally {
        setBulkLoading(false);
      }
    };

  /* =====================================================
     FIX URLS
     ===================================================== */

  const handleFixUrls = async () => {
    setBulkLoading(true);
    setError('');
    setStatus(
      '🛠️ إصلاح بيانات العناوين...'
    );

    try {
      const { data, error: fetchError } =
        await supabase
          .from('titles')
          .select(
            'id,type,name,poster_url,url,tmdb_id'
          );

      if (fetchError) {
        throw fetchError;
      }

      let fixed = 0;

      for (const title of data || []) {
        const update = {};

        if (
          title.type === 'tv'
        ) {
          update.type = 'series';
        }

        if (
          title.poster_url &&
          !title.poster_url.startsWith(
            'http'
          )
        ) {
          update.poster_url =
            getPosterUrl(
              title.poster_url
            );
        }

        /*
         * إذا ماعندوش URL:
         * نرجعو Stellar Server 1.
         *
         * إذا عندو URL قديم:
         * مانمسوهش.
         */
        if (
          !title.url &&
          title.tmdb_id
        ) {
          update.url =
            title.type === 'movie'
              ? getStellarMovieUrl(
                  title.tmdb_id
                )
              : getStellarEpisodeUrl(
                  title.tmdb_id,
                  1,
                  1
                );
        }

        if (Object.keys(update).length) {
          const { error } =
            await supabase
              .from('titles')
              .update(update)
              .eq('id', title.id);

          if (error) {
            console.error(
              `Fix error ${title.name}`,
              error
            );
          } else {
            fixed++;
          }
        }
      }

      setStatus(
        `🛠️ كمل الإصلاح — ${fixed} عنوان تم تعديله`
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          'فشل إصلاح الروابط'
      );
    } finally {
      setBulkLoading(false);
    }
  };

  /* =====================================================
     UI
     ===================================================== */

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <h1>
        Import StreamFlix
      </h1>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() =>
            setSelectedType('movie')
          }
          disabled={bulkLoading}
        >
          🎬 أفلام
        </button>

        <button
          type="button"
          onClick={() =>
            setSelectedType('series')
          }
          disabled={bulkLoading}
        >
          📺 مسلسلات
        </button>
      </div>

      <form
        onSubmit={handleSearch}
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '15px',
        }}
      >
        <input
          value={query}
          onChange={(e) =>
            setQuery(e.target.value)
          }
          placeholder={
            selectedType === 'movie'
              ? 'ابحث عن فيلم...'
              : 'ابحث عن مسلسل...'
          }
          style={{
            flex: 1,
            padding: '12px',
          }}
          disabled={
            loading || bulkLoading
          }
        />

        <button
          type="submit"
          disabled={
            loading || bulkLoading
          }
        >
          {loading
            ? '⏳'
            : '🔎 بحث'}
        </button>
      </form>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={handleImportAll}
          disabled={
            !movies.length ||
            loading ||
            bulkLoading
          }
        >
          📥 Import النتائج
        </button>

        <button
          type="button"
          onClick={handleTrending}
          disabled={
            loading || bulkLoading
          }
        >
          🔥 Import Trending
        </button>

        <button
          type="button"
          onClick={
            handleFetchAllSources
          }
          disabled={
            !movies.length ||
            loading ||
            bulkLoading
          }
        >
          🔗 فحص المصادر
        </button>

        <button
          type="button"
          onClick={handleFixUrls}
          disabled={
            loading || bulkLoading
          }
        >
          🛠️ Fix URLs
        </button>
      </div>

      <div
        style={{
          padding: '12px',
          marginBottom: '15px',
          borderRadius: '8px',
          background:
            'rgba(255,255,255,0.05)',
        }}
      >
        <div>
          <strong>
            Server 1:
          </strong>{' '}
          Stellar
        </div>

        <div>
          <strong>
            Server 2:
          </strong>{' '}
          StreamSrc
        </div>

        <div
          style={{
            marginTop: '8px',
            fontSize: '13px',
            opacity: 0.8,
          }}
        >
          Stellar للفيلم:
          <br />
          https://stellar.rip/en/watch/embed/movie/TMDB_ID
          <br />
          <br />
          Stellar للحلقة:
          <br />
          https://stellar.rip/en/watch/embed/tv/TMDB_ID-SEASON-EPISODE
        </div>
      </div>

      {status && (
        <div
          style={{
            whiteSpace: 'pre-wrap',
            padding: '12px',
            marginBottom: '10px',
            background:
              'rgba(0,150,255,0.08)',
            borderRadius: '8px',
          }}
        >
          {status}
        </div>
      )}

      {error && (
        <div
          style={{
            whiteSpace: 'pre-wrap',
            padding: '12px',
            marginBottom: '10px',
            color: '#ff6b6b',
            background:
              'rgba(255,0,0,0.08)',
            borderRadius: '8px',
          }}
        >
          ❌ {error}
        </div>
      )}

      {(stats.created > 0 ||
        stats.updated > 0) && (
        <div
          style={{
            marginBottom: '15px',
          }}
        >
          🆕 جديد: {stats.created} — 🔄 محدث:{' '}
          {stats.updated}
        </div>
      )}

      {movies.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill,minmax(220px,1fr))',
            gap: '15px',
          }}
        >
          {movies.map((item) => (
            <div
              key={`${item.type}-${item.tmdb_id}`}
              style={{
                border:
                  '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                overflow: 'hidden',
                background:
                  'rgba(255,255,255,0.03)',
              }}
            >
              <img
                src={
                  item.poster_url ||
                  PLACEHOLDER_POSTER
                }
                alt={item.name}
                style={{
                  width: '100%',
                  aspectRatio: '2/3',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  e.currentTarget.src =
                    PLACEHOLDER_POSTER;
                }}
              />

              <div
                style={{
                  padding: '12px',
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                  }}
                >
                  {item.name}
                </h3>

                <div
                  style={{
                    fontSize: '13px',
                    opacity: 0.7,
                    marginBottom: '10px',
                  }}
                >
                  TMDB: {item.tmdb_id}
                  <br />
                  Type: {item.type}
                  <br />
                  Server 1: Stellar
                  <br />
                  Server 2: StreamSrc
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '7px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      importSingleItem(
                        item
                      )
                    }
                    disabled={
                      loading ||
                      bulkLoading
                    }
                  >
                    📥 Import / Update
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fetchSingleSource(
                        item
                      )
                    }
                    disabled={
                      loading ||
                      bulkLoading
                    }
                  >
                    🔗 Sources
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

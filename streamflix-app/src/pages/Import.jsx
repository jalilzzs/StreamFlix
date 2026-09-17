import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/* =========================================================
   TMDB
========================================================= */

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/* =========================================================
   PLAYERS
========================================================= */

const VIDSRC_MOVIE = (tmdbId) =>
  `https://vidsrc.me/embed/movie?tmdb=${encodeURIComponent(tmdbId)}`;

const VIDSRC_EPISODE = (tmdbId, season, episode) =>
  `https://vidsrc.me/embed/tv?tmdb=${encodeURIComponent(tmdbId)}&season=${encodeURIComponent(
    season
  )}&episode=${encodeURIComponent(episode)}`;

const STELLAR_MOVIE = (tmdbId) =>
  `https://stellar.rip/en/watch/embed/movie/${encodeURIComponent(tmdbId)}`;

const STELLAR_EPISODE = (tmdbId, season, episode) =>
  `https://stellar.rip/en/watch/embed/tv/${encodeURIComponent(
    tmdbId
  )}-${encodeURIComponent(season)}-${encodeURIComponent(episode)}`;

const VIDLINK_MOVIE = (tmdbId) =>
  `https://vidlink.pro/movie/${encodeURIComponent(tmdbId)}`;

const VIDLINK_EPISODE = (tmdbId, season, episode) =>
  `https://vidlink.pro/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(
    season
  )}/${encodeURIComponent(episode)}`;

const YAPGRID_MOVIE = (tmdbId) =>
  `https://yapgrid.com/embed/movie/${encodeURIComponent(tmdbId)}?server=x`;

const YAPGRID_EPISODE = (tmdbId, season, episode) =>
  `https://yapgrid.com/embed/tv/${encodeURIComponent(
    tmdbId
  )}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}?server=x`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PLAYER_NAMES = ['Vidsrc', 'Stellar', 'VidLink', 'YapGrid'];

const getPlayerUrls = (tmdbId) => {
  if (!tmdbId) return [];

  return [
    {
      id: 0,
      name: 'سيرفر 1',
      provider: 'Vidsrc',
      url: VIDSRC_MOVIE(tmdbId),
    },
    {
      id: 1,
      name: 'سيرفر 2',
      provider: 'Stellar',
      url: STELLAR_MOVIE(tmdbId),
    },
    {
      id: 2,
      name: 'سيرفر 3',
      provider: 'VidLink',
      url: VIDLINK_MOVIE(tmdbId),
    },
    {
      id: 3,
      name: 'سيرفر 4',
      provider: 'YapGrid',
      url: YAPGRID_MOVIE(tmdbId),
    },
  ];
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeType(type) {
  return type === 'tv' || type === 'series' ? 'series' : 'movie';
}

function getTmdbEndpoint(type) {
  return normalizeType(type) === 'series' ? 'tv' : 'movie';
}

function getYear(item) {
  const date = item?.release_date || item?.first_air_date || '';
  return date ? Number(String(date).slice(0, 4)) || null : null;
}

function getTitle(item) {
  return item?.title || item?.name || 'بدون عنوان';
}

function getPoster(item) {
  if (!item?.poster_path) return null;
  return `${TMDB_IMAGE_BASE}/w500${item.poster_path}`;
}

function getBackdrop(item) {
  if (!item?.backdrop_path) return null;
  return `${TMDB_IMAGE_BASE}/w1280${item.backdrop_path}`;
}

function getGenres(item) {
  if (Array.isArray(item?.genres)) {
    return item.genres.map((genre) => genre.name).filter(Boolean);
  }

  if (Array.isArray(item?.genre_ids)) {
    return item.genre_ids.map(String);
  }

  return [];
}

function getRating(item) {
  const value = Number(item?.vote_average);
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

/* =========================================================
   COMPONENT
========================================================= */

export default function Import() {
  /* =======================================================
     AUTH / ADMIN
  ======================================================= */

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');

  /* =======================================================
     SEARCH
  ======================================================= */

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('movie');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  /* =======================================================
     BULK
  ======================================================= */

  const [bulkType, setBulkType] = useState('both');
  const [pageCount, setPageCount] = useState(5);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  /* =======================================================
     COUNTRY
  ======================================================= */

  const [countryCode, setCountryCode] = useState('TR');
  const [countryType, setCountryType] = useState('movie');
  const [countryCount, setCountryCount] = useState(50);
  const [countrySort, setCountrySort] = useState('newest');
  const [countryImportEpisodes, setCountryImportEpisodes] = useState(true);
  const [countrySeasonLimit, setCountrySeasonLimit] = useState(100);
  const [countryEpisodesLimit, setCountryEpisodesLimit] = useState(500);
  const [isCountryLoading, setIsCountryLoading] = useState(false);

  /* =======================================================
     TRENDING
  ======================================================= */

  const [isTrendingLoading, setIsTrendingLoading] = useState(false);

  /* =======================================================
     SERIES EPISODES
  ======================================================= */

  const [seriesTmdbId, setSeriesTmdbId] = useState('');
  const [seasonCount, setSeasonCount] = useState(1);
  const [episodesPerSeason, setEpisodesPerSeason] = useState(10);
  const [isEpisodeLoading, setIsEpisodeLoading] = useState(false);

  /* =======================================================
     TOOLS
  ======================================================= */

  const [isToolLoading, setIsToolLoading] = useState(false);
  const [isRefreshingPlayers, setIsRefreshingPlayers] = useState(false);
  const [isScanningPlayers, setIsScanningPlayers] = useState(false);

  /* =======================================================
     LOGS / STATS
  ======================================================= */

  const [logs, setLogs] = useState([]);

  const [stats, setStats] = useState({
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    episodes: 0,
    processed: 0,
    total: 0,
  });

  const [currentOperation, setCurrentOperation] = useState('');
  const [progress, setProgress] = useState(0);

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setAuthLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setUser(session?.user || null);
        setAuthLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user || null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =======================================================
     ADMIN CHECK
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      setAdminLoading(true);
      setAdminError('');

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (!mounted) return;

        setIsAdmin(Boolean(data));
      } catch (error) {
        if (!mounted) return;

        setIsAdmin(false);

        const message = String(error?.message || '').toLowerCase();

        if (message.includes('admin_users')) {
          setAdminError(
            'تعذر الوصول إلى جدول صلاحيات الإدارة. تأكد من تطبيق SQL الحماية في Supabase.'
          );
        } else {
          setAdminError(
            error?.message || 'تعذر التحقق من صلاحيات الإدارة.'
          );
        }
      } finally {
        if (mounted) {
          setAdminLoading(false);
        }
      }
    };

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [user]);

  /* =======================================================
     LOGGING
  ======================================================= */

  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
    });

    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        time,
        message,
        type,
      },
      ...prev,
    ]);
  };

  const updateStats = (changes) => {
    setStats((prev) => ({
      ...prev,
      ...changes,
    }));
  };

  const resetOperationStats = () => {
    setStats({
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      episodes: 0,
      processed: 0,
      total: 0,
    });

    setProgress(0);
  };

  /* =======================================================
     TMDB FETCH
  ======================================================= */

  const tmdbFetch = async (endpoint, options = {}) => {
    if (!TMDB_API_KEY) {
      throw new Error(
        'VITE_TMDB_API_KEY غير موجود في متغيرات البيئة.'
      );
    }

    const separator = endpoint.includes('?') ? '&' : '?';

    const url =
      `${TMDB_BASE_URL}${endpoint}${separator}` +
      `api_key=${encodeURIComponent(TMDB_API_KEY)}` +
      `&language=ar-SA`;

    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.status === 429) {
          const retryAfter =
            Number(response.headers.get('retry-after')) || 2;

          await sleep(retryAfter * 1000);
          continue;
        }

        if (response.status === 401) {
          throw new Error(
            'TMDB API Key غير صحيحة أو غير صالحة.'
          );
        }

        if (!response.ok) {
          throw new Error(
            `TMDB HTTP ${response.status}`
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          await sleep(1000 * attempt);
        }
      }
    }

    throw lastError || new Error('فشل طلب TMDB.');
  };

  /* =======================================================
     TMDB DETAILS
  ======================================================= */

  const getFullTmdbDetails = async (tmdbId, type) => {
    const endpoint = getTmdbEndpoint(type);

    return tmdbFetch(
      `/${endpoint}/${encodeURIComponent(
        tmdbId
      )}?append_to_response=credits`
    );
  };

  /* =======================================================
     DB HELPERS
  ======================================================= */

  const findExistingTitle = async (tmdbId) => {
    const { data, error } = await supabase
      .from('titles')
      .select('*')
      .eq('tmdb_id', String(tmdbId))
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return data || null;
  };

  const buildTitleData = (item, type) => ({
    type: normalizeType(type),
    name: getTitle(item),
    synopsis: item?.overview || null,
    poster_url: getPoster(item),
    release_year: getYear(item),
    genres: getGenres(item),
    rating_avg: getRating(item),
    is_premium: false,
    tmdb_id: String(item.id),
    is_hidden: false,
  });

  /* =======================================================
     SAVE TITLE
  ======================================================= */

  const saveTitle = async (item, type) => {
    const normalizedType = normalizeType(type);

    const existing = await findExistingTitle(item.id);

    const titleData = buildTitleData(
      item,
      normalizedType
    );

    if (existing) {
      const updateData = {
        type: titleData.type,
        name: titleData.name,
        synopsis: titleData.synopsis,
        poster_url: titleData.poster_url,
        release_year: titleData.release_year,
        genres: titleData.genres,
        rating_avg: titleData.rating_avg,
        is_premium: false,
      };

      if (normalizedType === 'movie') {
        updateData.url = VIDSRC_MOVIE(item.id);
      }

      const { data, error } = await supabase
        .from('titles')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      return {
        title: data,
        created: false,
        updated: true,
      };
    }

    const insertData = {
      ...titleData,
    };

    if (normalizedType === 'movie') {
      insertData.url = VIDSRC_MOVIE(item.id);
    }

    const { data, error } = await supabase
      .from('titles')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return {
      title: data,
      created: true,
      updated: false,
    };
  };

  /* =======================================================
     EPISODES
  ======================================================= */

  const saveEpisodesForTitle = async (
    titleId,
    tmdbId,
    seasons,
    maxEpisodesPerSeason
  ) => {
    const totalSeasons = Math.min(
      Number(seasons) || 0,
      100
    );

    for (
      let season = 1;
      season <= totalSeasons;
      season++
    ) {
      try {
        const seasonData = await tmdbFetch(
          `/tv/${encodeURIComponent(
            tmdbId
          )}/season/${season}`
        );

        const episodes = Array.isArray(
          seasonData?.episodes
        )
          ? seasonData.episodes.slice(
              0,
              Number(maxEpisodesPerSeason) || 500
            )
          : [];

        for (const episode of episodes) {
          const episodeNumber = episode.episode_number;

          const streamUrls = {
            server1: VIDSRC_EPISODE(
              tmdbId,
              season,
              episodeNumber
            ),
            server2: STELLAR_EPISODE(
              tmdbId,
              season,
              episodeNumber
            ),
            server3: VIDLINK_EPISODE(
              tmdbId,
              season,
              episodeNumber
            ),
            server4: YAPGRID_EPISODE(
              tmdbId,
              season,
              episodeNumber
            ),
          };

          const payload = {
            title_id: titleId,
            season,
            episode_number: episodeNumber,
            name:
              episode.name ||
              `Episode ${episodeNumber}`,
            synopsis: episode.overview || null,
            still_url: episode.still_path
              ? `${TMDB_IMAGE_BASE}/w500${episode.still_path}`
              : null,
            air_date:
              episode.air_date || null,
            rating_avg: getRating(episode),
            stream_urls: streamUrls,
          };

          const { error } = await supabase
            .from('episodes')
            .upsert(payload, {
              onConflict:
                'title_id,season,episode_number',
            });

          if (error) throw error;

          setStats((prev) => ({
            ...prev,
            episodes: prev.episodes + 1,
          }));
        }
      } catch (error) {
        addLog(
          `❌ فشل جلب الموسم ${season} للعمل ${tmdbId}: ${error.message}`,
          'error'
        );
      }

      await sleep(80);
    }
  };

  /* =======================================================
     SINGLE IMPORT
  ======================================================= */

  const importSingleItem = async (
    item,
    type,
    options = {}
  ) => {
    const normalizedType = normalizeType(type);

    try {
      const details =
        item?.overview !== undefined
          ? item
          : await getFullTmdbDetails(
              item.id,
              normalizedType
            );

      const result = await saveTitle(
        details,
        normalizedType
      );

      if (result.created) {
        setStats((prev) => ({
          ...prev,
          imported: prev.imported + 1,
        }));

        addLog(
          `✅ تمت إضافة ${getTitle(details)}`,
          'success'
        );
      } else if (result.updated) {
        setStats((prev) => ({
          ...prev,
          updated: prev.updated + 1,
        }));

        addLog(
          `🔄 تم تحديث ${getTitle(details)}`,
          'success'
        );
      }

      if (
        normalizedType === 'series' &&
        options.importEpisodes !== false
      ) {
        const seasons =
          options.seasonLimit ??
          details?.number_of_seasons ??
          0;

        const maxEpisodes =
          options.episodesLimit ?? 500;

        await saveEpisodesForTitle(
          result.title.id,
          details.id,
          seasons,
          maxEpisodes
        );
      }

      return result;
    } catch (error) {
      setStats((prev) => ({
        ...prev,
        failed: prev.failed + 1,
      }));

      addLog(
        `❌ فشل ${getTitle(item)}: ${error.message}`,
        'error'
      );

      return null;
    }
  };

  /* =======================================================
     SEARCH
  ======================================================= */

  const handleSearch = async () => {
    if (!isAdmin || !searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const endpoint =
        normalizeType(searchType) === 'series'
          ? 'tv'
          : 'movie';

      const data = await tmdbFetch(
        `/search/${endpoint}?query=${encodeURIComponent(
          searchQuery.trim()
        )}&page=1&include_adult=false`
      );

      setSearchResults(
        Array.isArray(data?.results)
          ? data.results
          : []
      );

      addLog(
        `🔎 تم العثور على ${
          data?.results?.length || 0
        } نتيجة.`,
        'success'
      );
    } catch (error) {
      addLog(
        `❌ فشل البحث: ${error.message}`,
        'error'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportSearchResult = async (
    item
  ) => {
    resetOperationStats();

    setCurrentOperation(
      `استيراد ${getTitle(item)}`
    );

    await importSingleItem(
      item,
      searchType,
      {
        importEpisodes:
          normalizeType(searchType) === 'series',
        seasonLimit: 100,
        episodesLimit: 500,
      }
    );

    setCurrentOperation('');
  };

  /* =======================================================
     BULK
  ======================================================= */

  const getBulkTypes = () => {
    if (bulkType === 'movie') return ['movie'];
    if (bulkType === 'series') return ['series'];

    return ['movie', 'series'];
  };

  const importBulkPages = async (
    type,
    pages
  ) => {
    const endpoint =
      normalizeType(type) === 'series'
        ? 'tv'
        : 'movie';

    for (let page = 1; page <= pages; page++) {
      const data = await tmdbFetch(
        `/movie/popular?page=${page}`
      );

      const results =
        normalizeType(type) === 'movie'
          ? data?.results || []
          : (
              await tmdbFetch(
                `/tv/popular?page=${page}`
              )
            )?.results || [];

      for (const item of results) {
        await importSingleItem(
          item,
          type,
          {
            importEpisodes:
              normalizeType(type) === 'series',
            seasonLimit: countrySeasonLimit,
            episodesLimit:
              countryEpisodesLimit,
          }
        );
      }

      addLog(
        `📦 انتهت صفحة ${page}/${pages} لـ ${endpoint}.`,
        'info'
      );

      await sleep(250);
    }
  };

  const handleBulkPopularImport = async () => {
    if (!isAdmin) return;

    setIsBulkLoading(true);
    resetOperationStats();

    const types = getBulkTypes();

    try {
      for (const type of types) {
        setCurrentOperation(
          `استيراد ${type === 'movie' ? 'الأفلام' : 'المسلسلات'}`
        );

        await importBulkPages(
          type,
          Math.max(1, Number(pageCount) || 1)
        );
      }

      addLog(
        '✅ انتهى الاستيراد الجماعي.',
        'success'
      );
    } catch (error) {
      addLog(
        `❌ فشل الاستيراد الجماعي: ${error.message}`,
        'error'
      );
    } finally {
      setIsBulkLoading(false);
      setCurrentOperation('');
    }
  };

  /* =======================================================
     COUNTRY
  ======================================================= */

  const getCountrySort = () => {
    switch (countrySort) {
      case 'rating':
        return 'vote_average.desc';
      case 'popular':
        return 'popularity.desc';
      case 'oldest':
        return 'primary_release_date.asc';
      default:
        return 'primary_release_date.desc';
    }
  };

  const getCountryEndpoint = () => {
    return normalizeType(countryType) === 'series'
      ? 'tv'
      : 'movie';
  };

  const getCountryResults = async () => {
    const endpoint = getCountryEndpoint();

    const params =
      endpoint === 'movie'
        ? `sort_by=${encodeURIComponent(
            getCountrySort()
          )}&with_origin_country=${encodeURIComponent(
            countryCode
          )}&page=1&include_adult=false`
        : `sort_by=${encodeURIComponent(
            getCountrySort()
          )}&with_origin_country=${encodeURIComponent(
            countryCode
          )}&page=1&include_adult=false`;

    const data = await tmdbFetch(
      `/discover/${endpoint}?${params}`
    );

    return Array.isArray(data?.results)
      ? data.results.slice(
          0,
          Math.max(1, Number(countryCount) || 50)
        )
      : [];
  };

  const importCountryItem = async (item) => {
    await importSingleItem(
      item,
      countryType,
      {
        importEpisodes:
          normalizeType(countryType) === 'series' &&
          countryImportEpisodes,
        seasonLimit: countrySeasonLimit,
        episodesLimit: countryEpisodesLimit,
      }
    );
  };

  const handleCountryImport = async () => {
    if (!isAdmin) return;

    setIsCountryLoading(true);
    resetOperationStats();

    try {
      const results =
        await getCountryResults();

      updateStats({
        total: results.length,
      });

      for (
        let index = 0;
        index < results.length;
        index++
      ) {
        setCurrentOperation(
          `استيراد ${index + 1}/${results.length}`
        );

        await importCountryItem(
          results[index]
        );

        setStats((prev) => ({
          ...prev,
          processed: prev.processed + 1,
        }));

        setProgress(
          Math.round(
            ((index + 1) /
              Math.max(results.length, 1)) *
              100
          )
        );

        await sleep(120);
      }

      addLog(
        `🌍 انتهى استيراد ${countryCode}.`,
        'success'
      );
    } catch (error) {
      addLog(
        `❌ خطأ في استيراد الدولة: ${error.message}`,
        'error'
      );
    } finally {
      setIsCountryLoading(false);
      setCurrentOperation('');
    }
  };

  /* =======================================================
     TRENDING
  ======================================================= */

  const handleTrendingImport = async () => {
    if (!isAdmin) return;

    setIsTrendingLoading(true);
    resetOperationStats();

    try {
      const movieData =
        await tmdbFetch(
          '/trending/movie/week'
        );

      const tvData =
        await tmdbFetch(
          '/trending/tv/week'
        );

      const movies =
        movieData?.results || [];

      const series =
        tvData?.results || [];

      const total =
        movies.length + series.length;

      updateStats({ total });

      let processed = 0;

      for (const item of movies) {
        await importSingleItem(
          item,
          'movie'
        );

        processed++;

        setProgress(
          Math.round(
            (processed /
              Math.max(total, 1)) *
              100
          )
        );
      }

      for (const item of series) {
        await importSingleItem(
          item,
          'series',
          {
            importEpisodes: true,
            seasonLimit: 100,
            episodesLimit: 500,
          }
        );

        processed++;

        setProgress(
          Math.round(
            (processed /
              Math.max(total, 1)) *
              100
          )
        );
      }

      addLog(
        '🔥 انتهى استيراد Trending.',
        'success'
      );
    } catch (error) {
      addLog(
        `❌ فشل Trending: ${error.message}`,
        'error'
      );
    } finally {
      setIsTrendingLoading(false);
      setCurrentOperation('');
    }
  };

  /* =======================================================
     MANUAL SERIES EPISODES
  ======================================================= */

  const handleManualEpisodes = async () => {
    if (!isAdmin || !seriesTmdbId.trim()) return;

    setIsEpisodeLoading(true);
    resetOperationStats();

    try {
      const existing =
        await findExistingTitle(
          seriesTmdbId.trim()
        );

      if (!existing) {
        throw new Error(
          'هذا TMDB ID غير موجود في قاعدة البيانات.'
        );
      }

      await saveEpisodesForTitle(
        existing.id,
        seriesTmdbId.trim(),
        seasonCount,
        episodesPerSeason
      );

      addLog(
        '✅ تم تحديث حلقات المسلسل.',
        'success'
      );
    } catch (error) {
      addLog(
        `❌ فشل تحديث الحلقات: ${error.message}`,
        'error'
      );
    } finally {
      setIsEpisodeLoading(false);
    }
  };

  /* =======================================================
     FIX URLS
  ======================================================= */

  const handleFixUrls = async () => {
    if (!isAdmin) return;

    setIsToolLoading(true);
    resetOperationStats();

    try {
      const { data: titles, error } =
        await supabase
          .from('titles')
          .select(
            'id,tmdb_id,name,type,url,is_hidden'
          );

      if (error) throw error;

      const list = titles || [];

      updateStats({
        total: list.length,
      });

      let fixed = 0;

      for (
        let index = 0;
        index < list.length;
        index++
      ) {
        const item = list[index];

        try {
          if (!item.tmdb_id) {
            setProgress(
              Math.round(
                ((index + 1) /
                  Math.max(list.length, 1)) *
                  100
              )
            );

            continue;
          }

          const normalizedType =
            normalizeType(item.type);

          const updateData = {
            type: normalizedType,
          };

          if (normalizedType === 'movie') {
            updateData.url =
              VIDSRC_MOVIE(item.tmdb_id);
          }

          const { error: updateError } =
            await supabase
              .from('titles')
              .update(updateData)
              .eq('id', item.id);

          if (updateError) {
            throw updateError;
          }

          fixed++;

          setProgress(
            Math.round(
              ((index + 1) /
                Math.max(list.length, 1)) *
                100
            )
          );

          await sleep(60);
        } catch (error) {
          setStats((prev) => ({
            ...prev,
            failed: prev.failed + 1,
          }));

          addLog(
            `❌ فشل إصلاح URL لـ ${item.name}: ${error.message}`,
            'error'
          );
        }
      }

      updateStats({
        updated: fixed,
        processed: list.length,
      });

      addLog(
        `🔗 انتهى إصلاح الروابط. تم تحديث ${fixed} سجل.`,
        'success'
      );
    } catch (error) {
      addLog(
        `❌ خطأ في إصلاح الروابط: ${error.message}`,
        'error'
      );
    } finally {
      setIsToolLoading(false);
      setCurrentOperation('');
    }
  };

  /* =======================================================
     REFRESH ALL FOUR PLAYERS
  ======================================================= */

  const handleRefreshAllPlayerLinks = async () => {
    if (!isAdmin || isRefreshingPlayers) return;

    setIsRefreshingPlayers(true);
    resetOperationStats();
    setCurrentOperation(
      'تجديد روابط جميع اللاعبين...'
    );

    try {
      const { data: titles, error } =
        await supabase
          .from('titles')
          .select(
            'id,tmdb_id,name,type,url,is_hidden'
          )
          .not('tmdb_id', 'is', null);

      if (error) throw error;

      const list = titles || [];

      updateStats({
        total: list.length,
      });

      let updated = 0;
      let failed = 0;

      for (
        let index = 0;
        index < list.length;
        index++
      ) {
        const item = list[index];

        try {
          const tmdbId = String(
            item.tmdb_id || ''
          ).trim();

          if (!tmdbId) {
            failed++;

            addLog(
              `⚠️ ${item.name}: لا يوجد TMDB ID.`,
              'warning'
            );

            continue;
          }

          /*
           * نفس TMDB ID يولّد دائماً نفس نظام
           * الروابط الأربعة المستعمل في VideoPlayer.
           */
          const players =
            getPlayerUrls(tmdbId);

          /*
           * titles.url هو الرابط legacy الموجود
           * حالياً في الجدول، لذلك نخليه على Player 1.
           *
           * الروابط الأربعة نفسها لا نحتاج تخزينها
           * في titles لأن VideoPlayer يولدها مباشرة
           * من tmdb_id.
           */
          const { error: updateError } =
            await supabase
              .from('titles')
              .update({
                url: players[0].url,
                type: normalizeType(item.type),
              })
              .eq('id', item.id);

          if (updateError) {
            throw updateError;
          }

          updated++;

          setStats((prev) => ({
            ...prev,
            updated,
            processed: index + 1,
          }));

          setProgress(
            Math.round(
              ((index + 1) /
                Math.max(list.length, 1)) *
                100
            )
          );

          addLog(
            `🔄 ${item.name} — تم تجديد 4 Players باستخدام TMDB ${tmdbId}`,
            'success'
          );

          await sleep(70);
        } catch (error) {
          failed++;

          setStats((prev) => ({
            ...prev,
            failed,
            processed: index + 1,
          }));

          addLog(
            `❌ فشل تجديد Players لـ ${item.name}: ${error.message}`,
            'error'
          );
        }
      }

      addLog(
        `✅ انتهى تجديد اللاعبين: ${updated} ناجح / ${failed} فشل.`,
        'success'
      );
    } catch (error) {
      addLog(
        `❌ خطأ في تجديد جميع الروابط: ${error.message}`,
        'error'
      );
    } finally {
      setIsRefreshingPlayers(false);
      setCurrentOperation('');
    }
  };

  /* =======================================================
     PLAYER HEALTH CHECK
  ======================================================= */

  const testExternalPlayer = (
    url,
    timeout = 9000
  ) =>
    new Promise((resolve) => {
      let finished = false;

      const iframe =
        document.createElement('iframe');

      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '-10000px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';

      const finish = (result) => {
        if (finished) return;

        finished = true;

        clearTimeout(timer);

        iframe.onload = null;
        iframe.onerror = null;

        try {
          iframe.remove();
        } catch {
          // ignore
        }

        resolve(result);
      };

      const timer = setTimeout(() => {
        finish(false);
      }, timeout);

      iframe.onload = () => {
        /*
         * بسبب Same-Origin Policy ما نقدرش نقرأ
         * محتوى player خارجي أو نتأكد من الفيديو نفسه.
         *
         * وصول iframe لمرحلة load يعتبر نجاحاً
         * في اختبار الـembed فقط.
         */
        finish(true);
      };

      iframe.onerror = () => {
        finish(false);
      };

      iframe.src = url;

      document.body.appendChild(iframe);
    });

  const scanTitlePlayers = async (item) => {
    const tmdbId = String(
      item?.tmdb_id || ''
    ).trim();

    if (!tmdbId) {
      return {
        working: false,
        results: [],
      };
    }

    const players =
      getPlayerUrls(tmdbId);

    const results = [];

    for (const player of players) {
      const working =
        await testExternalPlayer(
          player.url
        );

      results.push({
        ...player,
        working,
      });

      if (working) {
        /*
         * واحد خدم، ما نحتاجوش نجرب باقي
         * السيرفرات لهذا الفيلم.
         */
        break;
      }

      await sleep(150);
    }

    return {
      working: results.some(
        (player) => player.working
      ),
      results,
    };
  };

  /* =======================================================
     SCAN ALL PLAYERS + HIDE BROKEN TITLES
  ======================================================= */

  const handleScanAndHideBrokenPlayers =
    async () => {
      if (!isAdmin || isScanningPlayers) return;

      setIsScanningPlayers(true);
      resetOperationStats();
      setCurrentOperation(
        'فحص Players...'
      );

      try {
        const { data: titles, error } =
          await supabase
            .from('titles')
            .select(
              'id,tmdb_id,name,type,is_hidden'
            )
            .not('tmdb_id', 'is', null);

        if (error) throw error;

        const list = titles || [];

        updateStats({
          total: list.length,
        });

        let visible = 0;
        let hidden = 0;
        let failed = 0;

        for (
          let index = 0;
          index < list.length;
          index++
        ) {
          const item = list[index];

          try {
            setCurrentOperation(
              `فحص ${index + 1}/${list.length}: ${item.name}`
            );

            const result =
              await scanTitlePlayers(item);

            if (result.working) {
              const workingPlayer =
                result.results.find(
                  (player) =>
                    player.working
                );

              const { error: updateError } =
                await supabase
                  .from('titles')
                  .update({
                    is_hidden: false,
                  })
                  .eq('id', item.id);

              if (updateError) {
                throw updateError;
              }

              visible++;

              addLog(
                `✅ ${item.name} — Player يعمل: ${
                  workingPlayer?.provider ||
                  'غير معروف'
                } — بقي ظاهر.`,
                'success'
              );
            } else {
              const { error: updateError } =
                await supabase
                  .from('titles')
                  .update({
                    is_hidden: true,
                  })
                  .eq('id', item.id);

              if (updateError) {
                throw updateError;
              }

              hidden++;

              addLog(
                `🚫 ${item.name} — فشل Players الأربعة — تم إخفاؤه.`,
                'warning'
              );
            }
          } catch (error) {
            failed++;

            addLog(
              `❌ فشل فحص ${item.name}: ${error.message}`,
              'error'
            );
          }

          setStats((prev) => ({
            ...prev,
            processed: index + 1,
          }));

          setProgress(
            Math.round(
              ((index + 1) /
                Math.max(list.length, 1)) *
                100
            )
          );

          await sleep(100);
        }

        updateStats({
          updated: visible,
          failed,
        });

        addLog(
          `🔍 انتهى الفحص — ظاهر: ${visible} | مخفي: ${hidden} | أخطاء الفحص: ${failed}`,
          'success'
        );
      } catch (error) {
        addLog(
          `❌ خطأ في فحص Players: ${error.message}`,
          'error'
        );
      } finally {
        setIsScanningPlayers(false);
        setCurrentOperation('');
      }
    };

  /* =======================================================
     FIX POSTERS
  ======================================================= */

  const handleFixPosters = async () => {
    if (!isAdmin) return;

    setIsToolLoading(true);
    resetOperationStats();

    try {
      const { data: titles, error } =
        await supabase
          .from('titles')
          .select(
            'id,tmdb_id,name,type,poster_url'
          )
          .not('tmdb_id', 'is', null);

      if (error) throw error;

      const list = titles || [];

      updateStats({
        total: list.length,
      });

      let fixed = 0;

      for (
        let index = 0;
        index < list.length;
        index++
      ) {
        const item = list[index];

        try {
          const details =
            await getFullTmdbDetails(
              item.tmdb_id,
              item.type
            );

          const poster =
            getPoster(details);

          if (poster) {
            const { error: updateError } =
              await supabase
                .from('titles')
                .update({
                  poster_url: poster,
                })
                .eq('id', item.id);

            if (updateError) {
              throw updateError;
            }

            fixed++;
          }
        } catch (error) {
          setStats((prev) => ({
            ...prev,
            failed: prev.failed + 1,
          }));

          addLog(
            `❌ فشل Poster لـ ${item.name}: ${error.message}`,
            'error'
          );
        }

        setProgress(
          Math.round(
            ((index + 1) /
              Math.max(list.length, 1)) *
              100
          )
        );

        await sleep(100);
      }

      updateStats({
        updated: fixed,
        processed: list.length,
      });

      addLog(
        `🖼️ انتهى إصلاح Posters: ${fixed}.`,
        'success'
      );
    } catch (error) {
      addLog(
        `❌ خطأ في Posters: ${error.message}`,
        'error'
      );
    } finally {
      setIsToolLoading(false);
    }
  };

  /* =======================================================
     UPDATE RATINGS
  ======================================================= */

  const handleUpdateRatings = async () => {
    if (!isAdmin) return;

    setIsToolLoading(true);
    resetOperationStats();

    try {
      const { data: titles, error } =
        await supabase
          .from('titles')
          .select(
            'id,tmdb_id,name,type'
          )
          .not('tmdb_id', 'is', null);

      if (error) throw error;

      const list = titles || [];

      updateStats({
        total: list.length,
      });

      let updated = 0;

      for (
        let index = 0;
        index < list.length;
        index++
      ) {
        const item = list[index];

        try {
          const details =
            await getFullTmdbDetails(
              item.tmdb_id,
              item.type
            );

          const rating =
            getRating(details);

          const { error: updateError } =
            await supabase
              .from('titles')
              .update({
                rating_avg: rating,
              })
              .eq('id', item.id);

          if (updateError) {
            throw updateError;
          }

          updated++;
        } catch (error) {
          setStats((prev) => ({
            ...prev,
            failed: prev.failed + 1,
          }));

          addLog(
            `❌ فشل Rating لـ ${item.name}: ${error.message}`,
            'error'
          );
        }

        setProgress(
          Math.round(
            ((index + 1) /
              Math.max(list.length, 1)) *
              100
          )
        );

        await sleep(100);
      }

      updateStats({
        updated,
        processed: list.length,
      });

      addLog(
        `⭐ انتهى تحديث Ratings: ${updated}.`,
        'success'
      );
    } catch (error) {
      addLog(
        `❌ خطأ في Ratings: ${error.message}`,
        'error'
      );
    } finally {
      setIsToolLoading(false);
    }
  };

  /* =======================================================
     UPDATE INFO
  ======================================================= */

  const handleUpdateInfo = async () => {
    if (!isAdmin) return;

    setIsToolLoading(true);
    resetOperationStats();

    try {
      const { data: titles, error } =
        await supabase
          .from('titles')
          .select(
            'id,tmdb_id,name,type'
          )
          .not('tmdb_id', 'is', null);

      if (error) throw error;

      const list = titles || [];

      updateStats({
        total: list.length,
      });

      let updated = 0;

      for (
        let index = 0;
        index < list.length;
        index++
      ) {
        const item = list[index];

        try {
          const details =
            await getFullTmdbDetails(
              item.tmdb_id,
              item.type
            );

          const updateData = {
            type: normalizeType(item.type),
            name: getTitle(details),
            synopsis:
              details?.overview || null,
            poster_url:
              getPoster(details),
            release_year:
              getYear(details),
            genres:
              getGenres(details),
            rating_avg:
              getRating(details),
          };

          if (
            normalizeType(item.type) ===
            'movie'
          ) {
            updateData.url =
              VIDSRC_MOVIE(
                item.tmdb_id
              );
          }

          const { error: updateError } =
            await supabase
              .from('titles')
              .update(updateData)
              .eq('id', item.id);

          if (updateError) {
            throw updateError;
          }

          updated++;
        } catch (error) {
          setStats((prev) => ({
            ...prev,
            failed: prev.failed + 1,
          }));

          addLog(
            `❌ فشل تحديث معلومات ${item.name}: ${error.message}`,
            'error'
          );
        }

        setProgress(
          Math.round(
            ((index + 1) /
              Math.max(list.length, 1)) *
              100
          )
        );

        await sleep(100);
      }

      updateStats({
        updated,
        processed: list.length,
      });

      addLog(
        `ℹ️ انتهى تحديث المعلومات: ${updated}.`,
        'success'
      );
    } catch (error) {
      addLog(
        `❌ خطأ في تحديث المعلومات: ${error.message}`,
        'error'
      );
    } finally {
      setIsToolLoading(false);
    }
  };

  /* =======================================================
     BUSY
  ======================================================= */

  const busy =
    authLoading ||
    adminLoading ||
    isBulkLoading ||
    isCountryLoading ||
    isTrendingLoading ||
    isEpisodeLoading ||
    isToolLoading ||
    isRefreshingPlayers ||
    isScanningPlayers;

  /* =======================================================
     UI
  ======================================================= */

  if (authLoading || adminLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <div style={styles.spinner} />
          <h2 style={styles.title}>
            جاري التحقق من صلاحيات الإدارة...
          </h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <h2 style={styles.title}>
            تسجيل الدخول مطلوب
          </h2>
          <p style={styles.muted}>
            يجب تسجيل الدخول للوصول إلى لوحة
            الاستيراد.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <div style={styles.denied}>
            🔒
          </div>

          <h2 style={styles.title}>
            غير مصرح
          </h2>

          <p style={styles.muted}>
            هذا القسم متاح للمشرفين فقط.
          </p>

          {adminError && (
            <div style={styles.errorBox}>
              {adminError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.badge}>
              ADMIN
            </div>

            <h1 style={styles.heading}>
              StreamFlix Import
            </h1>

            <p style={styles.muted}>
              إدارة الأفلام والمسلسلات والروابط
              والمشغلات.
            </p>
          </div>
        </div>

        {/* OPERATION */}
        {currentOperation && (
          <div style={styles.operationCard}>
            <div style={styles.operationTop}>
              <strong>
                {currentOperation}
              </strong>

              <span>
                {progress}%
              </span>
            </div>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressBar,
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* STATS */}
        <div style={styles.statsGrid}>
          <StatCard
            label="Processed"
            value={stats.processed}
          />

          <StatCard
            label="Imported"
            value={stats.imported}
          />

          <StatCard
            label="Updated"
            value={stats.updated}
          />

          <StatCard
            label="Episodes"
            value={stats.episodes}
          />

          <StatCard
            label="Failed"
            value={stats.failed}
          />

          <StatCard
            label="Total"
            value={stats.total}
          />
        </div>

        {/* SEARCH */}
        <Section
          title="🔎 بحث TMDB"
          description="البحث عن فيلم أو مسلسل واستيراده."
        >
          <div style={styles.row}>
            <select
              value={searchType}
              onChange={(event) =>
                setSearchType(
                  event.target.value
                )
              }
              style={styles.input}
              disabled={busy}
            >
              <option value="movie">
                فيلم
              </option>

              <option value="series">
                مسلسل
              </option>
            </select>

            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter'
                ) {
                  handleSearch();
                }
              }}
              placeholder="اسم الفيلم أو المسلسل..."
              style={styles.input}
              disabled={busy}
            />

            <button
              onClick={handleSearch}
              disabled={
                busy ||
                isSearching ||
                !searchQuery.trim()
              }
              style={styles.primaryButton}
            >
              {isSearching
                ? 'جاري البحث...'
                : 'بحث'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={styles.resultsGrid}>
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  style={styles.resultCard}
                >
                  <img
                    src={
                      getPoster(item) ||
                      '/placeholder-poster.png'
                    }
                    alt={getTitle(item)}
                    style={styles.poster}
                  />

                  <div style={styles.resultBody}>
                    <strong>
                      {getTitle(item)}
                    </strong>

                    <span style={styles.small}>
                      TMDB: {item.id}
                    </span>

                    <button
                      onClick={() =>
                        handleImportSearchResult(
                          item
                        )
                      }
                      disabled={busy}
                      style={styles.smallButton}
                    >
                      استيراد
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* BULK */}
        <Section
          title="📦 استيراد جماعي"
          description="استيراد Popular من TMDB."
        >
          <div style={styles.row}>
            <select
              value={bulkType}
              onChange={(event) =>
                setBulkType(
                  event.target.value
                )
              }
              style={styles.input}
              disabled={busy}
            >
              <option value="both">
                أفلام + مسلسلات
              </option>

              <option value="movie">
                أفلام
              </option>

              <option value="series">
                مسلسلات
              </option>
            </select>

            <input
              type="number"
              min="1"
              max="100"
              value={pageCount}
              onChange={(event) =>
                setPageCount(
                  Number(event.target.value)
                )
              }
              style={styles.input}
              disabled={busy}
            />

            <button
              onClick={
                handleBulkPopularImport
              }
              disabled={busy}
              style={styles.primaryButton}
            >
              {isBulkLoading
                ? 'جاري الاستيراد...'
                : 'بدء الاستيراد'}
            </button>
          </div>
        </Section>

        {/* COUNTRY */}
        <Section
          title="🌍 استيراد حسب الدولة"
          description="جلب أعمال دولة محددة من TMDB."
        >
          <div style={styles.grid}>
            <select
              value={countryCode}
              onChange={(event) =>
                setCountryCode(
                  event.target.value
                )
              }
              style={styles.input}
              disabled={busy}
            >
              <option value="TR">
                تركيا
              </option>
              <option value="US">
                الولايات المتحدة
              </option>
              <option value="GB">
                بريطانيا
              </option>
              <option value="FR">
                فرنسا
              </option>
              <option value="KR">
                كوريا الجنوبية
              </option>
              <option value="JP">
                اليابان
              </option>
              <option value="IN">
                الهند
              </option>
              <option value="ES">
                إسبانيا
              </option>
              <option value="IT">
                إيطاليا
              </option>
              <option value="DE">
                ألمانيا
              </option>
            </select>

            <select
              value={countryType}
              onChange={(event) =>
                setCountryType(
                  event.target.value
                )
              }
              style={styles.input}
              disabled={busy}
            >
              <option value="movie">
                أفلام
              </option>
              <option value="series">
                مسلسلات
              </option>
            </select>

            <input
              type="number"
              min="1"
              max="500"
              value={countryCount}
              onChange={(event) =>
                setCountryCount(
                  Number(event.target.value)
                )
              }
              style={styles.input}
              disabled={busy}
            />

            <select
              value={countrySort}
              onChange={(event) =>
                setCountrySort(
                  event.target.value
                )
              }
              style={styles.input}
              disabled={busy}
            >
              <option value="newest">
                الأحدث
              </option>

              <option value="oldest">
                الأقدم
              </option>

              <option value="popular">
                الأكثر شعبية
              </option>

              <option value="rating">
                التقييم
              </option>
            </select>
          </div>

          {countryType === 'series' && (
            <div style={styles.grid}>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={
                    countryImportEpisodes
                  }
                  onChange={(event) =>
                    setCountryImportEpisodes(
                      event.target.checked
                    )
                  }
                  disabled={busy}
                />
                جلب الحلقات
              </label>

              <input
                type="number"
                min="1"
                max="100"
                value={countrySeasonLimit}
                onChange={(event) =>
                  setCountrySeasonLimit(
                    Number(
                      event.target.value
                    )
                  )
                }
                style={styles.input}
                disabled={busy}
                placeholder="عدد المواسم"
              />

              <input
                type="number"
                min="1"
                max="500"
                value={countryEpisodesLimit}
                onChange={(event) =>
                  setCountryEpisodesLimit(
                    Number(
                      event.target.value
                    )
                  )
                }
                style={styles.input}
                disabled={busy}
                placeholder="الحلقات لكل موسم"
              />
            </div>
          )}

          <button
            onClick={handleCountryImport}
            disabled={busy}
            style={styles.primaryButton}
          >
            {isCountryLoading
              ? 'جاري الاستيراد...'
              : 'استيراد الدولة'}
          </button>
        </Section>

        {/* TRENDING */}
        <Section
          title="🔥 Trending"
          description="استيراد الأفلام والمسلسلات الرائجة."
        >
          <button
            onClick={handleTrendingImport}
            disabled={busy}
            style={styles.primaryButton}
          >
            {isTrendingLoading
              ? 'جاري الاستيراد...'
              : 'استيراد Trending'}
          </button>
        </Section>

        {/* EPISODES */}
        <Section
          title="🎬 تحديث حلقات مسلسل"
          description="إعادة جلب حلقات مسلسل موجود باستعمال TMDB ID."
        >
          <div style={styles.row}>
            <input
              value={seriesTmdbId}
              onChange={(event) =>
                setSeriesTmdbId(
                  event.target.value
                )
              }
              placeholder="TMDB ID"
              style={styles.input}
              disabled={busy}
            />

            <input
              type="number"
              min="1"
              max="100"
              value={seasonCount}
              onChange={(event) =>
                setSeasonCount(
                  Number(event.target.value)
                )
              }
              style={styles.input}
              disabled={busy}
              placeholder="المواسم"
            />

            <input
              type="number"
              min="1"
              max="500"
              value={episodesPerSeason}
              onChange={(event) =>
                setEpisodesPerSeason(
                  Number(event.target.value)
                )
              }
              style={styles.input}
              disabled={busy}
              placeholder="الحلقات"
            />

            <button
              onClick={handleManualEpisodes}
              disabled={
                busy ||
                !seriesTmdbId.trim()
              }
              style={styles.primaryButton}
            >
              {isEpisodeLoading
                ? 'جاري التحديث...'
                : 'تحديث الحلقات'}
            </button>
          </div>
        </Section>

        {/* TOOLS */}
        <Section
          title="🛠️ أدوات قاعدة البيانات"
          description="إصلاح وتحديث البيانات الحالية."
        >
          <div style={styles.toolsGrid}>
            <ToolButton
              icon="🔗"
              title="إصلاح الروابط"
              description="إعادة بناء رابط Player 1 للأفلام."
              onClick={handleFixUrls}
              disabled={busy}
            />

            <ToolButton
              icon="🖼️"
              title="إصلاح Posters"
              description="إعادة جلب صور TMDB."
              onClick={handleFixPosters}
              disabled={busy}
            />

            <ToolButton
              icon="⭐"
              title="تحديث Ratings"
              description="تحديث تقييمات TMDB."
              onClick={handleUpdateRatings}
              disabled={busy}
            />

            <ToolButton
              icon="ℹ️"
              title="تحديث المعلومات"
              description="تحديث معلومات الأعمال."
              onClick={handleUpdateInfo}
              disabled={busy}
            />

            <ToolButton
              icon="🔄"
              title="تجديد روابط جميع Players"
              description="تجديد روابط Vidsrc وStellar وVidLink وYapGrid باستعمال نفس TMDB ID."
              onClick={
                handleRefreshAllPlayerLinks
              }
              disabled={busy}
              accent
            />

            <ToolButton
              icon="🔍"
              title="فحص Players وإخفاء المعطّل"
              description="إذا فشل Players الأربعة يتم وضع is_hidden = true."
              onClick={
                handleScanAndHideBrokenPlayers
              }
              disabled={busy}
              danger
            />
          </div>
        </Section>

        {/* PLAYERS */}
        <Section
          title="🎥 نظام المشاهدة"
          description="المشغلات التي يستعملها VideoPlayer."
        >
          <div style={styles.playersGrid}>
            {PLAYER_NAMES.map(
              (player, index) => (
                <div
                  key={player}
                  style={styles.playerCard}
                >
                  <div
                    style={styles.playerNumber}
                  >
                    {index + 1}
                  </div>

                  <div>
                    <strong>
                      {player}
                    </strong>

                    <p style={styles.small}>
                      {index === 0 &&
                        'Vidsrc Free'}
                      {index === 1 &&
                        'Stellar Free'}
                      {index === 2 &&
                        'VidLink Free'}
                      {index === 3 &&
                        'YapGrid VIP'}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </Section>

        {/* LOGS */}
        <Section
          title="📋 Logs"
          description="سجل آخر العمليات."
        >
          <div style={styles.logs}>
            {logs.length === 0 ? (
              <div style={styles.empty}>
                لا توجد عمليات بعد.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    ...styles.log,
                    ...(log.type ===
                    'error'
                      ? styles.logError
                      : {}),
                    ...(log.type ===
                    'warning'
                      ? styles.logWarning
                      : {}),
                    ...(log.type ===
                    'success'
                      ? styles.logSuccess
                      : {}),
                  }}
                >
                  <span
                    style={styles.logTime}
                  >
                    {log.time}
                  </span>

                  <span>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* SECURITY */}
        <Section
          title="🔐 الحماية"
          description="هذه الصفحة تعتمد على صلاحية admin_users."
        >
          <div style={styles.securityBox}>
            <span>
              👤 المستخدم الحالي
            </span>

            <span style={styles.small}>
              {user.email || user.id}
            </span>

            <span style={styles.adminPill}>
              ADMIN
            </span>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function Section({
  title,
  description,
  children,
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>
            {title}
          </h2>

          <p style={styles.muted}>
            {description}
          </p>
        </div>
      </div>

      <div>{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
}) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>
        {label}
      </span>

      <strong style={styles.statValue}>
        {formatNumber(value)}
      </strong>
    </div>
  );
}

function ToolButton({
  icon,
  title,
  description,
  onClick,
  disabled,
  accent = false,
  danger = false,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.toolButton,
        ...(accent
          ? styles.toolAccent
          : {}),
        ...(danger
          ? styles.toolDanger
          : {}),
      }}
    >
      <div style={styles.toolIcon}>
        {icon}
      </div>

      <div style={styles.toolContent}>
        <strong>{title}</strong>

        <span>{description}</span>
      </div>
    </button>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(180deg,#090b12 0%,#0d1018 100%)',
    color: '#fff',
    padding: '30px 16px 60px',
    direction: 'rtl',
    boxSizing: 'border-box',
  },

  container: {
    width: '100%',
    maxWidth: '1250px',
    margin: '0 auto',
  },

  centerCard: {
    width: 'min(520px,100%)',
    margin: '100px auto',
    padding: '35px',
    borderRadius: '22px',
    background: '#121722',
    border: '1px solid #252c3a',
    textAlign: 'center',
    boxSizing: 'border-box',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '25px',
  },

  badge: {
    display: 'inline-flex',
    padding: '5px 10px',
    borderRadius: '999px',
    background: '#252c3a',
    color: '#aeb8cc',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1px',
    marginBottom: '8px',
  },

  heading: {
    margin: 0,
    fontSize: '30px',
    fontWeight: 900,
  },

  title: {
    margin: '10px 0',
  },

  muted: {
    margin: '6px 0 0',
    color: '#8f9aaf',
    lineHeight: 1.6,
  },

  small: {
    display: 'block',
    color: '#8792a7',
    fontSize: '12px',
    marginTop: '5px',
  },

  denied: {
    fontSize: '45px',
    marginBottom: '10px',
  },

  errorBox: {
    marginTop: '20px',
    padding: '12px',
    borderRadius: '12px',
    background: '#2a1418',
    border: '1px solid #632b35',
    color: '#ff9ca8',
  },

  operationCard: {
    marginBottom: '18px',
    padding: '16px',
    borderRadius: '16px',
    background: '#111621',
    border: '1px solid #273043',
  },

  operationTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '15px',
    marginBottom: '10px',
  },

  progressTrack: {
    width: '100%',
    height: '8px',
    borderRadius: '999px',
    overflow: 'hidden',
    background: '#252c39',
  },

  progressBar: {
    height: '100%',
    borderRadius: '999px',
    background:
      'linear-gradient(90deg,#5b7cff,#8b5cf6)',
    transition: 'width .2s ease',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(130px,1fr))',
    gap: '10px',
    marginBottom: '18px',
  },

  statCard: {
    padding: '15px',
    borderRadius: '16px',
    background: '#111621',
    border: '1px solid #222a39',
  },

  statLabel: {
    display: 'block',
    color: '#8d98ac',
    fontSize: '12px',
    marginBottom: '5px',
  },

  statValue: {
    fontSize: '22px',
  },

  section: {
    marginBottom: '18px',
    padding: '20px',
    borderRadius: '20px',
    background: '#111621',
    border: '1px solid #222a39',
  },

  sectionHeader: {
    marginBottom: '18px',
  },

  sectionTitle: {
    margin: 0,
    fontSize: '19px',
    fontWeight: 800,
  },

  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(170px,1fr))',
    gap: '10px',
    marginBottom: '12px',
  },

  input: {
    flex: '1 1 180px',
    minWidth: 0,
    height: '44px',
    padding: '0 13px',
    borderRadius: '11px',
    border: '1px solid #30394b',
    background: '#0b0f17',
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  },

  primaryButton: {
    minHeight: '44px',
    padding: '0 18px',
    borderRadius: '11px',
    border: '1px solid #536cff',
    background:
      'linear-gradient(135deg,#536cff,#7658e8)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },

  smallButton: {
    marginTop: '10px',
    padding: '8px 12px',
    borderRadius: '9px',
    border: '1px solid #35415a',
    background: '#171e2b',
    color: '#fff',
    cursor: 'pointer',
  },

  resultsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fill,minmax(230px,1fr))',
    gap: '12px',
    marginTop: '18px',
  },

  resultCard: {
    display: 'flex',
    gap: '12px',
    padding: '10px',
    borderRadius: '14px',
    background: '#0b0f17',
    border: '1px solid #242d3d',
    overflow: 'hidden',
  },

  poster: {
    width: '70px',
    height: '100px',
    objectFit: 'cover',
    borderRadius: '9px',
    background: '#171d28',
    flexShrink: 0,
  },

  resultBody: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },

  toolsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(270px,1fr))',
    gap: '12px',
  },

  toolButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '13px',
    width: '100%',
    minHeight: '92px',
    padding: '15px',
    borderRadius: '15px',
    border: '1px solid #293246',
    background: '#0c111a',
    color: '#fff',
    textAlign: 'right',
    cursor: 'pointer',
  },

  toolAccent: {
    borderColor: '#536cff',
    background:
      'linear-gradient(135deg,#11182a,#171b31)',
  },

  toolDanger: {
    borderColor: '#713843',
    background:
      'linear-gradient(135deg,#171017,#20131a)',
  },

  toolIcon: {
    width: '45px',
    height: '45px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '12px',
    background: '#171e2c',
    fontSize: '22px',
    flexShrink: 0,
  },

  toolContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },

  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '44px',
    color: '#d9dfeb',
  },

  playersGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(180px,1fr))',
    gap: '10px',
  },

  playerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '13px',
    borderRadius: '14px',
    background: '#0b0f17',
    border: '1px solid #242d3d',
  },

  playerNumber: {
    width: '38px',
    height: '38px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '10px',
    background: '#1b2230',
    fontWeight: 900,
  },

  logs: {
    maxHeight: '430px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },

  log: {
    display: 'flex',
    gap: '10px',
    padding: '9px 11px',
    borderRadius: '9px',
    background: '#0b0f17',
    border: '1px solid #202837',
    color: '#cbd3e1',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  logTime: {
    color: '#68748a',
    direction: 'ltr',
    flexShrink: 0,
  },

  logError: {
    borderColor: '#65303a',
    color: '#ff9aa7',
  },

  logWarning: {
    borderColor: '#66552a',
    color: '#f5d681',
  },

  logSuccess: {
    borderColor: '#28513e',
    color: '#8ee4b6',
  },

  empty: {
    padding: '25px',
    textAlign: 'center',
    color: '#68748a',
  },

  securityBox: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '13px',
    borderRadius: '12px',
    background: '#0b0f17',
    border: '1px solid #242d3d',
  },

  adminPill: {
    padding: '5px 9px',
    borderRadius: '999px',
    background: '#183b2d',
    color: '#8ee4b6',
    fontSize: '11px',
    fontWeight: 900,
  },

  spinner: {
    width: '35px',
    height: '35px',
    margin: '0 auto 15px',
    borderRadius: '50%',
    border: '3px solid #293246',
    borderTopColor: '#687cff',
    animation:
      'streamflix-spin 1s linear infinite',
  },
};

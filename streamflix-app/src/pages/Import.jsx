import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/*
  ============================================================
  StreamFlix - Secure Import Dashboard
  ============================================================

  Features:
  - Supabase Auth + admin_users
  - Individual TMDB search/import
  - Bulk popular import
  - Trending import
  - Series / episodes import
  - Database repair tools
  - 🌍 Bulk import by country
  - Movies / Series / Both
  - Custom number of items
  - Newest / Popular / Rating sorting
  - Full TMDB metadata
  - Duplicate protection using tmdb_id

  Playback:
  - VideoPlayer generates servers live from TMDB ID
  - Vidsrc
  - Stellar
  - VidLink
  - YapGrid VIP
*/

/* ============================================================
   TMDB CONFIG
============================================================ */

const TMDB_API_KEY =
  import.meta.env.VITE_TMDB_API_KEY || '';

const TMDB_BASE_URL =
  'https://api.themoviedb.org/3';

const TMDB_IMAGE_BASE =
  'https://image.tmdb.org/t/p';

/* ============================================================
   VIDEO SERVERS
============================================================ */

const VIDSRC_MOVIE = (tmdbId) =>
  `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;

const VIDSRC_EPISODE = (
  tmdbId,
  season,
  episode
) =>
  `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;

const STELLAR_MOVIE = (tmdbId) =>
  `https://stellar.rip/en/watch/embed/movie/${tmdbId}`;

const STELLAR_EPISODE = (
  tmdbId,
  season,
  episode
) =>
  `https://stellar.rip/en/watch/embed/tv/${tmdbId}-${season}-${episode}`;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/* ============================================================
   COUNTRY LIST
============================================================ */

const COUNTRIES = [
  { code: 'TR', name: '🇹🇷 تركيا' },
  { code: 'DZ', name: '🇩🇿 الجزائر' },
  { code: 'EG', name: '🇪🇬 مصر' },
  { code: 'SA', name: '🇸🇦 السعودية' },
  { code: 'AE', name: '🇦🇪 الإمارات' },
  { code: 'MA', name: '🇲🇦 المغرب' },
  { code: 'TN', name: '🇹🇳 تونس' },
  { code: 'IQ', name: '🇮🇶 العراق' },
  { code: 'SY', name: '🇸🇾 سوريا' },
  { code: 'JO', name: '🇯🇴 الأردن' },
  { code: 'LB', name: '🇱🇧 لبنان' },
  { code: 'PS', name: '🇵🇸 فلسطين' },
  { code: 'KW', name: '🇰🇼 الكويت' },
  { code: 'QA', name: '🇶🇦 قطر' },
  { code: 'BH', name: '🇧🇭 البحرين' },
  { code: 'OM', name: '🇴🇲 عُمان' },
  { code: 'YE', name: '🇾🇪 اليمن' },
  { code: 'IR', name: '🇮🇷 إيران' },
  { code: 'IN', name: '🇮🇳 الهند' },
  { code: 'PK', name: '🇵🇰 باكستان' },
  { code: 'KR', name: '🇰🇷 كوريا الجنوبية' },
  { code: 'JP', name: '🇯🇵 اليابان' },
  { code: 'CN', name: '🇨🇳 الصين' },
  { code: 'TH', name: '🇹🇭 تايلاند' },
  { code: 'ID', name: '🇮🇩 إندونيسيا' },
  { code: 'MY', name: '🇲🇾 ماليزيا' },
  { code: 'PH', name: '🇵🇭 الفلبين' },
  { code: 'US', name: '🇺🇸 الولايات المتحدة' },
  { code: 'GB', name: '🇬🇧 بريطانيا' },
  { code: 'FR', name: '🇫🇷 فرنسا' },
  { code: 'DE', name: '🇩🇪 ألمانيا' },
  { code: 'IT', name: '🇮🇹 إيطاليا' },
  { code: 'ES', name: '🇪🇸 إسبانيا' },
  { code: 'PT', name: '🇵🇹 البرتغال' },
  { code: 'NL', name: '🇳🇱 هولندا' },
  { code: 'BE', name: '🇧🇪 بلجيكا' },
  { code: 'SE', name: '🇸🇪 السويد' },
  { code: 'NO', name: '🇳🇴 النرويج' },
  { code: 'DK', name: '🇩🇰 الدنمارك' },
  { code: 'FI', name: '🇫🇮 فنلندا' },
  { code: 'PL', name: '🇵🇱 بولندا' },
  { code: 'RU', name: '🇷🇺 روسيا' },
  { code: 'UA', name: '🇺🇦 أوكرانيا' },
  { code: 'BR', name: '🇧🇷 البرازيل' },
  { code: 'MX', name: '🇲🇽 المكسيك' },
  { code: 'AR', name: '🇦🇷 الأرجنتين' },
  { code: 'CO', name: '🇨🇴 كولومبيا' },
  { code: 'CL', name: '🇨🇱 تشيلي' },
  { code: 'AU', name: '🇦🇺 أستراليا' },
  { code: 'CA', name: '🇨🇦 كندا' },
  { code: 'ZA', name: '🇿🇦 جنوب أفريقيا' },
  { code: 'NG', name: '🇳🇬 نيجيريا' },
  { code: 'PK', name: '🇵🇰 باكستان' },
];

/* ============================================================
   HELPERS
============================================================ */

function normalizeType(type) {
  return type === 'tv' || type === 'series'
    ? 'series'
    : 'movie';
}

function getYear(item) {
  const date =
    item?.release_date ||
    item?.first_air_date ||
    '';

  const year = parseInt(
    String(date).slice(0, 4),
    10
  );

  return Number.isFinite(year)
    ? year
    : null;
}

function getTitle(item) {
  return (
    item?.title ||
    item?.name ||
    'بدون عنوان'
  );
}

function getPoster(item) {
  return item?.poster_path
    ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}`
    : null;
}

function getBackdrop(item) {
  return item?.backdrop_path
    ? `${TMDB_IMAGE_BASE}/w1280${item.backdrop_path}`
    : null;
}

function getGenres(item) {
  if (Array.isArray(item?.genres)) {
    return item.genres
      .map((genre) => genre?.name)
      .filter(Boolean);
  }

  if (Array.isArray(item?.genre_ids)) {
    return item.genre_ids.map(String);
  }

  return [];
}

function getRating(item) {
  const value = Number(item?.vote_average);

  return Number.isFinite(value)
    ? Number(value.toFixed(1))
    : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(
    'en-US'
  );
}

/* ============================================================
   COMPONENT
============================================================ */

export default function Import() {
  /* ============================================================
     AUTH / ADMIN
  ============================================================ */

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] =
    useState(true);

  const [adminLoading, setAdminLoading] =
    useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [adminError, setAdminError] =
    useState('');

  /* ============================================================
     SEARCH
  ============================================================ */

  const [searchQuery, setSearchQuery] =
    useState('');

  const [searchType, setSearchType] =
    useState('movie');

  const [searchResults, setSearchResults] =
    useState([]);

  const [isSearching, setIsSearching] =
    useState(false);

  /* ============================================================
     BULK IMPORT
  ============================================================ */

  const [bulkType, setBulkType] =
    useState('both');

  const [pageCount, setPageCount] =
    useState(5);

  const [isBulkLoading, setIsBulkLoading] =
    useState(false);

  /* ============================================================
     COUNTRY IMPORT
  ============================================================ */

  const [countryCode, setCountryCode] =
    useState('TR');

  const [countryType, setCountryType] =
    useState('movie');

  const [countryCount, setCountryCount] =
    useState(50);

  const [countrySort, setCountrySort] =
    useState('newest');

  const [
    countryImportEpisodes,
    setCountryImportEpisodes,
  ] = useState(true);

  const [
    countrySeasonLimit,
    setCountrySeasonLimit,
  ] = useState(100);

  const [
    countryEpisodesLimit,
    setCountryEpisodesLimit,
  ] = useState(500);

  const [
    isCountryLoading,
    setIsCountryLoading,
  ] = useState(false);

  /* ============================================================
     TRENDING
  ============================================================ */

  const [
    isTrendingLoading,
    setIsTrendingLoading,
  ] = useState(false);

  /* ============================================================
     SERIES EPISODES
  ============================================================ */

  const [seriesTmdbId, setSeriesTmdbId] =
    useState('');

  const [seasonCount, setSeasonCount] =
    useState(1);

  const [
    episodesPerSeason,
    setEpisodesPerSeason,
  ] = useState(10);

  const [
    isEpisodeLoading,
    setIsEpisodeLoading,
  ] = useState(false);

  /* ============================================================
     TOOLS
  ============================================================ */

  const [isToolLoading, setIsToolLoading] =
    useState(false);

  /* ============================================================
     LOGS / STATS
  ============================================================ */

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

  const [
    currentOperation,
    setCurrentOperation,
  ] = useState('');

  const [progress, setProgress] =
    useState(0);

  /* ============================================================
     AUTH
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      setAuthLoading(true);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setAdminError(error.message);
        setUser(null);
      } else {
        setUser(session?.user || null);
      }

      setAuthLoading(false);
    };

    initializeAuth();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!mounted) return;
          setUser(session?.user || null);
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* ============================================================
     ADMIN CHECK
  ============================================================ */

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
        const { data, error } =
          await supabase
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

        const message = String(
          error?.message || ''
        ).toLowerCase();

        if (
          message.includes('admin_users')
        ) {
          setAdminError(
            'تعذر الوصول إلى جدول صلاحيات الإدارة. تأكد من تطبيق SQL الحماية في Supabase.'
          );
        } else {
          setAdminError(
            error?.message ||
              'تعذر التحقق من صلاحيات الإدارة.'
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

  /* ============================================================
     LOGGING
  ============================================================ */

  const addLog = (
    message,
    type = 'info'
  ) => {
    const time =
      new Date().toLocaleTimeString(
        'en-US',
        {
          hour12: false,
        }
      );

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

  /* ============================================================
     TMDB REQUEST
  ============================================================ */

  const tmdbFetch = async (
    path,
    params = {}
  ) => {
    if (!TMDB_API_KEY) {
      throw new Error(
        'TMDB API Key غير موجودة. أضف VITE_TMDB_API_KEY في Environment Variables ثم أعد Build/Deploy.'
      );
    }

    const url = new URL(
      `${TMDB_BASE_URL}${path}`
    );

    url.searchParams.set(
      'api_key',
      TMDB_API_KEY
    );

    url.searchParams.set(
      'language',
      'ar-SA'
    );

    Object.entries(params).forEach(
      ([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== ''
        ) {
          url.searchParams.set(
            key,
            value
          );
        }
      }
    );

    const response = await fetch(
      url.toString()
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.status_message ||
        `TMDB HTTP ${response.status}`;

      if (response.status === 401) {
        throw new Error(
          'TMDB API Key غير صالحة أو لم يتم تحميل المفتاح الجديد. تأكد من VITE_TMDB_API_KEY ثم أعد Build جديد.'
        );
      }

      throw new Error(message);
    }

    if (
      data?.status_code &&
      data?.status_message
    ) {
      throw new Error(
        data.status_message
      );
    }

    return data;
  };

  /* ============================================================
     DATABASE
  ============================================================ */

  const findExistingTitle =
    async (tmdbId) => {
      const { data, error } =
        await supabase
          .from('titles')
          .select('*')
          .eq(
            'tmdb_id',
            String(tmdbId)
          )
          .limit(1)
          .maybeSingle();

      if (error) throw error;

      return data || null;
    };

  const buildTitleData = (
    item,
    type
  ) => {
    return {
      type: normalizeType(type),
      name: getTitle(item),
      synopsis:
        item?.overview || null,
      poster_url:
        getPoster(item),
      release_year:
        getYear(item),
      genres:
        getGenres(item),
      rating_avg:
        getRating(item),
      is_premium: false,
      tmdb_id: String(item.id),
    };
  };

  const saveTitle = async (
    item,
    type
  ) => {
    const normalizedType =
      normalizeType(type);

    const titleData =
      buildTitleData(
        item,
        normalizedType
      );

    const existing =
      await findExistingTitle(
        item.id
      );

    if (existing) {
      const updateData = {
        type:
          titleData.type,
        name:
          titleData.name,
        synopsis:
          titleData.synopsis,
        poster_url:
          titleData.poster_url,
        release_year:
          titleData.release_year,
        genres:
          titleData.genres,
        rating_avg:
          titleData.rating_avg,
        is_premium:
          typeof existing.is_premium ===
          'boolean'
            ? existing.is_premium
            : false,
      };

      /*
        Keep legacy titles.url compatible
        with the existing database.

        VideoPlayer does NOT depend on it anymore.
      */

      if (
        normalizedType === 'movie' &&
        !existing.url
      ) {
        updateData.url =
          VIDSRC_MOVIE(item.id);
      }

      const {
        data,
        error,
      } = await supabase
        .from('titles')
        .update(updateData)
        .eq(
          'id',
          existing.id
        )
        .select('*')
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

    if (
      normalizedType === 'movie'
    ) {
      insertData.url =
        VIDSRC_MOVIE(item.id);
    }

    const {
      data,
      error,
    } = await supabase
      .from('titles')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      if (
        error.code === '23505' &&
        String(
          error.message || ''
        )
          .toLowerCase()
          .includes(
            'titles_name_key'
          )
      ) {
        throw new Error(
          `العنوان "${titleData.name}" موجود مسبقاً باسم مختلف عن TMDB ID ${item.id}.`
        );
      }

      throw error;
    }

    return {
      title: data,
      created: true,
      updated: false,
    };
  };

  /* ============================================================
     EPISODES
  ============================================================ */

  const saveEpisodesForTitle =
    async (
      titleId,
      tmdbId,
      seasons,
      maxEpisodesPerSeason
    ) => {
      let count = 0;

      for (const season of seasons) {
        const seasonNumber =
          season.season_number;

        if (seasonNumber === 0) {
          continue;
        }

        const detail =
          await tmdbFetch(
            `/tv/${tmdbId}/season/${seasonNumber}`
          );

        const episodes =
          Array.isArray(
            detail?.episodes
          )
            ? detail.episodes
            : [];

        const selected =
          episodes.slice(
            0,
            maxEpisodesPerSeason
          );

        for (const episode of selected) {
          const episodeNumber =
            episode.episode_number;

          const streamUrls = {
            server1:
              VIDSRC_EPISODE(
                tmdbId,
                seasonNumber,
                episodeNumber
              ),

            server2:
              STELLAR_EPISODE(
                tmdbId,
                seasonNumber,
                episodeNumber
              ),
          };

          const episodeData = {
            title_id:
              titleId,

            season:
              seasonNumber,

            episode_number:
              episodeNumber,

            name:
              episode.name ||
              `الحلقة ${episodeNumber}`,

            duration_seconds:
              episode.runtime
                ? Number(
                    episode.runtime
                  ) * 60
                : null,

            stream_urls:
              streamUrls,
          };

          const {
            data:
              existingEpisode,
            error:
              findError,
          } =
            await supabase
              .from('episodes')
              .select('id')
              .eq(
                'title_id',
                titleId
              )
              .eq(
                'season',
                seasonNumber
              )
              .eq(
                'episode_number',
                episodeNumber
              )
              .limit(1)
              .maybeSingle();

          if (findError) {
            throw findError;
          }

          if (existingEpisode) {
            const {
              error:
                updateError,
            } =
              await supabase
                .from('episodes')
                .update({
                  name:
                    episodeData.name,

                  duration_seconds:
                    episodeData.duration_seconds,

                  stream_urls:
                    episodeData.stream_urls,
                })
                .eq(
                  'id',
                  existingEpisode.id
                );

            if (updateError) {
              throw updateError;
            }
          } else {
            const {
              error:
                insertError,
            } =
              await supabase
                .from('episodes')
                .insert(
                  episodeData
                );

            if (insertError) {
              throw insertError;
            }
          }

          count++;

          setStats((prev) => ({
            ...prev,
            episodes:
              prev.episodes + 1,
          }));
        }
      }

      return count;
    };

  /* ============================================================
     INDIVIDUAL SEARCH
  ============================================================ */

  const handleSingleSearch =
    async (event) => {
      event.preventDefault();

      if (
        !searchQuery.trim()
      ) {
        addLog(
          '⚠️ أدخل اسم العمل أو TMDB ID أولاً.',
          'warning'
        );
        return;
      }

      setIsSearching(true);
      setSearchResults([]);

      try {
        addLog(
          `🔎 البحث عن "${searchQuery}"...`,
          'info'
        );

        if (
          /^\d+$/.test(
            searchQuery.trim()
          )
        ) {
          const item =
            await tmdbFetch(
              `/${searchType}/${searchQuery.trim()}`
            );

          setSearchResults([
            item,
          ]);

          addLog(
            `✅ تم العثور على: ${getTitle(
              item
            )}`,
            'success'
          );
        } else {
          const data =
            await tmdbFetch(
              `/search/${searchType}`,
              {
                query:
                  searchQuery.trim(),
                page: 1,
              }
            );

          const results =
            data?.results || [];

          setSearchResults(
            results
          );

          addLog(
            results.length
              ? `✅ تم العثور على ${results.length} نتيجة.`
              : '⚠️ لا توجد نتائج.',
            results.length
              ? 'success'
              : 'warning'
          );
        }
      } catch (error) {
        addLog(
          `❌ فشل البحث: ${error.message}`,
          'error'
        );
      } finally {
        setIsSearching(false);
      }
    };

  /* ============================================================
     INDIVIDUAL IMPORT
  ============================================================ */

  const importSingleItem =
    async (item) => {
      if (!isAdmin) return;

      setIsToolLoading(true);

      try {
        const type =
          searchType === 'tv'
            ? 'series'
            : 'movie';

        setCurrentOperation(
          `استيراد ${getTitle(item)}`
        );

        const result =
          await saveTitle(
            item,
            type
          );

        updateStats({
          imported:
            stats.imported +
            (result.created
              ? 1
              : 0),

          updated:
            stats.updated +
            (result.created
              ? 0
              : 1),
        });

        addLog(
          result.created
            ? `🎉 تم إنشاء "${getTitle(item)}".`
            : `🔄 تم تحديث "${getTitle(item)}".`,
          'success'
        );

        if (
          type === 'series'
        ) {
          const details =
            await tmdbFetch(
              `/tv/${item.id}`
            );

          const seasons =
            Array.isArray(
              details?.seasons
            )
              ? details.seasons.filter(
                  (season) =>
                    season.season_number >
                    0
                )
              : [];

          if (seasons.length) {
            await saveEpisodesForTitle(
              result.title.id,
              item.id,
              seasons,
              9999
            );

            addLog(
              `🎞️ تم تحديث حلقات "${getTitle(item)}".`,
              'success'
            );
          }
        }
      } catch (error) {
        setStats((prev) => ({
          ...prev,
          failed:
            prev.failed + 1,
        }));

        addLog(
          `❌ فشل الاستيراد: ${error.message}`,
          'error'
        );
      } finally {
        setCurrentOperation('');
        setIsToolLoading(false);
      }
    };

  /* ============================================================
     BULK IMPORT
  ============================================================ */

  const getBulkTypes = () => {
    if (bulkType === 'movie') {
      return ['movie'];
    }

    if (bulkType === 'series') {
      return ['tv'];
    }

    return ['movie', 'tv'];
  };

  const importBulkPages =
    async ({
      endpointFactory,
      label,
    }) => {
      if (!isAdmin) return;

      setIsBulkLoading(true);
      resetOperationStats();

      try {
        const types =
          getBulkTypes();

        const estimatedTotal =
          Number(pageCount) *
          20 *
          types.length;

        updateStats({
          total:
            estimatedTotal,
        });

        let processed = 0;

        for (const type of types) {
          for (
            let page = 1;
            page <=
            Number(pageCount);
            page++
          ) {
            setCurrentOperation(
              `${label} — ${
                type === 'movie'
                  ? 'أفلام'
                  : 'مسلسلات'
              } — ${page}/${pageCount}`
            );

            const data =
              await tmdbFetch(
                endpointFactory(
                  type,
                  page
                )
              );

            const results =
              data?.results || [];

            for (const item of results) {
              processed++;

              try {
                const result =
                  await saveTitle(
                    item,
                    type
                  );

                setStats((prev) => ({
                  ...prev,
                  imported:
                    prev.imported +
                    (result.created
                      ? 1
                      : 0),
                  updated:
                    prev.updated +
                    (result.created
                      ? 0
                      : 1),
                  processed,
                }));

                setProgress(
                  Math.min(
                    100,
                    Math.round(
                      (processed /
                        Math.max(
                          estimatedTotal,
                          1
                        )) *
                        100
                    )
                  )
                );
              } catch (error) {
                setStats((prev) => ({
                  ...prev,
                  failed:
                    prev.failed + 1,
                  processed,
                }));

                addLog(
                  `❌ ${getTitle(item)}: ${error.message}`,
                  'error'
                );
              }
            }

            await sleep(150);
          }
        }

        setProgress(100);

        addLog(
          `🎉 اكتملت عملية ${label}.`,
          'success'
        );
      } catch (error) {
        addLog(
          `❌ توقفت العملية: ${error.message}`,
          'error'
        );
      } finally {
        setIsBulkLoading(false);
        setCurrentOperation('');
      }
    };

  const handleBulkPopularImport =
    () => {
      importBulkPages({
        endpointFactory:
          (type, page) =>
            `/${type}/popular?page=${page}`,

        label:
          'استيراد الأعمال الشائعة',
      });
    };

  /* ============================================================
     🌍 COUNTRY IMPORT
  ============================================================ */

  const getCountrySort = (
    type
  ) => {
    if (countrySort === 'popular') {
      return 'popularity.desc';
    }

    if (countrySort === 'rating') {
      return 'vote_average.desc';
    }

    if (type === 'movie') {
      return 'primary_release_date.desc';
    }

    return 'first_air_date.desc';
  };

  const getCountryEndpoint =
    (type, page) => {
      const endpoint =
        type === 'movie'
          ? '/discover/movie'
          : '/discover/tv';

      return {
        path: endpoint,
        params: {
          page,
          with_origin_country:
            countryCode,
          sort_by:
            getCountrySort(type),

          include_adult: false,

          include_video: false,

          /*
            For rating sorting, don't let
            titles with almost no votes
            dominate the list.
          */
          ...(countrySort ===
          'rating'
            ? {
                vote_count.gte:
                  20,
              }
            : {}),
        },
      };
    };

  const getCountryResults =
    async (
      type,
      requiredCount
    ) => {
      const results = [];
      const seen = new Set();

      let page = 1;

      /*
        TMDB returns roughly 20 results
        per page.

        Continue until we collect the
        requested amount or TMDB ends.
      */

      while (
        results.length <
          requiredCount &&
        page <= 500
      ) {
        const request =
          getCountryEndpoint(
            type,
            page
          );

        const data =
          await tmdbFetch(
            request.path,
            request.params
          );

        const pageResults =
          Array.isArray(
            data?.results
          )
            ? data.results
            : [];

        if (!pageResults.length) {
          break;
        }

        for (
          const item of pageResults
        ) {
          if (
            !item?.id ||
            seen.has(
              String(item.id)
            )
          ) {
            continue;
          }

          seen.add(
            String(item.id)
          );

          results.push(item);

          if (
            results.length >=
            requiredCount
          ) {
            break;
          }
        }

        if (
          page >=
          Number(
            data?.total_pages || 1
          )
        ) {
          break;
        }

        page++;

        await sleep(100);
      }

      return results;
    };

  const importCountryItem =
    async (
      item,
      type,
      index,
      total
    ) => {
      const normalizedType =
        normalizeType(type);

      try {
        setCurrentOperation(
          `🌍 ${index}/${total} — ${getTitle(
            item
          )}`
        );

        /*
          Fetch the full TMDB details
          before saving.

          This gives us:
          - full overview
          - genres
          - poster
          - release year
          - rating
          - TMDB ID
        */

        const endpoint =
          normalizedType ===
          'series'
            ? 'tv'
            : 'movie';

        const details =
          await tmdbFetch(
            `/${endpoint}/${item.id}`
          );

        const result =
          await saveTitle(
            details,
            normalizedType
          );

        setStats((prev) => ({
          ...prev,
          imported:
            prev.imported +
            (result.created
              ? 1
              : 0),

          updated:
            prev.updated +
            (result.created
              ? 0
              : 1),

          processed:
            prev.processed + 1,
        }));

        setProgress(
          Math.round(
            (index / total) *
              100
          )
        );

        addLog(
          result.created
            ? `🎬 ${index}/${total} — تم استيراد ${getTitle(
                details
              )}`
            : `🔄 ${index}/${total} — تم تحديث ${getTitle(
                details
              )}`,
          'success'
        );

        /*
          Automatically import episodes
          for country-imported TV shows.
        */

        if (
          normalizedType ===
            'series' &&
          countryImportEpisodes
        ) {
          const seasons =
            Array.isArray(
              details?.seasons
            )
              ? details.seasons.filter(
                  (season) =>
                    season.season_number >
                    0
                )
              : [];

          const limitedSeasons =
            seasons.slice(
              0,
              Math.max(
                1,
                Number(
                  countrySeasonLimit
                )
              )
            );

          if (
            limitedSeasons.length
          ) {
            await saveEpisodesForTitle(
              result.title.id,
              details.id,
              limitedSeasons,
              Math.max(
                1,
                Number(
                  countryEpisodesLimit
                )
              )
            );

            addLog(
              `📺 تم تحديث حلقات ${getTitle(
                details
              )}.`,
              'success'
            );
          }
        }

        return true;
      } catch (error) {
        setStats((prev) => ({
          ...prev,
          failed:
            prev.failed + 1,
          processed:
            prev.processed + 1,
        }));

        addLog(
          `❌ فشل ${getTitle(
            item
          )}: ${error.message}`,
          'error'
        );

        return false;
      }
    };

  const handleCountryImport =
    async () => {
      if (!isAdmin) return;

      const count = Math.max(
        1,
        Math.min(
          5000,
          Number(countryCount) ||
            1
        )
      );

      setIsCountryLoading(true);
      resetOperationStats();

      try {
        const selectedCountry =
          COUNTRIES.find(
            (country) =>
              country.code ===
              countryCode
          );

        const countryName =
          selectedCountry?.name ||
          countryCode;

        addLog(
          `🌍 بدء استيراد ${count} عمل من ${countryName}.`,
          'info'
        );

        let types = [];

        if (
          countryType ===
          'movie'
        ) {
          types = ['movie'];
        } else if (
          countryType ===
          'series'
        ) {
          types = ['tv'];
        } else {
          types = [
            'movie',
            'tv',
          ];
        }

        /*
          When "both" is selected,
          count means total requested
          across both types.
        */

        const perType =
          types.length === 1
            ? count
            : Math.ceil(
                count /
                  types.length
              );

        const allItems = [];

        for (
          const type of types
        ) {
          const items =
            await getCountryResults(
              type,
              perType
            );

          for (
            const item of items
          ) {
            allItems.push({
              item,
              type,
            });
          }
        }

        /*
          Keep the requested global
          count when both is selected.
        */

        const selectedItems =
          allItems.slice(
            0,
            count
          );

        updateStats({
          total:
            selectedItems.length,
        });

        if (
          !selectedItems.length
        ) {
          addLog(
            `⚠️ لم نجد أعمالاً من ${countryName} حسب الفلاتر الحالية.`,
            'warning'
          );
          return;
        }

        addLog(
          `📦 TMDB أعاد ${selectedItems.length} عمل للاستيراد.`,
          'info'
        );

        for (
          let index = 0;
          index <
          selectedItems.length;
          index++
        ) {
          const entry =
            selectedItems[index];

          await importCountryItem(
            entry.item,
            entry.type,
            index + 1,
            selectedItems.length
          );

          await sleep(120);
        }

        setProgress(100);

        addLog(
          `🎉 اكتمل الاستيراد حسب الدولة: ${countryName}.`,
          'success'
        );
      } catch (error) {
        addLog(
          `❌ فشل الاستيراد حسب الدولة: ${error.message}`,
          'error'
        );
      } finally {
        setIsCountryLoading(false);
        setCurrentOperation('');
      }
    };

  /* ============================================================
     TRENDING
  ============================================================ */

  const handleTrendingImport =
    async () => {
      if (!isAdmin) return;

      setIsTrendingLoading(true);
      resetOperationStats();

      try {
        addLog(
          '🔥 جاري جلب أحدث 20 عمل من Trending...',
          'info'
        );

        const data =
          await tmdbFetch(
            '/trending/all/week'
          );

        const results =
          Array.isArray(
            data?.results
          )
            ? data.results
                .filter(
                  (item) =>
                    item.media_type ===
                      'movie' ||
                    item.media_type ===
                      'tv'
                )
                .slice(0, 20)
            : [];

        updateStats({
          total:
            results.length,
        });

        for (
          let index = 0;
          index < results.length;
          index++
        ) {
          const item =
            results[index];

          try {
            const type =
              item.media_type ===
              'tv'
                ? 'series'
                : 'movie';

            const result =
              await saveTitle(
                item,
                type
              );

            setStats((prev) => ({
              ...prev,
              imported:
                prev.imported +
                (result.created
                  ? 1
                  : 0),

              updated:
                prev.updated +
                (result.created
                  ? 0
                  : 1),

              processed:
                index + 1,
            }));

            setProgress(
              Math.round(
                ((index + 1) /
                  results.length) *
                  100
              )
            );

            addLog(
              `✅ ${
                index + 1
              }/${results.length} — ${getTitle(
                item
              )}`,
              'success'
            );
          } catch (error) {
            setStats((prev) => ({
              ...prev,
              failed:
                prev.failed + 1,
              processed:
                index + 1,
            }));

            addLog(
              `❌ ${getTitle(
                item
              )}: ${error.message}`,
              'error'
            );
          }
        }

        addLog(
          '🔥 اكتمل استيراد Trending.',
          'success'
        );
      } catch (error) {
        addLog(
          `❌ فشل Trending: ${error.message}`,
          'error'
        );
      } finally {
        setIsTrendingLoading(false);
      }
    };

  /* ============================================================
     SERIES / EPISODES MANUAL
  ============================================================ */

  const handleSeriesEpisodesImport =
    async () => {
      if (!isAdmin) return;

      const tmdbId =
        seriesTmdbId.trim();

      if (
        !/^\d+$/.test(tmdbId)
      ) {
        addLog(
          '⚠️ أدخل TMDB ID صحيح للمسلسل.',
          'warning'
        );
        return;
      }

      setIsEpisodeLoading(true);
      resetOperationStats();

      try {
        const series =
          await tmdbFetch(
            `/tv/${tmdbId}`
          );

        const titleResult =
          await saveTitle(
            series,
            'series'
          );

        updateStats({
          imported:
            titleResult.created
              ? 1
              : 0,

          updated:
            titleResult.created
              ? 0
              : 1,
        });

        const seasons =
          Array.isArray(
            series?.seasons
          )
            ? series.seasons
                .filter(
                  (season) =>
                    season.season_number >
                    0
                )
                .slice(
                  0,
                  Math.max(
                    1,
                    Number(
                      seasonCount
                    )
                  )
                )
            : [];

        if (!seasons.length) {
          addLog(
            '⚠️ لا توجد مواسم متاحة.',
            'warning'
          );
          return;
        }

        addLog(
          `📚 سيتم استيراد ${seasons.length} موسم.`,
          'info'
        );

        let episodeTotal = 0;

        for (
          let index = 0;
          index < seasons.length;
          index++
        ) {
          const season =
            seasons[index];

          setCurrentOperation(
            `الموسم ${season.season_number} — ${
              index + 1
            }/${seasons.length}`
          );

          const detail =
            await tmdbFetch(
              `/tv/${tmdbId}/season/${season.season_number}`
            );

          const episodes =
            Array.isArray(
              detail?.episodes
            )
              ? detail.episodes.slice(
                  0,
                  Math.max(
                    1,
                    Number(
                      episodesPerSeason
                    )
                  )
                )
              : [];

          for (
            const episode of episodes
          ) {
            try {
              const episodeNumber =
                episode.episode_number;

              const streamUrls = {
                server1:
                  VIDSRC_EPISODE(
                    tmdbId,
                    season.season_number,
                    episodeNumber
                  ),

                server2:
                  STELLAR_EPISODE(
                    tmdbId,
                    season.season_number,
                    episodeNumber
                  ),
              };

              const episodeData = {
                title_id:
                  titleResult.title.id,

                season:
                  season.season_number,

                episode_number:
                  episodeNumber,

                name:
                  episode.name ||
                  `الحلقة ${episodeNumber}`,

                duration_seconds:
                  episode.runtime
                    ? Number(
                        episode.runtime
                      ) * 60
                    : null,

                stream_urls:
                  streamUrls,
              };

              const {
                data:
                  existingEpisode,
                error:
                  findError,
              } =
                await supabase
                  .from('episodes')
                  .select('id')
                  .eq(
                    'title_id',
                    titleResult.title.id
                  )
                  .eq(
                    'season',
                    season.season_number
                  )
                  .eq(
                    'episode_number',
                    episodeNumber
                  )
                  .limit(1)
                  .maybeSingle();

              if (findError) {
                throw findError;
              }

              if (existingEpisode) {
                const {
                  error:
                    updateError,
                } =
                  await supabase
                    .from('episodes')
                    .update(
                      episodeData
                    )
                    .eq(
                      'id',
                      existingEpisode.id
                    );

                if (updateError) {
                  throw updateError;
                }
              } else {
                const {
                  error:
                    insertError,
                } =
                  await supabase
                    .from('episodes')
                    .insert(
                      episodeData
                    );

                if (insertError) {
                  throw insertError;
                }
              }

              episodeTotal++;

              setStats((prev) => ({
                ...prev,
                episodes:
                  prev.episodes + 1,
                processed:
                  prev.processed + 1,
              }));
            } catch (error) {
              setStats((prev) => ({
                ...prev,
                failed:
                  prev.failed + 1,
              }));

              addLog(
                `❌ فشل S${season.season_number} E${episode.episode_number}: ${error.message}`,
                'error'
              );
            }
          }
        }

        setProgress(100);

        addLog(
          `🎉 اكتمل استيراد الحلقات. تم تحديث ${episodeTotal} حلقة.`,
          'success'
        );
      } catch (error) {
        addLog(
          `❌ فشل استيراد المواسم والحلقات: ${error.message}`,
          'error'
        );
      } finally {
        setIsEpisodeLoading(false);
        setCurrentOperation('');
      }
    };

  /* ============================================================
     FIX URLS
  ============================================================ */

  const handleFixUrls =
    async () => {
      if (!isAdmin) return;

      setIsToolLoading(true);
      resetOperationStats();

      try {
        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select('*');

        if (error) throw error;

        const list =
          titles || [];

        updateStats({
          total:
            list.length,
        });

        let fixed = 0;

        for (
          let index = 0;
          index < list.length;
          index++
        ) {
          const item =
            list[index];

          try {
            const normalizedType =
              normalizeType(
                item.type
              );

            const updateData = {};

            if (
              normalizedType !==
              item.type
            ) {
              updateData.type =
                normalizedType;
            }

            if (
              normalizedType ===
                'movie' &&
              !item.url &&
              item.tmdb_id
            ) {
              updateData.url =
                VIDSRC_MOVIE(
                  item.tmdb_id
                );
            }

            if (
              Object.keys(
                updateData
              ).length
            ) {
              const {
                error:
                  updateError,
              } =
                await supabase
                  .from('titles')
                  .update(
                    updateData
                  )
                  .eq(
                    'id',
                    item.id
                  );

              if (updateError) {
                throw updateError;
              }

              fixed++;
            }

            setProgress(
              Math.round(
                ((index + 1) /
                  Math.max(
                    list.length,
                    1
                  )) *
                  100
              )
            );
          } catch (error) {
            setStats((prev) => ({
              ...prev,
              failed:
                prev.failed + 1,
            }));

            addLog(
              `❌ فشل إصلاح ${item.name}: ${error.message}`,
              'error'
            );
          }
        }

        updateStats({
          updated: fixed,
          processed:
            list.length,
        });

        addLog(
          `✅ انتهى الإصلاح. تم تعديل ${fixed} سجل.`,
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

  /* ============================================================
     POSTERS
  ============================================================ */

  const handleFixPosters =
    async () => {
      if (!isAdmin) return;

      setIsToolLoading(true);
      resetOperationStats();

      try {
        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select(
              'id,tmdb_id,name,type,poster_url'
            );

        if (error) throw error;

        const list =
          titles || [];

        updateStats({
          total:
            list.length,
        });

        let fixed = 0;

        for (
          let index = 0;
          index < list.length;
          index++
        ) {
          const item =
            list[index];

          if (!item.tmdb_id) {
            continue;
          }

          try {
            const endpoint =
              normalizeType(
                item.type
              ) === 'series'
                ? 'tv'
                : 'movie';

            const tmdbItem =
              await tmdbFetch(
                `/${endpoint}/${item.tmdb_id}`
              );

            const posterUrl =
              getPoster(
                tmdbItem
              );

            if (
              posterUrl &&
              posterUrl !==
                item.poster_url
            ) {
              const {
                error:
                  updateError,
              } =
                await supabase
                  .from('titles')
                  .update({
                    poster_url:
                      posterUrl,
                  })
                  .eq(
                    'id',
                    item.id
                  );

              if (updateError) {
                throw updateError;
              }

              fixed++;
            }

            setProgress(
              Math.round(
                ((index + 1) /
                  Math.max(
                    list.length,
                    1
                  )) *
                  100
              )
            );
          } catch (error) {
            setStats((prev) => ({
              ...prev,
              failed:
                prev.failed + 1,
            }));

            addLog(
              `❌ Poster ${item.name}: ${error.message}`,
              'error'
            );
          }
        }

        updateStats({
          updated: fixed,
          processed:
            list.length,
        });

        addLog(
          `🖼️ اكتمل إصلاح Posters: ${fixed} سجل.`,
          'success'
        );
      } catch (error) {
        addLog(
          `❌ فشل إصلاح Posters: ${error.message}`,
          'error'
        );
      } finally {
        setIsToolLoading(false);
      }
    };

  /* ============================================================
     RATINGS
  ============================================================ */

  const handleUpdateRatings =
    async () => {
      if (!isAdmin) return;

      setIsToolLoading(true);
      resetOperationStats();

      try {
        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select(
              'id,tmdb_id,name,type,rating_avg'
            );

        if (error) throw error;

        const list =
          titles || [];

        updateStats({
          total:
            list.length,
        });

        let updated = 0;

        for (
          let index = 0;
          index < list.length;
          index++
        ) {
          const item =
            list[index];

          if (!item.tmdb_id) {
            continue;
          }

          try {
            const endpoint =
              normalizeType(
                item.type
              ) === 'series'
                ? 'tv'
                : 'movie';

            const tmdbItem =
              await tmdbFetch(
                `/${endpoint}/${item.tmdb_id}`
              );

            const {
              error:
                updateError,
            } =
              await supabase
                .from('titles')
                .update({
                  rating_avg:
                    getRating(
                      tmdbItem
                    ),
                })
                .eq(
                  'id',
                  item.id
                );

            if (updateError) {
              throw updateError;
            }

            updated++;

            setProgress(
              Math.round(
                ((index + 1) /
                  Math.max(
                    list.length,
                    1
                  )) *
                  100
              )
            );
          } catch (error) {
            setStats((prev) => ({
              ...prev,
              failed:
                prev.failed + 1,
            }));

            addLog(
              `❌ Rating ${item.name}: ${error.message}`,
              'error'
            );
          }
        }

        updateStats({
          updated,
          processed:
            list.length,
        });

        addLog(
          `⭐ تم تحديث ${updated} تقييم.`,
          'success'
        );
      } catch (error) {
        addLog(
          `❌ فشل تحديث التقييمات: ${error.message}`,
          'error'
        );
      } finally {
        setIsToolLoading(false);
      }
    };

  /* ============================================================
     FULL INFO
  ============================================================ */

  const handleUpdateInfo =
    async () => {
      if (!isAdmin) return;

      setIsToolLoading(true);
      resetOperationStats();

      try {
        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select(
              'id,tmdb_id,name,type,url'
            );

        if (error) throw error;

        const list =
          titles || [];

        updateStats({
          total:
            list.length,
        });

        let updated = 0;

        for (
          let index = 0;
          index < list.length;
          index++
        ) {
          const item =
            list[index];

          if (!item.tmdb_id) {
            continue;
          }

          try {
            const normalizedType =
              normalizeType(
                item.type
              );

            const endpoint =
              normalizedType ===
              'series'
                ? 'tv'
                : 'movie';

            const tmdbItem =
              await tmdbFetch(
                `/${endpoint}/${item.tmdb_id}`
              );

            const updateData = {
              type:
                normalizedType,

              name:
                getTitle(
                  tmdbItem
                ),

              synopsis:
                tmdbItem.overview ||
                null,

              poster_url:
                getPoster(
                  tmdbItem
                ),

              release_year:
                getYear(
                  tmdbItem
                ),

              genres:
                getGenres(
                  tmdbItem
                ),

              rating_avg:
                getRating(
                  tmdbItem
                ),
            };

            if (
              normalizedType ===
                'movie' &&
              !item.url
            ) {
              updateData.url =
                VIDSRC_MOVIE(
                  item.tmdb_id
                );
            }

            const {
              error:
                updateError,
            } =
              await supabase
                .from('titles')
                .update(
                  updateData
                )
                .eq(
                  'id',
                  item.id
                );

            if (updateError) {
              throw updateError;
            }

            updated++;

            setProgress(
              Math.round(
                ((index + 1) /
                  Math.max(
                    list.length,
                    1
                  )) *
                  100
              )
            );
          } catch (error) {
            setStats((prev) => ({
              ...prev,
              failed:
                prev.failed + 1,
            }));

            addLog(
              `❌ Info ${item.name}: ${error.message}`,
              'error'
            );
          }
        }

        updateStats({
          updated,
          processed:
            list.length,
        });

        addLog(
          `📝 تم تحديث معلومات ${updated} عمل.`,
          'success'
        );
      } catch (error) {
        addLog(
          `❌ فشل تحديث المعلومات: ${error.message}`,
          'error'
        );
      } finally {
        setIsToolLoading(false);
      }
    };

  /* ============================================================
     UI HELPERS
  ============================================================ */

  const clearLogs = () => {
    setLogs([]);
  };

  const busy =
    isSearching ||
    isBulkLoading ||
    isTrendingLoading ||
    isEpisodeLoading ||
    isToolLoading ||
    isCountryLoading;

  const statusText =
    useMemo(() => {
      if (authLoading) {
        return 'جاري التحقق من تسجيل الدخول...';
      }

      if (!user) {
        return 'غير مسجل الدخول';
      }

      if (adminLoading) {
        return 'جاري التحقق من صلاحيات الإدارة...';
      }

      if (!isAdmin) {
        return 'الحساب ليس Admin';
      }

      return 'Admin مفعل';
    }, [
      authLoading,
      user,
      adminLoading,
      isAdmin,
    ]);

  /* ============================================================
     LOADING
  ============================================================ */

  if (
    authLoading ||
    adminLoading
  ) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />

          <h2>
            🔐 {statusText}
          </h2>

          <p>
            يتم التحقق من صلاحيات
            الوصول...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.deniedCard}>
          <div style={styles.deniedIcon}>
            🔒
          </div>

          <h1>
            صفحة الإدارة محمية
          </h1>

          <p>
            يجب تسجيل الدخول بحساب
            StreamFlix للوصول إلى
            لوحة الاستيراد.
          </p>

          <button
            style={styles.primaryButton}
            onClick={() =>
              supabase.auth.signInWithOAuth(
                {
                  provider: 'google',
                  options: {
                    redirectTo:
                      window.location
                        .origin +
                      '/import',
                  },
                }
              )
            }
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={styles.centerPage}>
        <div style={styles.deniedCard}>
          <div style={styles.deniedIcon}>
            ⛔
          </div>

          <h1>
            لا تملك صلاحية Admin
          </h1>

          <p>
            الحساب الحالي:
          </p>

          <strong>
            {user.email ||
              user.id}
          </strong>

          {adminError && (
            <div style={styles.errorBox}>
              {adminError}
            </div>
          )}

          <button
            style={
              styles.secondaryButton
            }
            onClick={async () => {
              await supabase.auth.signOut();
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     DASHBOARD
  ============================================================ */

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}

        <header style={styles.header}>
          <div>
            <div style={styles.badge}>
              🔐 ADMIN
            </div>

            <h1 style={styles.title}>
              StreamFlix Import Center
            </h1>

            <p style={styles.subtitle}>
              لوحة الإدارة والاستيراد الآمنة
            </p>
          </div>

          <div style={styles.userCard}>
            <div style={styles.onlineDot} />

            <div>
              <strong>
                {user.email}
              </strong>

              <small style={styles.userRole}>
                صلاحيات Admin
              </small>
            </div>

            <button
              style={styles.logoutButton}
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              خروج
            </button>
          </div>
        </header>

        {/* OPERATION */}

        {currentOperation && (
          <div style={styles.operationBar}>
            <strong>
              ⚙️ {currentOperation}
            </strong>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progress}%`,
                }}
              />
            </div>

            <span>
              {progress}%
            </span>
          </div>
        )}

        {/* STATS */}

        <section style={styles.statsGrid}>
          <StatCard
            icon="🎬"
            label="مستورد"
            value={stats.imported}
          />

          <StatCard
            icon="🔄"
            label="محدث"
            value={stats.updated}
          />

          <StatCard
            icon="🎞️"
            label="الحلقات"
            value={stats.episodes}
          />

          <StatCard
            icon="❌"
            label="فشل"
            value={stats.failed}
          />

          <StatCard
            icon="📊"
            label="معالج"
            value={stats.processed}
          />

          <StatCard
            icon="📦"
            label="الإجمالي"
            value={stats.total}
          />
        </section>

        {/* SEARCH */}

        <section style={styles.card}>
          <SectionTitle
            icon="🔎"
            title="استيراد فردي"
            description="ابحث عن فيلم أو مسلسل ثم استورده مباشرة."
          />

          <form
            onSubmit={
              handleSingleSearch
            }
            style={styles.searchRow}
          >
            <input
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  e.target.value
                )
              }
              placeholder="اسم الفيلم / المسلسل أو TMDB ID"
              style={styles.input}
              disabled={busy}
            />

            <select
              value={searchType}
              onChange={(e) =>
                setSearchType(
                  e.target.value
                )
              }
              style={styles.select}
              disabled={busy}
            >
              <option value="movie">
                🎬 فيلم
              </option>

              <option value="tv">
                📺 مسلسل
              </option>
            </select>

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={busy}
            >
              {isSearching
                ? 'جاري البحث...'
                : '🔎 بحث'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div style={styles.resultsGrid}>
              {searchResults.map(
                (item) => (
                  <div
                    key={`${item.id}-${item.media_type || searchType}`}
                    style={styles.resultCard}
                  >
                    {item.poster_path ? (
                      <img
                        src={`${TMDB_IMAGE_BASE}/w185${item.poster_path}`}
                        alt=""
                        style={styles.poster}
                      />
                    ) : (
                      <div
                        style={
                          styles.noPoster
                        }
                      >
                        🎬
                      </div>
                    )}

                    <div
                      style={
                        styles.resultInfo
                      }
                    >
                      <strong>
                        {getTitle(item)}
                      </strong>

                      <small>
                        TMDB: {item.id}
                      </small>

                      <small>
                        ⭐{' '}
                        {getRating(item)}
                      </small>

                      <button
                        style={
                          styles.smallButton
                        }
                        disabled={busy}
                        onClick={() =>
                          importSingleItem(
                            item
                          )
                        }
                      >
                        ⬇️ استيراد
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* 🌍 COUNTRY IMPORT */}

        <section style={styles.countryCard}>
          <SectionTitle
            icon="🌍"
            title="استيراد جماعي حسب الدولة"
            description="جيب أحدث الأفلام أو المسلسلات من دولة تختارها، بعدد أنت تحدده، مع المعلومات والبوسترات وTMDB ID."
          />

          <div style={styles.countryHero}>
            <div>
              <strong>
                🌍 استيراد المحتوى حسب بلد المنشأ
              </strong>

              <p>
                مثال: اختر تركيا + أفلام + 50 + الأحدث، وسيتم جلب 50 فيلم تركي حسب بيانات TMDB.
              </p>
            </div>

            <div style={styles.countryIcon}>
              🌍
            </div>
          </div>

          <div style={styles.controlsGrid}>

            <div>
              <label style={styles.label}>
                الدولة
              </label>

              <select
                value={countryCode}
                onChange={(e) =>
                  setCountryCode(
                    e.target.value
                  )
                }
                style={styles.selectFull}
                disabled={busy}
              >
                {COUNTRIES.map(
                  (country) => (
                    <option
                      key={country.code}
                      value={country.code}
                    >
                      {country.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label style={styles.label}>
                نوع المحتوى
              </label>

              <select
                value={countryType}
                onChange={(e) =>
                  setCountryType(
                    e.target.value
                  )
                }
                style={styles.selectFull}
                disabled={busy}
              >
                <option value="movie">
                  🎬 أفلام فقط
                </option>

                <option value="series">
                  📺 مسلسلات فقط
                </option>

                <option value="both">
                  🎬📺 أفلام + مسلسلات
                </option>
              </select>
            </div>

            <div>
              <label style={styles.label}>
                عدد الأعمال
              </label>

              <input
                type="number"
                min="1"
                max="5000"
                value={countryCount}
                onChange={(e) =>
                  setCountryCount(
                    Math.max(
                      1,
                      Math.min(
                        5000,
                        Number(
                          e.target.value
                        ) || 1
                      )
                    )
                  )
                }
                style={styles.input}
                disabled={busy}
              />
            </div>

            <div>
              <label style={styles.label}>
                ترتيب النتائج
              </label>

              <select
                value={countrySort}
                onChange={(e) =>
                  setCountrySort(
                    e.target.value
                  )
                }
                style={styles.selectFull}
                disabled={busy}
              >
                <option value="newest">
                  🆕 الأحدث
                </option>

                <option value="popular">
                  🔥 الأكثر شعبية
                </option>

                <option value="rating">
                  ⭐ الأعلى تقييماً
                </option>
              </select>
            </div>
          </div>

          {/* SERIES OPTIONS */}

          {countryType !== 'movie' && (
            <div
              style={
                styles.countryOptions
              }
            >
              <div
                style={
                  styles.checkboxRow
                }
              >
                <input
                  type="checkbox"
                  checked={
                    countryImportEpisodes
                  }
                  onChange={(e) =>
                    setCountryImportEpisodes(
                      e.target.checked
                    )
                  }
                  disabled={busy}
                />

                <span>
                  📺 استيراد مواسم وحلقات المسلسلات تلقائياً
                </span>
              </div>

              {countryImportEpisodes && (
                <div
                  style={
                    styles.controlsGrid
                  }
                >
                  <div>
                    <label
                      style={
                        styles.label
                      }
                    >
                      أقصى عدد مواسم لكل مسلسل
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={
                        countrySeasonLimit
                      }
                      onChange={(e) =>
                        setCountrySeasonLimit(
                          Math.max(
                            1,
                            Math.min(
                              100,
                              Number(
                                e.target
                                  .value
                              ) || 1
                            )
                          )
                        )
                      }
                      style={
                        styles.input
                      }
                      disabled={busy}
                    />
                  </div>

                  <div>
                    <label
                      style={
                        styles.label
                      }
                    >
                      أقصى حلقات لكل موسم
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={
                        countryEpisodesLimit
                      }
                      onChange={(e) =>
                        setCountryEpisodesLimit(
                          Math.max(
                            1,
                            Math.min(
                              500,
                              Number(
                                e.target
                                  .value
                              ) || 1
                            )
                          )
                        )
                      }
                      style={
                        styles.input
                      }
                      disabled={busy}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            style={
              styles.countryButton
            }
            disabled={busy}
            onClick={
              handleCountryImport
            }
          >
            {isCountryLoading
              ? '🌍 جاري جلب واستيراد المحتوى...'
              : '🌍 بدء الاستيراد حسب الدولة'}
          </button>

          <div
            style={
              styles.countryInfo
            }
          >
            <span>
              🖼️ Posters + معلومات كاملة
            </span>

            <span>
              🆔 TMDB ID
            </span>

            <span>
              🎥 Vidsrc / Stellar / VidLink / YapGrid
            </span>
          </div>
        </section>

        {/* BULK */}

        <section style={styles.card}>
          <SectionTitle
            icon="📦"
            title="الاستيراد الجماعي"
            description="اختر النوع وعدد صفحات TMDB."
          />

          <div style={styles.controlsGrid}>
            <div>
              <label style={styles.label}>
                نوع المحتوى
              </label>

              <select
                value={bulkType}
                onChange={(e) =>
                  setBulkType(
                    e.target.value
                  )
                }
                style={styles.selectFull}
                disabled={busy}
              >
                <option value="both">
                  🎬📺 أفلام + مسلسلات
                </option>

                <option value="movie">
                  🎬 أفلام فقط
                </option>

                <option value="series">
                  📺 مسلسلات فقط
                </option>
              </select>
            </div>

            <div>
              <label style={styles.label}>
                عدد الصفحات
              </label>

              <input
                type="number"
                min="1"
                max="500"
                value={pageCount}
                onChange={(e) =>
                  setPageCount(
                    Math.max(
                      1,
                      Math.min(
                        500,
                        Number(
                          e.target.value
                        ) || 1
                      )
                    )
                  )
                }
                style={styles.input}
                disabled={busy}
              />
            </div>
          </div>

          <button
            style={
              styles.primaryWideButton
            }
            disabled={busy}
            onClick={
              handleBulkPopularImport
            }
          >
            📦 بدء الاستيراد الجماعي
          </button>
        </section>

        {/* TRENDING */}

        <section style={styles.card}>
          <SectionTitle
            icon="🔥"
            title="Trending"
            description="جلب أحدث 20 عمل Trending من TMDB."
          />

          <button
            style={styles.trendingButton}
            disabled={busy}
            onClick={
              handleTrendingImport
            }
          >
            {isTrendingLoading
              ? '🔥 جاري الاستيراد...'
              : '🔥 استيراد آخر 20 Trending'}
          </button>
        </section>

        {/* EPISODES */}

        <section style={styles.card}>
          <SectionTitle
            icon="📺"
            title="المواسم والحلقات"
            description="استيراد عدد محدد من المواسم والحلقات."
          />

          <div style={styles.controlsGrid}>
            <div>
              <label style={styles.label}>
                TMDB ID للمسلسل
              </label>

              <input
                value={seriesTmdbId}
                onChange={(e) =>
                  setSeriesTmdbId(
                    e.target.value
                  )
                }
                placeholder="مثال: 108978"
                style={styles.input}
                disabled={busy}
              />
            </div>

            <div>
              <label style={styles.label}>
                عدد المواسم
              </label>

              <input
                type="number"
                min="1"
                max="100"
                value={seasonCount}
                onChange={(e) =>
                  setSeasonCount(
                    Math.max(
                      1,
                      Math.min(
                        100,
                        Number(
                          e.target.value
                        ) || 1
                      )
                    )
                  )
                }
                style={styles.input}
                disabled={busy}
              />
            </div>

            <div>
              <label style={styles.label}>
                الحلقات لكل موسم
              </label>

              <input
                type="number"
                min="1"
                max="500"
                value={
                  episodesPerSeason
                }
                onChange={(e) =>
                  setEpisodesPerSeason(
                    Math.max(
                      1,
                      Math.min(
                        500,
                        Number(
                          e.target.value
                        ) || 1
                      )
                    )
                  )
                }
                style={styles.input}
                disabled={busy}
              />
            </div>
          </div>

          <button
            style={
              styles.primaryWideButton
            }
            disabled={busy}
            onClick={
              handleSeriesEpisodesImport
            }
          >
            📺 استيراد المواسم والحلقات
          </button>
        </section>

        {/* TOOLS */}

        <section style={styles.card}>
          <SectionTitle
            icon="🛠️"
            title="أدوات قاعدة البيانات"
            description="عمليات مستقلة لتحديث وإصلاح البيانات."
          />

          <div style={styles.toolsGrid}>
            <ToolButton
              icon="🛠️"
              text="إصلاح الروابط"
              onClick={
                handleFixUrls
              }
              disabled={busy}
            />

            <ToolButton
              icon="🖼️"
              text="إصلاح Posters"
              onClick={
                handleFixPosters
              }
              disabled={busy}
            />

            <ToolButton
              icon="⭐"
              text="تحديث Ratings"
              onClick={
                handleUpdateRatings
              }
              disabled={busy}
            />

            <ToolButton
              icon="📝"
              text="تحديث المعلومات"
              onClick={
                handleUpdateInfo
              }
              disabled={busy}
            />
          </div>
        </section>

        {/* SERVERS */}

        <section style={styles.card}>
          <SectionTitle
            icon="🎥"
            title="نظام المشغلات"
            description="المشغلات تعتمد على TMDB ID ويتم توليد الروابط أثناء التشغيل."
          />

          <div style={styles.serverGrid}>
            <ServerCard
              number="1"
              name="Vidsrc"
              description="Server 1"
            />

            <ServerCard
              number="2"
              name="Stellar"
              description="Server 2"
            />

            <ServerCard
              number="3"
              name="VidLink"
              description="Server 3"
            />

            <ServerCard
              number="4"
              name="YapGrid"
              description="👑 VIP Server"
              vip
            />
          </div>
        </section>

        {/* LOGS */}

        <section style={styles.card}>
          <div style={styles.logsHeader}>
            <SectionTitle
              icon="📜"
              title="سجل العمليات"
              description={`${logs.length} عملية مسجلة`}
            />

            <button
              style={styles.clearButton}
              onClick={clearLogs}
              disabled={!logs.length}
            >
              مسح السجل
            </button>
          </div>

          <div style={styles.logs}>
            {logs.length === 0 ? (
              <div style={styles.emptyLogs}>
                لا توجد عمليات بعد.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    ...styles.log,
                    borderRight:
                      `3px solid ${
                        log.type ===
                        'error'
                          ? '#ef4444'
                          : log.type ===
                            'success'
                          ? '#22c55e'
                          : log.type ===
                            'warning'
                          ? '#f59e0b'
                          : '#3b82f6'
                      }`,
                  }}
                >
                  <span
                    style={
                      styles.logTime
                    }
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
        </section>

        {/* SECURITY */}

        <section
          style={
            styles.securityNotice
          }
        >
          <div
            style={
              styles.securityIcon
            }
          >
            🔐
          </div>

          <div>
            <strong>
              الحماية الحالية
            </strong>

            <p>
              الصفحة تعتمد على Supabase
              Authentication و
              admin_users، وقاعدة البيانات
              محمية بواسطة RLS بحيث عمليات
              INSERT وUPDATE وDELETE لا
              يسمح بها إلا للحسابات الموجودة
              في admin_users.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================================================
   SMALL COMPONENTS
============================================================ */

function StatCard({
  icon,
  label,
  value,
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>
        {icon}
      </div>

      <div>
        <span style={styles.statLabel}>
          {label}
        </span>

        <strong style={styles.statValue}>
          {formatNumber(value)}
        </strong>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}) {
  return (
    <div style={styles.sectionTitle}>
      <div style={styles.sectionIcon}>
        {icon}
      </div>

      <div>
        <h2>
          {title}
        </h2>

        <p>
          {description}
        </p>
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  text,
  onClick,
  disabled,
}) {
  return (
    <button
      style={styles.toolButton}
      onClick={onClick}
      disabled={disabled}
    >
      <span>
        {icon}
      </span>

      {text}
    </button>
  );
}

function ServerCard({
  number,
  name,
  description,
  vip = false,
}) {
  return (
    <div
      style={{
        ...styles.serverCard,
        ...(vip
          ? styles.vipServerCard
          : {}),
      }}
    >
      <div
        style={{
          ...styles.serverNumber,
          ...(vip
            ? styles.vipServerNumber
            : {}),
        }}
      >
        {number}
      </div>

      <div>
        <strong>
          {vip && '👑 '}
          {name}
        </strong>

        <p>
          {description}
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top, #241018 0%, #090909 38%, #050505 100%)',
    color: '#fff',
    direction: 'rtl',
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding:
      '24px 14px 60px',
    boxSizing: 'border-box',
  },

  container: {
    maxWidth: '1250px',
    margin: '0 auto',
  },

  centerPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#070707',
    color: '#fff',
    padding: '20px',
    direction: 'rtl',
    fontFamily:
      'Inter, system-ui, sans-serif',
  },

  loadingCard: {
    width:
      'min(450px, 100%)',
    textAlign: 'center',
    padding:
      '40px 25px',
    borderRadius: '24px',
    background:
      'linear-gradient(145deg, #171717, #0d0d0d)',
    border:
      '1px solid rgba(255,255,255,.08)',
    boxShadow:
      '0 25px 70px rgba(0,0,0,.55)',
  },

  deniedCard: {
    width:
      'min(500px, 100%)',
    textAlign: 'center',
    padding:
      '42px 28px',
    borderRadius: '26px',
    background:
      'linear-gradient(145deg, #191919, #0b0b0b)',
    border:
      '1px solid rgba(229,9,20,.25)',
    boxShadow:
      '0 30px 90px rgba(0,0,0,.65)',
  },

  deniedIcon: {
    fontSize: '58px',
    marginBottom: '15px',
  },

  spinner: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    border:
      '4px solid rgba(255,255,255,.12)',
    borderTopColor:
      '#e50914',
    margin:
      '0 auto 20px',
  },

  header: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },

  badge: {
    display: 'inline-flex',
    padding: '6px 11px',
    borderRadius: '999px',
    background:
      'rgba(229,9,20,.12)',
    border:
      '1px solid rgba(229,9,20,.3)',
    color: '#ff6670',
    fontSize: '12px',
    fontWeight: 800,
    marginBottom: '10px',
  },

  title: {
    margin: 0,
    fontSize:
      'clamp(27px, 5vw, 44px)',
    fontWeight: 900,
    letterSpacing: '-1px',
  },

  subtitle: {
    color: '#999',
    margin:
      '8px 0 0',
    fontSize: '14px',
  },

  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding:
      '10px 12px',
    borderRadius: '15px',
    background:
      'rgba(255,255,255,.045)',
    border:
      '1px solid rgba(255,255,255,.08)',
  },

  userRole: {
    display: 'block',
    color: '#888',
    fontSize: '11px',
    marginTop: '3px',
  },

  onlineDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    background:
      '#22c55e',
    boxShadow:
      '0 0 12px rgba(34,197,94,.7)',
  },

  logoutButton: {
    border: 0,
    borderRadius: '10px',
    padding:
      '8px 12px',
    background:
      'rgba(255,255,255,.08)',
    color: '#fff',
    cursor: 'pointer',
  },

  operationBar: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(180px,1fr) minmax(150px,2fr) 50px',
    alignItems: 'center',
    gap: '15px',
    padding:
      '14px 16px',
    marginBottom: '18px',
    borderRadius: '16px',
    background:
      'rgba(229,9,20,.09)',
    border:
      '1px solid rgba(229,9,20,.2)',
  },

  progressTrack: {
    height: '9px',
    background:
      'rgba(255,255,255,.08)',
    borderRadius: '999px',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    background:
      'linear-gradient(90deg,#e50914,#ff5260)',
    borderRadius: '999px',
    transition:
      'width .25s ease',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(150px,1fr))',
    gap: '12px',
    marginBottom: '18px',
  },

  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderRadius: '17px',
    background:
      'linear-gradient(145deg,#171717,#101010)',
    border:
      '1px solid rgba(255,255,255,.07)',
  },

  statIcon: {
    fontSize: '25px',
  },

  statLabel: {
    display: 'block',
    color: '#888',
    fontSize: '12px',
    marginBottom: '3px',
  },

  statValue: {
    display: 'block',
    fontSize: '22px',
  },

  card: {
    background:
      'linear-gradient(145deg,rgba(25,25,25,.97),rgba(12,12,12,.97))',
    border:
      '1px solid rgba(255,255,255,.075)',
    borderRadius: '22px',
    padding: '22px',
    marginBottom: '18px',
    boxShadow:
      '0 18px 50px rgba(0,0,0,.18)',
  },

  countryCard: {
    background:
      'linear-gradient(145deg,rgba(29,22,14,.98),rgba(12,12,12,.98))',
    border:
      '1px solid rgba(245,158,11,.18)',
    borderRadius: '22px',
    padding: '22px',
    marginBottom: '18px',
    boxShadow:
      '0 18px 50px rgba(0,0,0,.25)',
  },

  countryHero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      'space-between',
    gap: '20px',
    padding: '16px',
    marginBottom: '18px',
    borderRadius: '16px',
    background:
      'rgba(245,158,11,.055)',
    border:
      '1px solid rgba(245,158,11,.12)',
  },

  countryIcon: {
    fontSize: '38px',
  },

  countryOptions: {
    marginTop: '4px',
    marginBottom: '15px',
    padding: '15px',
    borderRadius: '14px',
    background:
      'rgba(255,255,255,.025)',
    border:
      '1px solid rgba(255,255,255,.06)',
  },

  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    marginBottom: '15px',
    color: '#ddd',
    fontSize: '14px',
  },

  countryButton: {
    width: '100%',
    border: 0,
    borderRadius: '14px',
    background:
      'linear-gradient(135deg,#f59e0b,#d97706)',
    color: '#111',
    fontWeight: 900,
    cursor: 'pointer',
    padding: '15px',
    fontSize: '15px',
  },

  countryInfo: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
  },

  searchRow: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 150px 120px',
    gap: '10px',
  },

  controlsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(180px,1fr))',
    gap: '12px',
    marginBottom: '15px',
  },

  label: {
    display: 'block',
    color: '#aaa',
    fontSize: '13px',
    marginBottom: '7px',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding:
      '13px 14px',
    borderRadius: '12px',
    border:
      '1px solid rgba(255,255,255,.1)',
    background: '#0a0a0a',
    color: '#fff',
    outline: 'none',
    fontSize: '14px',
  },

  select: {
    padding:
      '13px 12px',
    borderRadius: '12px',
    border:
      '1px solid rgba(255,255,255,.1)',
    background: '#0a0a0a',
    color: '#fff',
    outline: 'none',
  },

  selectFull: {
    width: '100%',
    boxSizing: 'border-box',
    padding:
      '13px 12px',
    borderRadius: '12px',
    border:
      '1px solid rgba(255,255,255,.1)',
    background: '#0a0a0a',
    color: '#fff',
    outline: 'none',
  },

  primaryButton: {
    border: 0,
    borderRadius: '12px',
    background:
      'linear-gradient(135deg,#e50914,#b0060f)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
    padding:
      '0 18px',
    minHeight: '46px',
  },

  primaryWideButton: {
    width: '100%',
    border: 0,
    borderRadius: '13px',
    background:
      'linear-gradient(135deg,#e50914,#b0060f)',
    color: '#fff',
    fontWeight: 850,
    cursor: 'pointer',
    padding: '14px',
    fontSize: '15px',
  },

  trendingButton: {
    width: '100%',
    border:
      '1px solid rgba(245,158,11,.35)',
    borderRadius: '13px',
    background:
      'rgba(245,158,11,.09)',
    color: '#fbbf24',
    fontWeight: 850,
    cursor: 'pointer',
    padding: '14px',
    fontSize: '15px',
  },

  secondaryButton: {
    marginTop: '20px',
    border:
      '1px solid rgba(255,255,255,.1)',
    borderRadius: '12px',
    background:
      'rgba(255,255,255,.05)',
    color: '#fff',
    padding:
      '12px 20px',
    cursor: 'pointer',
  },

  smallButton: {
    marginTop: 'auto',
    border: 0,
    borderRadius: '9px',
    background: '#e50914',
    color: '#fff',
    padding:
      '8px 10px',
    cursor: 'pointer',
    fontWeight: 750,
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
    gap: '11px',
    padding: '10px',
    borderRadius: '15px',
    background:
      'rgba(255,255,255,.035)',
    border:
      '1px solid rgba(255,255,255,.06)',
    minHeight: '135px',
  },

  poster: {
    width: '80px',
    height: '120px',
    objectFit: 'cover',
    borderRadius: '9px',
    background: '#111',
    flexShrink: 0,
  },

  noPoster: {
    width: '80px',
    height: '120px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    fontSize: '30px',
    flexShrink: 0,
  },

  resultInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },

  toolsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(180px,1fr))',
    gap: '10px',
  },

  toolButton: {
    border:
      '1px solid rgba(255,255,255,.08)',
    borderRadius: '13px',
    background:
      'rgba(255,255,255,.04)',
    color: '#fff',
    padding: '14px',
    cursor: 'pointer',
    fontWeight: 750,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '9px',
  },

  serverGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(220px,1fr))',
    gap: '12px',
  },

  serverCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '17px',
    borderRadius: '15px',
    background:
      'rgba(255,255,255,.035)',
    border:
      '1px solid rgba(255,255,255,.07)',
  },

  vipServerCard: {
    background:
      'linear-gradient(145deg,rgba(245,158,11,.10),rgba(255,255,255,.025))',
    border:
      '1px solid rgba(245,158,11,.28)',
  },

  serverNumber: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'rgba(229,9,20,.12)',
    color: '#ff6670',
    fontSize: '18px',
    fontWeight: 900,
  },

  vipServerNumber: {
    background:
      'rgba(245,158,11,.14)',
    color: '#fbbf24',
  },

  logsHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent:
      'space-between',
    gap: '15px',
  },

  clearButton: {
    border:
      '1px solid rgba(255,255,255,.08)',
    background:
      'rgba(255,255,255,.04)',
    color: '#aaa',
    padding:
      '8px 12px',
    borderRadius: '9px',
    cursor: 'pointer',
  },

  logs: {
    maxHeight: '450px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    padding: '5px',
    background: '#080808',
    borderRadius: '14px',
  },

  log: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    padding:
      '8px 10px',
    background:
      'rgba(255,255,255,.025)',
    borderRadius: '7px',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  logTime: {
    color: '#666',
    fontFamily:
      'monospace',
    direction: 'ltr',
    flexShrink: 0,
  },

  emptyLogs: {
    padding: '30px',
    textAlign: 'center',
    color: '#666',
  },

  sectionTitle: {
    display: 'flex',
    gap: '13px',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },

  sectionIcon: {
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '13px',
    background:
      'rgba(229,9,20,.11)',
    fontSize: '20px',
    flexShrink: 0,
  },

  securityNotice: {
    display: 'flex',
    gap: '15px',
    padding: '18px',
    borderRadius: '18px',
    background:
      'rgba(34,197,94,.055)',
    border:
      '1px solid rgba(34,197,94,.15)',
  },

  securityIcon: {
    fontSize: '30px',
  },

  errorBox: {
    marginTop: '18px',
    padding: '12px',
    borderRadius: '10px',
    background:
      'rgba(239,68,68,.1)',
    border:
      '1px solid rgba(239,68,68,.2)',
    color: '#fca5a5',
    fontSize: '13px',
    textAlign: 'right',
  },
};

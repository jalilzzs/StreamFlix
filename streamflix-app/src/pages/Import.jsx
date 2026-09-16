import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/*
  ============================================================
  StreamFlix - Secure Import Dashboard
  ============================================================

  Security model:
  - Supabase Auth identifies the user.
  - admin_users determines who is an administrator.
  - Database RLS protects INSERT / UPDATE / DELETE.
  - No PIN is used.

  TMDB:
  - API key is read from VITE_TMDB_API_KEY
  - NEVER hardcode the TMDB API key in this file.

  Database:
  titles:
    id
    type
    name
    synopsis
    poster_url
    release_year
    genres
    rating_avg
    is_premium
    created_at
    url
    tmdb_id

  episodes:
    id
    title_id
    season
    episode_number
    name
    duration_seconds
    stream_urls

  Servers:
    Server 1 = Vidsrc
    Server 2 = Stellar
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
   HELPERS
============================================================ */

function normalizeType(type) {
  if (
    type === 'tv' ||
    type === 'series'
  ) {
    return 'series';
  }

  return 'movie';
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
  if (!Array.isArray(item?.genres)) {
    return [];
  }

  return item.genres
    .map((genre) => genre?.name)
    .filter(Boolean);
}

function getRating(item) {
  const value = Number(
    item?.vote_average
  );

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
     AUTH CHECK
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

        if (error) {
          throw error;
        }

        if (!mounted) return;

        setIsAdmin(Boolean(data));
      } catch (error) {
        if (!mounted) return;

        setIsAdmin(false);

        const message =
          String(
            error?.message || ''
          ).toLowerCase();

        if (
          message.includes(
            'admin_users'
          )
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

      if (
        response.status === 401
      ) {
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
     DATABASE HELPERS
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

      if (error) {
        throw error;
      }

      return data || null;
    };

  const buildTitleData = (
    item,
    type
  ) => {
    const normalizedType =
      normalizeType(type);

    return {
      type: normalizedType,
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

      if (error) {
        throw error;
      }

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
     SAVE EPISODES
  ============================================================ */

  const saveEpisodesForTitle =
    async (
      titleId,
      tmdbId,
      seasons,
      maxEpisodesPerSeason
    ) => {
      let insertedOrUpdated = 0;

      for (const season of seasons) {
        const seasonNumber =
          season.season_number;

        if (
          seasonNumber === 0
        ) {
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

        const selectedEpisodes =
          episodes.slice(
            0,
            maxEpisodesPerSeason
          );

        for (
          const episode of selectedEpisodes
        ) {
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
                .from(
                  'episodes'
                )
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
                .from(
                  'episodes'
                )
                .insert(
                  episodeData
                );

            if (insertError) {
              throw insertError;
            }
          }

          insertedOrUpdated++;

          setStats((prev) => ({
            ...prev,
            episodes:
              prev.episodes + 1,
          }));
        }
      }

      return insertedOrUpdated;
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

          if (
            results.length
          ) {
            addLog(
              `✅ تم العثور على ${results.length} نتيجة.`,
              'success'
            );
          } else {
            addLog(
              '⚠️ لا توجد نتائج.',
              'warning'
            );
          }
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
          `استيراد ${getTitle(
            item
          )}`
        );

        addLog(
          `⏳ بدء استيراد "${getTitle(
            item
          )}"...`,
          'info'
        );

        const result =
          await saveTitle(
            item,
            type
          );

        if (
          result.created
        ) {
          setStats(
            (prev) => ({
              ...prev,
              imported:
                prev.imported +
                1,
            })
          );

          addLog(
            `🎉 تم إنشاء "${getTitle(
              item
            )}" بنجاح.`,
            'success'
          );
        } else {
          setStats(
            (prev) => ({
              ...prev,
              updated:
                prev.updated +
                1,
            })
          );

          addLog(
            `🔄 تم تحديث "${getTitle(
              item
            )}".`,
            'success'
          );
        }

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
              ? details.seasons
              : [];

          const validSeasons =
            seasons.filter(
              (season) =>
                season.season_number >
                0
            );

          if (
            validSeasons.length
          ) {
            addLog(
              `📺 المسلسل يحتوي على ${validSeasons.length} موسم.`,
              'info'
            );

            await saveEpisodesForTitle(
              result.title.id,
              item.id,
              validSeasons,
              9999
            );

            addLog(
              `🎞️ تم تحديث حلقات "${getTitle(
                item
              )}".`,
              'success'
            );
          }
        }
      } catch (error) {
        setStats(
          (prev) => ({
            ...prev,
            failed:
              prev.failed + 1,
          })
        );

        addLog(
          `❌ فشل استيراد "${getTitle(
            item
          )}": ${error.message}`,
          'error'
        );
      } finally {
        setCurrentOperation('');
        setIsToolLoading(false);
      }
    };

  /* ============================================================
     BULK HELPERS
  ============================================================ */

  const getBulkTypes =
    () => {
      if (
        bulkType === 'movie'
      ) {
        return ['movie'];
      }

      if (
        bulkType === 'series'
      ) {
        return ['tv'];
      }

      return [
        'movie',
        'tv',
      ];
    };

  const getPopularEndpoint =
    (type, page) =>
      `/${type}/popular`;

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

        addLog(
          `🚀 بدء ${label}. النوع: ${bulkType}. الصفحات: ${pageCount}.`,
          'info'
        );

        const estimatedTotal =
          Number(pageCount) *
          20 *
          types.length;

        updateStats({
          total:
            estimatedTotal,
        });

        let processed = 0;

        for (
          const type of types
        ) {
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
              } — الصفحة ${page}/${pageCount}`
            );

            addLog(
              `📥 جلب ${
                type === 'movie'
                  ? 'الأفلام'
                  : 'المسلسلات'
              } — الصفحة ${page}/${pageCount}...`,
              'info'
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

            addLog(
              `📦 الصفحة ${page}: ${results.length} عنصر.`,
              'info'
            );

            for (
              const item of results
            ) {
              processed++;

              try {
                const result =
                  await saveTitle(
                    item,
                    type
                  );

                setStats(
                  (prev) => ({
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
                  })
                );

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
                setStats(
                  (prev) => ({
                    ...prev,
                    failed:
                      prev.failed +
                      1,
                    processed,
                  })
                );

                addLog(
                  `❌ فشل "${getTitle(
                    item
                  )}": ${error.message}`,
                  'error'
                );
              }
            }

            addLog(
              `✅ انتهت الصفحة ${page}/${pageCount}.`,
              'success'
            );

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

  /* ============================================================
     POPULAR
  ============================================================ */

  const handleBulkPopularImport =
    () => {
      importBulkPages({
        endpointFactory:
          (type, page) =>
            getPopularEndpoint(
              type,
              page
            ),

        label:
          'استيراد الأعمال الشائعة',
      });
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

        if (
          !results.length
        ) {
          addLog(
            '⚠️ لم يتم العثور على أعمال Trending.',
            'warning'
          );
          return;
        }

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

            setStats(
              (prev) => ({
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
              })
            );

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
              }/20 — ${getTitle(
                item
              )}`,
              'success'
            );
          } catch (error) {
            setStats(
              (prev) => ({
                ...prev,
                failed:
                  prev.failed + 1,
                processed:
                  index + 1,
              })
            );

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
     SERIES / EPISODE IMPORT
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
        setCurrentOperation(
          `جلب معلومات المسلسل ${tmdbId}`
        );

        addLog(
          `📺 جاري جلب المسلسل TMDB ${tmdbId}...`,
          'info'
        );

        const series =
          await tmdbFetch(
            `/tv/${tmdbId}`
          );

        const titleResult =
          await saveTitle(
            series,
            'series'
          );

        if (
          titleResult.created
        ) {
          updateStats({
            imported: 1,
          });
        } else {
          updateStats({
            updated: 1,
          });
        }

        const allSeasons =
          Array.isArray(
            series?.seasons
          )
            ? series.seasons
            : [];

        const seasons =
          allSeasons
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
            );

        if (
          !seasons.length
        ) {
          addLog(
            '⚠️ لا توجد مواسم متاحة.',
            'warning'
          );
          return;
        }

        addLog(
          `📚 سيتم استيراد ${seasons.length} موسم، بحد أقصى ${episodesPerSeason} حلقة لكل موسم.`,
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

          addLog(
            `📥 جلب الموسم ${season.season_number}...`,
            'info'
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
                  titleResult
                    .title.id,

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
                  .from(
                    'episodes'
                  )
                  .select('id')
                  .eq(
                    'title_id',
                    titleResult
                      .title.id
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

              if (
                existingEpisode
              ) {
                const {
                  error:
                    updateError,
                } =
                  await supabase
                    .from(
                      'episodes'
                    )
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

                if (
                  updateError
                ) {
                  throw updateError;
                }
              } else {
                const {
                  error:
                    insertError,
                } =
                  await supabase
                    .from(
                      'episodes'
                    )
                    .insert(
                      episodeData
                    );

                if (
                  insertError
                ) {
                  throw insertError;
                }
              }

              episodeTotal++;

              setStats(
                (prev) => ({
                  ...prev,
                  episodes:
                    prev.episodes +
                    1,
                  processed:
                    prev.processed +
                    1,
                })
              );

              addLog(
                `🎞️ S${season.season_number} E${episodeNumber} — ${
                  episode.name ||
                  `الحلقة ${episodeNumber}`
                }`,
                'success'
              );
            } catch (error) {
              setStats(
                (prev) => ({
                  ...prev,
                  failed:
                    prev.failed +
                    1,
                })
              );

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
        setCurrentOperation(
          'فحص وإصلاح الروابط'
        );

        addLog(
          '🛠️ بدء فحص وإصلاح بيانات الروابط...',
          'info'
        );

        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select('*');

        if (error) {
          throw error;
        }

        if (!titles?.length) {
          addLog(
            'ℹ️ قاعدة البيانات فارغة.',
            'info'
          );
          return;
        }

        updateStats({
          total:
            titles.length,
        });

        let fixed = 0;

        for (
          let index = 0;
          index < titles.length;
          index++
        ) {
          const item =
            titles[index];

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
                  titles.length) *
                  100
              )
            );
          } catch (error) {
            setStats(
              (prev) => ({
                ...prev,
                failed:
                  prev.failed +
                  1,
              })
            );

            addLog(
              `❌ فشل إصلاح ${item.name}: ${error.message}`,
              'error'
            );
          }
        }

        updateStats({
          updated: fixed,
          processed:
            titles.length,
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
     POSTER REPAIR
  ============================================================ */

  const handleFixPosters =
    async () => {
      if (!isAdmin) return;

      setIsToolLoading(true);
      resetOperationStats();

      try {
        addLog(
          '🖼️ بدء إصلاح Posters...',
          'info'
        );

        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select(
              'id,tmdb_id,name,type,poster_url'
            );

        if (error) {
          throw error;
        }

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
            setStats(
              (prev) => ({
                ...prev,
                failed:
                  prev.failed +
                  1,
              })
            );

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
     RATING UPDATE
  ============================================================ */

  const handleUpdateRatings =
    async () => {
      if (!isAdmin) return;

      setIsToolLoading(true);
      resetOperationStats();

      try {
        addLog(
          '⭐ بدء تحديث التقييمات من TMDB...',
          'info'
        );

        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select(
              'id,tmdb_id,name,type,rating_avg'
            );

        if (error) {
          throw error;
        }

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

            const rating =
              getRating(
                tmdbItem
              );

            const {
              error:
                updateError,
            } =
              await supabase
                .from('titles')
                .update({
                  rating_avg:
                    rating,
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
            setStats(
              (prev) => ({
                ...prev,
                failed:
                  prev.failed +
                  1,
              })
            );

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
     FULL INFO UPDATE
  ============================================================ */

  const handleUpdateInfo =
    async () => {
      if (!isAdmin) return;

      setIsToolLoading(true);
      resetOperationStats();

      try {
        addLog(
          '📝 بدء تحديث معلومات الأعمال...',
          'info'
        );

        const {
          data: titles,
          error,
        } =
          await supabase
            .from('titles')
            .select(
              'id,tmdb_id,name,type,url'
            );

        if (error) {
          throw error;
        }

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
            setStats(
              (prev) => ({
                ...prev,
                failed:
                  prev.failed +
                  1,
              })
            );

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
     LOG CLEAR
  ============================================================ */

  const clearLogs = () => {
    setLogs([]);
  };

  /* ============================================================
     MEMO
  ============================================================ */

  const busy =
    isSearching ||
    isBulkLoading ||
    isTrendingLoading ||
    isEpisodeLoading ||
    isToolLoading;

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
     LOADING / AUTH UI
  ============================================================ */

  if (
    authLoading ||
    adminLoading
  ) {
    return (
      <div style={styles.centerPage}>
        <div
          style={styles.loadingCard}
        >
          <div
            style={styles.spinner}
          />

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
        <div
          style={styles.deniedCard}
        >
          <div
            style={styles.deniedIcon}
          >
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
            style={
              styles.primaryButton
            }
            onClick={() =>
              supabase.auth.signInWithOAuth(
                {
                  provider:
                    'google',

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
        <div
          style={styles.deniedCard}
        >
          <div
            style={styles.deniedIcon}
          >
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
            <div
              style={styles.errorBox}
            >
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
     MAIN DASHBOARD
  ============================================================ */

  return (
    <div style={styles.page}>
      <div
        style={styles.container}
      >
        {/* HEADER */}

        <header
          style={styles.header}
        >
          <div>
            <div
              style={styles.badge}
            >
              🔐 ADMIN
            </div>

            <h1
              style={styles.title}
            >
              StreamFlix Import
              Center
            </h1>

            <p
              style={styles.subtitle}
            >
              لوحة الإدارة والاستيراد
              الآمنة
            </p>
          </div>

          <div
            style={styles.userCard}
          >
            <div
              style={
                styles.onlineDot
              }
            />

            <div>
              <strong>
                {user.email}
              </strong>

              <small
                style={
                  styles.userRole
                }
              >
                صلاحيات Admin
              </small>
            </div>

            <button
              style={
                styles.logoutButton
              }
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              خروج
            </button>
          </div>
        </header>

        {/* CURRENT OPERATION */}

        {currentOperation && (
          <div
            style={
              styles.operationBar
            }
          >
            <div>
              <strong>
                ⚙️{' '}
                {
                  currentOperation
                }
              </strong>
            </div>

            <div
              style={
                styles.progressTrack
              }
            >
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

        <section
          style={styles.statsGrid}
        >
          <StatCard
            icon="🎬"
            label="مستورد"
            value={
              stats.imported
            }
          />

          <StatCard
            icon="🔄"
            label="محدث"
            value={
              stats.updated
            }
          />

          <StatCard
            icon="🎞️"
            label="الحلقات"
            value={
              stats.episodes
            }
          />

          <StatCard
            icon="❌"
            label="فشل"
            value={
              stats.failed
            }
          />

          <StatCard
            icon="📊"
            label="معالج"
            value={
              stats.processed
            }
          />

          <StatCard
            icon="📦"
            label="الإجمالي"
            value={
              stats.total
            }
          />
        </section>

        {/* SEARCH */}

        <section
          style={styles.card}
        >
          <SectionTitle
            icon="🔎"
            title="استيراد فردي"
            description="ابحث عن فيلم أو مسلسل ثم استورده مباشرة."
          />

          <form
            onSubmit={
              handleSingleSearch
            }
            style={
              styles.searchRow
            }
          >
            <input
              value={
                searchQuery
              }
              onChange={(e) =>
                setSearchQuery(
                  e.target.value
                )
              }
              placeholder="اسم الفيلم / المسلسل أو TMDB ID"
              style={
                styles.input
              }
              disabled={busy}
            />

            <select
              value={
                searchType
              }
              onChange={(e) =>
                setSearchType(
                  e.target.value
                )
              }
              style={
                styles.select
              }
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
              style={
                styles.primaryButton
              }
              disabled={busy}
            >
              {isSearching
                ? 'جاري البحث...'
                : '🔎 بحث'}
            </button>
          </form>

          {searchResults.length >
            0 && (
            <div
              style={
                styles.resultsGrid
              }
            >
              {searchResults.map(
                (item) => (
                  <div
                    key={`${item.id}-${item.media_type || searchType}`}
                    style={
                      styles.resultCard
                    }
                  >
                    {item.poster_path ? (
                      <img
                        src={`${TMDB_IMAGE_BASE}/w185${item.poster_path}`}
                        alt=""
                        style={
                          styles.poster
                        }
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
                        {getTitle(
                          item
                        )}
                      </strong>

                      <small>
                        TMDB:{' '}
                        {item.id}
                      </small>

                      <small>
                        ⭐{' '}
                        {getRating(
                          item
                        )}
                      </small>

                      <button
                        style={
                          styles.smallButton
                        }
                        disabled={
                          busy
                        }
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

        {/* BULK IMPORT */}

        <section
          style={styles.card}
        >
          <SectionTitle
            icon="📦"
            title="الاستيراد الجماعي"
            description="اختر النوع وعدد صفحات TMDB."
          />

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
                نوع المحتوى
              </label>

              <select
                value={
                  bulkType
                }
                onChange={(e) =>
                  setBulkType(
                    e.target.value
                  )
                }
                style={
                  styles.selectFull
                }
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
              <label
                style={
                  styles.label
                }
              >
                عدد الصفحات
              </label>

              <input
                type="number"
                min="1"
                max="500"
                value={
                  pageCount
                }
                onChange={(e) =>
                  setPageCount(
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

        <section
          style={styles.card}
        >
          <SectionTitle
            icon="🔥"
            title="Trending"
            description="جلب أحدث 20 عمل Trending من TMDB."
          />

          <button
            style={
              styles.trendingButton
            }
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

        {/* SERIES EPISODES */}

        <section
          style={styles.card}
        >
          <SectionTitle
            icon="📺"
            title="المواسم والحلقات"
            description="استيراد عدد محدد من المواسم والحلقات مع Vidsrc + Stellar."
          />

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
                TMDB ID للمسلسل
              </label>

              <input
                value={
                  seriesTmdbId
                }
                onChange={(e) =>
                  setSeriesTmdbId(
                    e.target.value
                  )
                }
                placeholder="مثال: 108978"
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
                عدد المواسم
              </label>

              <input
                type="number"
                min="1"
                max="100"
                value={
                  seasonCount
                }
                onChange={(e) =>
                  setSeasonCount(
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

        <section
          style={styles.card}
        >
          <SectionTitle
            icon="🛠️"
            title="أدوات قاعدة البيانات"
            description="عمليات مستقلة لتحديث وإصلاح البيانات."
          />

          <div
            style={
              styles.toolsGrid
            }
          >
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

        <section
          style={styles.card}
        >
          <SectionTitle
            icon="🎥"
            title="نظام المشغلات"
            description="المصادر التي يتم إنشاؤها أثناء الاستيراد."
          />

          <div
            style={
              styles.serverGrid
            }
          >
            <div
              style={
                styles.serverCard
              }
            >
              <div
                style={
                  styles.serverNumber
                }
              >
                1
              </div>

              <div>
                <strong>
                  Vidsrc
                </strong>

                <p>
                  Server 1
                </p>
              </div>
            </div>

            <div
              style={
                styles.serverCard
              }
            >
              <div
                style={
                  styles.serverNumber
                }
              >
                2
              </div>

              <div>
                <strong>
                  Stellar
                </strong>

                <p>
                  Server 2
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* LOGS */}

        <section
          style={styles.card}
        >
          <div
            style={
              styles.logsHeader
            }
          >
            <SectionTitle
              icon="📜"
              title="سجل العمليات"
              description={`${logs.length} عملية مسجلة`}
            />

            <button
              style={
                styles.clearButton
              }
              onClick={
                clearLogs
              }
              disabled={
                !logs.length
              }
            >
              مسح السجل
            </button>
          </div>

          <div
            style={styles.logs}
          >
            {logs.length ===
            0 ? (
              <div
                style={
                  styles.emptyLogs
                }
              >
                لا توجد عمليات بعد.
              </div>
            ) : (
              logs.map(
                (log) => (
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
                      {
                        log.message
                      }
                    </span>
                  </div>
                )
              )
            )}
          </div>
        </section>

        {/* SECURITY NOTICE */}

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
    <div
      style={styles.statCard}
    >
      <div
        style={styles.statIcon}
      >
        {icon}
      </div>

      <div>
        <span
          style={
            styles.statLabel
          }
        >
          {label}
        </span>

        <strong
          style={
            styles.statValue
          }
        >
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
    <div
      style={
        styles.sectionTitle
      }
    >
      <div
        style={
          styles.sectionIcon
        }
      >
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
      style={
        styles.toolButton
      }
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
      'minmax(180px, 1fr) minmax(150px, 2fr) 50px',
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
      'linear-gradient(90deg, #e50914, #ff5260)',
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
      'linear-gradient(145deg, #171717, #101010)',
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
      'linear-gradient(145deg, rgba(25,25,25,.97), rgba(12,12,12,.97))',
    border:
      '1px solid rgba(255,255,255,.075)',
    borderRadius: '22px',
    padding: '22px',
    marginBottom: '18px',
    boxShadow:
      '0 18px 50px rgba(0,0,0,.18)',
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

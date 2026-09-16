import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';

const TMDB_READ_ACCESS_TOKEN =
  import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN;

const PLACEHOLDER_POSTER =
  'https://via.placeholder.com/342x513?text=No+Poster';

export default function Import() {
  // =========================================================
  // البحث الفردي
  // =========================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('movie');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // =========================================================
  // الاستيراد الجماعي
  // =========================================================
  const [bulkPages, setBulkPages] = useState('');
  const [bulkType, setBulkType] = useState('both');
  const [bulkSource, setBulkSource] = useState('popular');
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // =========================================================
  // Trending
  // =========================================================
  const [trendingCount, setTrendingCount] = useState('');
  const [trendingType, setTrendingType] = useState('both');
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);

  // =========================================================
  // مسلسل + حلقات
  // =========================================================
  const [seriesQuery, setSeriesQuery] = useState('');
  const [seriesResults, setSeriesResults] = useState([]);
  const [seriesEpisodeLimit, setSeriesEpisodeLimit] = useState('');
  const [isSeriesSearching, setIsSeriesSearching] = useState(false);
  const [isSeriesImporting, setIsSeriesImporting] = useState(false);

  // =========================================================
  // إصلاح وفحص
  // =========================================================
  const [isFixing, setIsFixing] = useState(false);

  // =========================================================
  // Logs
  // =========================================================
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
    });

    setLogs((prev) => [`[${time}] ${message}`, ...prev]);
  };

  // =========================================================
  // التأكد من وجود TMDB Token
  // =========================================================
  const ensureTMDBToken = () => {
    if (!TMDB_READ_ACCESS_TOKEN) {
      throw new Error(
        'VITE_TMDB_READ_ACCESS_TOKEN غير موجود في Environment Variables.'
      );
    }
  };

  // =========================================================
  // TMDB Fetch
  // =========================================================
  const tmdbFetch = async (path, params = {}) => {
    ensureTMDBToken();

    const query = new URLSearchParams(params);

    const url = query.toString()
      ? `${TMDB_BASE_URL}${path}?${query.toString()}`
      : `${TMDB_BASE_URL}${path}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      let message = `TMDB HTTP ${response.status}`;

      try {
        const errorData = await response.json();

        if (errorData?.status_message) {
          message = errorData.status_message;
        }
      } catch {
        // تجاهل خطأ JSON
      }

      throw new Error(message);
    }

    return response.json();
  };

  // =========================================================
  // تحويل رابط صورة TMDB
  // =========================================================
  const makePosterUrl = (path) => {
    if (!path) return null;

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const clean = String(path).startsWith('/')
      ? path
      : `/${path}`;

    return `${TMDB_IMAGE}/w500${clean}`;
  };

  const makeBackdropUrl = (path) => {
    if (!path) return null;

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const clean = String(path).startsWith('/')
      ? path
      : `/${path}`;

    return `${TMDB_IMAGE}/w1280${clean}`;
  };

  // =========================================================
  // استخراج سنة
  // =========================================================
  const getYear = (date) => {
    if (!date) return null;

    const year = parseInt(String(date).split('-')[0], 10);

    return Number.isInteger(year) ? year : null;
  };

  // =========================================================
  // تنسيق فيلم حسب Schema الحقيقي
  // =========================================================
  const formatMovie = (item) => ({
    tmdb_id: String(item.id),
    type: 'movie',
    name: item.title || item.name || 'بدون عنوان',
    synopsis: item.overview || 'لا يوجد وصف متاح.',
    poster_url: makePosterUrl(item.poster_path),
    release_year:
      getYear(item.release_date) ||
      new Date().getFullYear(),
    rating_avg:
      typeof item.vote_average === 'number'
        ? Number(item.vote_average.toFixed(1))
        : 0,
    is_premium: false,
    url: null,
  });

  // =========================================================
  // تنسيق مسلسل حسب Schema الحقيقي
  // =========================================================
  const formatSeries = (item) => ({
    tmdb_id: String(item.id),
    type: 'series',
    name: item.name || item.title || 'بدون عنوان',
    synopsis: item.overview || 'لا يوجد وصف متاح.',
    poster_url: makePosterUrl(item.poster_path),
    release_year:
      getYear(item.first_air_date) ||
      new Date().getFullYear(),
    rating_avg:
      typeof item.vote_average === 'number'
        ? Number(item.vote_average.toFixed(1))
        : 0,
    is_premium: false,
    url: null,
  });

  // =========================================================
  // البحث عن title موجود بواسطة TMDB ID
  // =========================================================
  const findExistingTitle = async (tmdbId) => {
    const { data, error } = await supabase
      .from('titles')
      .select('id,tmdb_id')
      .eq('tmdb_id', String(tmdbId))
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  };

  // =========================================================
  // حفظ Title واحد
  //
  // لا نعتمد على UNIQUE constraint في tmdb_id
  // حتى لا نرجع لنفس مشكلة upsert إذا لم يكن العمود UNIQUE.
  // =========================================================
  const saveTitle = async (item) => {
    const tmdbId = String(item.tmdb_id);

    const existing = await findExistingTitle(tmdbId);

    if (existing) {
      const { data, error } = await supabase
        .from('titles')
        .update({
          type: item.type,
          name: item.name,
          synopsis: item.synopsis,
          poster_url: item.poster_url,
          release_year: item.release_year,
          rating_avg: item.rating_avg,
          is_premium: item.is_premium,
        })
        .eq('id', existing.id)
        .select('id,tmdb_id')
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id,
        tmdb_id: data.tmdb_id,
        created: false,
      };
    }

    const { data, error } = await supabase
      .from('titles')
      .insert({
        tmdb_id: tmdbId,
        type: item.type,
        name: item.name,
        synopsis: item.synopsis,
        poster_url: item.poster_url,
        release_year: item.release_year,
        rating_avg: item.rating_avg,
        is_premium: item.is_premium,
        url: item.url || null,
      })
      .select('id,tmdb_id')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      tmdb_id: data.tmdb_id,
      created: true,
    };
  };

  // =========================================================
  // حفظ مجموعة Titles
  // =========================================================
  const saveTitles = async (items) => {
    if (!items || items.length === 0) {
      return {
        count: 0,
        created: 0,
        updated: 0,
      };
    }

    let created = 0;
    let updated = 0;

    for (const item of items) {
      try {
        const result = await saveTitle(item);

        if (result.created) {
          created += 1;
        } else {
          updated += 1;
        }
      } catch (error) {
        addLog(
          `⚠️ تعذر حفظ "${item.name}": ${error.message}`
        );
      }
    }

    return {
      count: created + updated,
      created,
      updated,
    };
  };

  // =========================================================
  // الأنواع
  // =========================================================
  const getSelectedTypes = (type) => {
    if (type === 'movie') {
      return ['movie'];
    }

    if (type === 'series') {
      return ['tv'];
    }

    return ['movie', 'tv'];
  };

  // =========================================================
  // البحث الفردي
  // =========================================================
  const handleSingleSearch = async (event) => {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) {
      addLog('⚠️ اكتب اسم الفيلم أو المسلسل أولاً.');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      addLog(
        `🔍 البحث عن "${query}" - ${
          searchType === 'movie'
            ? 'فيلم'
            : 'مسلسل'
        }`
      );

      if (/^\d+$/.test(query)) {
        const item = await tmdbFetch(
          `/${searchType}/${query}`,
          {
            language: 'ar-SA',
          }
        );

        setSearchResults([item]);

        addLog(
          `✅ تم العثور على: ${
            item.title ||
            item.name ||
            'بدون عنوان'
          }`
        );

        return;
      }

      const data = await tmdbFetch(
        `/search/${searchType}`,
        {
          language: 'ar-SA',
          query,
          page: '1',
          include_adult: 'false',
        }
      );

      const results = data.results || [];

      setSearchResults(results);

      if (results.length === 0) {
        addLog('⚠️ لم يتم العثور على نتائج.');
      } else {
        addLog(
          `✅ تم العثور على ${results.length} نتيجة.`
        );
      }
    } catch (error) {
      addLog(
        `❌ خطأ في البحث: ${error.message}`
      );
    } finally {
      setIsSearching(false);
    }
  };

  // =========================================================
  // استيراد عنصر واحد
  // =========================================================
  const importSingleItem = async (item) => {
    try {
      const title =
        item.title ||
        item.name ||
        'بدون عنوان';

      addLog(
        `⏳ جاري استيراد "${title}"...`
      );

      let formatted;

      if (searchType === 'movie') {
        formatted = formatMovie(item);
      } else {
        formatted = formatSeries(item);
      }

      const result = await saveTitles([
        formatted,
      ]);

      if (result.count > 0) {
        addLog(
          `🎉 تم استيراد/تحديث "${title}" بنجاح.`
        );
      } else {
        addLog(
          `⚠️ لم يتم حفظ "${title}".`
        );
      }
    } catch (error) {
      addLog(
        `❌ فشل استيراد العمل: ${error.message}`
      );
    }
  };

  // =========================================================
  // Popular
  // =========================================================
  const fetchPopularPage = async (
    type,
    page
  ) => {
    const endpoint =
      type === 'movie'
        ? '/movie/popular'
        : '/tv/popular';

    return tmdbFetch(endpoint, {
      language: 'ar-SA',
      page: String(page),
    });
  };

  // =========================================================
  // Trending
  // =========================================================
  const fetchTrendingPage = async (
    type,
    page
  ) => {
    const endpoint =
      type === 'movie'
        ? '/trending/movie/week'
        : '/trending/tv/week';

    return tmdbFetch(endpoint, {
      language: 'ar-SA',
      page: String(page),
    });
  };

  // =========================================================
  // الاستيراد الجماعي
  // =========================================================
  const handleBulkImport = async () => {
    const pages = parseInt(
      bulkPages,
      10
    );

    if (
      !Number.isInteger(pages) ||
      pages < 1
    ) {
      addLog(
        '⚠️ اكتب عدد صفحات صحيح.'
      );
      return;
    }

    if (pages > 500) {
      addLog(
        '⚠️ الحد الأقصى هو 500 صفحة.'
      );
      return;
    }

    setIsBulkLoading(true);

    let totalSaved = 0;
    let failedPages = 0;

    try {
      const types =
        getSelectedTypes(bulkType);

      addLog(
        `🚀 بدء الاستيراد الجماعي: ${pages} صفحة - ${
          bulkType === 'both'
            ? 'أفلام + مسلسلات'
            : bulkType === 'movie'
            ? 'أفلام فقط'
            : 'مسلسلات فقط'
        } - المصدر: ${
          bulkSource === 'popular'
            ? 'Popular'
            : 'Trending'
        }`
      );

      for (
        let page = 1;
        page <= pages;
        page += 1
      ) {
        try {
          addLog(
            `📥 جلب الصفحة ${page} من ${pages}...`
          );

          const responses =
            await Promise.all(
              types.map((type) =>
                bulkSource === 'popular'
                  ? fetchPopularPage(
                      type,
                      page
                    )
                  : fetchTrendingPage(
                      type,
                      page
                    )
              )
            );

          const items = [];

          responses.forEach(
            (data, index) => {
              const currentType =
                types[index];

              const results =
                data.results || [];

              if (
                currentType === 'movie'
              ) {
                results.forEach(
                  (item) => {
                    items.push(
                      formatMovie(item)
                    );
                  }
                );
              } else {
                results.forEach(
                  (item) => {
                    items.push(
                      formatSeries(item)
                    );
                  }
                );
              }
            }
          );

          if (items.length === 0) {
            addLog(
              `⚠️ الصفحة ${page} فارغة.`
            );
            continue;
          }

          const result =
            await saveTitles(items);

          totalSaved += result.count;

          addLog(
            `✅ الصفحة ${page}: تم حفظ/تحديث ${result.count} عمل. المجموع: ${totalSaved}`
          );
        } catch (error) {
          failedPages += 1;

          addLog(
            `❌ فشل الصفحة ${page}: ${error.message}`
          );
        }
      }

      addLog(
        `🎉 انتهى الاستيراد الجماعي. تم حفظ/تحديث ${totalSaved} عمل${
          failedPages > 0
            ? `، وفشل ${failedPages} صفحات`
            : ''
        }.`
      );

      // تفريغ الخانة بعد الانتهاء
      setBulkPages('');
    } catch (error) {
      addLog(
        `❌ خطأ في الاستيراد الجماعي: ${error.message}`
      );
    } finally {
      setIsBulkLoading(false);
    }
  };

  // =========================================================
  // Trending بعدد محدد
  // =========================================================
  const handleTrendingImport = async () => {
    const count = parseInt(
      trendingCount,
      10
    );

    if (
      !Number.isInteger(count) ||
      count < 1
    ) {
      addLog(
        '⚠️ اكتب عدد الأعمال المطلوبة.'
      );
      return;
    }

    if (count > 1000) {
      addLog(
        '⚠️ الحد الأقصى هو 1000 عمل.'
      );
      return;
    }

    setIsTrendingLoading(true);

    let totalSaved = 0;
    let failedRequests = 0;

    try {
      const types =
        getSelectedTypes(
          trendingType
        );

      addLog(
        `🔥 بدء استيراد ${count} عمل من Trending - ${
          trendingType === 'both'
            ? 'أفلام + مسلسلات'
            : trendingType === 'movie'
            ? 'أفلام فقط'
            : 'مسلسلات فقط'
        }`
      );

      /*
       * عندما يختار المستخدم "both"
       * نقسم العدد بين النوعين تقريبياً.
       *
       * مثال:
       * 20 = 10 أفلام + 10 مسلسلات
       */

      const targets = {};

      if (trendingType === 'movie') {
        targets.movie = count;
      } else if (
        trendingType === 'series'
      ) {
        targets.tv = count;
      } else {
        targets.movie = Math.ceil(
          count / 2
        );

        targets.tv =
          count -
          targets.movie;
      }

      for (const type of types) {
        let typeSaved = 0;

        const pagesNeeded = Math.ceil(
          targets[type] / 20
        );

        for (
          let page = 1;
          page <= pagesNeeded;
          page += 1
        ) {
          if (
            typeSaved >=
            targets[type]
          ) {
            break;
          }

          try {
            const data =
              await fetchTrendingPage(
                type,
                page
              );

            const results =
              data.results || [];

            const remaining =
              targets[type] -
              typeSaved;

            const selected =
              results.slice(
                0,
                remaining
              );

            const formatted =
              type === 'movie'
                ? selected.map(
                    formatMovie
                  )
                : selected.map(
                    formatSeries
                  );

            if (
              formatted.length > 0
            ) {
              const result =
                await saveTitles(
                  formatted
                );

              typeSaved +=
                result.count;

              totalSaved +=
                result.count;

              addLog(
                `🔥 Trending ${
                  type === 'movie'
                    ? 'أفلام'
                    : 'مسلسلات'
                } - الصفحة ${page}: ${result.count} عمل`
              );
            }
          } catch (error) {
            failedRequests += 1;

            addLog(
              `❌ خطأ Trending ${
                type === 'movie'
                  ? 'الأفلام'
                  : 'المسلسلات'
              } الصفحة ${page}: ${error.message}`
            );
          }
        }
      }

      addLog(
        `🎉 انتهى Trending. تم حفظ/تحديث ${totalSaved} عمل${
          failedRequests > 0
            ? `، مع ${failedRequests} أخطاء`
            : ''
        }.`
      );

      setTrendingCount('');
    } catch (error) {
      addLog(
        `❌ خطأ في Trending: ${error.message}`
      );
    } finally {
      setIsTrendingLoading(false);
    }
  };

  // =========================================================
  // بحث مسلسل
  // =========================================================
  const handleSeriesSearch = async (
    event
  ) => {
    event.preventDefault();

    const query =
      seriesQuery.trim();

    if (!query) {
      addLog(
        '⚠️ اكتب اسم المسلسل أولاً.'
      );
      return;
    }

    setIsSeriesSearching(true);
    setSeriesResults([]);

    try {
      addLog(
        `📺 البحث عن المسلسل "${query}"...`
      );

      if (/^\d+$/.test(query)) {
        const item =
          await tmdbFetch(
            `/tv/${query}`,
            {
              language: 'ar-SA',
            }
          );

        setSeriesResults([item]);

        addLog(
          `✅ تم العثور على المسلسل: ${
            item.name ||
            'بدون عنوان'
          }`
        );

        return;
      }

      const data =
        await tmdbFetch(
          '/search/tv',
          {
            language: 'ar-SA',
            query,
            page: '1',
            include_adult: 'false',
          }
        );

      const results =
        data.results || [];

      setSeriesResults(results);

      addLog(
        results.length > 0
          ? `✅ تم العثور على ${results.length} مسلسل.`
          : '⚠️ لم يتم العثور على المسلسل.'
      );
    } catch (error) {
      addLog(
        `❌ خطأ في البحث عن المسلسل: ${error.message}`
      );
    } finally {
      setIsSeriesSearching(false);
    }
  };

  // =========================================================
  // استيراد حلقات المسلسل
  // =========================================================
  const importSeriesWithEpisodes =
    async (series) => {
      const episodeLimit =
        parseInt(
          seriesEpisodeLimit,
          10
        );

      if (
        !Number.isInteger(
          episodeLimit
        ) ||
        episodeLimit < 1
      ) {
        addLog(
          '⚠️ اكتب عدد الحلقات المطلوب استيرادها.'
        );
        return;
      }

      if (episodeLimit > 10000) {
        addLog(
          '⚠️ الحد الأقصى هو 10000 حلقة.'
        );
        return;
      }

      setIsSeriesImporting(true);

      try {
        const seriesTitle =
          series.name ||
          'بدون عنوان';

        addLog(
          `📺 جاري جلب تفاصيل "${seriesTitle}"...`
        );

        // -----------------------------------------
        // جلب التفاصيل الكاملة
        // -----------------------------------------
        const detail =
          await tmdbFetch(
            `/tv/${series.id}`,
            {
              language: 'ar-SA',
            }
          );

        // -----------------------------------------
        // حفظ المسلسل في titles
        // -----------------------------------------
        const formattedSeries =
          formatSeries(detail);

        const saved =
          await saveTitle(
            formattedSeries
          );

        const titleId =
          saved.id;

        addLog(
          `✅ تم حفظ المسلسل "${seriesTitle}".`
        );

        // -----------------------------------------
        // المواسم
        // -----------------------------------------
        const seasons = (
          detail.seasons || []
        )
          .filter(
            (season) =>
              season.season_number > 0
          )
          .sort(
            (a, b) =>
              a.season_number -
              b.season_number
          );

        const episodes = [];

        // -----------------------------------------
        // جلب الحلقات بالترتيب
        // -----------------------------------------
        for (const season of seasons) {
          if (
            episodes.length >=
            episodeLimit
          ) {
            break;
          }

          addLog(
            `📥 جلب الموسم ${season.season_number}...`
          );

          const seasonDetail =
            await tmdbFetch(
              `/tv/${series.id}/season/${season.season_number}`,
              {
                language: 'ar-SA',
              }
            );

          const seasonEpisodes =
            (
              seasonDetail.episodes ||
              []
            ).sort(
              (a, b) =>
                a.episode_number -
                b.episode_number
            );

          for (const episode of seasonEpisodes) {
            if (
              episodes.length >=
              episodeLimit
            ) {
              break;
            }

            episodes.push({
              ...episode,
              season_number:
                season.season_number,
            });
          }
        }

        addLog(
          `📊 تم العثور على ${episodes.length} حلقة.`
        );

        if (
          episodes.length === 0
        ) {
          addLog(
            `⚠️ لم يتم العثور على حلقات "${seriesTitle}".`
          );

          setSeriesEpisodeLimit('');

          return;
        }

        // -----------------------------------------
        // تجهيز الحلقات حسب Schema الحقيقي
        // -----------------------------------------
        const episodeRows =
          episodes.map(
            (episode) => ({
              title_id: titleId,

              season:
                episode.season_number ||
                1,

              episode_number:
                episode.episode_number ||
                1,

              name:
                episode.name ||
                `الحلقة ${
                  episode.episode_number ||
                  1
                }`,

              duration_seconds:
                typeof episode.runtime ===
                'number'
                  ? episode.runtime *
                    60
                  : null,

              /*
               * لا نضع روابط بث وهمية.
               * stream_urls تبقى JSON فارغة
               * إلى أن يكون عندك مصدر Streaming حقيقي.
               */
              stream_urls: {},
            })
          );

        // -----------------------------------------
        // حفظ الحلقات
        //
        // نحذف الحلقات القديمة لهذا المسلسل
        // بنفس المواسم المستوردة ثم نعيد إدخالها.
        // -----------------------------------------
        const seasonsToImport = [
          ...new Set(
            episodeRows.map(
              (episode) =>
                episode.season
            )
          ),
        ];

        for (const seasonNumber of seasonsToImport) {
          const {
            error: deleteError,
          } = await supabase
            .from('episodes')
            .delete()
            .eq(
              'title_id',
              titleId
            )
            .eq(
              'season',
              seasonNumber
            );

          if (deleteError) {
            addLog(
              `⚠️ تعذر تنظيف الموسم ${seasonNumber}: ${deleteError.message}`
            );
          }
        }

        // -----------------------------------------
        // إدخال الحلقات على دفعات
        // -----------------------------------------
        const batchSize = 50;

        let savedEpisodes = 0;

        for (
          let i = 0;
          i <
          episodeRows.length;
          i += batchSize
        ) {
          const batch =
            episodeRows.slice(
              i,
              i + batchSize
            );

          const {
            error: episodeError,
          } = await supabase
            .from('episodes')
            .insert(batch);

          if (episodeError) {
            throw episodeError;
          }

          savedEpisodes +=
            batch.length;

          addLog(
            `📥 تم حفظ ${savedEpisodes}/${episodeRows.length} حلقة...`
          );
        }

        addLog(
          `🎉 تم استيراد ${savedEpisodes} حلقة للمسلسل "${seriesTitle}" بنجاح.`
        );

        setSeriesEpisodeLimit('');
      } catch (error) {
        addLog(
          `❌ خطأ في استيراد المسلسل والحلقات: ${error.message}`
        );
      } finally {
        setIsSeriesImporting(false);
      }
    };

  // =========================================================
  // فحص وإصلاح URLs
  // =========================================================
  const handleFixUrls = async () => {
    setIsFixing(true);

    try {
      addLog(
        '🛠️ بدء فحص وإصلاح بيانات الأفلام والمسلسلات...'
      );

      // -----------------------------------------
      // جلب الأعمدة الموجودة فعلياً
      // -----------------------------------------
      const {
        data,
        error,
      } = await supabase
        .from('titles')
        .select(
          'id,type,name,poster_url,url,tmdb_id'
        );

      if (error) {
        throw error;
      }

      const rows =
        data || [];

      addLog(
        `📊 تم العثور على ${rows.length} سجل في قاعدة البيانات.`
      );

      let fixedCount = 0;
      let checkedCount = 0;

      let invalidPoster = 0;
      let invalidUrl = 0;

      // -----------------------------------------
      // فحص كل سجل
      // -----------------------------------------
      for (const item of rows) {
        checkedCount += 1;

        const updates = {};

        // ---------------------------------------
        // تصحيح type
        // ---------------------------------------
        if (item.type === 'tv') {
          updates.type =
            'series';
        }

        // ---------------------------------------
        // تصحيح poster_url
        // ---------------------------------------
        if (
          typeof item.poster_url ===
            'string' &&
          item.poster_url.trim() !== ''
        ) {
          const poster =
            item.poster_url.trim();

          if (
            poster.startsWith('/')
          ) {
            updates.poster_url =
              `${TMDB_IMAGE}/w500${poster}`;
          } else if (
            !/^https?:\/\//i.test(
              poster
            )
          ) {
            updates.poster_url =
              `${TMDB_IMAGE}/w500/${poster}`;
          } else if (
            poster.includes(
              'image.tmdb.org/t/p/'
            )
          ) {
            // الرابط كامل، نخليه كما هو
          } else {
            // رابط HTTP/HTTPS آخر
            // لا نغيره لأنه قد يكون رابط صورة خارجي.
          }
        }

        // ---------------------------------------
        // فحص poster
        // ---------------------------------------
        if (
          item.poster_url &&
          !/^https?:\/\//i.test(
            String(item.poster_url)
          )
        ) {
          invalidPoster += 1;
        }

        // ---------------------------------------
        // فحص URL
        // ---------------------------------------
        if (
          item.url &&
          !/^https?:\/\//i.test(
            String(item.url)
          )
        ) {
          invalidUrl += 1;
        }

        // ---------------------------------------
        // تنفيذ التعديل
        // ---------------------------------------
        if (
          Object.keys(updates)
            .length > 0
        ) {
          const {
            error: updateError,
          } = await supabase
            .from('titles')
            .update(updates)
            .eq(
              'id',
              item.id
            );

          if (updateError) {
            addLog(
              `⚠️ تعذر إصلاح "${item.name || 'بدون اسم'}": ${updateError.message}`
            );
          } else {
            fixedCount += 1;
          }
        }
      }

      addLog(
        `🔎 تم فحص ${checkedCount} سجل.`
      );

      addLog(
        `🛠️ تم إصلاح ${fixedCount} سجل.`
      );

      addLog(
        `🖼️ روابط Poster غير كاملة: ${invalidPoster}`
      );

      addLog(
        `🔗 روابط URL غير كاملة: ${invalidUrl}`
      );

      // -----------------------------------------
      // فحص نهائي
      // -----------------------------------------
      const {
        data: verifyData,
        error: verifyError,
      } = await supabase
        .from('titles')
        .select(
          'id,type,name,poster_url,url'
        );

      if (verifyError) {
        throw verifyError;
      }

      let brokenPoster = 0;
      let brokenUrl = 0;

      for (const item of verifyData ||
        []) {
        if (
          item.poster_url &&
          !/^https?:\/\//i.test(
            String(
              item.poster_url
            )
          )
        ) {
          brokenPoster += 1;
        }

        if (
          item.url &&
          !/^https?:\/\//i.test(
            String(item.url)
          )
        ) {
          brokenUrl += 1;
        }
      }

      addLog(
        `🖼️ الفحص النهائي: ${brokenPoster} Poster غير صحيح.`
      );

      addLog(
        `🔗 الفحص النهائي: ${brokenUrl} URL غير صحيح.`
      );

      addLog(
        '🎉 انتهى فحص وإصلاح البيانات والروابط.'
      );
    } catch (error) {
      addLog(
        `❌ خطأ أثناء فحص وإصلاح البيانات: ${error.message}`
      );
    } finally {
      setIsFixing(false);
    }
  };

  // =========================================================
  // الحالة العامة
  // =========================================================
  const busy =
    isBulkLoading ||
    isTrendingLoading ||
    isSeriesImporting ||
    isFixing;

  // =========================================================
  // UI
  // =========================================================
  return (
    <div className="import-page">
      <style>{`
        .import-page {
          min-height: 100vh;
          padding: 28px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at top right, rgba(229,9,20,.15), transparent 30%),
            radial-gradient(circle at bottom left, rgba(35,115,255,.10), transparent 30%),
            #070707;
          color: #fff;
          direction: rtl;
          font-family: Arial, Helvetica, sans-serif;
        }

        .import-container {
          max-width: 1250px;
          margin: 0 auto;
        }

        .import-header {
          margin-bottom: 24px;
          padding: 28px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 22px;
          background:
            linear-gradient(145deg, rgba(27,27,27,.98), rgba(12,12,12,.98));
          box-shadow: 0 20px 60px rgba(0,0,0,.35);
        }

        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
        }

        .import-header h1 {
          margin: 0;
          font-size: 30px;
        }

        .import-header p {
          margin: 10px 0 0;
          color: #8d8d8d;
          font-size: 14px;
        }

        .status-badge {
          padding: 8px 13px;
          border-radius: 999px;
          background: rgba(70,211,105,.1);
          border: 1px solid rgba(70,211,105,.2);
          color: #46d369;
          font-size: 12px;
          font-weight: bold;
        }

        .import-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .import-card {
          background: rgba(19,19,19,.96);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 12px 35px rgba(0,0,0,.25);
        }

        .import-card.full {
          grid-column: 1 / -1;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0 0 18px;
          font-size: 18px;
        }

        .red {
          color: #ff4050;
        }

        .blue {
          color: #4da3ff;
        }

        .orange {
          color: #ffad33;
        }

        .green {
          color: #46d369;
        }

        .purple {
          color: #ad8cff;
        }

        .cyan {
          color: #29c5d8;
        }

        .input-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .import-input,
        .import-select {
          min-height: 46px;
          box-sizing: border-box;
          border-radius: 11px;
          border: 1px solid #353535;
          background: #101010;
          color: #fff;
          padding: 0 14px;
          outline: none;
          font-size: 14px;
        }

        .import-input {
          flex: 1;
          min-width: 180px;
        }

        .import-input::placeholder {
          color: #666;
        }

        .import-input:focus,
        .import-select:focus {
          border-color: #e50914;
          box-shadow: 0 0 0 3px rgba(229,9,20,.12);
        }

        .import-button {
          min-height: 46px;
          padding: 0 18px;
          border: 0;
          border-radius: 11px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          transition: .2s;
        }

        .import-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .import-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .import-button:disabled {
          opacity: .42;
          cursor: not-allowed;
        }

        .btn-red {
          background: #e50914;
        }

        .btn-blue {
          background: #1677ff;
        }

        .btn-orange {
          background: #ff9800;
          color: #111;
        }

        .btn-green {
          background: #24a148;
        }

        .btn-cyan {
          background: #1597a8;
        }

        .btn-purple {
          background: #7646d9;
        }

        .helper {
          margin-top: 10px;
          color: #777;
          font-size: 12px;
          line-height: 1.6;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .result-card {
          overflow: hidden;
          background: #171717;
          border: 1px solid #2b2b2b;
          border-radius: 15px;
          transition: .2s;
        }

        .result-card:hover {
          transform: translateY(-3px);
          border-color: #444;
        }

        .result-poster {
          width: 100%;
          height: 255px;
          object-fit: cover;
          display: block;
          background: #222;
        }

        .result-body {
          padding: 12px;
        }

        .result-title {
          font-weight: 700;
          font-size: 14px;
          line-height: 1.5;
          min-height: 42px;
        }

        .result-meta {
          margin-top: 7px;
          color: #999;
          font-size: 11px;
        }

        .result-overview {
          margin-top: 8px;
          color: #aaa;
          font-size: 11px;
          line-height: 1.5;
          height: 48px;
          overflow: hidden;
        }

        .result-body .import-button {
          width: 100%;
          margin-top: 10px;
          min-height: 40px;
          font-size: 12px;
        }

        .info-box {
          margin-top: 15px;
          padding: 13px 15px;
          border-radius: 12px;
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.06);
          color: #999;
          font-size: 12px;
          line-height: 1.7;
        }

        .logs-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .clear-button {
          background: transparent;
          border: 0;
          color: #777;
          cursor: pointer;
          text-decoration: underline;
        }

        .logs {
          height: 300px;
          overflow-y: auto;
          padding: 13px;
          box-sizing: border-box;
          border-radius: 12px;
          background: #050505;
          border: 1px solid #222;
          direction: ltr;
          text-align: left;
          font-family: monospace;
        }

        .log-line {
          margin-bottom: 7px;
          color: #bdbdbd;
          font-size: 12px;
          line-height: 1.5;
          word-break: break-word;
        }

        .log-line.error {
          color: #ff5555;
        }

        .log-line.success {
          color: #46d369;
        }

        .log-line.warning {
          color: #ffbd4a;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          min-height: 42px;
          padding: 0 12px;
          border-radius: 10px;
          background: #222;
          color: #aaa;
          font-size: 11px;
          box-sizing: border-box;
        }

        .section-divider {
          height: 1px;
          background: #282828;
          margin: 20px 0;
        }

        @media (max-width: 850px) {
          .import-page {
            padding: 14px;
          }

          .import-grid {
            grid-template-columns: 1fr;
          }

          .import-card.full {
            grid-column: auto;
          }

          .import-header {
            padding: 20px;
          }

          .import-header h1 {
            font-size: 23px;
          }

          .import-card {
            padding: 17px;
          }
        }
      `}</style>

      <div className="import-container">

        {/* =====================================================
            HEADER
        ===================================================== */}
        <div className="import-header">
          <div className="header-top">
            <div>
              <h1>🎬 لوحة استيراد StreamFlix</h1>

              <p>
                استيراد الأفلام والمسلسلات والحلقات
                من TMDB إلى Supabase
              </p>
            </div>

            <div className="status-badge">
              ● TMDB Import System
            </div>
          </div>
        </div>

        <div className="import-grid">

          {/* ===================================================
              البحث الفردي
          =================================================== */}
          <section className="import-card full">
            <h2 className="card-title red">
              🔍 البحث والاستيراد الفردي
            </h2>

            <form
              onSubmit={handleSingleSearch}
              className="input-row"
            >
              <input
                className="import-input"
                type="text"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                placeholder="اسم الفيلم/المسلسل أو TMDB ID..."
              />

              <select
                className="import-select"
                value={searchType}
                onChange={(e) =>
                  setSearchType(
                    e.target.value
                  )
                }
              >
                <option value="movie">
                  🎬 فيلم
                </option>

                <option value="tv">
                  📺 مسلسل
                </option>
              </select>

              <button
                className="import-button btn-red"
                type="submit"
                disabled={isSearching}
              >
                {isSearching
                  ? '⏳ جاري البحث...'
                  : '🔎 بحث'}
              </button>
            </form>

            <div className="helper">
              ابحث بالاسم أو أدخل TMDB ID
              مباشرة، وستظهر لك صورة واسم العمل
              قبل الاستيراد.
            </div>

            {searchResults.length >
              0 && (
              <div className="results-grid">
                {searchResults.map(
                  (item) => (
                    <div
                      className="result-card"
                      key={item.id}
                    >
                      <img
                        className="result-poster"
                        src={
                          item.poster_path
                            ? `${TMDB_IMAGE}/w342${item.poster_path}`
                            : PLACEHOLDER_POSTER
                        }
                        alt={
                          item.title ||
                          item.name ||
                          'Poster'
                        }
                      />

                      <div className="result-body">
                        <div className="result-title">
                          {item.title ||
                            item.name ||
                            'بدون عنوان'}
                        </div>

                        <div className="result-meta">
                          ⭐{' '}
                          {typeof item.vote_average ===
                          'number'
                            ? item.vote_average.toFixed(
                                1
                              )
                            : '0.0'}

                          {' • '}

                          {item.release_date ||
                            item.first_air_date ||
                            'بدون تاريخ'}
                        </div>

                        <div className="result-overview">
                          {item.overview ||
                            'لا يوجد وصف متاح.'}
                        </div>

                        <button
                          className="import-button btn-green"
                          type="button"
                          onClick={() =>
                            importSingleItem(
                              item
                            )
                          }
                          disabled={busy}
                        >
                          ➕ استيراد العمل
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* ===================================================
              الاستيراد الجماعي
          =================================================== */}
          <section className="import-card">
            <h2 className="card-title blue">
              📦 الاستيراد الجماعي
            </h2>

            <div className="input-row">

              <input
                className="import-input"
                type="number"
                min="1"
                max="500"
                value={bulkPages}
                onChange={(e) =>
                  setBulkPages(
                    e.target.value
                  )
                }
                placeholder="عدد الصفحات"
              />

              <select
                className="import-select"
                value={bulkType}
                onChange={(e) =>
                  setBulkType(
                    e.target.value
                  )
                }
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

              <select
                className="import-select"
                value={bulkSource}
                onChange={(e) =>
                  setBulkSource(
                    e.target.value
                  )
                }
              >
                <option value="popular">
                  ⭐ Popular
                </option>

                <option value="trending">
                  🔥 Trending
                </option>
              </select>
            </div>

            <div className="helper">
              اكتب مثلاً 5 لاستيراد 5 صفحات.
              الخانة تبدأ فارغة وبعد انتهاء العملية
              تفرغ تلقائياً.
            </div>

            <button
              className="import-button btn-blue"
              type="button"
              onClick={handleBulkImport}
              disabled={busy}
              style={{
                width: '100%',
                marginTop: 14,
              }}
            >
              {isBulkLoading
                ? '⏳ جاري الاستيراد...'
                : '🚀 بدء الاستيراد الجماعي'}
            </button>
          </section>

          {/* ===================================================
              TRENDING
          =================================================== */}
          <section className="import-card">
            <h2 className="card-title orange">
              🔥 استيراد Trending
            </h2>

            <div className="input-row">

              <input
                className="import-input"
                type="number"
                min="1"
                max="1000"
                value={trendingCount}
                onChange={(e) =>
                  setTrendingCount(
                    e.target.value
                  )
                }
                placeholder="عدد الأعمال"
              />

              <select
                className="import-select"
                value={trendingType}
                onChange={(e) =>
                  setTrendingType(
                    e.target.value
                  )
                }
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

            <div className="helper">
              مثال: 20 + أفلام ومسلسلات =
              تقريباً 10 أفلام + 10 مسلسلات.
            </div>

            <button
              className="import-button btn-orange"
              type="button"
              onClick={
                handleTrendingImport
              }
              disabled={busy}
              style={{
                width: '100%',
                marginTop: 14,
              }}
            >
              {isTrendingLoading
                ? '⏳ جاري الاستيراد...'
                : '🔥 استيراد Trending'}
            </button>
          </section>

          {/* ===================================================
              مسلسل + حلقات
          =================================================== */}
          <section className="import-card full">
            <h2 className="card-title green">
              📺 استيراد مسلسل + حلقاته
            </h2>

            <form
              onSubmit={
                handleSeriesSearch
              }
              className="input-row"
            >
              <input
                className="import-input"
                type="text"
                value={seriesQuery}
                onChange={(e) =>
                  setSeriesQuery(
                    e.target.value
                  )
                }
                placeholder="اسم المسلسل أو TMDB ID..."
              />

              <button
                className="import-button btn-green"
                type="submit"
                disabled={
                  isSeriesSearching ||
                  busy
                }
              >
                {isSeriesSearching
                  ? '⏳ جاري البحث...'
                  : '🔎 بحث عن مسلسل'}
              </button>
            </form>

            <div
              className="input-row"
              style={{
                marginTop: 12,
              }}
            >
              <input
                className="import-input"
                type="number"
                min="1"
                max="10000"
                value={
                  seriesEpisodeLimit
                }
                onChange={(e) =>
                  setSeriesEpisodeLimit(
                    e.target.value
                  )
                }
                placeholder="عدد الحلقات"
              />

              <span className="badge">
                📚 المواسم والحلقات بالترتيب
              </span>
            </div>

            <div className="info-box">
              اختر المسلسل ثم حدد عدد الحلقات.
              النظام يجلب المواسم من TMDB ويحفظ
              الحلقات في جدول <b>episodes</b> ويربطها
              بالمسلسل عن طريق <b>title_id</b>.
            </div>

            {seriesResults.length >
              0 && (
              <div className="results-grid">
                {seriesResults.map(
                  (item) => (
                    <div
                      className="result-card"
                      key={item.id}
                    >
                      <img
                        className="result-poster"
                        src={
                          item.poster_path
                            ? `${TMDB_IMAGE}/w342${item.poster_path}`
                            : PLACEHOLDER_POSTER
                        }
                        alt={
                          item.name ||
                          'Series'
                        }
                      />

                      <div className="result-body">
                        <div className="result-title">
                          {item.name ||
                            'بدون عنوان'}
                        </div>

                        <div className="result-meta">
                          ⭐{' '}
                          {typeof item.vote_average ===
                          'number'
                            ? item.vote_average.toFixed(
                                1
                              )
                            : '0.0'}

                          {' • '}

                          {item.first_air_date ||
                            'بدون تاريخ'}
                        </div>

                        <div className="result-overview">
                          {item.overview ||
                            'لا يوجد وصف متاح.'}
                        </div>

                        <button
                          className="import-button btn-purple"
                          type="button"
                          onClick={() =>
                            importSeriesWithEpisodes(
                              item
                            )
                          }
                          disabled={busy}
                        >
                          {isSeriesImporting
                            ? '⏳ جاري الاستيراد...'
                            : '📥 استيراد المسلسل والحلقات'}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* ===================================================
              إصلاح URLs
          =================================================== */}
          <section className="import-card full">
            <h2 className="card-title cyan">
              🛠️ فحص وإصلاح البيانات والروابط
            </h2>

            <p
              style={{
                color: '#999',
                fontSize: 13,
                lineHeight: 1.8,
                marginTop: 0,
              }}
            >
              يفحص الأعمدة الحقيقية في جدول
              titles: الاسم، النوع، Poster و URL،
              ويصحح روابط صور TMDB غير الكاملة.
              لا يغير روابط البث الخارجية الموجودة
              في url.
            </p>

            <button
              className="import-button btn-cyan"
              type="button"
              onClick={handleFixUrls}
              disabled={busy}
            >
              {isFixing
                ? '⏳ جاري الفحص والإصلاح...'
                : '🛠️ فحص وإصلاح URL والبيانات'}
            </button>
          </section>

          {/* ===================================================
              LOGS
          =================================================== */}
          <section className="import-card full">
            <div className="logs-head">
              <h2
                className="card-title"
                style={{
                  margin: 0,
                }}
              >
                📋 سجل العمليات
              </h2>

              <button
                className="clear-button"
                type="button"
                onClick={() =>
                  setLogs([])
                }
              >
                مسح السجل
              </button>
            </div>

            <div className="logs">
              {logs.length === 0 ? (
                <div className="log-line">
                  لا توجد عمليات حالياً...
                </div>
              ) : (
                logs.map(
                  (log, index) => {
                    let className =
                      'log-line';

                    if (
                      log.includes('❌')
                    ) {
                      className +=
                        ' error';
                    } else if (
                      log.includes(
                        '✅'
                      ) ||
                      log.includes(
                        '🎉'
                      )
                    ) {
                      className +=
                        ' success';
                    } else if (
                      log.includes(
                        '⚠️'
                      )
                    ) {
                      className +=
                        ' warning';
                    }

                    return (
                      <div
                        className={
                          className
                        }
                        key={`${log}-${index}`}
                      >
                        {log}
                      </div>
                    );
                  }
                )
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

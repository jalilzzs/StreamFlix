import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const TMDB_API_KEY = '826b5838634812328768a35607b22a01';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';

export default function Import() {
  // =========================
  // البحث الفردي
  // =========================
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('movie');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // =========================
  // الاستيراد الجماعي
  // =========================
  const [bulkPages, setBulkPages] = useState('');
  const [bulkType, setBulkType] = useState('both');
  const [bulkSource, setBulkSource] = useState('popular');
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // =========================
  // Trending
  // =========================
  const [trendingCount, setTrendingCount] = useState('');
  const [trendingType, setTrendingType] = useState('both');
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);

  // =========================
  // استيراد مسلسل + الحلقات
  // =========================
  const [seriesQuery, setSeriesQuery] = useState('');
  const [seriesResults, setSeriesResults] = useState([]);
  const [seriesEpisodeLimit, setSeriesEpisodeLimit] = useState('');
  const [isSeriesSearching, setIsSeriesSearching] = useState(false);
  const [isSeriesImporting, setIsSeriesImporting] = useState(false);

  // =========================
  // إصلاح وفحص
  // =========================
  const [isFixing, setIsFixing] = useState(false);

  // =========================
  // Logs
  // =========================
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
    });

    setLogs((prev) => [`[${time}] ${message}`, ...prev]);
  };

  // =========================
  // TMDB API
  // =========================
  const tmdbFetch = async (path, params = {}) => {
    const query = new URLSearchParams({
      api_key: TMDB_API_KEY,
      ...params,
    });

    const response = await fetch(`${TMDB_BASE_URL}${path}?${query.toString()}`);

    if (!response.ok) {
      let message = `TMDB HTTP ${response.status}`;

      try {
        const errorData = await response.json();

        if (errorData?.status_message) {
          message = errorData.status_message;
        }
      } catch {
        // تجاهل خطأ قراءة JSON
      }

      throw new Error(message);
    }

    return response.json();
  };

  // =========================
  // تنسيق عنصر الفيلم
  // =========================
  const formatMovie = (item) => ({
    tmdb_id: item.id,
    title: item.title || item.name || 'بدون عنوان',
    type: 'movie',
    synopsis: item.overview || 'لا يوجد وصف متاح.',
    poster_path: item.poster_path
      ? `${TMDB_IMAGE}/w500${item.poster_path}`
      : null,
    backdrop_path: item.backdrop_path
      ? `${TMDB_IMAGE}/w1280${item.backdrop_path}`
      : null,
    release_year: item.release_date
      ? parseInt(item.release_date.split('-')[0], 10)
      : new Date().getFullYear(),
    rating_avg:
      typeof item.vote_average === 'number'
        ? Number(item.vote_average.toFixed(1))
        : 0,
    is_premium: false,
  });

  // =========================
  // تنسيق المسلسل
  // =========================
  const formatSeries = (item) => ({
    tmdb_id: item.id,
    title: item.name || item.title || 'بدون عنوان',
    type: 'series',
    synopsis: item.overview || 'لا يوجد وصف متاح.',
    poster_path: item.poster_path
      ? `${TMDB_IMAGE}/w500${item.poster_path}`
      : null,
    backdrop_path: item.backdrop_path
      ? `${TMDB_IMAGE}/w1280${item.backdrop_path}`
      : null,
    release_year: item.first_air_date
      ? parseInt(item.first_air_date.split('-')[0], 10)
      : new Date().getFullYear(),
    rating_avg:
      typeof item.vote_average === 'number'
        ? Number(item.vote_average.toFixed(1))
        : 0,
    is_premium: false,
  });

  // =========================
  // حفظ العناصر في Supabase
  // =========================
  const saveTitles = async (items) => {
    if (!items || items.length === 0) {
      return {
        success: true,
        count: 0,
      };
    }

    const { error } = await supabase
      .from('titles')
      .upsert(items, {
        onConflict: 'tmdb_id',
      });

    if (error) {
      throw error;
    }

    return {
      success: true,
      count: items.length,
    };
  };

  // =========================
  // البحث الفردي
  // =========================
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
          searchType === 'movie' ? 'فيلم' : 'مسلسل'
        }`
      );

      // TMDB ID
      if (/^\d+$/.test(query)) {
        const item = await tmdbFetch(`/${searchType}/${query}`, {
          language: 'ar-SA',
        });

        setSearchResults([item]);

        addLog(
          `✅ تم العثور على: ${item.title || item.name || 'بدون عنوان'}`
        );

        return;
      }

      const data = await tmdbFetch(`/search/${searchType}`, {
        language: 'ar-SA',
        query,
        page: '1',
        include_adult: 'false',
      });

      const results = data.results || [];

      setSearchResults(results);

      if (results.length === 0) {
        addLog('⚠️ لم يتم العثور على نتائج.');
      } else {
        addLog(`✅ تم العثور على ${results.length} نتيجة.`);
      }
    } catch (error) {
      addLog(`❌ خطأ في البحث: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // =========================
  // استيراد عنصر واحد
  // =========================
  const importSingleItem = async (item) => {
    try {
      const title = item.title || item.name || 'بدون عنوان';

      addLog(`⏳ جاري استيراد "${title}"...`);

      let formatted;

      if (searchType === 'movie') {
        formatted = formatMovie(item);
      } else {
        formatted = formatSeries(item);
      }

      await saveTitles([formatted]);

      addLog(`🎉 تم استيراد "${title}" بنجاح.`);
    } catch (error) {
      addLog(`❌ فشل استيراد العمل: ${error.message}`);
    }
  };

  // =========================
  // جلب صفحات Popular
  // =========================
  const fetchPopularPage = async (type, page) => {
    const endpoint = type === 'movie' ? '/movie/popular' : '/tv/popular';

    return tmdbFetch(endpoint, {
      language: 'ar-SA',
      page: String(page),
    });
  };

  // =========================
  // جلب صفحة Trending
  // =========================
  const fetchTrendingPage = async (type, page) => {
    const endpoint =
      type === 'movie'
        ? '/trending/movie/week'
        : '/trending/tv/week';

    return tmdbFetch(endpoint, {
      language: 'ar-SA',
      page: String(page),
    });
  };

  // =========================
  // تحديد الأنواع
  // =========================
  const getSelectedTypes = (type) => {
    if (type === 'movie') {
      return ['movie'];
    }

    if (type === 'series') {
      return ['tv'];
    }

    return ['movie', 'tv'];
  };

  // =========================
  // الاستيراد الجماعي Popular
  // =========================
  const handleBulkImport = async () => {
    const pages = parseInt(bulkPages, 10);

    if (!Number.isInteger(pages) || pages < 1) {
      addLog('⚠️ اكتب عدد صفحات صحيح للاستيراد الجماعي.');
      return;
    }

    if (pages > 500) {
      addLog('⚠️ الحد الأقصى هو 500 صفحة.');
      return;
    }

    setIsBulkLoading(true);

    let total = 0;
    let failedPages = 0;

    try {
      const types = getSelectedTypes(bulkType);

      addLog(
        `🚀 بدء الاستيراد الجماعي: ${pages} صفحة - ${
          bulkType === 'both'
            ? 'أفلام + مسلسلات'
            : bulkType === 'movie'
            ? 'أفلام فقط'
            : 'مسلسلات فقط'
        }`
      );

      for (let page = 1; page <= pages; page += 1) {
        try {
          addLog(`📥 جلب الصفحة ${page} من ${pages}...`);

          const requests = types.map((type) =>
            bulkSource === 'popular'
              ? fetchPopularPage(type, page)
              : fetchTrendingPage(type, page)
          );

          const responses = await Promise.all(requests);

          const items = [];

          responses.forEach((data, index) => {
            const currentType = types[index];

            if (currentType === 'movie') {
              (data.results || []).forEach((item) => {
                items.push(formatMovie(item));
              });
            } else {
              (data.results || []).forEach((item) => {
                items.push(formatSeries(item));
              });
            }
          });

          if (items.length > 0) {
            await saveTitles(items);

            total += items.length;

            addLog(
              `✅ الصفحة ${page}: تم حفظ ${items.length} عمل. المجموع: ${total}`
            );
          } else {
            addLog(`⚠️ الصفحة ${page} فارغة.`);
          }
        } catch (error) {
          failedPages += 1;

          addLog(
            `❌ فشل الصفحة ${page}: ${error.message}`
          );
        }
      }

      addLog(
        `🎉 انتهى الاستيراد الجماعي. تم حفظ/تحديث ${total} عمل${
          failedPages > 0
            ? `، وفشل ${failedPages} صفحات`
            : ''
        }.`
      );
    } catch (error) {
      addLog(`❌ خطأ في الاستيراد الجماعي: ${error.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  // =========================
  // استيراد عدد محدد من Trending
  // =========================
  const handleTrendingImport = async () => {
    const count = parseInt(trendingCount, 10);

    if (!Number.isInteger(count) || count < 1) {
      addLog('⚠️ اكتب عدد الأعمال المطلوبة في Trending.');
      return;
    }

    if (count > 1000) {
      addLog('⚠️ الحد الأقصى هو 1000 عمل.');
      return;
    }

    setIsTrendingLoading(true);

    let total = 0;

    try {
      const types = getSelectedTypes(trendingType);

      addLog(
        `🔥 بدء استيراد ${count} عمل من Trending...`
      );

      const pagesNeeded = Math.ceil(count / 20);

      for (let page = 1; page <= pagesNeeded; page += 1) {
        if (total >= count) {
          break;
        }

        for (const type of types) {
          if (total >= count) {
            break;
          }

          try {
            const data = await fetchTrendingPage(type, page);

            const results = data.results || [];

            const remaining = count - total;

            const selected = results.slice(0, remaining);

            const formatted =
              type === 'movie'
                ? selected.map(formatMovie)
                : selected.map(formatSeries);

            if (formatted.length > 0) {
              await saveTitles(formatted);

              total += formatted.length;

              addLog(
                `🔥 Trending ${
                  type === 'movie' ? 'أفلام' : 'مسلسلات'
                } - الصفحة ${page}: ${formatted.length} عمل`
              );
            }
          } catch (error) {
            addLog(
              `❌ خطأ في Trending ${
                type === 'movie' ? 'الأفلام' : 'المسلسلات'
              }: ${error.message}`
            );
          }
        }
      }

      addLog(
        `🎉 انتهى استيراد Trending. المجموع: ${total} عمل.`
      );
    } catch (error) {
      addLog(`❌ خطأ في Trending: ${error.message}`);
    } finally {
      setIsTrendingLoading(false);
    }
  };

  // =========================
  // بحث عن مسلسل لاستيراد حلقاته
  // =========================
  const handleSeriesSearch = async (event) => {
    event.preventDefault();

    const query = seriesQuery.trim();

    if (!query) {
      addLog('⚠️ اكتب اسم المسلسل أولاً.');
      return;
    }

    setIsSeriesSearching(true);
    setSeriesResults([]);

    try {
      addLog(`📺 البحث عن المسلسل "${query}"...`);

      if (/^\d+$/.test(query)) {
        const item = await tmdbFetch(`/tv/${query}`, {
          language: 'ar-SA',
        });

        setSeriesResults([item]);

        addLog(
          `✅ تم العثور على المسلسل: ${
            item.name || 'بدون عنوان'
          }`
        );

        return;
      }

      const data = await tmdbFetch('/search/tv', {
        language: 'ar-SA',
        query,
        page: '1',
        include_adult: 'false',
      });

      const results = data.results || [];

      setSeriesResults(results);

      addLog(
        results.length > 0
          ? `✅ تم العثور على ${results.length} مسلسل.`
          : '⚠️ لم يتم العثور على المسلسل.'
      );
    } catch (error) {
      addLog(`❌ خطأ في البحث عن المسلسل: ${error.message}`);
    } finally {
      setIsSeriesSearching(false);
    }
  };

  // =========================
  // استيراد مسلسل + جميع حلقاته
  // =========================
  const importSeriesWithEpisodes = async (series) => {
    const episodeLimit = parseInt(seriesEpisodeLimit, 10);

    if (!Number.isInteger(episodeLimit) || episodeLimit < 1) {
      addLog('⚠️ اكتب عدد الحلقات المطلوب استيرادها.');
      return;
    }

    if (episodeLimit > 10000) {
      addLog('⚠️ الحد الأقصى هو 10000 حلقة.');
      return;
    }

    setIsSeriesImporting(true);

    try {
      const seriesTitle = series.name || 'بدون عنوان';

      addLog(
        `📺 جاري جلب تفاصيل "${seriesTitle}"...`
      );

      const detail = await tmdbFetch(`/tv/${series.id}`, {
        language: 'ar-SA',
      });

      // حفظ المسلسل الأساسي
      await saveTitles([formatSeries(detail)]);

      addLog(`✅ تم حفظ المسلسل "${seriesTitle}".`);

      const seasons = (detail.seasons || []).filter(
        (season) => season.season_number > 0
      );

      const episodes = [];

      // =========================
      // جلب الحلقات بالترتيب
      // =========================
      for (const season of seasons) {
        if (episodes.length >= episodeLimit) {
          break;
        }

        addLog(
          `📥 جلب الموسم ${season.season_number}...`
        );

        const seasonDetail = await tmdbFetch(
          `/tv/${series.id}/season/${season.season_number}`,
          {
            language: 'ar-SA',
          }
        );

        const seasonEpisodes = seasonDetail.episodes || [];

        for (const episode of seasonEpisodes) {
          if (episodes.length >= episodeLimit) {
            break;
          }

          episodes.push({
            ...episode,
            season_number: season.season_number,
          });
        }
      }

      addLog(
        `📊 تم العثور على ${episodes.length} حلقة للاستيراد.`
      );

      /*
       * ملاحظة مهمة:
       * لأن بنية جدول الحلقات تختلف من مشروع لآخر،
       * نحاول أولاً استعمال جدول episodes إذا كان موجوداً.
       */

      if (episodes.length > 0) {
        const episodeRows = episodes.map((episode) => ({
          tmdb_id: episode.id,
          title:
            episode.name ||
            `الحلقة ${episode.episode_number}`,
          synopsis:
            episode.overview ||
            'لا يوجد وصف متاح.',
          poster_path: episode.still_path
            ? `${TMDB_IMAGE}/w500${episode.still_path}`
            : null,
          season_number: episode.season_number || 1,
          episode_number:
            episode.episode_number || 1,
          air_date: episode.air_date || null,
          rating_avg:
            typeof episode.vote_average === 'number'
              ? Number(episode.vote_average.toFixed(1))
              : 0,
          duration:
            episode.runtime ||
            null,
          title_id: detail.id,
        }));

        const { error } = await supabase
          .from('episodes')
          .upsert(episodeRows, {
            onConflict: 'tmdb_id',
          });

        if (error) {
          /*
           * إذا كان جدول episodes غير موجود أو أسماء أعمدته
           * مختلفة، نحاول إخبار المستخدم بدلاً من إسقاط الموقع.
           */
          addLog(
            `⚠️ تم حفظ المسلسل لكن تعذر حفظ الحلقات في جدول episodes: ${error.message}`
          );
        } else {
          addLog(
            `🎉 تم استيراد ${episodeRows.length} حلقة للمسلسل "${seriesTitle}".`
          );
        }
      } else {
        addLog(
          `⚠️ لم يتم العثور على حلقات للمسلسل "${seriesTitle}".`
        );
      }
    } catch (error) {
      addLog(
        `❌ خطأ في استيراد المسلسل والحلقات: ${error.message}`
      );
    } finally {
      setIsSeriesImporting(false);
    }
  };

  // =========================
  // فحص وإصلاح البيانات والروابط
  // =========================
  const handleFixUrls = async () => {
    setIsFixing(true);

    try {
      addLog(
        '🛠️ بدء فحص وإصلاح بيانات الأفلام والمسلسلات...'
      );

      const { data, error } = await supabase
        .from('titles')
        .select('*');

      if (error) {
        throw error;
      }

      const rows = data || [];

      addLog(
        `📊 تم العثور على ${rows.length} سجل في قاعدة البيانات.`
      );

      let fixedCount = 0;
      let checkedCount = 0;

      for (const item of rows) {
        checkedCount += 1;

        const updates = {};

        // تصحيح نوع TV
        if (item.type === 'tv') {
          updates.type = 'series';
        }

        // تصحيح poster URL
        if (
          typeof item.poster_path === 'string' &&
          item.poster_path.trim() !== ''
        ) {
          const poster = item.poster_path.trim();

          if (
            !poster.startsWith('http://') &&
            !poster.startsWith('https://')
          ) {
            const cleanPath = poster.startsWith('/')
              ? poster
              : `/${poster}`;

            updates.poster_path = `${TMDB_IMAGE}${cleanPath}`;
          }
        }

        // تصحيح backdrop URL
        if (
          typeof item.backdrop_path === 'string' &&
          item.backdrop_path.trim() !== ''
        ) {
          const backdrop = item.backdrop_path.trim();

          if (
            !backdrop.startsWith('http://') &&
            !backdrop.startsWith('https://')
          ) {
            const cleanPath = backdrop.startsWith('/')
              ? backdrop
              : `/${backdrop}`;

            updates.backdrop_path = `${TMDB_IMAGE}${cleanPath}`;
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('titles')
            .update(updates)
            .eq('id', item.id);

          if (updateError) {
            addLog(
              `⚠️ تعذر إصلاح "${item.title}": ${updateError.message}`
            );
          } else {
            fixedCount += 1;
          }
        }
      }

      addLog(
        `✅ اكتمل الفحص: ${checkedCount} سجل تم فحصه، ${fixedCount} سجل تم إصلاحه.`
      );

      // =========================
      // تحقق إضافي من روابط الصور
      // =========================
      addLog('🔎 جاري التحقق من روابط الصور...');

      const { data: verifyData, error: verifyError } =
        await supabase
          .from('titles')
          .select(
            'id,title,poster_path,backdrop_path'
          );

      if (verifyError) {
        throw verifyError;
      }

      let brokenPoster = 0;
      let brokenBackdrop = 0;

      for (const item of verifyData || []) {
        if (
          item.poster_path &&
          !/^https?:\/\//i.test(item.poster_path)
        ) {
          brokenPoster += 1;
        }

        if (
          item.backdrop_path &&
          !/^https?:\/\//i.test(item.backdrop_path)
        ) {
          brokenBackdrop += 1;
        }
      }

      addLog(
        `🖼️ نتيجة التحقق: ${brokenPoster} رابط Poster غير صحيح، ${brokenBackdrop} رابط Backdrop غير صحيح.`
      );

      addLog('🎉 انتهى فحص وإصلاح الروابط والبيانات.');
    } catch (error) {
      addLog(
        `❌ خطأ أثناء فحص وإصلاح البيانات: ${error.message}`
      );
    } finally {
      setIsFixing(false);
    }
  };

  const busy =
    isBulkLoading ||
    isTrendingLoading ||
    isSeriesImporting ||
    isFixing;

  // =========================
  // UI
  // =========================
  return (
    <div className="import-page">
      <style>{`
        .import-page {
          min-height: 100vh;
          padding: 28px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at top right, rgba(229,9,20,.13), transparent 30%),
            radial-gradient(circle at bottom left, rgba(55,65,81,.18), transparent 30%),
            #080808;
          color: #fff;
          direction: rtl;
          font-family: Arial, Helvetica, sans-serif;
        }

        .import-container {
          max-width: 1250px;
          margin: 0 auto;
        }

        .import-header {
          margin-bottom: 28px;
          padding: 28px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          background: linear-gradient(145deg, #171717, #0d0d0d);
          box-shadow: 0 20px 60px rgba(0,0,0,.35);
        }

        .import-header h1 {
          margin: 0 0 8px;
          font-size: 30px;
          color: #fff;
        }

        .import-header p {
          margin: 0;
          color: #999;
          font-size: 14px;
        }

        .import-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .import-card {
          background: rgba(20,20,20,.96);
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
          gap: 10px;
          margin: 0 0 18px;
          font-size: 18px;
        }

        .card-title.red {
          color: #ff4050;
        }

        .card-title.blue {
          color: #4da3ff;
        }

        .card-title.orange {
          color: #ffad33;
        }

        .card-title.green {
          color: #46d369;
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
          border-radius: 10px;
          border: 1px solid #363636;
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

        .import-input:focus,
        .import-select:focus {
          border-color: #e50914;
          box-shadow: 0 0 0 3px rgba(229,9,20,.12);
        }

        .import-button {
          min-height: 46px;
          padding: 0 18px;
          border: 0;
          border-radius: 10px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          transition: .2s;
        }

        .import-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .import-button:disabled {
          opacity: .45;
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
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .result-card {
          overflow: hidden;
          background: #171717;
          border: 1px solid #2b2b2b;
          border-radius: 14px;
        }

        .result-poster {
          width: 100%;
          height: 245px;
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

        .logs {
          height: 270px;
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

        .logs-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .clear-button {
          background: transparent;
          border: 0;
          color: #777;
          cursor: pointer;
          text-decoration: underline;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          background: #242424;
          color: #aaa;
          font-size: 11px;
        }

        @media (max-width: 850px) {
          .import-page {
            padding: 15px;
          }

          .import-grid {
            grid-template-columns: 1fr;
          }

          .import-card.full {
            grid-column: auto;
          }

          .import-header h1 {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="import-container">
        <div className="import-header">
          <h1>🎬 لوحة استيراد StreamFlix</h1>
          <p>
            إدارة واستيراد الأفلام والمسلسلات مباشرة من TMDB إلى
            قاعدة بيانات Supabase
          </p>
        </div>

        <div className="import-grid">
          {/* =========================
              البحث الفردي
          ========================= */}
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
                  setSearchQuery(e.target.value)
                }
                placeholder="اكتب اسم الفيلم/المسلسل أو TMDB ID..."
              />

              <select
                className="import-select"
                value={searchType}
                onChange={(e) =>
                  setSearchType(e.target.value)
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
                {isSearching ? '⏳ جاري البحث...' : '🔎 بحث'}
              </button>
            </form>

            <div className="helper">
              تقدر تبحث بالاسم أو تدخل رقم TMDB مباشرة.
            </div>

            {searchResults.length > 0 && (
              <div className="results-grid">
                {searchResults.map((item) => (
                  <div
                    className="result-card"
                    key={item.id}
                  >
                    <img
                      className="result-poster"
                      src={
                        item.poster_path
                          ? `${TMDB_IMAGE}/w342${item.poster_path}`
                          : 'https://via.placeholder.com/342x513?text=No+Poster'
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
                          ? item.vote_average.toFixed(1)
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
                          importSingleItem(item)
                        }
                        disabled={busy}
                      >
                        ➕ استيراد العمل
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* =========================
              الاستيراد الجماعي
          ========================= */}
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
                  setBulkPages(e.target.value)
                }
                placeholder="عدد الصفحات"
              />

              <select
                className="import-select"
                value={bulkType}
                onChange={(e) =>
                  setBulkType(e.target.value)
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
                  setBulkSource(e.target.value)
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
              كل صفحة TMDB تحتوي عادةً على حوالي 20 نتيجة
              لكل نوع.
            </div>

            <button
              className="import-button btn-blue"
              type="button"
              onClick={handleBulkImport}
              disabled={busy}
              style={{
                width: '100%',
                marginTop: '14px',
              }}
            >
              {isBulkLoading
                ? '⏳ جاري الاستيراد...'
                : '🚀 بدء الاستيراد الجماعي'}
            </button>
          </section>

          {/* =========================
              Trending
          ========================= */}
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
                  setTrendingCount(e.target.value)
                }
                placeholder="عدد الأعمال"
              />

              <select
                className="import-select"
                value={trendingType}
                onChange={(e) =>
                  setTrendingType(e.target.value)
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
              مثال: اكتب 20 لاستيراد 20 عمل Trending.
            </div>

            <button
              className="import-button btn-orange"
              type="button"
              onClick={handleTrendingImport}
              disabled={busy}
              style={{
                width: '100%',
                marginTop: '14px',
              }}
            >
              {isTrendingLoading
                ? '⏳ جاري الاستيراد...'
                : '🔥 استيراد Trending'}
            </button>
          </section>

          {/* =========================
              المسلسلات والحلقات
          ========================= */}
          <section className="import-card full">
            <h2 className="card-title green">
              📺 استيراد مسلسل بجميع حلقاته
            </h2>

            <form
              onSubmit={handleSeriesSearch}
              className="input-row"
            >
              <input
                className="import-input"
                type="text"
                value={seriesQuery}
                onChange={(e) =>
                  setSeriesQuery(e.target.value)
                }
                placeholder="اسم المسلسل أو TMDB ID..."
              />

              <button
                className="import-button btn-green"
                type="submit"
                disabled={isSeriesSearching}
              >
                {isSeriesSearching
                  ? '⏳ بحث...'
                  : '🔎 بحث عن مسلسل'}
              </button>
            </form>

            <div className="input-row" style={{ marginTop: 12 }}>
              <input
                className="import-input"
                type="number"
                min="1"
                max="10000"
                value={seriesEpisodeLimit}
                onChange={(e) =>
                  setSeriesEpisodeLimit(e.target.value)
                }
                placeholder="عدد الحلقات المطلوب استيرادها"
              />

              <span className="badge">
                يتم جلب المواسم والحلقات بالترتيب
              </span>
            </div>

            {seriesResults.length > 0 && (
              <div className="results-grid">
                {seriesResults.map((item) => (
                  <div
                    className="result-card"
                    key={item.id}
                  >
                    <img
                      className="result-poster"
                      src={
                        item.poster_path
                          ? `${TMDB_IMAGE}/w342${item.poster_path}`
                          : 'https://via.placeholder.com/342x513?text=No+Poster'
                      }
                      alt={item.name || 'Series'}
                    />

                    <div className="result-body">
                      <div className="result-title">
                        {item.name || 'بدون عنوان'}
                      </div>

                      <div className="result-meta">
                        ⭐{' '}
                        {typeof item.vote_average ===
                        'number'
                          ? item.vote_average.toFixed(1)
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
                          importSeriesWithEpisodes(item)
                        }
                        disabled={busy}
                      >
                        {isSeriesImporting
                          ? '⏳ جاري الاستيراد...'
                          : '📥 استيراد المسلسل والحلقات'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* =========================
              إصلاح URL
          ========================= */}
          <section className="import-card full">
            <h2 className="card-title">
              🛠️ فحص وإصلاح البيانات والروابط
            </h2>

            <p
              style={{
                color: '#999',
                fontSize: 13,
                lineHeight: 1.7,
                marginTop: 0,
              }}
            >
              يفحص سجلات جدول titles ويصحح نوع المسلسلات
              وروابط Poster و Backdrop التي ليست روابط كاملة،
              ثم يعطيك نتيجة التحقق.
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

          {/* =========================
              Logs
          ========================= */}
          <section className="import-card full">
            <div className="logs-head">
              <h2
                className="card-title"
                style={{ margin: 0 }}
              >
                📋 سجل العمليات
              </h2>

              <button
                className="clear-button"
                type="button"
                onClick={() => setLogs([])}
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
                logs.map((log, index) => {
                  let className = 'log-line';

                  if (log.includes('❌')) {
                    className += ' error';
                  } else if (
                    log.includes('✅') ||
                    log.includes('🎉')
                  ) {
                    className += ' success';
                  } else if (
                    log.includes('⚠️')
                  ) {
                    className += ' warning';
                  }

                  return (
                    <div
                      className={className}
                      key={`${log}-${index}`}
                    >
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

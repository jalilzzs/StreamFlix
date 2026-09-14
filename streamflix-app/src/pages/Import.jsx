import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Import() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);

  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [fillLoading, setFillLoading] = useState(false);

  const [searchStatus, setSearchStatus] = useState(true);
  const [testStatus, setTestStatus] = useState(true);
  const [importStatus, setImportStatus] = useState(true);

  const [message, setMessage] = useState('');
  const [bulkStats, setBulkStats] = useState(null);
  const [fillStats, setFillStats] = useState(null);
  const [errors, setErrors] = useState([]);

  /*
   * ============================================================
   * رابط الفيديو
   * ============================================================
   *
   * لا يتم وضع أي رابط تلقائياً عند الاستيراد.
   * يتم ملء url يدوياً أو باستعمال زر "ملء الروابط الفارغة"
   * من خلال القالب الذي يدخله المستخدم.
   */
  const getVideoUrl = () => {
    return '';
  };

  /*
   * ============================================================
   * جلب تفاصيل فيلم من TMDB
   * ============================================================
   */
  const getMovieDetails = async (id) => {
    const url =
      `https://api.themoviedb.org/3/movie/${id}` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=ar-AR`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`TMDB movie details: ${res.status}`);
    }

    return await res.json();
  };

  /*
   * ============================================================
   * جلب تفاصيل مسلسل من TMDB
   * ============================================================
   */
  const getTvDetails = async (id) => {
    const url =
      `https://api.themoviedb.org/3/tv/${id}` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=ar-AR`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`TMDB TV details: ${res.status}`);
    }

    return await res.json();
  };

  const TMDB_API_KEY =
    'bb04576f643a69128d4924c5aea7c339';

  /*
   * ============================================================
   * تحويل الفيلم
   * ============================================================
   */
  const movieToTitle = (movie) => {
    const year = movie.release_date
      ? parseInt(movie.release_date.split('-')[0])
      : null;

    return {
      name:
        movie.title ||
        movie.name ||
        'بدون اسم',

      synopsis:
        movie.overview ||
        'لا يوجد وصف متاح.',

      release_year:
        year ||
        2026,

      rating_avg:
        Number(movie.vote_average) || 0,

      type: 'movie',

      is_premium: false,

      poster_url:
        movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : '',

      /*
       * يبقى فارغاً.
       */
      url: getVideoUrl(),

      tmdb_id: movie.id
    };
  };

  /*
   * ============================================================
   * تحويل المسلسل
   * ============================================================
   */
  const tvToTitle = (show) => {
    const year = show.first_air_date
      ? parseInt(show.first_air_date.split('-')[0])
      : null;

    return {
      name:
        show.name ||
        'بدون اسم',

      synopsis:
        show.overview ||
        'لا يوجد وصف متاح.',

      release_year:
        year ||
        2026,

      rating_avg:
        Number(show.vote_average) || 0,

      type: 'series',

      is_premium: false,

      poster_url:
        show.poster_path
          ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
          : '',

      /*
       * يبقى فارغاً.
       */
      url: getVideoUrl(),

      tmdb_id: show.id
    };
  };

  /*
   * ============================================================
   * البحث
   * ============================================================
   */
  const handleSearch = async (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setSearchStatus('A');
    setMessage('');
    setMovies([]);
    setErrors([]);

    try {
      if (
        !TMDB_API_KEY ||
        TMDB_API_KEY.includes('ضع_مفتاح')
      ) {
        setSearchStatus('B');
        throw new Error(
          'مفتاح TMDB API غير معرّف.'
        );
      }

      const movieUrl =
        `https://api.themoviedb.org/3/search/movie` +
        `?api_key=${TMDB_API_KEY}` +
        `&query=${encodeURIComponent(query)}` +
        `&language=ar-AR`;

      const tvUrl =
        `https://api.themoviedb.org/3/search/tv` +
        `?api_key=${TMDB_API_KEY}` +
        `&query=${encodeURIComponent(query)}` +
        `&language=ar-AR`;

      const [movieRes, tvRes] =
        await Promise.all([
          fetch(movieUrl),
          fetch(tvUrl)
        ]);

      if (!movieRes.ok || !tvRes.ok) {
        setSearchStatus('C');

        throw new Error(
          'خطأ في الاتصال بـ TMDB'
        );
      }

      const movieData =
        await movieRes.json();

      const tvData =
        await tvRes.json();

      const movieResults =
        (movieData.results || []).map(
          item => ({
            ...item,
            media_type: 'movie'
          })
        );

      const tvResults =
        (tvData.results || []).map(
          item => ({
            ...item,
            media_type: 'tv'
          })
        );

      const combined = [
        ...movieResults,
        ...tvResults
      ];

      combined.sort(
        (a, b) =>
          (b.vote_average || 0) -
          (a.vote_average || 0)
      );

      setMovies(
        combined.slice(0, 40)
      );

      setSearchStatus(true);

      if (combined.length === 0) {
        setSearchStatus('D');

        setMessage(
          'لم يتم العثور على أي نتائج.'
        );
      }

    } catch (err) {
      console.error(
        'خطأ في البحث:',
        err
      );

      setMessage(
        `خطأ في البحث (${err.message})`
      );

    } finally {
      setLoading(false);
    }
  };

  /*
   * ============================================================
   * استيراد عنصر واحد
   * ============================================================
   */
  const handleImportMovie = async (item) => {
    setImportStatus('E');
    setMessage('');

    try {
      let details;

      if (item.media_type === 'tv') {
        details =
          await getTvDetails(item.id);
      } else {
        details =
          await getMovieDetails(item.id);
      }

      const titleData =
        item.media_type === 'tv'
          ? tvToTitle(details)
          : movieToTitle(details);

      /*
       * أولاً نتحقق بواسطة TMDB ID
       */
      const {
        data: existingByTmdb,
        error: tmdbCheckError
      } = await supabase
        .from('titles')
        .select('id,name,tmdb_id')
        .eq('tmdb_id', titleData.tmdb_id)
        .maybeSingle();

      if (tmdbCheckError) {
        throw tmdbCheckError;
      }

      if (existingByTmdb) {
        setImportStatus(true);

        setMessage(
          `"${titleData.name}" موجود مسبقاً، تم تخطيه.`
        );

        return;
      }

      /*
       * تحقق إضافي بالاسم
       */
      const {
        data: existingByName,
        error: nameCheckError
      } = await supabase
        .from('titles')
        .select('id,name')
        .eq('name', titleData.name)
        .maybeSingle();

      if (nameCheckError) {
        throw nameCheckError;
      }

      if (existingByName) {
        setImportStatus(true);

        setMessage(
          `"${titleData.name}" موجود مسبقاً، تم تخطيه.`
        );

        return;
      }

      const { error } =
        await supabase
          .from('titles')
          .insert([titleData]);

      if (error) {
        if (
          error.code === '23505' ||
          error.message?.includes(
            'titles_name_key'
          )
        ) {
          setImportStatus(true);

          setMessage(
            `"${titleData.name}" موجود مسبقاً، تم تخطيه.`
          );

          return;
        }

        throw error;
      }

      setImportStatus(true);

      setMessage(
        `تم استيراد "${titleData.name}" بنجاح ✅`
      );

    } catch (err) {
      console.error(
        'Import error:',
        err
      );

      setImportStatus('G');

      setMessage(
        `خطأ في الاستيراد: ${err.message}`
      );
    }
  };

  /*
   * ============================================================
   * اختبار الإضافة
   * ============================================================
   */
  const handleTestInsert = async () => {
    setTestStatus('H');
    setMessage('');

    try {
      const testMovieId = 550;

      const details =
        await getMovieDetails(
          testMovieId
        );

      const titleData =
        movieToTitle(details);

      const {
        data: existingByTmdb,
        error: tmdbCheckError
      } = await supabase
        .from('titles')
        .select('id,name,tmdb_id')
        .eq('tmdb_id', titleData.tmdb_id)
        .maybeSingle();

      if (tmdbCheckError) {
        throw tmdbCheckError;
      }

      if (existingByTmdb) {
        setTestStatus(true);

        setMessage(
          'الفيلم التجريبي موجود مسبقاً، لذلك لم تتم إضافته مرة ثانية.'
        );

        return;
      }

      const {
        data: existingByName,
        error: nameCheckError
      } = await supabase
        .from('titles')
        .select('id,name')
        .eq('name', titleData.name)
        .maybeSingle();

      if (nameCheckError) {
        throw nameCheckError;
      }

      if (existingByName) {
        setTestStatus(true);

        setMessage(
          'الفيلم التجريبي موجود مسبقاً، لذلك لم تتم إضافته مرة ثانية.'
        );

        return;
      }

      const { error } =
        await supabase
          .from('titles')
          .insert([titleData]);

      if (error) {
        throw error;
      }

      setTestStatus(true);

      setMessage(
        'تم إضافة الفيلم التجريبي بنجاح ✅'
      );

    } catch (err) {
      console.error(err);

      setTestStatus('J');

      setMessage(
        `خطأ في الاختبار: ${err.message}`
      );
    }
  };

  /*
   * ============================================================
   * الأفلام الشعبية
   * ============================================================
   */
  const getPopularMovies = async () => {
    const all = [];

    for (let page = 1; page <= 2; page++) {
      const url =
        `https://api.themoviedb.org/3/movie/popular` +
        `?api_key=${TMDB_API_KEY}` +
        `&language=ar-AR` +
        `&page=${page}`;

      const res =
        await fetch(url);

      if (!res.ok) {
        throw new Error(
          `فشل جلب الأفلام: ${res.status}`
        );
      }

      const data =
        await res.json();

      all.push(
        ...(data.results || []).map(
          item => ({
            ...item,
            media_type: 'movie'
          })
        )
      );
    }

    return all;
  };

  /*
   * ============================================================
   * المسلسلات الشعبية
   * ============================================================
   */
  const getPopularSeries = async () => {
    const all = [];

    for (let page = 1; page <= 2; page++) {
      const url =
        `https://api.themoviedb.org/3/tv/popular` +
        `?api_key=${TMDB_API_KEY}` +
        `&language=ar-AR` +
        `&page=${page}`;

      const res =
        await fetch(url);

      if (!res.ok) {
        throw new Error(
          `فشل جلب المسلسلات: ${res.status}`
        );
      }

      const data =
        await res.json();

      all.push(
        ...(data.results || []).map(
          item => ({
            ...item,
            media_type: 'tv'
          })
        )
      );
    }

    return all;
  };

  /*
   * ============================================================
   * الاستيراد الجماعي
   * ============================================================
   */
  const handleBulkImport = async () => {
    if (bulkLoading) return;

    setBulkLoading(true);
    setMessage('');
    setErrors([]);

    setBulkStats({
      total: 0,
      added: 0,
      existing: 0,
      failed: 0
    });

    try {
      const [
        moviesList,
        seriesList
      ] = await Promise.all([
        getPopularMovies(),
        getPopularSeries()
      ]);

      const allItems = [
        ...moviesList,
        ...seriesList
      ];

      /*
       * إزالة التكرار داخل نفس الدفعة
       */
      const uniqueItems = [];
      const seenIds = new Set();

      for (const item of allItems) {
        const key =
          `${item.media_type}-${item.id}`;

        if (seenIds.has(key)) {
          continue;
        }

        seenIds.add(key);
        uniqueItems.push(item);
      }

      const itemsToImport =
        uniqueItems.slice(0, 40);

      let added = 0;
      let existingCount = 0;
      let failed = 0;

      const errorList = [];

      setBulkStats({
        total: itemsToImport.length,
        added: 0,
        existing: 0,
        failed: 0
      });

      /*
       * نستعمل مجموعة لتسجيل الموجودين
       * حتى لا نعيد الاستعلام عن نفس العنصر.
       */
      const existingTmdbIds =
        new Set();

      /*
       * جلب TMDB IDs الموجودة مسبقاً
       */
      const tmdbIds =
        itemsToImport
          .map(item => item.id)
          .filter(Boolean);

      /*
       * Supabase .in قد لا يقبل مصفوفة فارغة
       */
      if (tmdbIds.length > 0) {
        const {
          data: existingRows,
          error: existingError
        } = await supabase
          .from('titles')
          .select('id,tmdb_id')
          .in('tmdb_id', tmdbIds);

        if (existingError) {
          throw existingError;
        }

        (existingRows || []).forEach(
          row => {
            if (row.tmdb_id !== null) {
              existingTmdbIds.add(
                Number(row.tmdb_id)
              );
            }
          }
        );
      }

      /*
       * الآن نعالج العناصر الجديدة فقط.
       */
      for (const item of itemsToImport) {
        try {
          /*
           * موجود بواسطة TMDB ID؟
           * نتخطاه مباشرة.
           */
          if (
            existingTmdbIds.has(
              Number(item.id)
            )
          ) {
            existingCount++;

            setBulkStats({
              total:
                itemsToImport.length,
              added,
              existing:
                existingCount,
              failed
            });

            continue;
          }

          let details;

          if (item.media_type === 'tv') {
            details =
              await getTvDetails(
                item.id
              );
          } else {
            details =
              await getMovieDetails(
                item.id
              );
          }

          const titleData =
            item.media_type === 'tv'
              ? tvToTitle(details)
              : movieToTitle(details);

          /*
           * تحقق أخير بالاسم.
           */
          const {
            data: existingByName,
            error: nameCheckError
          } = await supabase
            .from('titles')
            .select('id,name')
            .eq('name', titleData.name)
            .maybeSingle();

          if (nameCheckError) {
            throw nameCheckError;
          }

          if (existingByName) {
            existingCount++;

            setBulkStats({
              total:
                itemsToImport.length,
              added,
              existing:
                existingCount,
              failed
            });

            continue;
          }

          /*
           * إضافة الجديد فقط.
           * url فارغ.
           */
          const { error } =
            await supabase
              .from('titles')
              .insert([
                titleData
              ]);

          if (error) {
            if (
              error.code === '23505' ||
              error.message?.includes(
                'titles_name_key'
              )
            ) {
              existingCount++;
            } else {
              throw error;
            }
          } else {
            added++;

            /*
             * نسجل الـID حتى لو تكرر
             * لاحقاً داخل نفس الدفعة.
             */
            existingTmdbIds.add(
              Number(titleData.tmdb_id)
            );
          }

          setBulkStats({
            total:
              itemsToImport.length,
            added,
            existing:
              existingCount,
            failed
          });

        } catch (err) {
          failed++;

          errorList.push({
            name:
              item.title ||
              item.name ||
              'بدون اسم',

            error:
              err.message ||
              'خطأ غير معروف'
          });

          setBulkStats({
            total:
              itemsToImport.length,
            added,
            existing:
              existingCount,
            failed
          });
        }
      }

      setErrors(errorList);

      setMessage(
        `اكتمل الاستيراد 🚀 | تمت الإضافة: ${added} | تم تخطي الموجود: ${existingCount} | أخطاء: ${failed}`
      );

    } catch (err) {
      console.error(
        'Bulk import error:',
        err
      );

      setMessage(
        `فشل الاستيراد الجماعي: ${err.message}`
      );

    } finally {
      setBulkLoading(false);
    }
  };

  /*
   * ============================================================
   * ملء الروابط الفارغة
   * ============================================================
   *
   * المستخدم يدخل قالب الرابط بنفسه.
   *
   * مثال:
   * https://example.com/movie/{tmdb_id}
   *
   * سيتم تحويل:
   * {tmdb_id}
   *
   * إلى ID الخاص بكل فيلم/مسلسل.
   *
   * يتم تعديل السجلات التي url تاعها فارغ فقط.
   */
  const handleFillEmptyUrls = async () => {
    if (fillLoading) return;

    const template =
      window.prompt(
        'أدخل قالب رابط الفيديو، واستعمل {tmdb_id} مكان رقم TMDB:\n\nمثال:\nhttps://example.com/movie/{tmdb_id}'
      );

    if (template === null) {
      return;
    }

    const cleanTemplate =
      template.trim();

    if (!cleanTemplate) {
      setMessage(
        'لم يتم إدخال قالب للرابط.'
      );

      return;
    }

    if (
      !cleanTemplate.includes(
        '{tmdb_id}'
      )
    ) {
      setMessage(
        'القالب لازم يحتوي على {tmdb_id}.'
      );

      return;
    }

    setFillLoading(true);
    setFillStats(null);
    setMessage('');
    setErrors([]);

    try {
      /*
       * نجيب فقط السجلات التي url تاعها
       * NULL أو فارغ.
       */
      const {
        data: emptyTitles,
        error: fetchError
      } = await supabase
        .from('titles')
        .select(
          'id,name,tmdb_id,type,url'
        )
        .or(
          'url.is.null,url.eq.'
        );

      if (fetchError) {
        throw fetchError;
      }

      const rows =
        emptyTitles || [];

      let filled = 0;
      let skipped = 0;
      let failed = 0;

      const fillErrors = [];

      setFillStats({
        total: rows.length,
        filled: 0,
        skipped: 0,
        failed: 0
      });

      for (const row of rows) {
        try {
          /*
           * حماية إضافية:
           * إذا وجد URL رغم الاستعلام، لا نلمسه.
           */
          if (
            row.url &&
            String(row.url).trim()
          ) {
            skipped++;

            setFillStats({
              total: rows.length,
              filled,
              skipped,
              failed
            });

            continue;
          }

          if (
            row.tmdb_id === null ||
            row.tmdb_id === undefined ||
            String(row.tmdb_id).trim() === ''
          ) {
            skipped++;

            setFillStats({
              total: rows.length,
              filled,
              skipped,
              failed
            });

            continue;
          }

          const generatedUrl =
            cleanTemplate.replace(
              /\{tmdb_id\}/g,
              String(row.tmdb_id)
            );

          if (!generatedUrl.trim()) {
            skipped++;

            continue;
          }

          /*
           * تحديث هذا السجل فقط.
           */
          const {
            error: updateError
          } = await supabase
            .from('titles')
            .update({
              url: generatedUrl
            })
            .eq('id', row.id)
            .or(
              'url.is.null,url.eq.'
            );

          if (updateError) {
            throw updateError;
          }

          filled++;

          setFillStats({
            total: rows.length,
            filled,
            skipped,
            failed
          });

        } catch (err) {
          failed++;

          fillErrors.push({
            name:
              row.name ||
              'بدون اسم',

            error:
              err.message ||
              'خطأ غير معروف'
          });

          setFillStats({
            total: rows.length,
            filled,
            skipped,
            failed
          });
        }
      }

      setErrors(fillErrors);

      setMessage(
        `اكتمل ملء الروابط 🔗 | تم ملء: ${filled} | تم تخطي: ${skipped} | أخطاء: ${failed}`
      );

    } catch (err) {
      console.error(
        'Fill URLs error:',
        err
      );

      setMessage(
        `فشل ملء الروابط: ${err.message}`
      );

    } finally {
      setFillLoading(false);
    }
  };

  return (
    <div
      style={{
        background: '#111',
        color: '#fff',
        minHeight: '100vh',
        padding: '20px',
        direction: 'rtl'
      }}
    >

      <h1
        style={{
          textAlign: 'center',
          marginBottom: '25px'
        }}
      >
        لوحة التحكم والاستيراد
      </h1>

      {/* =====================================================
          الاستيراد الجماعي
      ====================================================== */}
      <div
        style={{
          background: '#1a1a1a',
          padding: '25px',
          borderRadius: '10px',
          maxWidth: '700px',
          margin: '0 auto 25px auto',
          textAlign: 'center',
          border: '1px solid #333'
        }}
      >
        <h2>
          🚀 استيراد أفلام ومسلسلات
        </h2>

        <p
          style={{
            color: '#aaa',
            lineHeight: '1.8'
          }}
        >
          يجلب مجموعة من الأفلام والمسلسلات
          من TMDB مع البوستر والوصف والتقييم
          والسنة و TMDB ID.
          <br />
          العناصر الموجودة مسبقاً يتم تخطيها
          تلقائياً بدون أخطاء.
          <br />
          رابط الفيديو يبقى فارغاً عند الاستيراد.
        </p>

        <button
          onClick={handleBulkImport}
          disabled={bulkLoading}
          style={{
            padding: '14px 30px',
            background:
              bulkLoading
                ? '#555'
                : '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor:
              bulkLoading
                ? 'not-allowed'
                : 'pointer',
            fontWeight: 'bold',
            fontSize: '18px'
          }}
        >
          {bulkLoading
            ? '⏳ جاري الاستيراد...'
            : '🚀 استيراد دفعة جديدة'}
        </button>

        {bulkStats && (
          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <span>
              📦 الكل: {bulkStats.total}
            </span>

            <span>
              ✅ تمت الإضافة: {bulkStats.added}
            </span>

            <span>
              ♻️ تم تخطي الموجود: {
                bulkStats.existing
              }
            </span>

            <span>
              ❌ أخطاء: {bulkStats.failed}
            </span>
          </div>
        )}
      </div>

      {/* =====================================================
          ملء الروابط الفارغة
      ====================================================== */}
      <div
        style={{
          background: '#1a1a1a',
          padding: '25px',
          borderRadius: '10px',
          maxWidth: '700px',
          margin: '0 auto 25px auto',
          textAlign: 'center',
          border: '1px solid #333'
        }}
      >
        <h2>
          🔗 ملء الروابط الفارغة
        </h2>

        <p
          style={{
            color: '#aaa',
            lineHeight: '1.8'
          }}
        >
          يبحث عن جميع الأفلام والمسلسلات التي
          خانة <b>url</b> تاعها فارغة،
          ثم يطلب منك قالب الرابط.
          <br />
          استعمل <b>{'{tmdb_id}'}</b> مكان رقم
          TMDB، وسيتم استبداله تلقائياً لكل
          فيلم.
          <br />
          الروابط الموجودة مسبقاً لا يتم لمسها.
        </p>

        <button
          onClick={
            handleFillEmptyUrls
          }
          disabled={fillLoading}
          style={{
            padding: '14px 30px',
            background:
              fillLoading
                ? '#555'
                : '#9c27b0',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor:
              fillLoading
                ? 'not-allowed'
                : 'pointer',
            fontWeight: 'bold',
            fontSize: '18px'
          }}
        >
          {fillLoading
            ? '⏳ جاري ملء الروابط...'
            : '🔗 ملء الروابط الفارغة'}
        </button>

        {fillStats && (
          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <span>
              📦 الفارغة: {fillStats.total}
            </span>

            <span>
              ✅ تم ملؤها: {fillStats.filled}
            </span>

            <span>
              ⏭️ تم تخطيها: {fillStats.skipped}
            </span>

            <span>
              ❌ أخطاء: {fillStats.failed}
            </span>
          </div>
        )}
      </div>

      {/* =====================================================
          الاختبار
      ====================================================== */}
      <div
        style={{
          background: '#1a1a1a',
          padding: '20px',
          borderRadius: '10px',
          maxWidth: '600px',
          margin: '0 auto 20px auto',
          textAlign: 'center',
          border: '1px solid #333'
        }}
      >
        <h3>
          خانة الإضافة الفورية التجريبية
        </h3>

        <button
          onClick={handleTestInsert}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ⚡ تنفيذ إضافة فيلم تجريبي
        </button>
      </div>

      {/* =====================================================
          البحث الفردي
      ====================================================== */}
      <div
        style={{
          background: '#1a1a1a',
          padding: '20px',
          borderRadius: '10px',
          maxWidth: '600px',
          margin: '0 auto 20px auto',
          border: '1px solid #333'
        }}
      >
        <h3
          style={{
            textAlign: 'center'
          }}
        >
          🔎 البحث عن فيلم أو مسلسل معين
        </h3>

        <form
          onSubmit={handleSearch}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <input
            type="text"
            placeholder="اكتب اسم الفيلم أو المسلسل..."
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            style={{
              padding: '10px',
              width: '300px',
              borderRadius: '5px',
              border: '1px solid #333',
              background: '#222',
              color: '#fff'
            }}
          />

          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#e50914',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            {loading
              ? 'جاري البحث...'
              : 'بحث'}
          </button>
        </form>
      </div>

      {/* =====================================================
          الرسالة
      ====================================================== */}
      {message && (
        <p
          style={{
            textAlign: 'center',
            color:
              message.includes('خطأ') ||
              message.includes('فشل')
                ? '#ff4d4d'
                : '#46d369',
            marginBottom: '20px',
            fontWeight: 'bold',
            fontSize: '18px'
          }}
        >
          {message}
        </p>
      )}

      {/* =====================================================
          الأخطاء
      ====================================================== */}
      {errors.length > 0 && (
        <div
          style={{
            background: '#241515',
            border: '1px solid #6b2929',
            borderRadius: '10px',
            padding: '20px',
            maxWidth: '900px',
            margin: '0 auto 25px auto'
          }}
        >
          <h3
            style={{
              color: '#ff7777'
            }}
          >
            🔎 تفاصيل الأخطاء
          </h3>

          {errors
            .slice(0, 20)
            .map(
              (item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '10px 0',
                    borderBottom:
                      '1px solid #422'
                  }}
                >
                  <strong>
                    {index + 1}.{' '}
                    {item.name}
                  </strong>

                  <div
                    style={{
                      color: '#ffaaaa',
                      marginTop: '5px'
                    }}
                  >
                    {item.error}
                  </div>
                </div>
              )
            )}
        </div>
      )}

      {/* =====================================================
          نتائج البحث
      ====================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px',
          maxWidth: '1000px',
          margin: '0 auto'
        }}
      >
        {movies.map((item) => (
          <div
            key={`${item.media_type}-${item.id}`}
            style={{
              background: '#1a1a1a',
              borderRadius: '8px',
              overflow: 'hidden',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '1px solid #333'
            }}
          >
            <div>
              {item.poster_path ? (
                <img
                  src={
                    `https://image.tmdb.org/t/p/w300` +
                    item.poster_path
                  }
                  alt={
                    item.title ||
                    item.name
                  }
                  style={{
                    width: '100%',
                    height: '280px',
                    objectFit: 'cover',
                    borderRadius: '5px'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '280px',
                    background: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '5px'
                  }}
                >
                  لا توجد صورة
                </div>
              )}

              <h3
                style={{
                  fontSize: '16px',
                  margin:
                    '10px 0 5px 0'
                }}
              >
                {item.title ||
                  item.name}
              </h3>

              <p
                style={{
                  fontSize: '12px',
                  color: '#aaa'
                }}
              >
                {item.media_type === 'tv'
                  ? '📺 مسلسل'
                  : '🎬 فيلم'}
              </p>

              <p
                style={{
                  fontSize: '12px',
                  color: '#aaa'
                }}
              >
                ⭐{' '}
                {item.vote_average
                  ? Number(
                      item.vote_average
                    ).toFixed(1)
                  : '0.0'}
              </p>

              <p
                style={{
                  fontSize: '12px',
                  color: '#aaa'
                }}
              >
                {item.release_date
                  ? item.release_date.split(
                      '-'
                    )[0]
                  : item.first_air_date
                    ? item.first_air_date.split(
                        '-'
                      )[0]
                    : 'غير معروف'}
              </p>
            </div>

            <button
              onClick={() =>
                handleImportMovie(item)
              }
              style={{
                marginTop: '10px',
                padding: '8px',
                background: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              📥 استيراد للسيستيم
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

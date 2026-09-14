import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Import() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);

  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [searchStatus, setSearchStatus] = useState(true);
  const [testStatus, setTestStatus] = useState(true);
  const [importStatus, setImportStatus] = useState(true);

  const [message, setMessage] = useState('');
  const [bulkStats, setBulkStats] = useState(null);
  const [errors, setErrors] = useState([]);

  const TMDB_API_KEY = 'bb04576f643a69128d4924c5aea7c339';

  /*
   * ============================================================
   * مصدر الفيديو
   * ============================================================
   *
   * ضع هنا فقط رابط/Endpoint لمصدر بث لديك الحق في استخدامه.
   *
   * حالياً نستعمل الرابط الموجود في مشروعك.
   * إذا كان عندك مزود مرخّص آخر، غير هذه الدالة فقط.
   */
  const getVideoUrl = (type, tmdbId) => {
    if (type === 'tv') {
      return `https://vidsrc.to/embed/tv/${tmdbId}`;
    }

    return `https://vidsrc.to/embed/movie/${tmdbId}`;
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

  /*
   * ============================================================
   * تحويل بيانات الفيلم إلى شكل قاعدة البيانات
   * ============================================================
   */
  const movieToTitle = (movie) => {
    const year = movie.release_date
      ? parseInt(movie.release_date.split('-')[0])
      : null;

    return {
      name: movie.title || movie.name || 'بدون اسم',

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

      url: getVideoUrl('movie', movie.id),

      tmdb_id: movie.id
    };
  };

  /*
   * ============================================================
   * تحويل بيانات المسلسل إلى شكل قاعدة البيانات
   * ============================================================
   */
  const tvToTitle = (show) => {
    const year = show.first_air_date
      ? parseInt(show.first_air_date.split('-')[0])
      : null;

    return {
      name: show.name || 'بدون اسم',

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

      url: getVideoUrl('tv', show.id),

      tmdb_id: show.id
    };
  };

  /*
   * ============================================================
   * البحث الفردي
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
      if (!TMDB_API_KEY || TMDB_API_KEY.includes('ضع_مفتاح')) {
        setSearchStatus('B');
        throw new Error('مفتاح TMDB API غير معرّف.');
      }

      /*
       * نبحث في الأفلام والمسلسلات معاً
       */
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

      const [movieRes, tvRes] = await Promise.all([
        fetch(movieUrl),
        fetch(tvUrl)
      ]);

      if (!movieRes.ok || !tvRes.ok) {
        setSearchStatus('C');
        throw new Error(
          `خطأ في الاتصال بـ TMDB`
        );
      }

      const movieData = await movieRes.json();
      const tvData = await tvRes.json();

      const movieResults = (movieData.results || []).map(item => ({
        ...item,
        media_type: 'movie'
      }));

      const tvResults = (tvData.results || []).map(item => ({
        ...item,
        media_type: 'tv'
      }));

      const combined = [
        ...movieResults,
        ...tvResults
      ];

      /*
       * ترتيب حسب التقييم
       */
      combined.sort(
        (a, b) =>
          (b.vote_average || 0) -
          (a.vote_average || 0)
      );

      setMovies(combined.slice(0, 40));
      setSearchStatus(true);

      if (combined.length === 0) {
        setSearchStatus('D');
        setMessage('لم يتم العثور على أي نتائج.');
      }
    } catch (err) {
      console.error('خطأ في البحث:', err);

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
        details = await getTvDetails(item.id);
      } else {
        details = await getMovieDetails(item.id);
      }

      const titleData =
        item.media_type === 'tv'
          ? tvToTitle(details)
          : movieToTitle(details);

      /*
       * أهم جزء:
       * نتحقق من الاسم قبل INSERT
       */
      const { data: existing, error: checkError } =
        await supabase
          .from('titles')
          .select('id,name')
          .eq('name', titleData.name)
          .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existing) {
        setImportStatus(true);

        setMessage(
          `الفيلم/المسلسل "${titleData.name}" موجود مسبقاً، لم تتم إضافته مرة أخرى.`
        );

        return;
      }

      const { error } = await supabase
        .from('titles')
        .insert([titleData]);

      if (error) {
        /*
         * إذا صار Race condition أو كان موجوداً أصلاً
         */
        if (
          error.code === '23505' ||
          error.message?.includes('titles_name_key')
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
      console.error('Import error:', err);

      setImportStatus('G');

      setMessage(
        `خطأ في الاستيراد: ${err.message}`
      );
    }
  };

  /*
   * ============================================================
   * إضافة فيلم تجريبي
   * ============================================================
   */
  const handleTestInsert = async () => {
    setTestStatus('H');
    setMessage('');

    try {
      const testMovieId = 550;

      const details =
        await getMovieDetails(testMovieId);

      const titleData =
        movieToTitle(details);

      const { data: existing, error: checkError } =
        await supabase
          .from('titles')
          .select('id,name')
          .eq('name', titleData.name)
          .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existing) {
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
   * جلب الأفلام الشعبية
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

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(
          `فشل جلب الأفلام: ${res.status}`
        );
      }

      const data = await res.json();

      all.push(
        ...(data.results || [])
          .map(item => ({
            ...item,
            media_type: 'movie'
          }))
      );
    }

    return all;
  };

  /*
   * ============================================================
   * جلب المسلسلات الشعبية
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

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(
          `فشل جلب المسلسلات: ${res.status}`
        );
      }

      const data = await res.json();

      all.push(
        ...(data.results || [])
          .map(item => ({
            ...item,
            media_type: 'tv'
          }))
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
      /*
       * نجيب أفلام + مسلسلات
       */
      const [moviesList, seriesList] =
        await Promise.all([
          getPopularMovies(),
          getPopularSeries()
        ]);

      const allItems = [
        ...moviesList,
        ...seriesList
      ];

      /*
       * نمنع التكرار داخل نفس عملية الاستيراد
       */
      const uniqueItems = [];
      const seenIds = new Set();

      for (const item of allItems) {
        const key =
          `${item.media_type}-${item.id}`;

        if (seenIds.has(key)) continue;

        seenIds.add(key);
        uniqueItems.push(item);
      }

      /*
       * نحدد عدد العناصر المراد معالجتها
       */
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
       * نعالجهم واحداً واحداً
       * حتى لا نضغط TMDB/Supabase دفعة واحدة
       */
      for (const item of itemsToImport) {
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
           * التحقق من الاسم الموجود
           */
          const { data: existing, error: checkError } =
            await supabase
              .from('titles')
              .select('id,name')
              .eq('name', titleData.name)
              .maybeSingle();

          if (checkError) {
            throw checkError;
          }

          /*
           * موجود → نتخطاه
           */
          if (existing) {
            existingCount++;

            setBulkStats({
              total: itemsToImport.length,
              added,
              existing: existingCount,
              failed
            });

            continue;
          }

          /*
           * جديد → نضيفه
           */
          const { error } =
            await supabase
              .from('titles')
              .insert([titleData]);

          if (error) {
            /*
             * duplicate key = موجود
             */
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
          }

          setBulkStats({
            total: itemsToImport.length,
            added,
            existing: existingCount,
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
            total: itemsToImport.length,
            added,
            existing: existingCount,
            failed
          });
        }
      }

      setErrors(errorList);

      setMessage(
        `اكتمل الاستيراد 🚀 | تمت الإضافة: ${added} | موجود مسبقاً: ${existingCount} | أخطاء: ${failed}`
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
        </p>

        <button
          onClick={handleBulkImport}
          disabled={bulkLoading}
          style={{
            padding: '14px 30px',
            background: bulkLoading
              ? '#555'
              : '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: bulkLoading
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
            <span>📦 الكل: {bulkStats.total}</span>

            <span>
              ✅ تمت الإضافة: {bulkStats.added}
            </span>

            <span>
              ♻️ موجود: {bulkStats.existing}
            </span>

            <span>
              ❌ أخطاء: {bulkStats.failed}
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

          {errors.slice(0, 20).map(
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
                  {index + 1}. {item.name}
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

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Import() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchStatus, setSearchStatus] = useState(true);
  const [testStatus, setTestStatus] = useState(true);
  const [importStatus, setImportStatus] = useState(true);
  const [bulkStatus, setBulkStatus] = useState(true);

  const [message, setMessage] = useState('');
  const [bulkProgress, setBulkProgress] = useState(0);

  const TMDB_API_KEY = 'bb04576f643a69128d4924c5aea7c339';

  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';

  // =========================================================
  // TMDB REQUEST
  // =========================================================

  const tmdbRequest = async (endpoint) => {
    const separator = endpoint.includes('?') ? '&' : '?';

    const response = await fetch(
      `${TMDB_BASE}${endpoint}${separator}api_key=${TMDB_API_KEY}&language=ar-AR`
    );

    if (!response.ok) {
      throw new Error(`TMDB ${response.status}`);
    }

    return await response.json();
  };

  // =========================================================
  // SEARCH MOVIES + TV
  // =========================================================

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setSearchStatus('A');
    setMessage('');
    setMovies([]);

    try {
      if (!TMDB_API_KEY || TMDB_API_KEY.includes('ضع_مفتاح')) {
        setSearchStatus('B');
        throw new Error('مفتاح TMDB API غير معرّف.');
      }

      const encodedQuery = encodeURIComponent(query.trim());

      const [movieData, tvData] = await Promise.all([
        tmdbRequest(`/search/movie?query=${encodedQuery}`),
        tmdbRequest(`/search/tv?query=${encodedQuery}`)
      ]);

      const movieResults = (movieData.results || []).map((item) => ({
        ...item,
        media_type: 'movie'
      }));

      const tvResults = (tvData.results || []).map((item) => ({
        ...item,
        media_type: 'tv'
      }));

      const combined = [...movieResults, ...tvResults];

      setMovies(combined);
      setSearchStatus(true);

      if (combined.length === 0) {
        setSearchStatus('D');
        setMessage('لم يتم العثور على أي فيلم أو مسلسل.');
      }
    } catch (err) {
      console.error('خطأ في البحث:', err);

      setSearchStatus('C');
      setMessage(`خطأ في البحث: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // GET FULL DETAILS
  // =========================================================

  const getFullDetails = async (item) => {
    const type = item.media_type === 'tv' ? 'tv' : 'movie';

    const details = await tmdbRequest(
      `/${type}/${item.id}`
    );

    return {
      ...item,
      ...details,
      media_type: type
    };
  };

  // =========================================================
  // BUILD DATABASE OBJECT
  // =========================================================

  const buildTitleObject = (item, details) => {
    const isTV = item.media_type === 'tv';

    const title =
      details.title ||
      details.name ||
      item.title ||
      item.name ||
      'بدون اسم';

    const releaseDate =
      details.release_date ||
      details.first_air_date ||
      '';

    const year = releaseDate
      ? parseInt(releaseDate.split('-')[0])
      : null;

    return {
      name: title,

      synopsis:
        details.overview ||
        item.overview ||
        'لا يوجد وصف متاح.',

      release_year:
        Number.isFinite(year) ? year : null,

      rating_avg:
        Number(details.vote_average || item.vote_average || 0),

      type: isTV ? 'tv' : 'movie',

      is_premium: false,

      poster_url:
        details.poster_path
          ? `${TMDB_IMAGE}${details.poster_path}`
          : item.poster_path
            ? `${TMDB_IMAGE}${item.poster_path}`
            : '',

      url:
        isTV
          ? `https://vidsrc.to/embed/tv/${item.id}`
          : `https://vidsrc.to/embed/movie/${item.id}`,

      tmdb_id: item.id
    };
  };

  // =========================================================
  // IMPORT ONE MOVIE / TV SHOW
  // =========================================================

  const handleImportMovie = async (item) => {
    setImportStatus('E');
    setMessage('');

    try {
      const details = await getFullDetails(item);

      const titleObject = buildTitleObject(item, details);

      // منع التكرار حسب TMDB ID + النوع
      const { data: existing, error: checkError } = await supabase
        .from('titles')
        .select('id')
        .eq('tmdb_id', item.id)
        .eq('type', titleObject.type)
        .limit(1);

      if (checkError) {
        throw checkError;
      }

      if (existing && existing.length > 0) {
        setImportStatus('DUPLICATE');

        setMessage(
          `هذا ${titleObject.type === 'tv' ? 'المسلسل' : 'الفيلم'} موجود مسبقًا.`
        );

        return;
      }

      const { error } = await supabase
        .from('titles')
        .insert([titleObject]);

      if (error) {
        setImportStatus('F');

        setMessage(
          `خطأ قاعدة البيانات: ${error.message}`
        );

        return;
      }

      setImportStatus(true);

      setMessage(
        `تم استيراد "${titleObject.name}" بنجاح ✅`
      );

    } catch (err) {
      console.error('Import error:', err);

      setImportStatus('G');

      setMessage(
        `خطأ في الاستيراد: ${err.message}`
      );
    }
  };

  // =========================================================
  // TEST INSERT
  // =========================================================

  const handleTestInsert = async () => {
    setTestStatus('H');

    try {
      const testMovieId = 550;

      const generatedUrl =
        `https://vidsrc.to/embed/movie/${testMovieId}`;

      const { error } = await supabase
        .from('titles')
        .insert([
          {
            name: 'فيلم تجريبي (Fight Club)',
            synopsis: 'فيلم تجريبي للاختبار الفوري.',
            release_year: 1999,
            rating_avg: 8.4,
            type: 'movie',
            is_premium: false,
            poster_url:
              'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
            url: generatedUrl,
            tmdb_id: testMovieId
          }
        ]);

      if (error) {
        setTestStatus('I');

        setMessage(
          `خطأ في الإضافة التجريبية: ${error.message}`
        );

      } else {
        setTestStatus(true);

        setMessage(
          'تم إضافة الفيلم التجريبي مع TMDB ID (550) بنجاح!'
        );
      }

    } catch (err) {
      setTestStatus('J');

      setMessage(
        `خطأ استثنائي في الاختبار: ${err.message}`
      );
    }
  };

  // =========================================================
  // BULK IMPORT
  // =========================================================

  const handleBulkImport = async () => {
    setBulkStatus('LOADING');
    setBulkProgress(0);
    setMessage('');

    try {
      if (!TMDB_API_KEY) {
        throw new Error('TMDB API Key غير موجود.');
      }

      /*
       * نجيب عدة صفحات:
       * أفلام + مسلسلات
       *
       * يمكن تغيير عدد الصفحات من هنا.
       */

      const pages = [1, 2, 3];

      let allItems = [];

      for (const page of pages) {
        const [moviesData, tvData] = await Promise.all([
          tmdbRequest(
            `/discover/movie?sort_by=popularity.desc&page=${page}`
          ),

          tmdbRequest(
            `/discover/tv?sort_by=popularity.desc&page=${page}`
          )
        ]);

        const movieItems = (moviesData.results || []).map(
          (item) => ({
            ...item,
            media_type: 'movie'
          })
        );

        const tvItems = (tvData.results || []).map(
          (item) => ({
            ...item,
            media_type: 'tv'
          })
        );

        allItems.push(
          ...movieItems,
          ...tvItems
        );
      }

      /*
       * إزالة التكرار
       */

      const uniqueMap = new Map();

      for (const item of allItems) {
        const key =
          `${item.media_type}-${item.id}`;

        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      }

      const uniqueItems =
        Array.from(uniqueMap.values());

      let imported = 0;
      let skipped = 0;
      let failed = 0;

      /*
       * استيراد العناصر واحدًا واحدًا
       * حتى لا نضغط على API أو Supabase
       */

      for (let i = 0; i < uniqueItems.length; i++) {
        const item = uniqueItems[i];

        try {
          const details =
            await getFullDetails(item);

          const titleObject =
            buildTitleObject(item, details);

          /*
           * تحقق من وجوده
           */

          const { data: existing, error: checkError } =
            await supabase
              .from('titles')
              .select('id')
              .eq('tmdb_id', item.id)
              .eq('type', titleObject.type)
              .limit(1);

          if (checkError) {
            throw checkError;
          }

          if (existing && existing.length > 0) {
            skipped++;
          } else {
            const { error: insertError } =
              await supabase
                .from('titles')
                .insert([titleObject]);

            if (insertError) {
              throw insertError;
            }

            imported++;
          }

        } catch (itemError) {
          console.error(
            'Bulk item error:',
            itemError
          );

          failed++;
        }

        const progress =
          Math.round(
            ((i + 1) / uniqueItems.length) * 100
          );

        setBulkProgress(progress);
      }

      setBulkStatus(true);

      setMessage(
        `اكتمل الاستيراد 🚀 | تمت الإضافة: ${imported} | موجود مسبقًا: ${skipped} | أخطاء: ${failed}`
      );

    } catch (err) {
      console.error(
        'Bulk import error:',
        err
      );

      setBulkStatus('ERROR');

      setMessage(
        `فشل الاستيراد الجماعي: ${err.message}`
      );

    } finally {
      setBulkProgress(0);
    }
  };

  // =========================================================
  // UI
  // =========================================================

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

      {/* STATUS */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '15px',
          marginBottom: '30px',
          flexWrap: 'wrap'
        }}
      >

        <StatusBox
          title="حالة البحث"
          status={searchStatus}
        />

        <StatusBox
          title="حالة الاختبار"
          status={testStatus}
        />

        <StatusBox
          title="حالة الاستيراد"
          status={importStatus}
        />

        <StatusBox
          title="الاستيراد الجماعي"
          status={bulkStatus}
        />

      </div>

      {/* BULK IMPORT */}

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
          🚀 الاستيراد الجماعي
        </h2>

        <p
          style={{
            color: '#aaa',
            fontSize: '14px',
            lineHeight: '1.8'
          }}
        >
          يجلب دفعات من الأفلام والمسلسلات
          مع البوسترات والوصف والتقييم والسنة
          وTMDB ID ويضيفها تلقائيًا إلى النظام.
        </p>

        <button
          onClick={handleBulkImport}
          disabled={bulkStatus === 'LOADING'}
          style={{
            padding: '12px 25px',
            background:
              bulkStatus === 'LOADING'
                ? '#555'
                : '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor:
              bulkStatus === 'LOADING'
                ? 'not-allowed'
                : 'pointer',
            fontWeight: 'bold',
            fontSize: '15px'
          }}
        >
          {bulkStatus === 'LOADING'
            ? `جاري الاستيراد... ${bulkProgress}%`
            : '🚀 استيراد أفلام ومسلسلات'}
        </button>

        {bulkStatus === 'LOADING' && (
          <div
            style={{
              marginTop: '15px',
              height: '8px',
              background: '#333',
              borderRadius: '10px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${bulkProgress}%`,
                height: '100%',
                background: '#28a745',
                transition: 'width .2s'
              }}
            />
          </div>
        )}

      </div>

      {/* TEST */}

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

      {/* SEARCH */}

      <div
        style={{
          background: '#1a1a1a',
          padding: '20px',
          borderRadius: '10px',
          maxWidth: '700px',
          margin: '0 auto 20px auto',
          border: '1px solid #333'
        }}
      >

        <h3
          style={{
            margin: '0 0 15px 0',
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

      {/* MESSAGE */}

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
            fontWeight: 'bold'
          }}
        >
          {message}
        </p>
      )}

      {/* RESULTS */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px',
          maxWidth: '1100px',
          margin: '0 auto'
        }}
      >

        {movies.map((item) => {

          const isTV =
            item.media_type === 'tv';

          const title =
            item.title ||
            item.name ||
            'بدون اسم';

          const date =
            item.release_date ||
            item.first_air_date ||
            '';

          return (
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
                    src={`${TMDB_IMAGE}${item.poster_path}`}
                    alt={title}
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
                    margin: '10px 0 5px 0'
                  }}
                >
                  {title}
                </h3>

                <p
                  style={{
                    fontSize: '12px',
                    color: '#aaa'
                  }}
                >
                  {isTV
                    ? '📺 مسلسل'
                    : '🎬 فيلم'}
                </p>

                <p
                  style={{
                    fontSize: '12px',
                    color: '#aaa'
                  }}
                >
                  📅 {date
                    ? date.split('-')[0]
                    : 'غير معروف'}
                </p>

                <p
                  style={{
                    fontSize: '12px',
                    color: '#f5c518'
                  }}
                >
                  ⭐ {item.vote_average || 0}
                </p>

                <p
                  style={{
                    fontSize: '12px',
                    color: '#aaa',
                    lineHeight: '1.6'
                  }}
                >
                  {item.overview
                    ? item.overview.slice(0, 130) +
                      (item.overview.length > 130
                        ? '...'
                        : '')
                    : 'لا يوجد وصف متاح.'}
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
                {isTV
                  ? 'استيراد المسلسل 📺'
                  : 'استيراد الفيلم 🎬'}
              </button>

            </div>
          );
        })}

      </div>

    </div>
  );
}


// =========================================================
// STATUS BOX
// =========================================================

function StatusBox({ title, status }) {
  const good =
    status === true;

  return (
    <div
      style={{
        background: '#222',
        padding: '12px 20px',
        borderRadius: '8px',
        border: '1px solid #444',
        textAlign: 'center'
      }}
    >

      <p
        style={{
          margin: '0 0 5px 0',
          fontSize: '14px',
          color: '#aaa'
        }}
      >
        {title}
      </p>

      <span
        style={{
          fontWeight: 'bold',
          fontSize: '16px',
          color:
            good
              ? '#28a745'
              : '#ff4d4d'
        }}
      >
        {good ? 'true' : status}
      </span>

    </div>
  );
}

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
  const [errorDetails, setErrorDetails] = useState([]);

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

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`TMDB ${response.status}: ${text.slice(0, 250)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('TMDB أرسل استجابة غير صالحة.');
    }
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
  // تستعمل فقط للاستيراد الفردي
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

  const buildTitleObject = (item, details = item) => {
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
      item.release_date ||
      item.first_air_date ||
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
        Number(
          details.vote_average ||
          item.vote_average ||
          0
        ),

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
  // CHECK IF TITLE EXISTS
  // =========================================================

  const checkExisting = async (item) => {
    const type =
      item.media_type === 'tv'
        ? 'tv'
        : 'movie';

    const { data, error } = await supabase
      .from('titles')
      .select('id')
      .eq('tmdb_id', item.id)
      .eq('type', type)
      .limit(1);

    if (error) {
      throw error;
    }

    return data && data.length > 0;
  };

  // =========================================================
  // IMPORT ONE
  // =========================================================

  const handleImportMovie = async (item) => {
    setImportStatus('E');
    setMessage('');
    setErrorDetails([]);

    try {
      const details = await getFullDetails(item);

      const titleObject =
        buildTitleObject(item, details);

      const exists =
        await checkExisting(item);

      if (exists) {
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
        throw error;
      }

      setImportStatus(true);

      setMessage(
        `تم استيراد "${titleObject.name}" بنجاح ✅`
      );

    } catch (err) {
      console.error('Import error:', err);

      setImportStatus('G');

      setErrorDetails([
        `${item.title || item.name || 'العنصر'}: ${err.message}`
      ]);

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
    setMessage('');
    setErrorDetails([]);

    try {
      const testMovieId = 550;

      const generatedUrl =
        `https://vidsrc.to/embed/movie/${testMovieId}`;

      const { error } = await supabase
        .from('titles')
        .insert([
          {
            name: 'فيلم تجريبي (Fight Club)',
            synopsis:
              'فيلم تجريبي للاختبار الفوري.',
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

        setErrorDetails([
          `Fight Club: ${error.message}`
        ]);

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

      setErrorDetails([
        `Test: ${err.message}`
      ]);
    }
  };

  // =========================================================
  // BULK IMPORT
  // =========================================================

  const handleBulkImport = async () => {
    setBulkStatus('LOADING');
    setBulkProgress(0);
    setMessage('');
    setErrorDetails([]);

    try {
      if (!TMDB_API_KEY) {
        throw new Error(
          'TMDB API Key غير موجود.'
        );
      }

      /*
       * عدد الصفحات.
       *
       * كل صفحة فيها تقريبًا 20 عنصر.
       *
       * 3 صفحات أفلام
       * + 3 صفحات مسلسلات
       *
       * = حوالي 120 عنصر.
       */

      const pages = [1, 2, 3];

      let allItems = [];

      // =====================================================
      // جلب الأفلام والمسلسلات
      // =====================================================

      for (const page of pages) {
        try {
          const [moviesData, tvData] =
            await Promise.all([
              tmdbRequest(
                `/discover/movie?sort_by=popularity.desc&page=${page}`
              ),

              tmdbRequest(
                `/discover/tv?sort_by=popularity.desc&page=${page}`
              )
            ]);

          const movieItems =
            (moviesData.results || []).map(
              (item) => ({
                ...item,
                media_type: 'movie'
              })
            );

          const tvItems =
            (tvData.results || []).map(
              (item) => ({
                ...item,
                media_type: 'tv'
              })
            );

          allItems.push(
            ...movieItems,
            ...tvItems
          );

        } catch (pageError) {
          console.error(
            `خطأ في الصفحة ${page}:`,
            pageError
          );

          setErrorDetails((prev) => [
            ...prev,
            `صفحة ${page}: ${pageError.message}`
          ]);
        }
      }

      // =====================================================
      // إزالة التكرار
      // =====================================================

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

      if (uniqueItems.length === 0) {
        throw new Error(
          'TMDB لم يرجع أي أفلام أو مسلسلات.'
        );
      }

      // =====================================================
      // تجهيز البيانات مباشرة من discover
      //
      // ما نحتاجوش نديرو GET details لكل فيلم.
      // هذا هو التعديل المهم.
      // =====================================================

      const preparedItems =
        uniqueItems.map((item) => ({
          item,
          titleObject:
            buildTitleObject(item, item)
        }));

      // =====================================================
      // جلب العناصر الموجودة مسبقًا
      // =====================================================

      const tmdbIds =
        preparedItems.map(
          ({ item }) => item.id
        );

      const { data: existingRows, error: existingError } =
        await supabase
          .from('titles')
          .select('tmdb_id,type')
          .in('tmdb_id', tmdbIds);

      if (existingError) {
        throw existingError;
      }

      const existingSet = new Set(
        (existingRows || []).map(
          (row) =>
            `${row.type}-${row.tmdb_id}`
        )
      );

      const itemsToInsert =
        preparedItems.filter(
          ({ item }) => {
            const type =
              item.media_type === 'tv'
                ? 'tv'
                : 'movie';

            return !existingSet.has(
              `${type}-${item.id}`
            );
          }
        );

      const skipped =
        preparedItems.length -
        itemsToInsert.length;

      // =====================================================
      // INSERT BATCHES
      // =====================================================

      const BATCH_SIZE = 20;

      let imported = 0;
      let failed = 0;

      const errors = [];

      for (
        let start = 0;
        start < itemsToInsert.length;
        start += BATCH_SIZE
      ) {
        const batch =
          itemsToInsert.slice(
            start,
            start + BATCH_SIZE
          );

        const rows =
          batch.map(
            ({ titleObject }) =>
              titleObject
          );

        try {
          const { error } =
            await supabase
              .from('titles')
              .insert(rows);

          if (error) {
            /*
             * إذا فشلت الدفعة كاملة،
             * نجرب عنصر بعنصر لمعرفة السبب.
             */

            console.error(
              'Batch error:',
              error
            );

            for (const current of batch) {
              try {
                const { error: singleError } =
                  await supabase
                    .from('titles')
                    .insert([
                      current.titleObject
                    ]);

                if (singleError) {
                  failed++;

                  errors.push(
                    `${current.titleObject.name}: ${singleError.message}`
                  );
                } else {
                  imported++;
                }

              } catch (singleCatchError) {
                failed++;

                errors.push(
                  `${current.titleObject.name}: ${singleCatchError.message}`
                );
              }
            }

          } else {
            imported += rows.length;
          }

        } catch (batchCatchError) {
          console.error(
            'Batch exception:',
            batchCatchError
          );

          failed += batch.length;

          errors.push(
            `Batch ${start + 1}: ${batchCatchError.message}`
          );
        }

        // ===================================================
        // PROGRESS
        // ===================================================

        const processed =
          Math.min(
            start + batch.length,
            itemsToInsert.length
          );

        const progress =
          Math.round(
            (processed /
              Math.max(
                itemsToInsert.length,
                1
              )) *
              100
          );

        setBulkProgress(progress);

        /*
         * راحة صغيرة بين الدفعات
         * لتجنب الضغط على Supabase
         */

        if (
          start + BATCH_SIZE <
          itemsToInsert.length
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(resolve, 500)
          );
        }
      }

      // =====================================================
      // حفظ الأخطاء للتشخيص
      // =====================================================

      setErrorDetails(
        errors.slice(0, 20)
      );

      setBulkStatus(
        failed === 0
          ? true
          : 'PARTIAL'
      );

      // =====================================================
      // النتيجة
      // =====================================================

      setMessage(
        `اكتمل الاستيراد 🚀 | تمت الإضافة: ${imported} | موجود مسبقًا: ${skipped} | أخطاء: ${failed}`
      );

    } catch (err) {
      console.error(
        'Bulk import error:',
        err
      );

      setBulkStatus('ERROR');

      setErrorDetails([
        `الخطأ الرئيسي: ${err.message}`
      ]);

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

      {/* =====================================================
          STATUS
      ====================================================== */}

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

      {/* =====================================================
          BULK IMPORT
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
          🚀 الاستيراد الجماعي
        </h2>

        <p
          style={{
            color: '#aaa',
            fontSize: '14px',
            lineHeight: '1.8'
          }}
        >
          يستورد دفعات من الأفلام والمسلسلات
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

      {/* =====================================================
          TEST INSERT
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
          SEARCH
      ====================================================== */}

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

      {/* =====================================================
          MESSAGE
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
            fontSize: '16px',
            lineHeight: '1.8'
          }}
        >
          {message}
        </p>
      )}

      {/* =====================================================
          ERROR DETAILS
      ====================================================== */}

      {errorDetails.length > 0 && (
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto 30px auto',
            background: '#211515',
            border: '1px solid #662222',
            borderRadius: '10px',
            padding: '18px'
          }}
        >

          <h3
            style={{
              color: '#ff6666',
              marginTop: 0
            }}
          >
            🔍 تفاصيل الأخطاء
          </h3>

          <p
            style={{
              color: '#aaa',
              fontSize: '13px'
            }}
          >
            هذه أول الأخطاء فقط حتى ما نعمرولك الصفحة.
          </p>

          {errorDetails.map(
            (error, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 0',
                  borderBottom:
                    '1px solid #392020',
                  color: '#ff9999',
                  fontSize: '13px',
                  direction: 'ltr',
                  textAlign: 'left',
                  wordBreak: 'break-word'
                }}
              >
                {index + 1}. {error}
              </div>
            )
          )}

        </div>
      )}

      {/* =====================================================
          RESULTS
      ====================================================== */}

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

  let displayStatus = status;

  if (status === 'LOADING') {
    displayStatus = 'جاري...';
  }

  if (status === 'PARTIAL') {
    displayStatus = 'جزئي';
  }

  if (status === 'ERROR') {
    displayStatus = 'خطأ';
  }

  if (status === 'DUPLICATE') {
    displayStatus = 'موجود';
  }

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
        {good
          ? 'true'
          : displayStatus}
      </span>

    </div>
  );
}

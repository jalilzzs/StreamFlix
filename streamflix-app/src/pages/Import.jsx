import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const TMDB_API_KEY = 'bb04576f643a69128d4924c5aea7c339';

export default function Import() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);

  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [fillLoading, setFillLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [bulkStats, setBulkStats] = useState(null);
  const [fillStats, setFillStats] = useState(null);
  const [errors, setErrors] = useState([]);

  // دالة توليد رابط Stelar المضمّن تلقائياً بناءً على tmdb_id والنوع
  const getStelarUrl = (tmdbId, type = 'movie') => {
    if (!tmdbId) return '';
    const isTv = type === 'series' || type === 'tv';
    return isTv
      ? `https://stelar.rip/embed/tv/${tmdbId}/1/1`
      : `https://stelar.rip/embed/movie/${tmdbId}`;
  };

  const getMovieDetails = async (id) => {
    const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=ar-AR`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB movie details: ${res.status}`);
    return await res.json();
  };

  const getTvDetails = async (id) => {
    const url = `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=ar-AR`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB TV details: ${res.status}`);
    return await res.json();
  };

  const movieToTitle = (movie) => {
    const year = movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null;
    return {
      name: movie.title || movie.name || 'بدون اسم',
      synopsis: movie.overview || 'لا يوجد وصف متاح.',
      release_year: year || 2026,
      rating_avg: Number(movie.vote_average) || 0,
      type: 'movie',
      is_premium: false,
      poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      url: getStelarUrl(movie.id, 'movie'),
      tmdb_id: movie.id
    };
  };

  const tvToTitle = (show) => {
    const year = show.first_air_date ? parseInt(show.first_air_date.split('-')[0]) : null;
    return {
      name: show.name || 'بدون اسم',
      synopsis: show.overview || 'لا يوجد وصف متاح.',
      release_year: year || 2026,
      rating_avg: Number(show.vote_average) || 0,
      type: 'series',
      is_premium: false,
      poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : '',
      url: getStelarUrl(show.id, 'tv'),
      tmdb_id: show.id
    };
  };

  // البحث عن فيلم أو مسلسل
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setMessage('');
    setMovies([]);
    setErrors([]);

    try {
      const movieUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ar-AR`;
      const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ar-AR`;

      const [movieRes, tvRes] = await Promise.all([fetch(movieUrl), fetch(tvUrl)]);
      if (!movieRes.ok || !tvRes.ok) throw new Error('خطأ في الاتصال بـ TMDB');

      const movieData = await movieRes.json();
      const tvData = await tvRes.json();

      const movieResults = (movieData.results || []).map((item) => ({ ...item, media_type: 'movie' }));
      const tvResults = (tvData.results || []).map((item) => ({ ...item, media_type: 'tv' }));

      const combined = [...movieResults, ...tvResults];
      combined.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

      setMovies(combined.slice(0, 40));

      if (combined.length === 0) {
        setMessage('لم يتم العثور على أي نتائج.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setMessage(`خطأ في البحث (${err.message})`);
    } finally {
      setLoading(false);
    }
  };

  // استيراد عنصر فردي وربطه برابط Stelar
  const handleImportMovie = async (item) => {
    setMessage('');
    try {
      let details;
      if (item.media_type === 'tv') {
        details = await getTvDetails(item.id);
      } else {
        details = await getMovieDetails(item.id);
      }

      const titleData = item.media_type === 'tv' ? tvToTitle(details) : movieToTitle(details);

      const { data: existingByTmdb } = await supabase
        .from('titles')
        .select('id,name')
        .eq('tmdb_id', titleData.tmdb_id)
        .maybeSingle();

      if (existingByTmdb) {
        setMessage(`"${titleData.name}" موجود مسبقاً، تم تخطيه.`);
        return;
      }

      const { error } = await supabase.from('titles').insert([titleData]);
      if (error) throw error;

      setMessage(`تم استيراد "${titleData.name}" بنجاح وربطه بـ Stelar ✅`);
    } catch (err) {
      console.error('Import error:', err);
      setMessage(`خطأ في الاستيراد: ${err.message}`);
    }
  };

  // الاستيراد الجماعي وتخزين روابط Stelar
  const handleBulkImport = async () => {
    if (bulkLoading) return;

    setBulkLoading(true);
    setMessage('');
    setErrors([]);
    setBulkStats({ total: 0, added: 0, existing: 0, failed: 0 });

    try {
      const getPopular = async (endpoint, type) => {
        const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}&language=ar-AR&page=1`);
        const data = await res.json();
        return (data.results || []).map(i => ({ ...i, media_type: type }));
      };

      const [moviesList, seriesList] = await Promise.all([
        getPopular('movie/popular', 'movie'),
        getPopular('tv/popular', 'tv')
      ]);

      const itemsToImport = [...moviesList, ...seriesList].slice(0, 40);
      let added = 0, existingCount = 0, failed = 0;
      const errorList = [];

      const { data: existingRows } = await supabase.from('titles').select('tmdb_id');
      const existingTmdbIds = new Set((existingRows || []).map((row) => Number(row.tmdb_id)).filter(Boolean));

      for (const item of itemsToImport) {
        try {
          if (existingTmdbIds.has(Number(item.id))) {
            existingCount++;
            setBulkStats({ total: itemsToImport.length, added, existing: existingCount, failed });
            continue;
          }

          let details = item.media_type === 'tv' ? await getTvDetails(item.id) : await getMovieDetails(item.id);
          const titleData = item.media_type === 'tv' ? tvToTitle(details) : movieToTitle(details);

          const { error } = await supabase.from('titles').insert([titleData]);

          if (error) {
            if (error.code === '23505') {
              existingCount++;
            } else {
              throw error;
            }
          } else {
            added++;
            existingTmdbIds.add(Number(titleData.tmdb_id));
          }
        } catch (err) {
          failed++;
          errorList.push({ name: item.title || item.name || 'عنصر', error: err.message });
        }
        setBulkStats({ total: itemsToImport.length, added, existing: existingCount, failed });
      }

      setErrors(errorList);
      setMessage(`اكتمل الاستيراد الجماعي! تمت الإضافة: ${added} | تم تخطي: ${existingCount} | أخطاء: ${failed}`);
    } catch (err) {
      setMessage(`فشل الاستيراد الجماعي: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  // ملء جميع الروابط الفارغة بروابط Stelar المباشرة
  const handleFillEmptyUrls = async () => {
    if (fillLoading) return;

    setFillLoading(true);
    setFillStats(null);
    setMessage('');
    setErrors([]);

    try {
      const { data: emptyTitles, error: fetchError } = await supabase
        .from('titles')
        .select('id, name, tmdb_id, type, url')
        .or('url.is.null,url.eq.');

      if (fetchError) throw fetchError;

      const rows = emptyTitles || [];
      let filled = 0, skipped = 0, failed = 0;
      const fillErrors = [];

      setFillStats({ total: rows.length, filled: 0, skipped: 0, failed: 0 });

      for (const row of rows) {
        try {
          if (!row.tmdb_id) {
            skipped++;
            setFillStats({ total: rows.length, filled, skipped, failed });
            continue;
          }

          const generatedUrl = getStelarUrl(row.tmdb_id, row.type);

          const { error: updateError } = await supabase
            .from('titles')
            .update({ url: generatedUrl })
            .eq('id', row.id);

          if (updateError) throw updateError;

          filled++;
        } catch (err) {
          failed++;
          fillErrors.push({ name: row.name || 'بدون اسم', error: err.message });
        }
        setFillStats({ total: rows.length, filled, skipped, failed });
      }

      setErrors(fillErrors);
      setMessage(`تم ملء الروابط بـ Stelar بنجاح! تم التعديل: ${filled} | تم تخطي: ${skipped} | أخطاء: ${failed}`);
    } catch (err) {
      setMessage(`فشل عملية ملء الروابط: ${err.message}`);
    } finally {
      setFillLoading(false);
    }
  };

  return (
    <div style={{ background: '#0d0d0d', color: '#fff', minHeight: '100vh', padding: '25px', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#e50914', fontSize: '28px', fontWeight: 'bold' }}>
        🎬 لوحة إدارة واستيراد المحتوى (StreamFlix)
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto 30px auto' }}>
        
        {/* بطاقة الاستيراد الجماعي */}
        <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>🚀 استيراد جماعي تلقائي</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
            جلب 40 عنصر من TMDB وحفظ روابط Stelar الخاصة بها تلقائياً.
          </p>
          <button 
            onClick={handleBulkImport} 
            disabled={bulkLoading} 
            style={{ width: '100%', padding: '12px', background: bulkLoading ? '#444' : '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: bulkLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            {bulkLoading ? '⏳ جاري الاستيراد...' : '🚀 تنفيذ الاستيراد الجماعي'}
          </button>
          {bulkStats && (
            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-around', background: '#222', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
              <span>📦 الكل: {bulkStats.total}</span>
              <span style={{ color: '#4caf50' }}>✅ تمت: {bulkStats.added}</span>
              <span style={{ color: '#ffc107' }}>♻️ موجود: {bulkStats.existing}</span>
              <span style={{ color: '#f44336' }}>❌ أخطاء: {bulkStats.failed}</span>
            </div>
          )}
        </div>

        {/* بطاقة ملء الروابط الفارغة */}
        <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>🔗 ملء الروابط الفارغة بـ Stelar</h2>
          <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
            فحص قاعدة البيانات وتوليد رابط Stelar لكل فيلم أو مسلسل لا يملك رابط مشاهدة.
          </p>
          <button 
            onClick={handleFillEmptyUrls} 
            disabled={fillLoading} 
            style={{ width: '100%', padding: '12px', background: fillLoading ? '#444' : '#8e44ad', color: '#fff', border: 'none', borderRadius: '8px', cursor: fillLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            {fillLoading ? '⏳ جاري التحديث...' : '🔗 ملء جميع الروابط الفارغة بـ Stelar'}
          </button>
          {fillStats && (
            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-around', background: '#222', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
              <span>📦 الفارغة: {fillStats.total}</span>
              <span style={{ color: '#4caf50' }}>✅ تم ملؤها: {fillStats.filled}</span>
              <span style={{ color: '#ffc107' }}>⏭️ تم تخطي: {fillStats.skipped}</span>
              <span style={{ color: '#f44336' }}>❌ أخطاء: {fillStats.failed}</span>
            </div>
          )}
        </div>

      </div>

      {/* قسم البحث الفردي */}
      <div style={{ background: '#181818', padding: '20px', borderRadius: '12px', maxWidth: '1100px', margin: '0 auto 30px auto', border: '1px solid #282828' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '15px', fontSize: '18px' }}>🔎 البحث عن فيلم أو مسلسل معين لاستيراده</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <input 
            type="text" 
            placeholder="اكتب اسم الفيلم أو المسلسل باللغة العربية أو الإنجليزية..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            style={{ flex: '1', maxWidth: '500px', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff', outline: 'none' }} 
          />
          <button type="submit" style={{ padding: '12px 24px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? 'جاري البحث...' : 'بحث'}
          </button>
        </form>
      </div>

      {/* تنبيهات الحالة */}
      {message && (
        <div style={{ textAlign: 'center', padding: '12px', background: message.includes('خطأ') || message.includes('فشل') ? '#3b1818' : '#18331e', color: message.includes('خطأ') || message.includes('فشل') ? '#ff7777' : '#77ff94', borderRadius: '8px', maxWidth: '1100px', margin: '0 auto 20px auto', border: '1px solid #444', fontWeight: 'bold' }}>
          {message}
        </div>
      )}

      {/* تفاصيل الأخطاء */}
      {errors.length > 0 && (
        <div style={{ background: '#221515', border: '1px solid #552222', borderRadius: '10px', padding: '15px', maxWidth: '1100px', margin: '0 auto 20px auto' }}>
          <h4 style={{ color: '#ff6b6b', margin: '0 0 10px 0' }}>قائمة الأخطاء التفصيلية:</h4>
          {errors.slice(0, 10).map((item, idx) => (
            <div key={idx} style={{ fontSize: '13px', borderBottom: '1px solid #332222', padding: '5px 0', color: '#ddaaaa' }}>
              <strong>{idx + 1}. {item.name}:</strong> {item.error}
            </div>
          ))}
        </div>
      )}

      {/* نتائج البحث */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
        {movies.map((item) => (
          <div key={`${item.media_type}-${item.id}`} style={{ background: '#181818', borderRadius: '10px', overflow: 'hidden', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #282828' }}>
            <div>
              {item.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} alt={item.title || item.name} style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '6px' }} />
              ) : (
                <div style={{ width: '100%', height: '260px', background: '#252525', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: '#777' }}>بدون صورة</div>
              )}
              <h4 style={{ fontSize: '15px', margin: '10px 0 5px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || item.name}</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>
                <span>{item.media_type === 'tv' ? '📺 مسلسل' : '🎬 فيلم'}</span>
                <span>⭐ {item.vote_average ? Number(item.vote_average).toFixed(1) : '0.0'}</span>
              </div>
            </div>
            <button onClick={() => handleImportMovie(item)} style={{ padding: '8px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              📥 استيراد وربط بـ Stelar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

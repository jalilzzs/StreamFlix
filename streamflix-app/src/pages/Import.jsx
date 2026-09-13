import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Import() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState(true);
  const [testStatus, setTestStatus] = useState(true);
  const [importStatus, setImportStatus] = useState(true);
  const [message, setMessage] = useState('');

  const TMDB_API_KEY = 'ضع_مفتاح_api_هنا'; 

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearchStatus('A');
    setMessage('');
    
    try {
      if (TMDB_API_KEY.includes('ضع_مفتاح')) {
        setSearchStatus('B');
        throw new Error('مفتاح TMDB API غير معرّف.');
      }

      const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ar-AR`;
      const res = await fetch(url);
      
      if (!res.ok) {
        setSearchStatus('C');
        throw new Error(`خطأ في الاتصال بـ TMDB: ${res.status}`);
      }

      const data = await res.json();
      setMovies(data.results || []);
      setSearchStatus(true);
      
      if (data.results && data.results.length === 0) {
        setSearchStatus('D');
        setMessage('لم يتم العثور على أي نتائج.');
      }
    } catch (err) {
      console.error("خطأ في البحث:", err);
      setMessage(`خطأ في البحث (${searchStatus}): ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportMovie = async (movie) => {
    setImportStatus('E');
    try {
      const generatedUrl = `https://vidsrc.to/embed/movie/${movie.id}`;

      const { error } = await supabase
        .from('titles')
        .insert([
          {
            name: movie.title || movie.name,
            synopsis: movie.overview || 'لا يوجد وصف متاح.',
            release_year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : 2026,
            rating_avg: movie.vote_average || 0,
            type: 'movie',
            is_premium: false,
            poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
            url: generatedUrl
          }
        ]);

      if (error) {
        setImportStatus('F');
        setMessage(`خطأ قاعدة البيانات (${importStatus}): ${error.message}`);
      } else {
        setImportStatus(true);
        setMessage(`تم استيراد فيلم "${movie.title || movie.name}" بنجاح!`);
      }
    } catch (err) {
      setImportStatus('G');
      setMessage(`خطأ غير متوقع (${importStatus}): ${err.message}`);
    }
  };

  const handleTestInsert = async () => {
    setTestStatus('H');
    try {
      const testMovieId = 550;
      const generatedUrl = `https://vidsrc.to/embed/movie/${testMovieId}`;

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
            poster_url: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
            url: generatedUrl
          }
        ]);

      if (error) {
        setTestStatus('I');
        setMessage(`خطأ في الإضافة التجريبية (${testStatus}): ${error.message}`);
      } else {
        setTestStatus(true);
        setMessage('تم إضافة الفيلم التجريبي بنجاح!');
      }
    } catch (err) {
      setTestStatus('J');
      setMessage(`خطأ استثنائي في الاختبار (${testStatus}): ${err.message}`);
    }
  };

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '25px' }}>لوحة التحكم والتشخيص المتقدمة</h1>
      
      {/* قسم تشخيص الحالات */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <div style={{ background: '#222', padding: '12px 20px', borderRadius: '8px', border: '1px solid #444', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#aaa' }}>حالة البحث</p>
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: searchStatus === true ? '#28a745' : '#ff4d4d' }}>
            {searchStatus === true ? 'true' : searchStatus}
          </span>
        </div>

        <div style={{ background: '#222', padding: '12px 20px', borderRadius: '8px', border: '1px solid #444', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#aaa' }}>حالة الاختبار الفوري</p>
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: testStatus === true ? '#28a745' : '#ff4d4d' }}>
            {testStatus === true ? 'true' : testStatus}
          </span>
        </div>

        <div style={{ background: '#222', padding: '12px 20px', borderRadius: '8px', border: '1px solid #444', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#aaa' }}>حالة الاستيراد</p>
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: importStatus === true ? '#28a745' : '#ff4d4d' }}>
            {importStatus === true ? 'true' : importStatus}
          </span>
        </div>
      </div>

      {/* خانة إضافة فيلم تجريبي فوري */}
      <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', maxWidth: '600px', margin: '0 auto 20px auto', textAlign: 'center', border: '1px solid #333' }}>
        <h3 style={{ margin: '0 0 15px 0' }}>خانة الإضافة الفورية التجريبية</h3>
        <button 
          onClick={handleTestInsert}
          style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ⚡ تنفيذ إضافة فيلم تجريبي
        </button>
      </div>

      {/* خانة البحث عن فيلم أو مسلسل */}
      <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '10px', maxWidth: '600px', margin: '0 auto 20px auto', border: '1px solid #333' }}>
        <h3 style={{ margin: '0 0 15px 0', textAlign: 'center' }}>خانة البحث عن فيلم أو مسلسل</h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="اكتب اسم الفيلم أو المسلسل..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: '10px', width: '300px', borderRadius: '5px', border: '1px solid #333', background: '#222', color: '#fff' }}
          />
          <button type="submit" style={{ padding: '10px 20px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            {loading ? 'جاري البحث...' : 'بحث'}
          </button>
        </form>
      </div>

      {message && <p style={{ textAlign: 'center', color: message.includes('خطأ') ? '#ff4d4d' : '#46d369', marginBottom: '20px', fontWeight: 'bold' }}>{message}</p>}

      {/* نتائج البحث */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        {movies.map((movie) => (
          <div key={movie.id} style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #333' }}>
            <div>
              {movie.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`} alt={movie.title || movie.name} style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '5px' }} />
              ) : (
                <div style={{ width: '100%', height: '280px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px' }}>لا توجد صورة</div>
              )}
              <h3 style={{ fontSize: '16px', margin: '10px 0 5px 0' }}>{movie.title || movie.name}</h3>
              <p style={{ fontSize: '12px', color: '#aaa' }}>{movie.release_date ? movie.release_date.split('-')[0] : 'غير معروف'}</p>
            </div>
            <button 
              onClick={() => handleImportMovie(movie)}
              style={{ marginTop: '10px', padding: '8px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              استيراد للسيستيم 📥
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

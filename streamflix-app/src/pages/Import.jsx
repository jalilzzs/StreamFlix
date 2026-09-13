import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Import() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // مفتاح TMDB الخاص بك (تأكد من وضعه هنا أو عبر البيئة)
  const TMDB_API_KEY = 'YOUR_TMDB_API_KEY'; 

  // البحث عن الأفلام من TMDB
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ar-AR`);
      const data = await res.json();
      setMovies(data.results || []);
    } catch (err) {
      console.error("خطأ في البحث:", err);
      setMessage('حدث خطأ أثناء البحث.');
    } finally {
      setLoading(false);
    }
  };

  // استيراد الفيلم وتوليد رابط الـ URL أوتوماتيكياً وتخزينه في Supabase
  const handleImportMovie = async (movie) => {
    try {
      // توليد رابط المشاهدة أوتوماتيكياً باستخدام الـ TMDB ID
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
            url: generatedUrl // الرابط يتولد ويتحط وحدو صاي!
          }
        ]);

      if (error) {
        console.error("خطأ في الإدخال:", error.message);
        setMessage(`خطأ: ${error.message}`);
      } else {
        setMessage(`تم استيراد فيلم "${movie.title}" بنجاح مع رابطه الأوتوماتيكي! ⭐`);
      }
    } catch (err) {
      console.error("خطأ غير متوقع:", err);
      setMessage('حدث خطأ غير متوقع أثناء الإدخال.');
    }
  };

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>لوحة استيراد الأفلام التلقائية</h1>
      
      {/* نموذج البحث */}
      <form onSubmit={handleSearch} style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="ابحث عن فيلم لاستيراده..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: '10px', width: '300px', borderRadius: '5px', border: '1px solid #333', background: '#222', color: '#fff' }}
        />
        <button type="submit" style={{ padding: '10px 20px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {loading ? 'جاري البحث...' : 'بحث'}
        </button>
      </form>

      {message && <p style={{ textAlign: 'center', color: '#46d369', marginBottom: '20px' }}>{message}</p>}

      {/* قائمة النتائج */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        {movies.map((movie) => (
          <div key={movie.id} style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {movie.poster_path ? (
                <img src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`} alt={movie.title} style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '5px' }} />
              ) : (
                <div style={{ width: '100%', height: '280px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px' }}>لا توجد صورة</div>
              )}
              <h3 style={{ fontSize: '16px', margin: '10px 0 5px 0' }}>{movie.title}</h3>
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

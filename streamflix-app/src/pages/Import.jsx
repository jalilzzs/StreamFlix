import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;
const ADMIN_SECRET_KEY = '050830'; 

export default function Import() {
  const [searchParams] = useSearchParams();
  const secret = searchParams.get('key');

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);

  if (secret !== ADMIN_SECRET_KEY) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', color: '#fff' }}>
        <h2>404 - الصفحة غير موجودة</h2>
        <p>عذراً، ليس لديك صلاحية للوصول لهذه الصفحة.</p>
      </div>
    );
  }

  const startImport = async (type = 'movie') => {
    setLoading(true);
    const currentPage = type === 'movie' ? moviePage : tvPage;
    // حفظ المسلسلات بـ 'series' لضمان توافقها مع قاعدة البيانات إذا كانت ترفض 'tv'
    const dbType = type === 'tv' ? 'series' : 'movie';
    
    setStatus(`جاري جلب الصفحة ${currentPage} من ${type === 'movie' ? 'الأفلام' : 'المسلسلات'}...`);

    try {
      const url = `https://api.themoviedb.org/3/${type}/popular?api_key=${tmdbApiKey}&language=ar-SA&page=${currentPage}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        setStatus(`خطأ من TMDB: ${data.status_message || 'لم يتم العثور على نتائج'}`);
        setLoading(false);
        return;
      }

      let count = 0;
      for (const item of data.results) {
        const titleName = item.title || item.name;
        if (!titleName) continue;

        // 1. إدخال أو تحديث العنوان
        const { data: insertedTitle, error: titleErr } = await supabase
          .from('titles')
          .upsert({
            type: dbType,
            name: titleName,
            synopsis: item.overview || 'لا يوجد وصف متوفر حالياً.',
            poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
            release_year: (item.release_date || item.first_air_date) 
              ? Number((item.release_date || item.first_air_date).slice(0, 4)) 
              : 2024,
            rating_avg: item.vote_average || 0
          }, { onConflict: 'name' })
          .select()
          .single();

        if (titleErr) {
          console.error(`خطأ إدخال ${titleName}:`, titleErr.message);
          continue;
        }

        if (insertedTitle) {
          // 2. إدخال الحلقة
          await supabase.from('episodes').upsert({
            title_id: insertedTitle.id,
            season: 1,
            episode_number: 1,
            name: type === 'tv' ? 'الحلقة 1' : titleName,
            stream_urls: {
              server1: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            }
          }, { onConflict: 'title_id, season, episode_number' });

          count++;
        }
      }

      if (type === 'movie') setMoviePage(prev => prev + 1);
      else setTvPage(prev => prev + 1);

      setStatus(`🎉 تم استيراد الصفحة ${currentPage} من ${type === 'movie' ? 'الأفلام' : 'المسلسلات'} بنجاح (${count} عنصر)!`);
    } catch (err) {
      setStatus(`حدث خطأ أثناء العملية: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#fff', maxWidth: '600px', margin: '0 auto' }}>
      <h2>لوحة استيراد المحتوى (الآدمن)</h2>
      <p style={{ margin: '20px 0', background: '#222', padding: '15px', borderRadius: '8px', wordBreak: 'break-word' }}>
        {status || 'اضغط على أحد الأزرار للبدء'}
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button 
          disabled={loading}
          onClick={() => startImport('movie')}
          style={{ padding: '12px 20px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'جاري الاستيراد...' : `استيراد أفلام (صفحة ${moviePage})`}
        </button>
        <button 
          disabled={loading}
          onClick={() => startImport('tv')}
          style={{ padding: '12px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'جاري الاستيراد...' : `استيراد مسلسلات (صفحة ${tvPage})`}
        </button>
      </div>
    </div>
  );
}

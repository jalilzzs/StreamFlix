import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Import() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const startImport = async (type = 'movie') => {
    setLoading(true);
    setStatus(`جاري جلب ${type === 'movie' ? 'الأفلام' : 'المسلسلات'} من TMDB...`);

    try {
      // 1. طلب البيانات باستخدام VITE_TMDB_API_KEY لتفادي حظر المتصفح
      const url = `https://api.themoviedb.org/3/${type}/popular?api_key=${tmdbApiKey}&language=ar-SA&page=1`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        setStatus(`خطأ من TMDB: ${data.status_message || 'لم يتم العثور على نتائج. تأكد من VITE_TMDB_API_KEY'}`);
        setLoading(false);
        return;
      }

      let count = 0;
      for (const item of data.results) {
        const titleName = item.title || item.name;

        // 2. إدخال أو تحديث العنوان في جدول titles
        const { data: insertedTitle, error: titleErr } = await supabase
          .from('titles')
          .upsert({
            type: type,
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
          console.error(`خطأ أثناء إدخال ${titleName}:`, titleErr.message);
          continue;
        }

        if (insertedTitle) {
          // 3. إضافة حلقة وسيرفر تجريبي للفيلم/المسلسل
          await supabase.from('episodes').upsert({
            title_id: insertedTitle.id,
            season: 1,
            episode_number: 1,
            name: titleName,
            stream_urls: {
              server1: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            }
          }, { onConflict: 'title_id, season, episode_number' });

          count++;
        }
      }

      setStatus(`🎉 تم استيراد ${count} عنصر بنجاح! اذهب للصفحة الرئيسية لمعاينتها.`);
    } catch (err) {
      setStatus(`حدث خطأ أثناء العملية: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#fff', maxWidth: '600px', margin: '0 auto' }}>
      <h2>لوحة استيراد المحتوى</h2>
      <p style={{ margin: '20px 0', background: '#222', padding: '15px', borderRadius: '8px', wordBreak: 'break-word' }}>
        {status || 'اضغط على أحد الأزرار للبدء'}
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button 
          disabled={loading}
          onClick={() => startImport('movie')}
          style={{ padding: '12px 20px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'جاري الاستيراد...' : 'استيراد أفلام (TMDB)'}
        </button>
        <button 
          disabled={loading}
          onClick={() => startImport('tv')}
          style={{ padding: '12px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'جاري الاستيراد...' : 'استيراد مسلسلات (TMDB)'}
        </button>
      </div>
    </div>
  );
}

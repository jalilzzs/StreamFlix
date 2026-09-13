import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// استخدام المفتاح المخفي للاستيراد
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const tmdbToken = import.meta.env.VITE_TMDB_READ_TOKEN;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default function Import() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const startImport = async (type = 'movie') => {
    setLoading(true);
    setStatus(`جاري جلب ${type === 'movie' ? 'الأفلام' : 'المسلسلات'} من TMDB...`);

    try {
      const res = await fetch(`https://api.themoviedb.org/3/${type}/popular?language=ar-SA&page=1`, {
        headers: { Authorization: `Bearer ${tmdbToken}` }
      });
      const data = await res.json();
      const items = data.results || [];

      let count = 0;
      for (const item of items) {
        const titleName = item.title || item.name;
        
        // 1. إدخال العنوان في جدول titles
        const { data: insertedTitle, error } = await supabase.from('titles').upsert({
          type: type,
          name: titleName,
          synopsis: item.overview || 'لا يوجد وصف متوفر.',
          poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          release_year: item.release_date || item.first_air_date ? Number((item.release_date || item.first_air_date).slice(0, 4)) : 2024,
          rating_avg: item.vote_average || 0
        }, { onConflict: 'name' }).select().single();

        if (!error && insertedTitle) {
          // 2. إنشاء حلقة افتراضية في جدول episodes لتجهيز سيرفر المشاهدة
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
      setStatus(`تم استيراد ${count} عنصر بنجاح!`);
    } catch (err) {
      setStatus(`حدث خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
      <h1>لوحة استيراد المحتوى تلقائياً</h1>
      <p style={{ margin: '20px 0' }}>{status}</p>
      <button 
        disabled={loading}
        onClick={() => startImport('movie')}
        style={{ padding: '12px 24px', margin: '10px', background: '#e50914', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        استيراد أحدث الأفلام
      </button>
      <button 
        disabled={loading}
        onClick={() => startImport('tv')}
        style={{ padding: '12px 24px', margin: '10px', background: '#221f1f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        استيراد أحدث المسلسلات
      </button>
    </div>
  );
}

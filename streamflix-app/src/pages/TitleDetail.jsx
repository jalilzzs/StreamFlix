import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TitleDetail() {
  const { id } = useParams();
  
  const [title, setTitle] = useState({
    name: 'جاري التحميل...',
    synopsis: 'يرجى الانتظار قليلاً ريثما يتم جلب التفاصيل...',
    release_year: 2026,
    rating_avg: 0,
    type: 'movie',
    is_premium: false,
    poster_url: '',
    url: '' // عمود رابط الفيديو
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRealData() {
      try {
        setLoading(true);
        // جلب البيانات من جدول titles حسب الـ id
        const { data, error } = await supabase
          .from('titles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error("خطأ في جلب البيانات:", error.message);
        } else if (data) {
          setTitle(data);
        }
      } catch (err) {
        console.error("خطأ غير متوقع:", err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchRealData();
    }
  }, [id]);

  // استخدام الرابط الموجود في Supabase، وإذا لم يوجد يتم وضع الرابط التجريبي مؤقتاً
  const currentVideoUrl = title.url || "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4";

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
      
      {/* عنوان العمل */}
      <h1 style={{ fontSize: '24px', marginBottom: '15px', textAlign: 'center' }}>
        {loading ? 'جاري التحميل...' : title.name}
      </h1>
      
      {/* --- مشغل الفيديو --- */}
      <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', background: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
        <video 
          key={currentVideoUrl}
          controls 
          autoPlay 
          playsInline
          poster={title.poster_url}
          style={{ width: '100%', height: 'auto', aspectRatio: '16/9', display: 'block' }}
        >
          <source src={currentVideoUrl} type="video/mp4" />
          متصفحك لا يدعم تشغيل الفيديو.
        </video>
      </div>

      {/* --- تفاصيل العمل ومعلوماته --- */}
      <div style={{ maxWidth: '900px', margin: '20px auto', background: '#1a1a1a', padding: '15px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {title.is_premium && (
            <span style={{ background: '#e50914', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              بريميوم ⭐
            </span>
          )}
          <span style={{ background: '#333', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
            النوع: {title.type || 'فيلم'}
          </span>
        </div>

        <p style={{ color: '#ccc', lineHeight: '1.6', marginBottom: '15px' }}>
          {loading ? '...' : (title.synopsis || title.description || 'لا يوجد وصف متاح.')}
        </p>

        <div style={{ fontSize: '14px', color: '#888', display: 'flex', gap: '15px' }}>
          <span>سنة الإصدار: {title.release_year}</span>
          <span>التقييم: ⭐ {title.rating_avg}</span>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TitleDetail() {
  const { id } = useParams();
  
  // الحالة الافتراضية أثناء التحميل
  const [title, setTitle] = useState({
    name: 'جاري التحميل...',
    synopsis: 'يرجى الانتظار قليلاً ريثما يتم جلب تفاصيل العرض من قاعدة البيانات.',
    release_year: 2026,
    rating_avg: 0,
    video_url: ''
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRealData() {
      try {
        setLoading(true);
        // جلب البيانات الحقيقية من جدول titles حسب الـ id
        const { data, error } = await supabase
          .from('titles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error("خطأ في جلب البيانات من Supabase:", error.message);
        } else if (data) {
          setTitle(data);
        }
      } catch (err) {
        console.error("حدث خطأ غير متوقع:", err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchRealData();
    }
  }, [id]);

  // استخراج رابط الفيديو من قاعدة البيانات (يمكنك تعديل اسم العمود حسب جدولك مثل video_url أو server1)
  const currentVideoUrl = title.video_url || title.server1 || "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4";

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
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
          style={{ width: '100%', height: 'auto', aspectRatio: '16/9', display: 'block' }}
        >
          <source src={currentVideoUrl} type="video/mp4" />
          متصفحك لا يدعم تشغيل الفيديو.
        </video>
      </div>

      {/* --- وصف العمل والبيانات الحقيقية --- */}
      <div style={{ maxWidth: '900px', margin: '20px auto', background: '#1a1a1a', padding: '15px', borderRadius: '8px' }}>
        <p style={{ color: '#ccc', lineHeight: '1.6' }}>
          {loading ? '...' : (title.synopsis || 'لا يوجد وصف متاح حالياً.')}
        </p>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#888' }}>
          <span>سنة الإصدار: {title.release_year}</span> | <span style={{ marginLeft: '10px' }}>التقييم: ⭐ {title.rating_avg}</span>
        </div>
      </div>
    </div>
  );
}

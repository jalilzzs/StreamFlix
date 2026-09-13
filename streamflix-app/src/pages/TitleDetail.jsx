import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import VideoPlayer from '../components/VideoPlayer';

export default function TitleDetail() {
  const { id } = useParams();
  
  const [title, setTitle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRealData() {
      try {
        setLoading(true);
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

  if (loading) {
    return (
      <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px', textAlign: 'center', direction: 'rtl' }}>
        <h1>جاري التحميل...</h1>
      </div>
    );
  }

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
      
      {/* عنوان العمل */}
      <h1 style={{ fontSize: '24px', marginBottom: '15px', textAlign: 'center' }}>
        {title?.name || 'بدون عنوان'}
      </h1>
      
      {/* --- مشغل الفيديو المحدث --- */}
      <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', background: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
        <VideoPlayer title={title} />
      </div>

      {/* --- تفاصيل العمل ومعلوماته --- */}
      <div style={{ maxWidth: '900px', margin: '20px auto', background: '#1a1a1a', padding: '15px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {title?.is_premium && (
            <span style={{ background: '#e50914', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              بريميوم ⭐
            </span>
          )}
          <span style={{ background: '#333', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
            النوع: {title?.type || 'فيلم'}
          </span>
        </div>

        <p style={{ color: '#ccc', lineHeight: '1.6', marginBottom: '15px' }}>
          {title?.synopsis || title?.description || 'لا يوجد وصف متاح.'}
        </p>

        <div style={{ fontSize: '14px', color: '#888', display: 'flex', gap: '15px' }}>
          <span>سنة الإصدار: {title?.release_year}</span>
          <span>التقييم: ⭐ {title?.rating_avg}</span>
        </div>
      </div>
    </div>
  );
}

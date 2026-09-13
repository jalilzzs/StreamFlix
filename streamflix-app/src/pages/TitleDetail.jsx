import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TitleDetail() {
  const { id } = useParams();
  const [title, setTitle] = useState({
    name: 'آل سيمبسون (عرض مباشر)',
    synopsis: 'عرض تجريبي مباشر لضمان عمل المشغل وسيرفرات البث بسلاسة تامة.',
    release_year: 2026,
    rating_avg: 4.9,
    type: 'movie'
  });
  
  const [activeServer, setActiveServer] = useState('server1');
  
  // روابط فيديو مباشرة ومستقرة لا تسبب خطأ 403
  const servers = {
    server1: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    server2: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
  };

  const currentVideoUrl = servers[activeServer];

  useEffect(() => {
    // محاولة جلب البيانات من Supabase في الخلفية دون تعطيل المشغل
    async function fetchRealData() {
      try {
        const { data } = await supabase.from('titles').select('*').eq('id', id).single();
        if (data) {
          setTitle(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.log("استخدام البيانات المحلية المؤقتة");
      }
    }
    fetchRealData();
  }, [id]);

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '15px', textAlign: 'center' }}>{title.name}</h1>
      
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

      {/* --- أزرار سيرفرات التشغيل --- */}
      <div style={{ maxWidth: '900px', margin: '20px auto', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontWeight: 'bold', color: '#aaa' }}>اختر السيرفر:</span>
        {Object.keys(servers).map((srvKey) => (
          <button
            key={srvKey}
            onClick={() => setActiveServer(srvKey)}
            style={{
              padding: '8px 16px',
              background: activeServer === srvKey ? '#e50914' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {srvKey === 'server1' ? 'السيرفر السريع (1)' : 'السيرفر الاحتياطي (2)'}
          </button>
        ))}
      </div>

      {/* --- وصف العمل --- */}
      <div style={{ maxWidth: '900px', margin: '20px auto', background: '#1a1a1a', padding: '15px', borderRadius: '8px' }}>
        <p style={{ color: '#ccc', lineHeight: '1.6' }}>{title.synopsis}</p>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#888' }}>
          <span>سنة الإصدار: {title.release_year}</span> | <span style={{ marginLeft: '10px' }}>التقييم: ⭐ {title.rating_avg}</span>
        </div>
      </div>
    </div>
  );
}

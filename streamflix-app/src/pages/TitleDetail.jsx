import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TitleDetail() {
  const { id } = useParams();
  const [title, setTitle] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [activeServer, setActiveServer] = useState('server1');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. جلب تفاصيل الفيلم/المسلسل
    const { data: titleData } = await supabase
      .from('titles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (titleData) setTitle(titleData);

    // 2. جلب الحلقات المرتبطة به
    const { data: epsData } = await supabase
      .from('episodes')
      .select('*')
      .eq('title_id', id)
      .order('season', { ascending: true })
      .order('episode_number', { ascending: true });

    if (epsData && epsData.length > 0) {
      setEpisodes(epsData);
      setSelectedEpisode(epsData[0]);
    } else {
      // إذا لم تكن هناك حلقة مسجلة في القاعدة، نقوم بإنشاء حلقة افتراضية مؤقتة ليعمل المشغل فوراً
      setEpisodes([{
        id: 'default',
        season: 1,
        episode_number: 1,
        name: titleData?.name || 'عرض تجريبي',
        stream_urls: {
          server1: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          server2: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
        }
      }]);
      setSelectedEpisode({
        id: 'default',
        season: 1,
        episode_number: 1,
        name: titleData?.name || 'عرض تجريبي',
        stream_urls: {
          server1: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          server2: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
        }
      });
    }
    
    setLoading(false);
  };

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>جاري التحميل...</div>;
  if (!title) return <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>العنوان غير موجود</div>;

  // استخراج روابط السيرفرات بأمان تام
  const servers = selectedEpisode?.stream_urls || {
    server1: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  };
  const currentVideoUrl = servers[activeServer] || Object.values(servers)[0] || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

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
            {srvKey === 'server1' ? 'السيرفر السريع (1)' : srvKey === 'server2' ? 'السيرفر الاحتياطي (2)' : srvKey}
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

      {/* --- قائمة الحلقات للمسلسلات --- */}
      {title.type === 'series' && episodes.length > 1 && (
        <div style={{ maxWidth: '900px', margin: '30px auto' }}>
          <h3>الحلقات:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', marginTop: '10px' }}>
            {episodes.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setSelectedEpisode(ep)}
                style={{
                  padding: '10px',
                  background: selectedEpisode?.id === ep.id ? '#e50914' : '#222',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                الحلقة {ep.episode_number}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

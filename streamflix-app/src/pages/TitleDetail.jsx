import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Watch() {
  const { id } = useParams(); // معرف العرض في Supabase
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
    // 1. جلب تفاصيل الفيلم أو المسلسل
    const { data: titleData } = await supabase
      .from('titles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (titleData) setTitle(titleData);

    // 2. جلب الحلقات الخاصة به
    const { data: epsData } = await supabase
      .from('episodes')
      .select('*')
      .eq('title_id', id)
      .order('season', { ascending: true })
      .order('episode_number', { ascending: true });

    if (epsData && epsData.length > 0) {
      setEpisodes(epsData);
      setSelectedEpisode(epsData[0]); // اختيار الحلقة الأولى افتراضياً
    }
    setLoading(false);
  };

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>جاري التحميل...</div>;
  if (!title) return <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>العنوان غير موجود</div>;

  // استخراج روابط السيرفرات من الحقل stream_urls (JSONB)
  const servers = selectedEpisode?.stream_urls || { server1: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" };
  const currentVideoUrl = servers[activeServer] || Object.values(servers)[0];

  return (
    <div style={{ background: '#111', color: '#fff', minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>{title.name}</h1>
      
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
          متصفحك لا يدعم تشغل الفيديو.
        </video>
      </div>

      {/* --- أزرار اختيار السيرفرات --- */}
      <div style={{ maxWidth: '900px', margin: '20px auto', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
            {srvKey === 'server1' ? 'سيرفر سريع (1)' : srvKey === 'server2' ? 'سيرفر احتياطي (2)' : srvKey}
          </button>
        ))}
      </div>

      {/* --- قائمة الحلقات (إذا كان مسلسل) --- */}
      {title.type === 'series' && episodes.length > 0 && (
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
                الموسم {ep.season} - الحلقة {ep.episode_number}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

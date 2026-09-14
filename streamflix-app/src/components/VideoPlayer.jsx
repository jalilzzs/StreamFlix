import { useState, useEffect } from 'react';

export default function VideoPlayer({ tmdbId, type = 'movie', title }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useIframe, setUseIframe] = useState(false);
  const [selectedServer, setSelectedServer] = useState(0);

  // قائمة السيرفرات الاحتياطية الموثوقة للغلق والتشغيل المباشر
  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId;
  const contentType = type === 'series' || title?.type === 'series' ? 'tv' : 'movie';

  const iframeServers = [
    `https://vidsrc.cc/v2/embed/${contentType}/${realTmdb}`,
    `https://embed.su/embed/${contentType}/${realTmdb}`,
    `https://vidsrc.pro/embed/${contentType}/${realTmdb}`,
    `https://2embed.cc/embed/${realTmdb}`
  ];

  useEffect(() => {
    async function fetchCleanStream() {
      if (!realTmdb) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // طلب الرابط الصافي من الباك أند على Render
        const response = await fetch(`https://streamflix-api-atzd.onrender.com/api/extract?tmdb=${realTmdb}&type=${contentType}`);
        const data = await response.json();

        if (data && data.streamUrl) {
          setStreamUrl(data.streamUrl);
          setUseIframe(false);
        } else {
          // في حال عدم توفر بث صافي يتم التحويل للـ iframe
          setUseIframe(true);
        }
      } catch (err) {
        console.error("خطأ في الاتصال بسيرفر الاستخراج:", err);
        setUseIframe(true);
      } finally {
        setLoading(false);
      }
    }

    fetchCleanStream();
  }, [realTmdb, contentType]);

  if (loading) {
    return (
      <div style={{ height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
        <p>جاري استخراج رابط البث الصافي...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
      
      {/* التشغيل المباشر الصافي بدون إعلانات */}
      {!useIframe && streamUrl ? (
        <video 
          controls 
          autoPlay 
          style={{ width: '100%', height: '450px', objectFit: 'contain' }}
          src={streamUrl}
        />
      ) : (
        /* التشغيل الاحتياطي المباشر عبر iframe متوافق */
        <div>
          <iframe
            src={iframeServers[selectedServer]}
            style={{ width: '100%', height: '450px', border: 'none' }}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            title="Video Player"
          />
          
          {/* شريط اختيار السيرفرات في حال احتجت تبديل السيرفر */}
          <div style={{ padding: '10px', background: '#111', display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>السيرفر الاحتياطي:</span>
            {iframeServers.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedServer(idx)}
                style={{
                  padding: '4px 10px',
                  background: selectedServer === idx ? '#e50914' : '#333',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                سيرفر {idx + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

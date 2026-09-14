import { useState, useEffect } from 'react';

export default function VideoPlayer({ tmdbId, type = 'movie', title }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useIframe, setUseIframe] = useState(false);
  const [selectedServer, setSelectedServer] = useState(0);
  const [logs, setLogs] = useState([]);
  const [statusText, setStatusText] = useState('جاري البدء...');

  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId;
  const contentType = type === 'series' || title?.type === 'series' ? 'tv' : 'movie';

  // رابط الباك أند الصحيح على Render
  const BACKEND_API_URL = 'https://streamflix-api-x0ku.onrender.com';

  // قائمة السيرفرات المضمونة للهواتف والآيفون
  const iframeServers = contentType === 'movie' ? [
    `https://vidsrc.me/embed/movie?tmdb=${realTmdb}`,
    `https://vidsrc.cc/v2/embed/movie/${realTmdb}`,
    `https://multiembed.mov/directstream.php?video_id=${realTmdb}&tmdb=1`,
    `https://autoembed.co/movie/tmdb/${realTmdb}`
  ] : [
    `https://vidsrc.me/embed/tv?tmdb=${realTmdb}&season=1&episode=1`,
    `https://vidsrc.cc/v2/embed/tv/${realTmdb}/1/1`,
    `https://multiembed.mov/directstream.php?video_id=${realTmdb}&tmdb=1&s=1&e=1`,
    `https://autoembed.co/tv/tmdb/${realTmdb}-1-1`
  ];

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  useEffect(() => {
    async function fetchCleanStream() {
      setLogs([]);
      if (!realTmdb) {
        addLog("❌ خطأ: لم يتم العثور على TMDB ID.");
        setStatusText("ERR_NO_ID");
        setLoading(false);
        return;
      }

      addLog(`🚀 بدء العملية - TMDB ID: ${realTmdb} | النوع: ${contentType}`);
      setLoading(true);

      try {
        addLog(`📡 الاتصال بالباك أند الصحيح (${BACKEND_API_URL})...`);
        const response = await fetch(`${BACKEND_API_URL}/api/extract?tmdb=${realTmdb}&type=${contentType}`);
        
        if (!response.ok) {
          throw new Error(`استجابة السيرفر: ${response.status}`);
        }

        const data = await response.json();
        addLog(`📥 استجابة API: ${JSON.stringify(data)}`);

        if (data && data.streamUrl) {
          addLog("✅ تم استخراج رابط البث الصافي بنجاح!");
          setStreamUrl(data.streamUrl);
          setUseIframe(false);
          setStatusText("STREAM_READY");
        } else {
          addLog("⚠️ لم يتوفر بث صافي مباشر. تحويل للـ Iframe البديل...");
          setUseIframe(true);
          setStatusText("IFRAME_FALLBACK");
        }
      } catch (err) {
        addLog(`❌ خطأ الاتصال بالباك أند: ${err.message}`);
        addLog("⚠️ تحويل للسيرفرات الاحتياطية...");
        setUseIframe(true);
        setStatusText("IFRAME_FALLBACK");
      } finally {
        setLoading(false);
      }
    }

    fetchCleanStream();
  }, [realTmdb, contentType]);

  return (
    <div style={{ width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', color: '#fff', direction: 'rtl' }}>
      
      {/* مشغل الفيديو */}
      <div style={{ position: 'relative', width: '100%', minHeight: '350px', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ margin: 0, fontSize: '15px', color: '#46d369' }}>⏳ جاري جلب واستخراج البث الصافي...</p>
          </div>
        ) : !useIframe && streamUrl ? (
          <video 
            controls 
            autoPlay 
            style={{ width: '100%', maxHeight: '500px', background: '#000' }}
            src={streamUrl}
          />
        ) : (
          <iframe
            key={selectedServer}
            src={iframeServers[selectedServer]}
            style={{ width: '100%', height: '380px', border: 'none', background: '#000' }}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            title="Video Player"
          />
        )}
      </div>

      {/* شريط معلومات المشغل واختيار السيرفرات */}
      <div style={{ padding: '10px 15px', background: '#111', borderTop: '1px solid #222', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#888' }}>الحالة: </span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: statusText === 'STREAM_READY' ? '#28a745' : '#ffc107' }}>
            {statusText}
          </span>
        </div>

        {useIframe && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#aaa' }}>السيرفر الاحتياطي:</span>
            {iframeServers.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedServer(idx)}
                style={{
                  padding: '4px 10px',
                  background: selectedServer === idx ? '#e50914' : '#222',
                  color: '#fff',
                  border: '1px solid ' + (selectedServer === idx ? '#e50914' : '#444'),
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                سيرفر {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* لوحة سجل التشخيص والأخطاء (Debug Log) */}
      <div style={{ padding: '12px', background: '#0a0a0a', borderTop: '1px solid #1a1a1a', fontSize: '11px', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: '#007bff', fontWeight: 'bold' }}>📋 سجل التشخيص (Debug Log):</span>
          <button 
            onClick={() => setLogs([])} 
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}
          >
            مسح السجل
          </button>
        </div>
        <div style={{ maxHeight: '130px', overflowY: 'auto', background: '#111', padding: '8px', borderRadius: '4px', border: '1px solid #222' }}>
          {logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '4px', color: log.includes('❌') ? '#ff4d4d' : log.includes('✅') ? '#46d369' : '#ccc' }}>
              {log}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

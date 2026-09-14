import { useState, useEffect, useRef } from 'react';

export default function VideoPlayer({ tmdbId, type = 'movie', title }) {
  const videoRef = useRef(null);
  const [selectedServer, setSelectedServer] = useState(0); // 0 = سيرفر 1 (افتراضي)
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [statusText, setStatusText] = useState('جاهز');

  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId;
  const contentType = type === 'series' || title?.type === 'series' ? 'tv' : 'movie';
  const BACKEND_API_URL = 'https://streamflix-api-x0ku.onrender.com';

  // بناء روابط الإيفريم حسب نوع المحتوى
  const iframe1Url = contentType === 'movie' 
    ? `https://vidsrc.me/embed/movie?tmdb=${realTmdb}`
    : `https://vidsrc.me/embed/tv?tmdb=${realTmdb}&season=1&episode=1`;

  const iframe4Url = contentType === 'movie'
    ? `https://vidsrc.cc/v2/embed/movie/${realTmdb}`
    : `https://vidsrc.cc/v2/embed/tv/${realTmdb}/1/1`;

  // قائمة السيرفرات الـ 4 المحددة
  const servers = [
    { id: 0, name: 'سيرفر 1', type: 'iframe', url: iframe1Url, desc: 'مباشر وسريع (Iframe)' },
    { id: 1, name: 'سيرفر 2', type: 'backend', endpoint: `${BACKEND_API_URL}/api/extract?tmdb=${realTmdb}&type=${contentType}&source=1`, desc: 'بث صافي (باك أند 1)' },
    { id: 2, name: 'سيرفر 3', type: 'backend', endpoint: `${BACKEND_API_URL}/api/extract?tmdb=${realTmdb}&type=${contentType}&source=2`, desc: 'بث صافي (باك أند 2)' },
    { id: 3, name: 'سيرفر 4', type: 'iframe', url: iframe4Url, desc: 'احتياطي (Iframe)' }
  ];

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  // عند تغيير السيرفر المختار
  useEffect(() => {
    async function loadServer() {
      if (!realTmdb) {
        addLog("❌ خطأ: TMDB ID غير متوفر");
        return;
      }

      const activeServer = servers[selectedServer];
      addLog(`🔄 التحويل إلى: ${activeServer.name} (${activeServer.desc})`);
      setStreamUrl(null);

      // إذا كان سيرفر باك أند (سيرفر 2 أو سيرفر 3)
      if (activeServer.type === 'backend') {
        setLoading(true);
        setStatusText(`جاري استخراج البث الصافي من ${activeServer.name}...`);
        
        try {
          addLog(`📡 الاتصال بـ: ${activeServer.endpoint}`);
          const res = await fetch(activeServer.endpoint);
          const data = await res.json();
          addLog(`📥 استجابة API: ${JSON.stringify(data)}`);

          if (data && data.streamUrl) {
            setStreamUrl(data.streamUrl);
            setStatusText(`STREAM_READY (${activeServer.name} - صافي)`);
            addLog(`✅ تم استخراج رابط البث الصافي بنجاح!`);
          } else {
            addLog(`⚠️ لم يتمكن الباك أند من استخراج رابط صافي لـ ${activeServer.name}`);
            setStatusText('فشل الاستخراج الصافي');
          }
        } catch (err) {
          addLog(`❌ خطأ في الاتصال بالباك أند: ${err.message}`);
          setStatusText('خطأ بالاتصال');
        } finally {
          setLoading(false);
        }
      } else {
        // إذا كان سيرفر Iframe (سيرفر 1 أو سيرفر 4)
        setLoading(false);
        setStatusText(`IFRAME_ACTIVE (${activeServer.name})`);
        addLog(`✅ تشغيل عبر Iframe السريع (${activeServer.name})`);
      }
    }

    loadServer();
  }, [selectedServer, realTmdb]);

  // تشغيل HLS للبث الصافي
  useEffect(() => {
    if (servers[selectedServer].type === 'backend' && streamUrl && videoRef.current) {
      const video = videoRef.current;
      if (streamUrl.includes('.m3u8')) {
        if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls();
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl;
        } else {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
          script.onload = () => {
            if (window.Hls && window.Hls.isSupported()) {
              const hls = new window.Hls();
              hls.loadSource(streamUrl);
              hls.attachMedia(video);
            }
          };
          document.body.appendChild(script);
        }
      } else {
        video.src = streamUrl;
      }
    }
  }, [streamUrl, selectedServer]);

  const currentServerObj = servers[selectedServer];

  return (
    <div style={{ width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', color: '#fff', direction: 'rtl' }}>
      
      {/* مشغل الفيديو */}
      <div style={{ position: 'relative', width: '100%', minHeight: '380px', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ margin: 0, fontSize: '15px', color: '#46d369' }}>⏳ جاري معالجة واستخراج البث الصافي في {currentServerObj.name}...</p>
          </div>
        ) : currentServerObj.type === 'backend' ? (
          streamUrl ? (
            <video 
              ref={videoRef}
              controls 
              autoPlay 
              playsInline
              style={{ width: '100%', maxHeight: '500px', background: '#000' }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: '#ff4d4d', fontSize: '14px', marginBottom: '10px' }}>⚠️ تعذر استخراج البث الصافي حالياً لهذا الفيلم في {currentServerObj.name}.</p>
              <p style={{ color: '#aaa', fontSize: '12px' }}>يرجى اختيار <b>سيرفر 1</b> أو <b>سيرفر 4</b> للمشاهدة المباشرة.</p>
            </div>
          )
        ) : (
          <iframe
            key={selectedServer}
            src={currentServerObj.url}
            style={{ width: '100%', height: '400px', border: 'none', background: '#000' }}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            title="Video Player"
          />
        )}
      </div>

      {/* شريط اختيار السيرفرات الـ 4 */}
      <div style={{ padding: '10px 15px', background: '#111', borderTop: '1px solid #222', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#888' }}>الحالة: </span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#28a745' }}>
            {statusText}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#aaa' }}>السيرفر:</span>
          {servers.map((srv) => (
            <button
              key={srv.id}
              onClick={() => setSelectedServer(srv.id)}
              style={{
                padding: '5px 12px',
                background: selectedServer === srv.id ? '#e50914' : '#222',
                color: '#fff',
                border: '1px solid ' + (selectedServer === srv.id ? '#e50914' : '#444'),
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {srv.name} {srv.type === 'backend' ? '(صافي)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* سجل التشخيص */}
      <div style={{ padding: '10px 12px', background: '#0a0a0a', borderTop: '1px solid #1a1a1a', fontSize: '11px', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#007bff', fontWeight: 'bold' }}>📋 سجل تشخيص البث:</span>
          <button onClick={() => setLogs([])} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px' }}>مسح</button>
        </div>
        <div style={{ maxHeight: '100px', overflowY: 'auto', background: '#111', padding: '6px', borderRadius: '4px', border: '1px solid #222' }}>
          {logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '3px', color: log.includes('❌') ? '#ff4d4d' : log.includes('✅') ? '#46d369' : '#ccc' }}>
              {log}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

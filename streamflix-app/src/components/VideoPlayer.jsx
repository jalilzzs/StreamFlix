import { useState, useEffect, useRef } from 'react';

export default function VideoPlayer({ tmdbId, type = 'movie', title }) {
  const videoRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useIframe, setUseIframe] = useState(false);
  const [selectedServer, setSelectedServer] = useState(0);
  const [logs, setLogs] = useState([]);
  const [statusText, setStatusText] = useState('جاري البدء...');

  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId;
  const contentType = type === 'series' || title?.type === 'series' ? 'tv' : 'movie';

  const BACKEND_API_URL = 'https://streamflix-api-x0ku.onrender.com';

  // سيرفرات خفيفة ومحدثة
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
        addLog(`📡 جلب البث المباشر...`);
        const response = await fetch(`${BACKEND_API_URL}/api/extract?tmdb=${realTmdb}&type=${contentType}`);
        
        if (!response.ok) throw new Error(`استجابة السيرفر: ${response.status}`);

        const data = await response.json();

        if (data && data.streamUrl) {
          addLog("✅ تم استخراج رابط البث الصافي بنجاح!");
          setStreamUrl(data.streamUrl);
          setUseIframe(false);
          setStatusText("STREAM_READY (صافي بدون إعلانات)");
        } else {
          addLog("⚠️ تحويل أوتوماتيكي للسيرفر الاحتياطي مع درع حظر الإعلانات...");
          setUseIframe(true);
          setStatusText("IFRAME_PROTECTED (محمي من الإعلانات)");
        }
      } catch (err) {
        addLog(`⚠️ تحويل للسيرفرات الاحتياطية المباشرة...`);
        setUseIframe(true);
        setStatusText("IFRAME_PROTECTION");
      } finally {
        setLoading(false);
      }
    }

    fetchCleanStream();
  }, [realTmdb, contentType]);

  // تشغيل HLS المباشر إن وجد
  useEffect(() => {
    if (!useIframe && streamUrl && videoRef.current) {
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
  }, [streamUrl, useIframe]);

  return (
    <div style={{ width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', color: '#fff', direction: 'rtl' }}>
      
      {/* مشغل الفيديو */}
      <div style={{ position: 'relative', width: '100%', minHeight: '380px', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ margin: 0, fontSize: '15px', color: '#46d369' }}>⏳ جاري تجهيز المشغل وتحصينه من الإعلانات...</p>
          </div>
        ) : !useIframe && streamUrl ? (
          <video 
            ref={videoRef}
            controls 
            autoPlay 
            playsInline
            style={{ width: '100%', maxHeight: '500px', background: '#000' }}
          />
        ) : (
          /* Iframe مع خاصية sandbox لحظر الإعلانات والـ Popups تماماً */
          <iframe
            key={selectedServer}
            src={iframeServers[selectedServer]}
            style={{ width: '100%', height: '400px', border: 'none', background: '#000' }}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            title="Video Player"
          />
        )}
      </div>

      {/* شريط اختيار السيرفرات */}
      <div style={{ padding: '10px 15px', background: '#111', borderTop: '1px solid #222', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#888' }}>الحالة: </span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#28a745' }}>
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

      {/* لوحة سجل التشخيص */}
      <div style={{ padding: '10px 12px', background: '#0a0a0a', borderTop: '1px solid #1a1a1a', fontSize: '11px', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#007bff', fontWeight: 'bold' }}>📋 سجل تشغيل الفيديو:</span>
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

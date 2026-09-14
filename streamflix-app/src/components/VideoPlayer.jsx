import React, { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';

const API_BASE_URL = 'https://streamflix-api-x0ku.onrender.com';

export default function VideoPlayer({ tmdbId, type = 'movie', season = 1, episode = 1 }) {
  // فحص ما إذا كان الـ ID عبارة عن UUID من Supabase بدلاً من TMDB ID
  const isUuid = typeof tmdbId === 'string' && tmdbId.includes('-') && tmdbId.length > 20;

  const [timeLeft, setTimeLeft] = useState(15);
  const [streamUrl, setStreamUrl] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [forceIframe, setForceIframe] = useState(false);

  const [logs, setLogs] = useState([]);
  const [errorCode, setErrorCode] = useState('NONE');
  const [showLogModal, setShowLogModal] = useState(false);

  const videoRef = useRef(null);

  const fallbackUrl = type === 'tv' 
    ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  useEffect(() => {
    if (!tmdbId || isUuid) {
      setErrorCode('ERR_INVALID_TMDB_ID');
      addLog(`خطأ: الرقم الممرر (${tmdbId}) ليس TMDB ID صالح.`);
      return;
    }

    setTimeLeft(15);
    setStreamUrl(null);
    setShowPlayer(false);
    setForceIframe(false);
    setLogs([]);
    setErrorCode('NONE');

    addLog(`بدء العملية - TMDB ID: ${tmdbId} | النوع: ${type}`);

    async function checkStream() {
      addLog(`إرسال طلب لـ API مع TMDB ID: ${tmdbId}`);
      try {
        const query = type === 'tv' 
          ? `tmdb=${tmdbId}&type=tv&season=${season}&episode=${episode}`
          : `tmdb=${tmdbId}&type=movie`;

        const res = await fetch(`${API_BASE_URL}/api/extract?${query}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const data = await res.json();
        addLog(`استجابة السيرفر: ${JSON.stringify(data)}`);

        if (data && data.success && data.streamUrl) {
          addLog(`تم العثور على رابط البث بنجاح`);
          setStreamUrl(data.streamUrl);
        } else {
          addLog(`لم يتم العثور على رابط مباشر، تحويل للـ iframe`);
          setErrorCode('ERR_NO_STREAM');
          setForceIframe(true);
        }
      } catch (e) {
        addLog(`خطأ اتصال بالـ API: ${e.message}`);
        setErrorCode(`ERR_API_FETCH`);
        setForceIframe(true);
      }
    }

    checkStream();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowPlayer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tmdbId, type, season, episode, isUuid]);

  useEffect(() => {
    if (showPlayer && streamUrl && !forceIframe && videoRef.current) {
      const video = videoRef.current;
      let hls;

      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setErrorCode(`ERR_HLS_FATAL`);
            setForceIframe(true);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
      } else {
        setForceIframe(true);
      }

      return () => {
        if (hls) hls.destroy();
      };
    }
  }, [showPlayer, streamUrl, forceIframe]);

  // تنبيه في حال غياب tmdb_id في جدول البيانات
  if (!tmdbId || isUuid) {
    return (
      <div className="w-full aspect-video bg-red-950/40 border border-red-800/50 rounded-lg flex flex-col items-center justify-center text-red-300 p-6 text-center gap-2 dir-rtl">
        <p className="font-bold text-base">⚠️ خطأ في معرّف الفيلم (TMDB ID)</p>
        <p className="text-xs text-gray-300 max-w-md">
          الرقم الحالي الممرر هو <code className="bg-black/50 px-1 rounded text-yellow-400">{tmdbId || 'null'}</code> وهو عبارة عن UUID خاص بـ Supabase وليس رقم TMDB.
        </p>
        <p className="text-[11px] text-gray-400 mt-2">
          تأكد من إضافة عمود باسم <code className="text-white">tmdb_id</code> في جدول <code className="text-white">titles</code> وتعبئته برقم الفيلم من موقع TMDB.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg relative border border-gray-800">
        {!showPlayer ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white p-4 gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="absolute text-xl font-bold">{timeLeft}</span>
            </div>
            <div className="text-center">
              <p className="font-semibold text-base">جاري تحضير السيرفر...</p>
              <p className="text-xs text-gray-400 mt-1">TMDB ID: {tmdbId}</p>
            </div>
            <button 
              onClick={() => setShowPlayer(true)}
              className="mt-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all"
            >
              تخطي والتشغيل الآن ➔
            </button>
          </div>
        ) : streamUrl && !forceIframe ? (
          <video 
            ref={videoRef}
            controls 
            autoPlay 
            playsInline
            onError={() => {
              setErrorCode(`ERR_NATIVE_VIDEO`);
              setForceIframe(true);
            }} 
            className="w-full h-full object-contain" 
          />
        ) : (
          <iframe 
            src={fallbackUrl} 
            title="Video Player"
            className="w-full h-full border-0 absolute top-0 left-0" 
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-red-400">الحالة:</span>
          <span className="bg-black px-2 py-1 rounded border border-gray-700 font-mono text-yellow-400">
            {errorCode}
          </span>
        </div>
        <button 
          onClick={() => setShowLogModal(!showLogModal)}
          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700"
        >
          🐞 {showLogModal ? 'إخفاء السجل' : 'عرض السجل'}
        </button>
      </div>

      {showLogModal && (
        <div className="w-full bg-black border border-green-800 rounded-lg p-3 font-mono text-[11px] text-green-400 max-h-48 overflow-y-auto dir-ltr">
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}

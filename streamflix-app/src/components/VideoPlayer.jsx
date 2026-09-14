import React, { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';

const API_BASE_URL = 'https://streamflix-api-x0ku.onrender.com';

export default function VideoPlayer({ tmdbId, type = 'movie', season = 1, episode = 1 }) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [streamUrl, setStreamUrl] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [forceIframe, setForceIframe] = useState(false);

  // حقول تتبع وتحديد الأخطاء
  const [logs, setLogs] = useState([]);
  const [errorCode, setErrorCode] = useState('NONE');
  const [showLogModal, setShowLogModal] = useState(false);

  const videoRef = useRef(null);

  const fallbackUrl = type === 'tv' 
    ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;

  // دالة تسجيل الأحداث
  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  useEffect(() => {
    setTimeLeft(15);
    setStreamUrl(null);
    setShowPlayer(false);
    setForceIframe(false);
    setLogs([]);
    setErrorCode('NONE');

    addLog(`بدء العملية - الفيلم ID: ${tmdbId} | النوع: ${type}`);

    async function checkStream() {
      addLog(`إرسال طلب لـ API: ${API_BASE_URL}`);
      try {
        const query = type === 'tv' 
          ? `tmdb=${tmdbId}&type=tv&season=${season}&episode=${episode}`
          : `tmdb=${tmdbId}&type=movie`;

        const res = await fetch(`${API_BASE_URL}/api/extract?${query}`);
        addLog(`استجابة السيرفر (Status): ${res.status}`);

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        addLog(`بيانات السيرفر: ${JSON.stringify(data)}`);

        if (data && data.success && data.streamUrl) {
          addLog(`تم العثور على رابط m3u8 بنجاح!`);
          setStreamUrl(data.streamUrl);
        } else {
          addLog(`لم يتم العثور على m3u8 (مُشفر أو غير متوفر).`);
          setErrorCode('ERR_CODE_A: NO_DIRECT_STREAM');
          setForceIframe(true);
        }
      } catch (e) {
        addLog(`خطأ اتصال بالـ API: ${e.message}`);
        setErrorCode(`ERR_CODE_B: API_FETCH_FAILED (${e.message})`);
        setForceIframe(true);
      }
    }

    if (tmdbId) checkStream();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowPlayer(true);
          addLog(`انتهى العداد - فتح المشغل.`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tmdbId, type, season, episode]);

  // إعداد وتشغيل Hls.js مع التقاط الأخطاء التفصيلية
  useEffect(() => {
    if (showPlayer && streamUrl && !forceIframe && videoRef.current) {
      addLog(`محاولة تشغيل البث المباشر عبر HLS...`);
      const video = videoRef.current;
      let hls;

      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            addLog(`خطأ fatal في HLS: ${data.type} - ${data.details}`);
            setErrorCode(`ERR_CODE_C: HLS_FATAL_${data.type}`);
            setForceIframe(true);
          } else {
            addLog(`تحذير HLS: ${data.details}`);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        addLog(`التشغيل عبر مشغل Safari/iOS الناnative...`);
        video.src = streamUrl;
      } else {
        addLog(`المتصفح لا يدعم تشغيل HLS.`);
        setErrorCode('ERR_CODE_D: HLS_NOT_SUPPORTED');
        setForceIframe(true);
      }

      return () => {
        if (hls) hls.destroy();
      };
    }
  }, [showPlayer, streamUrl, forceIframe]);

  return (
    <div className="w-full flex flex-col gap-2">
      {/* شاشة العرض الرئيسية */}
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg relative border border-gray-800">
        {!showPlayer ? (
          /* واجهة العد التنازلي */
          <div className="w-full h-full flex flex-col items-center justify-center text-white p-4 gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="absolute text-xl font-bold">{timeLeft}</span>
            </div>
            <div className="text-center">
              <p className="font-semibold text-base">جاري تحضير السيرفر...</p>
              <p className="text-xs text-gray-400 mt-1">رمز الحالة الحالية: {errorCode}</p>
            </div>
            <button 
              onClick={() => setShowPlayer(true)}
              className="mt-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all"
            >
              تخطي والتشغيل الآن ➔
            </button>
          </div>
        ) : streamUrl && !forceIframe ? (
          /* مشغل الفيديو المباشر */
          <video 
            ref={videoRef}
            controls 
            autoPlay 
            playsInline
            onError={(e) => {
              addLog(`خطأ وسم الفيديو Native: ${e.target.error?.message || 'Unknown'}`);
              setErrorCode(`ERR_CODE_E: NATIVE_VIDEO_FAILED`);
              setForceIframe(true);
            }} 
            className="w-full h-full object-contain" 
          />
        ) : (
          /* Iframe الاحتياطي */
          <iframe 
            src={fallbackUrl} 
            title="Video Player"
            className="w-full h-full border-0 absolute top-0 left-0" 
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      {/* زر وشريط كشف الأخطاء السفلي */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-red-400">حالة المشغل:</span>
          <span className="bg-black px-2 py-1 rounded border border-gray-700 font-mono text-yellow-400">
            {errorCode}
          </span>
        </div>
        <button 
          onClick={() => setShowLogModal(!showLogModal)}
          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 flex items-center gap-1"
        >
          🐞 {showLogModal ? 'إخفاء السجل' : 'عرض سجل الأخطاء'}
        </button>
      </div>

      {/* نافذة سجل الأحداث (Terminal View) */}
      {showLogModal && (
        <div className="w-full bg-black border border-green-800 rounded-lg p-3 font-mono text-[11px] text-green-400 max-h-48 overflow-y-auto dir-ltr">
          <div className="font-bold border-b border-green-900 pb-1 mb-2 text-white">=== DEBUG LOGS TRACE ===</div>
          {logs.length === 0 ? (
            <div>لا توجد سجلات بعد...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap leading-relaxed">
                {log}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

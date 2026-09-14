import React, { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';

const API_BASE_URL = 'https://streamflix-api-x0ku.onrender.com';

export default function VideoPlayer({ tmdbId, type = 'movie', season = 1, episode = 1 }) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [streamUrl, setStreamUrl] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [forceIframe, setForceIframe] = useState(false);
  const videoRef = useRef(null);

  // سيرفر iframe احتياطي شغال وسريع جداً
  const fallbackUrl = type === 'tv' 
    ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;

  useEffect(() => {
    setTimeLeft(15);
    setStreamUrl(null);
    setShowPlayer(false);
    setForceIframe(false);

    // 1. طلب استخراج البث الصافي في الخلفية
    async function checkStream() {
      try {
        const query = type === 'tv' 
          ? `tmdb=${tmdbId}&type=tv&season=${season}&episode=${episode}`
          : `tmdb=${tmdbId}&type=movie`;

        const res = await fetch(`${API_BASE_URL}/api/extract?${query}`);
        const data = await res.json();

        if (data && data.success && data.streamUrl) {
          setStreamUrl(data.streamUrl);
        } else {
          setForceIframe(true);
        }
      } catch (e) {
        setForceIframe(true);
      }
    }

    if (tmdbId) checkStream();

    // 2. عداد الـ 15 ثانية
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
  }, [tmdbId, type, season, episode]);

  // تشغيل HLS أو التحويل المباشر للـ iframe إذا فشل الرابط الصافي
  useEffect(() => {
    if (showPlayer && streamUrl && !forceIframe && videoRef.current) {
      const video = videoRef.current;
      let hls;

      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, () => {
          // في حال وجود حظر 403 على ملفات .m3u8 يحول فوراً للـ iframe
          setForceIframe(true);
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

  // بعد انتهاء العداد أو ضغط تخطي
  if (showPlayer) {
    // إذا كان هناك بث صافي شغال بدون أخطاء
    if (streamUrl && !forceIframe) {
      return (
        <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg relative">
          <video 
            ref={videoRef}
            controls 
            autoPlay 
            playsInline
            onError={() => setForceIframe(true)} 
            className="w-full h-full object-contain" 
          />
        </div>
      );
    }

    // المشغل الأساسي المباشر (Iframe)
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg relative">
        <iframe 
          src={fallbackUrl} 
          title="Video Player"
          className="w-full h-full border-0 absolute top-0 left-0" 
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // واجهة العد التنازلي (15 ثانية)
  return (
    <div className="w-full aspect-video bg-gray-900 border border-gray-800 rounded-lg flex flex-col items-center justify-center text-white p-4 gap-4 shadow-lg">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="absolute text-xl font-bold">{timeLeft}</span>
      </div>

      <div className="text-center">
        <p className="font-semibold text-base">جاري تحضير البث...</p>
        <p className="text-xs text-gray-400 mt-1">سيتم تشغيل الفيديو تلقائياً فور انتهاء العد</p>
      </div>

      <button 
        onClick={() => setShowPlayer(true)}
        className="mt-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all active:scale-95"
      >
        تخطي والتشغيل الآن ➔
      </button>
    </div>
  );
}

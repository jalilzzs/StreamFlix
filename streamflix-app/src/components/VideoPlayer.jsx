import React, { useEffect, useState } from 'react';

const API_BASE_URL = 'https://streamflix-api-atzd.onrender.com';

export default function VideoPlayer({ tmdbId, type = 'movie', season, episode }) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [streamUrl, setStreamUrl] = useState(null);
  const [showIframe, setShowIframe] = useState(false);

  const fallbackUrl = type === 'tv' 
    ? `https://vidsrc.to/embed/tv/${tmdbId}/${season || 1}/${episode || 1}`
    : `https://vidsrc.to/embed/movie/${tmdbId}`;

  useEffect(() => {
    // 1. محاولة استخراج البث في الخلفية
    async function checkStream() {
      try {
        const query = type === 'tv' 
          ? `tmdb=${tmdbId}&type=tv&season=${season || 1}&episode=${episode || 1}`
          : `tmdb=${tmdbId}&type=movie`;

        const res = await fetch(`${API_BASE_URL}/api/extract?${query}`);
        const data = await res.json();

        if (data.success && data.streamUrl) {
          setStreamUrl(data.streamUrl);
        }
      } catch (e) {
        console.log("Extraction error, using fallback");
      }
    }

    if (tmdbId) checkStream();

    // 2. العد التنازلي لمدة 15 ثانية
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowIframe(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tmdbId, type, season, episode]);

  // إذا تم العثور على رابط مباشر صافي قبل انتهاء الوقت
  if (streamUrl && !showIframe) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
        <video src={streamUrl} controls autoPlay className="w-full h-full" />
      </div>
    );
  }

  // إذا انتهى العد التنازلي أو ضغط المستخدم على تخطي
  if (showIframe) {
    return (
      <div className="w-full h-full relative aspect-video rounded-lg overflow-hidden">
        <iframe 
          src={fallbackUrl} 
          title="Video Player"
          className="w-full h-full border-0 absolute top-0 left-0" 
          allowFullScreen 
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      </div>
    );
  }

  // واجهة العد التنازلي الاحترافية (15 ثانية)
  return (
    <div className="w-full aspect-video bg-gray-900 border border-gray-800 rounded-lg flex flex-col items-center justify-center text-white p-4 gap-4">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="absolute text-xl font-bold">{timeLeft}</span>
      </div>

      <div className="text-center">
        <p className="font-semibold text-base">جاري تحضير البث بأعلى جودة...</p>
        <p className="text-xs text-gray-400 mt-1">سيتم تشغيل المشغل تلقائياً خلال ثوانٍ</p>
      </div>

      <button 
        onClick={() => setShowIframe(true)}
        className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-all"
      >
        تخطي والانتشار المباشر ➔
      </button>
    </div>
  );
}

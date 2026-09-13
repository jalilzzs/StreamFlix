import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const API_BASE_URL = 'https://streamflix-api-atzd.onrender.com'; // حط رابط الـ API تاعك هنا

export default function VideoPlayer({ tmdbId, type = 'movie', season, episode }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState('');

  useEffect(() => {
    let plyrInstance = null;
    let hlsInstance = null;
    let isMounted = true;

    async function fetchAndSetupStream() {
      setLoading(true);
      const query = type === 'tv' 
        ? `tmdb=${tmdbId}&type=tv&season=${season || 1}&episode=${episode || 1}`
        : `tmdb=${tmdbId}&type=movie`;

      const defaultFallback = `https://vidsrc.to/embed/${type === 'tv' ? 'tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1) : 'movie/' + tmdbId}`;

      try {
        // تحديد مهلة 6 ثوانٍ فقط للـ API قبل التحويل التلقائي
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(`${API_BASE_URL}/api/extract?${query}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();

        if (isMounted && data.success && data.streamUrl) {
          setLoading(false);
          setUseFallback(false);

          setTimeout(() => {
            const video = videoRef.current;
            if (!video) return;

            if (Hls.isSupported()) {
              hlsInstance = new Hls();
              hlsInstance.loadSource(data.streamUrl);
              hlsInstance.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = data.streamUrl;
            }

            plyrInstance = new Plyr(video, {
              controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen']
            });
          }, 100);

        } else {
          throw new Error("Extract failed");
        }
      } catch (err) {
        if (isMounted) {
          setFallbackUrl(defaultFallback);
          setUseFallback(true);
          setLoading(false);
        }
      }
    }

    if (tmdbId) fetchAndSetupStream();

    return () => {
      isMounted = false;
      if (plyrInstance) plyrInstance.destroy();
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [tmdbId, type, season, episode]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-black/80 flex flex-col items-center justify-center text-white text-sm rounded-lg gap-2">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        <span>جاري تحميل المشغل...</span>
      </div>
    );
  }

  if (useFallback) {
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

  return (
    <div className="w-full h-full aspect-video bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} className="plyr-react plyr" playsInline controls />
    </div>
  );
}

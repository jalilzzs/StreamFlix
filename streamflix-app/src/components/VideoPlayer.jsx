import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

const API_BASE_URL = 'https://streamflix-api-x0ku.onrender.com';
export default function VideoPlayer({ tmdbId, type = 'movie', season, episode }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState('');

  useEffect(() => {
    let plyrInstance = null;
    let hlsInstance = null;

    async function fetchAndSetupStream() {
      setLoading(true);
      try {
        const query = type === 'tv' 
          ? `tmdb=${tmdbId}&type=tv&season=${season || 1}&episode=${episode || 1}`
          : `tmdb=${tmdbId}&type=movie`;

        const res = await fetch(`${API_BASE_URL}/api/extract?${query}`);
        const data = await res.json();

        if (data.success && data.streamUrl) {
          const video = videoRef.current;

          if (Hls.isSupported()) {
            hlsInstance = new Hls();
            hlsInstance.loadSource(data.streamUrl);
            hlsInstance.attachMedia(video);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = data.streamUrl;
          }

          plyrInstance = new Plyr(video, {
            controls: [
              'play-large', 'play', 'progress', 'current-time', 
              'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'
            ],
            // رابط إعلان الفيديو VAST تحطه هنا
            ads: {
              enabled: true,
              tagUrl: 'YOUR_VAST_AD_TAG_URL_HERE'
            }
          });

          setUseFallback(false);
        } else {
          setFallbackUrl(data.fallbackUrl || `https://vidsrc.to/embed/${type}/${tmdbId}`);
          setUseFallback(true);
        }
      } catch (err) {
        setFallbackUrl(`https://vidsrc.to/embed/${type}/${tmdbId}`);
        setUseFallback(true);
      } finally {
        setLoading(false);
      }
    }

    if (tmdbId) fetchAndSetupStream();

    return () => {
      if (plyrInstance) plyrInstance.destroy();
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [tmdbId, type, season, episode]);

  if (loading) {
    return (
      <div className="w-full h-64 bg-black/80 flex items-center justify-center text-white text-sm rounded-lg">
        جاري جلب البث الصافي...
      </div>
    );
  }

  if (useFallback) {
    return (
      <div className="w-full h-full relative aspect-video">
        <iframe 
          src={fallbackUrl} 
          title="Video Player"
          className="w-full h-full border-0 absolute top-0 left-0 rounded-lg" 
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

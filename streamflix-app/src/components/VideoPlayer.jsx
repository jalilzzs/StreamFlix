import { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import { STREAM_SERVER_LABELS } from '../lib/config';
import './VideoPlayer.css';

export default function VideoPlayer({ episode, title, onProgress }) {
  const videoRef = useRef(null);
  const plyrRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const [activeServer, setActiveServer] = useState(null);

  // جلب البيانات سواء تم تمرير episode أو title
  const mediaData = episode || title || {};
  let streamUrls = mediaData.stream_urls || {};

  // إذا كانت stream_urls فارغة والرابط مخزن في العمود url المباشر (مثلما يفعل ملف Import.jsx)
  if (Object.keys(streamUrls).length === 0 && (mediaData.url || mediaData.stream_url)) {
    streamUrls = { server1: mediaData.url || mediaData.stream_url };
  }

  const availableServers = Object.keys(streamUrls);

  useEffect(() => {
    if (availableServers.length > 0 && !activeServer) {
      setActiveServer(availableServers[0]);
    }
  }, [availableServers, activeServer]);

  const currentUrl = streamUrls[activeServer] || '';
  const isEmbed = currentUrl.includes('embed') || currentUrl.includes('iframe') || currentUrl.includes('vidsrc');

  useEffect(() => {
    // إذا كان رابط embed أو فارغاً، لا نفعل Plyr
    if (isEmbed || !currentUrl || !videoRef.current) return;

    plyrRef.current = new Plyr(videoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
    });

    if (mediaData?.resumeAt) {
      plyrRef.current.once('loadedmetadata', () => {
        plyrRef.current.currentTime = mediaData.resumeAt;
      });
    }

    saveIntervalRef.current = setInterval(() => {
      if (plyrRef.current && !plyrRef.current.paused && onProgress) {
        onProgress(plyrRef.current.currentTime, plyrRef.current.duration);
      }
    }, 10000);

    return () => {
      clearInterval(saveIntervalRef.current);
      plyrRef.current?.destroy();
    };
  }, [activeServer, mediaData?.id, isEmbed, currentUrl]);

  if (!mediaData || availableServers.length === 0 || !currentUrl) {
    return (
      <div className="player-container">
        <div className="player-placeholder">
          <div className="play-icon">▶</div>
          لا يوجد رابط عرض متاح لهذا الفيلم.
        </div>
      </div>
    );
  }

  return (
    <div className="player-block">
      <div className="player-container" style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
        {isEmbed ? (
          /* عرض رابط vidsrc داخل Iframe */
          <iframe 
            src={currentUrl} 
            className="w-full h-full rounded-lg border-0" 
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            allowFullScreen 
          />
        ) : (
          /* عرض الفيديو المباشر بمشغل Plyr */
          <video ref={videoRef} playsInline controls src={currentUrl} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      {availableServers.length > 1 && (
        <div className="server-row" style={{ marginTop: '10px' }}>
          <span className="server-label">Server:</span>
          {availableServers.map((key) => (
            <button
              key={key}
              className={`server-btn ${activeServer === key ? 'active' : ''}`}
              onClick={() => setActiveServer(key)}
            >
              {STREAM_SERVER_LABELS[key] || key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

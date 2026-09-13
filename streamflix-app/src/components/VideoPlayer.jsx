import { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import { STREAM_SERVER_LABELS } from '../lib/config';
import './VideoPlayer.css';

export default function VideoPlayer({ episode, onProgress }) {
  const videoRef = useRef(null);
  const plyrRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const [activeServer, setActiveServer] = useState(null);

  const streamUrls = episode?.stream_urls || {};
  const availableServers = Object.keys(streamUrls);

  useEffect(() => {
    if (availableServers.length > 0 && !activeServer) {
      setActiveServer(availableServers[0]);
    }
  }, [availableServers, activeServer]);

  const currentUrl = streamUrls[activeServer] || '';
  const isEmbed = currentUrl.includes('embed') || currentUrl.includes('iframe');

  useEffect(() => {
    // إذا كان رابط embed، ما نخدموش بـ Plyr تفادياً للأخطاء
    if (isEmbed || !videoRef.current) return;

    plyrRef.current = new Plyr(videoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
    });

    if (episode?.resumeAt) {
      plyrRef.current.once('loadedmetadata', () => {
        plyrRef.current.currentTime = episode.resumeAt;
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
  }, [activeServer, episode?.id, isEmbed]);

  if (!episode) {
    return (
      <div className="player-container">
        <div className="player-placeholder">
          <div className="play-icon">▶</div>
          Select an episode to start watching.
        </div>
      </div>
    );
  }

  if (availableServers.length === 0) {
    return (
      <div className="player-container">
        <div className="player-placeholder">
          <div className="play-icon">▶</div>
          No stream sources configured yet for this episode.
        </div>
      </div>
    );
  }

  return (
    <div className="player-block">
      <div className="player-container" style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
        {isEmbed ? (
          /* إذا كان الرابط Embed (مثل vidsrc)، اعرضه داخل Iframe */
          <iframe 
            src={currentUrl} 
            className="w-full h-full rounded-lg border-0" 
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            allowFullScreen 
          />
        ) : (
          /* إذا كان رابط فيديو مباشر، اعرضه بمشغل Plyr العادي */
          <video ref={videoRef} playsInline controls src={currentUrl} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

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
    </div>
  );
}

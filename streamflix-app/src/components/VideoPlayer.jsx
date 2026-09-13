import { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import { STREAM_SERVER_LABELS } from '../lib/config';
import './VideoPlayer.css';

// episode.stream_urls is expected to look like: { server1: "https://...", server2: "https://..." }
// You'll populate this jsonb column yourself per episode row in Supabase.
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

  useEffect(() => {
    if (!videoRef.current) return;
    plyrRef.current = new Plyr(videoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
    });

    // Resume where the user left off, if we have a saved position.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServer, episode?.id]);

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
          <div className="placeholder-note" style={{ marginTop: 12 }}>
            Add a value to episodes.stream_urls in Supabase, e.g. {'{ "server1": "https://..." }'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-block">
      <div className="player-container">
        <video ref={videoRef} playsInline controls src={streamUrls[activeServer]} />
      </div>
      <div className="server-row">
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

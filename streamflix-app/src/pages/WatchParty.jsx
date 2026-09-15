import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getWatchParty,
  joinWatchParty,
  subscribeToParty,
  updatePartyPlayback,
  closeWatchParty,
} from '../lib/api';
import ProtectedRoute from '../components/ProtectedRoute';
import './WatchParty.css';

function WatchPartyInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [party, setParty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [position, setPosition] = useState(0);
  const [status, setStatus] = useState('paused');
  const lastRemote = useRef(0);

  const userId = party?.current_user_id;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getWatchParty(id);
        if (!active) return;
        setParty(data);
        setPosition(Number(data.playback_position || 0));
        setStatus(data.status || 'paused');
      } catch (e) {
        if (active) setError(e.message || 'تعذر فتح الغرفة.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let unsub = () => {};
    (async () => {
      try {
        await joinWatchParty(id);
        unsub = subscribeToParty(id, (next) => {
          if (!next) return;
          lastRemote.current = Date.now();
          setPosition(Number(next.playback_position || 0));
          setStatus(next.status || 'paused');
          if (next.status === 'closed') navigate('/');
        });
      } catch (e) {
        setError(e.message || 'لا تملك صلاحية الدخول إلى هذه الغرفة.');
      }
    })();
    return () => unsub();
  }, [id, navigate]);

  const sendPlayback = async (nextPosition, nextStatus) => {
    if (!party || party.host_id !== userId) return;
    setPosition(nextPosition);
    setStatus(nextStatus);
    try {
      await updatePartyPlayback(id, nextPosition, nextStatus);
    } catch (e) {
      setError(e.message || 'تعذر مزامنة المشاهدة.');
    }
  };

  const leave = async () => {
    try {
      if (party?.host_id === userId) await closeWatchParty(id);
    } finally {
      navigate('/');
    }
  };

  if (loading) return <div className="watch-party-page"><div className="watch-party-loading">جاري فتح غرفة المشاهدة...</div></div>;
  if (error || !party) return <div className="watch-party-page"><div className="watch-party-error-page">{error || 'الغرفة غير موجودة.'}</div></div>;

  const contentUrl = party.content_type === 'tv'
    ? `https://vidsrc.me/embed/tv?tmdb=${party.tmdb_id}&season=${party.season || 1}&episode=${party.episode || 1}`
    : `https://vidsrc.me/embed/movie?tmdb=${party.tmdb_id}`;

  const isHost = party.host_id === userId;

  return (
    <div className="watch-party-page">
      <div className="watch-party-top">
        <div>
          <div className="watch-party-kicker">PRIVATE WATCH PARTY</div>
          <h1>{party.title_name || 'مشاهدة جماعية'}</h1>
          <span>{party.member_count || 1} مشارك</span>
        </div>
        <button type="button" onClick={leave}>خروج</button>
      </div>

      <div className="watch-party-player">
        <iframe
          src={contentUrl}
          title="Watch Party Player"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="watch-party-sync">
        <div>
          <strong>{status === 'playing' ? '▶️ جاري التشغيل' : '⏸️ متوقف مؤقتًا'}</strong>
          <span>الموضع: {Math.floor(position)} ثانية</span>
        </div>
        {isHost && (
          <div className="watch-party-host-controls">
            <button type="button" onClick={() => sendPlayback(position, 'playing')}>Play</button>
            <button type="button" onClick={() => sendPlayback(position, 'paused')}>Pause</button>
            <button type="button" onClick={() => sendPlayback(position + 10, status)}>+10s</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WatchParty() {
  return <ProtectedRoute><WatchPartyInner /></ProtectedRoute>;
}

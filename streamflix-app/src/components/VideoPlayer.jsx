import { useEffect, useMemo, useState } from 'react';
import {
  fetchFriends,
  createWatchParty,
  sendMessage,
} from '../lib/api';

export default function VideoPlayer({ tmdbId, type = 'movie', title }) {
  const [selectedServer, setSelectedServer] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');

  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId;
  const contentType = type === 'series' || title?.type === 'series' || title?.type === 'tv' ? 'tv' : 'movie';

  const server1Url = contentType === 'movie'
    ? `https://vidsrc.me/embed/movie?tmdb=${realTmdb}`
    : `https://vidsrc.me/embed/tv?tmdb=${realTmdb}&season=1&episode=1`;

  const server2Url = contentType === 'movie'
    ? `https://vidsrc.cc/v2/embed/movie/${realTmdb}`
    : `https://vidsrc.cc/v2/embed/tv/${realTmdb}/1/1`;

  const servers = useMemo(() => [
    { id: 0, name: 'سيرفر 1', url: server1Url },
    { id: 1, name: 'سيرفر 2', url: server2Url },
  ], [server1Url, server2Url]);

  useEffect(() => {
    if (!shareOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchFriends();
        if (!cancelled) setFriends(data || []);
      } catch (e) {
        if (!cancelled) setShareError(e.message || 'تعذر جلب الأصدقاء.');
      }
    })();
    return () => { cancelled = true; };
  }, [shareOpen]);

  const toggleFriend = (id) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const shareParty = async () => {
    if (!selectedFriends.length || !realTmdb || sharing) return;
    setSharing(true);
    setShareError('');
    try {
      const party = await createWatchParty({
        titleId: title?.id || null,
        episodeId: title?.current_episode_id || null,
        tmdbId: realTmdb,
        contentType,
        hostServer: selectedServer,
      });

      await Promise.all(
        selectedFriends.map((friendId) =>
          sendMessage({
            receiverId: friendId,
            kind: 'watch_party',
            content: JSON.stringify({
              partyId: party.id,
              tmdbId: realTmdb,
              contentType,
              titleName: title?.name || title?.title || 'مشاهدة جماعية',
              poster: title?.poster_url || title?.poster_path || null,
              releaseYear: title?.release_year || null,
              rating: title?.rating_avg || null,
              server: selectedServer,
            }),
          })
        )
      );

      setSelectedFriends([]);
      setShareOpen(false);
    } catch (e) {
      setShareError(e.message || 'تعذر إنشاء الدعوة.');
    } finally {
      setSharing(false);
    }
  };

  const currentServerObj = servers[selectedServer];

  return (
    <div className="player-block">
      <div className="player-container">
        <iframe
          key={`${selectedServer}-${realTmdb}`}
          src={currentServerObj.url}
          style={{ width: '100%', height: '100%', minHeight: '420px', border: 'none', background: '#000' }}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          title="Video Player"
        />
      </div>

      <div className="server-row">
        <span className="server-label">السيرفرات:</span>
        {servers.map((srv) => (
          <button
            key={srv.id}
            type="button"
            className={`server-btn ${selectedServer === srv.id ? 'active' : ''}`}
            onClick={() => setSelectedServer(srv.id)}
          >
            {srv.name}
          </button>
        ))}
        <button type="button" className="server-btn watch-party-share" onClick={() => setShareOpen(true)}>
          🎬 مشاركة
        </button>
      </div>

      {shareOpen && (
        <div className="watch-party-modal-backdrop" onClick={() => setShareOpen(false)}>
          <div className="watch-party-modal" onClick={(e) => e.stopPropagation()}>
            <div className="watch-party-modal-head">
              <div>
                <strong>🎬 مشاهدة جماعية</strong>
                <small>اختر صديقًا أو مجموعة أصدقاء</small>
              </div>
              <button type="button" onClick={() => setShareOpen(false)}>×</button>
            </div>

            {shareError && <div className="watch-party-error">{shareError}</div>}

            <div className="watch-party-friends">
              {friends.length === 0 ? (
                <div className="watch-party-empty">لا يوجد أصدقاء متاحون للمشاركة.</div>
              ) : friends.map((friend) => {
                const checked = selectedFriends.includes(friend.id);
                const name = friend.display_name || friend.full_name || friend.username || 'مستخدم';
                return (
                  <button
                    type="button"
                    key={friend.id}
                    className={`watch-party-friend ${checked ? 'selected' : ''}`}
                    onClick={() => toggleFriend(friend.id)}
                  >
                    <div
                      className="watch-party-avatar"
                      style={friend.avatar_url ? { backgroundImage: `url(${friend.avatar_url})` } : undefined}
                    >
                      {!friend.avatar_url && name.charAt(0).toUpperCase()}
                    </div>
                    <span>{name}</span>
                    <span className="watch-party-check">{checked ? '✓' : ''}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="watch-party-start"
              disabled={!selectedFriends.length || sharing}
              onClick={shareParty}
            >
              {sharing ? 'جاري الإرسال...' : `بدء المشاهدة الجماعية${selectedFriends.length ? ` (${selectedFriends.length})` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

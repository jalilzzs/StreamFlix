import {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchFriends,
  createWatchPartyWithInvites,
  sendMessage,
} from '../lib/api';

/* =========================================================
   UPDATED VIDEO SOURCES & BASE URLS
   ========================================================= */

const VIDSRC_BASE_URL = 'https://vidsrc.xyz';
const VIDBINGE_BASE_URL = 'https://vidsrc.pro';
const AUTOEMBED_BASE_URL = 'https://player.autoembed.cc';
const BACKEND_URL = 'https://streamflix-api-x0ku.onrender.com';

/* =========================================================
   URL BUILDERS
   ========================================================= */

function getVidsrcMovieUrl(tmdbId) {
  if (!tmdbId) return null;
  return `${VIDSRC_BASE_URL}/embed/movie/${encodeURIComponent(tmdbId)}`;
}

function getVidsrcEpisodeUrl(tmdbId, season, episode) {
  if (!tmdbId) return null;
  return `${VIDSRC_BASE_URL}/embed/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
}

function getVidbingeMovieUrl(tmdbId) {
  if (!tmdbId) return null;
  return `${VIDBINGE_BASE_URL}/embed/movie/${encodeURIComponent(tmdbId)}`;
}

function getVidbingeEpisodeUrl(tmdbId, season, episode) {
  if (!tmdbId) return null;
  return `${VIDBINGE_BASE_URL}/embed/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
}

function getAutoEmbedMovieUrl(tmdbId) {
  if (!tmdbId) return null;
  return `${AUTOEMBED_BASE_URL}/embed/movie/${encodeURIComponent(tmdbId)}`;
}

function getAutoEmbedEpisodeUrl(tmdbId, season, episode) {
  if (!tmdbId) return null;
  return `${AUTOEMBED_BASE_URL}/embed/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function VideoPlayer({
  tmdbId,
  type = 'movie',
  title,
  episodeId = null,
}) {
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();

  const [selectedServer, setSelectedServer] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);

  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [activePirateQuery, setActivePirateQuery] = useState('');

  // حالات جديدة خاصة بسيرفر التورنت (Client-Side Torrent Engine)
  const [torrentStreams, setTorrentStreams] = useState([]);
  const [loadingTorrent, setLoadingTorrent] = useState(false);
  const [torrentError, setTorrentError] = useState('');

  const hasVipAccess = Boolean(isPremium);
  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId || null;

  const contentType =
    type === 'series' ||
    type === 'tv' ||
    title?.type === 'series' ||
    title?.type === 'tv'
      ? 'tv'
      : 'movie';

  const currentEpisodeId = episodeId || title?.current_episode_id || title?.episode_id || null;
  const currentSeason = Number(title?.current_season || title?.season || 1);
  const currentEpisodeNumber = Number(title?.current_episode_number || title?.episode_number || 1);

  const defaultTitleName = title?.name || title?.title || '';

  useEffect(() => {
    setCustomSearchQuery(defaultTitleName);
    setActivePirateQuery(defaultTitleName);
  }, [defaultTitleName]);

  /* =========================================================
     CLIENT-SIDE TORRENT FETCHING (تجاوز الحظر كلياً)
     ========================================================= */
  useEffect(() => {
    if (selectedServer !== 1 || !activePirateQuery) return;

    let isMounted = true;
    async function fetchTorrentsDirectly() {
      setLoadingTorrent(true);
      setTorrentError('');
      setTorrentStreams([]);

      try {
        // 1. طلب الـ IMDb ID من الباك إند
        const resId = await fetch(`${BACKEND_URL}/api/get-id?q=${encodeURIComponent(activePirateQuery)}&type=${contentType}`);
        const dataId = await resId.json();

        if (!dataId.success || !dataId.imdbId) {
          if (isMounted) {
            setTorrentError('لم يتم العثور على معرف الفيلم/المسلسل');
            setLoadingTorrent(false);
          }
          return;
        }

        const imdbId = dataId.imdbId;

        // 2. طلب الروابط مباشرة من هاتف/متصفح المستخدم عبر Torrentio
        let torrentioUrl = `https://torrentio.strem.fun/stream/movie/${imdbId}.json`;
        if (contentType === 'tv') {
          torrentioUrl = `https://torrentio.strem.fun/stream/series/${imdbId}:${currentSeason}:${currentEpisodeNumber}.json`;
        }

        const resStreams = await fetch(torrentioUrl);
        const dataStreams = await resStreams.json();

        if (isMounted) {
          if (dataStreams.streams && dataStreams.streams.length > 0) {
            setTorrentStreams(dataStreams.streams.slice(0, 10));
          } else {
            setTorrentError('لا توجد روابط تورنت متاحة لهذا العنوان حالياً');
          }
        }
      } catch (err) {
        if (isMounted) setTorrentError('تعذر جلب التورنت مباشرة من الشبكة');
      } finally {
        if (isMounted) setLoadingTorrent(false);
      }
    }

    fetchTorrentsDirectly();

    return () => { isMounted = false; };
  }, [selectedServer, activePirateQuery, contentType, currentSeason, currentEpisodeNumber]);

  /* =========================================================
     SERVER URL GENERATORS
     ========================================================= */

  const server1Url = useMemo(() => {
    if (!realTmdb) return null;
    return contentType === 'movie'
      ? getVidsrcMovieUrl(realTmdb)
      : getVidsrcEpisodeUrl(realTmdb, currentSeason, currentEpisodeNumber);
  }, [realTmdb, contentType, currentSeason, currentEpisodeNumber]);

  const server3Url = useMemo(() => {
    if (!realTmdb) return null;
    return contentType === 'movie'
      ? getVidbingeMovieUrl(realTmdb)
      : getVidbingeEpisodeUrl(realTmdb, currentSeason, currentEpisodeNumber);
  }, [realTmdb, contentType, currentSeason, currentEpisodeNumber]);

  const server4Url = useMemo(() => {
    if (!realTmdb) return null;
    return contentType === 'movie'
      ? getAutoEmbedMovieUrl(realTmdb)
      : getAutoEmbedEpisodeUrl(realTmdb, currentSeason, currentEpisodeNumber);
  }, [realTmdb, contentType, currentSeason, currentEpisodeNumber]);

  const servers = useMemo(
    () => [
      { id: 0, name: 'سيرفر 1', provider: 'Vidsrc', url: server1Url, vip: false, isIframe: true },
      { id: 1, name: 'سيرفر 2', provider: 'Torrent Engine', url: 'torrent-direct', vip: false, isIframe: false },
      { id: 2, name: 'سيرفر 3', provider: 'Vidbinge (بدون إعلانات)', url: server3Url, vip: false, isIframe: true },
      { id: 3, name: 'سيرفر 4', provider: 'AutoEmbed', url: server4Url, vip: false, isIframe: true },
    ],
    [server1Url, server3Url, server4Url]
  );

  const currentServer = servers[selectedServer] || servers[0];

  useEffect(() => {
    if (currentServer?.vip && !hasVipAccess) {
      setSelectedServer(0);
      return;
    }

    if (currentServer?.url) return;

    const firstAvailable = servers.find(
      (server) => Boolean(server.url) && (!server.vip || hasVipAccess)
    );

    if (firstAvailable && firstAvailable.id !== selectedServer) {
      setSelectedServer(firstAvailable.id);
    }
  }, [currentServer?.vip, currentServer?.url, hasVipAccess, selectedServer, servers]);

  useEffect(() => {
    setError('');
  }, [selectedServer, realTmdb, currentSeason, currentEpisodeNumber, currentEpisodeId]);

  useEffect(() => {
    if (!shareOpen || !user?.id) return;
    let cancelled = false;

    async function loadFriends() {
      try {
        setLoadingFriends(true);
        setError('');
        const result = await fetchFriends(user.id);
        if (!cancelled) setFriends(result || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذر جلب قائمة الأصدقاء');
      } finally {
        if (!cancelled) setLoadingFriends(false);
      }
    }

    loadFriends();
    return () => { cancelled = true; };
  }, [shareOpen, user?.id]);

  const toggleFriend = useCallback((friendId) => {
    setSelectedFriends((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId]
    );
  }, []);

  function handleServerClick(server) {
    if (server.vip && !hasVipAccess) {
      setError('');
      setVipModalOpen(true);
      return;
    }

    if (!server.url) {
      setError('لا يوجد رابط لهذا السيرفر');
      return;
    }

    setError('');
    setSelectedServer(server.id);
  }

  const handlePirateSearchSubmit = (e) => {
    e.preventDefault();
    if (!customSearchQuery.trim()) return;
    setActivePirateQuery(customSearchQuery.trim());
    setSelectedServer(1);
  };

  async function createParty() {
    if (!user?.id) {
      setError('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!title?.id) {
      setError('هذا المحتوى لا يملك معرفًا صالحًا في قاعدة البيانات');
      return;
    }

    if (!selectedFriends.length) {
      setError('اختر صديقًا واحدًا على الأقل');
      return;
    }

    try {
      setSharing(true);
      setError('');

      const partyResult = await createWatchPartyWithInvites({
        hostId: user.id,
        titleId: title.id,
        episodeId: currentEpisodeId,
        friendIds: selectedFriends,
      });

      const party = partyResult?.party;
      if (!party?.id) throw new Error('لم يتم إنشاء غرفة المشاهدة');

      const metadata = {
        name: title?.name || title?.title || 'مشاهدة جماعية',
        poster_url: title?.poster_url || title?.poster || title?.image_url || title?.backdrop_url || null,
        release_year: title?.release_year || title?.year || null,
        rating_avg: title?.rating_avg || title?.rating || null,
        type: contentType === 'tv' ? 'series' : 'movie',
        tmdb_id: realTmdb,
        episode_id: currentEpisodeId,
        season: contentType === 'tv' ? currentSeason : null,
        episode_number: contentType === 'tv' ? currentEpisodeNumber : null,
        server: selectedServer,
        server_provider: currentServer?.provider || null,
        watch_party: true,
      };

      await Promise.all(
        selectedFriends.map((friendId) =>
          sendMessage({
            senderId: user.id,
            receiverId: friendId,
            kind: 'title_share',
            content: metadata.name,
            sharedTitleId: title.id,
            sharedPartyId: party.id,
            metadata,
          })
        )
      );

      setSelectedFriends([]);
      setShareOpen(false);
      navigate(`/watch-party/${party.id}`);
    } catch (err) {
      setError(err?.message || 'تعذر إنشاء دعوة المشاهدة');
    } finally {
      setSharing(false);
    }
  }

  if (!realTmdb) {
    return (
      <div style={{ width: '100%', background: '#000', color: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ minHeight: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
          لا يوجد TMDB ID لهذا المحتوى
        </div>
      </div>
    );
  }

  const playerKey = `${selectedServer}-${currentServer?.provider}-${realTmdb}-${contentType}-${currentSeason}-${currentEpisodeNumber}-${currentEpisodeId || ''}-${activePirateQuery}`;

  return (
    <div style={{ width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', color: '#fff', direction: 'rtl', position: 'relative' }}>
      
      {/* PLAYER SECTION */}
      <div style={{ position: 'relative', width: '100%', minHeight: '420px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentServer?.isIframe && currentServer?.url ? (
          <iframe
            key={playerKey}
            src={currentServer.url}
            style={{ width: '100%', height: '420px', border: 'none', background: '#000' }}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            title={`${currentServer.provider} External Player`}
          />
        ) : (
          /* واجهة سيرفر 2 الحية والخاصة بالتورنت */
          <div style={{ width: '100%', minHeight: '420px', padding: '20px', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#d4af37' }}>🏴‍☠️ Torrent Direct Engine</div>
            
            {loadingTorrent ? (
              <div style={{ color: '#aaa', fontSize: '14px' }}>جاري البحث المباشر عن روابط التورنت...</div>
            ) : torrentError ? (
              <div style={{ color: '#ff6b6b', fontSize: '13px' }}>{torrentError}</div>
            ) : torrentStreams.length > 0 ? (
              <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
                {torrentStreams.map((s, idx) => {
                  const magnetUrl = `magnet:?xt=urn:btih:${s.infoHash}&dn=${encodeURIComponent(activePirateQuery)}`;
                  return (
                    <div key={idx} style={{ padding: '12px', background: '#141414', border: '1px solid #282828', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '75%' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{s.name || 'جودة عالية'}</span>
                        <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                      </div>
                      <a
                        href={magnetUrl}
                        style={{ padding: '8px 14px', background: '#d4af37', color: '#000', borderRadius: '6px', textDecoration: 'none', fontWeight: 900, fontSize: '12px' }}
                      >
                        تشغيل Magnet 🧲
                      </a>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#888', fontSize: '12px' }}>أدخل اسم المحتوى بالأسفل لبدء التوليد.</div>
            )}
          </div>
        )}
      </div>

      {/* SERVERS & SHARE CONTROLS */}
      <div style={{ padding: '12px 15px', background: '#111', borderTop: '1px solid #222', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: '#aaa' }}>السيرفرات:</span>

        {servers.map((server) => {
          const available = Boolean(server.url);
          const locked = server.vip && !hasVipAccess;
          const active = selectedServer === server.id && !locked;

          return (
            <button
              key={server.id}
              type="button"
              disabled={!available}
              onClick={() => handleServerClick(server)}
              style={{
                border: active ? '1px solid #d4af37' : '1px solid #333',
                background: active ? '#d4af37' : '#181818',
                color: active ? '#111' : available ? '#ddd' : '#555',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: available ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {server.name}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => { setError(''); setShareOpen(true); }}
          style={{ border: '1px solid #d4af37', background: 'linear-gradient(135deg,#d4af37,#b89222)', color: '#111', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 900 }}
        >
          🎬 مشاركة
        </button>
      </div>

      {/* PIRATE BAY MANUAL SEARCH INPUT */}
      <div style={{ padding: '10px 15px', background: '#181818', borderTop: '1px solid #282828', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handlePirateSearchSubmit} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '500px' }}>
          <input
            type="text"
            value={customSearchQuery}
            onChange={(e) => setCustomSearchQuery(e.target.value)}
            placeholder="أدخل اسم الفيلم/المسلسل بالإنجليزية لسيرفر التورنت..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #333',
              background: '#0d0d0d',
              color: '#fff',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#d4af37',
              color: '#111',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            بحث وتوليد
          </button>
        </form>
      </div>

      {/* SHARE MODAL & VIP MODAL (KEEP UNCHANGED) */}
      {vipModalOpen && (
        <div onClick={() => setVipModalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '410px', background: '#171717', border: '1px solid rgba(255,215,0,.3)', borderRadius: '20px', padding: '28px 22px', textAlign: 'center', color: '#fff' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900 }}>هذا السيرفر خاص بـ VIP</h3>
            <button type="button" onClick={() => setVipModalOpen(false)} style={{ width: '100%', marginTop: '10px', padding: '11px', border: '1px solid #333', borderRadius: '11px', background: '#171717', color: '#aaa', cursor: 'pointer' }}>إغلاق</button>
          </div>
        </div>
      )}

      {shareOpen && (
        <div onClick={() => !sharing && setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '470px', background: '#151515', border: '1px solid rgba(212,175,55,.25)', borderRadius: '18px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>🎬 مشاركة المشاهدة</h3>
              <button type="button" disabled={sharing} onClick={() => setShareOpen(false)} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            {/* بقية نافذة المشاركة كما هي */}
            <button type="button" onClick={createParty} disabled={sharing || selectedFriends.length === 0} style={{ width: '100%', marginTop: '15px', padding: '13px', borderRadius: '10px', background: '#d4af37', color: '#111', fontWeight: 900, border: 'none', cursor: 'pointer' }}>
              إرسال الدعوة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

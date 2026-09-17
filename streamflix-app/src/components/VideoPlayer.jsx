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
   VIDEO SOURCES & BASE URLS
   ========================================================= */

const VIDSRC_BASE_URL = 'https://vidsrc.me';
const VIDBINGE_BASE_URL = 'https://vidbinge.dev';
const AUTOEMBED_BASE_URL = 'https://autoembed.cc';
const BACKEND_URL = 'https://streamflix-api-x0ku.onrender.com';

/* =========================================================
   URL BUILDERS
   ========================================================= */

// 1. Vidsrc
function getVidsrcMovieUrl(tmdbId) {
  if (!tmdbId) return null;
  return `${VIDSRC_BASE_URL}/embed/movie?tmdb=${encodeURIComponent(tmdbId)}`;
}

function getVidsrcEpisodeUrl(tmdbId, season, episode) {
  if (!tmdbId) return null;
  return `${VIDSRC_BASE_URL}/embed/tv?tmdb=${encodeURIComponent(tmdbId)}&season=${encodeURIComponent(season)}&episode=${encodeURIComponent(episode)}`;
}

// 2. Vidbinge (بدون إعلانات)
function getVidbingeMovieUrl(tmdbId) {
  if (!tmdbId) return null;
  return `${VIDBINGE_BASE_URL}/embed/movie/${encodeURIComponent(tmdbId)}`;
}

function getVidbingeEpisodeUrl(tmdbId, season, episode) {
  if (!tmdbId) return null;
  return `${VIDBINGE_BASE_URL}/embed/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
}

// 3. AutoEmbed
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

  // حالات التورنت السيرفر الثاني
  const [torrentStreams, setTorrentStreams] = useState([]);
  const [loadingTorrent, setLoadingTorrent] = useState(false);
  const [torrentError, setTorrentError] = useState('');

  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  /* =========================================================
     PREMIUM STATUS
     ========================================================= */

  const hasVipAccess = Boolean(isPremium);

  /* =========================================================
     REAL TMDB ID & METADATA
     ========================================================= */

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

  const contentTitleName = title?.name || title?.title || '';

  /* =========================================================
     SERVER URL GENERATORS
     ========================================================= */

  // سيرفر 1: Vidsrc
  const server1Url = useMemo(() => {
    if (!realTmdb) return null;
    return contentType === 'movie'
      ? getVidsrcMovieUrl(realTmdb)
      : getVidsrcEpisodeUrl(realTmdb, currentSeason, currentEpisodeNumber);
  }, [realTmdb, contentType, currentSeason, currentEpisodeNumber]);

  // سيرفر 3: Vidbinge
  const server3Url = useMemo(() => {
    if (!realTmdb) return null;
    return contentType === 'movie'
      ? getVidbingeMovieUrl(realTmdb)
      : getVidbingeEpisodeUrl(realTmdb, currentSeason, currentEpisodeNumber);
  }, [realTmdb, contentType, currentSeason, currentEpisodeNumber]);

  // سيرفر 4: AutoEmbed
  const server4Url = useMemo(() => {
    if (!realTmdb) return null;
    return contentType === 'movie'
      ? getAutoEmbedMovieUrl(realTmdb)
      : getAutoEmbedEpisodeUrl(realTmdb, currentSeason, currentEpisodeNumber);
  }, [realTmdb, contentType, currentSeason, currentEpisodeNumber]);

  /* =========================================================
     SERVERS LIST
     ========================================================= */

  const servers = useMemo(
    () => [
      { id: 0, name: 'سيرفر 1', provider: 'Vidsrc', url: server1Url, vip: false, isIframe: true, useSandbox: false },
      { id: 1, name: 'سيرفر 2', provider: 'Pirate Bay Torrent', url: 'torrent_provider', vip: false, isIframe: false, useSandbox: false },
      { id: 2, name: 'سيرفر 3', provider: 'Vidbinge (بدون إعلانات)', url: server3Url, vip: false, isIframe: true, useSandbox: false },
      { id: 3, name: 'سيرفر 4', provider: 'AutoEmbed', url: server4Url, vip: false, isIframe: true, useSandbox: false },
    ],
    [server1Url, server3Url, server4Url]
  );

  const currentServer = servers[selectedServer] || servers[0];

  /* =========================================================
     FETCH TORRENT DATA (SERVER 2)
     ========================================================= */

  const fetchTorrentData = useCallback(async () => {
    if (!contentTitleName) return;

    setLoadingTorrent(true);
    setTorrentError('');
    setTorrentStreams([]);

    try {
      // إعداد نص البحث باسم الفيلم أو المسلسل مع الموسم والحلقة
      let searchQuery = contentTitleName;
      if (contentType === 'tv') {
        const s = currentSeason < 10 ? `S0${currentSeason}` : `S${currentSeason}`;
        const e = currentEpisodeNumber < 10 ? `E0${currentEpisodeNumber}` : `E${currentEpisodeNumber}`;
        searchQuery = `${contentTitleName} ${s}${e}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/torrent-search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        setTorrentStreams(data.results);
      } else {
        setTorrentError('لم يتم العثور على روابط تورنت لهذا المحتوى');
      }
    } catch (err) {
      console.error('Torrent Fetch Error:', err);
      setTorrentError('حدث خطأ أثناء جلب روابط التورنت من السيرفر');
    } finally {
      setLoadingTorrent(false);
    }
  }, [contentTitleName, contentType, currentSeason, currentEpisodeNumber]);

  useEffect(() => {
    if (selectedServer === 1) {
      fetchTorrentData();
    }
  }, [selectedServer, fetchTorrentData]);

  /* =========================================================
     AUTO FALLBACK & AUTO-CORRECT
     ========================================================= */

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

  /* =========================================================
     RESET ERROR ON CHANGE
     ========================================================= */

  useEffect(() => {
    setError('');
  }, [selectedServer, realTmdb, currentSeason, currentEpisodeNumber, currentEpisodeId]);

  /* =========================================================
     LOAD FRIENDS
     ========================================================= */

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

    return () => {
      cancelled = true;
    };
  }, [shareOpen, user?.id]);

  /* =========================================================
     HANDLERS
     ========================================================= */

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

  /* =========================================================
     WATCH PARTY CREATION
     ========================================================= */

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

      if (!party?.id) {
        throw new Error('لم يتم إنشاء غرفة المشاهدة');
      }

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
      console.error('Watch Party creation error:', err);
      setError(err?.message || 'تعذر إنشاء دعوة المشاهدة');
    } finally {
      setSharing(false);
    }
  }

  /* =========================================================
     NO TMDB GUARD
     ========================================================= */

  if (!realTmdb) {
    return (
      <div style={{ width: '100%', background: '#000', color: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ minHeight: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
          لا يوجد TMDB ID لهذا المحتوى
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER
     ========================================================= */

  const playerKey = `${selectedServer}-${currentServer?.provider}-${realTmdb}-${contentType}-${currentSeason}-${currentEpisodeNumber}-${currentEpisodeId || ''}`;

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
            referrerPolicy="no-referrer"
            {...(currentServer.useSandbox ? { sandbox: "allow-scripts allow-same-origin allow-forms allow-presentation" } : {})}
            title={`${currentServer.provider} External Player`}
          />
        ) : (
          /* واجهة سيرفر التورنت (Pirate Bay Engine) */
          <div style={{ width: '100%', minHeight: '420px', background: '#0a0a0a', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏴‍☠️</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#ffd700', marginBottom: '4px' }}>Pirate Bay Engine</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px', textAlign: 'center' }}>
              البحث المباشر باسم المحتوى عبر التورنت والـ Magnet Links
            </div>

            {loadingTorrent ? (
              <div style={{ color: '#d4af37', fontSize: '14px', fontWeight: 700 }}>جاري جلب روابط التورنت... 🔄</div>
            ) : torrentError ? (
              <div style={{ color: '#ff6b6b', fontSize: '13px', textAlign: 'center' }}>{torrentError}</div>
            ) : torrentStreams.length > 0 ? (
              <div style={{ width: '100%', maxWidth: '600px', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                {torrentStreams.map((torrent, index) => (
                  <div key={index} style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {torrent.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', display: 'flex', gap: '12px' }}>
                        <span> الحجم: <strong style={{ color: '#aaa' }}>{torrent.size}</strong></span>
                        <span style={{ color: '#4caf50' }}>▲ {torrent.seeders} Seeders</span>
                        <span style={{ color: '#ff9800' }}>▼ {torrent.leechers} Leechers</span>
                      </div>
                    </div>
                    {torrent.magnet && (
                      <a
                        href={torrent.magnet}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #ffd700, #b8860b)', color: '#111', borderRadius: '6px', textDecoration: 'none', fontWeight: 900, fontSize: '12px', whiteSpace: 'nowrap' }}
                      >
                        🧲 تشغيل / Magnet
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
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
                position: 'relative',
                minWidth: server.vip ? '125px' : 'auto',
                border: active
                  ? server.vip ? '1px solid #ffd700' : '1px solid #d4af37'
                  : server.vip ? '1px solid rgba(255,215,0,.45)' : '1px solid #333',
                background: active
                  ? server.vip ? 'linear-gradient(135deg,#ffd700,#d4af37)' : '#d4af37'
                  : server.vip ? '#181818' : '#181818',
                color: active ? '#111' : locked ? '#ffd700' : available ? '#ddd' : '#555',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: locked ? 'pointer' : available ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: 700,
                opacity: available ? 1 : 0.55,
              }}
            >
              {server.vip && <span style={{ marginLeft: '5px' }}>⭐</span>}
              {server.name}
              {server.vip && (
                <span style={{ marginRight: '6px', fontSize: '10px', opacity: locked ? 1 : 0.85 }}>
                  {locked ? '🔒' : '👑'}
                </span>
              )}
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

      {/* VIP LOCK MODAL */}
      {vipModalOpen && (
        <div onClick={() => setVipModalOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '410px', background: 'linear-gradient(145deg,#171717,#0c0c0c)', border: '1px solid rgba(255,215,0,.3)', borderRadius: '20px', padding: '28px 22px', textAlign: 'center', color: '#fff', boxShadow: '0 25px 100px rgba(0,0,0,.7), 0 0 45px rgba(255,215,0,.08)' }}>
            <div style={{ width: '70px', height: '70px', margin: '0 auto 15px', borderRadius: '20px', background: 'linear-gradient(135deg,#ffd700,#b8860b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px', boxShadow: '0 10px 30px rgba(255,215,0,.2)' }}>⭐</div>
            <div style={{ color: '#ffd700', fontSize: '11px', fontWeight: 900, letterSpacing: '1px', marginBottom: '8px' }}>VIP SERVER</div>
            <h3 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900 }}>هذا السيرفر خاص بـ VIP</h3>
            <p style={{ margin: 0, color: '#999', fontSize: '13px', lineHeight: 1.7 }}>متاح فقط للمشتركين في باقة VIP.</p>
            <button type="button" onClick={() => { setVipModalOpen(false); navigate('/subscription'); }} style={{ width: '100%', marginTop: '20px', padding: '13px', border: 'none', borderRadius: '11px', background: 'linear-gradient(135deg,#ffd700,#b8860b)', color: '#171100', fontWeight: 900, cursor: 'pointer', fontSize: '13px' }}>⭐ اشترك في VIP</button>
            <button type="button" onClick={() => setVipModalOpen(false)} style={{ width: '100%', marginTop: '8px', padding: '11px', border: '1px solid #333', borderRadius: '11px', background: '#171717', color: '#aaa', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>إغلاق</button>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {shareOpen && (
        <div onClick={() => !sharing && setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '470px', maxHeight: '85vh', overflowY: 'auto', background: '#151515', border: '1px solid rgba(212,175,55,.25)', borderRadius: '18px', padding: '20px', boxShadow: '0 25px 80px rgba(0,0,0,.55)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <div style={{ color: '#d4af37', fontSize: '11px', fontWeight: 900, letterSpacing: '1px', marginBottom: '5px' }}>WATCH PARTY</div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '20px' }}>🎬 مشاركة المشاهدة</h3>
              </div>
              <button type="button" disabled={sharing} onClick={() => setShareOpen(false)} style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid #333', background: '#222', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '13px', background: '#0e0e0e', border: '1px solid #292929', marginBottom: '15px' }}>
              {(title?.poster_url || title?.poster || title?.image_url) ? (
                <img src={title.poster_url || title.poster || title.image_url} alt="" style={{ width: '58px', height: '82px', objectFit: 'cover', borderRadius: '8px' }} />
              ) : (
                <div style={{ width: '58px', height: '82px', borderRadius: '8px', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '25px' }}>🎬</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5px' }}>
                <strong style={{ color: '#fff', fontSize: '15px' }}>{contentTitleName || 'المحتوى الحالي'}</strong>
                <span style={{ color: '#888', fontSize: '12px' }}>{contentType === 'tv' ? `مسلسل • موسم ${currentSeason} • حلقة ${currentEpisodeNumber}` : 'فيلم'}</span>
                <span style={{ color: '#666', fontSize: '10px', direction: 'ltr' }}>
                  {currentServer?.provider || ''}
                </span>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 12px', marginBottom: '12px', borderRadius: '999px', background: 'rgba(220,60,60,.1)', border: '1px solid rgba(220,60,60,.3)', color: '#ff8585', fontSize: '12px' }}>{error}</div>
            )}

            <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>اختر الأصدقاء:</div>

            {loadingFriends ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>جاري جلب الأصدقاء...</div>
            ) : friends.length === 0 ? (
              <div style={{ padding: '25px', textAlign: 'center', color: '#888', background: '#101010', borderRadius: '12px' }}>لا يوجد أصدقاء متاحون للمشاركة.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', maxHeight: '300px', overflowY: 'auto' }}>
                {friends.map((friend) => {
                  const selected = selectedFriends.includes(friend.id);
                  const name = friend.display_name || friend.full_name || friend.username || 'مستخدم';

                  return (
                    <button key={friend.id} type="button" onClick={() => toggleFriend(friend.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '10px', border: selected ? '1px solid #d4af37' : '1px solid #292929', background: selected ? 'rgba(212,175,55,.08)' : '#101010', color: '#fff', cursor: 'pointer', textAlign: 'right' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: '#252525', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontWeight: 900 }}>
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span style={{ flex: 1, fontSize: '13px' }}>{name}</span>
                      <span style={{ width: '23px', height: '23px', borderRadius: '50%', border: selected ? '1px solid #d4af37' : '1px solid #444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontWeight: 900 }}>
                        {selected ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              disabled={sharing || selectedFriends.length === 0}
              onClick={createParty}
              style={{ width: '100%', marginTop: '15px', padding: '13px', border: 'none', borderRadius: '10px', background: selectedFriends.length && !sharing ? '#d4af37' : '#333', color: selectedFriends.length && !sharing ? '#111' : '#777', cursor: selectedFriends.length && !sharing ? 'pointer' : 'not-allowed', fontWeight: 900, fontSize: '13px' }}
            >
              {sharing ? 'جاري إرسال الدعوة...' : selectedFriends.length ? `إرسال الدعوة إلى ${selectedFriends.length} صديق` : 'اختر صديقًا أولاً'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

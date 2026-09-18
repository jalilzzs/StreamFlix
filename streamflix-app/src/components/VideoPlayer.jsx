import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchFriends,
  createWatchPartyWithInvites,
  sendMessage,
} from '../lib/api';

/* =========================================================
   VIDEO SOURCES (المشغلات النظيفة والبديلة)[span_14](start_span)[span_14](end_span)
   ========================================================= */

const VIDLINK_BASE_URL = 'https://vidlink.pro';[span_15](start_span)[span_15](end_span)
const AUTOEMBED_BASE_URL = 'https://player.autoembed.cc';[span_16](start_span)[span_16](end_span)
const SUPEREMBED_BASE_URL = 'https://multiembed.mov';[span_17](start_span)[span_17](end_span)
const VIDSRC_BASE_URL = 'https://vidsrc.me';
const STELLAR_BASE_URL = 'https://stellar.rip';
const YAPGRID_BASE_URL = 'https://yapgrid.com';

/* =========================================================
   URL BUILDERS
   ========================================================= */

function getVidlinkUrl(tmdbId, type, season, episode) {
  if (!tmdbId) return null;
  return type === 'movie'
    ? `${VIDLINK_BASE_URL}/movie/${encodeURIComponent(tmdbId)}`
    : `${VIDLINK_BASE_URL}/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
}

function getAutoembedUrl(tmdbId, type, season, episode) {
  if (!tmdbId) return null;
  return type === 'movie'
    ? `${AUTOEMBED_BASE_URL}/embed/movie/${encodeURIComponent(tmdbId)}`
    : `${AUTOEMBED_BASE_URL}/embed/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
}

function getSuperembedUrl(tmdbId, type, season, episode) {
  if (!tmdbId) return null;
  return type === 'movie'
    ? `${SUPEREMBED_BASE_URL}/directstream.php?video_id=${encodeURIComponent(tmdbId)}&tmdb=1`
    : `${SUPEREMBED_BASE_URL}/directstream.php?video_id=${encodeURIComponent(tmdbId)}&tmdb=1&s=${encodeURIComponent(season)}&e=${encodeURIComponent(episode)}`;
}

function getVidsrcUrl(tmdbId, type, season, episode) {
  if (!tmdbId) return null;
  return type === 'movie'
    ? `${VIDSRC_BASE_URL}/embed/movie?tmdb=${encodeURIComponent(tmdbId)}`
    : `${VIDSRC_BASE_URL}/embed/tv?tmdb=${encodeURIComponent(tmdbId)}&season=${encodeURIComponent(season)}&episode=${encodeURIComponent(episode)}`;
}

function getStellarUrl(tmdbId, type, season, episode) {
  if (!tmdbId) return null;
  return type === 'movie'
    ? `${STELLAR_BASE_URL}/en/watch/embed/movie/${encodeURIComponent(tmdbId)}`
    : `${STELLAR_BASE_URL}/en/watch/embed/tv/${encodeURIComponent(tmdbId)}-${encodeURIComponent(season)}-${encodeURIComponent(episode)}`;
}

function getYapgridUrl(tmdbId, type, season, episode) {
  if (!tmdbId) return null;
  return type === 'movie'
    ? `${YAPGRID_BASE_URL}/embed/movie/${encodeURIComponent(tmdbId)}?server=x`
    : `${YAPGRID_BASE_URL}/embed/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}?server=x`;
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

  const hasVipAccess = Boolean(isPremium);

  const realTmdb = tmdbId || title?.tmdb_id || title?.tmdbId || null;

  const contentType =
    type === 'series' || type === 'tv' || title?.type === 'series' || title?.type === 'tv'
      ? 'tv'
      : 'movie';

  const currentEpisodeId = episodeId || title?.current_episode_id || title?.episode_id || null;
  const currentSeason = Number(title?.current_season || title?.season || 1);
  const currentEpisodeNumber = Number(title?.current_episode_number || title?.episode_number || 1);

  /* =========================================================
     SERVERS CONFIGURATION (تحديث القائمة بناءً على التوصيات)[span_18](start_span)[span_18](end_span)
     ========================================================= */

  const servers = useMemo(() => [
    {
      id: 0,
      name: 'VidLink (سريع بدون إعلانات)',[span_19](start_span)[span_19](end_span)
      provider: 'VidLink',[span_20](start_span)[span_20](end_span)
      url: getVidlinkUrl(realTmdb, contentType, currentSeason, currentEpisodeNumber),
      vip: false,
    },
    {
      id: 1,
      name: 'AutoEmbed (تلقائي)',[span_21](start_span)[span_21](end_span)
      provider: 'AutoEmbed',[span_22](start_span)[span_22](end_span)
      url: getAutoembedUrl(realTmdb, contentType, currentSeason, currentEpisodeNumber),
      vip: false,
    },
    {
      id: 2,
      name: 'SuperEmbed / 2Embed',[span_23](start_span)[span_23](end_span)
      provider: 'SuperEmbed',[span_24](start_span)[span_24](end_span)
      url: getSuperembedUrl(realTmdb, contentType, currentSeason, currentEpisodeNumber),
      vip: false,
    },
    {
      id: 3,
      name: 'VidSrc',
      provider: 'VidSrc',
      url: getVidsrcUrl(realTmdb, contentType, currentSeason, currentEpisodeNumber),
      vip: false,
    },
    {
      id: 4,
      name: 'Stellar',
      provider: 'Stellar',
      url: getStellarUrl(realTmdb, contentType, currentSeason, currentEpisodeNumber),
      vip: false,
    },
    {
      id: 5,
      name: 'YapGrid VIP',
      provider: 'YapGrid',
      url: getYapgridUrl(realTmdb, contentType, currentSeason, currentEpisodeNumber),
      vip: true,
    },
  ], [realTmdb, contentType, currentSeason, currentEpisodeNumber]);

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
  }, [currentServer, selectedServer, servers, hasVipAccess]);

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

  function toggleFriend(friendId) {
    setSelectedFriends((current) =>
      current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId]
    );
  }

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

  async function createParty() {
    if (!user?.id) return setError('يجب تسجيل الدخول أولاً');
    if (!title?.id) return setError('هذا المحتوى لا يملك معرفًا صالحًا في قاعدة البيانات');
    if (!selectedFriends.length) return setError('اختر صديقًا واحدًا على الأقل');

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
      console.error('Watch Party creation error:', err);
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

  const playerKey = [
    selectedServer,
    currentServer?.provider || '',
    realTmdb,
    contentType,
    currentSeason,
    currentEpisodeNumber,
    currentEpisodeId || '',
    currentServer?.url || '',
  ].join('-');

  return (
    <div style={{ width: '100%', background: '#000', borderRadius: '8px', overflow: 'hidden', color: '#fff', direction: 'rtl', position: 'relative' }}>
      <div style={{ position: 'relative', width: '100%', minHeight: '420px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentServer?.url ? (
          <iframe
            key={playerKey}
            src={currentServer.url}
            style={{ width: '100%', height: '420px', border: 'none', background: '#000' }}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            title={`${currentServer.provider} External Player`}
          />
        ) : (
          <div style={{ minHeight: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#aaa', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '30px' }}>🎬</div>
            <div>لا يوجد رابط لهذا السيرفر</div>
            <div style={{ fontSize: '11px', color: '#666', direction: 'ltr' }}>{currentServer?.provider || 'Server'}</div>
          </div>
        )}
      </div>

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
                border: active ? (server.vip ? '1px solid #ffd700' : '1px solid #d4af37') : (server.vip ? '1px solid rgba(255,215,0,.45)' : '1px solid #333'),
                background: active ? (server.vip ? 'linear-gradient(135deg,#ffd700,#d4af37)' : '#d4af37') : (server.vip ? 'linear-gradient(135deg,#211b00,#181818)' : '#181818'),
                color: active ? '#111' : (locked ? '#ffd700' : (available ? '#ddd' : '#555')),
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: locked ? 'pointer' : (available ? 'pointer' : 'not-allowed'),
                fontSize: '12px',
                fontWeight: 700,
                opacity: available ? 1 : 0.55,
              }}
            >
              {server.vip && <span style={{ marginLeft: '5px' }}>⭐</span>}
              {server.name}
              {server.vip && <span style={{ marginRight: '6px', fontSize: '10px' }}>{locked ? '🔒' : '👑'}</span>}
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
    </div>
  );
}

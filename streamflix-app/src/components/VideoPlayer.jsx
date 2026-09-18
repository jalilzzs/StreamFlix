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
   VIDEO SOURCES
   ========================================================= */

const VIDSRC_BASE_URL =
  'https://vidsrc.me';

const STELLAR_BASE_URL =
  'https://stellar.rip';

const VIDLINK_BASE_URL =
  'https://vidlink.pro';

const YAPGRID_BASE_URL =
  'https://yapgrid.com';

/* =========================================================
   URL BUILDERS
   ========================================================= */

function getVidsrcMovieUrl(tmdbId) {
  if (!tmdbId) return null;

  return `${VIDSRC_BASE_URL}/embed/movie?tmdb=${encodeURIComponent(
    tmdbId
  )}`;
}

function getVidsrcEpisodeUrl(
  tmdbId,
  season,
  episode
) {
  if (!tmdbId) return null;

  return `${VIDSRC_BASE_URL}/embed/tv?tmdb=${encodeURIComponent(
    tmdbId
  )}&season=${encodeURIComponent(
    season
  )}&episode=${encodeURIComponent(
    episode
  )}`;
}

function getStellarMovieUrl(tmdbId) {
  if (!tmdbId) return null;

  return `${STELLAR_BASE_URL}/en/watch/embed/movie/${encodeURIComponent(
    tmdbId
  )}`;
}

function getStellarEpisodeUrl(
  tmdbId,
  season,
  episode
) {
  if (!tmdbId) return null;

  return `${STELLAR_BASE_URL}/en/watch/embed/tv/${encodeURIComponent(
    tmdbId
  )}-${encodeURIComponent(
    season
  )}-${encodeURIComponent(
    episode
  )}`;
}

function getVidlinkMovieUrl(tmdbId) {
  if (!tmdbId) return null;

  return `${VIDLINK_BASE_URL}/movie/${encodeURIComponent(
    tmdbId
  )}`;
}

function getVidlinkEpisodeUrl(
  tmdbId,
  season,
  episode
) {
  if (!tmdbId) return null;

  return `${VIDLINK_BASE_URL}/tv/${encodeURIComponent(
    tmdbId
  )}/${encodeURIComponent(
    season
  )}/${encodeURIComponent(
    episode
  )}`;
}

/* =========================================================
   YAPGRID
   VIP SERVER
   ========================================================= */

function getYapgridMovieUrl(tmdbId) {
  if (!tmdbId) return null;

  return `${YAPGRID_BASE_URL}/embed/movie/${encodeURIComponent(
    tmdbId
  )}?server=x`;
}

function getYapgridEpisodeUrl(
  tmdbId,
  season,
  episode
) {
  if (!tmdbId) return null;

  return `${YAPGRID_BASE_URL}/embed/tv/${encodeURIComponent(
    tmdbId
  )}/${encodeURIComponent(
    season
  )}/${encodeURIComponent(
    episode
  )}?server=x`;
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
  const {
    user,
    isPremium,
  } = useAuth();

  const navigate = useNavigate();

  const [
    selectedServer,
    setSelectedServer,
  ] = useState(0);

  const [
    shareOpen,
    setShareOpen,
  ] = useState(false);

  const [
    vipModalOpen,
    setVipModalOpen,
  ] = useState(false);

  const [
    friends,
    setFriends,
  ] = useState([]);

  const [
    selectedFriends,
    setSelectedFriends,
  ] = useState([]);

  const [
    loadingFriends,
    setLoadingFriends,
  ] = useState(false);

  const [
    sharing,
    setSharing,
  ] = useState(false);

  const [error, setError] =
    useState('');

  /* =========================================================
     PREMIUM STATUS
     ========================================================= */

  const hasVipAccess =
    Boolean(isPremium);

  /* =========================================================
     REAL TMDB ID
     ========================================================= */

  const realTmdb =
    tmdbId ||
    title?.tmdb_id ||
    title?.tmdbId ||
    null;

  /* =========================================================
     CONTENT TYPE
     ========================================================= */

  const contentType =
    type === 'series' ||
    type === 'tv' ||
    title?.type === 'series' ||
    title?.type === 'tv'
      ? 'tv'
      : 'movie';

  /* =========================================================
     EPISODE DATA
     ========================================================= */

  const currentEpisodeId =
    episodeId ||
    title?.current_episode_id ||
    title?.episode_id ||
    null;

  const currentSeason = Number(
    title?.current_season ||
      title?.season ||
      1
  );

  const currentEpisodeNumber =
    Number(
      title?.current_episode_number ||
        title?.episode_number ||
        1
    );

  /* =========================================================
     SERVER 1
     VIDSRC
     FREE
     ========================================================= */

  const server1Url = useMemo(() => {
    if (!realTmdb) {
      return null;
    }

    if (contentType === 'movie') {
      return getVidsrcMovieUrl(
        realTmdb
      );
    }

    return getVidsrcEpisodeUrl(
      realTmdb,
      currentSeason,
      currentEpisodeNumber
    );
  }, [
    realTmdb,
    contentType,
    currentSeason,
    currentEpisodeNumber,
  ]);

  /* =========================================================
     SERVER 2
     STELLAR
     FREE
     ========================================================= */

  const server2Url = useMemo(() => {
    if (!realTmdb) {
      return null;
    }

    if (contentType === 'movie') {
      return getStellarMovieUrl(
        realTmdb
      );
    }

    return getStellarEpisodeUrl(
      realTmdb,
      currentSeason,
      currentEpisodeNumber
    );
  }, [
    realTmdb,
    contentType,
    currentSeason,
    currentEpisodeNumber,
  ]);

  /* =========================================================
     SERVER 3
     VIDLINK
     FREE
     ========================================================= */

  const server3Url = useMemo(() => {
    if (!realTmdb) {
      return null;
    }

    if (contentType === 'movie') {
      return getVidlinkMovieUrl(
        realTmdb
      );
    }

    return getVidlinkEpisodeUrl(
      realTmdb,
      currentSeason,
      currentEpisodeNumber
    );
  }, [
    realTmdb,
    contentType,
    currentSeason,
    currentEpisodeNumber,
  ]);

  /* =========================================================
     SERVER 4
     YAPGRID
     VIP
     ========================================================= */

  const server4Url = useMemo(() => {
    if (!realTmdb) {
      return null;
    }

    if (contentType === 'movie') {
      return getYapgridMovieUrl(
        realTmdb
      );
    }

    return getYapgridEpisodeUrl(
      realTmdb,
      currentSeason,
      currentEpisodeNumber
    );
  }, [
    realTmdb,
    contentType,
    currentSeason,
    currentEpisodeNumber,
  ]);

  /* =========================================================
     SERVERS
     ========================================================= */

  const servers = useMemo(
    () => [
      {
        id: 0,
        name: 'سيرفر 1',
        provider: 'Vidsrc',
        url: server1Url,
        vip: false,
      },
      {
        id: 1,
        name: 'سيرفر 2',
        provider: 'Stellar',
        url: server2Url,
        vip: false,
      },
      {
        id: 2,
        name: 'سيرفر 3',
        provider: 'VidLink',
        url: server3Url,
        vip: false,
      },
      {
        id: 3,
        name: 'سيرفر 4',
        provider: 'YapGrid',
        url: server4Url,
        vip: true,
      },
    ],
    [
      server1Url,
      server2Url,
      server3Url,
      server4Url,
    ]
  );

  const currentServer =
    servers[selectedServer] ||
    servers[0];

  /* =========================================================
     AUTO FALLBACK
     ========================================================= */

  useEffect(() => {
    /*
     * إذا السيرفر المحدد VIP والمستخدم Free،
     * نرجعو تلقائياً للسيرفر الأول.
     */
    if (
      currentServer?.vip &&
      !hasVipAccess
    ) {
      setSelectedServer(0);
      return;
    }

    if (currentServer?.url) {
      return;
    }

    const firstAvailable =
      servers.find(
        (server) =>
          Boolean(server.url) &&
          (!server.vip ||
            hasVipAccess)
      );

    if (
      firstAvailable &&
      firstAvailable.id !==
        selectedServer
    ) {
      setSelectedServer(
        firstAvailable.id
      );
    }
  }, [
    currentServer,
    selectedServer,
    servers,
    hasVipAccess,
  ]);

  /* =========================================================
     RESET ERROR
     ========================================================= */

  useEffect(() => {
    setError('');
  }, [
    selectedServer,
    realTmdb,
    currentSeason,
    currentEpisodeNumber,
    currentEpisodeId,
  ]);

  /* =========================================================
     LOAD FRIENDS
     ========================================================= */

  useEffect(() => {
    if (
      !shareOpen ||
      !user?.id
    ) {
      return;
    }

    let cancelled = false;

    async function loadFriends() {
      try {
        setLoadingFriends(true);
        setError('');

        const result =
          await fetchFriends(
            user.id
          );

        if (!cancelled) {
          setFriends(
            result || []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              'تعذر جلب قائمة الأصدقاء'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingFriends(false);
        }
      }
    }

    loadFriends();

    return () => {
      cancelled = true;
    };
  }, [
    shareOpen,
    user?.id,
  ]);

  /* =========================================================
     FRIEND SELECTION
     ========================================================= */

  function toggleFriend(
    friendId
  ) {
    setSelectedFriends(
      (current) => {
        if (
          current.includes(
            friendId
          )
        ) {
          return current.filter(
            (id) =>
              id !== friendId
          );
        }

        return [
          ...current,
          friendId,
        ];
      }
    );
  }

  /* =========================================================
     VIP SERVER CLICK
     ========================================================= */

  function handleServerClick(
    server
  ) {
    if (server.vip && !hasVipAccess) {
      setError('');
      setVipModalOpen(true);
      return;
    }

    if (!server.url) {
      setError(
        'لا يوجد رابط لهذا السيرفر'
      );
      return;
    }

    setError('');
    setSelectedServer(
      server.id
    );
  }

  /* =========================================================
     WATCH PARTY
     ========================================================= */

  async function createParty() {
    if (!user?.id) {
      setError(
        'يجب تسجيل الدخول أولاً'
      );
      return;
    }

    if (!title?.id) {
      setError(
        'هذا المحتوى لا يملك معرفًا صالحًا في قاعدة البيانات'
      );
      return;
    }

    if (
      !selectedFriends.length
    ) {
      setError(
        'اختر صديقًا واحدًا على الأقل'
      );
      return;
    }

    try {
      setSharing(true);
      setError('');

      const partyResult =
        await createWatchPartyWithInvites(
          {
            hostId: user.id,
            titleId: title.id,
            episodeId:
              currentEpisodeId,
            friendIds:
              selectedFriends,
          }
        );

      const party =
        partyResult?.party;

      if (!party?.id) {
        throw new Error(
          'لم يتم إنشاء غرفة المشاهدة'
        );
      }

      const metadata = {
        name:
          title?.name ||
          title?.title ||
          'مشاهدة جماعية',

        poster_url:
          title?.poster_url ||
          title?.poster ||
          title?.image_url ||
          title?.backdrop_url ||
          null,

        release_year:
          title?.release_year ||
          title?.year ||
          null,

        rating_avg:
          title?.rating_avg ||
          title?.rating ||
          null,

        type:
          contentType === 'tv'
            ? 'series'
            : 'movie',

        tmdb_id:
          realTmdb,

        episode_id:
          currentEpisodeId,

        season:
          contentType === 'tv'
            ? currentSeason
            : null,

        episode_number:
          contentType === 'tv'
            ? currentEpisodeNumber
            : null,

        server:
          selectedServer,

        server_provider:
          currentServer?.provider ||
          null,

        watch_party: true,
      };

      /*
       * نبقي kind = title_share
       * للتوافق مع messages.kind.
       */

      await Promise.all(
        selectedFriends.map(
          (friendId) =>
            sendMessage({
              senderId:
                user.id,
              receiverId:
                friendId,
              kind:
                'title_share',
              content:
                metadata.name,
              sharedTitleId:
                title.id,
              sharedPartyId:
                party.id,
              metadata,
            })
        )
      );

      setSelectedFriends([]);
      setShareOpen(false);

      navigate(
        `/watch-party/${party.id}`
      );
    } catch (err) {
      console.error(
        'Watch Party creation error:',
        err
      );

      setError(
        err?.message ||
          'تعذر إنشاء دعوة المشاهدة'
      );
    } finally {
      setSharing(false);
    }
  }

  /* =========================================================
     NO TMDB
     ========================================================= */

  if (!realTmdb) {
    return (
      <div
        style={{
          width: '100%',
          background: '#000',
          color: '#fff',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            minHeight: '420px',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            color: '#aaa',
          }}
        >
          لا يوجد TMDB ID لهذا المحتوى
        </div>
      </div>
    );
  }

  /* =========================================================
     PLAYER KEY
     ========================================================= */

  const playerKey = [
    selectedServer,
    currentServer?.provider ||
      '',
    realTmdb,
    contentType,
    currentSeason,
    currentEpisodeNumber,
    currentEpisodeId || '',
    currentServer?.url || '',
  ].join('-');

  return (
    <div
      style={{
        width: '100%',
        background: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        color: '#fff',
        direction: 'rtl',
        position: 'relative',
      }}
    >
      {/* =====================================================
          PLAYER
          ===================================================== */}

      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '420px',
          background: '#000',
          display: 'flex',
          alignItems:
            'center',
          justifyContent:
            'center',
        }}
      >
        {currentServer?.url ? (
          <iframe
            key={playerKey}
            src={
              currentServer.url
            }
            style={{
              width: '100%',
              height: '420px',
              border: 'none',
              background: '#000',
            }}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            title={`${currentServer.provider} External Player`}
          />
        ) : (
          <div
            style={{
              minHeight: '420px',
              display: 'flex',
              flexDirection:
                'column',
              alignItems:
                'center',
              justifyContent:
                'center',
              gap: '10px',
              color: '#aaa',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '30px',
              }}
            >
              🎬
            </div>

            <div>
              لا يوجد رابط لهذا السيرفر
            </div>

            <div
              style={{
                fontSize: '11px',
                color: '#666',
                direction: 'ltr',
              }}
            >
              {currentServer?.provider ||
                'Server'}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          SERVERS + SHARE
          ===================================================== */}

      <div
        style={{
          padding: '12px 15px',
          background: '#111',
          borderTop:
            '1px solid #222',
          display: 'flex',
          justifyContent:
            'center',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            color: '#aaa',
          }}
        >
          السيرفرات:
        </span>

        {servers.map(
          (server) => {
            const available =
              Boolean(
                server.url
              );

            const locked =
              server.vip &&
              !hasVipAccess;

            const active =
              selectedServer ===
                server.id &&
              !locked;

            return (
              <button
                key={
                  server.id
                }
                type="button"
                disabled={
                  !available
                }
                onClick={() =>
                  handleServerClick(
                    server
                  )
                }
                style={{
                  position:
                    'relative',

                  minWidth:
                    server.vip
                      ? '125px'
                      : 'auto',

                  border:
                    active
                      ? server.vip
                        ? '1px solid #ffd700'
                        : '1px solid #d4af37'
                      : server.vip
                        ? '1px solid rgba(255,215,0,.45)'
                        : '1px solid #333',

                  background:
                    active
                      ? server.vip
                        ? 'linear-gradient(135deg,#ffd700,#d4af37)'
                        : '#d4af37'
                      : server.vip
                        ? 'linear-gradient(135deg,#211b00,#181818)'
                        : '#181818',

                  color:
                    active
                      ? '#111'
                      : locked
                        ? '#ffd700'
                        : available
                          ? '#ddd'
                          : '#555',

                  padding:
                    '8px 14px',

                  borderRadius:
                    '8px',

                  cursor:
                    locked
                      ? 'pointer'
                      : available
                        ? 'pointer'
                        : 'not-allowed',

                  fontSize:
                    '12px',

                  fontWeight:
                    700,

                  opacity:
                    available
                      ? 1
                      : 0.55,

                  boxShadow:
                    server.vip
                      ? locked
                        ? '0 0 12px rgba(255,215,0,.08)'
                        : active
                          ? '0 0 15px rgba(255,215,0,.25)'
                          : 'none'
                      : 'none',
                }}
              >
                {server.vip && (
                  <span
                    style={{
                      marginLeft:
                        '5px',
                    }}
                  >
                    ⭐
                  </span>
                )}

                {server.name}

                {server.vip && (
                  <span
                    style={{
                      marginRight:
                        '6px',
                      fontSize:
                        '10px',
                      opacity:
                        locked
                          ? 1
                          : 0.85,
                    }}
                  >
                    {locked
                      ? '🔒'
                      : '👑'}
                  </span>
                )}

                {server.vip &&
                  locked && (
                    <span
                      style={{
                        position:
                          'absolute',
                        top:
                          '-8px',
                        left:
                          '50%',
                        transform:
                          'translateX(-50%)',
                        padding:
                          '2px 7px',
                        borderRadius:
                          '999px',
                        background:
                          '#ffd700',
                        color:
                          '#171100',
                        fontSize:
                          '8px',
                        fontWeight:
                          900,
                        whiteSpace:
                          'nowrap',
                        boxShadow:
                          '0 3px 10px rgba(0,0,0,.35)',
                      }}
                    >
                      VIP
                    </span>
                  )}
              </button>
            );
          }
        )}

        <button
          type="button"
          onClick={() => {
            setError('');
            setShareOpen(true);
          }}
          style={{
            border:
              '1px solid #d4af37',
            background:
              'linear-gradient(135deg,#d4af37,#b89222)',
            color: '#111',
            padding:
              '8px 16px',
            borderRadius:
              '8px',
            cursor:
              'pointer',
            fontSize:
              '12px',
            fontWeight:
              900,
          }}
        >
          🎬 مشاركة
        </button>
      </div>

      {/* =====================================================
          VIP LOCK MODAL
          ===================================================== */}

      {vipModalOpen && (
        <div
          onClick={() =>
            setVipModalOpen(
              false
            )
          }
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background:
              'rgba(0,0,0,.78)',
            backdropFilter:
              'blur(8px)',
            WebkitBackdropFilter:
              'blur(8px)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: '100%',
              maxWidth: '410px',
              background:
                'linear-gradient(145deg,#171717,#0c0c0c)',
              border:
                '1px solid rgba(255,215,0,.3)',
              borderRadius:
                '20px',
              padding:
                '28px 22px',
              textAlign:
                'center',
              color: '#fff',
              boxShadow:
                '0 25px 100px rgba(0,0,0,.7), 0 0 45px rgba(255,215,0,.08)',
            }}
          >
            <div
              style={{
                width: '70px',
                height: '70px',
                margin:
                  '0 auto 15px',
                borderRadius:
                  '20px',
                background:
                  'linear-gradient(135deg,#ffd700,#b8860b)',
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                fontSize:
                  '34px',
                boxShadow:
                  '0 10px 30px rgba(255,215,0,.2)',
              }}
            >
              ⭐
            </div>

            <div
              style={{
                color: '#ffd700',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing:
                  '1px',
                marginBottom:
                  '8px',
              }}
            >
              VIP SERVER
            </div>

            <h3
              style={{
                margin:
                  '0 0 10px',
                fontSize: '22px',
                fontWeight: 900,
              }}
            >
              هذا السيرفر خاص بـ VIP
            </h3>

            <p
              style={{
                margin: 0,
                color: '#999',
                fontSize: '13px',
                lineHeight: 1.7,
              }}
            >
              سيرفر YapGrid متاح فقط
              للمشتركين في باقة VIP الشهرية
              أو السنوية.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginTop: '18px',
                justifyContent:
                  'center',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  padding:
                    '6px 11px',
                  borderRadius:
                    '999px',
                  background:
                    'rgba(255,215,0,.08)',
                  border:
                    '1px solid rgba(255,215,0,.2)',
                  color: '#ffd700',
                  fontSize:
                    '11px',
                  fontWeight:
                    700,
                }}
              >
                ⭐ VIP شهري
              </span>

              <span
                style={{
                  padding:
                    '6px 11px',
                  borderRadius:
                    '999px',
                  background:
                    'rgba(255,215,0,.08)',
                  border:
                    '1px solid rgba(255,215,0,.2)',
                  color: '#ffd700',
                  fontSize:
                    '11px',
                  fontWeight:
                    700,
                }}
              >
                ⭐ VIP سنوي
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setVipModalOpen(
                  false
                );
                navigate(
                  '/subscription'
                );
              }}
              style={{
                width: '100%',
                marginTop:
                  '20px',
                padding:
                  '13px',
                border:
                  'none',
                borderRadius:
                  '11px',
                background:
                  'linear-gradient(135deg,#ffd700,#b8860b)',
                color: '#171100',
                fontWeight:
                  900,
                cursor:
                  'pointer',
                fontSize:
                  '13px',
              }}
            >
              ⭐ اشترك في VIP
            </button>

            <button
              type="button"
              onClick={() =>
                setVipModalOpen(
                  false
                )
              }
              style={{
                width: '100%',
                marginTop:
                  '8px',
                padding:
                  '11px',
                border:
                  '1px solid #333',
                borderRadius:
                  '11px',
                background:
                  '#171717',
                color: '#aaa',
                fontWeight:
                  700,
                cursor:
                  'pointer',
                fontSize:
                  '12px',
              }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          SHARE MODAL
          ===================================================== */}

      {shareOpen && (
        <div
          onClick={() =>
            !sharing &&
            setShareOpen(false)
          }
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background:
              'rgba(0,0,0,.75)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              width: '100%',
              maxWidth: '470px',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: '#151515',
              border:
                '1px solid rgba(212,175,55,.25)',
              borderRadius: '18px',
              padding: '20px',
              boxShadow:
                '0 25px 80px rgba(0,0,0,.55)',
            }}
          >
            {/* HEADER */}

            <div
              style={{
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'space-between',
                marginBottom:
                  '18px',
              }}
            >
              <div>
                <div
                  style={{
                    color:
                      '#d4af37',
                    fontSize:
                      '11px',
                    fontWeight:
                      900,
                    letterSpacing:
                      '1px',
                    marginBottom:
                      '5px',
                  }}
                >
                  WATCH PARTY
                </div>

                <h3
                  style={{
                    margin: 0,
                    color: '#fff',
                    fontSize:
                      '20px',
                  }}
                >
                  🎬 مشاركة المشاهدة
                </h3>
              </div>

              <button
                type="button"
                disabled={
                  sharing
                }
                onClick={() =>
                  setShareOpen(
                    false
                  )
                }
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius:
                    '50%',
                  border:
                    '1px solid #333',
                  background:
                    '#222',
                  color: '#fff',
                  cursor:
                    'pointer',
                  fontSize:
                    '20px',
                }}
              >
                ×
              </button>
            </div>

            {/* MOVIE INFO */}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                padding: '12px',
                borderRadius:
                  '13px',
                background:
                  '#0e0e0e',
                border:
                  '1px solid #292929',
                marginBottom:
                  '15px',
              }}
            >
              {(
                title?.poster_url ||
                title?.poster ||
                title?.image_url
              ) ? (
                <img
                  src={
                    title.poster_url ||
                    title.poster ||
                    title.image_url
                  }
                  alt=""
                  style={{
                    width: '58px',
                    height: '82px',
                    objectFit:
                      'cover',
                    borderRadius:
                      '8px',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '58px',
                    height: '82px',
                    borderRadius:
                      '8px',
                    background:
                      '#222',
                    display: 'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    fontSize:
                      '25px',
                  }}
                >
                  🎬
                </div>
              )}

              <div
                style={{
                  display:
                    'flex',
                  flexDirection:
                    'column',
                  justifyContent:
                    'center',
                  gap: '5px',
                }}
              >
                <strong
                  style={{
                    color: '#fff',
                    fontSize:
                      '15px',
                  }}
                >
                  {title?.name ||
                    title?.title ||
                    'المحتوى الحالي'}
                </strong>

                <span
                  style={{
                    color: '#888',
                    fontSize:
                      '12px',
                  }}
                >
                  {contentType ===
                  'tv'
                    ? `مسلسل • موسم ${currentSeason} • حلقة ${currentEpisodeNumber}`
                    : 'فيلم'}
                </span>

                <span
                  style={{
                    color:
                      currentServer?.vip
                        ? '#ffd700'
                        : '#666',
                    fontSize:
                      '10px',
                    direction:
                      'ltr',
                    fontWeight:
                      currentServer?.vip
                        ? 800
                        : 400,
                  }}
                >
                  {currentServer?.vip
                    ? '👑 VIP • '
                    : ''}
                  {currentServer?.provider ||
                    ''}
                </span>
              </div>
            </div>

            {/* ERROR */}

            {error && (
              <div
                style={{
                  padding:
                    '10px 12px',
                  marginBottom:
                    '12px',
                  borderRadius:
                    '9px',
                  background:
                    'rgba(220,60,60,.1)',
                  border:
                    '1px solid rgba(220,60,60,.3)',
                  color:
                    '#ff8585',
                  fontSize:
                    '12px',
                }}
              >
                {error}
              </div>
            )}

            {/* FRIENDS */}

            <div
              style={{
                color: '#aaa',
                fontSize:
                  '12px',
                marginBottom:
                  '8px',
              }}
            >
              اختر الأصدقاء:
            </div>

            {loadingFriends ? (
              <div
                style={{
                  padding: '30px',
                  textAlign:
                    'center',
                  color: '#888',
                }}
              >
                جاري جلب الأصدقاء...
              </div>
            ) : friends.length ===
              0 ? (
              <div
                style={{
                  padding: '25px',
                  textAlign:
                    'center',
                  color: '#888',
                  background:
                    '#101010',
                  borderRadius:
                    '12px',
                }}
              >
                ما عندك حتى صديق متاح للمشاركة.
              </div>
            ) : (
              <div
                style={{
                  display:
                    'flex',
                  flexDirection:
                    'column',
                  gap: '7px',
                  maxHeight:
                    '300px',
                  overflowY:
                    'auto',
                }}
              >
                {friends.map(
                  (friend) => {
                    const selected =
                      selectedFriends.includes(
                        friend.id
                      );

                    const name =
                      friend.display_name ||
                      friend.full_name ||
                      friend.username ||
                      'مستخدم';

                    return (
                      <button
                        key={
                          friend.id
                        }
                        type="button"
                        onClick={() =>
                          toggleFriend(
                            friend.id
                          )
                        }
                        style={{
                          width: '100%',
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: '10px',
                          padding:
                            '10px',
                          borderRadius:
                            '10px',
                          border:
                            selected
                              ? '1px solid #d4af37'
                              : '1px solid #292929',
                          background:
                            selected
                              ? 'rgba(212,175,55,.08)'
                              : '#101010',
                          color: '#fff',
                          cursor:
                            'pointer',
                          textAlign:
                            'right',
                        }}
                      >
                        <div
                          style={{
                            width:
                              '38px',
                            height:
                              '38px',
                            borderRadius:
                              '50%',
                            overflow:
                              'hidden',
                            background:
                              '#252525',
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            color:
                              '#d4af37',
                            fontWeight:
                              900,
                          }}
                        >
                          {friend.avatar_url ? (
                            <img
                              src={
                                friend.avatar_url
                              }
                              alt=""
                              style={{
                                width:
                                  '100%',
                                height:
                                  '100%',
                                objectFit:
                                  'cover',
                              }}
                            />
                          ) : (
                            name
                              .charAt(
                                0
                              )
                              .toUpperCase()
                          )}
                        </div>

                        <span
                          style={{
                            flex: 1,
                            fontSize:
                              '13px',
                          }}
                        >
                          {name}
                        </span>

                        <span
                          style={{
                            width:
                              '23px',
                            height:
                              '23px',
                            borderRadius:
                              '50%',
                            border:
                              selected
                                ? '1px solid #d4af37'
                                : '1px solid #444',
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            color:
                              '#d4af37',
                            fontWeight:
                              900,
                          }}
                        >
                          {selected
                            ? '✓'
                            : ''}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {/* SEND */}

            <button
              type="button"
              disabled={
                sharing ||
                selectedFriends.length ===
                  0
              }
              onClick={
                createParty
              }
              style={{
                width: '100%',
                marginTop:
                  '15px',
                padding:
                  '13px',
                border:
                  'none',
                borderRadius:
                  '10px',
                background:
                  selectedFriends.length &&
                  !sharing
                    ? '#d4af37'
                    : '#333',
                color:
                  selectedFriends.length &&
                  !sharing
                    ? '#111'
                    : '#777',
                cursor:
                  selectedFriends.length &&
                  !sharing
                    ? 'pointer'
                    : 'not-allowed',
                fontWeight:
                  900,
                fontSize:
                  '13px',
              }}
            >
              {sharing
                ? 'جاري إرسال الدعوة...'
                : selectedFriends.length
                  ? `إرسال الدعوة إلى ${selectedFriends.length} صديق`
                  : 'اختر صديقًا أولاً'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

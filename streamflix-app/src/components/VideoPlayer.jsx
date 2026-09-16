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

const STREAMSRC_BASE_URL =
  'https://streamsrc.cc';

function getStreamSrcMovieUrl(
  tmdbId
) {
  if (!tmdbId) return null;

  return `${STREAMSRC_BASE_URL}/watch/movie/tmdbid=${encodeURIComponent(
    tmdbId
  )}`;
}

function getStreamSrcSeriesUrl(
  tmdbId
) {
  if (!tmdbId) return null;

  return `${STREAMSRC_BASE_URL}/watch/series/tmdbid=${encodeURIComponent(
    tmdbId
  )}`;
}

export default function VideoPlayer({
  tmdbId,
  type = 'movie',
  title,
  episodeId = null,
}) {
  const { user } = useAuth();
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

  const realTmdb =
    tmdbId ||
    title?.tmdb_id ||
    title?.tmdbId ||
    null;

  const contentType =
    type === 'series' ||
    type === 'tv' ||
    title?.type === 'series' ||
    title?.type === 'tv'
      ? 'tv'
      : 'movie';

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

  /*
   * الحلقات تأتي من TitleDetail
   * داخل current_episode_stream_urls.
   */
  const episodeStreamUrls =
    title?.current_episode_stream_urls ||
    title?.stream_urls ||
    {};

  const databaseServer1 =
    episodeStreamUrls &&
    typeof episodeStreamUrls ===
      'object'
      ? (
          episodeStreamUrls.server1 ||
          episodeStreamUrls.stelar ||
          episodeStreamUrls.stelar_rip ||
          null
        )
      : null;

  const databaseServer2 =
    episodeStreamUrls &&
    typeof episodeStreamUrls ===
      'object'
      ? (
          episodeStreamUrls.server2 ||
          episodeStreamUrls.streamsrc ||
          null
        )
      : null;

  /*
   * Server 1:
   *
   * للمسلسل نستعمل رابط الحلقة المخزن.
   * للفيلم نستعمل titles.url.
   */
  const server1Url =
    databaseServer1 ||
    title?.url ||
    null;

  /*
   * Server 2:
   *
   * إذا عندنا رابط مخزن في episode
   * نستعمله.
   *
   * وإلا نستعمل الصيغة الموثقة
   * الخاصة بالفيلم/المسلسل.
   */
  const generatedStreamSrcUrl =
    useMemo(() => {
      if (!realTmdb) {
        return null;
      }

      if (
        contentType === 'movie'
      ) {
        return getStreamSrcMovieUrl(
          realTmdb
        );
      }

      return getStreamSrcSeriesUrl(
        realTmdb
      );
    }, [
      realTmdb,
      contentType,
    ]);

  const server2Url =
    databaseServer2 ||
    generatedStreamSrcUrl ||
    null;

  const servers = useMemo(
    () => [
      {
        id: 0,
        name: 'سيرفر 1',
        provider: 'Stellar',
        url: server1Url,
      },
      {
        id: 1,
        name: 'سيرفر 2',
        provider: 'StreamSrc',
        url: server2Url,
      },
    ],
    [
      server1Url,
      server2Url,
    ]
  );

  const currentServer =
    servers[selectedServer] ||
    servers[0];

  useEffect(() => {
    /*
     * إذا السيرفر المحدد ما عندوش URL
     * نحاول الانتقال للسيرفر الآخر.
     */
    if (
      !currentServer?.url
    ) {
      const otherIndex =
        selectedServer === 0
          ? 1
          : 0;

      if (
        servers[otherIndex]?.url
      ) {
        setSelectedServer(
          otherIndex
        );
      }
    }
  }, [
    currentServer,
    selectedServer,
    servers,
  ]);

  useEffect(() => {
    setError('');
  }, [
    selectedServer,
    realTmdb,
    currentSeason,
    currentEpisodeNumber,
    currentEpisodeId,
  ]);

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

  const playerKey = [
    selectedServer,
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
      {/* PLAYER */}

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
            title={
              currentServer.provider ===
              'Stellar'
                ? 'Stellar External Player'
                : 'StreamSrc External Player'
            }
          />
        ) : (
          <div
            style={{
              minHeight:
                '420px',
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
              textAlign:
                'center',
            }}
          >
            <div
              style={{
                fontSize:
                  '30px',
              }}
            >
              🎬
            </div>

            <div>
              لا يوجد رابط لهذا السيرفر
            </div>

            <div
              style={{
                fontSize:
                  '11px',
                  color:
                    '#666',
                direction:
                  'ltr',
              }}
            >
              {currentServer?.provider ||
                'Server'}
            </div>
          </div>
        )}
      </div>

      {/* SERVERS + SHARE */}

      <div
        style={{
          padding:
            '12px 15px',
          background:
            '#111',
          borderTop:
            '1px solid #222',
          display: 'flex',
          justifyContent:
            'center',
          alignItems:
            'center',
          gap: '10px',
          flexWrap:
            'wrap',
        }}
      >
        <span
          style={{
            fontSize:
              '13px',
            color:
              '#aaa',
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

            return (
              <button
                key={
                  server.id
                }
                type="button"
                disabled={
                  !available
                }
                onClick={() => {
                  setError('');

                  setSelectedServer(
                    server.id
                  );
                }}
                style={{
                  border:
                    selectedServer ===
                    server.id
                      ? '1px solid #d4af37'
                      : '1px solid #333',
                  background:
                    selectedServer ===
                    server.id
                      ? '#d4af37'
                      : '#181818',
                  color:
                    selectedServer ===
                    server.id
                      ? '#111'
                      : available
                        ? '#ddd'
                        : '#555',
                  padding:
                    '8px 14px',
                  borderRadius:
                    '8px',
                  cursor:
                    available
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
                }}
              >
                {server.name}
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
            color:
              '#111',
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

      {/* SHARE MODAL */}

      {shareOpen && (
        <div
          onClick={() =>
            !sharing &&
            setShareOpen(false)
          }
          style={{
            position:
              'fixed',
            inset: 0,
            zIndex:
              99999,
            background:
              'rgba(0,0,0,.75)',
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            padding:
              '20px',
          }}
        >
          <div
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              width:
                '100%',
              maxWidth:
                '470px',
              maxHeight:
                '85vh',
              overflowY:
                'auto',
              background:
                '#151515',
              border:
                '1px solid rgba(212,175,55,.25)',
              borderRadius:
                '18px',
              padding:
                '20px',
              boxShadow:
                '0 25px 80px rgba(0,0,0,.55)',
            }}
          >
            {/* HEADER */}

            <div
              style={{
                display:
                  'flex',
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
                    color:
                      '#fff',
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
                  width:
                    '34px',
                  height:
                    '34px',
                  borderRadius:
                    '50%',
                  border:
                    '1px solid #333',
                  background:
                    '#222',
                  color:
                    '#fff',
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
                display:
                  'flex',
                gap:
                  '12px',
                padding:
                  '12px',
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
                    width:
                      '58px',
                    height:
                      '82px',
                    objectFit:
                      'cover',
                    borderRadius:
                      '8px',
                  }}
                />
              ) : (
                <div
                  style={{
                    width:
                      '58px',
                    height:
                      '82px',
                    borderRadius:
                      '8px',
                    background:
                      '#222',
                    display:
                      'flex',
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
                  gap:
                    '5px',
                }}
              >
                <strong
                  style={{
                    color:
                      '#fff',
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
                    color:
                      '#888',
                    fontSize:
                      '12px',
                  }}
                >
                  {contentType ===
                  'tv'
                    ? `مسلسل • موسم ${currentSeason} • حلقة ${currentEpisodeNumber}`
                    : 'فيلم'}
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
                color:
                  '#aaa',
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
                  padding:
                    '30px',
                  textAlign:
                    'center',
                  color:
                    '#888',
                }}
              >
                جاري جلب الأصدقاء...
              </div>
            ) : friends.length ===
              0 ? (
              <div
                style={{
                  padding:
                    '25px',
                  textAlign:
                    'center',
                  color:
                    '#888',
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
                  gap:
                    '7px',
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
                          width:
                            '100%',
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap:
                            '10px',
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
                          color:
                            '#fff',
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
                width:
                  '100%',
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

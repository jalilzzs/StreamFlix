import {
  useEffect,
  useState,
} from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import {
  getWatchParty,
  joinWatchParty,
  leaveWatchParty,
  subscribeToParty,
  updatePartyPlayback,
  fetchTitleById,
  fetchEpisodes,
} from '../lib/api';

export default function WatchParty() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [party, setParty] = useState(null);
  const [title, setTitle] = useState(null);
  const [episode, setEpisode] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [position, setPosition] =
    useState(0);

  const [status, setStatus] =
    useState('pending');

  const [leaving, setLeaving] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function openParty() {
      if (!id || !user?.id) return;

      try {
        setLoading(true);
        setError('');

        /*
         * First get the party.
         */

        const partyData =
          await getWatchParty(id);

        if (!partyData) {
          throw new Error(
            'غرفة المشاهدة غير موجودة'
          );
        }

        /*
         * IMPORTANT:
         * joinWatchParty checks the invitation.
         *
         * A random user cannot simply enter
         * using the party ID.
         */

        await joinWatchParty(
          id,
          user.id
        );

        if (cancelled) return;

        setParty(partyData);

        setPosition(
          Number(
            partyData.playback_position || 0
          )
        );

        setStatus(
          partyData.status || 'pending'
        );

        /*
         * Load movie/series information.
         */

        if (partyData.title_id) {
          try {
            const titleData =
              await fetchTitleById(
                partyData.title_id
              );

            if (!cancelled) {
              setTitle(titleData);
            }

            /*
             * Load episode if this is a series.
             */

            if (partyData.episode_id) {
              try {
                const episodes =
                  await fetchEpisodes(
                    partyData.title_id
                  );

                const found =
                  (episodes || []).find(
                    (item) =>
                      item.id ===
                      partyData.episode_id
                  );

                if (!cancelled) {
                  setEpisode(
                    found || null
                  );
                }
              } catch (episodeError) {
                console.error(
                  'Episode loading error:',
                  episodeError
                );
              }
            }
          } catch (titleError) {
            console.error(
              'Title loading error:',
              titleError
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              'لا تملك صلاحية الدخول إلى هذه الغرفة'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    openParty();

    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  /*
   * Realtime party updates.
   */

  useEffect(() => {
    if (!id) return;

    const unsubscribe =
      subscribeToParty(
        id,
        (updatedParty) => {
          if (!updatedParty) return;

          setParty((current) => ({
            ...(current || {}),
            ...updatedParty,
          }));

          setPosition(
            Number(
              updatedParty.playback_position ||
                0
            )
          );

          setStatus(
            updatedParty.status ||
              'pending'
          );

          if (
            updatedParty.status ===
            'ended'
          ) {
            setError(
              'المضيف أنهى غرفة المشاهدة'
            );
          }
        }
      );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [id]);

  const isHost =
    !!party &&
    !!user?.id &&
    party.host_id === user.id;

  async function changePlayback(
    nextPosition,
    nextStatus
  ) {
    if (!isHost || !id) return;

    try {
      setPosition(nextPosition);
      setStatus(nextStatus);

      await updatePartyPlayback(
        id,
        nextPosition,
        nextStatus
      );
    } catch (err) {
      setError(
        err?.message ||
          'تعذر تحديث حالة المشاهدة'
      );
    }
  }

  async function exitParty() {
    if (leaving) return;

    try {
      setLeaving(true);

      if (id && user?.id) {
        await leaveWatchParty(
          id,
          user.id
        );
      }
    } catch (err) {
      console.error(
        'Leave Watch Party error:',
        err
      );
    } finally {
      navigate('/friends');
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--muted)',
        }}
      >
        جاري فتح غرفة المشاهدة...
      </div>
    );
  }

  if (!party || error) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '15px',
          padding: '30px',
          background: 'var(--bg)',
          color: 'var(--text)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '45px',
          }}
        >
          🔒
        </div>

        <h2>
          {error ||
            'غرفة المشاهدة غير موجودة'}
        </h2>

        <button
          type="button"
          onClick={() =>
            navigate('/friends')
          }
          style={{
            border: 'none',
            background: 'var(--gold)',
            color: '#111',
            padding: '10px 18px',
            borderRadius: '9px',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          العودة للأصدقاء
        </button>
      </div>
    );
  }

  const contentType =
    title?.type === 'series' ||
    title?.type === 'tv'
      ? 'tv'
      : 'movie';

  const tmdbId =
    title?.tmdb_id ||
    title?.tmdbId;

  const season =
    episode?.season ||
    episode?.season_number ||
    title?.current_season ||
    1;

  const episodeNumber =
    episode?.episode_number ||
    episode?.episode ||
    title?.current_episode_number ||
    1;

  const playerUrl =
    contentType === 'tv'
      ? `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episodeNumber}`
      : `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;

  const titleName =
    title?.name ||
    title?.title ||
    'مشاهدة جماعية';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: '25px 15px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                color: 'var(--gold)',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '1.5px',
                marginBottom: '5px',
              }}
            >
              PRIVATE WATCH PARTY
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: '28px',
              }}
            >
              {titleName}
            </h1>

            <div
              style={{
                color: 'var(--muted)',
                fontSize: '12px',
                marginTop: '5px',
              }}
            >
              {isHost
                ? '👑 أنت المضيف'
                : '👥 أنت مشارك في الغرفة'}
            </div>
          </div>

          <button
            type="button"
            disabled={leaving}
            onClick={exitParty}
            style={{
              border:
                '1px solid var(--border)',
              background:
                'var(--panel)',
              color: 'var(--text)',
              padding: '10px 16px',
              borderRadius: '9px',
              cursor: 'pointer',
            }}
          >
            {leaving
              ? '...'
              : 'خروج'}
          </button>
        </div>

        {/* PLAYER */}

        <div
          style={{
            background: '#000',
            borderRadius: '14px',
            overflow: 'hidden',
            border:
              '1px solid var(--border)',
          }}
        >
          {tmdbId ? (
            <iframe
              src={playerUrl}
              title="StreamFlix Watch Party"
              style={{
                width: '100%',
                height: '65vh',
                minHeight: '420px',
                border: 'none',
                display: 'block',
                background: '#000',
              }}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              style={{
                height: '420px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#777',
              }}
            >
              لم يتم العثور على TMDB ID
            </div>
          )}
        </div>

        {/* PARTY STATUS */}

        <div
          style={{
            marginTop: '15px',
            padding: '16px',
            background:
              'var(--panel)',
            border:
              '1px solid var(--border)',
            borderRadius: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'space-between',
            gap: '15px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>
              {status === 'live'
                ? '🟢 الغرفة مباشرة'
                : status === 'ended'
                  ? '🔴 انتهت الغرفة'
                  : '🟡 الغرفة جاهزة'}
            </strong>

            <div
              style={{
                color:
                  'var(--muted)',
                fontSize: '12px',
                marginTop: '5px',
              }}
            >
              الموضع المحفوظ:{' '}
              {Math.floor(position)} ثانية
            </div>
          </div>

          {/* HOST CONTROLS */}

          {isHost &&
            status !== 'ended' && (
              <div
                style={{
                  display: 'flex',
                  gap: '7px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    changePlayback(
                      position,
                      'live'
                    )
                  }
                  style={{
                    border: 0,
                    background:
                      'var(--gold)',
                    color: '#111',
                    padding:
                      '8px 13px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    cursor:
                      'pointer',
                  }}
                >
                  ▶ Play
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changePlayback(
                      position,
                      'live'
                    )
                  }
                  style={{
                    border:
                      '1px solid var(--border)',
                    background:
                      'var(--panel-raised)',
                    color:
                      'var(--text)',
                    padding:
                      '8px 13px',
                    borderRadius: '8px',
                    cursor:
                      'pointer',
                  }}
                >
                  ⏸ Pause
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changePlayback(
                      position + 10,
                      'live'
                    )
                  }
                  style={{
                    border:
                      '1px solid var(--border)',
                    background:
                      'var(--panel-raised)',
                    color:
                      'var(--text)',
                    padding:
                      '8px 13px',
                    borderRadius: '8px',
                    cursor:
                      'pointer',
                  }}
                >
                  +10s
                </button>
              </div>
            )}
        </div>

        {/* INFO */}

        <div
          style={{
            marginTop: '12px',
            color: 'var(--muted)',
            fontSize: '12px',
            lineHeight: 1.7,
          }}
        >
          الغرفة خاصة بالدعوات فقط. الدخول يتم
          من خلال الدعوة المرتبطة بحسابك، وليس
          بمجرد معرفة رقم الغرفة.
        </div>

        <div
          style={{
            marginTop: '6px',
            color: 'var(--muted)',
            fontSize: '11px',
            lineHeight: 1.7,
          }}
        >
          ملاحظة: حالة الغرفة والموضع محفوظان
          في Realtime. التحكم المباشر داخل
          iframe الخارجي يحتاج API رسمي من
          مزود المشغل حتى نتحكم في Play/Pause/Seek
          من الموقع.
        </div>
      </div>
    </div>
  );
}

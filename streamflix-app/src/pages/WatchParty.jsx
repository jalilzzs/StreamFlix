import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import { supabase } from '../lib/supabaseClient';

import {
  getWatchParty,
  joinWatchParty,
  leaveWatchParty,
  subscribeToParty,
  fetchTitleById,
  fetchEpisodes,
  uploadChatMedia,
} from '../lib/api';

export default function WatchParty() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [party, setParty] = useState(null);
  const [title, setTitle] = useState(null);
  const [episode, setEpisode] = useState(null);

  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState({});

  const [messages, setMessages] = useState([]);

  const [messageText, setMessageText] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [leaving, setLeaving] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [recording, setRecording] =
    useState(false);

  const [recordingTime, setRecordingTime] =
    useState(0);

  const [uploadingVoice, setUploadingVoice] =
    useState(false);

  const messagesEndRef =
    useRef(null);

  const mediaRecorderRef =
    useRef(null);

  const mediaStreamRef =
    useRef(null);

  const voiceChunksRef =
    useRef([]);

  const recordingTimerRef =
    useRef(null);

  /*
   * ========================================
   * LOAD PARTY
   * ========================================
   */

  useEffect(() => {
    let cancelled = false;

    async function openParty() {
      if (!id || !user?.id) return;

      try {
        setLoading(true);
        setError('');

        const partyData =
          await getWatchParty(id);

        if (!partyData) {
          throw new Error(
            'غرفة المشاهدة غير موجودة'
          );
        }

        /*
         * Invitation-only protection.
         */

        await joinWatchParty(
          id,
          user.id
        );

        if (cancelled) return;

        setParty(partyData);

        /*
         * Load title.
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
             * Load current episode.
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

        /*
         * Load room data.
         */

        await Promise.all([
          loadMembers(
            partyData.id
          ),
          loadMessages(
            partyData.id
          ),
        ]);
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
   * ========================================
   * LOAD MEMBERS
   * ========================================
   */

  async function loadMembers(partyId) {
    try {
      const { data, error: membersError } =
        await supabase
          .from('watch_party_members')
          .select('*')
          .eq('party_id', partyId)
          .order('joined_at', {
            ascending: true,
          });

      if (membersError) {
        throw membersError;
      }

      const list = data || [];

      setMembers(list);

      const userIds = [
        ...new Set(
          list
            .map(
              (item) =>
                item.user_id
            )
            .filter(Boolean)
        ),
      ];

      if (!userIds.length) return;

      const { data: profileData } =
        await supabase
          .from('profiles')
          .select(
            'id, username, display_name, avatar_url'
          )
          .in('id', userIds);

      const profileMap = {};

      (profileData || []).forEach(
        (profile) => {
          profileMap[profile.id] =
            profile;
        }
      );

      setProfiles(
        (current) => ({
          ...current,
          ...profileMap,
        })
      );
    } catch (err) {
      console.error(
        'Members loading error:',
        err
      );
    }
  }

  /*
   * ========================================
   * LOAD PARTY CHAT
   * ========================================
   */

  async function loadMessages(partyId) {
    try {
      const { data, error: messagesError } =
        await supabase
          .from('watch_party_messages')
          .select('*')
          .eq('party_id', partyId)
          .order('created_at', {
            ascending: true,
          })
          .limit(300);

      if (messagesError) {
        throw messagesError;
      }

      const list = data || [];

      setMessages(list);

      /*
       * Load sender profiles.
       */

      const senderIds = [
        ...new Set(
          list
            .map(
              (item) =>
                item.sender_id
            )
            .filter(Boolean)
        ),
      ];

      if (!senderIds.length) return;

      const { data: profileData } =
        await supabase
          .from('profiles')
          .select(
            'id, username, display_name, avatar_url'
          )
          .in('id', senderIds);

      const profileMap = {};

      (profileData || []).forEach(
        (profile) => {
          profileMap[profile.id] =
            profile;
        }
      );

      setProfiles(
        (current) => ({
          ...current,
          ...profileMap,
        })
      );
    } catch (err) {
      console.error(
        'Party messages loading error:',
        err
      );
    }
  }

  /*
   * ========================================
   * REALTIME PARTY
   * ========================================
   */

  useEffect(() => {
    if (!id) return;

    const unsubscribe =
      subscribeToParty(
        id,
        async (updatedParty) => {
          if (!updatedParty) return;

          setParty(
            (current) => ({
              ...(current || {}),
              ...updatedParty,
            })
          );

          if (
            updatedParty.status ===
            'ended'
          ) {
            setError(
              'المضيف أنهى غرفة المشاهدة'
            );
          }

          await loadMembers(id);
        }
      );

    return () => {
      if (
        typeof unsubscribe ===
        'function'
      ) {
        unsubscribe();
      }
    };
  }, [id]);

  /*
   * ========================================
   * REALTIME MEMBERS + CHAT
   * ========================================
   */

  useEffect(() => {
    if (!id) return;

    const membersChannel =
      supabase
        .channel(
          `watch-party-members-${id}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'watch_party_members',
            filter:
              `party_id=eq.${id}`,
          },
          () => {
            loadMembers(id);
          }
        )
        .subscribe();

    const messagesChannel =
      supabase
        .channel(
          `watch-party-messages-${id}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table:
              'watch_party_messages',
            filter:
              `party_id=eq.${id}`,
          },
          async (payload) => {
            const newMessage =
              payload.new;

            setMessages(
              (current) => {
                if (
                  current.some(
                    (item) =>
                      item.id ===
                      newMessage.id
                  )
                ) {
                  return current;
                }

                return [
                  ...current,
                  newMessage,
                ];
              }
            );

            if (
              newMessage.sender_id
            ) {
              await loadProfile(
                newMessage.sender_id
              );
            }
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        membersChannel
      );

      supabase.removeChannel(
        messagesChannel
      );
    };
  }, [id]);

  /*
   * ========================================
   * LOAD ONE PROFILE
   * ========================================
   */

  async function loadProfile(userId) {
    if (!userId) return;

    if (profiles[userId]) return;

    try {
      const { data } =
        await supabase
          .from('profiles')
          .select(
            'id, username, display_name, avatar_url'
          )
          .eq('id', userId)
          .maybeSingle();

      if (data) {
        setProfiles(
          (current) => ({
            ...current,
            [userId]: data,
          })
        );
      }
    } catch (err) {
      console.error(
        'Profile loading error:',
        err
      );
    }
  }

  /*
   * ========================================
   * SCROLL CHAT
   * ========================================
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  /*
   * ========================================
   * SEND TEXT
   * ========================================
   */

  async function sendTextMessage(
    event
  ) {
    event?.preventDefault();

    const text =
      messageText.trim();

    if (
      !text ||
      !id ||
      !user?.id ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);

      const { data, error: sendError } =
        await supabase
          .from(
            'watch_party_messages'
          )
          .insert({
            party_id: id,
            sender_id: user.id,
            kind: 'text',
            content: text,
            metadata: {},
          })
          .select('*')
          .single();

      if (sendError) {
        throw sendError;
      }

      if (data) {
        setMessages(
          (current) => {
            if (
              current.some(
                (item) =>
                  item.id ===
                  data.id
              )
            ) {
              return current;
            }

            return [
              ...current,
              data,
            ];
          }
        );
      }

      setMessageText('');
    } catch (err) {
      console.error(
        'Send party message error:',
        err
      );

      setError(
        err?.message ||
          'تعذر إرسال الرسالة'
      );
    } finally {
      setSending(false);
    }
  }

  /*
   * ========================================
   * VOICE RECORDING
   * ========================================
   */

  async function startRecording() {
    if (
      recording ||
      uploadingVoice ||
      !user?.id ||
      !id
    ) {
      return;
    }

    try {
      setError('');

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices
          .getUserMedia
      ) {
        throw new Error(
          'المتصفح لا يدعم تسجيل الصوت'
        );
      }

      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: true,
          });

      mediaStreamRef.current =
        stream;

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];

      const supportedType =
        mimeTypes.find(
          (type) =>
            window.MediaRecorder &&
            MediaRecorder.isTypeSupported(
              type
            )
        );

      const recorder =
        supportedType
          ? new MediaRecorder(
              stream,
              {
                mimeType:
                  supportedType,
              }
            )
          : new MediaRecorder(
              stream
            );

      mediaRecorderRef.current =
        recorder;

      voiceChunksRef.current = [];

      recorder.ondataavailable =
        (event) => {
          if (
            event.data &&
            event.data.size > 0
          ) {
            voiceChunksRef.current.push(
              event.data
            );
          }
        };

      recorder.onstop = async () => {
        try {
          const blob =
            new Blob(
              voiceChunksRef.current,
              {
                type:
                  recorder.mimeType ||
                  'audio/webm',
              }
            );

          voiceChunksRef.current =
            [];

          if (!blob.size) {
            throw new Error(
              'لم يتم تسجيل أي صوت'
            );
          }

          setUploadingVoice(true);

          const extension =
            blob.type.includes(
              'mp4'
            )
              ? 'mp4'
              : 'webm';

          const voiceFile =
            new File(
              [blob],
              `party-voice-${Date.now()}.${extension}`,
              {
                type:
                  blob.type ||
                  'audio/webm',
              }
            );

          const uploaded =
            await uploadChatMedia(
              user.id,
              voiceFile,
              'voice'
            );

          if (!uploaded) {
            throw new Error(
              'فشل رفع الرسالة الصوتية'
            );
          }

          const voiceUrl =
            uploaded.url ||
            uploaded.publicUrl ||
            uploaded;

          const metadata = {
            url: voiceUrl,
            path:
              uploaded.path || null,
            mime:
              blob.type ||
              'audio/webm',
            duration:
              recordingTime,
          };

          const {
            data,
            error:
              messageError,
          } =
            await supabase
              .from(
                'watch_party_messages'
              )
              .insert({
                party_id: id,
                sender_id: user.id,
                kind: 'voice',
                content:
                  voiceUrl,
                metadata,
              })
              .select('*')
              .single();

          if (messageError) {
            throw messageError;
          }

          if (data) {
            setMessages(
              (current) => {
                if (
                  current.some(
                    (item) =>
                      item.id ===
                      data.id
                  )
                ) {
                  return current;
                }

                return [
                  ...current,
                  data,
                ];
              }
            );
          }
        } catch (err) {
          console.error(
            'Voice message error:',
            err
          );

          setError(
            err?.message ||
              'تعذر إرسال الرسالة الصوتية'
          );
        } finally {
          setUploadingVoice(
            false
          );
          setRecordingTime(0);

          if (
            mediaStreamRef.current
          ) {
            mediaStreamRef.current
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            mediaStreamRef.current =
              null;
          }
        }
      };

      recorder.start();

      setRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current =
        window.setInterval(() => {
          setRecordingTime(
            (current) =>
              current + 1
          );
        }, 1000);
    } catch (err) {
      console.error(
        'Start recording error:',
        err
      );

      setError(
        err?.message ||
          'تعذر تشغيل الميكروفون'
      );

      if (
        mediaStreamRef.current
      ) {
        mediaStreamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        mediaStreamRef.current =
          null;
      }
    }
  }

  /*
   * ========================================
   * STOP RECORDING
   * ========================================
   */

  function stopRecording() {
    if (
      !mediaRecorderRef.current ||
      !recording
    ) {
      return;
    }

    if (
      recordingTimerRef.current
    ) {
      window.clearInterval(
        recordingTimerRef.current
      );

      recordingTimerRef.current =
        null;
    }

    setRecording(false);

    try {
      if (
        mediaRecorderRef.current
          .state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.error(
        'Stop recording error:',
        err
      );
    }
  }

  /*
   * ========================================
   * CLEAN RECORDING
   * ========================================
   */

  useEffect(() => {
    return () => {
      if (
        recordingTimerRef.current
      ) {
        window.clearInterval(
          recordingTimerRef.current
        );
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current
          .state !== 'inactive'
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore cleanup error.
        }
      }

      if (
        mediaStreamRef.current
      ) {
        mediaStreamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );
      }
    };
  }, []);

  /*
   * ========================================
   * FORMAT TIME
   * ========================================
   */

  function formatTime(seconds) {
    const value =
      Number(seconds) || 0;

    const minutes =
      Math.floor(value / 60);

    const secs =
      value % 60;

    return `${String(
      minutes
    ).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  }

  /*
   * ========================================
   * PROFILE NAME
   * ========================================
   */

  function getProfileName(
    userId
  ) {
    const profile =
      profiles[userId];

    if (!profile) {
      return 'مستخدم';
    }

    return (
      profile.display_name ||
      profile.username ||
      'مستخدم'
    );
  }

  /*
   * ========================================
   * EXIT PARTY
   * ========================================
   */

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

  /*
   * ========================================
   * KEYBOARD
   * ========================================
   */

  function handleMessageKeyDown(
    event
  ) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendTextMessage(event);
    }
  }

  /*
   * ========================================
   * LOADING
   * ========================================
   */

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--muted)',
          padding: '30px',
          textAlign: 'center',
        }}
      >
        جاري فتح غرفة المشاهدة...
      </div>
    );
  }

  /*
   * ========================================
   * ERROR
   * ========================================
   */

  if (!party || error) {
    return (
      <div
        style={{
          minHeight: '100vh',
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
            fontSize: '48px',
          }}
        >
          🔒
        </div>

        <h2
          style={{
            margin: 0,
          }}
        >
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
            padding: '11px 20px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 800,
          }}
        >
          العودة للأصدقاء
        </button>
      </div>
    );
  }

  /*
   * ========================================
   * PLAYER DATA
   * ========================================
   */

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
    episode?.seasonNumber ||
    title?.current_season ||
    1;

  const episodeNumber =
    episode?.episode_number ||
    episode?.episode ||
    episode?.episodeNumber ||
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

  const poster =
    title?.poster_url ||
    title?.poster ||
    title?.poster_path ||
    '';

  const isHost =
    !!party &&
    !!user?.id &&
    party.host_id === user.id;

  /*
   * ========================================
   * RENDER
   * ========================================
   */

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'var(--bg)',
        color:
          'var(--text)',
        padding:
          '20px 12px 35px',
      }}
    >
      <div
        style={{
          maxWidth:
            '1250px',
          margin:
            '0 auto',
        }}
      >
        {/* ==================================
            HEADER
        ================================== */}

        <div
          style={{
            display:
              'flex',
            justifyContent:
              'space-between',
            alignItems:
              'center',
            gap:
              '15px',
            marginBottom:
              '18px',
            flexWrap:
              'wrap',
          }}
        >
          <div
            style={{
              minWidth: 0,
            }}
          >
            <div
              style={{
                color:
                  'var(--gold)',
                fontSize:
                  '11px',
                fontWeight:
                  900,
                letterSpacing:
                  '1.5px',
                marginBottom:
                  '5px',
              }}
            >
              PRIVATE WATCH PARTY
            </div>

            <h1
              style={{
                margin: 0,
                fontSize:
                  'clamp(21px, 4vw, 30px)',
                overflow:
                  'hidden',
                textOverflow:
                  'ellipsis',
              }}
            >
              {titleName}
            </h1>

            {contentType ===
              'tv' &&
              episode && (
                <div
                  style={{
                    color:
                      'var(--muted)',
                    fontSize:
                      '12px',
                    marginTop:
                      '5px',
                  }}
                >
                  الموسم{' '}
                  {season}
                  {' • '}
                  الحلقة{' '}
                  {episodeNumber}
                </div>
              )}

            <div
              style={{
                color:
                  'var(--muted)',
                fontSize:
                  '12px',
                marginTop:
                  '6px',
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
            onClick={
              exitParty
            }
            style={{
              border:
                '1px solid var(--border)',
              background:
                'var(--panel)',
              color:
                'var(--text)',
              padding:
                '10px 17px',
              borderRadius:
                '10px',
              cursor:
                leaving
                  ? 'default'
                  : 'pointer',
              opacity:
                leaving
                  ? 0.6
                  : 1,
              fontWeight:
                700,
            }}
          >
            {leaving
              ? '...'
              : '🚪 خروج'}
          </button>
        </div>

        {/* ==================================
            MAIN GRID
        ================================== */}

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'minmax(0, 1fr) 330px',
            gap:
              '15px',
            alignItems:
              'start',
          }}
        >
          {/* ==================================
              LEFT
          ================================== */}

          <div
            style={{
              minWidth:
                0,
            }}
          >
            {/* PLAYER */}

            <div
              style={{
                background:
                  '#000',
                borderRadius:
                  '14px',
                overflow:
                  'hidden',
                border:
                  '1px solid var(--border)',
                boxShadow:
                  '0 10px 35px rgba(0,0,0,.25)',
              }}
            >
              {tmdbId ? (
                <iframe
                  src={
                    playerUrl
                  }
                  title="StreamFlix Watch Party"
                  style={{
                    width:
                      '100%',
                    height:
                      'min(65vh, 700px)',
                    minHeight:
                      '420px',
                    border:
                      'none',
                    display:
                      'block',
                    background:
                      '#000',
                  }}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  style={{
                    height:
                      '420px',
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    gap:
                      '10px',
                    color:
                      '#777',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '40px',
                    }}
                  >
                    🎬
                  </div>

                  لم يتم العثور على TMDB ID
                </div>
              )}
            </div>

            {/* PARTY STATUS */}

            <div
              style={{
                marginTop:
                  '12px',
                padding:
                  '14px',
                background:
                  'var(--panel)',
                border:
                  '1px solid var(--border)',
                borderRadius:
                  '13px',
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'space-between',
                gap:
                  '12px',
                flexWrap:
                  'wrap',
              }}
            >
              <div>
                <strong>
                  {party.status ===
                  'live'
                    ? '🟢 الغرفة مباشرة'
                    : party.status ===
                        'ended'
                      ? '🔴 انتهت الغرفة'
                      : '🟡 الغرفة جاهزة'}
                </strong>

                <div
                  style={{
                    color:
                      'var(--muted)',
                    fontSize:
                      '11px',
                    marginTop:
                      '5px',
                  }}
                >
                  مشاهدة خاصة بين أعضاء
                  الغرفة
                </div>
              </div>

              <div
                style={{
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap:
                    '7px',
                  fontSize:
                    '12px',
                  color:
                    'var(--muted)',
                }}
              >
                <span>
                  👥
                </span>

                <strong
                  style={{
                    color:
                      'var(--text)',
                  }}
                >
                  {members.length}
                </strong>

                <span>
                  داخل الغرفة
                </span>
              </div>
            </div>

            {/* MOVIE INFO */}

            <div
              style={{
                marginTop:
                  '12px',
                padding:
                  '14px',
                background:
                  'var(--panel)',
                border:
                  '1px solid var(--border)',
                borderRadius:
                  '13px',
                display:
                  'flex',
                gap:
                  '12px',
              }}
            >
              {poster ? (
                <img
                  src={poster}
                  alt={titleName}
                  style={{
                    width:
                      '55px',
                    height:
                      '78px',
                    objectFit:
                      'cover',
                    borderRadius:
                      '8px',
                    flexShrink:
                      0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width:
                      '55px',
                    height:
                      '78px',
                    borderRadius:
                      '8px',
                    background:
                      'var(--panel-raised)',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    fontSize:
                      '25px',
                    flexShrink:
                      0,
                  }}
                >
                  🎬
                </div>
              )}

              <div
                style={{
                  minWidth:
                    0,
                }}
              >
                <strong>
                  {titleName}
                </strong>

                <div
                  style={{
                    marginTop:
                      '5px',
                    color:
                      'var(--muted)',
                    fontSize:
                      '12px',
                    lineHeight:
                      1.6,
                  }}
                >
                  {contentType ===
                  'tv'
                    ? `مسلسل • الموسم ${season} • الحلقة ${episodeNumber}`
                    : 'فيلم'}

                  <br />

                  الغرفة خاصة بالدعوات فقط.
                </div>
              </div>
            </div>
          </div>

          {/* ==================================
              RIGHT SIDEBAR
          ================================== */}

          <aside
            style={{
              position:
                'sticky',
              top:
                '15px',
              minWidth:
                0,
            }}
          >
            {/* MEMBERS */}

            <div
              style={{
                background:
                  'var(--panel)',
                border:
                  '1px solid var(--border)',
                borderRadius:
                  '14px',
                overflow:
                  'hidden',
                marginBottom:
                  '12px',
              }}
            >
              <div
                style={{
                  padding:
                    '13px 14px',
                  borderBottom:
                    '1px solid var(--border)',
                  fontWeight:
                    800,
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'space-between',
                }}
              >
                <span>
                  👥 أعضاء الغرفة
                </span>

                <span
                  style={{
                    color:
                      'var(--gold)',
                    fontSize:
                      '12px',
                  }}
                >
                  {members.length}
                </span>
              </div>

              <div
                style={{
                  padding:
                    '9px',
                  maxHeight:
                    '170px',
                  overflowY:
                    'auto',
                }}
              >
                {members.length ===
                0 ? (
                  <div
                    style={{
                      padding:
                        '12px',
                      color:
                        'var(--muted)',
                      fontSize:
                        '12px',
                      textAlign:
                        'center',
                    }}
                  >
                    لا يوجد أعضاء
                  </div>
                ) : (
                  members.map(
                    (member) => {
                      const memberProfile =
                        profiles[
                          member.user_id
                        ];

                      const name =
                        getProfileName(
                          member.user_id
                        );

                      const avatar =
                        memberProfile?.avatar_url;

                      const memberIsHost =
                        member.user_id ===
                        party.host_id;

                      return (
                        <div
                          key={
                            member.id ||
                            member.user_id
                          }
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap:
                              '9px',
                            padding:
                              '8px',
                            borderRadius:
                              '9px',
                          }}
                        >
                          {avatar ? (
                            <img
                              src={
                                avatar
                              }
                              alt={
                                name
                              }
                              style={{
                                width:
                                  '34px',
                                height:
                                  '34px',
                                borderRadius:
                                  '50%',
                                objectFit:
                                  'cover',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width:
                                  '34px',
                                height:
                                  '34px',
                                borderRadius:
                                  '50%',
                                background:
                                  'var(--panel-raised)',
                                display:
                                  'flex',
                                alignItems:
                                  'center',
                                justifyContent:
                                  'center',
                                fontSize:
                                  '15px',
                                flexShrink:
                                  0,
                              }}
                            >
                              👤
                            </div>
                          )}

                          <div
                            style={{
                              minWidth:
                                0,
                              flex: 1,
                            }}
                          >
                            <div
                              style={{
                                fontSize:
                                  '12px',
                                fontWeight:
                                  700,
                                overflow:
                                  'hidden',
                                textOverflow:
                                  'ellipsis',
                                whiteSpace:
                                  'nowrap',
                              }}
                            >
                              {name}
                            </div>

                            <div
                              style={{
                                color:
                                  memberIsHost
                                    ? 'var(--gold)'
                                    : 'var(--muted)',
                                fontSize:
                                  '10px',
                                marginTop:
                                  '2px',
                              }}
                            >
                              {memberIsHost
                                ? '👑 المضيف'
                                : '🟢 داخل الغرفة'}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </div>

            {/* CHAT */}

            <div
              style={{
                background:
                  'var(--panel)',
                border:
                  '1px solid var(--border)',
                borderRadius:
                  '14px',
                overflow:
                  'hidden',
                display:
                  'flex',
                flexDirection:
                  'column',
                height:
                  'calc(100vh - 265px)',
                minHeight:
                  '480px',
                maxHeight:
                  '720px',
              }}
            >
              {/* CHAT HEADER */}

              <div
                style={{
                  padding:
                    '13px 14px',
                  borderBottom:
                    '1px solid var(--border)',
                  display:
                    'flex',
                  alignItems:
                    'center',
                  gap:
                    '9px',
                }}
              >
                <div
                  style={{
                    width:
                      '35px',
                    height:
                      '35px',
                    borderRadius:
                      '10px',
                    background:
                      'var(--panel-raised)',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                  }}
                >
                  💬
                </div>

                <div>
                  <strong
                    style={{
                      fontSize:
                        '13px',
                    }}
                  >
                    Party Chat
                  </strong>

                  <div
                    style={{
                      fontSize:
                        '10px',
                      color:
                        'var(--muted)',
                      marginTop:
                        '2px',
                    }}
                  >
                    دردشة خاصة أثناء المشاهدة
                  </div>
                </div>
              </div>

              {/* MESSAGES */}

              <div
                style={{
                  flex:
                    1,
                  overflowY:
                    'auto',
                  padding:
                    '12px',
                }}
              >
                {messages.length ===
                0 ? (
                  <div
                    style={{
                      minHeight:
                        '100%',
                      display:
                        'flex',
                      flexDirection:
                        'column',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      color:
                        'var(--muted)',
                      textAlign:
                        'center',
                      padding:
                        '25px',
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          '35px',
                        marginBottom:
                          '8px',
                      }}
                    >
                      🍿
                    </div>

                    <strong>
                      بداية المشاهدة
                    </strong>

                    <span
                      style={{
                        fontSize:
                          '11px',
                        marginTop:
                          '5px',
                      }}
                    >
                      اكتب أول رسالة وابدأو التقسيرة 😎
                    </span>
                  </div>
                ) : (
                  messages.map(
                    (message) => {
                      const own =
                        message.sender_id ===
                        user?.id;

                      const name =
                        getProfileName(
                          message.sender_id
                        );

                      const profile =
                        profiles[
                          message.sender_id
                        ];

                      const time =
                        message.created_at
                          ? new Date(
                              message.created_at
                            ).toLocaleTimeString(
                              [],
                              {
                                hour:
                                  '2-digit',
                                minute:
                                  '2-digit',
                              }
                            )
                          : '';

                      return (
                        <div
                          key={
                            message.id
                          }
                          style={{
                            display:
                              'flex',
                            justifyContent:
                              own
                                ? 'flex-end'
                                : 'flex-start',
                            marginBottom:
                              '10px',
                          }}
                        >
                          <div
                            style={{
                              maxWidth:
                                '88%',
                            }}
                          >
                            {!own && (
                              <div
                                style={{
                                  fontSize:
                                    '10px',
                                  color:
                                    'var(--gold)',
                                  fontWeight:
                                    700,
                                  marginBottom:
                                    '3px',
                                  paddingInline:
                                    '5px',
                                }}
                              >
                                {name}
                              </div>
                            )}

                            <div
                              style={{
                                background:
                                  own
                                    ? 'var(--gold)'
                                    : 'var(--panel-raised)',
                                color:
                                  own
                                    ? '#111'
                                    : 'var(--text)',
                                borderRadius:
                                  own
                                    ? '13px 13px 4px 13px'
                                    : '13px 13px 13px 4px',
                                padding:
                                  '9px 10px',
                                border:
                                  own
                                    ? 'none'
                                    : '1px solid var(--border)',
                              }}
                            >
                              {message.kind ===
                              'voice' ? (
                                <div
                                  style={{
                                    minWidth:
                                      '190px',
                                  }}
                                >
                                  <div
                                    style={{
                                      display:
                                        'flex',
                                      alignItems:
                                        'center',
                                      gap:
                                        '7px',
                                      marginBottom:
                                        '5px',
                                      fontSize:
                                        '11px',
                                      fontWeight:
                                        700,
                                    }}
                                  >
                                    🎙️ رسالة صوتية

                                    {message
                                      .metadata
                                      ?.duration ? (
                                      <span
                                        style={{
                                          opacity:
                                            0.7,
                                          fontWeight:
                                            500,
                                        }}
                                      >
                                        {formatTime(
                                          Number(
                                            message
                                              .metadata
                                              .duration
                                          )
                                        )}
                                      </span>
                                    ) : null}
                                  </div>

                                  <audio
                                    controls
                                    preload="metadata"
                                    src={
                                      message.content
                                    }
                                    style={{
                                      width:
                                        '100%',
                                      maxWidth:
                                        '250px',
                                      height:
                                        '38px',
                                    }}
                                  />
                                </div>
                              ) : (
                                <div
                                  style={{
                                    fontSize:
                                      '13px',
                                    lineHeight:
                                      1.55,
                                    whiteSpace:
                                      'pre-wrap',
                                    overflowWrap:
                                      'anywhere',
                                  }}
                                >
                                  {
                                    message.content
                                  }
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                fontSize:
                                  '9px',
                                color:
                                  'var(--muted)',
                                marginTop:
                                  '3px',
                                textAlign:
                                  own
                                    ? 'right'
                                    : 'left',
                                paddingInline:
                                  '5px',
                              }}
                            >
                              {time}

                              {profile?.username
                                ? ` • @${profile.username}`
                                : ''}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                )}

                <div
                  ref={
                    messagesEndRef
                  }
                />
              </div>

              {/* RECORDING BAR */}

              {(recording ||
                uploadingVoice) && (
                <div
                  style={{
                    padding:
                      '9px 10px',
                    borderTop:
                      '1px solid var(--border)',
                    background:
                      'var(--panel-raised)',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'space-between',
                    gap:
                      '10px',
                  }}
                >
                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap:
                        '8px',
                      fontSize:
                        '11px',
                    }}
                  >
                    <span>
                      {recording
                        ? '🔴'
                        : '⏳'}
                    </span>

                    <strong>
                      {recording
                        ? `تسجيل ${formatTime(
                            recordingTime
                          )}`
                        : 'جاري رفع الصوت...'}
                    </strong>
                  </div>

                  {recording && (
                    <button
                      type="button"
                      onClick={
                        stopRecording
                      }
                      style={{
                        border:
                          'none',
                        background:
                          '#d33',
                        color:
                          '#fff',
                        borderRadius:
                          '8px',
                        padding:
                          '7px 10px',
                        cursor:
                          'pointer',
                        fontWeight:
                          800,
                        fontSize:
                          '11px',
                      }}
                    >
                      ⏹ إيقاف
                    </button>
                  )}
                </div>
              )}

              {/* INPUT */}

              <form
                onSubmit={
                  sendTextMessage
                }
                style={{
                  padding:
                    '10px',
                  borderTop:
                    '1px solid var(--border)',
                  display:
                    'flex',
                  alignItems:
                    'flex-end',
                  gap:
                    '7px',
                }}
              >
                <button
                  type="button"
                  disabled={
                    recording ||
                    uploadingVoice
                  }
                  onClick={
                    startRecording
                  }
                  title="تسجيل رسالة صوتية"
                  style={{
                    width:
                      '40px',
                    height:
                      '40px',
                    flexShrink:
                      0,
                    border:
                      '1px solid var(--border)',
                    background:
                      'var(--panel-raised)',
                    color:
                      'var(--text)',
                    borderRadius:
                      '10px',
                    cursor:
                      recording ||
                      uploadingVoice
                        ? 'default'
                        : 'pointer',
                    opacity:
                      recording ||
                      uploadingVoice
                        ? 0.5
                        : 1,
                    fontSize:
                      '17px',
                  }}
                >
                  🎙️
                </button>

                <textarea
                  value={
                    messageText
                  }
                  onChange={(event) =>
                    setMessageText(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleMessageKeyDown
                  }
                  disabled={
                    sending ||
                    recording ||
                    uploadingVoice
                  }
                  placeholder="اكتب رسالة..."
                  rows={1}
                  style={{
                    flex:
                      1,
                    minWidth:
                      0,
                    resize:
                      'none',
                    minHeight:
                      '40px',
                    maxHeight:
                      '100px',
                    border:
                      '1px solid var(--border)',
                    background:
                      'var(--panel-raised)',
                    color:
                      'var(--text)',
                    borderRadius:
                      '10px',
                    padding:
                      '10px 11px',
                    outline:
                      'none',
                    fontFamily:
                      'inherit',
                    fontSize:
                      '12px',
                  }}
                />

                <button
                  type="submit"
                  disabled={
                    sending ||
                    recording ||
                    uploadingVoice ||
                    !messageText.trim()
                  }
                  style={{
                    width:
                      '40px',
                    height:
                      '40px',
                    flexShrink:
                      0,
                    border:
                      'none',
                    background:
                      'var(--gold)',
                    color:
                      '#111',
                    borderRadius:
                      '10px',
                    cursor:
                      sending ||
                      recording ||
                      uploadingVoice ||
                      !messageText.trim()
                        ? 'default'
                        : 'pointer',
                    opacity:
                      sending ||
                      recording ||
                      uploadingVoice ||
                      !messageText.trim()
                        ? 0.5
                        : 1,
                    fontSize:
                      '16px',
                    fontWeight:
                      900,
                  }}
                >
                  ➤
                </button>
              </form>
            </div>
          </aside>
        </div>

        {/* ==================================
            MOBILE NOTE
        ================================== */}

        <div
          style={{
            marginTop:
              '12px',
            color:
              'var(--muted)',
            fontSize:
              '10px',
            lineHeight:
              1.7,
            textAlign:
              'center',
          }}
        >
          🔒 هذه الغرفة خاصة بالأعضاء المدعوين فقط.
          <br />
          💬 الدردشة والرسائل الصوتية خاصة بغرفة المشاهدة.
        </div>
      </div>

      {/* ====================================
          RESPONSIVE STYLE
      ==================================== */}

      <style>
        {`
          @media (max-width: 850px) {
            .watch-party-mobile-fix {
              display: block;
            }
          }

          @media (max-width: 850px) {
            body {
              overflow-x: hidden;
            }
          }
        `}
      </style>
    </div>
  );
}

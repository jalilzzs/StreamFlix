import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

import './WatchParty.css';

export default function WatchParty() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isPremium } = useAuth();

  const hasVipAccess = Boolean(isPremium);

  const [party, setParty] = useState(null);
  const [title, setTitle] = useState(null);
  const [episode, setEpisode] = useState(null);

  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [messages, setMessages] = useState([]);

  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // =========================================================================
  // LOAD MEMBERS
  // =========================================================================

  async function loadMembers(partyId) {
    if (!partyId || !hasVipAccess) return;

    try {
      const { data, error: membersError } = await supabase
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
            .map((item) => item.user_id)
            .filter(Boolean)
        ),
      ];

      if (!userIds.length) {
        return;
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, username, display_name, avatar_url'
          )
          .in('id', userIds);

      if (profileError) {
        console.error(
          'Profiles loading error:',
          profileError
        );
        return;
      }

      const profileMap = {};

      (profileData || []).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles((current) => ({
        ...current,
        ...profileMap,
      }));
    } catch (err) {
      console.error(
        'Members loading error:',
        err
      );
    }
  }

  // =========================================================================
  // LOAD MESSAGES
  // =========================================================================

  async function loadMessages(partyId) {
    if (!partyId || !hasVipAccess) return;

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

      const senderIds = [
        ...new Set(
          list
            .map((item) => item.sender_id)
            .filter(Boolean)
        ),
      ];

      if (!senderIds.length) {
        return;
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, username, display_name, avatar_url'
          )
          .in('id', senderIds);

      if (profileError) {
        console.error(
          'Message profiles loading error:',
          profileError
        );
        return;
      }

      const profileMap = {};

      (profileData || []).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles((current) => ({
        ...current,
        ...profileMap,
      }));
    } catch (err) {
      console.error(
        'Party messages loading error:',
        err
      );
    }
  }

  // =========================================================================
  // LOAD PROFILE
  // =========================================================================

  async function loadProfile(userId) {
    if (!userId || !hasVipAccess) return;

    if (profiles[userId]) {
      return;
    }

    try {
      const { data, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, username, display_name, avatar_url'
          )
          .eq('id', userId)
          .maybeSingle();

      if (profileError) {
        console.error(
          'Profile loading error:',
          profileError
        );
        return;
      }

      if (data) {
        setProfiles((current) => ({
          ...current,
          [userId]: data,
        }));
      }
    } catch (err) {
      console.error(
        'Profile loading error:',
        err
      );
    }
  }

  // =========================================================================
  // OPEN PARTY
  // =========================================================================

  useEffect(() => {
    let cancelled = false;

    async function openParty() {
      if (!id || !user?.id) {
        return;
      }

      // ---------------------------------------------------------------------
      // VIP GATE
      // ---------------------------------------------------------------------

      if (!hasVipAccess) {
        setLoading(false);
        setParty(null);
        setError(
          'ميزة Watch Party متاحة لمشتركي VIP فقط'
        );
        return;
      }

      try {
        setLoading(true);
        setError('');

        const partyData = await getWatchParty(id);

        if (!partyData) {
          throw new Error(
            'غرفة المشاهدة غير موجودة'
          );
        }

        await joinWatchParty(
          id,
          user.id
        );

        if (cancelled) {
          return;
        }

        setParty(partyData);

        if (partyData.title_id) {
          try {
            const titleData =
              await fetchTitleById(
                partyData.title_id
              );

            if (!cancelled) {
              setTitle(titleData);
            }

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

        await Promise.all([
          loadMembers(id),
          loadMessages(id),
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
  }, [
    id,
    user?.id,
    hasVipAccess,
  ]);

  // =========================================================================
  // PARTY REALTIME
  // =========================================================================

  useEffect(() => {
    if (!id || !user?.id || !hasVipAccess) {
      return;
    }

    const unsubscribe =
      subscribeToParty(
        id,
        async (updatedParty) => {
          if (!updatedParty) {
            return;
          }

          setParty((current) => ({
            ...(current || {}),
            ...updatedParty,
          }));

          if (
            updatedParty.status ===
            'ended'
          ) {
            setError(
              'المضيف أنهى غرفة المشاهدة'
            );
            return;
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
  }, [
    id,
    user?.id,
    hasVipAccess,
  ]);

  // =========================================================================
  // MEMBERS + CHAT REALTIME
  // =========================================================================

  useEffect(() => {
    if (!id || !user?.id || !hasVipAccess) {
      return;
    }

    // -----------------------------------------------------------------------
    // MEMBERS CHANNEL
    // -----------------------------------------------------------------------

    const membersChannel =
      supabase
        .channel(
          `watch-party-members:${id}:${user?.id || 'guest'}`
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'watch_party_members',
            filter: `party_id=eq.${id}`,
          },
          async (payload) => {
            console.log(
              'Watch Party member realtime:',
              payload
            );

            await loadMembers(id);
          }
        )
        .subscribe((status) => {
          console.log(
            'Members realtime status:',
            status
          );

          if (status === 'SUBSCRIBED') {
            loadMembers(id);
          }
        });

    // -----------------------------------------------------------------------
    // CHAT CHANNEL
    // -----------------------------------------------------------------------

    const messagesChannel =
      supabase
        .channel(
          `watch-party-messages:${id}:${user?.id || 'guest'}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'watch_party_messages',
            filter: `party_id=eq.${id}`,
          },
          async (payload) => {
            const newMessage =
              payload.new;

            if (!newMessage?.id) {
              return;
            }

            setMessages((current) => {
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
            });

            await loadProfile(
              newMessage.sender_id
            );
          }
        )
        .subscribe((status) => {
          console.log(
            'Messages realtime status:',
            status
          );

          if (status === 'SUBSCRIBED') {
            loadMessages(id);
          }
        });

    return () => {
      supabase.removeChannel(
        membersChannel
      );

      supabase.removeChannel(
        messagesChannel
      );
    };
  }, [
    id,
    user?.id,
    hasVipAccess,
  ]);

  // =========================================================================
  // AUTO SCROLL CHAT
  // =========================================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  // =========================================================================
  // SEND TEXT MESSAGE
  // =========================================================================

  async function sendTextMessage(event) {
    event?.preventDefault();

    const text =
      messageText.trim();

    if (
      !hasVipAccess ||
      !text ||
      !id ||
      !user?.id ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setError('');

      const { data, error: sendError } =
        await supabase
          .from('watch_party_messages')
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
        setMessages((current) => {
          if (
            current.some(
              (item) =>
                item.id === data.id
            )
          ) {
            return current;
          }

          return [
            ...current,
            data,
          ];
        });
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

  // =========================================================================
  // START VOICE RECORDING
  // =========================================================================

  async function startRecording() {
    // -----------------------------------------------------------------------
    // VIP GATE
    // -----------------------------------------------------------------------

    if (!hasVipAccess) {
      setError(
        '🎙️ الرسائل الصوتية متاحة لمشتركي VIP فقط'
      );
      return;
    }

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
            await uploadChatMedia({
              userId: user.id,
              file: voiceFile,
              kind: 'voice',
            });

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
            error: messageError,
          } = await supabase
            .from('watch_party_messages')
            .insert({
              party_id: id,
              sender_id: user.id,
              kind: 'voice',
              content: voiceUrl,
              metadata,
            })
            .select('*')
            .single();

          if (messageError) {
            throw messageError;
          }

          if (data) {
            setMessages((current) => {
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
            });
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
          setUploadingVoice(false);
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

  // =========================================================================
  // STOP RECORDING
  // =========================================================================

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

  // =========================================================================
  // CLEANUP
  // =========================================================================

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
          // cleanup
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

  // =========================================================================
  // HELPERS
  // =========================================================================

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

  function getProfileName(userId) {
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

  // =========================================================================
  // EXIT PARTY
  // =========================================================================

  async function exitParty() {
    if (leaving) {
      return;
    }

    try {
      setLeaving(true);

      if (
        id &&
        user?.id &&
        hasVipAccess
      ) {
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

  // =========================================================================
  // LOADING
  // =========================================================================

  if (loading) {
    return (
      <div className="watch-party-loading">
        جاري فتح غرفة المشاهدة...
      </div>
    );
  }

  // =========================================================================
  // VIP LOCK
  // =========================================================================

  if (!hasVipAccess) {
    return (
      <div className="watch-party-error-page">
        <div
          className="watch-party-error-icon"
          style={{
            fontSize: '48px',
          }}
        >
          ⭐🔒
        </div>

        <h2>
          Watch Party متاحة لـ VIP فقط
        </h2>

        <p
          style={{
            maxWidth: '520px',
            margin: '0 auto 20px',
            lineHeight: 1.7,
            opacity: 0.8,
          }}
        >
          هذه الميزة حصرية لمشتركي VIP.
          <br />
          اشترك في VIP للاستفادة من المشاهدة
          الجماعية والدردشة والرسائل الصوتية.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() =>
              navigate('/subscription')
            }
          >
            ⭐ الترقية إلى VIP
          </button>

          <button
            type="button"
            onClick={() =>
              navigate('/friends')
            }
          >
            العودة للأصدقاء
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ERROR
  // =========================================================================

  if (!party || error) {
    return (
      <div className="watch-party-error-page">
        <div className="watch-party-error-icon">
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
        >
          العودة للأصدقاء
        </button>
      </div>
    );
  }

  // =========================================================================
  // PLAYER DATA
  // =========================================================================

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
    party.host_id === user?.id;

  // =========================================================================
  // UI
  // =========================================================================

  return (
    <div className="watch-party-page">
      <div className="watch-party-container">

        <header className="watch-party-top">
          <div className="watch-party-heading">

            <div className="watch-party-kicker">
              PRIVATE WATCH PARTY ⭐ VIP
            </div>

            <h1>
              {titleName}
            </h1>

            {contentType === 'tv' &&
              episode && (
                <span>
                  الموسم {season}
                  {' • '}
                  الحلقة {episodeNumber}
                </span>
              )}

            <span className="watch-party-role">
              {isHost
                ? '👑 أنت المضيف'
                : '👥 أنت مشارك في الغرفة'}
            </span>
          </div>

          <button
            className="watch-party-exit"
            type="button"
            disabled={leaving}
            onClick={exitParty}
          >
            {leaving
              ? '...'
              : '🚪 خروج'}
          </button>
        </header>

        <main className="watch-party-layout">

          <section className="watch-party-main">

            <div className="watch-party-player">
              {tmdbId ? (
                <iframe
                  src={playerUrl}
                  title="StreamFlix Watch Party"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="watch-party-no-player">
                  <div>
                    🎬
                  </div>

                  لم يتم العثور على TMDB ID
                </div>
              )}
            </div>

            <div className="watch-party-sync">

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

                <span>
                  ⭐ مشاهدة خاصة لمشتركي VIP
                </span>
              </div>

              <div className="watch-party-count">
                👥{' '}
                <b>
                  {members.length}
                </b>{' '}
                داخل الغرفة
              </div>
            </div>

            <div className="watch-party-movie-card">

              {poster ? (
                <img
                  src={poster}
                  alt={titleName}
                />
              ) : (
                <div className="watch-party-poster-placeholder">
                  🎬
                </div>
              )}

              <div>
                <strong>
                  {titleName}
                </strong>

                <p>
                  {contentType ===
                  'tv'
                    ? `مسلسل • الموسم ${season} • الحلقة ${episodeNumber}`
                    : 'فيلم'}

                  <br />

                  ⭐ الغرفة متاحة لمشتركي VIP.
                </p>
              </div>
            </div>
          </section>

          <aside className="watch-party-sidebar">

            {/* MEMBERS */}

            <section className="watch-party-panel watch-party-members">

              <div className="watch-party-panel-title">
                <b>
                  👥 أعضاء الغرفة
                </b>

                <span>
                  {members.length}
                </span>
              </div>

              <div className="watch-party-member-list">

                {members.length ===
                0 ? (
                  <div className="watch-party-empty">
                    لا يوجد أعضاء
                  </div>
                ) : (
                  members.map(
                    (member) => {
                      const profile =
                        profiles[
                          member.user_id
                        ];

                      const name =
                        getProfileName(
                          member.user_id
                        );

                      const host =
                        member.user_id ===
                        party.host_id;

                      return (
                        <div
                          className="watch-party-member"
                          key={
                            member.id ||
                            member.user_id
                          }
                        >

                          {profile?.avatar_url ? (
                            <img
                              src={
                                profile.avatar_url
                              }
                              alt={name}
                            />
                          ) : (
                            <div className="watch-party-avatar">
                              👤
                            </div>
                          )}

                          <div className="watch-party-member-info">

                            <b>
                              {name}
                            </b>

                            <span
                              className={
                                host
                                  ? 'host'
                                  : ''
                              }
                            >
                              {host
                                ? '👑 المضيف'
                                : '🟢 داخل الغرفة'}
                            </span>

                          </div>
                        </div>
                      );
                    }
                  )
                )}

              </div>
            </section>

            {/* CHAT */}

            <section className="watch-party-panel watch-party-chat">

              <div className="watch-party-chat-header">

                <div className="watch-party-chat-icon">
                  💬
                </div>

                <div>
                  <b>
                    Party Chat ⭐ VIP
                  </b>

                  <span>
                    دردشة خاصة أثناء المشاهدة
                  </span>
                </div>

              </div>

              <div className="watch-party-messages">

                {messages.length ===
                0 ? (
                  <div className="watch-party-chat-empty">

                    <div>
                      🍿
                    </div>

                    <b>
                      بداية المشاهدة
                    </b>

                    <span>
                      اكتب أول رسالة وابدأو التقسيرة 😎
                    </span>

                  </div>
                ) : (
                  messages.map(
                    (message) => {
                      const own =
                        message.sender_id ===
                        user?.id;

                      const profile =
                        profiles[
                          message.sender_id
                        ];

                      const name =
                        getProfileName(
                          message.sender_id
                        );

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
                          className={`watch-party-message-row ${
                            own
                              ? 'own'
                              : ''
                          }`}
                        >

                          <div className="watch-party-message-wrap">

                            {!own && (
                              <div className="watch-party-sender">
                                {name}
                              </div>
                            )}

                            <div
                              className={`watch-party-bubble ${
                                own
                                  ? 'own'
                                  : ''
                              }`}
                            >

                              {message.kind ===
                              'voice' ? (
                                <>
                                  <div className="watch-party-voice-label">

                                    🎙️ رسالة صوتية ⭐

                                    {message.metadata?.duration ? (
                                      <small>
                                        {formatTime(
                                          Number(
                                            message
                                              .metadata
                                              .duration
                                          )
                                        )}
                                      </small>
                                    ) : null}

                                  </div>

                                  <audio
                                    controls
                                    preload="metadata"
                                    src={
                                      message.content
                                    }
                                  />
                                </>
                              ) : (
                                <div className="watch-party-text">
                                  {
                                    message.content
                                  }
                                </div>
                              )}

                            </div>

                            <div className="watch-party-message-meta">

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

              {(recording ||
                uploadingVoice) && (
                <div className="watch-party-recording-bar">

                  <b>
                    {recording
                      ? `🔴 تسجيل ${formatTime(
                          recordingTime
                        )}`
                      : '⏳ جاري رفع الصوت...'}
                  </b>

                  {recording && (
                    <button
                      type="button"
                      onClick={
                        stopRecording
                      }
                    >
                      ⏹ إيقاف
                    </button>
                  )}

                </div>
              )}

              <form
                className="watch-party-input"
                onSubmit={
                  sendTextMessage
                }
              >

                <button
                  type="button"
                  className="watch-party-icon-btn"
                  disabled={
                    recording ||
                    uploadingVoice
                  }
                  onClick={
                    startRecording
                  }
                  title="تسجيل رسالة صوتية - VIP"
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
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                        'Enter' &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      sendTextMessage(
                        event
                      );
                    }
                  }}
                  disabled={
                    sending ||
                    recording ||
                    uploadingVoice
                  }
                  placeholder="اكتب رسالة..."
                  rows={1}
                />

                <button
                  type="submit"
                  className="watch-party-send-btn"
                  disabled={
                    sending ||
                    recording ||
                    uploadingVoice ||
                    !messageText.trim()
                  }
                >
                  ➤
                </button>

              </form>

            </section>

          </aside>

        </main>

        <div className="watch-party-note">
          ⭐ Watch Party حصرية لمشتركي VIP.
          <br />
          💬 الدردشة والرسائل الصوتية خاصة بغرفة المشاهدة.
        </div>

      </div>
    </div>
  );
}

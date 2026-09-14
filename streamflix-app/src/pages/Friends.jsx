import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchFriends,
  fetchPendingRequests,
  sendFriendRequestByCode,
  respondToFriendRequest,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  createWatchParty,
  uploadChatMedia,
} from '../lib/api';
import './Friends.css';

export default function Friends() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [addValue, setAddValue] = useState('');
  const [error, setError] = useState(null);

  const [showWatchParty, setShowWatchParty] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const userId = user?.id;

  /* =========================
     LOAD FRIENDS
  ========================= */

  const loadFriends = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);

      const [friendsData, pendingData] = await Promise.all([
        fetchFriends(userId),
        fetchPendingRequests(userId),
      ]);

      setFriends(friendsData || []);
      setPending(pendingData || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to load friends.');
    }
  }, [userId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  /* =========================
     LOAD CHAT
  ========================= */

  const loadMessages = useCallback(async () => {
    if (!userId || !activeFriend?.id) {
      setMessages([]);
      return;
    }

    try {
      const data = await fetchMessages(userId, activeFriend.id);
      setMessages(data || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to load messages.');
    }
  }, [userId, activeFriend]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  /* =========================
     REALTIME MESSAGES
  ========================= */

  useEffect(() => {
    if (!userId || !activeFriend?.id) return;

    const unsubscribe = subscribeToMessages(
      userId,
      activeFriend.id,
      (newMessage) => {
        setMessages((current) => {
          const alreadyExists = current.some(
            (message) => message.id === newMessage.id
          );

          if (alreadyExists) return current;

          return [...current, newMessage];
        });
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId, activeFriend]);

  /* =========================
     AUTO SCROLL
  ========================= */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages]);

  /* =========================
     ADD FRIEND
  ========================= */

  const handleAddFriend = async (event) => {
    event.preventDefault();

    const code = addValue.trim();

    if (!code) return;

    try {
      setError(null);

      await sendFriendRequestByCode({
        userId,
        friendCode: code,
      });

      setAddValue('');
      await loadFriends();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to send friend request.');
    }
  };

  /* =========================
     RESPOND FRIEND REQUEST
  ========================= */

  const handleFriendRequest = async (requestId, accept) => {
    try {
      setError(null);

      await respondToFriendRequest({
        requestId,
        accept,
      });

      await loadFriends();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to update friend request.');
    }
  };

  /* =========================
     SEND TEXT
  ========================= */

  const handleSendMessage = async (event) => {
    event?.preventDefault();

    const text = input.trim();

    if (!text || !userId || !activeFriend?.id) return;

    try {
      setInput('');
      setError(null);

      const message = await sendMessage({
        senderId: userId,
        receiverId: activeFriend.id,
        kind: 'text',
        content: text,
      });

      setMessages((current) => {
        const exists = current.some((item) => item.id === message.id);
        return exists ? current : [...current, message];
      });
    } catch (err) {
      console.error(err);
      setInput(text);
      setError(err?.message || 'Unable to send message.');
    }
  };

  /* =========================
     IMAGE UPLOAD
  ========================= */

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file || !activeFriend?.id || !userId) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image.');
      return;
    }

    try {
      setUploadingMedia(true);
      setError(null);

      const uploaded = await uploadChatMedia({
        userId,
        file,
        kind: 'image',
      });

      const message = await sendMessage({
        senderId: userId,
        receiverId: activeFriend.id,
        kind: 'image',
        content: uploaded.url,
      });

      setMessages((current) => {
        const exists = current.some((item) => item.id === message.id);
        return exists ? current : [...current, message];
      });
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to upload image.');
    } finally {
      setUploadingMedia(false);
    }
  };

  /* =========================
     VOICE RECORDING
  ========================= */

  const getSupportedAudioMime = () => {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];

    return types.find((type) => {
      try {
        return MediaRecorder.isTypeSupported(type);
      } catch {
        return false;
      }
    }) || '';
  };

  const startVoiceRecording = async () => {
    if (!userId || !activeFriend?.id) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported by this browser.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported by this browser.');
      return;
    }

    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mimeType = getSupportedAudioMime();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Voice recording failed.');

        stream.getTracks().forEach((track) => track.stop());

        setRecordingVoice(false);
        mediaRecorderRef.current = null;
      };

      recorder.onstop = async () => {
        try {
          setUploadingMedia(true);

          const actualType =
            recorder.mimeType ||
            mimeType ||
            'audio/webm';

          const extension = actualType.includes('mp4')
            ? 'mp4'
            : actualType.includes('ogg')
              ? 'ogg'
              : 'webm';

          const blob = new Blob(audioChunksRef.current, {
            type: actualType,
          });

          if (!blob.size) {
            throw new Error('Empty voice recording.');
          }

          const file = new File(
            [blob],
            `voice-${Date.now()}.${extension}`,
            {
              type: actualType,
            }
          );

          const uploaded = await uploadChatMedia({
            userId,
            file,
            kind: 'voice',
          });

          const message = await sendMessage({
            senderId: userId,
            receiverId: activeFriend.id,
            kind: 'voice',
            content: uploaded.url,
          });

          setMessages((current) => {
            const exists = current.some(
              (item) => item.id === message.id
            );

            return exists
              ? current
              : [...current, message];
          });
        } catch (err) {
          console.error(err);
          setError(err?.message || 'Unable to send voice message.');
        } finally {
          setUploadingMedia(false);

          stream.getTracks().forEach((track) => {
            track.stop();
          });

          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      };

      recorder.start();
      setRecordingVoice(true);
    } catch (err) {
      console.error(err);

      setRecordingVoice(false);

      if (err?.name === 'NotAllowedError') {
        setError('Microphone permission was denied.');
      } else {
        setError(err?.message || 'Unable to access microphone.');
      }
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) return;

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }

    setRecordingVoice(false);
  };

  const handleVoiceButton = () => {
    if (recordingVoice) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  /* =========================
     WATCH PARTY
  ========================= */

  const handleCreateWatchParty = async () => {
    if (!userId || !activeFriend?.id) return;

    try {
      setError(null);

      await createWatchParty({
        hostId: userId,
        friendId: activeFriend.id,
      });

      setShowWatchParty(false);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Unable to create watch party.');
    }
  };

  /* =========================
     HELPERS
  ========================= */

  const getFriendProfile = (friend) => {
    if (!friend) return null;
    if (friend.profile) return friend.profile;
    if (friend.friend) return friend.friend;
    if (friend.user) return friend.user;
    return friend;
  };

  const getFriendName = (friend) => {
    const profile = getFriendProfile(friend);
    return (
      profile?.display_name ||
      profile?.username ||
      profile?.name ||
      'StreamFlix User'
    );
  };

  const getFriendAvatar = (friend) => {
    const profile = getFriendProfile(friend);
    return profile?.avatar_url || profile?.avatar || '';
  };

  const getFriendId = (friend) => {
    const profile = getFriendProfile(friend);
    return (
      profile?.id ||
      friend?.friend_id ||
      friend?.user_id ||
      friend?.id
    );
  };

  const getMessageText = (message) => {
    if (!message) return '';
    return message.content || '';
  };

  const isMine = (message) => {
    return message?.sender_id === userId;
  };

  const formatTime = (dateValue) => {
    if (!dateValue) return '';

    try {
      return new Date(dateValue).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className={`friends-app ${activeFriend ? 'has-active-chat' : ''}`}>
      <div className="app-grid">

        {/* SIDEBAR */}
        <aside className="friends-col">
          <div className="friends-head">
            <div className="friends-title-row">
              <div>
                <h2>{t('friends') || 'الأصدقاء'}</h2>
                <span className="friends-subtitle">
                  مجتمع StreamFlix الخاص بك
                </span>
              </div>
            </div>

            <form
              className="add-friend-row"
              onSubmit={handleAddFriend}
            >
              <input
                value={addValue}
                onChange={(event) => setAddValue(event.target.value)}
                placeholder="كود الصديق..."
                autoComplete="off"
              />
              <button type="submit">إضافة</button>
            </form>

            {userId && (
              <div className="my-uid">
                الكود الخاص بك: <span>#{userId.slice(0, 8)}</span>
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div className="pending-list">
              {pending.map((request) => {
                const requester =
                  request.requester ||
                  request.sender ||
                  request.profile ||
                  request;

                const requesterName =
                  requester?.display_name ||
                  requester?.username ||
                  requester?.name ||
                  'User';

                return (
                  <div className="pending-item" key={request.id}>
                    <div className="pending-info">
                      <span className="pending-name">{requesterName}</span>
                      <span className="pending-desc">أرسل لك طلب صداقة</span>
                    </div>
                    <div className="pending-actions">
                      <button
                        type="button"
                        className="btn-accept"
                        onClick={() => handleFriendRequest(request.id, true)}
                      >
                        قبول
                      </button>
                      <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleFriendRequest(request.id, false)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="friend-list">
            {friends.length === 0 ? (
              <div className="friends-empty">
                <div className="friends-empty-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <strong>لا يوجد أصدقاء بعد</strong>
                <span>أضف أصدقائك بوضع كود الصديق أعلاه.</span>
              </div>
            ) : (
              friends.map((friend) => {
                const friendId = getFriendId(friend);
                const friendName = getFriendName(friend);
                const avatar = getFriendAvatar(friend);
                const active = activeFriend && getFriendId(activeFriend) === friendId;

                return (
                  <button
                    type="button"
                    className={`friend-item ${active ? 'active' : ''}`}
                    key={friendId}
                    onClick={() => {
                      setActiveFriend(friend);
                      setError(null);
                    }}
                  >
                    <div
                      className="fav"
                      style={
                        avatar ? { backgroundImage: `url("${avatar}")` } : undefined
                      }
                    >
                      {!avatar && (
                        <span className="avatar-letter">
                          {friendName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="dot online" />
                    </div>

                    <div className="finfo">
                      <div className="fname">{friendName}</div>
                      <div className="flast">
                        {active ? 'المحادثة النشطة' : 'انقر لبدء الشات'}
                      </div>
                    </div>

                    <span className="friend-arrow">‹</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* CHAT MAIN */}
        <main className="chat-col">
          {!activeFriend ? (
            <div className="chat-empty">
              <div className="chat-empty-orb">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h2>محادثات StreamFlix</h2>
              <p>اختر صديقاً لبدء المحادثة أو مشاهدة العروض معاً بـ Watch Party.</p>
            </div>
          ) : (
            <>
              <header className="chat-head">
                <button 
                  type="button" 
                  className="chat-back-btn" 
                  onClick={() => setActiveFriend(null)}
                  aria-label="Back to friends list"
                >
                  ›
                </button>

                <div
                  className="fav"
                  style={
                    getFriendAvatar(activeFriend)
                      ? { backgroundImage: `url("${getFriendAvatar(activeFriend)}")` }
                      : undefined
                  }
                >
                  {!getFriendAvatar(activeFriend) && (
                    <span className="avatar-letter">
                      {getFriendName(activeFriend).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="dot online" />
                </div>

                <div className="chat-head-info">
                  <div className="chat-head-name">{getFriendName(activeFriend)}</div>
                  <div className="chat-head-status">متصل الان</div>
                </div>

                <button
                  type="button"
                  className="wp-btn"
                  onClick={() => setShowWatchParty(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                  <span className="wp-btn-text">Watch Party</span>
                </button>
              </header>

              {error && (
                <div className="chat-error">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)}>✕</button>
                </div>
              )}

              <div className="messages">
                {messages.length === 0 ? (
                  <div className="conversation-empty">
                    <div className="conversation-empty-icon">✨</div>
                    <strong>ابدأ المحادثة الان</strong>
                    <span>أرسل رسالة نصية، صورة أو تسجيلاً صوتياً.</span>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = isMine(message);
                    return (
                      <div className={`msg-row ${mine ? 'mine' : 'theirs'}`} key={message.id}>
                        <div className="message-content">
                          <div className={`bubble ${message.kind === 'image' ? 'img-bubble' : ''}`}>
                            {message.kind === 'image' ? (
                              <a href={getMessageText(message)} target="_blank" rel="noreferrer">
                                <img src={getMessageText(message)} alt="Shared media" />
                              </a>
                            ) : message.kind === 'voice' ? (
                              <div className="voice-note">
                                <audio controls preload="metadata" src={getMessageText(message)} />
                              </div>
                            ) : (
                              <span>{getMessageText(message)}</span>
                            )}
                          </div>
                          <span className="msg-time">{formatTime(message.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* COMPOSER */}
              <form className="composer" onSubmit={handleSendMessage}>
                <button
                  type="button"
                  className="action-icon-btn"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingMedia || recordingVoice}
                  title="إرسال صورة"
                  aria-label="Upload Image"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </button>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageSelect}
                />

                <button
                  type="button"
                  className={`action-icon-btn ${recordingVoice ? 'recording' : ''}`}
                  onClick={handleVoiceButton}
                  disabled={uploadingMedia}
                  title={recordingVoice ? "إيقاف التسجيل والإرسال" : "تسجيل فويس"}
                  aria-label="Record Voice"
                >
                  {recordingVoice ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  )}
                </button>

                <div className="composer-field">
                  {recordingVoice ? (
                    <div className="recording-state">
                      <span className="recording-dot" />
                      <span>جاري تسجيل الفويس...</span>
                    </div>
                  ) : uploadingMedia ? (
                    <div className="uploading-state">
                      <span>جاري الرفع...</span>
                    </div>
                  ) : (
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder={`اكتب رسالة لـ ${getFriendName(activeFriend)}...`}
                      autoComplete="off"
                      disabled={uploadingMedia}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="send-btn"
                  disabled={recordingVoice || uploadingMedia || !input.trim()}
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </form>
            </>
          )}
        </main>
      </div>

      {showWatchParty && activeFriend && (
        <div className="modal-backdrop" onClick={() => setShowWatchParty(false)}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                <line x1="7" y1="2" x2="7" y2="22"/>
                <line x1="17" y1="2" x2="17" y2="22"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            </div>
            <h3>بدء جلسة مشاهدة مشتركة</h3>
            <p>قم بدعوة {getFriendName(activeFriend)} لمشاهدة أفلامك ومسلسلاتك المفضلة معا في الوقت الفعلي.</p>
            <div className="wp-sync-row">
              <button type="button" className="modal-cancel" onClick={() => setShowWatchParty(false)}>
                إلغاء
              </button>
              <button type="button" className="modal-confirm" onClick={handleCreateWatchParty}>
                بدء Party
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

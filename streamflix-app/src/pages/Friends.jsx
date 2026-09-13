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
                <h2>Friends</h2>
                <span className="friends-subtitle">
                  Your StreamFlix people
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
                placeholder="Friend code..."
                autoComplete="off"
              />
              <button type="submit">Add</button>
            </form>

            {userId && (
              <div className="my-uid">
                Your code: <span>{userId}</span>
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
                    <span>{requesterName} sent you a request</span>
                    <div className="pending-actions">
                      <button
                        type="button"
                        onClick={() => handleFriendRequest(request.id, true)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFriendRequest(request.id, false)}
                      >
                        ×
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
                <div className="friends-empty-icon">👥</div>
                <strong>No friends yet</strong>
                <span>Add someone using their friend code.</span>
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
                        {active ? 'Active conversation' : 'Tap to chat'}
                      </div>
                    </div>

                    <span className="friend-arrow">›</span>
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
              <div className="chat-empty-orb">💬</div>
              <h2>Your conversations</h2>
              <p>Select a friend and start watching and chatting together.</p>
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
                  ‹
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
                  <div className="chat-head-status">Online</div>
                </div>

                <button
                  type="button"
                  className="wp-btn"
                  onClick={() => setShowWatchParty(true)}
                >
                  <span>🎬</span>
                  <span className="wp-btn-text">Watch Party</span>
                </button>
              </header>

              {error && (
                <div className="chat-error">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)}>×</button>
                </div>
              )}

              <div className="messages">
                {messages.length === 0 ? (
                  <div className="conversation-empty">
                    <div className="conversation-empty-icon">✨</div>
                    <strong>Start the conversation</strong>
                    <span>Send a message, photo or voice note.</span>
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
                                <img src={getMessageText(message)} alt="Shared" />
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
                  📷
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
                  {recordingVoice ? '⏹️' : '🎙️'}
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
                      placeholder={`Message ${getFriendName(activeFriend)}...`}
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
                  ➤
                </button>
              </form>
            </>
          )}
        </main>
      </div>

      {showWatchParty && activeFriend && (
        <div className="modal-backdrop" onClick={() => setShowWatchParty(false)}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-icon">🎬</div>
            <h3>Start a Watch Party</h3>
            <p>Invite {getFriendName(activeFriend)} to watch something together.</p>
            <div className="wp-sync-row">
              <button type="button" className="modal-cancel" onClick={() => setShowWatchParty(false)}>
                Cancel
              </button>
              <button type="button" className="modal-confirm" onClick={handleCreateWatchParty}>
                Start Party
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchFriends,
  fetchPendingRequests,
  subscribeToFriendRequests,
  sendFriendRequestByCode,
  respondToFriendRequest,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  uploadChatMedia,
} from '../lib/api';
import ProtectedRoute from '../components/ProtectedRoute';
import './Friends.css';

function FriendsInner() {
  const { user, profile } = useAuth();

  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [addUserId, setAddUserId] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const userId = user?.id;

  const loadFriends = useCallback(async () => {
    if (!userId) return;

    try {
      const [friendsData, pendingData] = await Promise.all([
        fetchFriends(userId),
        fetchPendingRequests(userId),
      ]);

      setFriends(friendsData || []);
      setPending(pendingData || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadFriends();

    const unsubscribe = subscribeToFriendRequests(userId, loadFriends);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId, loadFriends]);

  useEffect(() => {
    if (!userId || !activeFriend?.id) {
      setMessages([]);
      return;
    }

    setMessages([]);

    fetchMessages(userId, activeFriend.id)
      .then(setMessages)
      .catch((err) => setError(err.message || 'تعذر تحميل الرسائل.'));

    const unsubscribe = subscribeToMessages(
      userId,
      activeFriend.id,
      (newMessage) => {
        setMessages((prev) =>
          prev.some((m) => m.id === newMessage.id)
            ? prev
            : [...prev, newMessage]
        );
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId, activeFriend]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleAddFriend = async (e) => {
    e?.preventDefault();

    if (!addUserId.trim()) return;

    setError(null);
    setSuccess(null);

    try {
      await sendFriendRequestByCode(userId, addUserId.trim());
      setSuccess('تم إرسال طلب الصداقة بنجاح!');
      setAddUserId('');
      await loadFriends();
    } catch (err) {
      setError(err.message || 'فشل إرسال الطلب.');
    }
  };

  const handleRespond = async (friendshipId, status) => {
    setError(null);

    try {
      await respondToFriendRequest(friendshipId, status);
      await loadFriends();
    } catch (err) {
      setError(err.message || 'تعذر معالجة الطلب.');
    }
  };

  const handleSendText = async (e) => {
    e?.preventDefault();

    const text = input.trim();

    if (!text || !activeFriend || !userId) return;

    setInput('');
    setError(null);

    try {
      const msg = await sendMessage({
        senderId: userId,
        receiverId: activeFriend.id,
        kind: 'text',
        content: text,
      });

      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    } catch (err) {
      setInput(text);
      setError(err.message || 'تعذر إرسال الرسالة.');
    }
  };

  const sendMediaMessage = async (file, kind) => {
    if (!file || !activeFriend || !userId) return;

    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadChatMedia({
        userId,
        file,
        kind,
      });

      const msg = await sendMessage({
        senderId: userId,
        receiverId: activeFriend.id,
        kind,
        content: uploaded.url,
        metadata: {
          name: uploaded.name,
          size: uploaded.size,
          mime: uploaded.mime,
          path: uploaded.path,
        },
      });

      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    } catch (err) {
      setError(err.message || 'فشل إرسال الملف.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('الملف المختار ليس صورة.');
      return;
    }

    await sendMediaMessage(file, 'image');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    await sendMediaMessage(file, 'file');
  };

  const chooseRecorderMime = () => {
    if (typeof MediaRecorder === 'undefined') return '';

    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!activeFriend || !userId || uploading || recording) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('التسجيل الصوتي غير مدعوم في هذا المتصفح.');
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseRecorderMime();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError('حدث خطأ أثناء التسجيل الصوتي.');
      };

      recorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (!chunks.length) return;

        const blobType = recorder.mimeType || 'audio/webm';
        const extension = blobType.includes('mp4')
          ? 'm4a'
          : blobType.includes('ogg')
            ? 'ogg'
            : 'webm';

        const voiceFile = new File(
          chunks,
          `voice-${Date.now()}.${extension}`,
          { type: blobType }
        );

        await sendMediaMessage(voiceFile, 'voice');
      };

      recorder.start(250);
    } catch (err) {
      setRecording(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      setError(
        err?.name === 'NotAllowedError'
          ? 'اسمح للموقع باستعمال الميكروفون باش تقدر تبعث فويس.'
          : err.message || 'تعذر تشغيل الميكروفون.'
      );
    }
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getDisplayName = (person) =>
    person?.display_name ||
    person?.full_name ||
    person?.username ||
    'مستخدم';

  const formatTime = (value) => {
    if (!value) return 'الآن';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderMessage = (m) => {
    const metadata = m.metadata || {};

    if (m.kind === 'image') {
      return (
        <a
          className="chat-media-image"
          href={m.content}
          target="_blank"
          rel="noreferrer"
        >
          <img src={m.content} alt="صورة مرسلة" />
        </a>
      );
    }

    if (m.kind === 'voice') {
      return (
        <div className="voice-message">
          <div className="voice-icon">🎙️</div>
          <audio controls preload="metadata" src={m.content}>
            متصفحك لا يدعم تشغيل الصوت.
          </audio>
        </div>
      );
    }

    if (m.kind === 'file') {
      return (
        <a
          className="file-message"
          href={m.content}
          target="_blank"
          rel="noreferrer"
        >
          <span className="file-icon">📎</span>
          <span className="file-info">
            <strong>{metadata.name || 'ملف مرفق'}</strong>
            <small>{formatFileSize(metadata.size)}</small>
          </span>
          <span className="file-download">↗</span>
        </a>
      );
    }

    return <span className="message-text">{m.content}</span>;
  };

  return (
    <div className={`friends-app ${activeFriend ? 'has-active-chat' : ''}`}>
      <div className="app-grid">
        <aside className="friends-col">
          <div className="friends-head">
            <div className="friends-heading-row">
              <div>
                <span className="friends-kicker">SOCIAL</span>
                <h2>الأصدقاء</h2>
                <p className="friends-subtitle">
                  تواصل مع أصحابك وشاهدوا أفلامكم مع بعض
                </p>
              </div>
              <div className="friends-count">{friends.length}</div>
            </div>

            <form className="add-friend-row" onSubmit={handleAddFriend}>
              <div className="add-input-wrap">
                <span>⌕</span>
                <input
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  placeholder="User ID..."
                  autoComplete="off"
                />
              </div>
              <button type="submit">إضافة</button>
            </form>

            <div className="my-uid">
              ID الخاص بك:
              <span>{userId || profile?.id || '—'}</span>
            </div>

            {error && !activeFriend && (
              <div className="error-banner">{error}</div>
            )}

            {success && (
              <div className="success-banner">{success}</div>
            )}
          </div>

          {pending.length > 0 && (
            <div className="pending-block">
              <div className="pending-title-row">
                <span className="pending-title">طلبات الصداقة</span>
                <span className="pending-badge">{pending.length}</span>
              </div>

              {pending.map((p) => (
                <div key={p.id} className="pending-row">
                  <div className="pending-person">
                    <div className="mini-avatar">
                      {getDisplayName(p.requester).charAt(0).toUpperCase()}
                    </div>
                    <span>{getDisplayName(p.requester)}</span>
                  </div>

                  <div className="pending-actions">
                    <button
                      type="button"
                      className="accept-btn"
                      onClick={() => handleRespond(p.id, 'accepted')}
                      aria-label="قبول"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="reject-btn"
                      onClick={() => handleRespond(p.id, 'rejected')}
                      aria-label="رفض"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="friend-list">
            {friends.length === 0 ? (
              <div className="friends-empty">
                <div className="empty-icon">♧</div>
                <strong>ما عندك حتى صديق حالياً</strong>
                <span>استعمل User ID لإرسال أول طلب صداقة.</span>
              </div>
            ) : (
              friends.map((f) => {
                const active = activeFriend?.id === f.id;
                const name = getDisplayName(f);

                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`friend-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      setActiveFriend(f);
                      setError(null);
                      setSuccess(null);
                    }}
                  >
                    <div
                      className="fav"
                      style={
                        f.avatar_url
                          ? { backgroundImage: `url(${f.avatar_url})` }
                          : undefined
                      }
                    >
                      {!f.avatar_url && (
                        <span>{name.charAt(0).toUpperCase()}</span>
                      )}
                      <i className="online-dot" />
                    </div>

                    <div className="finfo">
                      <div className="fname">{name}</div>
                      <div className="flast">اضغط لفتح المحادثة</div>
                    </div>

                    <span className="friend-arrow">›</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="chat-col">
          {!activeFriend ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">💬</div>
              <h2>ابدأ محادثة</h2>
              <p>اختار واحد من أصدقائك باش تبدأو الهدرة.</p>
            </div>
          ) : (
            <>
              <header className="chat-head">
                <button
                  type="button"
                  className="chat-back-btn"
                  onClick={() => setActiveFriend(null)}
                  aria-label="رجوع"
                >
                  ‹
                </button>

                <div
                  className="chat-avatar"
                  style={
                    activeFriend.avatar_url
                      ? {
                          backgroundImage: `url(${activeFriend.avatar_url})`,
                        }
                      : undefined
                  }
                >
                  {!activeFriend.avatar_url &&
                    getDisplayName(activeFriend).charAt(0).toUpperCase()}
                  <i />
                </div>

                <div className="chat-person">
                  <div className="chat-head-name">
                    {getDisplayName(activeFriend)}
                  </div>
                  <div className="chat-head-status">● متصل بالمحادثة</div>
                </div>

                <button type="button" className="chat-head-action" title="Watch Together">
                  🎬 <span>Watch Together</span>
                </button>
              </header>

              {error && (
                <div className="chat-error-bar">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)}>
                    ×
                  </button>
                </div>
              )}

              <div className="messages">
                <div className="chat-start">
                  <div className="chat-start-line" />
                  <span>بداية المحادثة</span>
                  <div className="chat-start-line" />
                </div>

                {messages.map((m) => {
                  const mine = m.sender_id === userId;

                  return (
                    <div
                      key={m.id}
                      className={`msg-row ${mine ? 'mine' : 'theirs'}`}
                    >
                      <div className="message-content">
                        <div className="bubble">
                          {renderMessage(m)}
                        </div>
                        <span className="msg-time">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              <div className="composer-wrap">
                {recording && (
                  <div className="recording-state">
                    <span className="recording-dot" />
                    <span>جاري التسجيل...</span>
                    <strong>
                      {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                      {String(recordingSeconds % 60).padStart(2, '0')}
                    </strong>
                    <button
                      type="button"
                      onClick={stopRecording}
                    >
                      إيقاف وإرسال
                    </button>
                  </div>
                )}

                {uploading && (
                  <div className="uploading-state">
                    <span className="upload-spinner" />
                    جاري رفع المرفق...
                  </div>
                )}

                <form className="composer" onSubmit={handleSendText}>
                  <div className="composer-actions">
                    <button
                      type="button"
                      className="action-icon-btn"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploading || recording}
                      title="إرسال صورة"
                    >
                      ＋
                    </button>

                    <button
                      type="button"
                      className="action-icon-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || recording}
                      title="إرسال ملف"
                    >
                      📎
                    </button>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleImageUpload}
                    />

                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={handleFileUpload}
                    />
                  </div>

                  <input
                    className="composer-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`اكتب رسالة لـ ${getDisplayName(activeFriend)}...`}
                    disabled={uploading || recording}
                  />

                  <button
                    type="button"
                    className={`voice-btn ${recording ? 'recording' : ''}`}
                    onClick={toggleRecording}
                    disabled={uploading}
                    title={recording ? 'إيقاف التسجيل' : 'رسالة صوتية'}
                  >
                    {recording ? '■' : '🎙'}
                  </button>

                  <button
                    type="submit"
                    className="send-btn"
                    disabled={!input.trim() || uploading || recording}
                    aria-label="إرسال"
                  >
                    ➤
                  </button>
                </form>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Friends() {
  return (
    <ProtectedRoute>
      <FriendsInner />
    </ProtectedRoute>
  );
}


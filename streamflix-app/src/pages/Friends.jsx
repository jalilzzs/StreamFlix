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
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const userId = user?.id;

  const getDisplayName = (person) =>
    person?.display_name ||
    person?.full_name ||
    person?.username ||
    'مستخدم';

  const formatTime = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];

    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
  };

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

    const unsubscribe = subscribeToFriendRequests(userId, () => {
      loadFriends();
    });

    return () => unsubscribe?.();
  }, [userId, loadFriends]);

  useEffect(() => {
    if (!userId || !activeFriend?.id) {
      setMessages([]);
      return undefined;
    }

    let alive = true;

    fetchMessages(userId, activeFriend.id)
      .then((data) => {
        if (alive) setMessages(data || []);
      })
      .catch((err) => {
        console.error(err);

        if (alive) {
          setError(err.message || 'تعذر تحميل الرسائل.');
        }
      });

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
      alive = false;
      unsubscribe?.();
    };
  }, [userId, activeFriend]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      clearInterval(recordingTimerRef.current);

      mediaStreamRef.current?.getTracks?.().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  const clearAttachmentPreview = () => {
    if (attachmentPreview?.url) {
      URL.revokeObjectURL(attachmentPreview.url);
    }

    setAttachmentPreview(null);
  };

  const handleAddFriend = async (e) => {
    e?.preventDefault();

    if (!addUserId.trim()) return;

    setError(null);
    setSuccess(null);

    try {
      await sendFriendRequestByCode(userId, addUserId.trim());

      setSuccess('تم إرسال طلب الصداقة بنجاح!');
      setAddUserId('');

      loadFriends();
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
        prev.some((m) => m.id === msg.id)
          ? prev
          : [...prev, msg]
      );
    } catch (err) {
      setInput(text);
      setError(err.message || 'تعذر إرسال الرسالة.');
    }
  };

  const sendUploadedMessage = async (file, kind) => {
    if (!file || !activeFriend || !userId) return;

    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadChatMedia({
        userId,
        file,
        kind,
      });

      const content =
        kind === 'image'
          ? uploaded.url
          : JSON.stringify({
              url: uploaded.url,
              path: uploaded.path,
              name: uploaded.name,
              mimeType: uploaded.mimeType,
              size: uploaded.size,
            });

      const msg = await sendMessage({
        senderId: userId,
        receiverId: activeFriend.id,
        kind,
        content,
      });

      setMessages((prev) =>
        prev.some((m) => m.id === msg.id)
          ? prev
          : [...prev, msg]
      );
    } catch (err) {
      setError(err.message || 'فشل إرسال المرفق.');
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

    await sendUploadedMessage(file, 'image');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];

    e.target.value = '';

    if (!file) return;

    await sendUploadedMessage(file, 'file');
  };

  const startVoiceRecording = async () => {
    if (!activeFriend || !userId || recording || uploading) {
      return;
    }

    setError(null);

    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      setError('المتصفح لا يدعم تسجيل الرسائل الصوتية.');
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      mediaStreamRef.current = stream;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];

      const mimeType =
        preferredTypes.find((type) =>
          MediaRecorder.isTypeSupported?.(type)
        ) || '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError(
          'حدث خطأ أثناء تسجيل الرسالة الصوتية.'
        );
      };

      recorder.onstop = async () => {
        clearInterval(recordingTimerRef.current);

        const chunks = audioChunksRef.current;

        audioChunksRef.current = [];

        const blob = new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        });

        stream
          .getTracks()
          .forEach((track) => track.stop());

        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        setRecording(false);
        setRecordingSeconds(0);

        if (blob.size > 0) {
          const extension =
            recorder.mimeType?.includes('mp4')
              ? 'm4a'
              : 'webm';

          const file = new File(
            [blob],
            `voice-${Date.now()}.${extension}`,
            {
              type: blob.type,
            }
          );

          await sendUploadedMessage(file, 'voice');
        }
      };

      recorder.start();

      setRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch (err) {
      console.error(err);

      setError(
        err?.name === 'NotAllowedError'
          ? 'اسمح للموقع باستعمال الميكروفون باش تقدر تسجل Voice Message.'
          : 'تعذر تشغيل الميكروفون.'
      );
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      return;
    }

    recorder.stop();
  };

  const cancelVoiceRecording = () => {
    clearInterval(recordingTimerRef.current);

    const recorder = mediaRecorderRef.current;
    const stream = mediaStreamRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }

    stream?.getTracks?.().forEach((track) => {
      track.stop();
    });

    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    audioChunksRef.current = [];

    setRecording(false);
    setRecordingSeconds(0);
  };

  const parseAttachment = (message) => {
    if (!message?.content) return null;

    try {
      const parsed = JSON.parse(message.content);

      if (parsed?.url) {
        return parsed;
      }
    } catch {
      // Old file/voice messages may contain a direct URL.
    }

    return {
      url: message.content,
      name: 'مرفق',
      mimeType: '',
      size: 0,
    };
  };

  const renderMessage = (message) => {
    if (message.kind === 'image') {
      return (
        <a
          href={message.content}
          target="_blank"
          rel="noreferrer"
          className="image-message-link"
        >
          <img
            src={message.content}
            alt="Shared attachment"
            className="chat-img"
            loading="lazy"
          />
        </a>
      );
    }

    if (message.kind === 'voice') {
      const attachment = parseAttachment(message);

      if (!attachment?.url) {
        return <span>رسالة صوتية غير متوفرة</span>;
      }

      return (
        <div className="voice-message">
          <div className="voice-icon">🎙️</div>

          <div className="voice-content">
            <span className="voice-title">
              رسالة صوتية
            </span>

            <audio
              controls
              preload="metadata"
              src={attachment.url}
            />

            {attachment.size > 0 && (
              <span className="attachment-size">
                {formatBytes(attachment.size)}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (message.kind === 'file') {
      const attachment = parseAttachment(message);

      if (!attachment?.url) {
        return <span>ملف غير متوفر</span>;
      }

      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="file-message"
          download={attachment.name || true}
        >
          <div className="file-icon">📎</div>

          <div className="file-info">
            <strong>
              {attachment.name || 'مرفق'}
            </strong>

            <span>
              {attachment.size > 0
                ? formatBytes(attachment.size)
                : 'فتح الملف'}
            </span>
          </div>

          <span className="file-open">↗</span>
        </a>
      );
    }

    return <span>{message.content}</span>;
  };

  const openFriend = (friend) => {
    setActiveFriend(friend);
    setError(null);
    setSuccess(null);
  };

  const recordingLabel = `${String(
    Math.floor(recordingSeconds / 60)
  ).padStart(2, '0')}:${String(
    recordingSeconds % 60
  ).padStart(2, '0')}`;

  return (
    <div
      className={`friends-app ${
        activeFriend ? 'has-active-chat' : ''
      }`}
    >
      <div className="app-grid">
        <aside className="friends-col">
          <div className="friends-head">
            <div className="friends-title-row">
              <div>
                <span className="eyebrow">
                  STREAMFLIX
                </span>

                <h2>الأصدقاء</h2>

                <span className="friends-subtitle">
                  دردشة ومشاهدة معًا
                </span>
              </div>

              <div className="friends-count">
                {friends.length}
              </div>
            </div>

            <form
              className="add-friend-row"
              onSubmit={handleAddFriend}
            >
              <input
                value={addUserId}
                onChange={(e) =>
                  setAddUserId(e.target.value)
                }
                placeholder="أدخل User ID..."
                autoComplete="off"
              />

              <button type="submit">
                إضافة
              </button>
            </form>

            <div className="my-uid">
              ID الخاص بك:
              <span>
                {userId || profile?.id || '—'}
              </span>
            </div>

            {error && !activeFriend && (
              <div className="error-banner">
                {error}
              </div>
            )}

            {success && (
              <div className="success-banner">
                {success}
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div className="pending-block">
              <div className="pending-heading">
                <span className="pending-title">
                  طلبات الصداقة
                </span>

                <span className="pending-badge">
                  {pending.length}
                </span>
              </div>

              {pending.map((p) => (
                <div
                  key={p.id}
                  className="pending-row"
                >
                  <div className="pending-user">
                    <div className="pending-avatar">
                      {getDisplayName(
                        p.requester
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <span>
                      {getDisplayName(
                        p.requester
                      )}
                    </span>
                  </div>

                  <div className="pending-actions">
                    <button
                      type="button"
                      className="accept-btn"
                      onClick={() =>
                        handleRespond(
                          p.id,
                          'accepted'
                        )
                      }
                      aria-label="قبول"
                    >
                      ✓
                    </button>

                    <button
                      type="button"
                      className="reject-btn"
                      onClick={() =>
                        handleRespond(
                          p.id,
                          'rejected'
                        )
                      }
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
                <div className="empty-icon">
                  ♡
                </div>

                <strong>
                  ما عندك حتى صديق حالياً
                </strong>

                <span>
                  أضف صديق باستعمال User ID باش
                  تبدأو المحادثة.
                </span>
              </div>
            ) : (
              friends.map((friend) => {
                const active =
                  activeFriend?.id === friend.id;

                const name =
                  getDisplayName(friend);

                return (
                  <button
                    key={friend.id}
                    type="button"
                    className={`friend-item ${
                      active ? 'active' : ''
                    }`}
                    onClick={() =>
                      openFriend(friend)
                    }
                  >
                    <div
                      className="fav"
                      style={
                        friend.avatar_url
                          ? {
                              backgroundImage: `url(${friend.avatar_url})`,
                            }
                          : undefined
                      }
                    >
                      {!friend.avatar_url && (
                        <span>
                          {name
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}

                      <span className="online-dot" />
                    </div>

                    <div className="finfo">
                      <div className="fname">
                        {name}
                      </div>

                      <div className="flast">
                        اضغط لفتح المحادثة
                      </div>
                    </div>

                    <span className="friend-arrow">
                      ›
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="chat-col">
          {!activeFriend ? (
            <div className="chat-empty">
              <div className="chat-empty-orb">
                💬
              </div>

              <h2>محادثاتك</h2>

              <p>
                اختار صديق من القائمة وابدأ الحديث.
              </p>
            </div>
          ) : (
            <>
              <header className="chat-head">
                <button
                  type="button"
                  className="chat-back-btn"
                  onClick={() =>
                    setActiveFriend(null)
                  }
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
                    getDisplayName(
                      activeFriend
                    )
                      .charAt(0)
                      .toUpperCase()}

                  <span className="online-dot" />
                </div>

                <div className="chat-head-info">
                  <div className="chat-head-name">
                    {getDisplayName(
                      activeFriend
                    )}
                  </div>

                  <div className="chat-head-status">
                    محادثة خاصة
                  </div>
                </div>

                <button
                  type="button"
                  className="wp-btn"
                  title="Watch Together — سيتم ربطه بالـWatch Party في المرحلة القادمة"
                  onClick={() =>
                    setSuccess(
                      'زر Watch Together جاهز للربط في مرحلة Watch Party.'
                    )
                  }
                >
                  <span>▶</span>

                  <span className="wp-btn-text">
                    Watch Together
                  </span>
                </button>
              </header>

              {error && (
                <div className="chat-error-bar">
                  <span>{error}</span>

                  <button
                    type="button"
                    onClick={() =>
                      setError(null)
                    }
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="messages">
                {messages.length === 0 && (
                  <div className="first-message">
                    <div className="first-message-icon">
                      ✦
                    </div>

                    <strong>
                      ابدأ المحادثة
                    </strong>

                    <span>
                      قول حاجة لـ{' '}
                      {getDisplayName(
                        activeFriend
                      )}
                      .
                    </span>
                  </div>
                )}

                {messages.map((message) => {
                  const mine =
                    message.sender_id ===
                    userId;

                  return (
                    <div
                      key={message.id}
                      className={`msg-row ${
                        mine
                          ? 'mine'
                          : 'theirs'
                      }`}
                    >
                      <div className="message-stack">
                        <div className="bubble">
                          {renderMessage(
                            message
                          )}
                        </div>

                        <span className="msg-time">
                          {formatTime(
                            message.created_at
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              <div className="composer-shell">
                {attachmentPreview && (
                  <div className="attachment-preview">
                    <div>
                      <strong>
                        {attachmentPreview.name}
                      </strong>

                      <span>
                        {attachmentPreview.type}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={
                        clearAttachmentPreview
                      }
                      aria-label="إلغاء"
                    >
                      ×
                    </button>
                  </div>
                )}

                {recording ? (
                  <div className="recording-state">
                    <div className="recording-main">
                      <span className="recording-dot" />

                      <strong>
                        جاري التسجيل
                      </strong>

                      <span className="recording-time">
                        {recordingLabel}
                      </span>
                    </div>

                    <div className="recording-actions">
                      <button
                        type="button"
                        className="cancel-recording"
                        onClick={
                          cancelVoiceRecording
                        }
                      >
                        إلغاء
                      </button>

                      <button
                        type="button"
                        className="finish-recording"
                        onClick={
                          stopVoiceRecording
                        }
                      >
                        إرسال 🎙️
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    className="composer"
                    onSubmit={
                      handleSendText
                    }
                  >
                    <div className="composer-tools">
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() =>
                          imageInputRef.current?.click()
                        }
                        disabled={uploading}
                        title="صورة"
                      >
                        🖼️
                      </button>

                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        disabled={uploading}
                        title="ملف"
                      >
                        📎
                      </button>

                      <button
                        type="button"
                        className="action-icon-btn voice-btn"
                        onClick={
                          startVoiceRecording
                        }
                        disabled={uploading}
                        title="رسالة صوتية"
                      >
                        🎙️
                      </button>
                    </div>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={
                        handleImageUpload
                      }
                    />

                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={
                        handleFileUpload
                      }
                    />

                    <div className="composer-field">
                      <input
                        value={input}
                        onChange={(e) =>
                          setInput(
                            e.target.value
                          )
                        }
                        placeholder={`اكتب رسالة لـ ${getDisplayName(
                          activeFriend
                        )}...`}
                        disabled={uploading}
                        autoComplete="off"
                      />
                    </div>

                    <button
                      type="submit"
                      className="send-btn"
                      disabled={
                        !input.trim() ||
                        uploading
                      }
                      aria-label="إرسال"
                    >
                      {uploading
                        ? '…'
                        : '➤'}
                    </button>
                  </form>
                )}
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

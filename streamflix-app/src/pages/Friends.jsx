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

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  const userId = user?.id;

  /* =========================
     LOAD FRIENDS & REQUESTS
  ========================= */

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

  /* =========================
     LOAD CHAT & REALTIME
  ========================= */

  useEffect(() => {
    if (!userId || !activeFriend?.id) {
      setMessages([]);
      return;
    }

    fetchMessages(userId, activeFriend.id)
      .then(setMessages)
      .catch(console.error);

    const unsubscribe = subscribeToMessages(
      userId,
      activeFriend.id,
      (newMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* =========================
     HANDLERS
  ========================= */

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
      loadFriends();
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

      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (err) {
      setInput(text);
      setError(err.message || 'تعذر إرسال الرسالة.');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeFriend || !userId) return;

    setUploading(true);
    setError(null);

    try {
      const { url } = await uploadChatMedia({ userId, file, kind: 'image' });
      const msg = await sendMessage({
        senderId: userId,
        receiverId: activeFriend.id,
        kind: 'image',
        content: url,
      });

      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (err) {
      setError(err.message || 'فشل رفع الصورة.');
    } finally {
      setUploading(false);
    }
  };

  const getDisplayName = (person) => {
    return (
      person?.display_name ||
      person?.full_name ||
      person?.username ||
      'مستخدم'
    );
  };

  return (
    <div className={`friends-app ${activeFriend ? 'has-active-chat' : ''}`}>
      <div className="app-grid">
        {/* SIDEBAR */}
        <aside className="friends-col">
          <div className="friends-head">
            <h2>الأصدقاء</h2>

            <form className="add-friend-row" onSubmit={handleAddFriend}>
              <input
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                placeholder="أدخل User ID..."
                autoComplete="off"
              />
              <button type="submit">إضافة</button>
            </form>

            <div className="my-uid">
              ID الخاص بك: <span>{userId || profile?.id}</span>
            </div>

            {error && !activeFriend && (
              <div className="error-banner" style={{ marginTop: 8, color: '#ff4d4d', fontSize: 13 }}>
                {error}
              </div>
            )}
            {success && (
              <div className="success-banner" style={{ marginTop: 8, color: '#4edf72', fontSize: 13 }}>
                {success}
              </div>
            )}
          </div>

          {/* PENDING REQUESTS */}
          {pending.length > 0 && (
            <div className="pending-block">
              <span className="pending-title">طلبات الصداقة</span>
              {pending.map((p) => (
                <div key={p.id} className="pending-row">
                  <span>{getDisplayName(p.requester)}</span>
                  <div className="pending-actions">
                    <button
                      type="button"
                      className="accept-btn"
                      onClick={() => handleRespond(p.id, 'accepted')}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="reject-btn"
                      onClick={() => handleRespond(p.id, 'rejected')}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FRIEND LIST */}
          <div className="friend-list">
            {friends.length === 0 ? (
              <div className="friends-empty">
                <span>لا يوجد أصدقاء حالياً</span>
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
                    }}
                  >
                    <div
                      className="fav"
                      style={f.avatar_url ? { backgroundImage: `url(${f.avatar_url})` } : undefined}
                    >
                      {!f.avatar_url && (
                        <span className="avatar-letter">
                          {name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="finfo">
                      <div className="fname">{name}</div>
                    </div>
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
              <h2>اختر صديقاً لبدء المحادثة</h2>
            </div>
          ) : (
            <>
              <header className="chat-head">
                <button
                  type="button"
                  className="chat-back-btn"
                  onClick={() => setActiveFriend(null)}
                >
                  ‹
                </button>
                <div className="chat-head-name">
                  {getDisplayName(activeFriend)}
                </div>
              </header>

              {error && (
                <div className="chat-error-bar">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)}>×</button>
                </div>
              )}

              <div className="messages">
                {messages.map((m) => {
                  const mine = m.sender_id === userId;
                  return (
                    <div
                      key={m.id}
                      className={`msg-row ${mine ? 'mine' : 'theirs'}`}
                    >
                      <div className="bubble">
                        {m.kind === 'image' ? (
                          <img src={m.content} alt="Shared attachment" className="chat-img" />
                        ) : (
                          <span>{m.content}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* COMPOSER */}
              <form className="composer" onSubmit={handleSendText}>
                <button
                  type="button"
                  className="upload-btn"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                >
                  📷
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageUpload}
                />

                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`اكتب رسالة لـ ${getDisplayName(activeFriend)}...`}
                  disabled={uploading}
                />

                <button type="submit" className="send-btn" disabled={!input.trim() || uploading}>
                  ➤
                </button>
              </form>
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

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import {
  fetchFriends, fetchPendingRequests, sendFriendRequestByCode, respondToFriendRequest,
  fetchMessages, sendMessage, subscribeToMessages, createWatchParty,
} from '../lib/api';
import './Friends.css';

export default function Friends() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [addValue, setAddValue] = useState('');
  const [error, setError] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showWatchParty, setShowWatchParty] = useState(false);
  const messagesEndRef = useRef(null);

  const loadFriendsList = useCallback(async () => {
    if (!user) return;
    try {
      const [f, p] = await Promise.all([fetchFriends(user.id), fetchPendingRequests(user.id)]);
      setFriends(f);
      setPending(p);
      if (!activeFriend && f.length) setActiveFriend(f[0]);
    } catch (err) {
      console.error(err);
      setError(t('error_generic'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, t]);

  useEffect(() => { loadFriendsList(); }, [loadFriendsList]);

  useEffect(() => {
    if (!user || !activeFriend) return;
    let unsubscribe;
    (async () => {
      try {
        const msgs = await fetchMessages(user.id, activeFriend.id);
        setMessages(msgs);
        unsubscribe = subscribeToMessages(user.id, activeFriend.id, (m) => {
          setMessages((prev) => [...prev, m]);
        });
      } catch (err) {
        console.error(err);
        setError(t('error_generic'));
      }
    })();
    return () => unsubscribe && unsubscribe();
  }, [user, activeFriend, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAddFriend = useCallback(async () => {
    if (!addValue.trim() || !user) return;
    try {
      await sendFriendRequestByCode(user.id, addValue);
      setAddValue('');
      alert('Friend request sent.');
    } catch (err) {
      alert(err.message || 'Could not send friend request.');
    }
  }, [addValue, user]);

  const handleAccept = useCallback(async (friendshipId) => {
    try {
      await respondToFriendRequest(friendshipId, 'accepted');
      loadFriendsList();
    } catch (err) {
      console.error(err);
    }
  }, [loadFriendsList]);

  const handleSend = useCallback(async (kind = 'text', content = input) => {
    if (!user || !activeFriend || !content?.trim()) return;
    try {
      await sendMessage({ senderId: user.id, receiverId: activeFriend.id, kind, content });
      if (kind === 'text') setInput('');
    } catch (err) {
      console.error(err);
      setError(t('error_generic'));
    }
  }, [user, activeFriend, input, t]);

  const handleStartWatchParty = useCallback(async () => {
    if (!user || !activeFriend) return;
    try {
      const party = await createWatchParty({ hostId: user.id, titleId: null, episodeId: null });
      await sendMessage({
        senderId: user.id,
        receiverId: activeFriend.id,
        kind: 'text',
        content: `🎬 Started a Watch Party — join here: /watch-party/${party.id}`,
      });
      setShowWatchParty(false);
      alert('Watch Party created and invite sent in chat.');
    } catch (err) {
      console.error(err);
      setError(t('error_generic'));
    }
  }, [user, activeFriend]);

  if (!user) {
    return (
      <div className="empty-state">
        <h2>{t('nav_friends')}</h2>
        <p style={{ marginBottom: 18 }}>Sign in to add friends and chat.</p>
        <button className="btn btn-primary" onClick={() => navigate('/settings')}>Go to Settings</button>
      </div>
    );
  }

  return (
    <div className="friends-app">
      {error && <div className="container"><div className="error-banner">{error}</div></div>}
      <div className="app-grid">
        <div className="friends-col">
          <div className="friends-head">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('nav_friends')}</div>
            <div className="add-friend-row">
              <input
                type="text"
                placeholder={t('add_friend_placeholder')}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
              />
              <button onClick={handleAddFriend}>{t('add')}</button>
            </div>
            <div className="my-uid">Your ID: <span>{profile?.user_code || '—'}</span></div>
          </div>

          {pending.length > 0 && (
            <div className="pending-list">
              {pending.map((p) => (
                <div key={p.id} className="pending-item">
                  <span>{p.requester?.display_name || 'Someone'} wants to add you</span>
                  <button onClick={() => handleAccept(p.id)}>Accept</button>
                </div>
              ))}
            </div>
          )}

          <div className="friend-list">
            {friends.length === 0 && (
              <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>
                No friends yet — add someone using their User ID above.
              </div>
            )}
            {friends.map((f) => (
              <div
                key={f.id}
                className={`friend-item ${activeFriend?.id === f.id ? 'active' : ''}`}
                onClick={() => setActiveFriend(f)}
              >
                <div className="fav" style={{ backgroundImage: `url(${f.avatar_url || `https://i.pravatar.cc/80?u=${f.id}`})` }}>
                  <span className="dot online" />
                </div>
                <div className="finfo">
                  <div className="fname">{f.display_name}</div>
                  <div className="flast">{f.user_code}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chat-col">
          {!activeFriend ? (
            <div className="empty-state">
              <h2>{t('nav_friends')}</h2>
              <p>Select a friend to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="chat-head">
                <div className="fav" style={{ backgroundImage: `url(${activeFriend.avatar_url || `https://i.pravatar.cc/80?u=${activeFriend.id}`})` }} />
                <div>
                  <div className="chat-head-name">{activeFriend.display_name}</div>
                  <div className="chat-head-status">{activeFriend.user_code}</div>
                </div>
                <button className="wp-btn" onClick={() => setShowWatchParty(true)}>👥 {t('watch_party')}</button>
              </div>

              <div className="messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 40 }}>
                    No messages yet — say hello!
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`msg-row ${m.sender_id === user.id ? 'mine' : 'theirs'}`}>
                    <div className="bubble">
                      {m.kind === 'image' && <div className="img-bubble"><img src={m.content} alt="" /></div>}
                      {m.kind === 'voice' && (
                        <div className="voice-note">
                          <div className="play">▶</div>
                          <div className="voice-dur">Voice note</div>
                        </div>
                      )}
                      {(m.kind === 'text' || !m.kind) && m.content}
                      <span className="msg-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="composer">
                <div className="attach-menu">
                  <button className="icon-btn" onClick={() => setShowAttach((s) => !s)}>📎</button>
                  {showAttach && (
                    <div className="attach-popover show">
                      <button onClick={() => { setShowAttach(false); alert('Image upload placeholder — wire to Supabase Storage.'); }}>
                        🖼️ {t('send_image')}
                      </button>
                      <button onClick={() => { setShowAttach(false); alert('Voice recording placeholder — wire to Supabase Storage.'); }}>
                        🎙️ {t('send_voice')}
                      </button>
                      <button onClick={() => { setShowAttach(false); navigate('/movies'); }}>
                        🎬 {t('recommend_title')}
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={t('message_placeholder')}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="send-btn" onClick={() => handleSend()}>➤</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showWatchParty && (
        <div className="modal-backdrop show" onClick={() => setShowWatchParty(false)}>
          <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Start Watch Party</h3>
            <p>{activeFriend?.display_name} will get an invite to sync playback with you in real time.</p>
            <div className="wp-sync-row"><span className="wp-sync-dot" /> Playback sync: enabled</div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowWatchParty(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStartWatchParty}>Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

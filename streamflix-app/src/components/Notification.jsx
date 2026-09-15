import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../lib/notifications';

import { supabase } from '../lib/supabaseClient';

// ============================================================
// ICON
// ============================================================

function NotificationIcon({ type }) {
  if (type === 'friend_request') {
    return '👤';
  }

  if (type === 'friend_accepted') {
    return '🤝';
  }

  if (type === 'watch_party') {
    return '🎬';
  }

  if (type === 'message') {
    return '💬';
  }

  return '🔔';
}

// ============================================================
// TIME
// ============================================================

function formatTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();

  const diff = Math.floor(
    (now.getTime() - date.getTime()) / 1000
  );

  if (diff < 10) {
    return 'Just now';
  }

  if (diff < 60) {
    return `${diff}s ago`;
  }

  const minutes = Math.floor(diff / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

// ============================================================
// COMPONENT
// ============================================================

export default function Notifications() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [notifications, setNotifications] =
    useState([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [open, setOpen] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [processing, setProcessing] =
    useState(false);

  // ----------------------------------------------------------
  // GET USER
  // ----------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (mounted) {
        setUser(user || null);
      }
    };

    loadUser();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setUser(session?.user || null);
        }
      }
    );

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // ----------------------------------------------------------
  // LOAD
  // ----------------------------------------------------------

  const loadNotifications =
    useCallback(async () => {
      if (!user?.id) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [
          notificationData,
          count,
        ] = await Promise.all([
          fetchNotifications(user.id, 50),
          fetchUnreadNotificationCount(
            user.id
          ),
        ]);

        setNotifications(
          notificationData
        );

        setUnreadCount(count);
      } catch (error) {
        console.error(
          'Failed to load notifications:',
          error
        );
      } finally {
        setLoading(false);
      }
    }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ----------------------------------------------------------
  // REALTIME
  // ----------------------------------------------------------

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe =
      subscribeToNotifications(
        user.id,
        (notification) => {
          if (
            notification.__event ===
            'DELETE'
          ) {
            setNotifications((prev) =>
              prev.filter(
                (item) =>
                  item.id !==
                  notification.id
              )
            );

            return;
          }

          if (
            notification.__event ===
            'UPDATE'
          ) {
            setNotifications((prev) =>
              prev.map((item) =>
                item.id ===
                notification.id
                  ? {
                      ...item,
                      ...notification,
                    }
                  : item
              )
            );

            return;
          }

          setNotifications((prev) => [
            notification,
            ...prev.filter(
              (item) =>
                item.id !==
                notification.id
            ),
          ]);

          if (!notification.read_at) {
            setUnreadCount(
              (count) => count + 1
            );
          }

          // Browser notification
          if (
            typeof window !==
              'undefined' &&
            'Notification' in window &&
            Notification.permission ===
              'granted'
          ) {
            try {
              new Notification(
                notification.title ||
                  'StreamFlix',
                {
                  body:
                    notification.body ||
                    'You have a new notification.',
                  icon: '/favicon.ico',
                }
              );
            } catch {
              // Ignore browser notification errors.
            }
          }
        }
      );

    return unsubscribe;
  }, [user?.id]);

  // ----------------------------------------------------------
  // OPEN
  // ----------------------------------------------------------

  const handleOpen = () => {
    setOpen((value) => !value);
  };

  // ----------------------------------------------------------
  // CLICK
  // ----------------------------------------------------------

  const handleNotificationClick =
    async (notification) => {
      if (!user?.id) return;

      try {
        if (!notification.read_at) {
          await markNotificationAsRead(
            notification.id,
            user.id
          );

          setNotifications((prev) =>
            prev.map((item) =>
              item.id ===
              notification.id
                ? {
                    ...item,
                    read_at:
                      new Date().toISOString(),
                  }
                : item
            )
          );

          setUnreadCount((count) =>
            Math.max(0, count - 1)
          );
        }

        if (notification.link) {
          setOpen(false);
          navigate(notification.link);
        }
      } catch (error) {
        console.error(
          'Failed to open notification:',
          error
        );
      }
    };

  // ----------------------------------------------------------
  // MARK ALL
  // ----------------------------------------------------------

  const handleMarkAllRead = async () => {
    if (!user?.id || !unreadCount) return;

    try {
      setProcessing(true);

      await markAllNotificationsAsRead(
        user.id
      );

      const now =
        new Date().toISOString();

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          read_at:
            item.read_at || now,
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        'Failed to mark notifications as read:',
        error
      );
    } finally {
      setProcessing(false);
    }
  };

  // ----------------------------------------------------------
  // DELETE
  // ----------------------------------------------------------

  const handleDelete = async (
    event,
    notification
  ) => {
    event.stopPropagation();

    if (!user?.id) return;

    try {
      await deleteNotification(
        notification.id,
        user.id
      );

      setNotifications((prev) =>
        prev.filter(
          (item) =>
            item.id !== notification.id
        )
      );

      if (!notification.read_at) {
        setUnreadCount((count) =>
          Math.max(0, count - 1)
        );
      }
    } catch (error) {
      console.error(
        'Failed to delete notification:',
        error
      );
    }
  };

  // ----------------------------------------------------------
  // REQUEST BROWSER PERMISSION
  // ----------------------------------------------------------

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window)
    ) {
      return;
    }

    if (
      Notification.permission ===
      'default'
    ) {
      Notification.requestPermission().catch(
        () => {}
      );
    }
  }, []);

  // ----------------------------------------------------------
  // NOT LOGGED IN
  // ----------------------------------------------------------

  if (!user) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          background: '#171717',
          color: '#fff',
          cursor: 'pointer',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          boxShadow:
            '0 10px 30px rgba(0,0,0,0.45)',
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              minWidth: '21px',
              height: '21px',
              padding: '0 5px',
              borderRadius: '999px',
              background: '#e50914',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border:
                '2px solid #0d0d0d',
            }}
          >
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              background:
                'rgba(0,0,0,0.25)',
            }}
          />

          <div
            style={{
              position: 'fixed',
              right: '20px',
              bottom: '84px',
              width:
                'min(390px, calc(100vw - 40px))',
              maxHeight:
                'min(600px, calc(100vh - 120px))',
              background: '#151515',
              border:
                '1px solid rgba(255,255,255,0.10)',
              borderRadius: '18px',
              overflow: 'hidden',
              zIndex: 99999,
              boxShadow:
                '0 20px 60px rgba(0,0,0,0.55)',
              color: '#fff',
            }}
          >
            {/* HEADER */}

            <div
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  'space-between',
                borderBottom:
                  '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: '800',
                  }}
                >
                  Notifications
                </div>

                <div
                  style={{
                    color: '#888',
                    fontSize: '12px',
                    marginTop: '3px',
                  }}
                >
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : 'All caught up'}
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={
                    handleMarkAllRead
                  }
                  disabled={processing}
                  style={{
                    border: 0,
                    background:
                      'transparent',
                    color: '#e50914',
                    cursor:
                      processing
                        ? 'default'
                        : 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* BODY */}

            <div
              style={{
                maxHeight:
                  'calc(100vh - 230px)',
                overflowY: 'auto',
              }}
            >
              {loading ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#888',
                  }}
                >
                  Loading notifications...
                </div>
              ) : notifications.length ===
                0 ? (
                <div
                  style={{
                    padding: '55px 20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '38px',
                      marginBottom: '12px',
                    }}
                  >
                    🔔
                  </div>

                  <div
                    style={{
                      fontWeight: '700',
                      marginBottom: '5px',
                    }}
                  >
                    No notifications
                  </div>

                  <div
                    style={{
                      color: '#777',
                      fontSize: '13px',
                    }}
                  >
                    You're all caught up.
                  </div>
                </div>
              ) : (
                notifications.map(
                  (notification) => (
                    <div
                      key={notification.id}
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                      style={{
                        position:
                          'relative',
                        display: 'flex',
                        gap: '12px',
                        padding:
                          '14px 42px 14px 14px',
                        cursor: 'pointer',
                        background:
                          notification.read_at
                            ? 'transparent'
                            : 'rgba(229,9,20,0.08)',
                        borderBottom:
                          '1px solid rgba(255,255,255,0.06)',
                        transition:
                          'background 0.2s ease',
                      }}
                    >
                      {/* ICON */}

                      <div
                        style={{
                          flex:
                            '0 0 40px',
                          width: '40px',
                          height: '40px',
                          borderRadius:
                            '50%',
                          background:
                            'rgba(255,255,255,0.07)',
                          display:
                            'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          fontSize: '19px',
                        }}
                      >
                        <NotificationIcon
                          type={
                            notification.type
                          }
                        />
                      </div>

                      {/* CONTENT */}

                      <div
                        style={{
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap: '7px',
                          }}
                        >
                          {!notification.read_at && (
                            <span
                              style={{
                                width:
                                  '7px',
                                height:
                                  '7px',
                                borderRadius:
                                  '50%',
                                background:
                                  '#e50914',
                                flex:
                                  '0 0 7px',
                              }}
                            />
                          )}

                          <div
                            style={{
                              fontWeight:
                                '750',
                              fontSize:
                                '14px',
                              overflow:
                                'hidden',
                              textOverflow:
                                'ellipsis',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {
                              notification.title
                            }
                          </div>
                        </div>

                        <div
                          style={{
                            color:
                              '#aaa',
                            fontSize:
                              '13px',
                            lineHeight:
                              '1.45',
                            marginTop:
                              '3px',
                            wordBreak:
                              'break-word',
                          }}
                        >
                          {
                            notification.body
                          }
                        </div>

                        <div
                          style={{
                            color:
                              '#666',
                            fontSize:
                              '11px',
                            marginTop:
                              '6px',
                          }}
                        >
                          {formatTime(
                            notification.created_at
                          )}
                        </div>
                      </div>

                      {/* DELETE */}

                      <button
                        type="button"
                        onClick={(event) =>
                          handleDelete(
                            event,
                            notification
                          )
                        }
                        aria-label="Delete notification"
                        style={{
                          position:
                            'absolute',
                          top: '12px',
                          right: '10px',
                          width: '25px',
                          height: '25px',
                          border: 0,
                          borderRadius:
                            '50%',
                          background:
                            'transparent',
                          color: '#666',
                          cursor:
                            'pointer',
                          fontSize:
                            '14px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

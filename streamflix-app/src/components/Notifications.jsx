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
  switch (type) {
    case 'friend_request':
      return '👤';

    case 'friend_accepted':
      return '🤝';

    case 'watch_party_invite':
    case 'watch_party':
      return '🎬';

    case 'message':
      return '💬';

    default:
      return '🔔';
  }
}

// ============================================================
// TIME
// ============================================================

function formatTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

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
// NORMALIZE
// ============================================================

function normalizeNotification(notification) {
  const data =
    notification?.data &&
    typeof notification.data === 'object'
      ? notification.data
      : {};

  const isRead =
    notification?.is_read === true ||
    Boolean(notification?.read_at);

  return {
    ...notification,
    data,
    message:
      notification?.message ||
      notification?.body ||
      '',
    is_read: isRead,
    link:
      data?.link ||
      notification?.link ||
      null,
  };
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

  // ==========================================================
  // GET USER
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (mounted) {
          setUser(user || null);
        }
      } catch (error) {
        console.error(
          'Failed to get current user:',
          error
        );

        if (mounted) {
          setUser(null);
        }
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

  // ==========================================================
  // LOAD
  // ==========================================================

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
          fetchNotifications(
            user.id,
            50
          ),
          fetchUnreadNotificationCount(
            user.id
          ),
        ]);

        const normalized =
          Array.isArray(notificationData)
            ? notificationData.map(
                normalizeNotification
              )
            : [];

        setNotifications(normalized);

        setUnreadCount(
          Number(count) || 0
        );
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

  // ==========================================================
  // REALTIME
  // ==========================================================

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe =
      subscribeToNotifications(
        user.id,
        (incoming) => {
          if (!incoming) return;

          const notification =
            normalizeNotification(
              incoming
            );

          // DELETE
          if (
            incoming.__event ===
            'DELETE'
          ) {
            setNotifications((prev) =>
              prev.filter(
                (item) =>
                  item.id !==
                  incoming.id
              )
            );

            return;
          }

          // UPDATE
          if (
            incoming.__event ===
            'UPDATE'
          ) {
            setNotifications((prev) =>
              prev.map((item) =>
                item.id ===
                notification.id
                  ? normalizeNotification({
                      ...item,
                      ...notification,
                    })
                  : item
              )
            );

            return;
          }

          // INSERT
          setNotifications((prev) => [
            notification,
            ...prev.filter(
              (item) =>
                item.id !==
                notification.id
            ),
          ]);

          if (!notification.is_read) {
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
                    notification.message ||
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

    return () => {
      if (
        typeof unsubscribe ===
        'function'
      ) {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // ==========================================================
  // OPEN
  // ==========================================================

  const handleOpen = () => {
    setOpen((value) => !value);
  };

  // ==========================================================
  // CLICK
  // ==========================================================

  const handleNotificationClick =
    async (notification) => {
      if (!user?.id) return;

      try {
        if (!notification.is_read) {
          await markNotificationAsRead(
            notification.id,
            user.id
          );

          const now =
            new Date().toISOString();

          setNotifications((prev) =>
            prev.map((item) =>
              item.id ===
              notification.id
                ? {
                    ...item,
                    is_read: true,
                    isRead: true,
                    read_at: now,
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

          navigate(
            notification.link
          );
        }
      } catch (error) {
        console.error(
          'Failed to open notification:',
          error
        );
      }
    };

  // ==========================================================
  // MARK ALL
  // ==========================================================

  const handleMarkAllRead =
    async () => {
      if (
        !user?.id ||
        unreadCount === 0
      ) {
        return;
      }

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
            is_read: true,
            isRead: true,
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

  // ==========================================================
  // DELETE
  // ==========================================================

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
            item.id !==
            notification.id
        )
      );

      if (!notification.is_read) {
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

  // ==========================================================
  // BROWSER PERMISSION
  // ==========================================================

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

  // ==========================================================
  // NOT LOGGED IN
  // ==========================================================

  if (!user) {
    return null;
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="notification-wrap">
      {/* ====================================================
          BUTTON
      ==================================================== */}

      <button
        type="button"
        className="notification-button"
        onClick={handleOpen}
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        )}
      </button>

      {/* ====================================================
          DROPDOWN
      ==================================================== */}

      {open && (
        <>
          <div
            className="notification-backdrop"
            onClick={() =>
              setOpen(false)
            }
          />

          <div className="notification-panel">
            {/* HEADER */}

            <div className="notification-header">
              <div>
                <div className="notification-title">
                  Notifications
                </div>

                <div className="notification-subtitle">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : 'All caught up'}
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-mark-all"
                  onClick={
                    handleMarkAllRead
                  }
                  disabled={processing}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* BODY */}

            <div className="notification-list">
              {loading ? (
                <div className="notification-empty">
                  <div className="notification-loading">
                    Loading notifications...
                  </div>
                </div>
              ) : notifications.length ===
                0 ? (
                <div className="notification-empty">
                  <div className="notification-empty-icon">
                    🔔
                  </div>

                  <div className="notification-empty-title">
                    No notifications
                  </div>

                  <div className="notification-empty-text">
                    You're all caught up.
                  </div>
                </div>
              ) : (
                notifications.map(
                  (notification) => (
                    <div
                      key={
                        notification.id
                      }
                      className={`notification-item ${
                        notification.is_read
                          ? ''
                          : 'unread'
                      }`}
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                    >
                      {/* ICON */}

                      <div className="notification-item-icon">
                        <NotificationIcon
                          type={
                            notification.type
                          }
                        />
                      </div>

                      {/* CONTENT */}

                      <div className="notification-item-content">
                        <div className="notification-item-title-row">
                          {!notification.is_read && (
                            <span className="notification-unread-dot" />
                          )}

                          <div className="notification-item-title">
                            {notification.title ||
                              'Notification'}
                          </div>
                        </div>

                        <div className="notification-item-message">
                          {notification.message ||
                            ''}
                        </div>

                        <div className="notification-item-time">
                          {formatTime(
                            notification.created_at
                          )}
                        </div>
                      </div>

                      {/* DELETE */}

                      <button
                        type="button"
                        className="notification-delete"
                        onClick={(
                          event
                        ) =>
                          handleDelete(
                            event,
                            notification
                          )
                        }
                        aria-label="Delete notification"
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
    </div>
  );
}

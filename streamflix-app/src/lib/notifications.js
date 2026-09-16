import { supabase } from './supabaseClient';

// ============================================================
// FETCH NOTIFICATIONS
// ============================================================

export async function fetchNotifications(
  userId,
  limit = 50
) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    console.error(
      '[Notifications] fetchNotifications:',
      error
    );

    throw error;
  }

  return data || [];
}

// ============================================================
// FETCH UNREAD COUNT
// ============================================================

export async function fetchUnreadNotificationCount(
  userId
) {
  if (!userId) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('user_id', userId)
    .or(
      'is_read.eq.false,and(is_read.is.null,read_at.is.null)'
    );

  if (error) {
    console.error(
      '[Notifications] fetchUnreadNotificationCount:',
      error
    );

    /*
      Fallback for databases where is_read is not
      consistently populated yet.
    */
    const fallback = await supabase
      .from('notifications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', userId)
      .is('read_at', null);

    if (fallback.error) {
      throw error;
    }

    return fallback.count || 0;
  }

  return count || 0;
}

// ============================================================
// MARK ONE AS READ
// ============================================================

export async function markNotificationAsRead(
  notificationId,
  userId
) {
  if (!notificationId || !userId) return;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: now,
    })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error(
      '[Notifications] markNotificationAsRead:',
      error
    );

    throw error;
  }
}

// ============================================================
// MARK ALL AS READ
// ============================================================

export async function markAllNotificationsAsRead(
  userId
) {
  if (!userId) return;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: now,
    })
    .eq('user_id', userId)
    .or(
      'is_read.eq.false,and(is_read.is.null,read_at.is.null)'
    );

  if (error) {
    console.error(
      '[Notifications] markAllNotificationsAsRead:',
      error
    );

    /*
      Fallback for old rows where is_read may not
      have been initialized correctly.
    */
    const fallback = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now,
      })
      .eq('user_id', userId)
      .is('read_at', null);

    if (fallback.error) {
      throw error;
    }
  }
}

// ============================================================
// DELETE NOTIFICATION
// ============================================================

export async function deleteNotification(
  notificationId,
  userId
) {
  if (!notificationId || !userId) return;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error(
      '[Notifications] deleteNotification:',
      error
    );

    throw error;
  }
}

// ============================================================
// DELETE ALL READ NOTIFICATIONS
// ============================================================

export async function deleteReadNotifications(
  userId
) {
  if (!userId) return;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .or(
      'is_read.eq.true,read_at.not.is.null'
    );

  if (error) {
    console.error(
      '[Notifications] deleteReadNotifications:',
      error
    );

    throw error;
  }
}

// ============================================================
// REALTIME
// ============================================================

let activeNotificationChannel = null;
let activeNotificationUserId = null;

// ============================================================
// UNSUBSCRIBE
// ============================================================

function cleanupNotificationChannel() {
  if (!activeNotificationChannel) {
    activeNotificationUserId = null;
    return;
  }

  try {
    supabase.removeChannel(
      activeNotificationChannel
    );
  } catch (error) {
    console.warn(
      '[Notifications] Failed to remove old channel:',
      error
    );
  }

  activeNotificationChannel = null;
  activeNotificationUserId = null;
}

// ============================================================
// SUBSCRIBE
// ============================================================

export function subscribeToNotifications(
  userId,
  onNotification
) {
  if (!userId) {
    return () => {};
  }

  /*
    Prevent duplicate subscriptions for the same user.
    This is important with React StrictMode where effects
    can mount/unmount more than once during development.
  */
  if (
    activeNotificationChannel &&
    activeNotificationUserId === userId
  ) {
    return () => {
      cleanupNotificationChannel();
    };
  }

  cleanupNotificationChannel();

  const channelName =
    `notifications:${userId}`;

  let channel;

  try {
    /*
      IMPORTANT:
      Every postgres_changes callback MUST be added
      before subscribe() is called.
    */
    channel = supabase
      .channel(channelName)

      // ------------------------------------------------------
      // INSERT
      // ------------------------------------------------------

      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            if (
              payload?.new &&
              typeof onNotification ===
                'function'
            ) {
              onNotification(
                payload.new
              );
            }
          } catch (error) {
            console.error(
              '[Notifications] INSERT callback:',
              error
            );
          }
        }
      )

      // ------------------------------------------------------
      // UPDATE
      // ------------------------------------------------------

      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            if (
              payload?.new &&
              typeof onNotification ===
                'function'
            ) {
              onNotification({
                ...payload.new,
                __event: 'UPDATE',
              });
            }
          } catch (error) {
            console.error(
              '[Notifications] UPDATE callback:',
              error
            );
          }
        }
      )

      // ------------------------------------------------------
      // DELETE
      // ------------------------------------------------------

      /*
        DELETE cannot reliably use the same user_id filter
        when the old row is not exposed by Realtime.

        Therefore we listen to DELETE events and verify
        payload.old.user_id on the client.
      */
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          try {
            if (
              payload?.old?.user_id ===
                userId &&
              typeof onNotification ===
                'function'
            ) {
              onNotification({
                ...payload.old,
                __event: 'DELETE',
              });
            }
          } catch (error) {
            console.error(
              '[Notifications] DELETE callback:',
              error
            );
          }
        }
      );

    activeNotificationChannel =
      channel;

    activeNotificationUserId =
      userId;

    /*
      subscribe() is intentionally the LAST operation.
    */
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(
          '[Notifications] Realtime connected'
        );

        return;
      }

      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        console.warn(
          `[Notifications] Realtime status: ${status}`
        );

        /*
          Realtime is optional.
          The rest of the Notifications UI continues
          working through normal database requests.
        */
      }
    });
  } catch (error) {
    /*
      NEVER let a Realtime problem crash the entire app.
    */
    console.error(
      '[Notifications] Realtime setup failed:',
      error
    );

    if (
      activeNotificationChannel ===
      channel
    ) {
      activeNotificationChannel = null;
      activeNotificationUserId = null;
    }

    try {
      if (channel) {
        supabase.removeChannel(
          channel
        );
      }
    } catch {
      // Ignore cleanup errors.
    }
  }

  // ==========================================================
  // UNSUBSCRIBE
  // ==========================================================

  return () => {
    if (
      activeNotificationChannel ===
      channel
    ) {
      activeNotificationChannel = null;
      activeNotificationUserId = null;
    }

    try {
      if (channel) {
        supabase.removeChannel(
          channel
        );
      }
    } catch (error) {
      console.warn(
        '[Notifications] Cleanup failed:',
        error
      );
    }
  };
}

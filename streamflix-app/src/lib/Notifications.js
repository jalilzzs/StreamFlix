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

  if (error) throw error;

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
    .is('read_at', null);

  if (error) throw error;

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

  const { error } = await supabase
    .from('notifications')
    .update({
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ============================================================
// MARK ALL AS READ
// ============================================================

export async function markAllNotificationsAsRead(
  userId
) {
  if (!userId) return;

  const { error } = await supabase
    .from('notifications')
    .update({
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
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

  if (error) throw error;
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
    .not('read_at', 'is', null);

  if (error) throw error;
}

// ============================================================
// REALTIME
// ============================================================

export function subscribeToNotifications(
  userId,
  onNotification
) {
  if (!userId) return () => {};

  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onNotification?.(payload.new);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification?.({
          ...payload.new,
          __event: 'UPDATE',
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
      },
      (payload) => {
        if (payload.old?.user_id === userId) {
          onNotification?.({
            ...payload.old,
            __event: 'DELETE',
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

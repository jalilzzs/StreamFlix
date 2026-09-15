import { supabase } from './supabaseClient';

// ---- Profiles -------------------------------------------------------------

export async function ensureProfile(user) {
  if (!user) return null;

  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name:
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'New user',
      avatar_url: user.user_metadata?.avatar_url || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

// ---- Titles & Content (الخاصة بالبحث والمحتوى) ----------------------------

export async function fetchTitles(searchQuery = '') {
  let query = supabase.from('titles').select('*');

  if (searchQuery.trim()) {
    query = query.ilike('title', `%${searchQuery.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ---- Friendships & Requests -----------------------------------------------

export async function sendFriendRequestByCode(requesterId, targetUserId) {
  let reqId = requesterId;
  let targetId = targetUserId;

  if (typeof requesterId === 'object' && requesterId !== null) {
    reqId = requesterId.userId;
    targetId = requesterId.targetUserId || requesterId.friendCode;
  }

  if (!targetId || typeof targetId !== 'string' || !targetId.trim()) {
    throw new Error('يرجى إدخال User ID الخاص بالمستخدم.');
  }

  const cleanTargetId = targetId.trim();

  if (cleanTargetId === reqId) {
    throw new Error('لا يمكنك إرسال طلب صداقة لنفسك.');
  }

  const { data: target, error: findErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', cleanTargetId)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!target) throw new Error('لم يتم العثور على مستخدم بهذا الـ ID.');

  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: reqId,
      addressee_id: target.id,
      status: 'pending',
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('تم إرسال طلب الصداقة من قبل أو أنتما أصدقاء بالفعل.');
    }
    throw error;
  }

  return true;
}

export async function respondToFriendRequest(friendshipId, status) {
  if (status === 'rejected') {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('friendships')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', friendshipId);

  if (error) throw error;
}

export async function fetchFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*, requester:requester_id(*), addressee:addressee_id(*)')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) throw error;

  return (data || []).map((f) =>
    f.requester_id === userId ? f.addressee : f.requester
  );
}

export async function fetchPendingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*, requester:requester_id(*)')
    .eq('addressee_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
  return data || [];
}

export function subscribeToFriendRequests(userId, onChange) {
  const channel = supabase
    .channel(`friend-requests:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ---- Messages & Chat ------------------------------------------------------

export async function fetchMessages(userId, friendId, limit = 100) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function sendMessage({
  senderId,
  receiverId,
  kind = 'text',
  content,
  sharedTitleId = null,
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      kind,
      content,
      shared_title_id: sharedTitleId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToMessages(userId, friendId, onMessage) {
  const roomKey = [userId, friendId].sort().join(':');
  const channel = supabase
    .channel(`messages:${roomKey}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const m = payload.new;
        const matches =
          (m.sender_id === userId && m.receiver_id === friendId) ||
          (m.sender_id === friendId && m.receiver_id === userId);

        if (matches) onMessage(m);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ---- Chat Media Storage ---------------------------------------------------

export async function uploadChatMedia({ userId, file, kind = 'image' }) {
  if (!userId) throw new Error('يرجى تسجيل الدخول أولاً.');
  if (!file) throw new Error('لم يتم اختيار أي ملف.');

  const extension = file.name?.split('.').pop() || (kind === 'image' ? 'jpg' : 'webm');
  const filePath = `${userId}/${kind}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('chat-media')
    .getPublicUrl(filePath);

  return { url: publicUrl, path: filePath };
}

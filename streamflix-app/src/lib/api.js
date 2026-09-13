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

export async function updateProfile(userId, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---- Titles -----------------------------------------------------------

export async function fetchTitles({
  type,
  genre,
  year,
  minRating,
  search,
  limit = 30,
} = {}) {
  let query = supabase.from('titles').select('*').limit(limit);

  if (type) query = query.eq('type', type);
  if (genre) query = query.contains('genres', [genre]);
  if (year) query = query.eq('release_year', year);
  if (minRating) query = query.gte('rating_avg', minRating);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query.order('created_at', {
    ascending: false,
  });

  if (error) throw error;
  return data || [];
}

export async function fetchTitleById(id) {
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchEpisodes(titleId) {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('title_id', titleId)
    .order('season', { ascending: true })
    .order('episode_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchRecommendations(
  genres,
  excludeId,
  limit = 12
) {
  let query = supabase
    .from('titles')
    .select('*')
    .neq('id', excludeId)
    .limit(limit);

  if (genres?.length) {
    query = query.overlaps('genres', genres);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

// ---- Ratings ----------------------------------------------------------

export async function rateTitle(userId, titleId, score) {
  const { error } = await supabase
    .from('ratings')
    .upsert(
      {
        user_id: userId,
        title_id: titleId,
        score,
      },
      {
        onConflict: 'user_id,title_id',
      }
    );

  if (error) throw error;

  const { data: all, error: fetchErr } = await supabase
    .from('ratings')
    .select('score')
    .eq('title_id', titleId);

  if (fetchErr) throw fetchErr;

  const avg = all.length
    ? all.reduce((s, r) => s + r.score, 0) / all.length
    : 0;

  await supabase
    .from('titles')
    .update({ rating_avg: avg })
    .eq('id', titleId);

  return avg;
}

export async function getUserRating(userId, titleId) {
  const { data, error } = await supabase
    .from('ratings')
    .select('score')
    .eq('user_id', userId)
    .eq('title_id', titleId)
    .maybeSingle();

  if (error) throw error;
  return data?.score || 0;
}

// ---- Watchlist ----------------------------------------------------------

export async function addToWatchlist(userId, titleId) {
  const { error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      title_id: titleId,
    });

  if (error && error.code !== '23505') throw error;
}

export async function removeFromWatchlist(userId, titleId) {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('title_id', titleId);

  if (error) throw error;
}

export async function isInWatchlist(userId, titleId) {
  const { data, error } = await supabase
    .from('watchlist')
    .select('title_id')
    .eq('user_id', userId)
    .eq('title_id', titleId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function fetchWatchlist(userId) {
  const { data, error } = await supabase
    .from('watchlist')
    .select('title_id, added_at, titles(*)')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) throw error;

  return (data || [])
    .map((row) => row.titles)
    .filter(Boolean);
}

// ---- Watch history / Continue Watching -----------------------------------

export async function saveProgress(
  userId,
  episodeId,
  progressSeconds,
  completed = false
) {
  const { error } = await supabase
    .from('watch_history')
    .upsert(
      {
        user_id: userId,
        episode_id: episodeId,
        progress_seconds: Math.floor(progressSeconds),
        completed,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,episode_id',
      }
    );

  if (error) throw error;
}

export async function fetchContinueWatching(userId, limit = 10) {
  const { data, error } = await supabase
    .from('watch_history')
    .select(
      'progress_seconds, completed, updated_at, episodes(*, titles(*))'
    )
    .eq('user_id', userId)
    .eq('completed', false)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function fetchWatchedEpisodeIds(userId, titleId) {
  const { data, error } = await supabase
    .from('watch_history')
    .select(
      'episode_id, completed, episodes!inner(title_id)'
    )
    .eq('user_id', userId)
    .eq('episodes.title_id', titleId)
    .eq('completed', true);

  if (error) throw error;

  return new Set(
    (data || []).map((r) => r.episode_id)
  );
}

// ---- Friendships ----------------------------------------------------------

export async function sendFriendRequestByCode(
  requesterId,
  targetUserCode
) {
  const { data: target, error: findErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_code', targetUserCode.trim())
    .maybeSingle();

  if (findErr) throw findErr;

  if (!target) {
    throw new Error('No user found with that ID.');
  }

  if (target.id === requesterId) {
    throw new Error("You can't add yourself.");
  }

  const { error } = await supabase
    .from('friendships')
    .insert({
      requester_id: requesterId,
      addressee_id: target.id,
      status: 'pending',
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Friend request already sent.');
    }

    throw error;
  }
}

export async function respondToFriendRequest(
  friendshipId,
  status
) {
  const { error } = await supabase
    .from('friendships')
    .update({ status })
    .eq('id', friendshipId);

  if (error) throw error;
}

export async function fetchFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(
      '*, requester:requester_id(*), addressee:addressee_id(*)'
    )
    .or(
      `requester_id.eq.${userId},addressee_id.eq.${userId}`
    )
    .eq('status', 'accepted');

  if (error) throw error;

  return (data || []).map((f) =>
    f.requester_id === userId
      ? f.addressee
      : f.requester
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

// ---- Messages / chat --------------------------------------------------

export async function fetchMessages(
  userId,
  friendId,
  limit = 100
) {
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

// ---- Chat Media -----------------------------------------------------------

function getFileExtension(file) {
  const originalName = file?.name || '';
  const originalExtension = originalName.includes('.')
    ? originalName.split('.').pop().toLowerCase()
    : '';

  if (originalExtension) {
    return originalExtension;
  }

  const mime = file?.type || '';

  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webm')) return 'webm';

  return 'bin';
}

export async function uploadChatMedia({
  userId,
  file,
  kind = 'image',
}) {
  if (!userId) {
    throw new Error('You must be signed in.');
  }

  if (!file) {
    throw new Error('No file selected.');
  }

  const maxImageSize = 15 * 1024 * 1024;
  const maxAudioSize = 25 * 1024 * 1024;

  if (kind === 'image' && file.size > maxImageSize) {
    throw new Error('Image is too large. Maximum size is 15 MB.');
  }

  if (kind === 'voice' && file.size > maxAudioSize) {
    throw new Error('Voice message is too large. Maximum size is 25 MB.');
  }

  const extension = getFileExtension(file);

  const filePath = `${userId}/${kind}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage
    .from('chat-media')
    .getPublicUrl(filePath);

  return {
    path: filePath,
    url: publicUrl,
    kind,
  };
}

export function getChatMediaUrl(path) {
  if (!path) return '';

  const {
    data: { publicUrl },
  } = supabase.storage
    .from('chat-media')
    .getPublicUrl(path);

  return publicUrl;
}

// ---- Messages Realtime ----------------------------------------------------

export function subscribeToMessages(
  userId,
  friendId,
  onMessage
) {
  const channel = supabase
    .channel(
      `messages:${[userId, friendId].sort().join(':')}`
    )
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
          (m.sender_id === userId &&
            m.receiver_id === friendId) ||
          (m.sender_id === friendId &&
            m.receiver_id === userId);

        if (matches) {
          onMessage(m);
        }
      }
    )
    .subscribe();

  return () =>
    supabase.removeChannel(channel);
}

// ---- Watch Party ------------------------------------------------------

export async function createWatchParty({
  hostId,
  titleId,
  episodeId,
}) {
  const { data, error } = await supabase
    .from('watch_parties')
    .insert({
      host_id: hostId,
      title_id: titleId,
      episode_id: episodeId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('watch_party_members')
    .insert({
      party_id: data.id,
      user_id: hostId,
    });

  return data;
}

export async function joinWatchParty(
  partyId,
  userId
) {
  const { error } = await supabase
    .from('watch_party_members')
    .insert({
      party_id: partyId,
      user_id: userId,
    });

  if (error && error.code !== '23505') throw error;
}

export async function updatePartyPlayback(
  partyId,
  playbackPosition,
  status
) {
  const patch = {
    playback_position: Math.floor(playbackPosition),
  };

  if (status) {
    patch.status = status;
  }

  const { error } = await supabase
    .from('watch_parties')
    .update(patch)
    .eq('id', partyId);

  if (error) throw error;
}

export function subscribeToParty(
  partyId,
  onUpdate
) {
  const channel = supabase
    .channel(`party:${partyId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'watch_parties',
        filter: `id=eq.${partyId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();

  return () =>
    supabase.removeChannel(channel);
}

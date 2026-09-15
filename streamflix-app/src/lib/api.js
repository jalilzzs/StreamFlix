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

// ---- Titles ---------------------------------------------------------------

export async function fetchTitles({
  type,
  genre,
  year,
  minRating,
  search,
  sortBy = 'created_at',
  page = 1,
  limit = 24,
} = {}) {
  let query = supabase.from('titles').select('*', { count: 'exact' });

  if (type && type !== 'all') query = query.eq('type', type);
  if (genre && genre !== 'all') query = query.contains('genres', [genre]);
  if (year) query = query.eq('release_year', year);
  if (minRating) query = query.gte('rating_avg', minRating);
  if (search) query = query.ilike('name', `%${search}%`);

  if (sortBy === 'rating') {
    query = query.order('rating_avg', { ascending: false });
  } else if (sortBy === 'year') {
    query = query.order('release_year', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  const result = data || [];
  result.count = count || 0;

  return result;
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

// ---- Ratings --------------------------------------------------------------

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

// ---- Watchlist ------------------------------------------------------------

export async function addToWatchlist(userId, titleId) {
  const { error } = await supabase
    .from('watchlist')
    .insert({
      user_id: userId,
      title_id: titleId,
    });

  if (error && error.code !== '23505') {
    throw error;
  }
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

// ---- Watch history --------------------------------------------------------

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

export function subscribeToFriendRequests(
  userId,
  onRequest
) {
  if (!userId) return () => {};

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
      async (payload) => {
        try {
          const friendship =
            payload.new || payload.old;

          if (!friendship) return;

          if (
            payload.eventType === 'INSERT' ||
            payload.eventType === 'UPDATE'
          ) {
            const { data, error } = await supabase
              .from('friendships')
              .select(
                '*, requester:requester_id(*)'
              )
              .eq('id', friendship.id)
              .maybeSingle();

            if (error) {
              console.error(
                'Error loading friend request:',
                error
              );
              return;
            }

            if (data) {
              onRequest?.(data);
            }
          } else if (
            payload.eventType === 'DELETE'
          ) {
            onRequest?.({
              ...friendship,
              deleted: true,
            });
          }
        } catch (error) {
          console.error(
            'Friend request realtime error:',
            error
          );
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ---- Messages -------------------------------------------------------------

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
    .order('created_at', {
      ascending: true,
    })
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
  sharedPartyId = null,
  metadata = {},
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      kind,
      content,
      shared_title_id: sharedTitleId,
      shared_party_id: sharedPartyId,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

// ---- Chat Media -----------------------------------------------------------

function getFileExtension(file) {
  const originalName = file?.name || '';

  if (originalName.includes('.')) {
    return originalName
      .split('.')
      .pop()
      .toLowerCase();
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
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('zip')) return 'zip';

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

  const maxImageSize =
    15 * 1024 * 1024;

  const maxAudioSize =
    25 * 1024 * 1024;

  const maxFileSize =
    50 * 1024 * 1024;

  if (
    kind === 'image' &&
    file.size > maxImageSize
  ) {
    throw new Error(
      'Image is too large. Maximum size is 15 MB.'
    );
  }

  if (
    kind === 'voice' &&
    file.size > maxAudioSize
  ) {
    throw new Error(
      'Voice message is too large. Maximum size is 25 MB.'
    );
  }

  if (
    kind === 'file' &&
    file.size > maxFileSize
  ) {
    throw new Error(
      'File is too large. Maximum size is 50 MB.'
    );
  }

  const extension =
    getFileExtension(file);

  const filePath =
    `${userId}/${kind}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

  const { error: uploadError } =
    await supabase.storage
      .from('chat-media')
      .upload(
        filePath,
        file,
        {
          cacheControl: '3600',
          upsert: false,
          contentType:
            file.type || undefined,
        }
      );

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
    name: file.name || 'file',
    size: file.size || 0,
    mime: file.type || '',
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

// ---- Messages Realtime ---------------------------------------------------

export function subscribeToMessages(
  userId,
  friendId,
  onMessage
) {
  const channel = supabase
    .channel(
      `messages:${[userId, friendId]
        .sort()
        .join(':')}`
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
};

// ==========================================================================
// WATCH PARTY
// ==========================================================================

// ---- Create Watch Party --------------------------------------------------

export async function createWatchParty({
  hostId,
  titleId,
  episodeId = null,
}) {
  if (!hostId) {
    throw new Error('Host user is required.');
  }

  if (!titleId) {
    throw new Error('Title is required.');
  }

  const { data, error } = await supabase
    .from('watch_parties')
    .insert({
      host_id: hostId,
      title_id: titleId,
      episode_id: episodeId || null,
      status: 'pending',
      playback_position: 0,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: memberError } =
    await supabase
      .from('watch_party_members')
      .insert({
        party_id: data.id,
        user_id: hostId,
      });

  if (
    memberError &&
    memberError.code !== '23505'
  ) {
    throw memberError;
  }

  return data;
}

// ---- Create Invitations --------------------------------------------------

export async function createWatchPartyInvites({
  partyId,
  hostId,
  friendIds = [],
}) {
  if (!partyId) {
    throw new Error('Watch Party ID is required.');
  }

  if (!hostId) {
    throw new Error('Host user is required.');
  }

  const uniqueFriendIds = [
    ...new Set(
      (friendIds || []).filter(
        (id) => id && id !== hostId
      )
    ),
  ];

  if (!uniqueFriendIds.length) {
    return [];
  }

  const rows = uniqueFriendIds.map(
    (friendId) => ({
      party_id: partyId,
      sender_id: hostId,
      receiver_id: friendId,
      status: 'pending',
    })
  );

  const { data, error } = await supabase
    .from('watch_party_invites')
    .insert(rows)
    .select();

  if (error) throw error;

  return data || [];
}

// ---- Create Party + Invitations -----------------------------------------

export async function createWatchPartyWithInvites({
  hostId,
  titleId,
  episodeId = null,
  friendIds = [],
}) {
  const party = await createWatchParty({
    hostId,
    titleId,
    episodeId,
  });

  try {
    const invites =
      await createWatchPartyInvites({
        partyId: party.id,
        hostId,
        friendIds,
      });

    return {
      party,
      invites,
    };
  } catch (error) {
    try {
      await supabase
        .from('watch_parties')
        .update({
          status: 'ended',
        })
        .eq('id', party.id);
    } catch {
      // Ignore cleanup error and preserve original error.
    }

    throw error;
  }
}

// ---- Get Party -----------------------------------------------------------

export async function getWatchParty(partyId) {
  if (!partyId) {
    throw new Error('Watch Party ID is required.');
  }

  const { data, error } = await supabase
    .from('watch_parties')
    .select('*')
    .eq('id', partyId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

// ---- Get Party Members ---------------------------------------------------

export async function fetchWatchPartyMembers(
  partyId
) {
  if (!partyId) return [];

  const { data, error } = await supabase
    .from('watch_party_members')
    .select(
      '*, profile:user_id(*)'
    )
    .eq('party_id', partyId)
    .order('joined_at', {
      ascending: true,
    });

  if (error) throw error;

  return data || [];
}

// ---- Get My Invitations --------------------------------------------------

export async function fetchWatchPartyInvites(
  userId
) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('watch_party_invites')
    .select(
      '*, party:party_id(*), sender:sender_id(*), receiver:receiver_id(*)'
    )
    .eq('receiver_id', userId)
    .order('created_at', {
      ascending: false,
    });

  if (error) throw error;

  return data || [];
}

// ---- Check Invitation ----------------------------------------------------

export async function getWatchPartyInvite(
  partyId,
  userId
) {
  if (!partyId || !userId) return null;

  const { data, error } = await supabase
    .from('watch_party_invites')
    .select('*')
    .eq('party_id', partyId)
    .eq('receiver_id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

// ---- Accept Invitation + Join -------------------------------------------

export async function acceptWatchPartyInvite(
  inviteId,
  partyId,
  userId
) {
  if (!inviteId) {
    throw new Error('Invitation ID is required.');
  }

  if (!partyId) {
    throw new Error('Watch Party ID is required.');
  }

  if (!userId) {
    throw new Error('User is required.');
  }

  const { data: invite, error: inviteError } =
    await supabase
      .from('watch_party_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('party_id', partyId)
      .eq('receiver_id', userId)
      .maybeSingle();

  if (inviteError) throw inviteError;

  if (!invite) {
    throw new Error(
      'You are not invited to this Watch Party.'
    );
  }

  if (
    invite.status === 'declined' ||
    invite.status === 'expired'
  ) {
    throw new Error(
      'This invitation is no longer available.'
    );
  }

  const { data: party, error: partyError } =
    await supabase
      .from('watch_parties')
      .select('*')
      .eq('id', partyId)
      .maybeSingle();

  if (partyError) throw partyError;

  if (!party) {
    throw new Error(
      'Watch Party no longer exists.'
    );
  }

  if (party.status === 'ended') {
    throw new Error(
      'This Watch Party has ended.'
    );
  }

  const { error: memberError } =
    await supabase
      .from('watch_party_members')
      .upsert(
        {
          party_id: partyId,
          user_id: userId,
        },
        {
          onConflict: 'party_id,user_id',
        }
      );

  if (memberError) throw memberError;

  const { error: updateError } =
    await supabase
      .from('watch_party_invites')
      .update({
        status: 'accepted',
        responded_at:
          new Date().toISOString(),
      })
      .eq('id', inviteId)
      .eq('receiver_id', userId);

  if (updateError) throw updateError;

  if (party.status === 'pending') {
    await supabase
      .from('watch_parties')
      .update({
        status: 'live',
      })
      .eq('id', partyId)
      .eq('status', 'pending');
  }

  return party;
}

// ---- Decline Invitation -------------------------------------------------

export async function declineWatchPartyInvite(
  inviteId,
  userId
) {
  if (!inviteId || !userId) {
    throw new Error(
      'Invitation and user are required.'
    );
  }

  const { data, error } = await supabase
    .from('watch_party_invites')
    .update({
      status: 'declined',
      responded_at:
        new Date().toISOString(),
    })
    .eq('id', inviteId)
    .eq('receiver_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
}

// ---- Join Party ----------------------------------------------------------

export async function joinWatchParty(
  partyId,
  userId
) {
  if (!partyId || !userId) {
    throw new Error(
      'Party and user are required.'
    );
  }

  const { data: party, error: partyError } =
    await supabase
      .from('watch_parties')
      .select('*')
      .eq('id', partyId)
      .maybeSingle();

  if (partyError) throw partyError;

  if (!party) {
    throw new Error(
      'Watch Party not found.'
    );
  }

  if (party.status === 'ended') {
    throw new Error(
      'This Watch Party has ended.'
    );
  }

  // Host is always allowed to enter his own room.
  if (party.host_id !== userId) {
    const { data: invite, error: inviteError } =
      await supabase
        .from('watch_party_invites')
        .select('id, status')
        .eq('party_id', partyId)
        .eq('receiver_id', userId)
        .maybeSingle();

    if (inviteError) throw inviteError;

    if (!invite) {
      throw new Error(
        'You were not invited to this Watch Party.'
      );
    }

    if (
      invite.status !== 'pending' &&
      invite.status !== 'accepted'
    ) {
      throw new Error(
        'Your Watch Party invitation is not active.'
      );
    }
  }

  const { error } = await supabase
    .from('watch_party_members')
    .upsert(
      {
        party_id: partyId,
        user_id: userId,
      },
      {
        onConflict: 'party_id,user_id',
      }
    );

  if (error) throw error;

  return party;
}

// ---- Leave Party ---------------------------------------------------------

export async function leaveWatchParty(
  partyId,
  userId
) {
  if (!partyId || !userId) {
    throw new Error(
      'Party and user are required.'
    );
  }

  const { data: party, error: partyError } =
    await supabase
      .from('watch_parties')
      .select('host_id, status')
      .eq('id', partyId)
      .maybeSingle();

  if (partyError) throw partyError;

  if (!party) return;

  const { error: memberError } =
    await supabase
      .from('watch_party_members')
      .delete()
      .eq('party_id', partyId)
      .eq('user_id', userId);

  if (memberError) throw memberError;

  // If the host leaves, end the party.
  if (party.host_id === userId) {
    const { error } = await supabase
      .from('watch_parties')
      .update({
        status: 'ended',
        closed_at: new Date().toISOString(),
      })
      .eq('id', partyId);

    if (error) throw error;

    return;
  }

  // If nobody remains, end the party.
  const { count, error: countError } =
    await supabase
      .from('watch_party_members')
      .select('user_id', {
        count: 'exact',
        head: true,
      })
      .eq('party_id', partyId);

  if (countError) throw countError;

  if (!count || count === 0) {
    const { error } = await supabase
      .from('watch_parties')
      .update({
        status: 'ended',
        closed_at: new Date().toISOString(),
      })
      .eq('id', partyId);

    if (error) throw error;
  }
}

// ---- Playback ------------------------------------------------------------

export async function updatePartyPlayback(
  partyId,
  playbackPosition,
  status
) {
  if (!partyId) {
    throw new Error(
      'Watch Party ID is required.'
    );
  }

  const patch = {
    playback_position: Math.max(
      0,
      Math.floor(
        Number(playbackPosition) || 0
      )
    ),
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

// ---- Party Realtime ------------------------------------------------------

export function subscribeToParty(
  partyId,
  onUpdate
) {
  if (!partyId) return () => {};

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
      (payload) => {
        onUpdate?.(payload.new);
      }
    )
    .subscribe();

  return () =>
    supabase.removeChannel(channel);
}

// ---- Party Members Realtime ---------------------------------------------

export function subscribeToPartyMembers(
  partyId,
  onUpdate
) {
  if (!partyId) return () => {};

  const channel = supabase
    .channel(`party-members:${partyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'watch_party_members',
        filter: `party_id=eq.${partyId}`,
      },
      (payload) => {
        onUpdate?.(payload);
      }
    )
    .subscribe();

  return () =>
    supabase.removeChannel(channel);
}

// ---- Party Invitations Realtime -----------------------------------------

export function subscribeToWatchPartyInvites(
  userId,
  onInvite
) {
  if (!userId) return () => {};

  const channel = supabase
    .channel(
      `watch-party-invites:${userId}`
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'watch_party_invites',
        filter: `receiver_id=eq.${userId}`,
      },
      async (payload) => {
        try {
          const row =
            payload.new || payload.old;

          if (!row?.id) return;

          const { data, error } =
            await supabase
              .from('watch_party_invites')
              .select(
                '*, party:party_id(*), sender:sender_id(*)'
              )
              .eq('id', row.id)
              .maybeSingle();

          if (error) {
            console.error(
              'Watch Party invite realtime error:',
              error
            );
            return;
          }

          onInvite?.(
            data || {
              ...row,
              deleted:
                payload.eventType ===
                'DELETE',
            }
          );
        } catch (error) {
          console.error(
            'Watch Party invite realtime error:',
            error
          );
        }
      }
    )
    .subscribe();

  return () =>
    supabase.removeChannel(channel);
}

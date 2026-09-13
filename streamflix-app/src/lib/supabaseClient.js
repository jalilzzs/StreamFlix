import { createClient } from '@supabase/supabase-js';

const url = 'https://uevrxllwooinittongel.supabase.co';
const anonKey = 'Sb_secret_zY_YLSTuzgvyzPJ2cs4JlQ_WeDpM8VN';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

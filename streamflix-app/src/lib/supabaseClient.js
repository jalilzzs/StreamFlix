import { createClient } from '@supabase/supabase-js';

const url = 'https://uevrxllwooinittongel.supabase.co';
const anonKey = 'Sb_secret_zY_YLSTuzgvyzPJ2cs4JlQ_WeDpM8VN';

if (!url || !anonKey || url.includes('YOUR_') || anonKey.includes('YOUR_')) {
  // eslint-disable-next-line no-console
  console.warn(
    '[StreamFlix] Supabase credentials are not set. Add VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY to your .env file. Auth and data features will fail until then.'
  );
}

export const supabase = createClient(url || '', anonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// سطر للتأكد في Console المتصفح
console.log('[StreamFlix Debug] Supabase URL:', url);
console.log('[StreamFlix Debug] Has Anon Key?:', !!anonKey);

if (!url || !anonKey || url.includes('YOUR_') || anonKey.includes('YOUR_')) {
  console.error(
    '[StreamFlix] Supabase credentials are missing or set to placeholder values!'
  );
}

export const supabase = createClient(url || '', anonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

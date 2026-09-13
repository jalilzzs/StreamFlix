export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'YOUR_STRIPE_PUBLISHABLE_KEY_HERE';

// Fill these in once you have real plan IDs from your payment provider.
export const PLAN_IDS = {
  vipMonthly: 'YOUR_STRIPE_PRICE_ID_VIP_MONTHLY',
  vipAnnual: 'YOUR_STRIPE_PRICE_ID_VIP_ANNUAL',
};

// Stream server labels shown on the player. Actual URLs live in Supabase
// (episodes.stream_urls jsonb, keyed by these same ids) — you'll populate
// those rows yourself; the player just reads whichever keys exist.
export const STREAM_SERVER_LABELS = {
  server1: 'Server 1',
  server2: 'Server 2',
  server3: 'Server 3',
};

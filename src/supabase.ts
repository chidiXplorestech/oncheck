import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://ayizmdoyynptwadnjpdc.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_sfp0ZpI3horCqcn-fO0NVQ_-l6meKtQ';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || FALLBACK_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || FALLBACK_PUBLISHABLE_KEY;

export const supabaseEnabled = Boolean(url && publishableKey);

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

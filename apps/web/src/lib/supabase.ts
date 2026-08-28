import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing from .env')
}

/**
 * Signing in and holding the session, nothing else. Every piece of data comes
 * from our own API: the Supabase data API is switched off and the key above is
 * public by design.
 */
export const supabase = createClient(url, key)

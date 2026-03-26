import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Service role client bypasses RLS — use only in backend, never expose to frontend
export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

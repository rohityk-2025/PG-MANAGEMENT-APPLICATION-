import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Admin client for server-side operations that need to bypass RLS
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

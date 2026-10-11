import { createClient } from '@supabase/supabase-js'

// These come from .env.local (see .env.example). They are public values:
// security comes from the Row Level Security rules in supabase/migrations.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(url && publishableKey)

export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'missing-key')

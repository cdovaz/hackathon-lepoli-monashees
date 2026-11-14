import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ngxqzfvfehendlsyxhmq.supabase.co';

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.length > 10
);

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neHF6ZnZmZWhlbmRsc3l4aG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4MjAwMDAsImV4cCI6MjAyNTM5NjAwMH0.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

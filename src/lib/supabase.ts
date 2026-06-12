import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cloud sync backend (Supabase).
 *
 * The publishable key is safe to expose in client code — all data access
 * is protected by Row Level Security (each user only sees their own rows).
 * Values can be overridden via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 */
const FALLBACK_URL = "https://umzrddthnqwbomtotavt.supabase.co";
const FALLBACK_KEY = "sb_publishable_HehK92a9fpKP4o9O5Ys6vw_MBLuBVE9";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const cloudEnabled = url.startsWith("https://") && key.length > 20;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

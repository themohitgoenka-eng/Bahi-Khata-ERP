import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'bahi_khata_supabase_url';
const SUPABASE_KEY_KEY = 'bahi_khata_supabase_key';

// Defaults are sourced STRICTLY from environment variables (.env) so the codebase
// stays clean, portable and free of hardcoded cloud attachments.
// Vite exposes only VITE_-prefixed vars to the client bundle.
const DEFAULT_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const DEFAULT_SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export const getSupabaseConfig = (): SupabaseConfig => {
  let url = DEFAULT_SUPABASE_URL;
  let anonKey = DEFAULT_SUPABASE_KEY;

  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem(SUPABASE_URL_KEY);
    const savedKey = localStorage.getItem(SUPABASE_KEY_KEY);
    if (savedUrl) url = savedUrl.trim();
    if (savedKey) anonKey = savedKey.trim();
  }

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
};

export const saveSupabaseConfig = (url: string, anonKey: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SUPABASE_URL_KEY, url.trim());
    localStorage.setItem(SUPABASE_KEY_KEY, anonKey.trim());
  }
  // Invalidate cached client so next call recreates it
  cachedClient = null;
  cachedUrl = '';
  cachedKey = '';
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  if (cachedClient && cachedUrl === config.url && cachedKey === config.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedUrl = config.url;
    cachedKey = config.anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
};

export const testSupabaseConnection = async (): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> => {
  const startTime = Date.now();
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase URL or Key is missing. Please configure credentials.',
    };
  }

  try {
    // Attempt a lightweight query to test connectivity
    const { error } = await client.from('companies').select('id').limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      // If table doesn't exist yet, connection is still valid (endpoint reachable)
      if (error.code === '42P01' || error.message.includes('relation "companies" does not exist')) {
        return {
          success: true,
          message: `Connected successfully to Supabase (${latencyMs}ms)! Note: Tables need to be initialized in SQL Editor.`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: `Connection error: ${error.message} (${error.code || 'ERR'})`,
      };
    }

    return {
      success: true,
      message: `Connected successfully to Supabase cloud database (${latencyMs}ms)!`,
      latencyMs,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error connecting to Supabase.',
    };
  }
};

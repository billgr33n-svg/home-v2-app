// Client-safe configuration. Expo inlines EXPO_PUBLIC_* at build time.
// The service-role key and DATABASE_URL must never appear here or anywhere
// in the client bundle (see AGENT_OPERATING_GUIDE and ADR-0002).

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
} as const;

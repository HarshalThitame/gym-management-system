type SupabaseRuntimeConfig = {
  url: string;
  publishableKey: string;
};

function readEnv(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function readStaticEnv(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function getSupabaseUrl() {
  return readStaticEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return (
    readStaticEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ?? readStaticEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ?? readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    ?? readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function getSupabaseServiceKey() {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? readEnv("SUPABASE_SECRET_KEY");
}

export function hasSupabasePublicEnv() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function getRequiredSupabasePublicConfig(): SupabaseRuntimeConfig {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required for authentication.");
  }

  return { url, publishableKey };
}

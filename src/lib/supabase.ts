import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigError = getConfigError(
  supabaseUrl,
  supabasePublishableKey
);

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    });

function getConfigError(
  url: string | undefined,
  publishableKey: string | undefined
): string | null {
  if (!url || !publishableKey) {
    return "Supabase 연결 정보가 없습니다. .env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 설정해주세요.";
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
      return "VITE_SUPABASE_URL은 HTTPS Supabase project URL이어야 합니다.";
    }
  } catch {
    return "VITE_SUPABASE_URL 형식이 올바르지 않습니다.";
  }

  if (publishableKey.startsWith("sb_secret_") || getLegacyJwtRole(publishableKey) === "service_role") {
    return "브라우저에는 publishable key만 사용할 수 있습니다. secret/service role key를 제거해주세요.";
  }

  return null;
}

function getLegacyJwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(paddedPayload)) as { role?: unknown };
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

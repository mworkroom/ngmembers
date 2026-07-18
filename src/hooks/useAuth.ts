import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "../lib/supabase";

export type AuthStatus =
  | "config-error"
  | "loading"
  | "signed-out"
  | "checking-access"
  | "authorized"
  | "unauthorized"
  | "error";

interface WorkspaceAccessRow {
  is_authorized: boolean;
  role: string | null;
}

export interface AuthState {
  status: AuthStatus;
  email: string | null;
  role: "admin" | null;
  message: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [accessStatus, setAccessStatus] = useState<
    "idle" | "checking" | "authorized" | "unauthorized" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(supabaseConfigError);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      setSession(data.session);
      setSessionReady(true);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setSessionReady(true);
      setMessage(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !sessionReady) return;
    if (!session) {
      setAccessStatus("idle");
      return;
    }

    let active = true;
    setAccessStatus("checking");
    setMessage(null);

    void supabase
      .rpc("get_ngmembers_access")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage(
            `워크스페이스 권한을 확인하지 못했습니다. ${error.message}`
          );
          setAccessStatus("error");
          return;
        }

        const row = (data as WorkspaceAccessRow[] | null)?.[0];
        setAccessStatus(
          row?.is_authorized && row.role === "admin"
            ? "authorized"
            : "unauthorized"
        );
      });

    return () => {
      active = false;
    };
  }, [session, sessionReady, retryToken]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    setMessage(null);
    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.href).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });
    if (error) setMessage(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setSession(null);
    setAccessStatus("idle");
  }, []);

  const retry = useCallback(() => {
    setRetryToken((current) => current + 1);
  }, []);

  const status = getStatus({
    configError: supabaseConfigError,
    sessionReady,
    session,
    accessStatus,
    message
  });

  return {
    status,
    email: session?.user.email ?? null,
    role: status === "authorized" ? "admin" : null,
    message,
    signInWithGoogle,
    signOut,
    retry
  };
}

function getStatus({
  configError,
  sessionReady,
  session,
  accessStatus,
  message
}: {
  configError: string | null;
  sessionReady: boolean;
  session: Session | null;
  accessStatus: "idle" | "checking" | "authorized" | "unauthorized" | "error";
  message: string | null;
}): AuthStatus {
  if (configError) return "config-error";
  if (!sessionReady) return "loading";
  if (!session) return message ? "error" : "signed-out";
  if (accessStatus === "authorized") return "authorized";
  if (accessStatus === "unauthorized") return "unauthorized";
  if (accessStatus === "error") return "error";
  return "checking-access";
}

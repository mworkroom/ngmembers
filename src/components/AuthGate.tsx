import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { LoginScreen } from "./LoginScreen";

interface AuthorizedContext {
  email: string | null;
  signOut: () => Promise<void>;
}

interface AuthGateProps {
  children: (context: AuthorizedContext) => ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const auth = useAuth();

  if (auth.status === "authorized" && auth.role) {
    return <>{children({ email: auth.email, signOut: auth.signOut })}</>;
  }

  return (
    <LoginScreen
      status={auth.status}
      email={auth.email}
      message={auth.message}
      onSignIn={auth.signInWithGoogle}
      onSignOut={auth.signOut}
      onRetry={auth.retry}
    />
  );
}

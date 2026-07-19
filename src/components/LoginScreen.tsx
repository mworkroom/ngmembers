import type { AuthStatus } from "../hooks/useAuth";

interface LoginScreenProps {
  status: AuthStatus;
  email: string | null;
  message: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRetry: () => void;
}

export function LoginScreen({
  status,
  email,
  message,
  onSignIn,
  onSignOut,
  onRetry
}: LoginScreenProps) {
  const content = getContent(status);

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-live="polite">
        <span className="auth-eyebrow">NGMEMBERS</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>

        {email ? <div className="auth-account">로그인 계정 · {email}</div> : null}
        {message ? <div className="auth-message">{message}</div> : null}

        <div className="auth-actions">
          {status === "signed-out" || (status === "error" && !email) ? (
            <button
              type="button"
              className="auth-primary-button"
              onClick={() => void onSignIn()}
            >
              Google로 로그인
            </button>
          ) : null}

          {status === "unauthorized" || (status === "error" && email) ? (
            <button
              type="button"
              className="auth-secondary-button"
              onClick={() => void onSignOut()}
            >
              로그아웃
            </button>
          ) : null}

          {status === "error" && email ? (
            <button type="button" className="auth-primary-button" onClick={onRetry}>
              권한 다시 확인
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function getContent(status: AuthStatus) {
  switch (status) {
    case "config-error":
      return {
        title: "Supabase 설정이 필요합니다",
        description: "로컬 환경변수를 설정한 뒤 앱을 다시 시작해주세요."
      };
    case "loading":
      return {
        title: "로그인 상태를 확인하고 있습니다",
        description: "잠시만 기다려주세요."
      };
    case "checking-access":
    case "authorized":
      return {
        title: "사용 권한을 확인하고 있습니다",
        description: "잠시만 기다려주세요."
      };
    case "unauthorized":
      return {
        title: "사용 권한이 없는 계정입니다",
        description: "허용된 계정으로 다시 로그인해주세요."
      };
    case "error":
      return {
        title: "인증을 완료하지 못했습니다",
        description: "아래 오류를 확인한 뒤 다시 시도해주세요."
      };
    case "signed-out":
    default:
      return {
        title: "회원 계보 찾기",
        description: "Google Admin 계정으로 로그인해주세요."
      };
  }
}

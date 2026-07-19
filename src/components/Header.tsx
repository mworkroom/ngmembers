import { useState } from "react";

interface HeaderProps {
  onAdd: () => void;
  onManage: () => void;
  onSignOut: () => Promise<void>;
  email: string | null;
  dataActionsDisabled?: boolean;
}

export function Header({
  onAdd,
  onManage,
  onSignOut,
  email,
  dataActionsDisabled = false
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <header className="topbar">
      <h1>회원 계보 찾기</h1>
      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-button"
          disabled={dataActionsDisabled}
          onClick={onAdd}
        >
          <span aria-hidden="true">＋</span>
          <span className="topbar-button-long">회원 추가</span>
          <span className="topbar-button-short">추가</span>
        </button>
        <details
          className="topbar-menu"
          open={menuOpen}
          onToggle={(event) => setMenuOpen(event.currentTarget.open)}
        >
          <summary aria-label="설정 메뉴">
            <img src="./icons/settings.png" alt="" aria-hidden="true" />
          </summary>
          <div className="topbar-menu-panel">
            <p className="topbar-menu-account">
              <span>로그인한 아이디</span>
              <strong>{email || "확인할 수 없음"}</strong>
            </p>
            <button
              type="button"
              disabled={dataActionsDisabled}
              onClick={() => closeMenu(onManage)}
            >
              관리
            </button>
            <button
              type="button"
              onClick={() => closeMenu(() => void onSignOut())}
            >
              로그아웃
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}

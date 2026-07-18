interface HeaderProps {
  onAdd: () => void;
  onManage: () => void;
  onSignOut: () => Promise<void>;
  role: "admin";
}

export function Header({ onAdd, onManage, onSignOut, role }: HeaderProps) {
  return (
    <header className="topbar">
      <h1>회원 계보 찾기</h1>
      <div className="topbar-actions">
        <span className="role-chip">{role === "admin" ? "Admin" : role}</span>
        <button type="button" className="topbar-button" onClick={onAdd}>
          <span aria-hidden="true">＋</span>
          <span className="topbar-button-long">회원 추가</span>
          <span className="topbar-button-short">추가</span>
        </button>
        <button type="button" className="topbar-button" onClick={onManage}>
          관리
        </button>
        <button
          type="button"
          className="topbar-button topbar-signout"
          onClick={() => void onSignOut()}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}

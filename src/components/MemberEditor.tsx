import { useEffect, useMemo, useState } from "react";
import type {
  MemberFormState,
  MemberRecord,
  RelationIndex
} from "../types";
import { labels } from "../content/labels";
import {
  isValidNickname,
  onlyDigits,
  sideLabel
} from "../utils/formatters";
import { CloseIcon } from "./Icons";
import { MemberPicker } from "./MemberPicker";

interface MemberEditorProps {
  member: MemberRecord | null;
  members: MemberRecord[];
  relations: RelationIndex;
  pending: boolean;
  onClose: () => void;
  onSave: (state: MemberFormState) => Promise<void>;
}

const statusOptions = [
  { value: "active", label: "활동" },
  { value: "withdrawn", label: "탈퇴" },
  { value: "review", label: "확인 필요" }
] as const;

export function MemberEditor({
  member,
  members,
  relations,
  pending,
  onClose,
  onSave
}: MemberEditorProps) {
  const [state, setState] = useState<MemberFormState>(() =>
    initialState(member, relations)
  );
  const [error, setError] = useState("");
  const isEditing = Boolean(member);

  useEffect(() => {
    setState(initialState(member, relations));
    setError("");
  }, [member, relations]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, pending]);

  const unresolvedHint = useMemo(() => {
    if (state.affiliationId || !state.sponsorNameRaw) return "";
    return `현재 시트 메모: ${state.sponsorNameRaw}`;
  }, [state.affiliationId, state.sponsorNameRaw]);

  return (
    <div
      className="editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !pending) onClose();
      }}
    >
      <section
        className="member-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="editor-heading">
          <div>
            <h2 id="member-editor-title">
              {isEditing ? "회원 정보 수정" : "새 회원 추가"}
            </h2>
            <p>상위 회원은 직접 입력하지 않고 검색 결과에서 선택합니다.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            disabled={pending}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <form
          className="member-form"
          onSubmit={(event) => {
            event.preventDefault();
            const validation = validateForm(state, member, members);
            if (validation) {
              setError(validation);
              return;
            }
            setError("");
            void onSave(state);
          }}
        >
          <section className="form-section">
            <h3>기본 정보</h3>
            <div className="form-grid two-columns">
              <label>
                <span className="field-label">회원번호</span>
                <input
                  value={state.memberNumber}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={24}
                  autoFocus={!isEditing}
                  onChange={(event) =>
                    patch({ memberNumber: onlyDigits(event.target.value) })
                  }
                />
              </label>
              <label>
                <span className="field-label">{labels.editor.country}</span>
                <select
                  value={state.countryCode}
                  onChange={(event) =>
                    patch({ countryCode: event.target.value })
                  }
                >
                  {labels.editor.countryOptions.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="field-hint">{labels.editor.countryHint}</small>
              </label>
            </div>

            <label>
              <span className="field-label">가입 이름</span>
              <input
                value={state.name}
                type="text"
                autoComplete="off"
                onChange={(event) => patch({ name: event.target.value })}
              />
            </label>

            <label>
              <span className="field-label">닉네임</span>
              <input
                value={state.nickname}
                type="text"
                autoComplete="off"
                placeholder={labels.editor.nicknamePlaceholder}
                onChange={(event) => patch({ nickname: event.target.value })}
              />
              <small className="field-hint">{labels.editor.nicknameHint}</small>
            </label>

            <div className="form-grid two-columns">
              <label>
                <span className="field-label">회원 상태</span>
                <select
                  value={state.status}
                  onChange={(event) =>
                    patch({ status: event.target.value as MemberFormState["status"] })
                  }
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="checkbox-stack">
                <label className="checkbox-card">
                  <input
                    checked={state.isAnchorMember}
                    type="checkbox"
                    onChange={(event) =>
                      patch({ isAnchorMember: event.target.checked })
                    }
                  />
                  <span>{labels.member.anchor}</span>
                </label>
                <label className="checkbox-card">
                  <input
                    checked={state.isFavorite}
                    type="checkbox"
                    onChange={(event) => patch({ isFavorite: event.target.checked })}
                  />
                  <span>관심 회원</span>
                </label>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>소속</h3>
            <MemberPicker
              label="스폰서 선택"
              members={members}
              selectedId={state.affiliationId}
              excludeId={member?.id}
              hint={unresolvedHint}
              onChange={(affiliationId) =>
                patch({
                  affiliationId,
                  sponsorNameRaw: affiliationId ? state.sponsorNameRaw : ""
                })
              }
            />
            <label>
              <span className="field-label">위치</span>
              <select
                value={state.side ?? ""}
                onChange={(event) =>
                  patch({
                    side:
                      event.target.value === "left"
                        ? "left"
                        : event.target.value === "right"
                          ? "right"
                          : null
                  })
                }
              >
                <option value="">위치 미확인</option>
                <option value="left">{sideLabel("left")}</option>
                <option value="right">{sideLabel("right")}</option>
              </select>
            </label>
          </section>

          <details className="optional-form-section">
            <summary>직계 관계를 아는 경우</summary>
            <div className="optional-form-content">
              <MemberPicker
                label="바로 위 회원"
                members={members}
                selectedId={state.directParentId}
                excludeId={member?.id}
                onChange={(directParentId) => patch({ directParentId })}
              />
              <label>
                <span className="field-label">바로 위 회원 기준 위치</span>
                <select
                  value={state.directParentSide ?? ""}
                  onChange={(event) =>
                    patch({
                      directParentSide:
                        event.target.value === "left"
                          ? "left"
                          : event.target.value === "right"
                            ? "right"
                            : null
                    })
                  }
                >
                  <option value="">위치 미확인</option>
                  <option value="left">좌</option>
                  <option value="right">우</option>
                </select>
              </label>
            </div>
          </details>

          <details className="optional-form-section">
            <summary>연락처와 추가 정보</summary>
            <div className="optional-form-content">
              <div className="form-grid two-columns">
                <label>
                  <span className="field-label">생년월일</span>
                  <input
                    value={state.birthDate}
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="숫자 8자리만 입력"
                    onChange={(event) =>
                      patch({ birthDate: onlyDigits(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span className="field-label">전화번호</span>
                  <input
                    value={state.phone}
                    type="text"
                    inputMode="tel"
                    maxLength={20}
                    placeholder="숫자만 입력"
                    onChange={(event) =>
                      patch({ phone: onlyDigits(event.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                <span className="field-label">CPF</span>
                <input
                  value={state.cpf}
                  type="text"
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="숫자 11자리만 입력"
                  onChange={(event) => patch({ cpf: onlyDigits(event.target.value) })}
                />
              </label>
              <label>
                <span className="field-label">메모</span>
                <textarea
                  value={state.notes}
                  rows={4}
                  onChange={(event) => patch({ notes: event.target.value })}
                />
              </label>
            </div>
          </details>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="editor-actions">
            <button type="submit" className="primary-button" disabled={pending}>
              {pending ? "저장 중" : "저장"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={pending}
              onClick={onClose}
            >
              취소
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  function patch(next: Partial<MemberFormState>) {
    setState((current) => ({ ...current, ...next }));
  }
}

function initialState(
  member: MemberRecord | null,
  relations: RelationIndex
): MemberFormState {
  if (!member) {
    return {
      memberNumber: "",
      name: "",
      nickname: "",
      isAnchorMember: false,
      isFavorite: false,
      affiliationId: null,
      sponsorNameRaw: "",
      side: null,
      directParentId: null,
      directParentSide: null,
      birthDate: "",
      phone: "",
      countryCode: "",
      cpf: "",
      notes: "",
      status: "active"
    };
  }

  return {
    memberNumber: member.memberNumber,
    name: member.name,
    nickname: member.nickname,
    isAnchorMember: member.isAnchorMember,
    isFavorite: member.isFavorite,
    affiliationId:
      member.affiliationId ??
      relations.resolvedAffiliationById.get(member.id) ??
      null,
    sponsorNameRaw: member.sponsorNameRaw,
    side: member.side,
    directParentId: member.directParentId,
    directParentSide: member.directParentSide,
    birthDate: member.birthDate,
    phone: member.phone,
    countryCode: member.countryCode,
    cpf: member.cpf,
    notes: member.notes,
    status: member.status
  };
}

function validateForm(
  state: MemberFormState,
  member: MemberRecord | null,
  members: MemberRecord[]
): string {
  if (state.memberNumber && !/^\d+$/.test(state.memberNumber)) {
    return "회원번호는 숫자만 입력해주세요.";
  }
  if (state.nickname !== (member?.nickname ?? "") && !isValidNickname(state.nickname)) {
    return labels.validation.nickname;
  }
  if (state.birthDate && state.birthDate.length !== 8) {
    return "생년월일은 8자리 숫자로 입력해주세요.";
  }
  const duplicate = state.memberNumber
    ? members.find(
        (candidate) =>
          candidate.id !== member?.id &&
          candidate.memberNumber === state.memberNumber
      )
    : undefined;
  if (duplicate) return "같은 회원번호가 이미 있습니다.";
  if (state.affiliationId && state.affiliationId === member?.id) {
    return "자기 자신을 소속 회원으로 선택할 수 없습니다.";
  }
  if (state.directParentId && state.directParentId === member?.id) {
    return "자기 자신을 바로 위 회원으로 선택할 수 없습니다.";
  }
  return "";
}

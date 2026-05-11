import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { duplicateCollection } from "../../api/collections";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../Toast/ToastProvider";

/**
 * 컬렉션 상세 하단 — 공개 코스 리믹스(가져오기) CTA.
 *
 * - 비로그인: 가벼운 안내 토스트 후 무동작 (검색·지도·추천 파이프라인 영향 없음).
 * - 성공 시: 새 컬렉션은 기본 비공개로 생성되고 편집 페이지로 이동.
 * - 실패 시: 토스트로만 알리고 현재 페이지를 유지.
 *
 * @param {{
 *   sourceCollectionId: string,
 *   sourceTitle?: string | null,
 * }} props
 */
export default function CollectionDuplicateCtaButton({
  sourceCollectionId,
  sourceTitle,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    const cid = String(sourceCollectionId ?? "").trim();
    if (!cid || busy) return;

    if (!user?.id) {
      showToast(
        "로그인하면 이 코스를 내 스타일로 가져와 편집할 수 있어요.",
        "info",
        2800,
      );
      return;
    }

    setBusy(true);
    try {
      const baseTitle =
        typeof sourceTitle === "string" && sourceTitle.trim()
          ? `${sourceTitle.trim()} (복사)`
          : undefined;
      const { data, error } = await duplicateCollection(cid, {
        title: baseTitle,
      });
      if (error) {
        showToast(
          error?.message || "가져오기에 실패했어요. 잠시 후 다시 시도해 주세요.",
          "error",
          2800,
        );
        return;
      }
      if (!data?.id) {
        showToast("가져오기가 끝났지만 새 코스를 찾지 못했어요.", "error", 2800);
        return;
      }
      showToast(
        "내 코스로 가져왔어요. 순서·라벨·태그를 마음대로 바꿔 보세요!",
        "success",
        2800,
      );
      navigate(`/my-collections/${data.id}`);
    } catch (e) {
      showToast(e?.message || "가져오기 중 오류가 발생했어요.", "error", 2800);
    } finally {
      setBusy(false);
    }
  }, [sourceCollectionId, sourceTitle, busy, user?.id, showToast, navigate]);

  return (
    <section style={styles.wrap} aria-label="이 코스 가져오기">
      <div style={styles.head}>
        <div style={styles.headEmoji} aria-hidden="true">
          ✨
        </div>
        <div style={styles.headText}>
          <div style={styles.headTitle}>내 스타일로 가져오기</div>
          <div style={styles.headSub}>
            장소·순서·step 라벨·태그·커버까지 복사해 비공개 코스로 시작할 수 있어요.
            설명 상단에 원작자 한 줄을 남겨 둡니다.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        style={{
          ...styles.btn,
          ...(busy ? styles.btnBusy : null),
        }}
      >
        {busy ? "가져오는 중…" : "이 코스 가져오기"}
      </button>
    </section>
  );
}

const styles = {
  wrap: {
    width: "100%",
    margin: "16px 0 8px",
    padding: "14px 16px",
    borderRadius: 16,
    background:
      "linear-gradient(160deg, rgba(46,204,113,0.16), rgba(52,152,219,0.12))",
    border: "1px solid rgba(46,204,113,0.4)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  head: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  headEmoji: {
    fontSize: 18,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 2,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  headTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.3,
  },
  headSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },
  btn: {
    border: "1px solid rgba(46,204,113,0.55)",
    background:
      "linear-gradient(145deg, rgba(46,204,113,0.95), rgba(39,174,96,0.95))",
    color: "#0c1410",
    padding: "11px 14px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    minHeight: 44,
  },
  btnBusy: {
    opacity: 0.6,
    cursor: "default",
  },
};

import { useCallback, useMemo, useState } from "react";
import { updateCollection } from "../../api/collections";
import { useToast } from "../Toast/ToastProvider";
import CollectionPerformanceCard from "./CollectionPerformanceCard";

const MIN_PLACES_FOR_CTA = 3;
const MIN_PLACES_FOR_PUBLISH = 3;
const MIN_STEP_LABELS_FOR_PUBLISH = 1;

/**
 * 컬렉션 편집 페이지의 공개 유도 패널.
 *
 * - private: 기본 조건(제목 + 장소 ≥3) 충족 시 “공개해볼까요?” CTA 노출.
 *   체크리스트 3개(title / 장소≥3 / step_label≥1) 모두 통과하면 공개 버튼 활성화.
 * - public: 공개 상태 + 링크 복사 CTA 노출(공유 버튼 강조).
 *
 * 검색·지도·추천 파이프라인과 무관하게 본인 행만 만지는 단일 책임 컴포넌트.
 *
 * @param {{
 *   collection: {
 *     id: string,
 *     title?: string | null,
 *     visibility?: 'public' | 'private',
 *     collection_places?: Array<{ step_label?: string | null }>,
 *   },
 *   onChanged?: () => Promise<void> | void,
 * }} props
 */
export default function CollectionPublishPanel({ collection, onChanged }) {
  const { showToast } = useToast();
  const [busyPublish, setBusyPublish] = useState(false);
  const [busyCopy, setBusyCopy] = useState(false);

  const id = String(collection?.id ?? "").trim();
  const visibility = collection?.visibility === "public" ? "public" : "private";
  const isPublic = visibility === "public";

  const checklist = useMemo(() => {
    const title =
      typeof collection?.title === "string" ? collection.title.trim() : "";
    const places = Array.isArray(collection?.collection_places)
      ? collection.collection_places
      : [];
    const stepLabels = new Set();
    for (const p of places) {
      const lbl =
        typeof p?.step_label === "string" ? p.step_label.trim() : "";
      if (lbl) stepLabels.add(lbl.toLowerCase());
    }
    return {
      hasTitle: title.length > 0,
      placeCount: places.length,
      stepLabelCount: stepLabels.size,
    };
  }, [collection]);

  const titleOk = checklist.hasTitle;
  const placeOk = checklist.placeCount >= MIN_PLACES_FOR_PUBLISH;
  const stepOk = checklist.stepLabelCount >= MIN_STEP_LABELS_FOR_PUBLISH;
  const canPublish = titleOk && placeOk && stepOk;

  const ctaVisible =
    !isPublic &&
    titleOk &&
    checklist.placeCount >= MIN_PLACES_FOR_CTA;

  const publicUrl = useMemo(() => {
    if (!id) return "";
    if (typeof window === "undefined" || !window.location?.origin) {
      return `/collection/${id}`;
    }
    return `${window.location.origin}/collection/${id}`;
  }, [id]);

  const onPublish = useCallback(async () => {
    if (!id || busyPublish || !canPublish) return;
    setBusyPublish(true);
    try {
      const { data, error } = await updateCollection(id, {
        visibility: "public",
      });
      if (error) {
        showToast(
          error.message || "공개 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
          "error",
          2800,
        );
        return;
      }
      if (!data) {
        showToast("공개 권한을 확인할 수 없어요.", "error", 2800);
        return;
      }
      showToast(
        "이제 다른 사람들도 이 코스를 볼 수 있어요.",
        "success",
        2800,
      );
      if (typeof onChanged === "function") {
        try {
          await onChanged();
        } catch (e) {
          if (import.meta?.env?.DEV) {
            console.warn("CollectionPublishPanel onChanged:", e?.message || e);
          }
        }
      }
    } catch (e) {
      showToast(e?.message || "공개 처리 중 오류가 발생했어요.", "error", 2800);
    } finally {
      setBusyPublish(false);
    }
  }, [id, busyPublish, canPublish, showToast, onChanged]);

  const onCopyLink = useCallback(async () => {
    if (!publicUrl || busyCopy) return;
    setBusyCopy(true);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(publicUrl);
        showToast("공개 링크를 복사했어요.", "success", 2400);
        return;
      }
      showToast("이 환경에서는 링크 복사를 지원하지 않습니다.", "error", 2800);
    } catch (e) {
      showToast(e?.message || "링크를 복사하지 못했어요.", "error", 2800);
    } finally {
      setBusyCopy(false);
    }
  }, [publicUrl, busyCopy, showToast]);

  if (isPublic) {
    return (
      <section style={styles.publicWrap} aria-label="공개 코스 공유">
        <div style={styles.publicHead}>
          <span style={styles.publicBadge} aria-hidden="true">
            ● 공개
          </span>
          <div style={styles.publicTitle}>
            누구나 이 코스를 볼 수 있어요. 코스 링크를 친구에게 보내보세요.
          </div>
        </div>
        <div style={styles.publicActions}>
          <button
            type="button"
            onClick={() => void onCopyLink()}
            disabled={busyCopy || !publicUrl}
            style={{
              ...styles.copyBtn,
              ...(busyCopy ? styles.btnBusy : null),
            }}
          >
            {busyCopy ? "복사 중…" : "공유 링크 복사"}
          </button>
          <a
            href={publicUrl || `/collection/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.openBtn}
          >
            공개 페이지 열기 ↗
          </a>
        </div>

        <CollectionPerformanceCard collectionId={id} />
      </section>
    );
  }

  if (!ctaVisible) return null;

  return (
    <section style={styles.privateWrap} aria-label="공개 유도">
      <div style={styles.privateHead}>
        <div style={styles.privateEmoji} aria-hidden="true">
          🚀
        </div>
        <div style={styles.privateTitleBox}>
          <div style={styles.privateTitle}>이 코스를 공개해볼까요?</div>
          <div style={styles.privateSub}>
            아래 항목을 마치면 다른 사람들 피드와 추천 카드에 노출돼요.
          </div>
        </div>
      </div>

      <ul style={styles.checklist}>
        <ChecklistItem
          ok={titleOk}
          label="제목이 있어요"
          detail={titleOk ? null : "위 ‘제목’ 입력란을 채워주세요."}
        />
        <ChecklistItem
          ok={placeOk}
          label={`장소가 ${MIN_PLACES_FOR_PUBLISH}개 이상이에요`}
          detail={
            placeOk
              ? `현재 ${checklist.placeCount}개`
              : `현재 ${checklist.placeCount}개 — 1차·2차·3차로 묶어보세요.`
          }
        />
        <ChecklistItem
          ok={stepOk}
          label="step 라벨이 1개 이상이에요"
          detail={
            stepOk
              ? `현재 라벨 ${checklist.stepLabelCount}종`
              : "각 장소에 ‘1차 야장’, ‘2차 와인바’ 같은 흐름 라벨을 달아보세요."
          }
        />
      </ul>

      <button
        type="button"
        onClick={() => void onPublish()}
        disabled={!canPublish || busyPublish}
        style={{
          ...styles.publishBtn,
          ...(canPublish ? null : styles.publishBtnDisabled),
          ...(busyPublish ? styles.btnBusy : null),
        }}
      >
        {busyPublish
          ? "공개하는 중…"
          : canPublish
            ? "지금 공개"
            : "체크리스트를 마치면 공개할 수 있어요"}
      </button>
    </section>
  );
}

function ChecklistItem({ ok, label, detail }) {
  return (
    <li
      style={{
        ...styles.checkItem,
        ...(ok ? styles.checkItemOk : styles.checkItemPending),
      }}
    >
      <span style={styles.checkIcon} aria-hidden="true">
        {ok ? "✓" : "○"}
      </span>
      <div style={styles.checkBody}>
        <div style={styles.checkLabel}>{label}</div>
        {detail ? <div style={styles.checkDetail}>{detail}</div> : null}
      </div>
    </li>
  );
}

const styles = {
  privateWrap: {
    margin: "0 0 16px",
    padding: "14px 16px 16px",
    borderRadius: 14,
    background:
      "linear-gradient(160deg, rgba(46,204,113,0.16), rgba(52,152,219,0.12))",
    border: "1px solid rgba(46,204,113,0.42)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  privateHead: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  privateEmoji: {
    fontSize: 22,
    flexShrink: 0,
    lineHeight: 1,
    marginTop: 2,
  },
  privateTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  privateTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#fff",
    lineHeight: 1.3,
  },
  privateSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.74)",
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },
  checklist: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  checkItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid transparent",
  },
  checkItemOk: {
    background: "rgba(46,204,113,0.1)",
    border: "1px solid rgba(46,204,113,0.35)",
  },
  checkItemPending: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  checkIcon: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    color: "#fff",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.18)",
    lineHeight: 1,
    marginTop: 1,
  },
  checkBody: {
    flex: 1,
    minWidth: 0,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.35,
  },
  checkDetail: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },
  publishBtn: {
    border: "1px solid rgba(46,204,113,0.55)",
    background:
      "linear-gradient(145deg, rgba(46,204,113,0.95), rgba(39,174,96,0.95))",
    color: "#0c1410",
    padding: "12px 14px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    minHeight: 44,
  },
  publishBtnDisabled: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.55)",
    cursor: "default",
  },
  btnBusy: {
    opacity: 0.6,
    cursor: "default",
  },
  publicWrap: {
    margin: "0 0 16px",
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(46,204,113,0.12)",
    border: "1px solid rgba(46,204,113,0.45)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  publicHead: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  publicBadge: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 900,
    color: "#0c1410",
    background:
      "linear-gradient(145deg, rgba(46,204,113,0.95), rgba(39,174,96,0.95))",
    border: "1px solid rgba(46,204,113,0.7)",
    borderRadius: 999,
    padding: "3px 10px",
    letterSpacing: "0.04em",
  },
  publicTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    lineHeight: 1.4,
    wordBreak: "keep-all",
  },
  publicActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  copyBtn: {
    border: "1px solid rgba(46,204,113,0.6)",
    background:
      "linear-gradient(145deg, rgba(46,204,113,0.95), rgba(39,174,96,0.95))",
    color: "#0c1410",
    padding: "10px 16px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    minHeight: 40,
  },
  openBtn: {
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(255,255,255,0.88)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: "10px 14px",
    textDecoration: "none",
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

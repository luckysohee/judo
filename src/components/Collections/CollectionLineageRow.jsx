import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchCollectionRemixCount,
  fetchCollectionRemixSource,
} from "../../api/collections";

/**
 * 컬렉션 상세 — 리믹스 lineage(계보) 표시.
 *
 *  - 부모 라벨: `remixed_from_collection_id` 가 있으면
 *    "OO님의 코스를 바탕으로 만들어졌어요" 링크.
 *  - 자식 카운트: 이 컬렉션을 부모로 갖는 자식 수가 있으면
 *    "이 코스를 바탕으로 만들어진 코스 N개" lightweight 표시.
 *
 * 모든 가시성 판정은 RLS 가 담당하므로 비공개 부모는 자동으로 가려진다(=링크 미노출).
 * 추천/정렬 score 와는 분리 — UI 라벨용 fetch 만 수행.
 *
 * @param {{
 *   collectionId: string,
 *   remixedFromCollectionId?: string | null,
 * }} props
 */
export default function CollectionLineageRow({
  collectionId,
  remixedFromCollectionId,
}) {
  const [source, setSource] = useState(null);
  const [remixCount, setRemixCount] = useState(0);

  const cid = String(collectionId ?? "").trim();
  const hasParent =
    typeof remixedFromCollectionId === "string" &&
    remixedFromCollectionId.trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cid || !hasParent) {
        if (!cancelled) setSource(null);
        return;
      }
      try {
        const row = await fetchCollectionRemixSource(cid);
        if (!cancelled) setSource(row);
      } catch {
        if (!cancelled) setSource(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, hasParent]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cid) {
        if (!cancelled) setRemixCount(0);
        return;
      }
      try {
        const n = await fetchCollectionRemixCount(cid);
        if (!cancelled) setRemixCount(Number.isFinite(n) ? n : 0);
      } catch {
        if (!cancelled) setRemixCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid]);

  const showSource = hasParent && source != null;
  const showCount = remixCount > 0;
  if (!showSource && !showCount) return null;

  return (
    <div style={styles.wrap} aria-label="리믹스 lineage">
      {showSource ? (
        <Link
          to={`/collection/${source.id}`}
          style={styles.sourceLink}
          aria-label="원본 컬렉션으로 이동"
        >
          <span aria-hidden="true" style={styles.sourceIcon}>
            ↺
          </span>
          <span style={styles.sourceText}>
            {source.creator_label
              ? `${source.creator_label}님의 코스를 바탕으로 만들어졌어요`
              : "이 코스는 다른 코스를 바탕으로 만들어졌어요"}
          </span>
          {source.title ? (
            <span style={styles.sourceTitle} title={source.title}>
              {source.title}
            </span>
          ) : null}
        </Link>
      ) : null}
      {showCount ? (
        <div style={styles.countChip} aria-live="polite">
          <span aria-hidden="true" style={styles.countIcon}>
            🌱
          </span>
          <span>
            이 코스를 바탕으로 만들어진 코스 {remixCount}개
          </span>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    margin: "-4px 0 12px",
  },
  sourceLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#d6d6d6",
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    lineHeight: 1.35,
    flexWrap: "wrap",
  },
  sourceIcon: {
    fontSize: 13,
    color: "#9ad3a4",
  },
  sourceText: {
    color: "#d6d6d6",
  },
  sourceTitle: {
    color: "#9ad3a4",
    fontWeight: 800,
    maxWidth: 220,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  countChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(46,204,113,0.10)",
    border: "1px solid rgba(46,204,113,0.32)",
    color: "#cfeeda",
    fontSize: 12,
    fontWeight: 700,
  },
  countIcon: {
    fontSize: 12,
  },
};

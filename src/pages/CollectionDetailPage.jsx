import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  COLLECTION_INTERACTION_EVENT,
  COLLECTION_INTERACTION_SOURCE_SECTION,
  logCollectionInteraction,
} from "../api/collectionInteractionLogs";
import { fetchCollectionDetail } from "../api/collections";
import { dedupeAndNormalizeCollectionTags } from "../utils/collectionTags";
import CollectionCoverMedia from "../components/Collections/CollectionCoverMedia";
import CollectionCourseMap from "../components/Collections/CollectionCourseMap";
import CollectionDuplicateCtaButton from "../components/Collections/CollectionDuplicateCtaButton";
import CollectionLineageRow from "../components/Collections/CollectionLineageRow";
import CollectionRecommendationsSection from "../components/Collections/CollectionRecommendationsSection";
import CollectionRemixChildrenSection from "../components/Collections/CollectionRemixChildrenSection";
import CollectionSocialRow from "../components/Collections/CollectionSocialRow";
import { useToast } from "../components/Toast/ToastProvider";
import { useAuth } from "../context/AuthContext";
import {
  formatWalkingMinutes,
  walkingMinutesBetweenPlaces,
} from "../utils/walkingTime";

/**
 * 컬렉션 상세 — 제목/설명 + 코스 지도(번호 마커·Polyline) + 포함 장소 리스트(`order_index` 정렬).
 *
 * 비공개 컬렉션은 RLS 가 가리므로 본인 외에는 `null` 로 보이고 "찾을 수 없음" UI 가 노출된다.
 */
export default function CollectionDetailPage() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!collectionId) {
        if (!cancelled) {
          setCollection(null);
          setErrorMsg("");
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const row = await fetchCollectionDetail(collectionId);
        if (cancelled) return;
        setCollection(row);
      } catch (e) {
        if (cancelled) return;
        console.error("CollectionDetailPage load:", e);
        setErrorMsg(e?.message || "컬렉션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loading) {
    return (
      <div style={styles.page}>
        <BackButton onClick={() => navigate(-1)} />
        <div style={styles.helper}>불러오는 중…</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={styles.page}>
        <BackButton onClick={() => navigate(-1)} />
        <div style={{ ...styles.helper, color: "#e74c3c" }}>{errorMsg}</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div style={styles.page}>
        <BackButton onClick={() => navigate(-1)} />
        <div style={styles.helper}>해당 컬렉션을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const description =
    typeof collection.description === "string"
      ? collection.description.trim()
      : "";
  const places = Array.isArray(collection.collection_places)
    ? collection.collection_places
    : [];
  const displayTags = dedupeAndNormalizeCollectionTags(collection.tags);
  const showRemixCta =
    collection.visibility === "public" &&
    (!user?.id || collection.user_id !== user.id);

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <BackButton onClick={() => navigate(-1)} />
        <CollectionShareButton
          collectionId={collection.id}
          title={collection.title}
        />
      </div>

      <CollectionCoverMedia
        url={collection.cover_image_url}
        collectionId={collection.id}
        letter={(collection.title || "").trim().charAt(0) || "·"}
        imgLoading="eager"
        tags={collection.tags}
        stepLabels={collection.collection_places}
        wrapperStyle={styles.heroCover}
        letterTextStyle={styles.heroCoverLetter}
      />

      <header style={styles.header}>
        <h1 style={styles.title}>{collection.title || "(제목 없음)"}</h1>
        {typeof collection.vibe_caption === "string" &&
        collection.vibe_caption.trim() ? (
          <p style={styles.vibe}>{collection.vibe_caption.trim()}</p>
        ) : null}
        {description ? (
          <p style={styles.desc}>{description}</p>
        ) : null}
        <div style={styles.metaRow}>
          <span style={styles.countChip}>장소 {places.length}</span>
          <span style={styles.publicChip}>
            {collection.visibility === "public" ? "공개" : "비공개"}
          </span>
        </div>
        {displayTags.length > 0 ? (
          <div style={styles.tagRow} aria-label="컬렉션 태그">
            {displayTags.map((t) => (
              <span key={t.toLowerCase()} style={styles.tagChip}>
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <CollectionLineageRow
        collectionId={collection.id}
        remixedFromCollectionId={collection.remixed_from_collection_id}
      />

      <CollectionSocialRow collectionId={collection.id} />

      {places.length > 0 ? (
        <CollectionCourseMap collectionPlaces={places} />
      ) : null}

      <ol style={styles.list}>
        {places.length === 0 ? (
          <li style={styles.emptyItem}>이 컬렉션에 아직 장소가 없습니다.</li>
        ) : (
          places.map((row, idx) => {
            const next = places[idx + 1];
            return (
              <Fragment key={row.id}>
                <PlaceRow order={idx + 1} row={row} />
                {next ? <WalkingDivider from={row} to={next} /> : null}
              </Fragment>
            );
          })
        )}
      </ol>

      <CollectionRecommendationsSection collectionId={collection.id} />

      <CollectionRemixChildrenSection collectionId={collection.id} />

      {showRemixCta ? (
        <CollectionDuplicateCtaButton
          sourceCollectionId={collection.id}
          sourceTitle={collection.title}
        />
      ) : null}
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.backBtn}>
      ← 뒤로
    </button>
  );
}

/**
 * Web Share API 우선, 미지원·실패 시 클립보드로 공개 URL 복사.
 *
 * @param {{ collectionId: string, title?: string | null }} props
 */
function CollectionShareButton({ collectionId, title }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const onShare = useCallback(async () => {
    const id = String(collectionId ?? "").trim();
    if (!id || busy) return;

    const displayTitle =
      String(title ?? "").trim() || "컬렉션";
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    const url = origin ? `${origin}/collection/${id}` : `/collection/${id}`;
    const shareText = `「${displayTitle}」컬렉션 — 주도에서 코스를 확인해 보세요.\n${url}`;

    setBusy(true);
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({
            title: displayTitle,
            text: shareText,
            url,
          });
          logCollectionInteraction({
            eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_SHARE_SUCCESS,
            sourceSection:
              COLLECTION_INTERACTION_SOURCE_SECTION.COLLECTION_DETAIL_SHARE,
            collectionId: id,
          });
          return;
        } catch (err) {
          if (err?.name === "AbortError") return;
        }
      }

      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(url);
        showToast("컬렉션 링크를 복사했어요.", "success", 2800);
        logCollectionInteraction({
          eventType: COLLECTION_INTERACTION_EVENT.COLLECTION_SHARE_SUCCESS,
          sourceSection:
            COLLECTION_INTERACTION_SOURCE_SECTION.COLLECTION_DETAIL_SHARE,
          collectionId: id,
        });
        return;
      }

      showToast("이 환경에서는 공유를 지원하지 않습니다.", "error", 2800);
    } catch (e) {
      console.warn("CollectionShareButton:", e);
      showToast(
        e?.message || "링크를 복사하지 못했습니다.",
        "error",
        2800,
      );
    } finally {
      setBusy(false);
    }
  }, [collectionId, title, busy, showToast]);

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      disabled={busy}
      style={{
        ...styles.shareBtn,
        ...(busy ? styles.shareBtnBusy : null),
      }}
      aria-label="컬렉션 공유 또는 링크 복사"
    >
      {busy ? "…" : "공유"}
    </button>
  );
}

function WalkingDivider({ from, to }) {
  const minutes = walkingMinutesBetweenPlaces(from?.places, to?.places);
  const label = formatWalkingMinutes(minutes);
  const computable = Boolean(label);
  return (
    <li style={styles.walkRow} aria-hidden="true">
      <span style={styles.walkConnector} />
      <span
        style={{
          ...styles.walkChip,
          ...(computable ? null : styles.walkChipMissing),
        }}
      >
        {computable ? label : "도보시간 계산 불가"}
      </span>
      <span style={styles.walkConnector} />
    </li>
  );
}

function PlaceRow({ order, row }) {
  const place = row?.places || {};
  const memo = typeof row?.memo === "string" ? row.memo.trim() : "";
  const stepLabel =
    typeof row?.step_label === "string" ? row.step_label.trim() : "";
  const name =
    String(place.name || place.display_name || "이름 없음").trim() || "이름 없음";
  const address = String(place.address || place.road_address_name || "").trim();
  const image = String(place.image_url || place.thumbnail_url || "").trim();
  const placeId = String(place.id || "").trim();

  return (
    <li style={styles.row}>
      <div style={styles.rowOrderWrap}>
        <div style={styles.rowOrder}>{order}</div>
        {stepLabel ? (
          <div style={styles.rowStepLabel} title={stepLabel}>
            {stepLabel}
          </div>
        ) : null}
      </div>
      <div style={styles.rowThumb} aria-hidden="true">
        {image ? (
          <img
            src={image}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span style={styles.rowThumbInitial}>{name.charAt(0) || "·"}</span>
        )}
      </div>
      <div style={styles.rowBody}>
        {placeId ? (
          <a href={`/place/${placeId}`} style={styles.rowTitleLink}>
            {name}
          </a>
        ) : (
          <span style={styles.rowTitle}>{name}</span>
        )}
        {address ? <div style={styles.rowAddr}>{address}</div> : null}
        {memo ? <div style={styles.rowMemo}>“{memo}”</div> : null}
      </div>
    </li>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#111",
    color: "#eee",
    padding: 20,
    paddingBottom: 40,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  heroCover: {
    width: "100%",
    maxWidth: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 12,
    border: "1px solid #262626",
    marginBottom: 18,
    boxSizing: "border-box",
  },
  heroCoverLetter: {
    fontSize: 40,
    fontWeight: 800,
    color: "rgba(255,255,255,0.88)",
    letterSpacing: "-0.03em",
  },
  backBtn: {
    border: "1px solid #444",
    background: "#1a1a1a",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 700,
    minHeight: 44,
    cursor: "pointer",
  },
  shareBtn: {
    border: "1px solid rgba(46,204,113,0.45)",
    background: "rgba(46,204,113,0.14)",
    color: "#9ad3a4",
    padding: "10px 18px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 14,
    minHeight: 44,
    minWidth: 72,
    cursor: "pointer",
    flexShrink: 0,
    transition: "opacity 0.15s ease",
  },
  shareBtnBusy: {
    opacity: 0.55,
    cursor: "default",
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: "0 0 8px",
    color: "#fff",
    lineHeight: 1.25,
  },
  vibe: {
    margin: "0 0 10px",
    color: "#9ad3a4",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.45,
    letterSpacing: "-0.01em",
    fontStyle: "italic",
  },
  desc: {
    margin: "0 0 10px",
    color: "#bdbdbd",
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  countChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.4)",
    borderRadius: 999,
    padding: "3px 10px",
  },
  publicChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "#bdbdbd",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: "3px 10px",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    fontSize: 12,
    fontWeight: 800,
    color: "#d4f4dd",
    background: "rgba(46,204,113,0.14)",
    border: "1px solid rgba(46,204,113,0.42)",
    borderRadius: 999,
    padding: "3px 10px",
    letterSpacing: "-0.01em",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
    background: "#1a1a1a",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 12,
  },
  rowOrderWrap: {
    flexShrink: 0,
    width: 44,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  rowOrder: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "rgba(46,204,113,0.18)",
    border: "1px solid rgba(46,204,113,0.4)",
    color: "#2ecc71",
    fontWeight: 800,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rowStepLabel: {
    maxWidth: 60,
    fontSize: 10,
    fontWeight: 800,
    color: "#9ad3a4",
    background: "rgba(46,204,113,0.12)",
    border: "1px solid rgba(46,204,113,0.45)",
    borderRadius: 6,
    padding: "1px 6px",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.3,
  },
  rowThumb: {
    flexShrink: 0,
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, rgba(46,204,113,0.3), rgba(52,152,219,0.3))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  rowThumbInitial: {
    fontSize: 20,
    fontWeight: 800,
    color: "rgba(255,255,255,0.85)",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
  },
  rowTitleLink: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    textDecoration: "none",
  },
  rowAddr: {
    fontSize: 12,
    color: "#bdbdbd",
  },
  rowMemo: {
    fontSize: 12,
    color: "#9ad3a4",
    fontStyle: "italic",
    marginTop: 2,
  },
  emptyItem: {
    background: "#1a1a1a",
    border: "1px dashed #333",
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
    color: "#888",
  },
  walkRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 28px",
    margin: "-2px 0",
    listStyle: "none",
  },
  walkConnector: {
    flex: 1,
    height: 1,
    background:
      "linear-gradient(90deg, rgba(46,204,113,0.05), rgba(46,204,113,0.45), rgba(46,204,113,0.05))",
  },
  walkChip: {
    fontSize: 11,
    fontWeight: 700,
    color: "#9ad3a4",
    background: "rgba(46,204,113,0.12)",
    border: "1px solid rgba(46,204,113,0.4)",
    borderRadius: 999,
    padding: "3px 10px",
    whiteSpace: "nowrap",
  },
  walkChipMissing: {
    color: "#bdbdbd",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  helper: {
    color: "#bdbdbd",
    padding: "20px 0",
    textAlign: "center",
  },
};

import React from "react";

/**
 * 한 줄 TOP · 내 스타일 분석 · 팔로워 행동 카드 묶음.
 *
 * @param {{ archiveExtInsights: object, archiveInsightsError: string }} props
 */
export default function StudioArchiveInsightsSection({
  archiveExtInsights,
  archiveInsightsError,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        marginBottom: "20px",
      }}
      role="region"
      aria-label="잔 아카이브 인사이트"
    >
      <div
        style={{
          backgroundColor: "#2a2a2a",
          borderRadius: "10px",
          padding: "14px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "4px",
          }}
        >
          💬 한 줄 TOP
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "11px",
            marginBottom: "10px",
            lineHeight: 1.35,
          }}
        >
          한 줄평을 적어 둔 장소마다 저장 수를 세고, 그중 반응이 많은 순(상위 5곳)
        </div>
        {archiveExtInsights.oneLineTop.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
            아직 한 줄이 없거나, 저장이 0건이에요.
          </div>
        ) : (
          <ol
            style={{
              margin: 0,
              paddingLeft: "18px",
              color: "#eee",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            {archiveExtInsights.oneLineTop.map((row, idx) => (
              <li
                key={
                  row.placeId
                    ? `${row.placeId}`
                    : `${idx}-${row.text.slice(0, 24)}`
                }
                style={{ marginBottom: "6px" }}
              >
                {row.placeName ? (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.45)",
                      marginBottom: "2px",
                      wordBreak: "break-word",
                    }}
                  >
                    {row.placeName}
                  </div>
                ) : null}
                <span style={{ fontWeight: 600 }}>“{row.text}”</span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    marginLeft: "6px",
                  }}
                >
                  → 저장 {row.saves}건
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div
        style={{
          backgroundColor: "#2a2a2a",
          borderRadius: "10px",
          padding: "14px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "4px",
          }}
        >
          🎨 내 스타일 분석
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "11px",
            marginBottom: "12px",
            lineHeight: 1.35,
          }}
        >
          잔에 적은 값과 장소 마스터에 저장된 태그·주종·분위기·업종을 합쳐 비율을
          계산합니다
        </div>
        {archiveInsightsError ? (
          <div
            role="alert"
            style={{
              color: "#e59866",
              fontSize: "11px",
              marginBottom: "12px",
              lineHeight: 1.45,
              padding: "8px 10px",
              borderRadius: "8px",
              backgroundColor: "rgba(231, 76, 60, 0.12)",
              border: "1px solid rgba(231, 76, 60, 0.25)",
            }}
          >
            통계를 불러오지 못했습니다: {archiveInsightsError}
          </div>
        ) : null}
        {(() => {
          const blocks = [
            {
              title: "주종",
              key: "alcohol",
              rows: archiveExtInsights.style.alcohol,
            },
            {
              title: "분위기",
              key: "moods",
              rows: archiveExtInsights.style.moods,
            },
            {
              title: "태그",
              key: "tags",
              rows: archiveExtInsights.style.tags,
            },
            {
              title: "업종",
              key: "categories",
              rows: archiveExtInsights.style.categories,
            },
          ];
          const any = blocks.some((b) => b.rows.length > 0);
          if (!any) {
            return (
              <div
                style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}
              >
                잔 올리기에서 주종·분위기·태그·카테고리를 넣으면 비율이 잡혀요.
              </div>
            );
          }
          return blocks.map((b) =>
            b.rows.length === 0 ? null : (
              <div key={b.key} style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: "11px",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  {b.title}
                </div>
                {b.rows.map((r) => (
                  <div
                    key={`${b.key}-${r.label}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "5px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        flex: "0 0 38%",
                        fontSize: "11px",
                        color: "#ddd",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.label}
                    >
                      {r.label}
                    </span>
                    <div
                      style={{
                        flex: "1 1 auto",
                        height: "6px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(255,255,255,0.12)",
                        overflow: "hidden",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: `${r.pct}%`,
                          height: "100%",
                          borderRadius: "4px",
                          backgroundColor: "#F39C12",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        flex: "0 0 32px",
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.65)",
                        textAlign: "right",
                      }}
                    >
                      {r.pct}%
                    </span>
                  </div>
                ))}
              </div>
            ),
          );
        })()}
      </div>

      <div
        style={{
          backgroundColor: "#2a2a2a",
          borderRadius: "10px",
          padding: "14px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "4px",
          }}
        >
          🤝 팔로워 행동
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "11px",
            marginBottom: "10px",
            lineHeight: 1.35,
          }}
        >
          picked 가 내 픽에 남긴 저장 · 그 저장이 몰린 지역 · 내 픽 장소 한잔
          누적(전체 사용자)
        </div>
        <div style={{ color: "#eee", fontSize: "12px", marginBottom: "8px" }}>
          <span style={{ fontWeight: 700 }}>
            {archiveExtInsights.followers.savesOnPicks}
          </span>
          <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: "4px" }}>
            건 저장
          </span>
          <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 6px" }}>
            ·
          </span>
          <span style={{ fontWeight: 700 }}>
            {archiveExtInsights.followers.distinctSavers}
          </span>
          <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: "4px" }}>
            명이 참여
          </span>
        </div>
        <div style={{ color: "#eee", fontSize: "12px", marginBottom: "10px" }}>
          <span style={{ fontWeight: 700 }}>
            {archiveExtInsights.followers.checkinsTotal}
          </span>
          <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: "4px" }}>
            한잔 누적 (내 픽 장소)
          </span>
        </div>
        {archiveExtInsights.followers.regions.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
            팔로워 저장이 생기면 주소 앞부분 기준으로 지역이 모여요.
          </div>
        ) : (
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              color: "#eee",
              fontSize: "12px",
              lineHeight: 1.45,
            }}
          >
            {archiveExtInsights.followers.regions.map((r) => (
              <li key={r.label}>
                {r.label}{" "}
                <span style={{ color: "rgba(255,255,255,0.5)" }}>
                  (+{r.saves} 저장)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

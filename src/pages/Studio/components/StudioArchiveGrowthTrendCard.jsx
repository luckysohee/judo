import React from "react";
import { growthTrendLineYPercent } from "../studioHomeModule.js";

/**
 * 지난주 대비 성장 추이 미니차트 3열 + 이번 주 최고 반응 잔 한 줄.
 *
 * @param {{ curatorStats: object }} props
 */
export default function StudioArchiveGrowthTrendCard({ curatorStats }) {
  return (
    <div
      style={{
        backgroundColor: "#34495E",
        padding: "20px",
        borderRadius: "12px",
        marginBottom: "30px",
        border: "1px solid #2C3E50",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: "14px",
          fontWeight: "bold",
          marginBottom: "15px",
        }}
      >
        📈 성장 추이 (지난주 대비)
      </div>

      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "15px",
          marginBottom: "15px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "15px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span>지난주</span>
          <span>이번주</span>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          {(() => {
            const nPlw = curatorStats.lastWeekStats?.newPlaces || 0;
            const nPtw = curatorStats.weeklyStats?.newPlaces || 0;
            const placesScale = Math.max(8, nPlw, nPtw);
            return (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "white",
                    fontSize: "11px",
                    marginBottom: "6px",
                    textAlign: "center",
                  }}
                >
                  잔 기록
                </div>
                <div style={{ overflow: "hidden", paddingTop: "24px" }}>
                  <div
                    style={{
                      position: "relative",
                      height: "80px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      overflow: "hidden",
                    }}
                  >
                    <svg
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 1,
                        overflow: "hidden",
                      }}
                    >
                      <line
                        x1="20%"
                        y1={`${growthTrendLineYPercent(nPlw, placesScale)}%`}
                        x2="80%"
                        y2={`${growthTrendLineYPercent(nPtw, placesScale)}%`}
                        stroke="#E74C3C"
                        strokeWidth="2"
                        strokeDasharray="300"
                        strokeDashoffset="300"
                        style={{
                          animation: "lineDraw 1s ease-out 0.1s forwards",
                        }}
                      />
                    </svg>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: "rgba(231, 76, 60, 0.5)",
                        borderRadius: "50%",
                        border: "2px solid #E74C3C",
                        position: "relative",
                        zIndex: 2,
                        bottom: `${(nPlw / placesScale) * 52}px`,
                        animation: "bounce 0.6s ease-out",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          bottom: "20px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.8)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {nPlw}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: "#E74C3C",
                        borderRadius: "50%",
                        border: "3px solid rgba(255,255,255,0.3)",
                        position: "relative",
                        zIndex: 2,
                        bottom: `${(nPtw / placesScale) * 52}px`,
                        boxShadow: "0 0 10px rgba(231, 76, 60, 0.5)",
                        animation: "bounce 0.6s ease-out 0.2s both",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          bottom: "20px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "10px",
                          color: "#E74C3C",
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          animation: "fadeInUp 0.4s ease-out 0.5s both",
                        }}
                      >
                        {nPtw > nPlw ? "▲" : nPtw < nPlw ? "▼" : "─"}
                        {nPtw}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          {(() => {
            const nSlw = curatorStats.lastWeekStats?.newSaves || 0;
            const nStw = curatorStats.weeklyStats?.newSaves || 0;
            const savesScale = Math.max(40, nSlw, nStw);
            return (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "white",
                    fontSize: "11px",
                    marginBottom: "6px",
                    textAlign: "center",
                  }}
                >
                  잔 반응
                </div>
                <div style={{ overflow: "hidden", paddingTop: "24px" }}>
                  <div
                    style={{
                      position: "relative",
                      height: "80px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      overflow: "hidden",
                    }}
                  >
                    <svg
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 1,
                        overflow: "hidden",
                      }}
                    >
                      <line
                        x1="20%"
                        y1={`${growthTrendLineYPercent(nSlw, savesScale)}%`}
                        x2="80%"
                        y2={`${growthTrendLineYPercent(nStw, savesScale)}%`}
                        stroke="#F39C12"
                        strokeWidth="2"
                        strokeDasharray="300"
                        strokeDashoffset="300"
                        style={{
                          animation: "lineDraw 1s ease-out 0.3s forwards",
                        }}
                      />
                    </svg>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: "rgba(243, 156, 18, 0.5)",
                        borderRadius: "50%",
                        border: "2px solid #F39C12",
                        position: "relative",
                        zIndex: 2,
                        bottom: `${(nSlw / savesScale) * 52}px`,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          bottom: "20px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.8)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {nSlw}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: "#F39C12",
                        borderRadius: "50%",
                        border: "3px solid rgba(255,255,255,0.3)",
                        position: "relative",
                        zIndex: 2,
                        bottom: `${(nStw / savesScale) * 52}px`,
                        boxShadow: "0 0 10px rgba(243, 156, 18, 0.5)",
                        animation: "bounce 0.6s ease-out 0.4s both",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          bottom: "20px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "10px",
                          color: "#F39C12",
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          animation: "fadeInUp 0.4s ease-out 0.7s both",
                        }}
                      >
                        {nStw > nSlw ? "▲" : nStw < nSlw ? "▼" : "─"}
                        {nStw}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          {(() => {
            const plw = curatorStats.lastWeekStats?.newFollowers || 0;
            const ptw = curatorStats.weeklyStats?.newFollowers || 0;
            const pickedScale = Math.max(5, plw, ptw);
            return (
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "white",
                    fontSize: "11px",
                    marginBottom: "6px",
                    textAlign: "center",
                  }}
                >
                  picked
                </div>
                <div style={{ overflow: "hidden", paddingTop: "24px" }}>
                  <div
                    style={{
                      position: "relative",
                      height: "80px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      overflow: "hidden",
                    }}
                  >
                    <svg
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 1,
                        overflow: "hidden",
                      }}
                    >
                      <line
                        x1="20%"
                        y1={`${growthTrendLineYPercent(plw, pickedScale)}%`}
                        x2="80%"
                        y2={`${growthTrendLineYPercent(ptw, pickedScale)}%`}
                        stroke="#9B59B6"
                        strokeWidth="2"
                        strokeDasharray="300"
                        strokeDashoffset="300"
                        style={{
                          animation: "lineDraw 1s ease-out 0.5s forwards",
                        }}
                      />
                    </svg>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: "rgba(155, 89, 182, 0.5)",
                        borderRadius: "50%",
                        border: "2px solid #9B59B6",
                        position: "relative",
                        zIndex: 2,
                        bottom: `${(plw / pickedScale) * 52}px`,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          bottom: "20px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.8)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {plw}
                      </div>
                    </div>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: "#9B59B6",
                        borderRadius: "50%",
                        border: "3px solid rgba(255,255,255,0.3)",
                        position: "relative",
                        zIndex: 2,
                        bottom: `${(ptw / pickedScale) * 52}px`,
                        boxShadow: "0 0 10px rgba(155, 89, 182, 0.5)",
                        animation: "bounce 0.6s ease-out 0.6s both",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          bottom: "20px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "10px",
                          color: "#9B59B6",
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          animation: "fadeInUp 0.4s ease-out 0.9s both",
                        }}
                      >
                        {ptw > plw ? "▲" : ptw < plw ? "▼" : "─"}
                        {ptw}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "white",
          fontWeight: "bold",
          paddingTop: "10px",
          borderTop: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        🔥 이번 주 최고 반응 잔
        <div
          style={{
            fontSize: "11px",
            fontWeight: "normal",
            marginTop: "3px",
            lineHeight: 1.35,
          }}
        >
          {curatorStats.weekTopReactingPlace ? (
            <>
              → {curatorStats.weekTopReactingPlace} (저장{" "}
              {curatorStats.weekTopReactingSaves})
            </>
          ) : (curatorStats.weeklyStats?.newSaves || 0) > 0 ? (
            <>→ 이번 주 저장 합계 {curatorStats.weeklyStats.newSaves}건</>
          ) : (
            <>→ 이번 주 추천 잔에 새 저장이 없어요</>
          )}
        </div>
      </div>
    </div>
  );
}

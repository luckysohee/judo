/**
 * 장소 미리보기 시트 하단의 네이버 블로그 리뷰 패널.
 * `blogReviews` 배열만 받아서 위 3건을 노출하고, 그 이상은 카운트만 표시한다.
 */
export default function HomeBlogReviewSection({ blogReviews }) {
  if (!Array.isArray(blogReviews) || blogReviews.length === 0) return null;
  const top3 = blogReviews.slice(0, 3);
  return (
    <div
      style={{
        marginTop: "12px",
        padding: "16px",
        backgroundColor: "#f8f9fa",
        borderRadius: "12px",
        borderTop: "1px solid #e9ecef",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#495057",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>📝</span>
        네이버 블로그 실제 리뷰 ({blogReviews.length}개)
      </div>
      <div
        style={{
          maxHeight: "200px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {top3.map((review, index) => (
          <div
            key={index}
            style={{
              padding: "8px",
              backgroundColor: "white",
              borderRadius: "8px",
              border: "1px solid #e9ecef",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "500",
                color: "#e74c3c",
                marginBottom: "4px",
              }}
            >
              {review.place_name}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#666",
                lineHeight: "1.4",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {review.content && review.content !== "내용 추출 실패"
                ? review.content.length > 100
                  ? review.content.substring(0, 100) + "..."
                  : review.content
                : "리뷰 내용을 불러오지 못했습니다."}
            </div>
            {review.publish_date && review.publish_date !== "작성일 없음" && (
              <div
                style={{
                  fontSize: "10px",
                  color: "#999",
                  marginTop: "4px",
                }}
              >
                {review.publish_date}
              </div>
            )}
          </div>
        ))}
      </div>
      {blogReviews.length > 3 && (
        <div
          style={{
            fontSize: "11px",
            color: "#999",
            textAlign: "center",
            marginTop: "8px",
          }}
        >
          외 {blogReviews.length - 3}개의 리뷰 더보기
        </div>
      )}
    </div>
  );
}

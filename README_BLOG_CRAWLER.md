# 네이버 블로그 리뷰 크롤러

장소 이름 + 후기 검색으로 네이버 블로그 리뷰와 태그를 수집하는 크롤러입니다.

## 설치 방법

### 1. 패키지 설치
```bash
pip install -r requirements.txt
```

### 2. Playwright 브라우저 설치
```bash
playwright install chromium
```

## 사용 방법

### 1. 크롤러 실행
```bash
python naver_blog_crawler_v2.py
```

### 2. 장소 이름 입력
```
🔍 검색할 장소 이름을 입력하세요: 만선호프
📄 최대 검색 페이지 수 (기본값: 2): 2
```

## 결과물

### 저장 위치
- 모든 결과 데이터는 `./results/` 폴더에 저장됩니다
- 파일명: `naver_blog_reviews_YYYYMMDD_HHMMSS.json`

### 결과 형식
```json
{
  "place_name": "만선호프",
  "title": "홍대 핫플 만선호프 안주 많은 술집 후기",
  "content": "블로그 본문 내용...",
  "publish_date": "2024.03.15",
  "blog_url": "https://blog.naver.com/...",
  "tags": ["#술집", "#맛집"],
  "collected_at": "2026-03-31 14:39:42"
}
```

## 파일 구조

```
project/
├── naver_blog_crawler_v2.py    # 메인 크롤러
├── requirements.txt            # 필요 패키지 목록
├── results/                   # 결과 저장 폴더
│   └── naver_blog_reviews_*.json
└── README_BLOG_CRAWLER.md     # 설명서
```

## 특징

- ✅ 실제 블로그 포스트만 수집 (클립/프로필 제외)
- ✅ Playwright로 동적 페이지 처리
- ✅ BeautifulSoup으로 HTML 파싱
- ✅ 중복 제거 및 필터링
- ✅ 자동 결과 저장
- ✅ 에러 처리 및 안정성 확보

## 주요 라이브러리

- `playwright`: 웹 브라우저 자동화
- `beautifulsoup4`: HTML 파싱
- `asyncio`: 비동기 처리
- `requests`: HTTP 요청
- `pandas`: 데이터 처리 (선택적)

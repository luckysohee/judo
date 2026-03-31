# 맥북용 네이버 블로그 크롤러 설정 가이드

## 🚀 맥북에서 실행하기

### 1. 환경 설정

```bash
# Python 환경 확인 (맥북은 보통 Python 3가 기본 설치됨)
python3 --version

# 필요한 라이브러리 설치
pip3 install playwright beautifulsoup4 asyncio lxml requests pandas numpy python-dateutil pytz

# Playwright 브라우저 설치
playwright install chromium
```

### 2. 독립 실행형 크롤러

#### 방법 1: 직접 실행
```bash
# 기본 실행
python3 naver_blog_crawler_standalone.py "을지로 술집 후기"

# 페이지 수 지정
python3 naver_blog_crawler_standalone.py "강남역 맛집 후기" 3
```

#### 방법 2: 대화형 실행
```bash
python3 naver_blog_crawler_standalone.py
# 🔍 검색할 장소 이름을 입력하세요: 을지로 술집
# 📄 최대 검색 페이지 수 (기본값: 2): 2
```

### 3. AI 서버 통합 버전

#### 서버 시작
```bash
# server_with_crawler.js 사용
cd server
npm install
node server_with_crawler.js
```

#### 프론트엔드 연결
```bash
# 다른 터미널에서
npm run dev
```

#### 테스트
```bash
# 크롤러 테스트
curl "http://localhost:4000/api/test-crawler?query=을지로"

# AI 검색 테스트
curl -X POST http://localhost:4000/api/ai-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "을지로 술집 후기",
    "places": []
  }'
```

## 📁 파일 구조

```
judo/
├── naver_blog_crawler_standalone.py    # 독립 실행형 크롤러
├── server_with_crawler.js              # 크롤러 통합 AI 서버
├── results/                            # 크롤링 결과 저장 폴더
├── requirements.txt                    # Python 라이브러리 목록
└── README_MACBOOK_SETUP.md             # 이 파일
```

## 🔧 맥북 최적화 사항

### 1. Python 버전
- **맥북**: `python3` 사용 (기본 설치됨)
- **Windows**: `python` 사용

### 2. 경로 처리
- **맥북**: Unix 경로 (`/Users/username/...`)
- **Windows**: Windows 경로 (`C:\Users\...`)

### 3. 권한 문제
- 맥북에서는 보통 권한 문제가 없음
- 필요시 `chmod +x naver_blog_crawler_standalone.py`

### 4. 네트워크 환경
- 맥북의 다른 IP 환경에서 더 안정적인 크롤링 가능
- 학원 컴보다 차단 가능성 낮음

## 🐛 문제 해결

### 1. Playwright 설치 오류
```bash
# 수동 설치
python3 -m playwright install chromium

# 또는
pip3 install --force-reinstall playwright
playwright install
```

### 2. 권한 오류
```bash
# 실행 권한 부여
chmod +x naver_blog_crawler_standalone.py
```

### 3. 포트 충돌
```bash
# 다른 포트 사용
PORT=3001 node server_with_crawler.js
```

## 📊 결과 확인

### 크롤링 결과
```bash
# results 폴더 확인
ls -la results/

# 최신 결과 확인
cat results/naver_blog_reviews_*.json | jq '.[] | {place_name, content}'
```

### AI 서버 로그
```bash
# 서버 로그 확인
node server_with_crawler.js
# 🚀 AI server with crawler running on http://localhost:4000
# 📝 크롤러 통합 버전 - 맥북 최적화
```

## 🎯 테스트 시나리오

### 1. 기본 크롤링 테스트
```bash
python3 naver_blog_crawler_standalone.py "을지로 술집 후기"
```

### 2. AI 통합 테스트
1. 서버 시작: `node server_with_crawler.js`
2. 프론트엔드 시작: `npm run dev`
3. 검색어 입력: "을지로 술집 후기"
4. 결과 확인: AI 추천 + 블로그 리뷰

### 3. 성능 테스트
- 응답 시간: 10-30초 (크롤링 포함)
- 리뷰 수집: 3-10개 리뷰
- 성공률: 60-80% (네이버 정책에 따라 다름)

## 📝 팁

1. **검색어 구체화**: "을지로 술집 후기" → "을지로 3가 술집 후기"
2. **시간대 선택**: 오전 9시-오후 6시가 성공률 높음
3. **결과 저장**: `results/` 폴더에 자동 저장됨
4. **오류 처리**: 일부 실패는 정상, 재시도하면 성공 가능성 높음

## 🎉 성공 확인

크롤러가 정상 작동하면 다음 로그가 보입니다:

```
🕷️  네이버 블로그 리뷰 크롤러 - 독립 실행 버전
==================================================
🚀 '을지로 술집 후기 후기' 검색 시작...
🔍 검색 시작: 을지로 술집 후기 후기
📄 1페이지 수집 중...
🔗 찾은 블로그 링크 수: 98
🔗 블로그 방문 (1/5): https://blog.naver.com/...
✅ 리뷰 수집 완료: 힙한 감성 제대로 느낀 을지로 술집
✅ 총 4개의 리뷰를 수집했습니다.
📁 결과 저장 완료: results/naver_blog_reviews_20260331_152840.json
🎉 크롤링 완료! 4개의 리뷰를 수집했습니다.
```

**맥북에서 테스트하시면 훨씬 좋은 결과를 얻으실 수 있습니다!** 🚀

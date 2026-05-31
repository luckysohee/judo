# 홈 검색 모드 (네이버 지도식)

포커스·검색 탭 시에만 **상단 검색 UI + 중간 히스토리/제안 + 하단 키보드(네이티브)** 로 전환한다. 평소에는 지도·하단 얇은 진입(현 `bottomBarContainer`) 유지.

## 화면 와이어 (모바일)

```
┌─────────────────────────────────────┐
│ ← │  [ 검색 입력………………… ]  │ 🔎/채널 │  ← sticky header (safe-area-top)
├─────────────────────────────────────┤
│ [최근검색] [장소] [문장]              │  ← chip row (horizontal scroll)
├─────────────────────────────────────┤
│                                     │
│  🕐 호계바베큐              05.26 × │  ← history / suggest list
│  📍 호계옥                  05.26 × │     (flex:1, overflow-y:auto)
│  🕐 이태원 와인바 데이트    05.19 × │
│                                     │
│  (타이핑 중 → 카카오 제안으로 교체)   │
│                                     │
├─────────────────────────────────────┤
│           [ iOS 키보드 ]            │  ← OS; 레이아웃은 100dvh - header
└─────────────────────────────────────┘

[뒤] 지도: dim rgba(0,0,0,0.45) + pointer-events:none (오버레이 뒤 레이어)
```

## 상태 머신

```
browse (기본)
  │ tap 검색바 / programmatic focus
  ▼
search_mode (HomeSearchOverlay open, map dimmed)
  │ ← 뒤로 / ESC / backdrop tap(선택) / submit 성공
  ▼
browse ──submit──► results (맞춤 추천 시트, overlay 닫힘)
```

| 상태 | 지도 | 하단 검색바 | 오버레이 | 핫스트립 |
|------|------|-------------|----------|----------|
| browse | interactive | 보임(접힌) | hidden | 보임 |
| search_mode | dim | hidden 또는 mirror | full screen panel | hidden |
| results | interactive | 보임 + 시트 | hidden | 숨김(기존 규칙) |

## 파일 맵

| 파일 | 역할 |
|------|------|
| `src/utils/homeSearchHistory.js` | 최근검색 read/write (localStorage 1차, DB 훅 2차) |
| `src/hooks/useHomeSearchMode.js` | open/close, popstate, body scroll lock |
| `src/components/Home/HomeSearchOverlay.jsx` | 검색 모드 UI 와이어/구현 |
| `src/components/Home/homeSearchOverlayStyles.js` | 오버레이 전용 스타일 |
| `src/pages/Home/Home.jsx` | wiring (후속 PR) |

## Home.jsx 연동 체크리스트 (구현 시)

1. `const searchMode = useHomeSearchMode({ onExit: ... })`
2. `SearchBar`에 `onFocus={() => searchMode.open()}` `readOnly={searchMode.isOpen}` 또는 하단 바를 `role="button"` 진입만.
3. `searchMode.isOpen && <HomeSearchOverlay ... />` + `createPortal` to `document.body` (z-index > map, < photo viewer).
4. `<div style={dimStyle} />` 형제 — `searchMode.isOpen && !selectedPlace`.
5. `handleSearchSubmit` 성공 직전 `recordHomeSearchHistory({ query, channel })` → `searchMode.close()`.
6. `popstate`: `searchMode` 훅이 처리; 열 때 `history.pushState({ judoSearchMode: 1 }, '')`.
7. 추천 시트 열림·`selectedPlace`·`mutualSearchPanelOpen` 시 `searchMode.close()` 강제.

## DB 2차 (로그인 동기화)

```sql
-- optional migration
create table if not exists user_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  kind text not null default 'place',
  channel text,
  meta jsonb,
  searched_at timestamptz not null default now(),
  unique (user_id, query)
);
create index user_search_history_user_searched_at
  on user_search_history (user_id, searched_at desc);
```

동기화: 로그인 시 `pullRemoteSearchHistory` → merge into localStorage → 이후 `record`가 local + `upsert` RPC.

## 칩 필터 (1차)

| chip id | 라벨 | 필터 |
|---------|------|------|
| `recent` | 최근검색 | 전체 (기본) |
| `place` | 장소 | `kind === 'place'` 또는 카카오 단건 픽 메타 |
| `sentence` | 문장 | `query` 길이 ≥ 8 또는 공백 포함 자연어 |

## 접근성

- 오버레이 `role="dialog"` `aria-modal="true"` `aria-label="장소 검색"`
- 뒤로 버튼 `aria-label="검색 닫기"`
- 히스토리 리스트 `role="listbox"`, 항목 `role="option"`

## z-index (참고)

| 레이어 | z |
|--------|---|
| map | ~1 |
| map dim | 140 |
| bottom search peek | 160 |
| hot strip | 360 |
| search overlay | 420 |
| recommend sheet | 320 (결과 모드; overlay와 동시 X) |
| photo viewer | 2147483000 |

# 에어컨 민주주의 — 브랜드 로고 소싱 작업 (LLM 위임용)

다른 LLM에게 통째로 던지세요. 자기 완결형 프롬프트입니다.

---

## 컨텍스트

서비스: **에어컨 민주주의** (https://aircondemocracy.com)
한국 공공장소(지하철·카페·강의실 등)의 에어컨 분위기를 익명 투표로 모으는 PWA.
장소 카드의 **42×42 px 원형/사각 슬롯**에 브랜드 로고가 들어갑니다.

소스 위치:
- 로고 파일: `public/brands/<slug>.<ext>`
- 등록 코드: `src/lib/brands.ts`

빌드/배포: Vite + Cloudflare Pages. `npm run build` 통과만 하면 됩니다.

---

## 해야 할 일

아래 브랜드의 **정사각 비율 엠블럼/심볼/씰 로고**를 찾아서 추가:

### 카페 (3)
| 한글 | slug | 영문 |
|---|---|---|
| 이디야커피 | `ediya` | Ediya Coffee |
| 컴포즈커피 | `compose` | Compose Coffee |
| 메가MGC커피 | `mega` | Mega MGC Coffee |

### 대학교 (2)
| 한글 | slug | 영문 |
|---|---|---|
| 연세대학교 | `yonsei` | Yonsei University |
| 고려대학교 | `ku` | Korea University |

---

## 절대 조건

- **정사각 비율 (1:1 또는 거의)** — 가로로 긴 워드마크는 안 됨. 엠블럼·심볼·씰 형태.
- 원본 비율과 색상 유지 (잘라내거나 색 바꾸지 말 것).
- 형식: SVG > PNG > WebP (선호순). 1MB 이하.
- 라이센스: nominative fair use (식별 목적). Naver 지도가 브랜드 로고 표시하는 것과 동일 컨텍스트.

---

## 검색 순서 (시도해보고 안 되면 다음으로)

1. **나무위키** (https://namu.wiki) — 페이지 상단 인포박스에 보통 정사각 로고
   - https://namu.wiki/w/이디야커피
   - https://namu.wiki/w/컴포즈커피
   - https://namu.wiki/w/메가MGC커피
   - https://namu.wiki/w/연세대학교
   - https://namu.wiki/w/고려대학교

2. **학교/브랜드 공식 CI 페이지**
   - 연세대 CI: https://www.yonsei.ac.kr/sc/intro/ci.jsp
   - 고려대 CI: https://www.korea.ac.kr/sites/ko/about/ci
   - 이디야 회사소개: https://ediya.com/contents/intro.html
   - 컴포즈커피 회사소개: https://composecoffee.com
   - 메가커피 공식: https://www.mega-mgccoffee.com

3. **Vector 모음 사이트**
   - https://worldvectorlogo.com/search
   - https://seeklogo.com
   - https://brandfetch.com

4. **Wikimedia Commons** (이미 시도 — 정사각 버전은 없었음, 워드마크만 있음)

---

## 파일 추가 절차

### 1. 파일 저장
다운받은 로고를 다음 경로로:
```
public/brands/ediya.svg     (또는 .png/.webp)
public/brands/compose.svg
public/brands/mega.svg
public/brands/yonsei.svg
public/brands/ku.svg
```

### 2. brands.ts에 등록

`src/lib/brands.ts`의 `BRANDS` 배열에 추가. 카페는 카페 그룹, 대학교는 대학교 그룹에 배치.

추가 형식 예시:
```ts
{ id: 'ediya',   iconUrl: '/brands/ediya.svg',   matches: (n) => includesAny(n, '이디야') || /ediya/i.test(n) },
{ id: 'compose', iconUrl: '/brands/compose.svg', matches: (n) => includesAny(n, '컴포즈') || /compose\s*coffee/i.test(n) },
{ id: 'mega',    iconUrl: '/brands/mega.svg',    matches: (n) => includesAny(n, '메가커피', '메가MGC', '메가 커피') || /mega\s*(mgc)?\s*coffee/i.test(n) },
{ id: 'yonsei',  iconUrl: '/brands/yonsei.svg',  matches: (n) => includesAny(n, '연세대학교', '연세대') || /yonsei/i.test(n) },
{ id: 'ku',      iconUrl: '/brands/ku.svg',      matches: (n) => includesAny(n, '고려대학교', '고려대') || /korea\s*university/i.test(n) },
```

### 3. 검수
```bash
npm install          # 한 번만
npm run build        # TS + Vite 빌드 통과 확인
npm run dev          # http://localhost:5173 — 장소 카드에 로고 떴는지 확인
```

---

## 현재 brands.ts (참고용 — 형식·구조 유지)

```ts
export interface Brand {
  id: string;
  iconUrl: string;
  matches: (placeName: string) => boolean;
}

const includesAny = (n: string, ...needles: string[]) => needles.some((k) => n.includes(k));

// All entries must be SQUARE assets (emblems/seals/symbols), not wordmarks.
export const BRANDS: Brand[] = [
  // ── Cafes ─────────────────────────────────────────────────────────
  { id: 'starbucks', iconUrl: '/brands/starbucks.svg', matches: (n) => includesAny(n, '스타벅스') || /starbucks/i.test(n) },
  { id: 'twosome',   iconUrl: '/brands/twosome.png',   matches: (n) => includesAny(n, '투썸') || /twosome/i.test(n) },
  { id: 'paik',      iconUrl: '/brands/paik.png',      matches: (n) => includesAny(n, '빽다방') || /paik('?s)?\s*(coffee|bread)?/i.test(n) },
  // ── Universities ──────────────────────────────────────────────────
  { id: 'snu',       iconUrl: '/brands/snu.png',       matches: (n) => includesAny(n, '서울대학교', '서울대') || /seoul\s*national\s*university/i.test(n) },
  { id: 'hanyang',   iconUrl: '/brands/hanyang.svg',   matches: (n) => includesAny(n, '한양대학교', '한양대') || /hanyang/i.test(n) },
  { id: 'kaist',     iconUrl: '/brands/kaist.svg',     matches: (n) => includesAny(n, '카이스트', 'KAIST') || /kaist/i.test(n) },
];

export function brandFor(placeName: string): Brand | null {
  return BRANDS.find((b) => b.matches(placeName)) ?? null;
}
```

---

## 보너스 (시간 남으면)

다음 브랜드도 같은 절차로 환영 (꼭 안 해도 됨):
- **카페**: 할리스 · 폴바셋 · 엔젤리너스 · 탐앤탐스 · 카페베네
- **대학교**: 성균관대 · 중앙대 · 경희대 · 한국외대 · 서울시립대 · 건국대 · 동국대 · 홍익대 · POSTECH · UNIST
- **회사 빌딩**: 네이버 · 카카오 · 삼성 · LG · 현대 · SK

---

## 완료 보고

작업 끝나면 알려주세요:
- 추가한 파일 목록
- 각 파일 출처 URL
- brands.ts diff
- 빌드 통과 여부

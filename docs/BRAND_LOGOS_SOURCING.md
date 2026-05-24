# 에어컨 민주주의 — 브랜드 로고 대규모 소싱 작업 (LLM 위임용)

다른 LLM에게 통째로 던지세요. 자기 완결형 프롬프트입니다.

---

## 컨텍스트

서비스: **에어컨 민주주의** (https://aircondemocracy.com)
한국 공공장소(지하철·카페·강의실 등)의 에어컨 분위기를 익명 투표로 모으는 PWA.
장소 카드의 **42×42 px 정사각 슬롯**에 브랜드 로고가 들어갑니다.

소스 위치:
- 로고 파일: `public/brands/<slug>.<ext>`
- 등록 코드: `src/lib/brands.ts`

빌드/배포: Vite + Cloudflare Pages. `npm run build` 통과만 하면 됩니다.

---

## 미션

아래 카테고리의 한국 브랜드 로고를 **정사각 비율 (1:1) 엠블럼/심볼**로 가능한 한 많이 수집해서 추가.
이미 추가된 것은 건너뛰고, **빠진 것 위주로 채우기**.

---

## 이미 추가된 브랜드 (스킵)

```
✅ starbucks, twosome, paik, ediya  (카페)
✅ snu, hanyang, kaist, yonsei, ku  (대학교)
```

---

## 목표 카테고리 + 브랜드 리스트

각 항목: `slug` · 한글명 · (선택) 영문명. **slug 그대로 파일명·코드ID로 씀.**

### A. 카페 프랜차이즈 (P0 — 최우선)
| Slug | 한글 | 영문 |
|---|---|---|
| `mega` | 메가MGC커피 | Mega MGC Coffee |
| `compose` | 컴포즈커피 | Compose Coffee |
| `hollys` | 할리스 | Hollys Coffee |
| `paulbassett` | 폴바셋 | Paul Bassett |
| `angelinus` | 엔젤리너스 | Angel-in-us |
| `tomntoms` | 탐앤탐스 | Tom N Toms |
| `cafebene` | 카페베네 | Cafe Bene |
| `theventi` | 더벤티 | The Venti |
| `mammoth` | 매머드커피 | Mammoth Coffee |
| `coffeebean` | 커피빈 | The Coffee Bean & Tea Leaf |
| `bluebottle` | 블루보틀 | Blue Bottle Coffee |
| `gongcha` | 공차 | Gong Cha |
| `dessert39` | 디저트39 | Dessert39 |
| `coffeebay` | 커피베이 | Coffeebay |
| `bbangsgu` | 빵스구 | Bbangsgu |

### B. 대학교 (P0 — 서울권 / 지방거점)
| Slug | 한글 | 영문 |
|---|---|---|
| `skku` | 성균관대학교 | Sungkyunkwan University |
| `cau` | 중앙대학교 | Chung-Ang University |
| `khu` | 경희대학교 | Kyung Hee University |
| `hufs` | 한국외국어대학교 | Hankuk University of Foreign Studies |
| `uos` | 서울시립대학교 | University of Seoul |
| `konkuk` | 건국대학교 | Konkuk University |
| `dongguk` | 동국대학교 | Dongguk University |
| `hongik` | 홍익대학교 | Hongik University |
| `sookmyung` | 숙명여자대학교 | Sookmyung Women's University |
| `ewha` | 이화여자대학교 | Ewha Womans University |
| `sogang` | 서강대학교 | Sogang University |
| `ssu` | 숭실대학교 | Soongsil University |
| `sejong` | 세종대학교 | Sejong University |
| `kw` | 광운대학교 | Kwangwoon University |
| `mju` | 명지대학교 | Myongji University |
| `postech` | 포항공대 | POSTECH |
| `unist` | 울산과학기술원 | UNIST |
| `gist` | 광주과학기술원 | GIST |
| `dgist` | 대구경북과학기술원 | DGIST |
| `pnu` | 부산대학교 | Pusan National University |
| `knu` | 경북대학교 | Kyungpook National University |
| `jnu` | 전남대학교 | Chonnam National University |
| `cnu` | 충남대학교 | Chungnam National University |
| `cbnu` | 충북대학교 | Chungbuk National University |
| `kangwon` | 강원대학교 | Kangwon National University |
| `jejunu` | 제주대학교 | Jeju National University |
| `ajou` | 아주대학교 | Ajou University |
| `inha` | 인하대학교 | Inha University |
| `gachon` | 가천대학교 | Gachon University |
| `dankook` | 단국대학교 | Dankook University |

### C. 패스트푸드/외식 (P1)
| Slug | 한글 | 영문 |
|---|---|---|
| `mcdonalds` | 맥도날드 | McDonald's |
| `burgerking` | 버거킹 | Burger King |
| `lotteria` | 롯데리아 | Lotteria |
| `momstouch` | 맘스터치 | Mom's Touch |
| `kfc` | KFC | KFC |
| `subway` | 서브웨이 | Subway |
| `dominos` | 도미노피자 | Domino's |
| `pizzahut` | 피자헛 | Pizza Hut |
| `mrpizza` | 미스터피자 | Mr. Pizza |
| `vips` | 빕스 | VIPS |
| `outback` | 아웃백 | Outback Steakhouse |
| `ashley` | 애슐리 | Ashley |
| `hansot` | 한솥 | Hansot |
| `bonjuk` | 본죽 | BonJuk |
| `kyochon` | 교촌치킨 | Kyochon |
| `bhc` | BHC | BHC |
| `bbq` | BBQ | BBQ Chicken |
| `nene` | 네네치킨 | Nene Chicken |
| `gimgane` | 김가네 | Gimgane |

### D. 편의점 (P1)
| Slug | 한글 | 영문 |
|---|---|---|
| `gs25` | GS25 | GS25 |
| `cu` | CU | CU |
| `7eleven` | 세븐일레븐 | 7-Eleven |
| `emart24` | 이마트24 | Emart24 |
| `ministop` | 미니스톱 | Ministop |

### E. 대형마트/백화점 (P1)
| Slug | 한글 | 영문 |
|---|---|---|
| `emart` | 이마트 | E-mart |
| `homeplus` | 홈플러스 | Homeplus |
| `lottemart` | 롯데마트 | Lotte Mart |
| `costco` | 코스트코 | Costco |
| `shinsegae` | 신세계백화점 | Shinsegae |
| `lottedept` | 롯데백화점 | Lotte Department Store |
| `hyundai` | 현대백화점 | Hyundai Department Store |
| `nc` | NC백화점 | NC Department Store |

### F. IT 회사 / 사무실 빌딩 (P2)
| Slug | 한글 | 영문 |
|---|---|---|
| `naver` | 네이버 | Naver |
| `kakao` | 카카오 | Kakao |
| `coupang` | 쿠팡 | Coupang |
| `woowabros` | 우아한형제들 | Woowa Brothers (배민) |
| `toss` | 토스 | Toss |
| `line` | 라인 | LINE |
| `yanolja` | 야놀자 | Yanolja |
| `kurly` | 마켓컬리 | Market Kurly |
| `nhn` | NHN | NHN |
| `wemakeprice` | 위메프 | WeMakePrice |
| `tmon` | 티몬 | Tmon |
| `daangn` | 당근마켓 | Karrot (Daangn) |

### G. 대기업 (P2 — 사무실 빌딩)
| Slug | 한글 | 영문 |
|---|---|---|
| `samsung` | 삼성 | Samsung |
| `lg` | LG | LG |
| `hyundai-group` | 현대 | Hyundai |
| `sk` | SK | SK Group |
| `lotte` | 롯데 | Lotte |
| `hanwha` | 한화 | Hanwha |
| `cj` | CJ | CJ |
| `gs` | GS | GS Group |
| `kt` | KT | KT |
| `posco` | POSCO | POSCO |

### H. 대중교통 운영사 (P2)
| Slug | 한글 | 영문 |
|---|---|---|
| `korail` | 코레일 | KORAIL |
| `seoulmetro` | 서울교통공사 | Seoul Metro |
| `sr` | SR | SR Corporation (SRT 운영) |
| `airportrail` | 공항철도 | AREX |

### I. 도서관/문화 (P3)
| Slug | 한글 | 영문 |
|---|---|---|
| `nlk` | 국립중앙도서관 | National Library of Korea |
| `assemblylib` | 국회도서관 | National Assembly Library |

### J. 베이커리/디저트 (P3)
| Slug | 한글 | 영문 |
|---|---|---|
| `parisbaguette` | 파리바게뜨 | Paris Baguette |
| `tousles` | 뚜레쥬르 | Tous Les Jours |
| `dunkin` | 던킨 | Dunkin' |
| `krispykreme` | 크리스피크림 | Krispy Kreme |
| `baskin` | 배스킨라빈스 | Baskin Robbins |

---

## 절대 조건

- **정사각 비율 (1:1 또는 거의)** — 워드마크는 거부, 엠블럼/심볼/씰 형태만
- 원본 비율·색상 유지 (잘라내거나 색 바꾸지 말 것)
- 형식: SVG > PNG > WebP. **각 파일 500KB 이하**
- 라이센스: nominative fair use (식별 목적)
- **수집 못 한 브랜드는 명시적으로 보고** (LLM이 임의로 가짜 로고 만들지 말 것)

---

## 검색 출처 (우선순위)

1. **나무위키** (https://namu.wiki/w/<브랜드>) — 인포박스 우측 상단 로고. 가장 신뢰성 높음.
2. **Wikimedia Commons** — `Special:FilePath/<filename>` 또는 imageinfo API
3. **Worldvectorlogo / SeekLogo / Brandfetch** — vector 모음 사이트
4. **공식 브랜드 사이트의 CI/홍보자료 페이지** — 가장 정확하지만 자동화 어려움
5. **Simple Icons** (https://simpleicons.org) — 글로벌 브랜드 (Starbucks, McDonald's, KFC 등). 단색 SVG. 색 추가 필요할 수도.
6. **Wikipedia (en/ko)** — 페이지 이미지 API

### 카테고리별 추천 출처
- **카페/외식**: 나무위키 > 공식 사이트 > Wikimedia
- **대학교**: 학교 공식 CI 페이지 > 나무위키 > Wikipedia
- **편의점/마트**: 나무위키 > Wikipedia > 회사 IR자료
- **IT 회사**: 공식 사이트 footer 로고 > Simple Icons (글로벌) > 나무위키
- **대중교통**: 운영사 공식 사이트 > Wikimedia (관용 로고)

---

## 파일 추가 절차

### 1. 파일 저장
```
public/brands/<slug>.<ext>
```
예: `public/brands/mega.png`, `public/brands/hollys.svg`

### 2. brands.ts에 등록
`src/lib/brands.ts`의 `BRANDS` 배열에 카테고리 그룹에 맞게 추가.

형식:
```ts
{
  id: '<slug>',
  iconUrl: '/brands/<slug>.<ext>',
  matches: (n) => includesAny(n, '<한글1>', '<한글2>') || /<영문>/i.test(n),
},
```

**매칭 패턴 작성 팁:**
- 한글 변형 다 포함: "메가커피", "메가MGC커피", "메가 MGC", "메가MGC"
- 띄어쓰기 변형 포함: "맘스터치", "맘 스 터 치"
- 약칭 포함: "BBQ", "비비큐"
- 일반어 충돌 주의: "엘지" 만으로는 안 됨 ("엘지 카페" 같은 우연 매칭). "LG전자", "LG디스플레이" 등 회사 부속어 포함하거나 단독 `\bLG\b`로
- regex 우선 — 짧은 영문은 word-boundary 사용

### 3. 검수
```bash
npm install
npm run build         # TS + Vite 통과 확인
npm run dev           # http://localhost:5173 — 장소 이름에 브랜드 키워드 넣어 확인
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

export const BRANDS: Brand[] = [
  // ── Cafes ─────────────────────────────────────────────────────────
  { id: 'starbucks', iconUrl: '/brands/starbucks.svg', matches: (n) => includesAny(n, '스타벅스') || /starbucks/i.test(n) },
  { id: 'twosome',   iconUrl: '/brands/twosome.png',   matches: (n) => includesAny(n, '투썸') || /twosome/i.test(n) },
  { id: 'paik',      iconUrl: '/brands/paik.png',      matches: (n) => includesAny(n, '빽다방') || /paik('?s)?\s*(coffee|bread)?/i.test(n) },
  { id: 'ediya',     iconUrl: '/brands/ediya.png',     matches: (n) => includesAny(n, '이디야') || /ediya/i.test(n) },
  // ── Universities ──────────────────────────────────────────────────
  { id: 'snu',       iconUrl: '/brands/snu.png',       matches: (n) => includesAny(n, '서울대학교', '서울대') || /seoul\s*national\s*university/i.test(n) },
  { id: 'hanyang',   iconUrl: '/brands/hanyang.svg',   matches: (n) => includesAny(n, '한양대학교', '한양대') || /hanyang/i.test(n) },
  { id: 'kaist',     iconUrl: '/brands/kaist.svg',     matches: (n) => includesAny(n, '카이스트', 'KAIST') || /kaist/i.test(n) },
  { id: 'yonsei',    iconUrl: '/brands/yonsei.svg',    matches: (n) => includesAny(n, '연세대학교', '연세대') || /yonsei/i.test(n) },
  { id: 'ku',        iconUrl: '/brands/ku.svg',        matches: (n) => includesAny(n, '고려대학교', '고려대') || /korea\s*university/i.test(n) },
];

export function brandFor(placeName: string): Brand | null {
  return BRANDS.find((b) => b.matches(placeName)) ?? null;
}
```

---

## 검수 체크리스트 (각 추가 항목)

- [ ] 파일이 정사각 비율인가? (예: 800x800, 200x200) — 워드마크는 reject
- [ ] 파일 크기 < 500KB
- [ ] `public/brands/`에 저장됐는가
- [ ] `brands.ts`에 새 항목 추가됐는가
- [ ] `matches` 함수가 한국어 변형과 영문을 모두 커버하는가
- [ ] 일반어와 충돌 안 하는가 (예: "에어컨 강남점" 입력했을 때 강남이 다른 브랜드로 매칭 안 됨)
- [ ] `npm run build` 통과
- [ ] 로컬에서 visual 확인

---

## 출력 형식

작업 끝나면 다음 보고서 제출:

### A. 카테고리별 추가 결과

| 카테고리 | 목표 | 추가됨 | 못 찾음 | 사유 |
|---|---|---|---|---|
| 카페 | 15 | N | M | (예: 더벤티는 공식 SVG 부재) |
| 대학교 | 30 | N | M | (예: 가천대는 정사각 엠블럼 없음) |
| ... | | | | |

### B. 출처 URL 리스트
각 파일별:
```
mega.png        — https://commons.wikimedia.org/wiki/...
hollys.svg      — https://namu.wiki/w/할리스커피 → infobox 우상단 SVG
mcdonalds.svg   — https://simpleicons.org/icons/mcdonalds
...
```

### C. brands.ts diff
실제 추가/수정된 라인의 diff 형식 보고.

### D. 빌드 통과 여부
```
npm run build → ✓ pass / ✗ error: ...
```

### E. 발견된 이슈
- 정사각 버전 없는 브랜드 (워드마크만 있는 경우)
- 출처가 의심스러운 브랜드 (저작권 불확실)
- 매칭 충돌 가능성 (예: "LG" 단독 매칭 위험)
- 너무 큰 파일 (압축 필요)

---

## 주의 사항

### 안 할 일
- 가짜/생성 로고 만들기 (못 찾으면 그냥 못 찾았다고 보고)
- 색상 변형하기 (브랜드 가이드 위반)
- 정치적/종교적 단체 로고 (분쟁 회피)
- 군 관련 / 정부 부처 로고 (별도 검토 필요)

### 주의해서 할 일
- 일본/중국 기업 (라인은 일본, 위메프는 한국, 헷갈리지 말 것)
- 합병/이름 변경된 회사 (예: KEB하나은행 → 하나은행)
- 같은 이름 다른 회사 (예: "한화" — 한화시스템, 한화에어로스페이스 등 — 그냥 모회사 로고로 통일)

---

## 한 줄 미션

> "한국인이 일상에서 마주치는 거의 모든 공공/상업 공간 브랜드의 정사각 로고를 모은다. 못 찾으면 못 찾았다고 정직하게 보고한다."

**예상 작업량**: 100+개 브랜드. 시간이 오래 걸리니 P0 → P1 → P2 → P3 순서로 진행.

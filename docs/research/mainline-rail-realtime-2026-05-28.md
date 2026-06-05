# 간선철도 (KTX·SRT·ITX·새마을·무궁화) 실시간 차량 위치 데이터 — 결론 보고서

**조사일**: 2026-05-28 (KST 03시경, 운행외 시간 — 운행시간대 캡처는 별도 ⚠️)
**의뢰**: 에어컨 민주주의 PWA — 간선열차 차량 단위 실시간 매칭

---

## TL;DR — 한 줄 결론

**KORAIL/SR 모두 차량 단위 실시간 위치 데이터를 공개 API로 제공하지 않으며, 향후 제공 계획도 없음 (KRIC 공식 답변, 2025-02-14)**. 코레일톡 앱 안에서만 보여주고, 외부에는 공개하지 않는 폐쇄 데이터.

PWA 차량 단위 투표 모델 적용 시 **간선철도는 사실상 시간표 기반 시뮬레이션 외에는 합법적 방법 없음**.

---

## 결정적 증거 (raw)

### KRIC 직접 답변 (사용자 질문 → 관리자 회신, 2025-02-14)

[KRIC 데이터 최신화 요청 게시판 id=76](https://data.kric.go.kr/rips/M_04_04/detail.do?id=76):

> **질문**: "코레일 '실시간 열차 위치 안내' 서비스 api 제공 여부 … 열차별 위치 조회 api 제공 가능, 앞으로 제공 계획은 있는지?"
>
> **답변 (관리자)**: "현재 레일포털 서비스 중 **실시간 정보 관련하여 추후 제공할 계획은 없으며 제공하기 힘든 점 양해 부탁** 드립니다."

KORAIL 원천 데이터를 위탁받아 운영하는 KRIC가 직접 부인. 끝.

### KORAIL 보도자료 (2024-07-26)

[코레일톡, 실시간으로 '열차도착정보' 제공한다!](https://info.korail.com/info/selectBbsNttView.do?key=911&bbsNo=199&nttNo=22417):

> "운행 중인 모든 여객열차의 **GPS 위치 정보**와 **신호기 통과 정보**를 빅데이터로 분석해 열차의 현재 위치와 예상도착 시간을 실시간으로 안내한다."
> "해당 서비스는 코레일톡 초기 화면에서 '열차위치' 탭을 누르거나 '나의 티켓' 화면에서 확인할 수 있다."

즉 **데이터는 존재하지만 코레일톡 앱 내부 전용**.

### KRIC 카탈로그 재조사

[Open API 카탈로그](https://data.kric.go.kr/rips/M_01_02/intro.do) 60건 전수 재확인 — KTX/고속/간선/여객 키워드로 필터링.
- 차량 단위 위치 데이터 = **0건**
- 가장 차량에 가까운 것: `subwayEnvironmental` (열차별 공기질, `trnNo` 있음) — 위치 아님
- 시각표: `subwayTimetable` (정적, dayCd 기반)
- 운영기관 정보, 편의시설 정보, 안전정보 등만 존재

[KRIC 활용사례 id=11 "실시간 열차운행 상태정보 모니터링"](https://data.kric.go.kr/rips/M_03_01/detail.do?id=11) — 사용자 추측대로 **활용사례(case study) 페이지 (2017년 등록)**. OpenAPI 아님. "철도 운영기관 관리자에게 제공"되는 내부 시각화 시스템 소개.

### data.go.kr

- [한국철도공사_열차운행정보 (15125762)](https://www.data.go.kr/data/15125762/openapi.do) — D-1 history (이전 LLM 검증 완료)
- TAGO 1613000 train — 시각표성

### 서드파티 OSS 검증

| 프로젝트 | endpoint host | 기능 | 실시간 위치 |
|---|---|---|---|
| [bsangmin/letskorail](https://github.com/bsangmin/letskorail) | `smart.letskorail.com:443/classes/com.korail.mobile.*` | 로그인/스케줄/예매/취소/티켓조회 | ❌ |
| [carpedm20/korail2](https://github.com/carpedm20/korail2) | 동일 | 동일 | ❌ |
| [ryanking13/SRT](https://github.com/ryanking13/SRT) | `etk.srail.kr` | 로그인/스케줄/예매/취소 | ❌ |
| [DarkTornado/subway](https://github.com/DarkTornado/subway) | (도시철도용, 간선철도 미지원) | — | — |

→ 코레일톡 앱의 "내 차표 위치" 화면은 **OSS 어디에도 reverse engineering된 사례 없음**. APK 디컴파일 + mitmproxy SSL pinning bypass가 필요한 비공식 작업.

### 어디GO Google Play 설명

[com.bykwon.bytrain](https://play.google.com/store/apps/details?id=com.bykwon.bytrain) — 지원 노선 명세에 **KTX/ITX/새마을/무궁화 일체 없음**. "도시철도 + 전국 버스"만. 어디GO는 간선철도 비대상.

### Tabriz / wheretrain.com / visual.railportal.kr

- [tabriz.kr](https://tabriz.kr) — 빈 응답 (서비스 죽음 또는 IP 차단)
- [visual.railportal.kr](https://visual.railportal.kr/), [railportal.kr](https://railportal.kr/) — 빈 응답 (URL 살아있지 않음)
- [wheretrain.com](https://www.wheretrain.com/) — 빈 응답
- [ODsay LAB](https://lab.odsay.com/) — "열차/KTX 운행정보 검색" 제공하나 실시간 위치 아님 (스케줄)

---

## 운영사 × 열차종 결과표

### KORAIL — KTX (KTX-산천, KTX-청룡, ITX-마음, ITX-새마을, 새마을, 무궁화 등 전체 여객)

| 항목 | 값 |
|---|---|
| 공식 실시간 차량 위치 endpoint | **❌ 없음** (KRIC 공식 답변, 2025-02-14) |
| 내부 데이터 소스 | 코레일톡 앱 (GPS + 신호기 통과 빅데이터). 출시 2024-07-29 |
| 비공식 endpoint | 알려진 사례 없음. APK 디컴파일 + 인증서 pinning bypass 필요 |
| 인증 | (비공식 추정) 코레일톡 앱 키 + 예매 PNR token 가능성. 예매 안 한 익명 사용자도 보이므로 일부는 무인증일 수 있음 |
| 응답 schema | 비공개 |
| 갱신 주기 | 비공개 (앱 UX상 ~10초 수준 추정) |
| 정밀도 | 역 단위 + 역간 신호기 통과 ("어디쯤" 보간) |
| 호차 (carOrdr) | 운행 데이터엔 없음. 예매 좌석권에서 사용자 직접 입력 |
| 라이선스 | 공식: 코레일톡 앱 한정. 비공식 추출 = 사용약관 위반 가능 |
| **production 가능성** | ❌ 공식 / ⚠️ 비공식 (법적 리스크 + 차단 리스크) |
| 갈음 가능한 데이터 | (a) `subwayTimetable` 시각표 정적 + (b) data.go.kr 15125762 D-1 history (포렌식용) |

### SR — SRT (수서고속철도)

| 항목 | 값 |
|---|---|
| 공식 실시간 차량 위치 endpoint | **❌ 없음** (data.go.kr·KRIC 미보유) |
| 내부 데이터 소스 | SR 자체 앱 (SR Pay) 안에서 위치 표시 여부는 KORAIL과 별개 — **별도 확인 필요** (운영시간대 앱 직접 확인 권장) |
| 알려진 OSS | etk.srail.kr 예매 wrapper만 (ryanking13/SRT). 위치 endpoint 없음 |
| **production 가능성** | ❌ |
| 비고 | KORAIL과 별개 회사. KRIC 답변은 KORAIL 한정 — SR이 별도 공개 API를 두었을 가능성은 낮지만 0% 단정 불가. (운영시간 안 SR 모바일 웹 https://etk.srail.kr DevTools 캡처 권장 — 보너스 task) |

### 광역철도 (수도권 1~9호선, 신분당선, GTX-A 등)

직전 보고서에서 다룬 도메인 — 서울 swopenAPI로 처리 완료. 본 보고서 범위 외.

---

## 추가 사실 (보너스)

- **코레일톡 사용량**: 출시 5개월(2024-07~2024-12) 530만 누적 접속, **일 평균 3만 접속** — 사회적으로 큰 수요 있지만 공개 API는 부재
- KORAIL은 "실시간 열차 위치 안내"를 "공공기관 대국민 체감형 서비스 개선과제"로 자체 출시. 공공 API 개방은 별도 정책 결정 필요
- visual.railportal.kr 흔적은 죽은 도메인. KRIC `station.kric.go.kr/v2/korLines/...` 도시철도용임

---

## 우리 PWA에 대한 의미 + 옵션

### 차량 단위 매칭 가능성

| 노선군 | 매칭 가능? | 데이터 출처 |
|---|---|---|
| 수도권 지하철 1~9호선 등 | ✅ | 서울 swopenAPI |
| 부산 1~4호선 | ⚠️ | 네이버 지도 비공식 |
| 대구/대전/광주/인천2/부산김해/동해선 | ❌ | (시간표 시뮬레이션 뿐) |
| **KTX·SRT·ITX·새마을·무궁화 (간선철도)** | **❌** | **공식 API 없음 — 본 보고서** |

### 옵션 (사용자 결정 필요)

**A. 간선철도는 "역+열차번호" 단위 투표 (시각표 기반)** (추천)
- 사용자가 `KTX 123` 입력 → 해당 열차번호의 KRIC 시각표 호출 → 현재 시각으로 "지금 어느 역 사이 진행 중" 보간 → "X역 통과" 단위 투표
- 장점: 합법, KRIC OpenAPI 사용
- 단점: 실제 지연·결행은 반영 안 됨. ghost entry 가능성 — CLAUDE.md 코어 원칙 3 위배 위험. **민원 처리 규칙 명시 필수**

**B. 코레일톡 APK reverse engineering으로 비공식 endpoint 추출**
- 부산 네이버 지도 경로보다 더 위험 (앱 SSL pinning, 갱신 빈도, KORAIL 차단 가능성)
- KRIC가 공식 답변으로 "제공 계획 없음"이라 했기에 정책 변경 시 부정적 반응 가능
- 법적 회색 → ❌ 비추

**C. 간선철도 일단 미지원 + roadmap 명시**
- v1은 도시철도/지하철 중심으로 출시
- 간선철도는 KORAIL이 공식 API 개방 시 추가
- 장점: 깨끗. 데이터 무결성 확보
- 단점: 사용자 수요 무시 (KORAIL 본인 보도자료가 인정한 수요)

**D. KORAIL에 공식 API 개방 요청서 발송** (병행 가능)
- KRIC `M_04_04` "데이터 최신화 요청" 채널 또는 [고객의소리](https://info.korail.com/info/contents.do?key=818)
- 시민 PWA가 공식적으로 요청한 사례가 늘면 정책 변경 가능성 → 장기 ROI
- 즉시 효과 없으나 동시 진행 권장

**추천: A + D 병행**. 우선 시간표 기반으로 launch하고, KORAIL에 공식 API 개방 요청. 코레일톡 APK reverse engineering(B)는 회피.

---

## 운영시간 안 (KST 06~24시) 추가 검증 권장 사항

본 조사는 KST 03시 수행. 사용자가 운행시간 안 (예: 14~16시)에 다음 캡처를 권장:

1. **코레일톡 모바일 웹** (`https://m.letskorail.com` 또는 코레일톡 앱) → 비예매 상태에서 "열차위치" 탭 → DevTools Network 캡처 → endpoint, 인증 헤더, 응답 schema 확인
2. **SR 모바일 웹** (`https://etk.srail.kr`) → 동일하게 캡처 — KORAIL과 별개로 SR 자체 위치 endpoint가 있는지 직접 확인
3. **네이버 지도 KTX 검색** → DevTools — 도시철도 `pts.map.naver.com/end-subway/...`와 유사한 간선철도용 endpoint가 있는지

위 3개 캡처가 새 endpoint를 드러내면 본 보고서 갱신. 단 현재까지의 증거 (KRIC 공식 답변 + OSS 부재 + 보도자료 어법)로는 **공식 endpoint 부재가 사실상 확정**.

---

## 참고

- [KRIC 데이터 최신화 요청 id=76 — "실시간 열차 위치 안내 API 제공 여부"](https://data.kric.go.kr/rips/M_04_04/detail.do?id=76)
- [KORAIL 보도자료: 코레일톡 실시간 열차도착정보 (2024-07-26)](https://info.korail.com/info/selectBbsNttView.do?key=911&bbsNo=199&nttNo=22417)
- [철도경제신문: "전열차 위치·도착 정보 실시간 제공"](https://www.redaily.co.kr/news/articleView.html?idxno=8446)
- [bsangmin/letskorail GitHub](https://github.com/bsangmin/letskorail)
- [ryanking13/SRT GitHub](https://github.com/ryanking13/SRT)
- [KRIC OpenAPI 카탈로그](https://data.kric.go.kr/rips/M_01_02/intro.do)
- [어디GO Google Play](https://play.google.com/store/apps/details?id=com.bykwon.bytrain)
- [ODsay LAB](https://lab.odsay.com/)

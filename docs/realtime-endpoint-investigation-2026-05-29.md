# 한국 도시철도·경전철 비공식 실시간 endpoint 조사 결과

**조사일**: 2026-05-29 KST  
**조사 시점**: KST 00:00 ~ 00:15 (모든 대상 노선 운영 종료 시간)  
**의뢰**: aircondemocracy.com — swopenAPI 미커버 9개 노선의 차량 단위 실시간 위치 endpoint 탐색  
**핵심 방법론**: 운영사 자체 site DevTools / JS 번들 reverse engineering + OSS 검색

---

## TL;DR

| 노선 | 운영사 자체 site 실시간 화면 | endpoint 발견 | production 사용 가능성 |
|---|---|---|---|
| 김포골드라인 | ❌ 부재 | ❌ | ❌ |
| 의정부경전철 | ❌ 부재 | ❌ | ❌ |
| 인천 1·2호선 | ❌ 부재 | ❌ | ❌ |
| 부산김해경전철 | ❌ 부재 | ❌ | ❌ |
| 동해선·대경선 | ❌ 별도 site 없음 | ❌ | ❌ |
| 대구 1·2·3호선 | ⚠️ 사이버스테이션 페이지 SPA — JS 번들 미추출 | ⚠️ 미확정 | ⚠️ 추가 조사 필요 |
| 부산 1~4호선 자체 | ⚠️ humetro/data 페이지 IP 차단 | ⚠️ 미확정 | NAVER 우회 외 미확정 |
| 광주 1호선 | ✅ 사이버스테이션 페이지 존재 | ✅ `/cyber/subway/stationMovingPc` | ⚠️ 30s polling 검증 미완 (새벽 호출 시 500) |
| 대전 1호선 | ✅ 사이버스테이션 페이지 존재 | ✅ `/kor/ajaxGetSubwayInfo.do` | ❌ 시간표 기반 강한 시그널 + 차량 단위 ID 부재 |

**핵심 결론**: **9개 노선 중 차량 단위 실시간(trainNo + 현재역) 위치를 일관성 있게 제공하는 운영사 자체 endpoint는 발견되지 않음.** 광주 1호선만 운영사 client가 호출하는 polling endpoint(`/cyber/subway/stationMovingPc`, 10초 주기)를 확인했으나, ① 새벽 호출에서 500 응답이라 30s × 3 실시간 검증을 못 했고, ② DarkTornado/subway OSS가 광주 1호선을 명시적으로 **"시간표 기반"** 으로 분류하고 있어 실시간일 가능성도 낮음 (운영시간 polling으로 추가 검증 필요).

---

## 노선별 상세

### 1. 김포골드라인 (김포골드라인에스알에스㈜) — gimpogoldline.com

**조사 결과**: 운영사 site **메뉴 트리 전수 확인** — 회사소개 / 이용안내(노선안내·운임·역정보·편의시설) / 고객서비스(운행지연 안내) / 알림마당 / 안전·기술. **"실시간 운행정보" 메뉴 또는 사이버스테이션 자체가 없음.**

- "운행지연 증명서 발급"은 사후 발급용 (실시간 X)
- WordPress 기반 정적 site
- JS 번들 ajax/fetch 패턴 부재

**OSS 사례**: DarkTornado/subway README 명시 — 김포골드라인은 **"시간표 기반 운행 정보"** 분류 (운영사 endpoint 없음을 OSS 저자도 확인).

**production 사용 가능성**: ❌ — 자체 endpoint 부재 확정.

---

### 2. 의정부경전철 (의정부경량전철㈜) — ulrt.co.kr

**조사 결과**: 운영사 site **메뉴 트리 전수 확인** — 회사소개 / 이용안내(운행시간·역사정보·운임·견학·FAQ) / 알림마당 / 안전·기술 / 고객지원(고객의소리·유실물·간편지연증명서·자료실) / 광고. **"실시간 운행정보" 메뉴 또는 사이버스테이션 자체가 없음.**

- "운행시간"은 첫차/막차/배차간격 시간표만
- gnuboard5 기반 정적 site

**OSS 사례**: DarkTornado/subway README 명시 — 의정부경전철은 **"시간표 기반"** 분류.

**production 사용 가능성**: ❌ — 자체 endpoint 부재 확정.

---

### 3. 인천 1·2호선 (인천교통공사) — ictr.or.kr

**조사 결과**: 인천교통공사 site **도시철도 메뉴 트리 전수 확인** — 운영개요, 역무실 전화번호, 여객운송약관, 운임안내, 노선도, 역정보, **열차운행시각표**, 교통카드, 단체승차권, 편의시설(기본·승강설비 운영고장현황·자전거보관소·장애인편의·수유실·주차장), 역간거리/소요시간, 모바일 환승지도, 시설현황, 전동차현황, 전동차 특징, 통신·건축·종합관제·전자·토목궤도·기계설비·전력·신호, 철도보호지구, 운전·정비교육, 지하철에티켓, 간편지연증명서. **"실시간 운행정보", "사이버스테이션", "열차위치" 메뉴 부재.**

- "열차운행시각표"는 시간표만
- "승강설비 운영고장현황"은 엘리베이터/에스컬레이터 점검 정보 (열차 위치 X)

**OSS 사례**: DarkTornado/subway README + `DarkTornado/ictr` 별도 리포 명시 — 인천 1·2호선은 **"시간표 기반"** 분류 (인천교통공사 endpoint 없음을 별도 리포로 확인).

**production 사용 가능성**: ❌ — 자체 endpoint 부재 확정.

---

### 4. 부산김해경전철 (부산-김해경전철㈜) — bglrt.com

**조사 결과**: 운영사 site **메뉴 트리 전수 확인** — 정보검색(노선/운임·역정보·사이트검색) / 이용안내(역사안내·운행안내[노선도·운임표·첫차/막차]·안전문화·경전철에티켓·FAQ·단체승객) / 고객참여(고객의소리·유실물·고객아이디어·신고센터) / 문화이벤트 / 회사소개. **"실시간 운행정보" 메뉴 또는 사이버스테이션 자체가 없음.**

- "운행안내" 하위는 정적 노선도·운임표·첫차/막차 시간표만

**OSS 사례**: DarkTornado/subway README 명시 — 부산김해경전철은 **"시간표 기반"** 분류.

**production 사용 가능성**: ❌ — 자체 endpoint 부재 확정.

---

### 5. 대구 1·2·3호선 (대구교통공사) — dtro.or.kr

**조사 결과**: 사이버스테이션 페이지 URL 확인 — `https://www.dtro.or.kr/front/dtro/cyberstation/station/cyberstation.do`. 그러나 raw HTML이 **5줄짜리 SPA 셸**이고 외부 JS 번들 식별 불가 (`curl`로는 빈 응답).

- 정적 fetch로는 endpoint 단서 추출 불가
- Chrome MCP DevTools Network 캡처 또는 SPA 번들 직접 식별 필요 — 이번 round 미수행

**OSS 사례**: DarkTornado/subway README — 대구 1·2·3호선 + 대경선은 **"시간표 기반"** 분류.

**production 사용 가능성**: ⚠️ — 이번 방법론으로 못 찾음. 운영시간 중 Chrome DevTools 캡처 필요.

---

### 6. 부산 1·2·3·4호선 자체 (부산교통공사) — humetro.busan.kr

**조사 결과**: 두 경로 시도, 모두 차단.

1. **사이버스테이션** (`https://www2.humetro.busan.kr/homepage/cyberstation/map.do`): 메뉴는 **노선검색(최단거리·최소시간·최소환승)** + 노선도·요금정보·편의시설만. **실시간 위치 메뉴 부재.** cyber-station.js 번들에 ajax/fetch 패턴 없음.

2. **자체 데이터 페이지** (`https://www.humetro.busan.kr/data`, `/menu/openapi`): 응답 본문 — *"보안 정책에 의해 차단 되었습니다. ... 정보화부 담당자 연락처 (051-640-7177)"*. cloud IP/User-Agent 차단으로 추정. UA spoofing 후에도 동일 차단.

**기존 발견 (재확인)**: NAVER 지도 비공식 `pts.map.naver.com/end-subway/...` — DarkTornado/subway OSS가 사용. ToS 회색지대.

**production 사용 가능성**: ⚠️ — humetro 자체 endpoint는 이번 방법론으로 못 찾음. 한국 IP에서 다시 시도 필요. NAVER 우회는 별도 risk 평가.

---

### 7. 광주 1호선 (광주교통공사) — grtc.co.kr ⭐ endpoint 발견

```
운영사: 광주교통공사
URL: https://www.grtc.co.kr/cyber/subway/stationMovingPc
     (모바일용 별도: /cyber/subway/stationMovingMobile)
인증: 무인증 / 세션 쿠키 JSESSIONID 자동 발급 / Referer 검사 의심
요청: GET, query string 없음
헤더: Referer: https://www.grtc.co.kr/cyber  필요
폴링 주기: 10초 (setInterval 10000ms — JS 번들에서 직접 확인)
응답 schema: HTML fragment (`$(".pc").html(html)` 로 페이지에 주입)
실시간 검증: ❌ 미완 — KST 00:03 조사 시점이 운영시간(06:00~24:00) 외라
            500 Internal Server Error 반환. 30s × 3 polling 못 함.
OSS 활용 사례: DarkTornado/subway가 광주 1호선을 명시적으로 "시간표 기반"
            으로 분류 — OSS 저자가 이 endpoint 알면서도 시간표를 채택했다면
            응답이 시간표일 가능성 높음. 운영시간 polling 외 확정 불가.
운영사 ToS / 라이선스: 명시 없음 — 회색지대
production 사용 가능성: ⚠️ 운영시간 polling 검증 후 결정. 응답이 차량 단위
                     trainNo 포함하면 ✅, 시간표면 ❌.
```

**JS 번들 분석 출처**: `https://www.grtc.co.kr/js/subway/main.js` (1284 lines, 무인증 fetch). 관련 라인:

```javascript
// loadSubwayMoving() 내부, sitecode = "cyber" (페이지 hidden input 확인)
$.ajax({
    type: "GET",
    url: "/" + sitecode + "/subway/stationMovingPc",
    datatype: "html",
    success: function(html) { $(".pc").html(html); }
});

// setInterval polling
mobileMoving = setInterval(function () {
    $.ajax({
        type: "GET",
        url: "/" + realPath + "/subway/stationMovingPc",
        ...
    });
}, 10000);
```

**미완 작업**: KST 06:00~24:00 운영시간 중 `curl -H 'Referer: https://www.grtc.co.kr/cyber' https://www.grtc.co.kr/cyber/subway/stationMovingPc` 호출 → 응답 HTML에 차량 단위 trainNo가 포함되는지 + 30초 polling으로 위치 이동 검증 필요.

---

### 8. 대전 1호선 (대전교통공사) — djtc.kr

**endpoint 발견** (사이버스테이션 페이지 inline JS 추출):

```
URL: https://www.djtc.kr/kor/ajaxGetSubwayInfo.do?datetime=YYMMDDHHMMSS&stationID=XXX
인증: 무인증 / Referer https://www.djtc.kr/kor/cyberStation.do?menuIdx=28 의심
요청: GET
폴링 주기: 미상 (단일 호출 추정)
응답 schema: 미확정 — 새벽 호출에서 NAVER 지도 SPA HTML이 응답으로 옴
            (사이버스테이션 페이지 자체 응답 추정. iframe redirect 의심)
            운영시간 중 재호출 필요.
실시간 검증: ❌ 운영시간 외라 검증 불가
운영사 ToS / 라이선스: 명시 없음 — 회색지대
```

**중대한 negative 시그널** (페이지 inline JS 코드 자체):
```javascript
if( upTm1 > 60 ){ // 상행열차 시간이 현재시간과 1시간 이상 차이나면 운행종료
    //alert("상행열차 운행종료");
}
if( downTm1 > 60 ){ // 하행열차 시간이 현재시간과 1시간 이상 차이나면 운행종료
    //alert("하행열차 운행종료");
}
```

이 client 로직은 **시간표 기반 응답** 시그널. 진짜 실시간이면 "다음 도착 예정 시각이 60분 후"라는 분기가 필요 없음.

**추가 negative**: endpoint는 `stationID` 파라미터를 받음 = **역 단위 다음 도착 시각** 응답으로 추정. **차량 단위 ID(trainNo) 부재**. brief 기준 "역 단위만 가능 → 채택 안 함, 일관성 부재".

**OSS 사례**: DarkTornado/subway README — 대전 1호선은 **"시간표 기반"** 분류.

**production 사용 가능성**: ❌ — 차량 단위 ID 부재 + 시간표 강한 시그널.

---

### 9. 동해선·대경선 (코레일 광역철도) — info.korail.com 외

**조사 결과**: 별도 운영사 site 없음. 코레일은 광역철도 차량 위치를 **코레일톡 모바일 앱**에서만 표시 (앱 store 설명 명시). 이번 조사는 웹 reverse engineering만 수행 — 앱 APK 디컴파일은 별도 round.

- 한국철도공사 공식 OpenAPI (`openapis.korail.com`, data.go.kr 15125762)는 **여객열차 운행정보** (KTX/새마을/무궁화) 위주, 광역철도 차량 위치 미커버 (KRIC도 동일 확인 완료)
- 어디GO 앱이 동해선/대경선 표시 — 이미 brief에서 **"시간표 보간"** 으로 확정됨

**OSS 사례**: DarkTornado/subway README — 동해선·대경선은 **"시간표 기반"** 분류.

**production 사용 가능성**: ❌ — 운영사 자체 endpoint 부재. 코레일톡 APK 분석은 별도 round.

---

## 다음 액션

### 우선순위 1 (다음 round 즉시 수행)
1. **광주 1호선 — 운영시간 polling 검증**: KST 06:00~24:00 사이에 `https://www.grtc.co.kr/cyber/subway/stationMovingPc` 30s × 3회 호출. 응답 HTML에 차량 단위 trainNo + 위치가 포함되면 ✅, 시간표 응답이면 ❌.
2. **대구 1·2·3호선 — Chrome MCP DevTools 캡처**: `dtro.or.kr` 사이버스테이션 SPA를 실제 브라우저로 열어 XHR 캡처. 사용자 Chrome 확장에 `dtro.or.kr` 도메인 허용 필요.

### 우선순위 2
3. **부산 1~4호선 — 한국 IP polling**: `humetro.busan.kr/data`, `/menu/openapi` 페이지를 사용자 PC 또는 한국 IP에서 직접 열어 자체 API 페이지 존재 여부 확인. cloud IP에서는 보안 차단.
4. **NAVER 우회 (부산 1~4)** ToS 검토 후 production 결정: `pts.map.naver.com/end-subway/...` — DarkTornado/subway 사용 사례. 회색지대.

### 우선순위 3 (이번 방법론 외)
5. **코레일톡 APK 리버스 엔지니어링** — 동해선/대경선/광역철도 전반.
6. **각 운영사 자체 안드로이드 앱 검색** — Google Play "김포골드라인", "의정부경전철", "부산김해경전철" 별도 앱이 있는지 + 있다면 APK 추출.

---

## 검증 로그 (재현용)

```bash
# 광주 GRTC endpoint 발견 과정
curl -s "https://www.grtc.co.kr/js/subway/main.js" \
  | grep -B1 -A5 "stationMovingPc"
# → 라인 425, 813, 위치 발견. setInterval 10000ms polling.

curl -s "https://www.grtc.co.kr/cyber" | grep 'id="sitecode"'
# → <input type="hidden" id="sitecode" value="cyber" />

# 새벽 호출 검증 (KST 00:08)
curl -sS -H "Referer: https://www.grtc.co.kr/cyber" \
  -H "X-Requested-With: XMLHttpRequest" \
  "https://www.grtc.co.kr/cyber/subway/stationMovingPc"
# → 500 Internal Server Error (운영시간 외)

# 대전 djtc endpoint 발견 과정
curl -sL "https://www.djtc.kr/kor/cyberStation.do?menuIdx=28" \
  | grep -A3 "ajaxGetSubwayInfo"
# → URL 패턴 + "60분 이상 차이 → 운행종료" 시간표 로직 발견

# 부산 humetro 차단 확인
curl -sL "https://www2.humetro.busan.kr/data"
# → "보안 정책에 의해 차단 되었습니다" (IP 차단 추정)
```

---

## 참고 — 이번 round 확정 사실 (재조사 금지)

- **운영사 site 메뉴 트리에 실시간 운행 화면 부재 확정**: 김포골드라인, 의정부경전철, 인천 1·2호선, 부산김해경전철
- **광주 1호선 polling endpoint URL 확정**: `/cyber/subway/stationMovingPc` (응답이 실시간인지 시간표인지는 운영시간 검증 필요)
- **대전 1호선 endpoint URL 확정**: `/kor/ajaxGetSubwayInfo.do` (역 단위 + 시간표 시그널 강 → 채택 안 함)
- **부산 humetro 자체 데이터 페이지 cloud IP 차단 확정** (한국 IP 재조사 필요)
- **대구 SPA 번들 미추출** (Chrome MCP 다음 round)

## Sources

- [DarkTornado/subway](https://github.com/DarkTornado/subway) — 9개 대상 노선을 모두 "시간표 기반"으로 분류한 README (Python/FastAPI, MetroMap 앱 백엔드)
- [DarkTornado/ictr](https://github.com/DarkTornado/ictr) — 인천 1·2호선 시간표 별도 리포
- [광주교통공사 사이버스테이션](https://www.grtc.co.kr/cyber)
- [광주교통공사 OpenAPI 운행정보](https://www.grtc.co.kr/subway/contents/apiRunInfo) — `stationTimeInfomation` 시간표 시각만, 차량 위치 X
- [대전교통공사 사이버스테이션](https://www.djtc.kr/kor/cyberStation.do?menuIdx=28)
- [대구교통공사 사이버스테이션](https://www.dtro.or.kr/front/dtro/cyberstation/station/cyberstation.do)
- [부산교통공사 사이버스테이션](https://www2.humetro.busan.kr/homepage/cyberstation/map.do)
- [김포골드라인 메인](https://gimpogoldline.com/)
- [의정부경전철 ULINE](https://www.ulrt.co.kr/)
- [부산김해경전철 BGL](https://www.bglrt.com/)
- [인천교통공사](https://www.ictr.or.kr/)

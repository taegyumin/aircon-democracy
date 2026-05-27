# 대학 강의실 데이터셋 검증 리포트 (2026-05-27)

## 현재 상태 진단

- 대상 브랜치: `claude/seoul-univs-research` (`main` 미접촉)
- 데이터 규모: 108교 / 114캠퍼스 / 692건물
- 자동 스키마 오류: id 중복 0, placeIdPrefix 중복 0, sources 누락 0, 캠퍼스 내 building code 중복 0
- 빈 건물 목록: `puts`, `scu` 2교. 공개 건물 데이터 부족으로 freeform 폴백 유지
- 표본 15교 중 공식 URL 직접 fetch 완료/부분확인: 10교. JS-only 또는 이미지맵은 “보강 필요”로 표시
- 즉시 수정: KAIST, 부산대, 경북대, POSTECH, 중앙대 건물 목록 보강 + generic wizard 버그 2건 수정
- Blocker: 나무위키 직접 fetch는 403 가능성이 높아 검색 snippet/공식 사이트를 우선 사용

## 자동 검사 결과

| 검사 | 결과 |
|---|---:|
| 학교 수 | 108 |
| 캠퍼스 수 | 114 |
| 건물 수 | 692 |
| `id` 중복 | 0 |
| `placeIdPrefix` 중복 | 0 |
| `sources` 누락 | 0 |
| 캠퍼스 내 `building.code` 중복 | 0 |

## 무작위 표본 15교 검증

| 학교 | 기존 상태 | 검증 결과 | 조치 |
|---|---:|---|---|
| 울산대 | 5건물 | 공식 캠퍼스맵이 01~46, S01 건물을 텍스트로 제공. 현 데이터 과소 | 추후 보강 필요 |
| 원광대 | 4건물 | 공식 캠퍼스맵 fetch 성공, 현 데이터 과소 | 추후 보강 필요 |
| 호서대 | 8건물 | 공식 캠퍼스맵이 천안캠퍼스 01~21 건물 제공 | 현 데이터 일부만 정확 |
| 한국교원대 | 7건물 | 공식 페이지 fetch는 성공, 텍스트 추출 제한 | 유지, 추가 검증 필요 |
| 서울과기대 | 2건물 | 공식 캠퍼스지도는 JS/이미지 중심. 현 데이터 과소 | 추후 보강 필요 |
| 성균관대 명륜 | 5건물 | 공식 캠퍼스맵은 JS 중심, classinfo는 로그인 필요 | 공개 데이터만 유지 |
| 한밭대 | 4건물 | 공식 자료에서 N/S 건물 체계 확인 가능, 현 데이터 과소 | 추후 보강 필요 |
| 중앙대 | 12건물 | 공식 캠퍼스맵 + 보안대학원 PDF 건물 안내로 번호 체계 확인 | 26건물로 수정 |
| 전주대 | 3건물 | 공개 데이터 과소 | 추후 보강 필요 |
| 고려대 세종 | 5건물 | 일부 부속 페이지로 건물 확인, 공식 전체 map 보강 필요 | 유지 |
| 제주대 | 4건물 | 공개 데이터 과소 | 추후 보강 필요 |
| KAIST | 4건물 | 공식 campus map PDF에서 E/N/W 코드 확인 | 17건물로 수정 |
| 한국교통대 | 1건물 | 공식 캠퍼스맵 snippet에서 E/W 전체 코드 확인 | 추후 보강 필요 |
| 장신대 | 0건물 | 공개 건물 데이터 부족 | freeform 유지 |
| 서울기독대 | 0건물 | 공개 건물 데이터 부족 | freeform 유지 |

## 핵심 10교 재수행

| 학교 | 결과 |
|---|---|
| 서울대 | IST 무선현황 PDF가 캠퍼스/동번호/건물명/현장호실/호실명을 표 형태로 제공. 기존 160건물/1976호실 유지 |
| 연세대 신촌 | 공식 편의시설 조사표에서 공학원 102, 제2공학관 122, 백양누리 130 등 주요 번호 확인. 기존 40건물 유지 |
| 고려대 안암 | 공식 캠퍼스맵 + 위키 건축물 문서로 주요 건물 확인. 기존 29건물 유지 |
| 한양대 서울 | 공식 캠퍼스맵/수업 안내 + 한양위키 번호 체계 확인. 기존 27건물 유지 |
| 동국대 서울 | 공식 캠퍼스맵이 1~41 목록 제공. 기존 31건물 유지 |
| 부산대 | 공식 부산캠퍼스맵 텍스트 목록 기준 보강 | 6 → 23건물 |
| 경북대 | 공식 KNU 페이지 + 과학영재교육원 강의실 건물번호 안내 기준 보강 | 5 → 10건물 |
| KAIST 대전 | 공식 캠퍼스맵 PDF 기준 E/N/W 코드 보강 | 4 → 17건물 |
| POSTECH | 공식 한/영 캠퍼스맵 기준 M/S/E/D 코드 보강 | 3 → 22건물 |
| 중앙대 서울 | 내가 선택한 추가 1교. 공식 캠퍼스맵 + 중앙대 보안대학원 건물 안내 PDF 기준 보강 | 12 → 26건물 |

## 코드/인프라 검토

수정 완료:

- `search.ts`: generic 학교의 비숫자 code가 `본관동`처럼 표시되던 문제 수정. 숫자 code만 `동` suffix를 붙임
- `GenericUniversityWizard.tsx`: 멀티캠퍼스에서 현재 캠퍼스에 보이는 hit가 0개인데 전체 hit만 존재하면 빈 화면이 뜨던 문제 수정
- `universities/index.ts`, `SNUClassroomWizard.tsx`: “40개 서울권 학교”로 남아 있던 stale 주석 정리

남은 PR 코멘트 스타일 이슈:

- `[P2] UniversityPicker가 110개 학교를 단일 리스트로 노출`: 검색은 되지만 지역/권역 grouping이 없어 스캔 비용이 큼. 서울/수도권/충청/영남/호남 등 섹션 또는 최근 선택 우선 노출 권장
- `[P2] sources가 학교 단위에만 있음`: “건물별 출처”까지 엄밀히 보존하려면 `UnivBuilding.sources?: string[]` 타입 추가 필요
- `[P2] 일부 표본 학교 데이터 과소`: 울산대, 한밭대, 한국교통대, 서울과기대 등은 공식 목록이 확인되므로 다음 배치에서 10개 이상으로 보강 가능
- `[P3] 행정구역 문자열 표준화 필요`: `경기 수원`, `강원 춘천`처럼 시/구 표기가 섞여 있음. 검색 metadata 용도면 허용 가능하나 별도 validator가 있으면 좋음

## 주요 출처

- 서울대 IST 무선현황 PDF: https://ist.snu.ac.kr/wp-content/uploads/sites/186/2024/02/%EB%AC%B4%EC%84%A0%ED%98%84%ED%99%A9_202402.pdf
- 연세대 신촌캠퍼스 편의시설 조사표: https://yfl.yonsei.ac.kr/designcenter/board/notice.do?articleNo=144208&attachNo=124119&mode=download
- 고려대 캠퍼스맵: https://www.korea.ac.kr/campusMap/ko/view.do
- 동국대 서울캠퍼스맵: https://www.dongguk.edu/campus/map/seoul
- 부산대 부산캠퍼스맵: https://www.pnu.kr/kor/CMS/Contents/Contents.do?mCode=MN212
- KAIST 캠퍼스맵 PDF: https://www.kaist.ac.kr/Upload/map/Campus_Map_2023.pdf
- POSTECH 캠퍼스맵: https://www.postech.ac.kr/kor/university-introduction/campus_map.do
- 중앙대 캠퍼스맵: https://www.cau.ac.kr/cms/FR_CON/index.do?MENU_ID=610
- 경북대 강의실 건물번호 안내: https://seigy.knu.ac.kr/notice/1070

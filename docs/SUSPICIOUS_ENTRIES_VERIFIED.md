# Suspicious Entries Verified

2026-05-27 기준 v1에서 생성됐다가 롤백된 의심 entry를 재검증했다. 확인되지 않은 코드는 데이터에 넣지 않는다.

## POSTECH `LM78`

- 결과: `LM78`은 표준 건물 코드로 확인하지 못했다.
- 근거: POSTECH 공식 캠퍼스맵은 `78계단`을 캠퍼스 명소로 노출하지만, `LM` zone 또는 `LM78` 코드 체계는 확인되지 않았다.
- 조치: `78계단` 자체는 실존하나 `LM78` 코드는 채택하지 않는다.
- 출처: `https://www.postech.ac.kr/kor/university-introduction/campus_map.do`, `https://www.postech.ac.kr/kor/newscenter/university-news.do?articleNo=4992&mode=view`

## POSTECH `S02` / `C5`

- 결과: `C5`는 공식 캠퍼스맵의 연구시설로 확인되지만, `S02`가 `C5`의 표준 코드라는 공개 근거는 확인하지 못했다.
- 근거: POSTECH 공식 캠퍼스맵은 Research Facilities 항목에 `C5`를 노출한다. 별도 부설 페이지/캠퍼스맵 계열 자료는 번호형 목록을 쓰며 `S02` 코드를 확인해 주지 않는다.
- 조치: `code="S02", name="C5"` 형태는 채택하지 않는다. `C5`를 넣으려면 별도 학교 단위 보강에서 `code="C5"` 등으로 재검토한다.
- 출처: `https://www.postech.ac.kr/eng/about/campus_map.do`, `https://ime.postech.ac.kr/en/index.php/intro/campus-map/`

## KAIST `E16 정문술빌딩`

- 결과: `정문술빌딩`의 코드 `E16`은 확인됐다. `N1`은 IT융합 빌딩이다.
- 근거: KAIST 편의시설 페이지와 KAIST site search가 `정문술빌딩(E16)` / `ChungMoonSoul B/D E16`을 노출한다. 공개 PDF 검색 결과 일부는 `E16 E17` 텍스트가 붙어 보이지만, 공식 페이지 다수가 `E16`을 직접 표기한다.
- 조치: `E16 정문술빌딩`은 채택 가능. `N1 정문술빌딩`으로 바꾸지 않는다.
- 출처: `https://kaist.ac.kr/kr/html/campus/053306.html`, `https://www.kaist.ac.kr/site/kr/search.php?cate=locate&listCount=10&sortField=&startCount=5&sval=`

## 부산대 `pnu.kr` 도메인

- 결과: `pnu.kr`은 공식 캠퍼스맵 URL로 확인되지만, `pusan.ac.kr`이 deprecated 됐다는 근거는 확인하지 못했다.
- 근거: 현재 검색 결과에서 `pnu.kr` 캠퍼스맵과 `pusan.ac.kr` 공식 페이지가 모두 노출된다. `pusan.ac.kr`은 영문/조직/모바일/학과 페이지에서 계속 사용된다.
- 조치: 기존 데이터의 `pusan.ac.kr`을 이유 없이 `pnu.kr`로 교체하지 않는다. 도메인을 교체하는 커밋은 리다이렉트 또는 공식 폐기 안내를 별도 명시해야 한다.
- 출처: `https://www.pnu.kr/kor/CMS/Contents/Contents.do?mCode=MN212`, `https://www.pusan.ac.kr/kor/Main.do`

## 중앙대 101-210 동번호

- 결과: 보안대학원 PDF 외 공개 출처에서도 101-210 동번호와 건물명이 확인됐다.
- 근거: Study in Korea에 올라온 중앙대 외국인전형 모집요강, 중앙대 대학원 학술정보원 안내 PDF, 건강간호대학원 모집요강 검색 결과가 101 영신관, 102 약학대학 및 R&D센터, 201 본관, 204 중앙도서관, 207 봅스트홀, 208 제2공학관, 210 다목적관 등을 반복 표기한다.
- 조치: 중앙대 101-210 보강은 보안대학원 PDF에 의존하지 않고 공식/준공식 모집요강류로 교차검증 가능하다.
- 출처: `https://www.studyinkorea.go.kr/file/srcFileDown.do?fileStorePath=fileStorePath&filename=40_530990_201803140353047270.pdf&orgfilename=2018+Spring+Graduate+Admission+Guide+for+International+Students.pdf`, `https://graduate.cau.ac.kr/graduate/info/notice.do?articleNo=43551&attachNo=54486&mode=download`

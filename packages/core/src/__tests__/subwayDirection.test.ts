// 회귀 방지: prev→next 방향 판정. swopenAPI updnLine과 일치해야 함.
// 2호선 (순환선) — swopenAPI 실제 매핑 (사용자 검증 2026-05-26):
//   updnLine '0' = 외선순환 (시계방향)
//   updnLine '1' = 내선순환 (반시계방향)
// 단방향 노선 — doc 그대로: '0' = 상행, '1' = 하행 (sequence 정방향).

import { describe, it, expect } from 'vitest';
import { expectedUpdnLine } from '../subwayDirection';

describe('expectedUpdnLine', () => {
  describe('2호선 (순환선) — swopenAPI doc과 반대 매핑', () => {
    // 외선순환 (시계방향): 강남 → 교대 → 서초 → 방배 → 사당. updn=0.
    it('강남 → 교대 = 외선 (0)', () => {
      expect(expectedUpdnLine('2호선', '강남', '교대')).toBe('0');
    });
    it('교대 → 서초 = 외선 (0)', () => {
      expect(expectedUpdnLine('2호선', '교대', '서초')).toBe('0');
    });
    it('서초 → 방배 = 외선 (0)', () => {
      expect(expectedUpdnLine('2호선', '서초', '방배')).toBe('0');
    });
    // 내선순환 (반시계): 교대 → 강남 → 역삼. updn=1.
    it('교대 → 강남 = 내선 (1)', () => {
      expect(expectedUpdnLine('2호선', '교대', '강남')).toBe('1');
    });
    it('강남 → 역삼 = 내선 (1)', () => {
      expect(expectedUpdnLine('2호선', '강남', '역삼')).toBe('1');
    });
    it('서초 → 교대 = 내선 (1)', () => {
      expect(expectedUpdnLine('2호선', '서초', '교대')).toBe('1');
    });
    it('방배 → 서초 = 내선 (1)', () => {
      expect(expectedUpdnLine('2호선', '방배', '서초')).toBe('1');
    });
    // wrap-around
    it('충정로 → 시청 = 외선 (0)', () => {
      expect(expectedUpdnLine('2호선', '충정로', '시청')).toBe('0');
    });
    it('시청 → 충정로 = 내선 (1)', () => {
      expect(expectedUpdnLine('2호선', '시청', '충정로')).toBe('1');
    });
    it('strips trailing 역', () => {
      expect(expectedUpdnLine('2호선', '강남역', '교대역')).toBe('0');
    });
    it('인접 아니면 null (강남↔잠실)', () => {
      expect(expectedUpdnLine('2호선', '강남', '잠실')).toBeNull();
    });
  });

  // 단방향 노선 1/3/4/5/6/7/8/9호선은 swopenAPI doc 매핑('1'=하행 정방향, '0'=상행 역방향)이
  // 실제 응답과 일치함을 cross-check로 확인 (2026-05-26, scripts/check-updnline.mjs).
  //   3/7/8/9호선: 100% docOk (rows 23~57개 sample 전수)
  //   1/4/5/6호선: docSwap 0~2개. ambiguous는 지선 차량 (sequence 미커버)이지 매핑 오류 아님.
  // 즉 swap이 필요한 건 2호선뿐. 다음번 누가 또 의심하면 위 스크립트 다시 돌리면 됨.
  describe('단방향 노선 (swopenAPI doc 매핑 = 실제, 2026-05-26 cross-check)', () => {
    it('1호선 동대문 → 종로5가 = 하행 (1)', () => {
      expect(expectedUpdnLine('1호선', '동대문', '종로5가')).toBe('1');
    });
    it('1호선 종로5가 → 동대문 = 상행 (0)', () => {
      expect(expectedUpdnLine('1호선', '종로5가', '동대문')).toBe('0');
    });
    it('3호선 안국 → 종로3가 = 하행 (1)', () => {
      expect(expectedUpdnLine('3호선', '안국', '종로3가')).toBe('1');
    });
    it('3호선 양재 → 매봉 = 하행 (1, 정방향)', () => {
      expect(expectedUpdnLine('3호선', '양재', '매봉')).toBe('1');
    });
    it('4호선 동대문 → 동대문역사문화공원 = 하행 (1)', () => {
      expect(expectedUpdnLine('4호선', '동대문', '동대문역사문화공원')).toBe('1');
    });
    it('4호선 충무로 → 명동 = 하행 (1)', () => {
      expect(expectedUpdnLine('4호선', '충무로', '명동')).toBe('1');
    });
    it('5호선 명일 → 고덕 = 하행 (1)', () => {
      expect(expectedUpdnLine('5호선', '명일', '고덕')).toBe('1');
    });
    it('5호선 송정 → 마곡 = 하행 (1)', () => {
      expect(expectedUpdnLine('5호선', '송정', '마곡')).toBe('1');
    });
    it('6호선 약수 → 청구 = 하행 (1)', () => {
      expect(expectedUpdnLine('6호선', '약수', '청구')).toBe('1');
    });
    it('6호선 태릉입구 → 화랑대 = 하행 (1)', () => {
      expect(expectedUpdnLine('6호선', '태릉입구', '화랑대')).toBe('1');
    });
    it('7호선 노원 → 중계 = 하행 (1)', () => {
      expect(expectedUpdnLine('7호선', '노원', '중계')).toBe('1');
    });
    it('7호선 중계 → 노원 = 상행 (0)', () => {
      expect(expectedUpdnLine('7호선', '중계', '노원')).toBe('0');
    });
    it('8호선 잠실 → 석촌 = 하행 (1)', () => {
      expect(expectedUpdnLine('8호선', '잠실', '석촌')).toBe('1');
    });
    it('9호선 언주 → 선정릉 = 하행 (1)', () => {
      expect(expectedUpdnLine('9호선', '언주', '선정릉')).toBe('1');
    });
    it('9호선 동작 → 구반포 = 하행 (1, 정방향)', () => {
      expect(expectedUpdnLine('9호선', '동작', '구반포')).toBe('1');
    });
  });

  describe('미지원 케이스', () => {
    it('알 수 없는 노선 → null', () => {
      expect(expectedUpdnLine('GTX-A', '서울', '수서')).toBeNull();
    });
    it('알 수 없는 역 → null', () => {
      expect(expectedUpdnLine('2호선', '강남', '없는역')).toBeNull();
    });
  });
});

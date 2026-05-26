// 회귀 방지: brand 매칭. 특히 "서울대" prefix가 "서울대입구역"에 false-positive로
// SNU 상징을 띄우는 케이스 (사용자 회귀 보고 2026-05-27).

import { describe, it, expect } from 'vitest';
import { brandFor } from '../brands';

describe('brandFor', () => {
  describe('SNU false-positive 차단', () => {
    it('"서울대입구역"은 SNU 매칭 X', () => {
      const b = brandFor('서울대입구역');
      expect(b?.id).not.toBe('snu');
    });

    it('"서울대입구역 11번 출구" 등 변형도 SNU 매칭 X', () => {
      expect(brandFor('서울대입구역 11번 출구')?.id).not.toBe('snu');
      expect(brandFor('서울대입구역사거리')?.id).not.toBe('snu');
    });

    it('"서울대학교"는 SNU 매칭 ✓', () => {
      expect(brandFor('서울대학교')?.id).toBe('snu');
    });

    it('"서울대 도서관" (snuPlaceName 포맷)은 SNU 매칭 ✓', () => {
      // snuPlaceName이 "서울대 ${building} (${code}동)" 형태로 출력.
      expect(brandFor('서울대 중앙도서관 (62동)')?.id).toBe('snu');
      expect(brandFor('서울대 학생회관 (63동)')?.id).toBe('snu');
    });

    it('영문 "Seoul National University"도 SNU 매칭 ✓', () => {
      expect(brandFor('Seoul National University')?.id).toBe('snu');
      expect(brandFor('seoul national university campus')?.id).toBe('snu');
    });
  });

  describe('기본 브랜드 매칭', () => {
    it('스타벅스 / 투썸 / 빽다방', () => {
      expect(brandFor('스타벅스 강남점')?.id).toBe('starbucks');
      expect(brandFor('투썸플레이스')?.id).toBe('twosome');
      expect(brandFor('빽다방 신촌점')?.id).toBe('paik');
    });

    it('대학교 — 한양/연세/고려', () => {
      expect(brandFor('한양대학교')?.id).toBe('hanyang');
      expect(brandFor('연세대학교')?.id).toBe('yonsei');
      expect(brandFor('고려대학교')?.id).toBe('ku');
    });
  });

  describe('매칭 안 됨', () => {
    it('빈/일반 텍스트', () => {
      expect(brandFor('')).toBe(null);
      expect(brandFor('아무거나')).toBe(null);
    });
  });
});

// 회귀 방지: QR 코드에 담긴 URL → placeId 추출.
// 외부 사이트 QR로 우리 vote 페이지 진입 못 하게 host 검증.

import { describe, it, expect } from 'vitest';
import { extractPlaceId } from '../qrPlaceId';

describe('extractPlaceId', () => {
  describe('우리 사이트 URL — 추출 OK', () => {
    it('https + 단순 placeId', () => {
      expect(extractPlaceId('https://aircondemocracy.com/p/subway:2:강남')).toBe('subway:2:강남');
    });

    it('http 도 허용 (사용자 폰 일부)', () => {
      expect(extractPlaceId('http://aircondemocracy.com/p/snu:301:401')).toBe('snu:301:401');
    });

    it('www. prefix 허용', () => {
      expect(extractPlaceId('https://www.aircondemocracy.com/p/cafe:1234')).toBe('cafe:1234');
    });

    it('trailing slash 허용', () => {
      expect(extractPlaceId('https://aircondemocracy.com/p/subway:2:강남/')).toBe('subway:2:강남');
    });

    it('query string 무시 (via=qr 등 트래킹 param)', () => {
      expect(extractPlaceId('https://aircondemocracy.com/p/snu:301:401?via=qr')).toBe('snu:301:401');
    });

    it('URL-encoded 한글 정상 decode', () => {
      const encoded = encodeURIComponent('subway:2호선:강남');
      expect(extractPlaceId(`https://aircondemocracy.com/p/${encoded}`)).toBe('subway:2호선:강남');
    });

    it('bus:vehicle 같은 콜론 여러 개 id', () => {
      expect(extractPlaceId('https://aircondemocracy.com/p/bus:vehicle:seoul:R272:V1')).toBe('bus:vehicle:seoul:R272:V1');
    });

    it('venue:gps 좌표 id', () => {
      expect(extractPlaceId('https://aircondemocracy.com/p/venue:gps:37.5663:126.9779')).toBe('venue:gps:37.5663:126.9779');
    });
  });

  describe('외부 사이트 URL — 거부 (security)', () => {
    it('phishing 사이트 같은 이름의 다른 도메인', () => {
      expect(extractPlaceId('https://aircondemocracy.attacker.com/p/foo')).toBeNull();
    });

    it('완전 다른 도메인의 /p/ path', () => {
      expect(extractPlaceId('https://evil.com/p/subway:2:강남')).toBeNull();
    });

    it('비슷한 사이트 (typo squat)', () => {
      expect(extractPlaceId('https://airconndemocracy.com/p/foo')).toBeNull();
    });
  });

  describe('잘못된 입력', () => {
    it('URL 아닌 raw 문자열', () => {
      expect(extractPlaceId('just-a-string')).toBeNull();
    });

    it('빈 문자열', () => {
      expect(extractPlaceId('')).toBeNull();
    });

    it('우리 사이트지만 /p/ path 아닌 다른 경로', () => {
      expect(extractPlaceId('https://aircondemocracy.com/wizard')).toBeNull();
      expect(extractPlaceId('https://aircondemocracy.com/')).toBeNull();
      expect(extractPlaceId('https://aircondemocracy.com/p/')).toBeNull(); // empty placeId
    });

    it('/p/ 하위에 추가 path가 있는 경우 — 거부 (정확히 /p/<id>만)', () => {
      expect(extractPlaceId('https://aircondemocracy.com/p/foo/bar')).toBeNull();
    });
  });
});

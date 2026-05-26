import { describe, it, expect } from 'vitest';
import { buildTrainPlace } from '../buildTrainPlace';

describe('buildTrainPlace', () => {
  it('segment-precise: id encodes operator+line+prev-next+car', () => {
    const p = buildTrainPlace({
      trainCar: 5,
      trainType: null,
      trainDest: '',
      segment: { operator: 'KORAIL', line: 'KTX 경부선', prev: '대전', next: '김천(구미)' },
    });
    expect(p.id).toBe('train:seg:KORAIL:KTX 경부선:대전-김천(구미):5');
    expect(p.name).toBe('KTX 경부선 대전→김천(구미) · 5호차');
    expect(p.detail).toBe('KORAIL · KTX 경부선 · 대전→김천(구미)');
    expect(p.type).toBe('train');
  });

  it('segment-precise + unknown car', () => {
    const p = buildTrainPlace({
      trainCar: 'unknown',
      trainType: null,
      trainDest: '',
      segment: { operator: 'SRT', line: 'SRT', prev: '동탄', next: '평택지제' },
    });
    expect(p.id).toBe('train:seg:SRT:SRT:동탄-평택지제:x');
    expect(p.name).toContain('호차 미정');
  });

  it('type-based with destination', () => {
    const p = buildTrainPlace({
      trainCar: 3,
      trainType: 'KTX',
      trainDest: '부산',
      segment: null,
    });
    expect(p.id).toBe('train:KTX:부산:3');
    expect(p.name).toBe('KTX 3호차 (부산행)');
    expect(p.detail).toBe('KTX · 부산행');
  });

  it('type-based without destination', () => {
    const p = buildTrainPlace({
      trainCar: 7,
      trainType: '무궁화호',
      trainDest: '',
      segment: null,
    });
    expect(p.id).toBe('train:무궁화호:7');
    expect(p.name).toBe('무궁화호 7호차');
    expect(p.detail).toBe('무궁화호');
  });

  it('type-based + unknown car', () => {
    const p = buildTrainPlace({
      trainCar: 'unknown',
      trainType: 'ITX-새마을',
      trainDest: '',
      segment: null,
    });
    expect(p.id).toBe('train:ITX-새마을:x');
    expect(p.name).toBe('ITX-새마을 호차 미정');
  });

  it('segment takes precedence over trainType when both present', () => {
    const p = buildTrainPlace({
      trainCar: 1,
      trainType: 'KTX',
      trainDest: '부산',
      segment: { operator: 'KORAIL', line: '경전선', prev: '진주', next: '마산' },
    });
    expect(p.id).toContain('seg:KORAIL:경전선');
    expect(p.detail).not.toContain('부산');
  });
});

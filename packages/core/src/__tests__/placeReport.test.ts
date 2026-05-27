// 회귀 방지: 장소 정보 신고 schema (2026-05-27 Vote Share Redesign v4).
//
// 백엔드 POST /api/places/:id/report — Zod로 reason enum + 길이 제한.
// 5개 reason 중 하나만 허용, note는 300자 이내 optional.

import { describe, it, expect } from 'vitest';
import { PlaceReportBodySchema, ReportReasonSchema, REPORT_REASONS } from '../validation';

describe('REPORT_REASONS', () => {
  it('정확히 5개 reason', () => {
    expect(REPORT_REASONS.length).toBe(5);
  });

  it('필수 reason들 포함', () => {
    expect(REPORT_REASONS).toContain('not-here');
    expect(REPORT_REASONS).toContain('wrong-name');
    expect(REPORT_REASONS).toContain('duplicate');
    expect(REPORT_REASONS).toContain('delete');
    expect(REPORT_REASONS).toContain('other');
  });
});

describe('ReportReasonSchema', () => {
  it('valid reason accept', () => {
    expect(ReportReasonSchema.safeParse('not-here').success).toBe(true);
    expect(ReportReasonSchema.safeParse('wrong-name').success).toBe(true);
    expect(ReportReasonSchema.safeParse('delete').success).toBe(true);
  });

  it('invalid reason reject', () => {
    expect(ReportReasonSchema.safeParse('spam').success).toBe(false);
    expect(ReportReasonSchema.safeParse('').success).toBe(false);
    expect(ReportReasonSchema.safeParse(null).success).toBe(false);
  });
});

describe('PlaceReportBodySchema', () => {
  it('reason만 — accept (note는 optional)', () => {
    const r = PlaceReportBodySchema.safeParse({ reason: 'not-here' });
    expect(r.success).toBe(true);
  });

  it('reason + note (300자 이내) — accept', () => {
    const r = PlaceReportBodySchema.safeParse({
      reason: 'wrong-name',
      note: '서울대입구역 4번 출구로 수정해주세요',
    });
    expect(r.success).toBe(true);
  });

  it('note 300자 초과 — reject', () => {
    const r = PlaceReportBodySchema.safeParse({
      reason: 'other',
      note: 'a'.repeat(301),
    });
    expect(r.success).toBe(false);
  });

  it('note null — accept (명시적 null)', () => {
    const r = PlaceReportBodySchema.safeParse({ reason: 'duplicate', note: null });
    expect(r.success).toBe(true);
  });

  it('reason 누락 — reject', () => {
    const r = PlaceReportBodySchema.safeParse({ note: '없는 이유' });
    expect(r.success).toBe(false);
  });

  it('invalid reason — reject', () => {
    const r = PlaceReportBodySchema.safeParse({ reason: 'spam' });
    expect(r.success).toBe(false);
  });
});

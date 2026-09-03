import { describe, it, expect } from 'vitest';
import {
  buildShiftWindowUtc,
  createIstDateTime,
  formatTimeIst,
} from '../timezone';

describe('Timezone & Shift Window Engine', () => {
  it('correctly creates an IST datetime', () => {
    const dt = createIstDateTime('2026-06-23', '00:30');
    expect(dt.format('YYYY-MM-DD HH:mm')).toBe('2026-06-23 00:30');
  });

  it('converts IST shift window to UTC ISO string (same-day shift: 00:30 to 12:30 IST)', () => {
    const window = buildShiftWindowUtc('2026-06-23', '00:30', '12:30');

    // 2026-06-23 00:30 IST is 2026-06-22 19:00:00 UTC (5.5 hours behind)
    expect(window.from_ts).toBe('2026-06-22T19:00:00.000Z');

    // 2026-06-23 12:30 IST is 2026-06-23 07:00:00 UTC
    expect(window.to_ts).toBe('2026-06-23T07:00:00.000Z');
  });

  it('handles shift crossing midnight into next day (12:30 to 00:30 IST)', () => {
    const window = buildShiftWindowUtc('2026-06-23', '12:30', '00:30');

    // 2026-06-23 12:30 IST => 2026-06-23 07:00:00 UTC
    expect(window.from_ts).toBe('2026-06-23T07:00:00.000Z');

    // Crosses midnight to 2026-06-24 00:30 IST => 2026-06-23 19:00:00 UTC
    expect(window.to_ts).toBe('2026-06-23T19:00:00.000Z');
  });

  it('correctly converts UTC response timestamps to IST clock time', () => {
    const utcTime = '2026-06-23T07:03:56Z';
    // 07:03:56 UTC + 5:30 => 12:33:56 IST
    const istTime = formatTimeIst(utcTime);
    expect(istTime).toBe('12:33');
  });
});

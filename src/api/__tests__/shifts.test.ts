import { describe, it, expect } from 'vitest';
import { parseShiftIntervals } from '../shifts';
import { RawShift } from '../../types/shift';

describe('Shift Parsing Engine', () => {
  it('parses dynamic shift start times without hardcoded letters', () => {
    const rawShifts: RawShift[] = [
      {
        id: 'shift-1',
        code: 'main',
        name: 'main',
        shift_timings: ['00:30', '12:30'],
        is_active: true,
      },
    ];

    const intervals = parseShiftIntervals(rawShifts);
    expect(intervals.length).toBe(2);

    expect(intervals[0].startTime).toBe('00:30');
    expect(intervals[0].endTime).toBe('12:30');
    expect(intervals[0].crossesMidnight).toBe(false);

    expect(intervals[1].startTime).toBe('12:30');
    expect(intervals[1].endTime).toBe('00:30');
    expect(intervals[1].crossesMidnight).toBe(true);
  });

  it('handles 3 consecutive 8-hour shifts', () => {
    const rawShifts: RawShift[] = [
      {
        id: 'shift-3way',
        code: 'three_shifts',
        name: 'Standard 3 Shifts',
        shift_timings: ['06:00', '14:00', '22:00'],
        is_active: true,
      },
    ];

    const intervals = parseShiftIntervals(rawShifts);
    expect(intervals.length).toBe(3);
    expect(intervals[0].startTime).toBe('06:00');
    expect(intervals[0].endTime).toBe('14:00');

    expect(intervals[1].startTime).toBe('14:00');
    expect(intervals[1].endTime).toBe('22:00');

    expect(intervals[2].startTime).toBe('22:00');
    expect(intervals[2].endTime).toBe('06:00');
    expect(intervals[2].crossesMidnight).toBe(true);
  });
});

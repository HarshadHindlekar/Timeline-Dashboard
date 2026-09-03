import { apiClient } from './client';
import { RawShift, ParsedShiftInterval } from '../types/shift';

export async function getShifts(): Promise<RawShift[]> {
  return (await apiClient.get('/core/shifts')) as unknown as RawShift[];
}

/**
 * Parses raw shift objects into individual shift intervals.
 * Note: shift_timings are shift START times in HH:MM IST.
 * Each entry runs until the next; the last wraps around to the first.
 * E.g. ['00:30', '12:30'] produces two shifts: 00:30-12:30 and 12:30-00:30.
 */
export function parseShiftIntervals(rawShifts: RawShift[]): ParsedShiftInterval[] {
  const intervals: ParsedShiftInterval[] = [];

  for (const shift of rawShifts) {
    if (!shift.is_active || !shift.shift_timings || shift.shift_timings.length === 0) {
      continue;
    }

    const timings = shift.shift_timings;
    const count = timings.length;

    for (let i = 0; i < count; i++) {
      const startTime = timings[i];
      const endTime = timings[(i + 1) % count];
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      const crossesMidnight = endMins <= startMins;

      const shiftLetter = String.fromCharCode(65 + i); // Shift A, Shift B, etc.
      intervals.push({
        id: `${shift.id}-${i}`,
        shiftDefinitionId: shift.id,
        code: shift.code,
        name: `Shift ${shiftLetter} (${startTime} – ${endTime})`,
        startTime,
        endTime,
        crossesMidnight,
      });
    }
  }

  return intervals;
}

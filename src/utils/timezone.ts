import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Parses an IST date string (YYYY-MM-DD) and a time string (HH:MM) into a dayjs object in IST.
 */
export function createIstDateTime(dateStr: string, timeStr: string): dayjs.Dayjs {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return dayjs.tz(`${dateStr} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`, IST_TIMEZONE);
}

/**
 * Builds the shift time range in UTC (ISO string with Z) from an IST date and shift start/end times.
 * If endTime <= startTime, the shift crosses midnight into the next day in IST.
 */
export function buildShiftWindowUtc(dateStr: string, startTimeStr: string, endTimeStr: string): {
  from_ts: string;
  to_ts: string;
  startIst: dayjs.Dayjs;
  endIst: dayjs.Dayjs;
} {
  const startIst = createIstDateTime(dateStr, startTimeStr);
  let endIst = createIstDateTime(dateStr, endTimeStr);

  // If end time is before or equal to start time, it crosses midnight in IST
  if (endIst.isBefore(startIst) || endIst.isSame(startIst)) {
    endIst = endIst.add(1, 'day');
  }

  return {
    from_ts: startIst.utc().toISOString(),
    to_ts: endIst.utc().toISOString(),
    startIst,
    endIst,
  };
}

/**
 * Formats a UTC or ISO timestamp into IST time (HH:mm).
 */
export function formatTimeIst(timestamp: string | number | Date): string {
  return dayjs(timestamp).tz(IST_TIMEZONE).format('HH:mm');
}

/**
 * Formats a timestamp into IST full date & time (e.g. "23 Jun, 07:39:37").
 */
export function formatDateTimeIst(timestamp: string | number | Date): string {
  return dayjs(timestamp).tz(IST_TIMEZONE).format('DD MMM, HH:mm:ss');
}

/**
 * Formats a date for badge display (e.g. "23 Jun, 00:30 - 23 Jun, 12:30").
 */
export function formatShiftRangeBadge(startIst: dayjs.Dayjs, endIst: dayjs.Dayjs): string {
  return `${startIst.format('DD MMM, HH:mm')} – ${endIst.format('DD MMM, HH:mm')}`;
}

/**
 * Returns current timestamp in IST.
 */
export function getNowIst(): dayjs.Dayjs {
  return dayjs().tz(IST_TIMEZONE);
}

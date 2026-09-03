import dayjs from 'dayjs';
import {
  MachineIntervalsData,
  CycleTimeHourlyBucket,
  HourlySummaryColumn,
} from '../types/analytics';
import { getNowIst } from './timezone';

export interface HourMetrics {
  totalProduces: number | null;
  passProduces: number | null;
  failProduces: number | null;
  actualCycleTime: string | null;
  idealCycleTime: string | null;
  runtimeMins: number | null;
  plannedDowntimeMins: number | null;
  minorStoppageMins: number | null;
  unknownDowntimeMins: number | null;
  unplannedDowntimeMins: number | null;
  unplannedProductionMins: number | null;
  unknownUnplannedProductionMins: number | null;
  isFuture: boolean;
}

/**
 * Builds hourly columns for a given shift window.
 * Columns start from shift start time and proceed in 1-hour increments.
 */
export function buildHourlyColumns(
  startIst: dayjs.Dayjs,
  endIst: dayjs.Dayjs
): HourlySummaryColumn[] {
  const columns: HourlySummaryColumn[] = [];
  const nowIst = getNowIst();

  let currStart = startIst;
  let index = 0;

  while (currStart.isBefore(endIst)) {
    let currEnd = currStart.add(1, 'hour');
    if (currEnd.isAfter(endIst)) {
      currEnd = endIst;
    }

    const startIstStr = currStart.format('HH:mm');
    const endIstStr = currEnd.format('HH:mm');

    columns.push({
      bucketIndex: index,
      label: `${startIstStr} - ${endIstStr}`,
      startIst: currStart.toISOString(),
      endIst: currEnd.toISOString(),
      startUtc: currStart.utc().toISOString(),
      endUtc: currEnd.utc().toISOString(),
      isFuture: currStart.isAfter(nowIst),
    });

    currStart = currEnd;
    index++;
  }

  return columns;
}

/**
 * Categorizes a segment based on its properties.
 */
export function categorizeSegment(
  seg: { type?: string; runtime_name?: string | null; downtime_name?: string | null },
  source: 'runtime' | 'downtime' | 'stoppage'
):
  | 'runtime'
  | 'unknown_unplanned_production'
  | 'unplanned_production'
  | 'planned_downtime'
  | 'unplanned_downtime'
  | 'unknown_downtime'
  | 'minor_stoppage' {
  const typeLower = (seg.type || '').toLowerCase();
  const nameLower = (seg.runtime_name || seg.downtime_name || '').toLowerCase();

  if (source === 'runtime') {
    if (typeLower.includes('unknown unplanned production')) {
      return 'unknown_unplanned_production';
    }
    if (typeLower.includes('unplanned')) {
      return 'unplanned_production';
    }
    return 'runtime';
  }

  if (source === 'downtime') {
    if (typeLower === 'unknown' || nameLower === 'unknown') {
      return 'unknown_downtime';
    }
    if (typeLower.includes('planned') || nameLower.includes('planned') || nameLower.includes('break')) {
      return 'planned_downtime';
    }
    return 'unplanned_downtime';
  }

  return 'minor_stoppage';
}

/**
 * Computes the aggregated metrics for each hourly column.
 */
export function aggregateHourlyData(
  columns: HourlySummaryColumn[],
  intervals: MachineIntervalsData | null | undefined,
  cycleTimes: CycleTimeHourlyBucket[] | null | undefined
): HourMetrics[] {
  if (!columns.length) return [];

  const runtimes = intervals?.runtimes || [];
  const downtimes = intervals?.downtimes || [];
  const stoppages = intervals?.stoppages || [];
  const produceCounts = intervals?.produce_counts || [];

  return columns.map((col) => {
    // If the hour is completely in the future, return blank values
    if (col.isFuture) {
      return {
        totalProduces: null,
        passProduces: null,
        failProduces: null,
        actualCycleTime: null,
        idealCycleTime: null,
        runtimeMins: null,
        plannedDowntimeMins: null,
        minorStoppageMins: null,
        unknownDowntimeMins: null,
        unplannedDowntimeMins: null,
        unplannedProductionMins: null,
        unknownUnplannedProductionMins: null,
        isFuture: true,
      };
    }

    const colStartMs = dayjs(col.startIst).valueOf();
    const colEndMs = dayjs(col.endIst).valueOf();

    let runtimeMins = 0;
    let unknownUnplannedMins = 0;
    let unplannedProdMins = 0;
    let plannedDowntimeMins = 0;
    let unplannedDowntimeMins = 0;
    let unknownDowntimeMins = 0;
    let minorStoppageMins = 0;

    // Helper to calculate overlap in minutes
    const addSegmentOverlap = (
      startAt: string,
      endAt: string,
      category: ReturnType<typeof categorizeSegment>
    ) => {
      const segStartMs = dayjs(startAt).valueOf();
      const segEndMs = dayjs(endAt).valueOf();

      const overlapStart = Math.max(segStartMs, colStartMs);
      const overlapEnd = Math.min(segEndMs, colEndMs);

      if (overlapEnd > overlapStart) {
        const mins = (overlapEnd - overlapStart) / (1000 * 60);
        switch (category) {
          case 'runtime':
            runtimeMins += mins;
            break;
          case 'unknown_unplanned_production':
            unknownUnplannedMins += mins;
            break;
          case 'unplanned_production':
            unplannedProdMins += mins;
            break;
          case 'planned_downtime':
            plannedDowntimeMins += mins;
            break;
          case 'unplanned_downtime':
            unplannedDowntimeMins += mins;
            break;
          case 'unknown_downtime':
            unknownDowntimeMins += mins;
            break;
          case 'minor_stoppage':
            minorStoppageMins += mins;
            break;
        }
      }
    };

    // Process runtimes
    for (const seg of runtimes) {
      const cat = categorizeSegment(seg, 'runtime');
      addSegmentOverlap(seg.start_at, seg.end_at, cat);
    }

    // Process downtimes
    for (const seg of downtimes) {
      const cat = categorizeSegment(seg, 'downtime');
      addSegmentOverlap(seg.start_at, seg.end_at, cat);
    }

    // Process stoppages
    for (const seg of stoppages) {
      const cat = categorizeSegment(seg, 'stoppage');
      addSegmentOverlap(seg.start_at, seg.end_at, cat);
    }

    // Aggregate produce counts
    let passCount = 0;
    let failCount = 0;
    let hasProduces = false;

    for (const countItem of produceCounts) {
      const bucketMs = dayjs(countItem.bucket_start).valueOf();
      // Bucket start falls within this column's interval
      if (bucketMs >= colStartMs && bucketMs < colEndMs) {
        passCount += countItem.ok_count || 0;
        failCount += countItem.ng_count || 0;
        hasProduces = true;
      }
    }

    // Match cycle times
    let actualCycleTimeStr: string | null = null;
    let idealCycleTimeStr: string | null = null;

    if (cycleTimes) {
      for (const ct of cycleTimes) {
        const ctBucketMs = dayjs(ct.bucket_start).valueOf();
        if (ctBucketMs >= colStartMs && ctBucketMs < colEndMs) {
          if (ct.actual_cycle_time_seconds !== null && ct.actual_cycle_time_seconds !== undefined) {
            actualCycleTimeStr = formatCycleTime(ct.actual_cycle_time_seconds);
          }
          if (ct.ideal_cycle_time_seconds !== null && ct.ideal_cycle_time_seconds !== undefined) {
            idealCycleTimeStr = `${Math.round(ct.ideal_cycle_time_seconds)} secs`;
          }
          break;
        }
      }
    }

    return {
      totalProduces: hasProduces ? passCount + failCount : 0,
      passProduces: hasProduces ? passCount : 0,
      failProduces: hasProduces ? failCount : 0,
      actualCycleTime: actualCycleTimeStr,
      idealCycleTime: idealCycleTimeStr,
      runtimeMins: Math.round(runtimeMins * 10) / 10,
      plannedDowntimeMins: Math.round(plannedDowntimeMins * 10) / 10,
      minorStoppageMins: Math.round(minorStoppageMins * 10) / 10,
      unknownDowntimeMins: Math.round(unknownDowntimeMins * 10) / 10,
      unplannedDowntimeMins: Math.round(unplannedDowntimeMins * 10) / 10,
      unplannedProductionMins: Math.round(unplannedProdMins * 10) / 10,
      unknownUnplannedProductionMins: Math.round(unknownUnplannedMins * 10) / 10,
      isFuture: false,
    };
  });
}

/**
 * Formats cycle time in seconds into readable "X.X mins" or "X secs".
 */
export function formatCycleTime(seconds: number): string {
  if (seconds >= 60) {
    return `${(seconds / 60).toFixed(1)} mins`;
  }
  return `${Math.round(seconds)} secs`;
}

import { useMemo } from 'react';
import dayjs from 'dayjs';
import { MachineIntervalsData } from '../../../types/analytics';
import { ProcessedProduce, ProcessedSegment } from '../../../types/chart';
import { SEGMENT_COLORS } from '../TimelineLegend';
import { categorizeSegment } from '../../../utils/segmentSlicer';

export interface CumulativePoint {
  epochMs: number;
  cumulative: number;
  isFlatExtension?: boolean;
}

export interface YAxisConfig {
  yMax: number;
  ticks: number[];
}

export const useTimelineData = (
  intervals: MachineIntervalsData | null | undefined,
  defaultRange: { startMs: number; endMs: number },
  showIndividualProduces: boolean
) => {
  // 1. Preprocess and sort all individual produces once, assigning cumulative index
  const sortedProduces = useMemo<ProcessedProduce[]>(() => {
    if (!intervals?.produces || intervals.produces.length === 0) return [];

    const rawList: {
      id: string;
      epochMs: number;
      result: 'PASS' | 'FAIL';
      partModelId: string;
      produceType: string;
    }[] = [];

    for (const group of intervals.produces) {
      if (group.produces) {
        for (const p of group.produces) {
          rawList.push({
            id: p.produce_id,
            epochMs: dayjs(p.first_seen_ts).valueOf(),
            result: p.result,
            partModelId: p.part_model_id,
            produceType: p.produce_type,
          });
        }
      }
    }

    rawList.sort((a, b) => a.epochMs - b.epochMs);

    return rawList.map((p, idx) => ({
      ...p,
      cumulativeIndex: idx + 1,
    }));
  }, [intervals?.produces]);

  // 2. Determine last observed produce or segment timestamp
  const lastActiveTimestampMs = useMemo(() => {
    let latest = 0;
    if (sortedProduces.length > 0) {
      latest = sortedProduces[sortedProduces.length - 1].epochMs;
    } else if (intervals?.produce_counts && intervals.produce_counts.length > 0) {
      for (const pc of intervals.produce_counts) {
        const endMs = dayjs(pc.bucket_start).valueOf() + 3600000;
        if (endMs > latest) latest = endMs;
      }
    }

    if (intervals?.runtimes) {
      for (const r of intervals.runtimes) {
        const ms = dayjs(r.end_at).valueOf();
        if (ms > latest) latest = ms;
      }
    }

    return latest > 0 ? latest : null;
  }, [sortedProduces, intervals]);

  // 3. Preprocess segments with clean titles (matching mockup)
  const processedSegments = useMemo<ProcessedSegment[]>(() => {
    if (!intervals) return [];
    const list: ProcessedSegment[] = [];

    // Clip limit for in-progress shifts: do not draw beyond last observed timestamp
    const clipLimitMs = lastActiveTimestampMs
      ? Math.min(defaultRange.endMs, lastActiveTimestampMs)
      : defaultRange.endMs;

    // Runtimes
    for (const r of intervals.runtimes || []) {
      const segStart = dayjs(r.start_at).valueOf();
      const segEnd = Math.min(dayjs(r.end_at).valueOf(), clipLimitMs);
      if (segEnd <= segStart) continue;

      const cat = categorizeSegment(r, 'runtime');
      const isUnplanned = cat === 'unknown_unplanned_production';
      list.push({
        startMs: segStart,
        endMs: segEnd,
        type: r.type,
        title: isUnplanned ? 'UNKNOWN UNPLANNED PRODUCTION' : 'RUNTIME',
        color: isUnplanned ? SEGMENT_COLORS.unplannedProduction : SEGMENT_COLORS.runtime,
      });
    }

    // Downtimes
    for (const d of intervals.downtimes || []) {
      const segStart = dayjs(d.start_at).valueOf();
      const segEnd = Math.min(dayjs(d.end_at).valueOf(), clipLimitMs);
      if (segEnd <= segStart) continue;

      const cat = categorizeSegment(d, 'downtime');
      const isUnknown = cat === 'unknown_downtime';
      const nameUpper = (d.downtime_name || '').toUpperCase();
      let title = isUnknown ? 'UNKNOWN' : 'DOWNTIME';
      if (nameUpper.includes('TEA')) title = 'TEA BREAK';
      else if (nameUpper.includes('LUNCH')) title = 'LUNCH BREAK';
      else if (nameUpper.includes('PLANNED')) title = 'PLANNED DOWNTIME';

      list.push({
        startMs: segStart,
        endMs: segEnd,
        type: d.type,
        title,
        color: isUnknown ? SEGMENT_COLORS.unknownDowntime : SEGMENT_COLORS.plannedDowntime,
      });
    }

    // Stoppages
    for (const s of intervals.stoppages || []) {
      const segStart = dayjs(s.start_at).valueOf();
      const segEnd = Math.min(dayjs(s.end_at).valueOf(), clipLimitMs);
      if (segEnd <= segStart) continue;

      list.push({
        startMs: segStart,
        endMs: segEnd,
        type: 'stoppage',
        title: 'STOPPAGE',
        color: SEGMENT_COLORS.minorStoppage,
      });
    }

    return list.sort((a, b) => a.startMs - b.startMs);
  }, [intervals, lastActiveTimestampMs, defaultRange.endMs]);

  // 4. Precompute cumulative line points
  const cumulativePoints = useMemo<CumulativePoint[]>(() => {
    if (!intervals?.produce_counts || intervals.produce_counts.length === 0) return [];

    const bucketsMap = new Map<number, number>();
    for (const count of intervals.produce_counts) {
      const ms = dayjs(count.bucket_start).valueOf();
      const current = bucketsMap.get(ms) || 0;
      bucketsMap.set(ms, current + (count.ok_count || 0) + (count.ng_count || 0));
    }

    const sortedBuckets = Array.from(bucketsMap.entries()).sort((a, b) => a[0] - b[0]);

    let runningTotal = 0;
    const points: CumulativePoint[] = [];

    // Point at shift start: 0
    points.push({ epochMs: defaultRange.startMs, cumulative: 0 });

    for (const [startMs, count] of sortedBuckets) {
      runningTotal += count;
      const endMs = Math.min(startMs + 3600000, defaultRange.endMs);
      points.push({ epochMs: endMs, cumulative: runningTotal });
    }

    // Extend line horizontally flat across the gray screen to shift end (matching mockup!)
    if (lastActiveTimestampMs && lastActiveTimestampMs < defaultRange.endMs && points.length > 0) {
      const lastPt = points[points.length - 1];
      if (lastPt.epochMs < defaultRange.endMs) {
        points.push({
          epochMs: defaultRange.endMs,
          cumulative: lastPt.cumulative,
          isFlatExtension: true,
        });
      }
    }

    return points;
  }, [intervals?.produce_counts, defaultRange.startMs, defaultRange.endMs, lastActiveTimestampMs]);

  // 5. Y Scale matching mockup: 0, 250, 500
  const yAxisConfig = useMemo<YAxisConfig>(() => {
    let highest = 0;
    if (showIndividualProduces && sortedProduces.length > 0) {
      highest = sortedProduces.length;
    } else if (cumulativePoints.length > 0) {
      highest = Math.max(...cumulativePoints.map((p) => p.cumulative));
    }

    if (highest <= 470) {
      return { yMax: 500, ticks: [0, 250, 500] };
    } else if (highest <= 700) {
      return { yMax: 750, ticks: [0, 250, 500, 750] };
    } else {
      const step = 500;
      const yMax = Math.ceil((highest * 1.15) / step) * step;
      const ticks = [0, Math.round(yMax / 2), yMax];
      return { yMax, ticks };
    }
  }, [showIndividualProduces, sortedProduces.length, cumulativePoints]);

  return {
    sortedProduces,
    lastActiveTimestampMs,
    processedSegments,
    cumulativePoints,
    yAxisConfig,
  };
};

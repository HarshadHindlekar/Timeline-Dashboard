import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  Box,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  Chip,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { MachineIntervalsData } from '../../types/analytics';
import { HoverTooltipData, TimelineTooltip } from './TimelineTooltip';
import { SEGMENT_COLORS } from './TimelineLegend';
import { formatTimeIst, formatDateTimeIst } from '../../utils/timezone';
import { categorizeSegment } from '../../utils/segmentSlicer';

interface TimelineCanvasProps {
  intervals: MachineIntervalsData | null | undefined;
  windowStartUtc: string;
  windowEndUtc: string;
  showIndividualProduces: boolean;
  showPointLabels: boolean;
}

interface ProcessedProduce {
  id: string;
  epochMs: number;
  result: 'PASS' | 'FAIL';
  partModelId: string;
  produceType: string;
  cumulativeIndex: number;
}

interface ProcessedSegment {
  startMs: number;
  endMs: number;
  type: string;
  title: string;
  color: string;
}

export const TimelineCanvas: React.FC<TimelineCanvasProps> = ({
  intervals,
  windowStartUtc,
  windowEndUtc,
  showIndividualProduces,
  showPointLabels,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas dimensions
  const [dimensions, setDimensions] = useState({ width: 1000, height: 320 });

  // Zoom range state [startMs, endMs]
  const defaultRange = useMemo(() => {
    const s = dayjs(windowStartUtc).valueOf();
    const e = dayjs(windowEndUtc).valueOf();
    return { startMs: s, endMs: e };
  }, [windowStartUtc, windowEndUtc]);

  const [zoomRange, setZoomRange] = useState<{ startMs: number; endMs: number }>(defaultRange);

  useEffect(() => {
    setZoomRange(defaultRange);
  }, [defaultRange]);

  const isZoomed = useMemo(() => {
    return zoomRange.startMs !== defaultRange.startMs || zoomRange.endMs !== defaultRange.endMs;
  }, [zoomRange, defaultRange]);

  // Drag selection state for brush zoom
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; currentX: number } | null>(null);

  // Tooltip state
  const [tooltipData, setTooltipData] = useState<HoverTooltipData | null>(null);

  // Padding: generous bottom padding to support the gap between chart and X-axis
  const padding = useMemo(() => ({ top: 35, right: 35, bottom: 65, left: 55 }), []);
  const axisGap = 16; // 16px white gap between bottom of chart and the X-axis baseline (matching mockup)

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

  // Determine last observed produce or segment timestamp
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

  // 2. Preprocess segments with clean titles (matching mockup 2 & 3)
  const processedSegments = useMemo<ProcessedSegment[]>(() => {
    if (!intervals) return [];
    const list: ProcessedSegment[] = [];

    // Clip limit for in-progress shifts: do not draw beyond last observed timestamp
    const clipLimitMs = lastActiveTimestampMs ? Math.min(defaultRange.endMs, lastActiveTimestampMs) : defaultRange.endMs;

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

  // 3. Precompute cumulative line points
  const cumulativePoints = useMemo(() => {
    if (!intervals?.produce_counts || intervals.produce_counts.length === 0) return [];

    const bucketsMap = new Map<number, number>();
    for (const count of intervals.produce_counts) {
      const ms = dayjs(count.bucket_start).valueOf();
      const current = bucketsMap.get(ms) || 0;
      bucketsMap.set(ms, current + (count.ok_count || 0) + (count.ng_count || 0));
    }

    const sortedBuckets = Array.from(bucketsMap.entries()).sort((a, b) => a[0] - b[0]);

    let runningTotal = 0;
    const points: { epochMs: number; cumulative: number; isFlatExtension?: boolean }[] = [];

    // Point at shift start: 0
    points.push({ epochMs: defaultRange.startMs, cumulative: 0 });

    for (const [startMs, count] of sortedBuckets) {
      runningTotal += count;
      // Clamp endMs strictly to shift end (so half-hour final buckets never overshoot 19:00!)
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

  // Y Scale matching mockup: 0, 250, 500
  const yAxisConfig = useMemo(() => {
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

  // Zoom control helpers
  const handleZoomIn = () => {
    const span = zoomRange.endMs - zoomRange.startMs;
    const centerMs = (zoomRange.startMs + zoomRange.endMs) / 2;
    const newSpan = Math.max(60 * 1000 * 15, span * 0.65); // minimum 15 mins
    const newStart = Math.max(defaultRange.startMs, centerMs - newSpan / 2);
    const newEnd = Math.min(defaultRange.endMs, newStart + newSpan);
    setZoomRange({ startMs: Math.round(newStart), endMs: Math.round(newEnd) });
  };

  const handleZoomOut = () => {
    const span = zoomRange.endMs - zoomRange.startMs;
    const centerMs = (zoomRange.startMs + zoomRange.endMs) / 2;
    const newSpan = Math.min(defaultRange.endMs - defaultRange.startMs, span * 1.5);
    let newStart = centerMs - newSpan / 2;
    let newEnd = newStart + newSpan;
    if (newStart < defaultRange.startMs) {
      newStart = defaultRange.startMs;
      newEnd = Math.min(defaultRange.endMs, newStart + newSpan);
    }
    if (newEnd > defaultRange.endMs) {
      newEnd = defaultRange.endMs;
      newStart = Math.max(defaultRange.startMs, newEnd - newSpan);
    }
    setZoomRange({ startMs: Math.round(newStart), endMs: Math.round(newEnd) });
  };

  const handleResetZoom = () => {
    setZoomRange(defaultRange);
  };

  const handleZoomPreset = (hours: number) => {
    const spanMs = hours * 3600000;
    const startMs = defaultRange.startMs;
    const endMs = Math.min(defaultRange.endMs, startMs + spanMs);
    setZoomRange({ startMs, endMs });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const chartW = dimensions.width - padding.left - padding.right;
    if (mouseX < padding.left || mouseX > padding.left + chartW) return;

    const span = zoomRange.endMs - zoomRange.startMs;
    const mouseRatio = (mouseX - padding.left) / chartW;
    const centerMs = zoomRange.startMs + mouseRatio * span;

    const zoomFactor = e.deltaY < 0 ? 0.75 : 1.35;
    const newSpan = Math.max(60 * 1000 * 10, Math.min(defaultRange.endMs - defaultRange.startMs, span * zoomFactor));

    let newStart = centerMs - mouseRatio * newSpan;
    let newEnd = newStart + newSpan;

    if (newStart < defaultRange.startMs) {
      newStart = defaultRange.startMs;
      newEnd = Math.min(defaultRange.endMs, newStart + newSpan);
    }
    if (newEnd > defaultRange.endMs) {
      newEnd = defaultRange.endMs;
      newStart = Math.max(defaultRange.startMs, newEnd - newSpan);
    }

    setZoomRange({ startMs: Math.round(newStart), endMs: Math.round(newEnd) });
  };

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        setDimensions({
          width: Math.max(clientWidth, 600),
          height: 320,
        });
      }
    };

    handleResize();
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const { width, height } = dimensions;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Clear whole canvas to crisp white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Helpers to project time to X and count to Y
    const timeToX = (ms: number): number => {
      const span = zoomRange.endMs - zoomRange.startMs;
      if (span <= 0) return padding.left;
      const rawX = padding.left + ((ms - zoomRange.startMs) / span) * chartW;
      return Math.max(padding.left, Math.min(padding.left + chartW, rawX));
    };

    const countToY = (count: number): number => {
      if (yAxisConfig.yMax <= 0) return padding.top + chartH;
      return padding.top + chartH - (count / yAxisConfig.yMax) * chartH;
    };

    // 1. Draw Chart Box Background (White active area + Light gray screen for future un-elapsed time)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding.left, padding.top, chartW, chartH);

    if (lastActiveTimestampMs && lastActiveTimestampMs < defaultRange.endMs) {
      const nowX = timeToX(lastActiveTimestampMs);
      const futureW = padding.left + chartW - nowX;
      if (futureW > 0) {
        ctx.fillStyle = '#f1f5f9'; // Light gray future screen matching mockup
        ctx.fillRect(nowX, padding.top, futureW, chartH);
      }
    }

    // 2. Draw segment bands inside chart area clip
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartW, chartH);
    ctx.clip();

    for (const seg of processedSegments) {
      const x1 = Math.max(timeToX(seg.startMs), padding.left);
      const x2 = Math.min(timeToX(seg.endMs), padding.left + chartW);
      const segW = x2 - x1;

      if (segW > 0) {
        ctx.fillStyle = seg.color;
        ctx.fillRect(x1, padding.top, segW, chartH);

        // Vertical label only if wide enough to be readable (>= 34px)
        if (segW >= 34) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 9.5px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          ctx.shadowBlur = 2.5;

          const textX = x1 + segW / 2;
          const textY = padding.top + chartH / 2;
          ctx.translate(textX, textY);
          ctx.rotate(-Math.PI / 2);

          ctx.fillText(seg.title, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.restore(); // END SEGMENT CLIP

    // 3. Draw Chart Box Outline & Horizontal Grid Lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, chartW, chartH);

    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const val of yAxisConfig.ticks) {
      const y = countToY(val);

      ctx.fillStyle = '#64748b';
      ctx.fillText(String(val), padding.left - 10, y);

      if (val > 0 && val < yAxisConfig.yMax) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
      }
    }

    // Y Axis Title: Cumulative production (above top left)
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cumulative production', padding.left, padding.top - 14);

    // 4. Draw Cumulative Line or Individual Produces
    if (!showIndividualProduces) {
      // MODE: Cumulative Line (Mockup 3 / SS 2)
      if (cumulativePoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';

        let first = true;
        for (const pt of cumulativePoints) {
          const x = timeToX(pt.epochMs);
          const y = countToY(pt.cumulative);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        for (const pt of cumulativePoints) {
          if (pt.isFlatExtension) continue;
          const x = timeToX(pt.epochMs);
          const y = countToY(pt.cumulative);

          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#2563eb';
          ctx.stroke();

          if (showPointLabels) {
            const labelText = String(pt.cumulative);
            ctx.font = 'bold 9.5px Inter, sans-serif';
            const textWidth = ctx.measureText(labelText).width;
            const badgeW = textWidth + 10;
            const badgeH = 15;

            let badgeX = x + 6;
            if (badgeX + badgeW > padding.left + chartW) {
              badgeX = x - badgeW - 6;
            }
            let badgeY = y - 7.5;
            if (badgeY < padding.top + 2) {
              badgeY = y + 7;
            } else if (badgeY + badgeH > padding.top + chartH - 2) {
              badgeY = y - badgeH - 4;
            }

            ctx.fillStyle = '#1976d2';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3.5);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, badgeX + badgeW / 2, badgeY + badgeH / 2);
          }
        }
      }
    } else {
      // MODE: Individual Produces ON (Mockup 4)
      const passBins = new Map<number, ProcessedProduce>();
      const visibleFails: ProcessedProduce[] = [];

      for (let i = 0; i < sortedProduces.length; i++) {
        const p = sortedProduces[i];
        if (p.epochMs < zoomRange.startMs || p.epochMs > zoomRange.endMs) {
          continue;
        }

        if (p.result === 'FAIL') {
          visibleFails.push(p);
        } else {
          // Adaptive binning based on zoom level
          const px = Math.floor(timeToX(p.epochMs) * 2) / 2;
          if (!passBins.has(px)) {
            passBins.set(px, p);
          }
        }
      }

      // PASS markers (Circles with blue stroke and white fill)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1.5;

      passBins.forEach((p) => {
        const x = timeToX(p.epochMs);
        const y = countToY(p.cumulativeIndex);

        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // FAIL markers (Red Crosses '✕')
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 2.5;
      for (const p of visibleFails) {
        const x = timeToX(p.epochMs);
        const y = countToY(p.cumulativeIndex);

        const size = 5.5;
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.stroke();
      }
    }

    // 5. Draw "NOW" Indicator Line & Badge
    if (lastActiveTimestampMs && lastActiveTimestampMs < defaultRange.endMs) {
      if (lastActiveTimestampMs >= zoomRange.startMs && lastActiveTimestampMs <= zoomRange.endMs) {
        const nowX = timeToX(lastActiveTimestampMs);

        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nowX, padding.top);
        ctx.lineTo(nowX, padding.top + chartH);
        ctx.stroke();

        ctx.fillStyle = '#1976d2';
        ctx.beginPath();
        ctx.roundRect(nowX - 17, padding.top - 22, 34, 16, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NOW', nowX, padding.top - 14);
      }
    }

    // 6. Draw X-Axis Baseline & Ticks (WITH THE 16px GAP MATCHING MOCKUP!)
    const axisY = padding.top + chartH + axisGap;

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padding.left, axisY);
    ctx.lineTo(padding.left + chartW, axisY);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const startIst = dayjs(zoomRange.startMs);
    const endIst = dayjs(zoomRange.endMs);
    const totalViewHours = endIst.diff(startIst, 'minute') / 60;

    // Dynamically calculate ticks based on current zoom range
    const tickMoments: dayjs.Dayjs[] = [startIst];
    const stepHours = totalViewHours <= 2 ? 0.5 : totalViewHours <= 5 ? 1 : 2;

    if (totalViewHours >= 1) {
      let cursor = startIst.add(stepHours, 'hour');
      while (cursor.isBefore(endIst.subtract(stepHours * 0.4, 'hour'))) {
        tickMoments.push(cursor);
        cursor = cursor.add(stepHours, 'hour');
      }
    }
    tickMoments.push(endIst);

    for (const tick of tickMoments) {
      const tickMs = tick.valueOf();
      const x = timeToX(tickMs);

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, axisY + 6);
      ctx.stroke();

      ctx.fillText(formatTimeIst(tickMs), x, axisY + 9);
    }

    // X Axis Subtitle: Shift time
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isZoomed
        ? `Viewing ${formatTimeIst(zoomRange.startMs)} – ${formatTimeIst(zoomRange.endMs)} (Double-click to reset)`
        : 'Shift time',
      padding.left + chartW / 2,
      axisY + 28
    );

    // 7. Brush Zoom Selection Box
    if (isSelecting && selectionBox) {
      const selX1 = Math.min(selectionBox.startX, selectionBox.currentX);
      const selW = Math.abs(selectionBox.currentX - selectionBox.startX);

      ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.fillRect(selX1, padding.top, selW, chartH);
      ctx.strokeRect(selX1, padding.top, selW, chartH);
    }
  }, [
    dimensions,
    padding,
    axisGap,
    zoomRange,
    isZoomed,
    processedSegments,
    sortedProduces,
    cumulativePoints,
    yAxisConfig,
    showIndividualProduces,
    showPointLabels,
    isSelecting,
    selectionBox,
    defaultRange,
    lastActiveTimestampMs,
  ]);

  // Binary search hover lookup
  const findNearestProduce = useCallback(
    (targetMs: number): ProcessedProduce | null => {
      if (sortedProduces.length === 0) return null;

      let low = 0;
      let high = sortedProduces.length - 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midMs = sortedProduces[mid].epochMs;

        if (midMs < targetMs) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      let nearest: ProcessedProduce | null = null;
      let minDiff = Infinity;

      for (let i = Math.max(0, low - 2); i <= Math.min(sortedProduces.length - 1, low + 2); i++) {
        const diff = Math.abs(sortedProduces[i].epochMs - targetMs);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = sortedProduces[i];
        }
      }

      return nearest;
    },
    [sortedProduces]
  );

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const chartW = dimensions.width - padding.left - padding.right;
    const chartH = dimensions.height - padding.top - padding.bottom;

    if (isSelecting && selectionBox) {
      setSelectionBox((prev) => (prev ? { ...prev, currentX: mouseX } : null));
      setTooltipData(null);
      return;
    }

    if (
      mouseX < padding.left ||
      mouseX > padding.left + chartW ||
      mouseY < padding.top ||
      mouseY > padding.top + chartH
    ) {
      setTooltipData(null);
      return;
    }

    const span = zoomRange.endMs - zoomRange.startMs;
    const targetMs = zoomRange.startMs + ((mouseX - padding.left) / chartW) * span;

    if (showIndividualProduces) {
      const nearest = findNearestProduce(targetMs);
      if (nearest) {
        const nearestX = padding.left + ((nearest.epochMs - zoomRange.startMs) / span) * chartW;
        if (Math.abs(nearestX - mouseX) <= 12) {
          setTooltipData({
            x: mouseX,
            y: mouseY,
            type: 'produce',
            produce: {
              id: nearest.id,
              timestampIst: formatDateTimeIst(nearest.epochMs),
              result: nearest.result,
              partModelId: nearest.partModelId,
            },
          });
          return;
        }
      }
    }

    for (const seg of processedSegments) {
      if (targetMs >= seg.startMs && targetMs <= seg.endMs) {
        const durationMins = Math.round((seg.endMs - seg.startMs) / (60 * 1000));
        setTooltipData({
          x: mouseX,
          y: mouseY,
          type: 'segment',
          segment: {
            title: seg.title,
            type: seg.type,
            durationFormatted: `${durationMins} mins`,
            rangeIst: `${formatTimeIst(seg.startMs)} – ${formatTimeIst(seg.endMs)}`,
            color: seg.color,
          },
        });
        return;
      }
    }

    setTooltipData(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;

    if (mouseX >= padding.left && mouseX <= dimensions.width - padding.right) {
      setIsSelecting(true);
      setSelectionBox({ startX: mouseX, currentX: mouseX });
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionBox) {
      const chartW = dimensions.width - padding.left - padding.right;
      const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
      const x2 = Math.max(selectionBox.startX, selectionBox.currentX);

      if (x2 - x1 > 12) {
        const span = zoomRange.endMs - zoomRange.startMs;
        const newStartMs = zoomRange.startMs + ((x1 - padding.left) / chartW) * span;
        const newEndMs = zoomRange.startMs + ((x2 - padding.left) / chartW) * span;

        if (newEndMs - newStartMs >= 60 * 1000 * 5) {
          setZoomRange({
            startMs: Math.max(defaultRange.startMs, Math.round(newStartMs)),
            endMs: Math.min(defaultRange.endMs, Math.round(newEndMs)),
          });
        }
      }
    }

    setIsSelecting(false);
    setSelectionBox(null);
  };

  const handleDoubleClick = () => {
    handleResetZoom();
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
      }}
    >
      {/* Floating Interactive Zoom Toolbar */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(6px)',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          p: 0.5,
        }}
      >
        {/* Quick Time Presets (especially useful when Show Individual Produces is ON) */}
        {showIndividualProduces && (
          <Box sx={{ display: 'flex', gap: 0.5, mr: 0.5 }}>
            <Chip
              label="1h"
              size="small"
              onClick={() => handleZoomPreset(1)}
              variant="outlined"
              sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              label="2h"
              size="small"
              onClick={() => handleZoomPreset(2)}
              variant="outlined"
              sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              label="Full"
              size="small"
              onClick={handleResetZoom}
              variant={!isZoomed ? 'filled' : 'outlined'}
              color={!isZoomed ? 'primary' : 'default'}
              sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            />
          </Box>
        )}

        <ButtonGroup size="small" variant="outlined" sx={{ height: 26 }}>
          <Tooltip title="Zoom In (or scroll wheel up)">
            <IconButton size="small" onClick={handleZoomIn} sx={{ p: 0.4, borderRadius: 0 }}>
              <ZoomInIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out (or scroll wheel down)">
            <IconButton size="small" onClick={handleZoomOut} sx={{ p: 0.4, borderRadius: 0 }}>
              <ZoomOutIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {isZoomed && (
          <Tooltip title="Reset to full shift window">
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={handleResetZoom}
              startIcon={<ResetIcon sx={{ fontSize: '0.95rem !important' }} />}
              sx={{
                height: 26,
                fontSize: '0.72rem',
                textTransform: 'none',
                fontWeight: 600,
                px: 1,
              }}
            >
              Reset
            </Button>
          </Tooltip>
        )}
      </Box>

      <canvas
        ref={canvasRef}
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          display: 'block',
          cursor: isSelecting ? 'col-resize' : 'crosshair',
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsSelecting(false);
          setSelectionBox(null);
          setTooltipData(null);
        }}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />

      <TimelineTooltip data={tooltipData} containerWidth={dimensions.width} />
    </div>
  );
};

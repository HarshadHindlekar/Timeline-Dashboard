import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
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
  const [dimensions, setDimensions] = useState({ width: 1000, height: 310 });

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

  // Drag selection state for brush zoom
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; currentX: number } | null>(null);

  // Tooltip state
  const [tooltipData, setTooltipData] = useState<HoverTooltipData | null>(null);

  // Generous padding so Y-axis labels, X-axis labels, and badges never get clipped
  const padding = useMemo(() => ({ top: 40, right: 35, bottom: 50, left: 60 }), []);

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
  // At shift start: count is 0.
  // Each bucket's cumulative count is achieved at the END of the bucket (bucket_start + 1 hour)!
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
    const points: { epochMs: number; cumulative: number }[] = [];

    // Point at shift start: 0
    points.push({ epochMs: defaultRange.startMs, cumulative: 0 });

    for (const [startMs, count] of sortedBuckets) {
      runningTotal += count;
      const endMs = startMs + 3600000;
      points.push({ epochMs: endMs, cumulative: runningTotal });
    }

    return points;
  }, [intervals?.produce_counts, defaultRange.startMs]);

  // Dynamic Y Scale with 25px top headroom (so line and badges NEVER touch the ceiling)
  const yAxisConfig = useMemo(() => {
    let highest = 0;
    if (showIndividualProduces && sortedProduces.length > 0) {
      highest = sortedProduces.length;
    } else if (cumulativePoints.length > 0) {
      highest = Math.max(...cumulativePoints.map((p) => p.cumulative));
    }

    // Default to clean enterprise steps (0, 250, 500) matching SS 2
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

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        setDimensions({
          width: Math.max(clientWidth, 600),
          height: 310,
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

    // Reserve 25px headroom inside the chart area above the top tick (e.g. 500)
    const topHeadroom = 25;
    const plotH = chartH - topHeadroom;

    // Clear background to crisp white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Helpers to project time to X and count to Y
    const timeToX = (ms: number): number => {
      const span = zoomRange.endMs - zoomRange.startMs;
      if (span <= 0) return padding.left;
      return padding.left + ((ms - zoomRange.startMs) / span) * chartW;
    };

    const countToY = (count: number): number => {
      if (yAxisConfig.yMax <= 0) return padding.top + chartH;
      // Maps 0 to bottom (padding.top + chartH) and yMax to (padding.top + topHeadroom)
      return padding.top + chartH - (count / yAxisConfig.yMax) * plotH;
    };

    // 1. Draw segment bands ONLY within the clip box so they stay inside chart bounds
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

        // Vertical label if wide enough
        if (segW >= 20) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

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

    // 2. Draw Y-Axis Grid Lines & Tick Labels
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const val of yAxisConfig.ticks) {
      const y = countToY(val);

      // Label on the left
      ctx.fillStyle = '#64748b';
      ctx.fillText(String(val), padding.left - 10, y);

      // Light horizontal grid line spanning chart width
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    // Y Axis Title: Cumulative production (top left)
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cumulative production', padding.left, padding.top - 14);

    // 3. Draw Cumulative Line or Individual Produces (UNCLIPPED so badges and markers are never cut off)
    if (!showIndividualProduces) {
      // MODE: Cumulative Line (Mockup 3 / SS 2)
      if (cumulativePoints.length > 1) {
        // Draw blue line
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

        // Draw points with circular nodes and rounded blue badges (SS 2)
        for (const pt of cumulativePoints) {
          const x = timeToX(pt.epochMs);
          const y = countToY(pt.cumulative);

          // White circular node with blue border
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#2563eb';
          ctx.stroke();

          // Value badge matching mockup (Image 2)
          if (showPointLabels) {
            const labelText = String(pt.cumulative);
            ctx.font = 'bold 9.5px Inter, sans-serif';
            const textWidth = ctx.measureText(labelText).width;
            const badgeW = textWidth + 10;
            const badgeH = 15;
            // Position badge to the right of node
            const badgeX = x + 6;
            const badgeY = y - 7.5;

            // Blue pill background with crisp border
            ctx.fillStyle = '#1976d2';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3.5);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // White text inside pill
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
          const px = Math.floor(timeToX(p.epochMs));
          if (!passBins.has(px)) {
            passBins.set(px, p);
          }
        }
      }

      // PASS markers (Circles)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1.5;

      passBins.forEach((p) => {
        const x = timeToX(p.epochMs);
        const y = countToY(p.cumulativeIndex);

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
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

    // 4. Draw "NOW" Indicator Line & Badge
    if (lastActiveTimestampMs && lastActiveTimestampMs < defaultRange.endMs) {
      if (lastActiveTimestampMs >= zoomRange.startMs && lastActiveTimestampMs <= zoomRange.endMs) {
        const nowX = timeToX(lastActiveTimestampMs);

        // Vertical boundary line
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nowX, padding.top);
        ctx.lineTo(nowX, padding.top + chartH);
        ctx.stroke();

        // "NOW" badge on top
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

    // 5. Draw X-Axis Baseline & Ticks
    // Crisp bottom axis baseline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.stroke();

    // Shift-Aligned Ticks (Matching SS 2: 08:30, 09:30, 11:30, 13:30, 15:30, 17:30, 19:00)
    ctx.fillStyle = '#334155';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const startIst = dayjs(defaultRange.startMs);
    const endIst = dayjs(defaultRange.endMs);
    const totalShiftHours = endIst.diff(startIst, 'minute') / 60;

    const tickMoments: dayjs.Dayjs[] = [startIst];
    if (totalShiftHours >= 2) {
      tickMoments.push(startIst.add(1, 'hour'));
      let hourCursor = 3;
      while (hourCursor < totalShiftHours - 0.5) {
        tickMoments.push(startIst.add(hourCursor, 'hour'));
        hourCursor += 2;
      }
    }
    tickMoments.push(endIst);

    for (const tick of tickMoments) {
      const tickMs = tick.valueOf();
      if (tickMs >= zoomRange.startMs && tickMs <= zoomRange.endMs) {
        const x = timeToX(tickMs);

        // Downward tick mark
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, padding.top + chartH);
        ctx.lineTo(x, padding.top + chartH + 6);
        ctx.stroke();

        // Tick text label in IST
        ctx.fillText(formatTimeIst(tickMs), x, padding.top + chartH + 9);
      }
    }

    // X Axis Subtitle: Shift time
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Shift time', padding.left + chartW / 2, padding.top + chartH + 28);

    // 6. Brush Zoom Selection Box
    if (isSelecting && selectionBox) {
      const selX1 = Math.min(selectionBox.startX, selectionBox.currentX);
      const selW = Math.abs(selectionBox.currentX - selectionBox.startX);

      ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1;
      ctx.fillRect(selX1, padding.top, selW, chartH);
      ctx.strokeRect(selX1, padding.top, selW, chartH);
    }
  }, [
    dimensions,
    padding,
    zoomRange,
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

      if (x2 - x1 > 15) {
        const span = zoomRange.endMs - zoomRange.startMs;
        const newStartMs = zoomRange.startMs + ((x1 - padding.left) / chartW) * span;
        const newEndMs = zoomRange.startMs + ((x2 - padding.left) / chartW) * span;

        if (newEndMs - newStartMs >= 60 * 1000) {
          setZoomRange({
            startMs: Math.max(defaultRange.startMs, newStartMs),
            endMs: Math.min(defaultRange.endMs, newEndMs),
          });
        }
      }
    }

    setIsSelecting(false);
    setSelectionBox(null);
  };

  const handleDoubleClick = () => {
    setZoomRange(defaultRange);
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
      />

      <TimelineTooltip data={tooltipData} containerWidth={dimensions.width} />
    </div>
  );
};

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  MachineIntervalsData,
} from '../../types/analytics';
import { HoverTooltipData, TimelineTooltip } from './TimelineTooltip';
import { SEGMENT_COLORS } from './TimelineLegend';
import { formatTimeIst, formatDateTimeIst, getNowIst } from '../../utils/timezone';
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
  const [dimensions, setDimensions] = useState({ width: 1000, height: 260 });

  // Zoom range state [startMs, endMs]
  const defaultRange = useMemo(() => {
    const s = dayjs(windowStartUtc).valueOf();
    const e = dayjs(windowEndUtc).valueOf();
    return { startMs: s, endMs: e };
  }, [windowStartUtc, windowEndUtc]);

  const [zoomRange, setZoomRange] = useState<{ startMs: number; endMs: number }>(defaultRange);

  // Update zoom range when shift window changes
  useEffect(() => {
    setZoomRange(defaultRange);
  }, [defaultRange]);

  // Drag selection state for brush zoom
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; currentX: number } | null>(null);

  // Tooltip state
  const [tooltipData, setTooltipData] = useState<HoverTooltipData | null>(null);

  // Chart padding
  const padding = useMemo(() => ({ top: 30, right: 30, bottom: 40, left: 55 }), []);

  // 1. Preprocess and sort all individual produces once
  const sortedProduces = useMemo<ProcessedProduce[]>(() => {
    if (!intervals?.produces || intervals.produces.length === 0) return [];

    const items: ProcessedProduce[] = [];
    for (const group of intervals.produces) {
      if (group.produces) {
        for (const p of group.produces) {
          items.push({
            id: p.produce_id,
            epochMs: dayjs(p.first_seen_ts).valueOf(),
            result: p.result,
            partModelId: p.part_model_id,
            produceType: p.produce_type,
          });
        }
      }
    }

    // Sort by timestamp ascending for binary search
    return items.sort((a, b) => a.epochMs - b.epochMs);
  }, [intervals?.produces]);

  // 2. Preprocess segments
  const processedSegments = useMemo<ProcessedSegment[]>(() => {
    if (!intervals) return [];
    const list: ProcessedSegment[] = [];

    // Runtimes
    for (const r of intervals.runtimes || []) {
      const cat = categorizeSegment(r, 'runtime');
      list.push({
        startMs: dayjs(r.start_at).valueOf(),
        endMs: dayjs(r.end_at).valueOf(),
        type: r.type,
        title: cat === 'unknown_unplanned_production' ? 'Unplanned Production' : 'Runtime',
        color: cat === 'unknown_unplanned_production' ? SEGMENT_COLORS.unplannedProduction : SEGMENT_COLORS.runtime,
      });
    }

    // Downtimes
    for (const d of intervals.downtimes || []) {
      const cat = categorizeSegment(d, 'downtime');
      const isUnknown = cat === 'unknown_downtime';
      list.push({
        startMs: dayjs(d.start_at).valueOf(),
        endMs: dayjs(d.end_at).valueOf(),
        type: d.type,
        title: isUnknown ? 'Unknown Downtime' : 'Planned Downtime',
        color: isUnknown ? SEGMENT_COLORS.unknownDowntime : SEGMENT_COLORS.plannedDowntime,
      });
    }

    // Stoppages
    for (const s of intervals.stoppages || []) {
      list.push({
        startMs: dayjs(s.start_at).valueOf(),
        endMs: dayjs(s.end_at).valueOf(),
        type: 'stoppage',
        title: 'Minor Stoppage',
        color: SEGMENT_COLORS.minorStoppage,
      });
    }

    return list.sort((a, b) => a.startMs - b.startMs);
  }, [intervals]);

  // 3. Precompute cumulative line points when individual produces is off
  const cumulativePoints = useMemo(() => {
    if (!intervals?.produce_counts || intervals.produce_counts.length === 0) return [];

    // Group produce counts by bucket_start
    const bucketsMap = new Map<number, number>();
    for (const count of intervals.produce_counts) {
      const ms = dayjs(count.bucket_start).valueOf();
      const current = bucketsMap.get(ms) || 0;
      bucketsMap.set(ms, current + (count.ok_count || 0) + (count.ng_count || 0));
    }

    const sortedBuckets = Array.from(bucketsMap.entries()).sort((a, b) => a[0] - b[0]);

    let runningTotal = 0;
    const points: { epochMs: number; cumulative: number }[] = [];

    // Start with 0 at shift start
    const shiftStartMs = defaultRange.startMs;
    points.push({ epochMs: shiftStartMs, cumulative: 0 });

    for (const [ms, count] of sortedBuckets) {
      runningTotal += count;
      points.push({ epochMs: ms, cumulative: runningTotal });
    }

    return points;
  }, [intervals?.produce_counts, defaultRange.startMs]);

  // Max cumulative count for Y scale
  const maxCumulative = useMemo(() => {
    if (showIndividualProduces && sortedProduces.length > 0) {
      return sortedProduces.length;
    }
    if (cumulativePoints.length > 0) {
      return Math.max(...cumulativePoints.map((p) => p.cumulative), 10);
    }
    return 100;
  }, [showIndividualProduces, sortedProduces.length, cumulativePoints]);

  // Handle ResizeObserver
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        setDimensions({
          width: Math.max(clientWidth, 600),
          height: 260,
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

    // Clear background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Helpers to project time to X and count to Y
    const timeToX = (ms: number): number => {
      const span = zoomRange.endMs - zoomRange.startMs;
      if (span <= 0) return padding.left;
      return padding.left + ((ms - zoomRange.startMs) / span) * chartW;
    };

    const countToY = (count: number): number => {
      if (maxCumulative <= 0) return padding.top + chartH;
      return padding.top + chartH - (count / maxCumulative) * chartH;
    };

    // Clip to chart area for segment bands and produce data
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartW, chartH);
    ctx.clip();

    // 1. Draw segment bands
    for (const seg of processedSegments) {
      const x1 = Math.max(timeToX(seg.startMs), padding.left);
      const x2 = Math.min(timeToX(seg.endMs), padding.left + chartW);
      const segW = x2 - x1;

      if (segW > 0) {
        ctx.fillStyle = seg.color;
        ctx.fillRect(x1, padding.top, segW, chartH);

        // Vertical label if wide enough
        if (segW >= 24) {
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Rotate text vertically
          const textX = x1 + segW / 2;
          const textY = padding.top + chartH / 2;
          ctx.translate(textX, textY);
          ctx.rotate(-Math.PI / 2);

          const labelText = seg.title.toUpperCase();
          ctx.fillText(labelText, 0, 0);
          ctx.restore();
        }
      }
    }

    // 2. Draw Cumulative Line or Individual Produces
    if (!showIndividualProduces) {
      // Draw cumulative line
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

        // Draw points
        for (const pt of cumulativePoints) {
          const x = timeToX(pt.epochMs);
          const y = countToY(pt.cumulative);

          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#2563eb';
          ctx.stroke();

          // Value label
          if (showPointLabels) {
            ctx.fillStyle = '#1e3a8a';
            ctx.font = '600 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(pt.cumulative), x, y - 8);
          }
        }
      }
    } else {
      // SHOW INDIVIDUAL PRODUCES (10,000 - 20,000 markers)
      // HIGH PERFORMANCE BINNING ENGINE:
      // STRICT RULE 1: Never drop a FAIL marker!
      // STRICT RULE 2: Pre-resolved geometry, zero date parsing in render loop.

      const passBins = new Map<number, ProcessedProduce>();
      const visibleFails: ProcessedProduce[] = [];

      for (let i = 0; i < sortedProduces.length; i++) {
        const p = sortedProduces[i];
        if (p.epochMs < zoomRange.startMs || p.epochMs > zoomRange.endMs) {
          continue;
        }

        if (p.result === 'FAIL') {
          // ALWAYS RENDER 100% OF FAILS
          visibleFails.push(p);
        } else {
          // Bin PASS markers into screen pixels
          const px = Math.floor(timeToX(p.epochMs));
          if (!passBins.has(px)) {
            passBins.set(px, p);
          }
        }
      }

      // Draw PASS markers (Circles)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 1.5;

      passBins.forEach((p) => {
        const x = timeToX(p.epochMs);
        // Distribute Y slightly or along cumulative progression
        const y = padding.top + chartH * 0.7;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Draw FAIL markers (Crosses / Red circles with high visibility)
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 2;
      for (const p of visibleFails) {
        const x = timeToX(p.epochMs);
        const y = padding.top + chartH * 0.7;

        // Draw cross '✕'
        const size = 5;
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.stroke();
      }
    }

    // 3. Draw "NOW" indicator if inside zoom window
    const nowMs = getNowIst().valueOf();
    if (nowMs >= zoomRange.startMs && nowMs <= zoomRange.endMs) {
      const nowX = timeToX(nowMs);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(nowX, padding.top);
      ctx.lineTo(nowX, padding.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // "NOW" badge at top
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(nowX - 18, padding.top + 4, 36, 16, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NOW', nowX, padding.top + 12);
    }

    // Restore clip
    ctx.restore();

    // 4. Draw Axes and Grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;

    // Bottom axis line
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.stroke();

    // Time Axis Ticks (IST)
    const tickCount = Math.max(4, Math.floor(chartW / 120));
    const timeStep = (zoomRange.endMs - zoomRange.startMs) / tickCount;

    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i <= tickCount; i++) {
      const tickMs = zoomRange.startMs + i * timeStep;
      const x = timeToX(tickMs);

      // Tick mark
      ctx.beginPath();
      ctx.moveTo(x, padding.top + chartH);
      ctx.lineTo(x, padding.top + chartH + 5);
      ctx.stroke();

      // Tick label in IST
      const label = formatTimeIst(tickMs);
      ctx.fillText(label, x, padding.top + chartH + 8);
    }

    // Y Axis labels (Cumulative production count)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTicks = [0, Math.round(maxCumulative / 2), Math.round(maxCumulative)];
    for (const val of yTicks) {
      const y = countToY(val);
      ctx.fillText(String(val), padding.left - 8, y);

      // Light horizontal grid line
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    // Y Axis Title
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cumulative production', padding.left, padding.top - 12);
    ctx.restore();

    // X Axis Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Shift time (IST)', padding.left + chartW / 2, padding.top + chartH + 26);

    // 5. Draw Brush Selection overlay if active
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
    maxCumulative,
    showIndividualProduces,
    showPointLabels,
    isSelecting,
    selectionBox,
  ]);

  // Fast Binary Search to find nearest produce marker for hover
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

      // Check neighbors
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

  // Mouse Interaction: Hover Tooltip & Brush Selection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const chartW = dimensions.width - padding.left - padding.right;
    const chartH = dimensions.height - padding.top - padding.bottom;

    // Brush selection drag update
    if (isSelecting && selectionBox) {
      setSelectionBox((prev) => (prev ? { ...prev, currentX: mouseX } : null));
      setTooltipData(null);
      return;
    }

    // Inside chart boundary check
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

    // 1. Check produce marker hit
    if (showIndividualProduces) {
      const nearest = findNearestProduce(targetMs);
      if (nearest) {
        const nearestX = padding.left + ((nearest.epochMs - zoomRange.startMs) / span) * chartW;
        if (Math.abs(nearestX - mouseX) <= 10) {
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

    // 2. Check segment band hit
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

      // Only zoom if dragged at least 15 pixels
      if (x2 - x1 > 15) {
        const span = zoomRange.endMs - zoomRange.startMs;
        const newStartMs = zoomRange.startMs + ((x1 - padding.left) / chartW) * span;
        const newEndMs = zoomRange.startMs + ((x2 - padding.left) / chartW) * span;

        // Ensure at least 60 seconds span
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
    // Reset zoom back to full shift window
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

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  TimelineCanvasProps,
  ProcessedProduce,
  HoverTooltipData,
  ChartDimensions,
} from '../../types/chart';
import { TimelineTooltip } from './TimelineTooltip';
import { TimelineZoomControls } from './TimelineZoomControls';
import { useTimelineData } from './hooks/useTimelineData';
import { useTimelineZoom } from './hooks/useTimelineZoom';
import {
  drawBackground,
  drawSegments,
  drawGridAndAxes,
  drawCumulativeLine,
  drawIndividualProduces,
  drawNowIndicator,
  drawSelectionBox,
} from './renderers/chartDrawers';
import { formatTimeIst, formatDateTimeIst } from '../../utils/timezone';

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

  // Shift range
  const defaultRange = useMemo(() => {
    const s = dayjs(windowStartUtc).valueOf();
    const e = dayjs(windowEndUtc).valueOf();
    return { startMs: s, endMs: e };
  }, [windowStartUtc, windowEndUtc]);

  // Layout padding & gap
  const padding = useMemo(() => ({ top: 35, right: 35, bottom: 65, left: 55 }), []);
  const axisGap = 16; // 16px white gap between chart box and X-axis baseline

  // 1. Data preprocessing hook
  const {
    sortedProduces,
    lastActiveTimestampMs,
    processedSegments,
    cumulativePoints,
    yAxisConfig,
  } = useTimelineData(intervals, defaultRange, showIndividualProduces);

  // 2. Zoom & brush selection hook
  const {
    zoomRange,
    isZoomed,
    isSelecting,
    selectionBox,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleZoomPreset,
    handleWheel,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
  } = useTimelineZoom(defaultRange, canvasRef, dimensions, padding);

  // Tooltip state
  const [tooltipData, setTooltipData] = useState<HoverTooltipData | null>(null);

  // Responsive resize observer
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

    const chartDims: ChartDimensions = {
      width,
      height,
      padding,
      chartW,
      chartH,
      axisGap,
    };

    // Coordinate projection helpers
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

    // 1. Clear background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw chart area background & gray future screen
    drawBackground(ctx, chartDims, lastActiveTimestampMs, defaultRange, timeToX);

    // 3. Draw segment bands
    drawSegments(ctx, chartDims, processedSegments, timeToX);

    // 4. Draw grid & axes
    drawGridAndAxes(ctx, chartDims, yAxisConfig, zoomRange, countToY, timeToX, isZoomed);

    // 5. Draw cumulative line or individual produce points
    if (!showIndividualProduces) {
      drawCumulativeLine(ctx, chartDims, cumulativePoints, timeToX, countToY, showPointLabels);
    } else {
      drawIndividualProduces(ctx, sortedProduces, zoomRange, timeToX, countToY);
    }

    // 6. Draw NOW indicator
    drawNowIndicator(ctx, chartDims, lastActiveTimestampMs, defaultRange, zoomRange, timeToX);

    // 7. Draw brush zoom selection box
    if (isSelecting && selectionBox) {
      drawSelectionBox(ctx, chartDims, selectionBox);
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

  // Binary search for nearest produce
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

    if (isSelecting) {
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

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
      }}
    >
      <TimelineZoomControls
        showIndividualProduces={showIndividualProduces}
        isZoomed={isZoomed}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onZoomPreset={handleZoomPreset}
      />

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
          handleMouseLeave();
          setTooltipData(null);
        }}
        onDoubleClick={handleResetZoom}
        onWheel={handleWheel}
      />

      <TimelineTooltip data={tooltipData} containerWidth={dimensions.width} />
    </div>
  );
};

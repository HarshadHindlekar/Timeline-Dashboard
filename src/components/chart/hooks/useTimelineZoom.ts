import { useState, useMemo, useEffect, useCallback, RefObject } from 'react';
import { ZoomRange, SelectionBox } from '../../../types/chart';

export const useTimelineZoom = (
  defaultRange: ZoomRange,
  canvasRef: RefObject<HTMLCanvasElement>,
  dimensions: { width: number; height: number },
  padding: { top: number; right: number; bottom: number; left: number }
) => {
  const [zoomRange, setZoomRange] = useState<ZoomRange>(defaultRange);

  useEffect(() => {
    setZoomRange(defaultRange);
  }, [defaultRange]);

  const isZoomed = useMemo(() => {
    return zoomRange.startMs !== defaultRange.startMs || zoomRange.endMs !== defaultRange.endMs;
  }, [zoomRange, defaultRange]);

  // Drag selection state for brush zoom
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const handleZoomIn = useCallback(() => {
    const span = zoomRange.endMs - zoomRange.startMs;
    const centerMs = (zoomRange.startMs + zoomRange.endMs) / 2;
    const newSpan = Math.max(60 * 1000 * 15, span * 0.65); // minimum 15 mins
    const newStart = Math.max(defaultRange.startMs, centerMs - newSpan / 2);
    const newEnd = Math.min(defaultRange.endMs, newStart + newSpan);
    setZoomRange({ startMs: Math.round(newStart), endMs: Math.round(newEnd) });
  }, [zoomRange, defaultRange]);

  const handleZoomOut = useCallback(() => {
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
  }, [zoomRange, defaultRange]);

  const handleResetZoom = useCallback(() => {
    setZoomRange(defaultRange);
  }, [defaultRange]);

  const handleZoomPreset = useCallback((hours: number) => {
    const spanMs = hours * 3600000;
    const startMs = defaultRange.startMs;
    const endMs = Math.min(defaultRange.endMs, startMs + spanMs);
    setZoomRange({ startMs, endMs });
  }, [defaultRange]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
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
  }, [canvasRef, dimensions.width, padding.left, padding.right, zoomRange, defaultRange]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;

    if (mouseX >= padding.left && mouseX <= dimensions.width - padding.right) {
      setIsSelecting(true);
      setSelectionBox({ startX: mouseX, currentX: mouseX });
    }
  }, [canvasRef, dimensions.width, padding.left, padding.right]);

  const handleSelectionMove = useCallback((mouseX: number) => {
    if (isSelecting) {
      setSelectionBox((prev) => (prev ? { ...prev, currentX: mouseX } : null));
    }
  }, [isSelecting]);

  const handleMouseUp = useCallback(() => {
    if (isSelecting && selectionBox) {
      const chartW = dimensions.width - padding.left - padding.right;
      const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
      const x2 = Math.max(selectionBox.startX, selectionBox.currentX);

      // Require a drag of at least 8px to differentiate from a click
      if (x2 - x1 > 8) {
        const span = zoomRange.endMs - zoomRange.startMs;
        const newStartMs = zoomRange.startMs + ((x1 - padding.left) / chartW) * span;
        const newEndMs = zoomRange.startMs + ((x2 - padding.left) / chartW) * span;

        // Minimum zoom span: 60 seconds (as specified in assignment brief)
        if (newEndMs - newStartMs >= 60 * 1000) {
          setZoomRange({
            startMs: Math.max(defaultRange.startMs, Math.round(newStartMs)),
            endMs: Math.min(defaultRange.endMs, Math.round(newEndMs)),
          });
        }
      }
    }

    setIsSelecting(false);
    setSelectionBox(null);
  }, [isSelecting, selectionBox, dimensions.width, padding.left, padding.right, zoomRange, defaultRange]);

  const handleMouseLeave = useCallback(() => {
    setIsSelecting(false);
    setSelectionBox(null);
  }, []);

  return {
    zoomRange,
    setZoomRange,
    isZoomed,
    isSelecting,
    selectionBox,
    setSelectionBox,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleZoomPreset,
    handleWheel,
    handleMouseDown,
    handleSelectionMove,
    handleMouseUp,
    handleMouseLeave,
  };
};

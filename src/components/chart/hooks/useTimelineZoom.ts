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

  // Drag selection state for brush zoom (Shift + drag or click-drag)
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const handleResetZoom = useCallback(() => {
    setZoomRange(defaultRange);
  }, [defaultRange]);

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
    handleResetZoom,
    handleMouseDown,
    handleSelectionMove,
    handleMouseUp,
    handleMouseLeave,
  };
};

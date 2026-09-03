import dayjs from 'dayjs';
import { ProcessedProduce, ProcessedSegment } from '../../../types/chart';
import { CumulativePoint, YAxisConfig } from '../hooks/useTimelineData';
import { formatTimeIst } from '../../../utils/timezone';

export interface ChartDimensions {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  chartW: number;
  chartH: number;
  axisGap: number;
}

export const drawBackground = (
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  lastActiveTimestampMs: number | null,
  defaultRange: { startMs: number; endMs: number },
  timeToX: (ms: number) => number
) => {
  const { padding, chartW, chartH } = dimensions;

  // Active zone is crisp white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(padding.left, padding.top, chartW, chartH);

  // Future un-elapsed zone is light gray screen matching mockup
  if (lastActiveTimestampMs && lastActiveTimestampMs < defaultRange.endMs) {
    const nowX = timeToX(lastActiveTimestampMs);
    const futureW = padding.left + chartW - nowX;
    if (futureW > 0) {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(nowX, padding.top, futureW, chartH);
    }
  }
};

export const drawSegments = (
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  processedSegments: ProcessedSegment[],
  timeToX: (ms: number) => number
) => {
  const { padding, chartW, chartH } = dimensions;

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
  ctx.restore();
};

export const drawGridAndAxes = (
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  yAxisConfig: YAxisConfig,
  zoomRange: { startMs: number; endMs: number },
  countToY: (count: number) => number,
  timeToX: (ms: number) => number,
  isZoomed: boolean
) => {
  const { padding, chartW, chartH, axisGap } = dimensions;

  // Chart Box Outline
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding.left, padding.top, chartW, chartH);

  // Y Axis Ticks & Horizontal Grid Lines
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

  // Y Axis Title: Cumulative production
  ctx.fillStyle = '#64748b';
  ctx.font = '500 11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Cumulative production', padding.left, padding.top - 14);

  // X Axis Baseline (with 16px white gap matching mockup)
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
};

export const drawCumulativeLine = (
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  cumulativePoints: CumulativePoint[],
  timeToX: (ms: number) => number,
  countToY: (count: number) => number,
  showPointLabels: boolean
) => {
  if (cumulativePoints.length <= 1) return;
  const { padding, chartW, chartH } = dimensions;

  // Draw continuous line
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

  // Draw circular nodes and value badges
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
};

export const drawIndividualProduces = (
  ctx: CanvasRenderingContext2D,
  sortedProduces: ProcessedProduce[],
  zoomRange: { startMs: number; endMs: number },
  timeToX: (ms: number) => number,
  countToY: (count: number) => number
) => {
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
      const px = Math.floor(timeToX(p.epochMs) * 2) / 2;
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
};

export const drawNowIndicator = (
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  lastActiveTimestampMs: number | null,
  defaultRange: { startMs: number; endMs: number },
  zoomRange: { startMs: number; endMs: number },
  timeToX: (ms: number) => number
) => {
  if (!lastActiveTimestampMs || lastActiveTimestampMs >= defaultRange.endMs) return;
  if (lastActiveTimestampMs < zoomRange.startMs || lastActiveTimestampMs > zoomRange.endMs) return;

  const { padding, chartH } = dimensions;
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
};

export const drawSelectionBox = (
  ctx: CanvasRenderingContext2D,
  dimensions: ChartDimensions,
  selectionBox: { startX: number; currentX: number } | null
) => {
  if (!selectionBox) return;
  const { padding, chartH } = dimensions;
  const selX1 = Math.min(selectionBox.startX, selectionBox.currentX);
  const selW = Math.abs(selectionBox.currentX - selectionBox.startX);

  ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.fillRect(selX1, padding.top, selW, chartH);
  ctx.strokeRect(selX1, padding.top, selW, chartH);
};

import { MachineIntervalsData } from './analytics';

export interface ProcessedProduce {
  id: string;
  epochMs: number;
  result: 'PASS' | 'FAIL';
  partModelId: string;
  produceType: string;
  cumulativeIndex: number;
}

export interface ProcessedSegment {
  startMs: number;
  endMs: number;
  type: string;
  title: string;
  color: string;
}

export interface TimelineCanvasProps {
  intervals: MachineIntervalsData | null | undefined;
  windowStartUtc: string;
  windowEndUtc: string;
  showIndividualProduces: boolean;
  showPointLabels: boolean;
}

export interface TimelineSectionProps {
  intervals: MachineIntervalsData | null | undefined;
  windowStartUtc: string;
  windowEndUtc: string;
  showIndividualProduces: boolean;
  showPointLabels: boolean;
  isFetching?: boolean;
  onToggleIndividualProduces: (val: boolean) => void;
  onTogglePointLabels: (val: boolean) => void;
}

export interface HoverTooltipData {
  x: number;
  y: number;
  type: 'produce' | 'segment';
  produce?: {
    id: string;
    timestampIst: string;
    result: 'PASS' | 'FAIL';
    partModelId: string;
  };
  segment?: {
    title: string;
    type: string;
    durationFormatted: string;
    rangeIst: string;
    color: string;
  };
}

export interface TimelineTooltipProps {
  data: HoverTooltipData | null;
  containerWidth: number;
}

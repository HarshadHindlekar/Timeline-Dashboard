import { HourlySummaryColumn } from './analytics';
import { HourMetrics } from '../utils/segmentSlicer';

export interface HourlySummaryTableProps {
  columns: HourlySummaryColumn[];
  metrics: HourMetrics[];
  isFetching?: boolean;
}

export interface RowConfig {
  key: string;
  label: string;
  getValue: (m: HourMetrics) => string | number | null;
  bold?: boolean;
}

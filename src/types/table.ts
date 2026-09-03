import { HourlySummaryColumn } from './analytics';

export interface HourMetrics {
  totalProduces: number | null;
  passProduces: number | null;
  failProduces: number | null;
  actualCycleTime: string | null;
  idealCycleTime: string | null;
  runtimeMins: number | null;
  plannedDowntimeMins: number | null;
  minorStoppageMins: number | null;
  unknownDowntimeMins: number | null;
  unplannedDowntimeMins: number | null;
  unplannedProductionMins: number | null;
  unknownUnplannedProductionMins: number | null;
  isFuture: boolean;
}

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

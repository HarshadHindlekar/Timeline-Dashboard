export interface EntityScope {
  type: 'asset';
  asset: {
    asset_id: string;
    asset_level_id: number;
  };
}

export interface TimeRangeUtc {
  from_ts: string;
  to_ts: string;
}

export interface MachineIntervalsRequest {
  entity_scope: EntityScope;
  time_range: TimeRangeUtc;
  produce_counts: boolean;
  exact_produces: boolean;
  group_produce_counts_by_part_model: boolean;
}

export interface SegmentInterval {
  start_at: string; // UTC ISO string
  end_at: string;   // UTC ISO string
  type: string;
  name?: string | null;
  category: 'runtime' | 'unplanned_production' | 'planned_downtime' | 'unplanned_downtime' | 'unknown_downtime' | 'stoppage';
}

export interface RuntimeSegment {
  start_at: string;
  end_at: string;
  type: string; // e.g. "planned" or "unknown unplanned production"
  runtime_name: string | null;
}

export interface DowntimeSegment {
  start_at: string;
  end_at: string;
  type: string; // e.g. "unknown" or specific downtime
  downtime_name: string | null;
}

export interface StoppageSegment {
  start_at: string;
  end_at: string;
  type?: string;
  stoppage_name?: string | null;
}

export interface ProduceCountBucket {
  bucket_start: string; // UTC ISO string
  part_model_id: string;
  ok_count: number;
  ng_count: number;
}

export interface IndividualProduce {
  produce_id: string;
  first_seen_ts: string; // UTC ISO string
  result: 'PASS' | 'FAIL';
  produce_type: string;
  part_model_id: string;
}

export interface ProduceGroupBucket {
  bucket_start: string;
  part_model_id: string;
  produces: IndividualProduce[];
}

export interface MachineIntervalsData {
  machine_ids: number[];
  runtimes: RuntimeSegment[];
  downtimes: DowntimeSegment[];
  stoppages: StoppageSegment[];
  produce_counts: ProduceCountBucket[];
  produces?: ProduceGroupBucket[];
}

export interface CycleTimeRequest {
  entity_scope: EntityScope;
  metrics: string[];
  time_range: TimeRangeUtc;
  distribution: 'hourly';
}

export interface CycleTimeHourlyBucket {
  entity_id?: string;
  bucket_start: string; // UTC ISO string
  ideal_cycle_time_seconds: number | null;
  actual_cycle_time_seconds: number | null;
}

export interface HourlySummaryRow {
  label: string;
  key: string;
  values: (string | number | null)[];
}

export interface HourlySummaryColumn {
  bucketIndex: number;
  label: string; // e.g. "08:30 - 09:30"
  startIst: string; // ISO string
  endIst: string;   // ISO string
  startUtc: string; // ISO string
  endUtc: string;   // ISO string
  isFuture: boolean;
}
